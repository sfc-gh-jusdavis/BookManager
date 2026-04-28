# Plan: Platform Adoption Signals

## Overview

Add 3 capabilities to BookManager: (1) which of 8+ platform areas each account is using, (2) an adoption profile showing coverage gaps, (3) `new_feature_adoption` signals when a feature is first used in 30d. Purely additive — all existing ONT tables, SPs, tasks, and the semantic model stay intact.

---

## File + Object Change Summary

| Object | Change |
|---|---|
| `TEMP.JUSDAVIS.BKMNG_ONT_FEATURE_ADOPTION` | **CREATE** — new table |
| `SP_REFRESH_BKMNG_ONT_FEATURE_ADOPTION` | **CREATE** — new SP |
| `TASK_REFRESH_BKMNG_ONT_FEATURE_ADOPTION` | **CREATE** — new daily task |
| `TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS` | **ALTER** — add 10 adoption columns |
| `SP_REFRESH_BKMNG_ONT_ACCOUNTS` | **MODIFY** — add T_OD_ACCOUNT_SIGNALS join |
| `SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS` | **MODIFY** — add new_feature_adoption CTE |
| `bookmanager_assistant.yaml` | **MODIFY** — add feature_adoption table + 4 VQRs |
| `backend/app/services/snowflake_service.py` | **MODIFY** — `get_bookmanager_context()` + `_cortex_complete_text_to_sql()` |

---

## Step 1: Create + Populate BKMNG_ONT_FEATURE_ADOPTION

```sql
CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_ONT_FEATURE_ADOPTION AS
WITH acct_map AS (
    SELECT DISTINCT r.SALESFORCE_ACCOUNT_ID,
                    r.SNOWFLAKE_ACCOUNT_ID::INT AS SNOWFLAKE_ACCOUNT_ID
    FROM SNOWHOUSE.PRODUCT.RELEVANT_SUBSCRIPTION_DAILY_RECORDS r
    JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = r.SALESFORCE_ACCOUNT_ID
),
category_adoption AS (
    SELECT fd.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
           fd.SIGNAL_NAME           AS FEATURE_RAW,
           CASE fd.SIGNAL_NAME
               WHEN 'Pipeline'     THEN 'Pipeline'
               WHEN 'Transforms'   THEN 'Transforms'
               WHEN 'BI'           THEN 'BI & Analytics'
               WHEN 'Cost Gov'     THEN 'Cost Governance'
               WHEN 'Collab'       THEN 'Collaboration'
               WHEN 'Observability' THEN 'Observability'
               WHEN 'AI/ML'        THEN 'AI/ML'
               WHEN 'SPCS'         THEN 'SPCS'
               ELSE fd.SIGNAL_NAME
           END                      AS FEATURE_NAME,
           'category'               AS FEATURE_SOURCE,
           fd.FIRST_SIGNAL_DATE     AS FIRST_USE_DATE
    FROM TEMP.JUSDAVIS.T_OD_SIGNAL_FIRST_DATES fd
    JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = fd.SALESFORCE_ACCOUNT_ID
),
feature_adoption AS (
    SELECT m.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
           u.FEATURE               AS FEATURE_RAW,
           CASE u.FEATURE
               WHEN 'DYNAMIC_TABLES'                                          THEN 'Dynamic Tables'
               WHEN 'CORTEX_SEARCH_REFRESH'                                   THEN 'Cortex Search'
               WHEN 'SYSTEM$CORTEX_MODEL_ACCESSIBLE'                          THEN 'Cortex LLM Functions'
               WHEN 'SYSTEM$SHOW_STREAMLITS_IN_ACCOUNT'                       THEN 'Streamlit Apps'
               WHEN 'SYSTEM$SHOW_NOTEBOOKS_IN_ACCOUNT'                        THEN 'Snowflake Notebooks'
               WHEN 'SYSTEM$GET_METRIC_IDS_FOR_DATA_QUALITY_MONITORING_RESULT' THEN 'Data Quality Monitoring (DMFs)'
               WHEN 'SYSTEM$ALERT_MAKE_SUBSEQUENT_QUERIES_HIDDEN'             THEN 'Alerts'
               WHEN 'SYSTEM$BULK_GET_LISTINGS'                                THEN 'Marketplace Listings'
               WHEN 'EXTERNAL_FUNCTIONS'                                      THEN 'External Functions'
               ELSE u.FEATURE
           END                     AS FEATURE_NAME,
           'feature'               AS FEATURE_SOURCE,
           MIN(u.DS)               AS FIRST_USE_DATE
    FROM SNOWHOUSE.PRODUCT.USAGE_TRACKING_SUMMARY u
    JOIN acct_map m ON m.SNOWFLAKE_ACCOUNT_ID = u.ACCOUNT_ID
    WHERE u.FEATURE IN (
        'DYNAMIC_TABLES','CORTEX_SEARCH_REFRESH','SYSTEM$CORTEX_MODEL_ACCESSIBLE',
        'SYSTEM$SHOW_STREAMLITS_IN_ACCOUNT','SYSTEM$SHOW_NOTEBOOKS_IN_ACCOUNT',
        'SYSTEM$GET_METRIC_IDS_FOR_DATA_QUALITY_MONITORING_RESULT',
        'SYSTEM$ALERT_MAKE_SUBSEQUENT_QUERIES_HIDDEN','SYSTEM$BULK_GET_LISTINGS',
        'EXTERNAL_FUNCTIONS'
    )
    GROUP BY m.SALESFORCE_ACCOUNT_ID, u.FEATURE
),
service_adoption AS (
    SELECT m.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
           c.SERVICE_TYPE          AS FEATURE_RAW,
           CASE c.SERVICE_TYPE
               WHEN 'ICEBERG_STORAGE_OPTIMIZATION' THEN 'Iceberg Tables'
               WHEN 'QUERY_ACCELERATION'           THEN 'Query Acceleration Service'
               WHEN 'SEARCH_INDEX_REFRESH'         THEN 'Search Optimization Service'
               ELSE INITCAP(REPLACE(c.SERVICE_TYPE, '_', ' '))
           END                     AS FEATURE_NAME,
           'service'               AS FEATURE_SOURCE,
           MIN(c.DS)               AS FIRST_USE_DATE
    FROM SNOWHOUSE.PRODUCT.COMPUTE_SERVICE_ACCOUNT_USAGE c
    JOIN acct_map m ON m.SNOWFLAKE_ACCOUNT_ID = c.ACCOUNT_ID
    WHERE c.SERVICE_TYPE IN (
        'ICEBERG_STORAGE_OPTIMIZATION','QUERY_ACCELERATION','SEARCH_INDEX_REFRESH'
    )
    GROUP BY m.SALESFORCE_ACCOUNT_ID, c.SERVICE_TYPE
),
combined AS (
    SELECT * FROM category_adoption
    UNION ALL SELECT * FROM feature_adoption
    UNION ALL SELECT * FROM service_adoption
)
SELECT c.ACCOUNT_ID,
       b.ACCOUNT_NAME,
       c.FEATURE_NAME,
       c.FEATURE_RAW,
       c.FEATURE_SOURCE,
       c.FIRST_USE_DATE,
       DATEDIFF('day', c.FIRST_USE_DATE, CURRENT_DATE()) AS DAYS_SINCE_FIRST_USE,
       c.FIRST_USE_DATE >= DATEADD('day', -30, CURRENT_DATE()) AS IS_NEW_30D,
       c.FIRST_USE_DATE >= DATEADD('day', -90, CURRENT_DATE()) AS IS_NEW_90D
FROM combined c
JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = c.ACCOUNT_ID;
```

Verify: `SELECT COUNT(*), COUNT(DISTINCT ACCOUNT_ID) FROM TEMP.JUSDAVIS.BKMNG_ONT_FEATURE_ADOPTION;`

---

## Step 2: Create SP + Task

```sql
CREATE OR REPLACE PROCEDURE TEMP.JUSDAVIS.SP_REFRESH_BKMNG_ONT_FEATURE_ADOPTION()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS $$
BEGIN
    TRUNCATE TABLE TEMP.JUSDAVIS.BKMNG_ONT_FEATURE_ADOPTION;
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_FEATURE_ADOPTION
    -- [same 3-layer UNION ALL SELECT]
    ;
    RETURN 'OK: ' || (SELECT COUNT(*)::VARCHAR FROM TEMP.JUSDAVIS.BKMNG_ONT_FEATURE_ADOPTION) || ' rows';
END;
$$;

CREATE OR REPLACE TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_ONT_FEATURE_ADOPTION
    WAREHOUSE = SE_XS_WH
    SCHEDULE = 'USING CRON 0 2 * * * UTC'
AS CALL TEMP.JUSDAVIS.SP_REFRESH_BKMNG_ONT_FEATURE_ADOPTION();

ALTER TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_ONT_FEATURE_ADOPTION RESUME;
```

---

## Step 3: Add Adoption Columns to BKMNG_ONT_ACCOUNTS

10 new columns via ALTER TABLE:

```sql
ALTER TABLE TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS ADD COLUMN IF NOT EXISTS
    SIG_PIPELINE         NUMBER(1,0),
    SIG_TRANSFORMS       NUMBER(1,0),
    SIG_BI               NUMBER(1,0),
    SIG_COST             NUMBER(1,0),
    SIG_COLLAB           NUMBER(1,0),
    SIG_OBS              NUMBER(1,0),
    SIG_AIML             NUMBER(1,0),
    SIG_SPCS             NUMBER(1,0),
    ADOPTION_SIGNAL_COUNT NUMBER,
    ADOPTION_PROFILE      VARCHAR,
    NEW_ADOPTION_30D      VARCHAR;
```

Modify `SP_REFRESH_BKMNG_ONT_ACCOUNTS` to LEFT JOIN `T_OD_ACCOUNT_SIGNALS` on `ACCOUNT_ID = SALESFORCE_ACCOUNT_ID` and populate these columns. Then run the SP to fill existing rows.

---

## Step 4: Add new_feature_adoption Signal

Add CTE to `SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS`:

```sql
-- new_feature_adoption signals
new_feature_adoption AS (
    SELECT
        'new_feature_adoption-' || fa.ACCOUNT_ID || '-' || fa.FEATURE_RAW AS SIGNAL_ID,
        fa.ACCOUNT_ID,
        fa.ACCOUNT_NAME,
        'new_feature_adoption'  AS SIGNAL_TYPE,
        'low'                   AS PRIORITY,
        fa.ACCOUNT_NAME || ' started using ' || fa.FEATURE_NAME
            || ' on ' || TO_CHAR(fa.FIRST_USE_DATE, 'Mon DD') AS SIGNAL_TEXT,
        'First use of ' || fa.FEATURE_NAME || '. '
            || 'Account uses ' || COALESCE(acc.ADOPTION_SIGNAL_COUNT::VARCHAR, '?')
            || '/8 platform categories. '
            || CASE WHEN acc.ADOPTION_PROFILE IS NOT NULL
                    THEN 'Active: ' || acc.ADOPTION_PROFILE || '.'
                    ELSE '' END AS CONTEXT,
        'account'               AS ENTITY_TYPE,
        fa.ACCOUNT_ID           AS ENTITY_ID,
        CURRENT_TIMESTAMP()     AS CREATED_AT
    FROM TEMP.JUSDAVIS.BKMNG_ONT_FEATURE_ADOPTION fa
    LEFT JOIN TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS acc ON acc.ACCOUNT_ID = fa.ACCOUNT_ID
    WHERE fa.IS_NEW_30D = TRUE
      AND fa.FEATURE_SOURCE = 'feature'
)
```

Union this into the final INSERT alongside the existing signal CTEs.

---

## Step 5: Update Semantic Model YAML

### New table: `feature_adoption`

```yaml
  - name: feature_adoption
    description: >
      Per-account, per-feature first-use dates tracking Snowflake platform adoption.
      Combines broad platform categories (Pipeline, Transforms, BI, etc.) from T_OD data
      with granular features (Dynamic Tables, Cortex Search, Streamlit, etc.) from usage
      tracking. IS_NEW_30D/IS_NEW_90D flag recently adopted features.
    base_table:
      database: TEMP
      schema: JUSDAVIS
      table: BKMNG_ONT_FEATURE_ADOPTION
    dimensions:
      - name: account_id
        expr: ACCOUNT_ID
        data_type: TEXT
        description: Salesforce account identifier.
      - name: account_name
        expr: ACCOUNT_NAME
        data_type: TEXT
        description: Account name.
      - name: feature_name
        expr: FEATURE_NAME
        data_type: TEXT
        description: Human-readable feature name (e.g. Dynamic Tables, Cortex Search, Pipeline).
      - name: feature_raw
        expr: FEATURE_RAW
        data_type: TEXT
        description: Raw system feature identifier.
      - name: feature_source
        expr: FEATURE_SOURCE
        data_type: TEXT
        description: "Source layer. Values: category (broad T_OD signal), feature (USAGE_TRACKING), service (COMPUTE_SERVICE)."
      - name: is_new_30d
        expr: IS_NEW_30D
        data_type: BOOLEAN
        description: TRUE if this feature was first used within the last 30 days.
      - name: is_new_90d
        expr: IS_NEW_90D
        data_type: BOOLEAN
        description: TRUE if this feature was first used within the last 90 days.
    time_dimensions:
      - name: first_use_date
        expr: FIRST_USE_DATE
        data_type: date
        description: Date the account first used this feature or platform category.
    facts:
      - name: days_since_first_use
        expr: DAYS_SINCE_FIRST_USE
        data_type: NUMBER
        description: Calendar days since first use of this feature.
```

### Additions to `accounts` table

```yaml
      - name: adoption_signal_count
        expr: ADOPTION_SIGNAL_COUNT
        data_type: NUMBER
        description: Number of the 8 broad platform categories this account is actively using (0-8).
      - name: adoption_profile
        expr: ADOPTION_PROFILE
        data_type: TEXT
        description: Comma-separated list of active broad platform categories.
      - name: new_adoption_30d
        expr: NEW_ADOPTION_30D
        data_type: TEXT
        description: Most recently adopted platform category name if first used within 30 days, else NULL.
```

### Update `signal_type` description in `account_signals`

Add `new_feature_adoption` to the values list.

### 4 New verified queries

```yaml
  - name: recent_feature_adoptions
    question: Which accounts recently started using a new Snowflake feature?
    sql: >
      SELECT ACCOUNT_NAME, FEATURE_NAME, FEATURE_SOURCE, FIRST_USE_DATE, DAYS_SINCE_FIRST_USE
      FROM TEMP.JUSDAVIS.BKMNG_ONT_FEATURE_ADOPTION
      WHERE IS_NEW_30D = TRUE
      ORDER BY FIRST_USE_DATE DESC

  - name: account_adoption_profile
    question: What platform categories is a specific account using?
    sql: >
      SELECT ACCOUNT_NAME, ADOPTION_SIGNAL_COUNT, ADOPTION_PROFILE, NEW_ADOPTION_30D
      FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS
      WHERE ACCOUNT_NAME ILIKE '%{account}%'

  - name: accounts_missing_feature
    question: Which accounts have not yet adopted Dynamic Tables?
    sql: >
      SELECT DISTINCT a.ACCOUNT_NAME, a.ADOPTION_SIGNAL_COUNT, a.ADOPTION_PROFILE
      FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
      WHERE a.ACCOUNT_ID NOT IN (
          SELECT ACCOUNT_ID FROM TEMP.JUSDAVIS.BKMNG_ONT_FEATURE_ADOPTION
          WHERE FEATURE_NAME = 'Dynamic Tables'
      )
      ORDER BY a.ADOPTION_SIGNAL_COUNT DESC

  - name: feature_adoption_timeline
    question: When did accounts first adopt each platform feature?
    sql: >
      SELECT FEATURE_NAME, FEATURE_SOURCE,
             COUNT(DISTINCT ACCOUNT_ID) AS accounts_using,
             MIN(FIRST_USE_DATE)        AS earliest_adoption,
             MAX(FIRST_USE_DATE)        AS most_recent_adoption,
             COUNT_IF(IS_NEW_30D)       AS new_in_30d
      FROM TEMP.JUSDAVIS.BKMNG_ONT_FEATURE_ADOPTION
      GROUP BY FEATURE_NAME, FEATURE_SOURCE
      ORDER BY accounts_using DESC
```

---

## Step 6: Add Adoption Context to `get_bookmanager_context()`

After the existing `ACTIVE SIGNALS` block in the `account_id` branch, add:

```python
cur.execute(
    """
    SELECT FEATURE_NAME, FEATURE_SOURCE, FIRST_USE_DATE, IS_NEW_30D
    FROM BKMNG_ONT_FEATURE_ADOPTION
    WHERE ACCOUNT_ID = %s
    ORDER BY FEATURE_SOURCE, FIRST_USE_DATE DESC
    """,
    (account_id,),
)
adoption_rows = cur.fetchall()
if adoption_rows:
    active = [r.get("FEATURE_NAME") for r in adoption_rows]
    new_30d = [r.get("FEATURE_NAME") for r in adoption_rows if r.get("IS_NEW_30D")]
    account_section += f"PLATFORM ADOPTION ({len(active)} features):\n"
    account_section += f"  Active: {', '.join(active[:12])}\n"
    if new_30d:
        account_section += f"  NEW (30d): {', '.join(new_30d)}\n"
```

---

## Step 7: Update `_cortex_complete_text_to_sql()` Schema String

Append to the existing schema string:

```python
"- BKMNG_ONT_FEATURE_ADOPTION: ACCOUNT_ID, ACCOUNT_NAME, FEATURE_NAME, "
"FEATURE_SOURCE(category/feature/service), FIRST_USE_DATE, "
"DAYS_SINCE_FIRST_USE, IS_NEW_30D(BOOLEAN), IS_NEW_90D(BOOLEAN)\n"
"  [BKMNG_ONT_ACCOUNTS also has: ADOPTION_SIGNAL_COUNT, ADOPTION_PROFILE, "
"SIG_PIPELINE, SIG_TRANSFORMS, SIG_BI, SIG_COST, SIG_COLLAB, SIG_OBS, SIG_AIML, SIG_SPCS]\n"
```

---

## Step 8: Upload + Verify

1. `reflect_semantic_model` — validate YAML locally
2. `PUT file:///...bookmanager_assistant.yaml @TEMP.JUSDAVIS.BKMNG_STAGE/ OVERWRITE=TRUE AUTO_COMPRESS=FALSE`
3. ACE chat query: `"Which accounts recently started using Dynamic Tables?"` → should return accounts from step 1 results
4. Verify system prompt for an account includes `PLATFORM ADOPTION:` section

---

## Verification Checklist

- [ ] `BKMNG_ONT_FEATURE_ADOPTION` row count > 1,000, at least 50 distinct accounts
- [ ] `IS_NEW_30D = TRUE` rows ≥ 15 (validated: 11 Dynamic Tables + 4 Cortex Search + others)
- [ ] `BKMNG_ONT_ACCOUNTS.ADOPTION_SIGNAL_COUNT` non-null and varies 1-8
- [ ] `BKMNG_ONT_ACCOUNT_SIGNALS` includes `new_feature_adoption` signal type
- [ ] Semantic model validates via `reflect_semantic_model` (no parse errors)
- [ ] ACE chat adoption query returns structured data
- [ ] Account context prompt includes `PLATFORM ADOPTION:` section for accounts with adoption data
