# BookManager — A360 Integration & Platform Adoption Plan

> Replaces: `platform-adoption-signals-plan.md` (crosswalk approach)
> Fixes: Suspended `BKMNG_CONTRACT_REVENUE` and `BKMNG_CONSUMPTION_TRENDS` tables
> Passable to a snowwork session for independent execution.

---

## Problem Statement

BookManager has three data gaps:

1. **Contract & consumption data is broken**: `BKMNG_CONTRACT_REVENUE` and `BKMNG_CONSUMPTION_TRENDS` tables are empty (0 rows). Their tasks are suspended. `BKMNG_ONT_ACCOUNTS` has NULL for `CONTRACT_UTILIZATION_PCT`, `PREDICTED_OVERAGE_DATE`, `WOW_PCT_CHANGE`, and `MOM_PCT_CHANGE` across all 455 accounts. This means health scores are degraded and capacity alerts don't fire.

2. **Platform adoption has limited coverage**: The current adoption tables (`BKMNG_ADOPTION_SIGNALS`, `BKMNG_ADOPTION_FEATURE_FIRST_USE`) use a crosswalk approach that only covers 109 of 455 accounts (24%). The rest show NULL for all adoption columns.

3. **No feature-level adoption alerts**: ACEs can't see when an account starts using a new Snowflake capability (Cortex Analyst, Dynamic Tables, Notebooks, etc.) — the kind of signal that changes a conversation.

### Solution: A360 Views

The `SALES.RAVEN.A360_*` views solve all three problems. They:
- Join on `SALESFORCE_ACCOUNT_ID` directly — no crosswalk needed
- Have a pre-built product taxonomy (6 categories → 25 use cases → granular features)
- Include contract data, overage predictions, and run-rate revenue
- Cover significantly more BKMNG accounts than the crosswalk approach

### A360 Coverage for BKMNG Accounts (455 total)

| A360 View | BKMNG Accounts | What It Provides |
|-----------|---------------|------------------|
| `A360_BOOKINGS_ACV_VIEW` | 191 (42%) | Contract start/end, ACV, TCV, renewal status, deal type |
| `A360_OVERAGE_UNDERAGE_PREDICTION_VIEW` | 188 (41%) | Predicted overage date, days until overage, predicted $ amount |
| `A360_RUN_RATE_VIEW` | 220 (48%) | Revenue at 30/60/90/180 day windows |
| `A360_CREDIT_USAGE_VIEW` | 218 (48%) | Monthly credit breakdown by 38 service types |
| `A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE` | 183 (40%) | Daily revenue by product category / use case / feature |
| `A360_SUBSCRIPTION_VIEW` | — | Price per credit, edition, region, cloud |

---

## What This Replaces

| Current (broken/limited) | Replaced By | Improvement |
|--------------------------|-------------|-------------|
| `BKMNG_CONTRACT_REVENUE` (0 rows, suspended) | `A360_BOOKINGS_ACV_VIEW` + `A360_OVERAGE_UNDERAGE_PREDICTION_VIEW` | Contract dates, ACV, predicted overage date |
| `BKMNG_CONSUMPTION_TRENDS` (0 rows, suspended) | `A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE` + `A360_RUN_RATE_VIEW` | Daily granularity enables true WoW/MoM trends |
| `BKMNG_ADOPTION_SIGNALS` (109 rows, crosswalk) | `A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE` | 183 accounts, pre-built product taxonomy, revenue-weighted |
| `BKMNG_ADOPTION_FEATURE_FIRST_USE` (1,683 rows, crosswalk) | `A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE` | Feature-level first-use from daily revenue data |

---

## Source Tables

All views are in `SALES.RAVEN` and are read-only. We materialize into `TEMP.JUSDAVIS`.

| View | Key Fields |
|------|------------|
| `A360_BOOKINGS_ACV_VIEW` | SALESFORCE_ACCOUNT_ID, CONTRACT_START_DATE, CONTRACT_END_DATE, NET_ACV, NET_TCV, DEAL_TYPE_WITH_CHURN_DESCRIPTION, CAPACITY_COUNT, YEAR_INDEX |
| `A360_OVERAGE_UNDERAGE_PREDICTION_VIEW` | SALESFORCE_ACCOUNT_ID, CONTRACT_END_DATE, DAY_OF_OVERAGE, DAYS_TILL_OVERAGE, OVERAGE_UNDERAGE_PREDICTION |
| `A360_RUN_RATE_VIEW` | SALESFORCE_ACCOUNT_ID, REV_30, REV_60, REV_90, REV_180, TOTAL_REVENUE |
| `A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE` | SALESFORCE_ACCOUNT_ID, GENERAL_DATE (daily), PRODUCT_CATEGORY, USE_CASE, FEATURE, REVENUE — **primary source for WoW/MoM trends and feature adoption** |

---

## New Table 1: `BKMNG_A360_CONTRACT`

Replaces the broken `BKMNG_CONTRACT_REVENUE`. One row per account with active contract data.

| Field | Type | Source |
|-------|------|--------|
| `ACCOUNT_ID` | VARCHAR | A360_BOOKINGS_ACV_VIEW.SALESFORCE_ACCOUNT_ID |
| `ACCOUNT_NAME` | VARCHAR | BKMNG_ACCOUNTS |
| `CONTRACT_START_DATE` | DATE | A360_BOOKINGS_ACV_VIEW |
| `CONTRACT_END_DATE` | DATE | A360_BOOKINGS_ACV_VIEW |
| `NET_ACV` | NUMBER(38,2) | A360_BOOKINGS_ACV_VIEW |
| `NET_TCV` | NUMBER(38,2) | A360_BOOKINGS_ACV_VIEW |
| `DEAL_TYPE` | VARCHAR | A360_BOOKINGS_ACV_VIEW.DEAL_TYPE_WITH_CHURN_DESCRIPTION |
| `IS_RENEWAL` | BOOLEAN | DEAL_TYPE_WITH_CHURN_DESCRIPTION = 'Renewal' |
| `DAYS_UNTIL_CONTRACT_END` | NUMBER | DATEDIFF(day, CURRENT_DATE(), CONTRACT_END_DATE) |
| `PREDICTED_OVERAGE_DATE` | DATE | A360_OVERAGE_UNDERAGE_PREDICTION_VIEW.DAY_OF_OVERAGE |
| `DAYS_UNTIL_OVERAGE` | NUMBER | A360_OVERAGE_UNDERAGE_PREDICTION_VIEW.DAYS_TILL_OVERAGE |
| `PREDICTED_OVERAGE_AMOUNT` | FLOAT | A360_OVERAGE_UNDERAGE_PREDICTION_VIEW.OVERAGE_UNDERAGE_PREDICTION |
| `REV_30D` | FLOAT | A360_RUN_RATE_VIEW.REV_30 |
| `REV_90D` | FLOAT | A360_RUN_RATE_VIEW.REV_90 |
| `REV_180D` | FLOAT | A360_RUN_RATE_VIEW.REV_180 |
| `REFRESHED_AT` | TIMESTAMP_NTZ | CURRENT_TIMESTAMP() |

### SQL: `SP_REFRESH_BKMNG_A360_CONTRACT`

```sql
CREATE OR REPLACE PROCEDURE TEMP.JUSDAVIS.SP_REFRESH_BKMNG_A360_CONTRACT()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
BEGIN
    CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_A360_CONTRACT AS
    WITH latest_contract AS (
        SELECT *
        FROM SALES.RAVEN.A360_BOOKINGS_ACV_VIEW
        WHERE VALUE_TYPE = 'actual'
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY SALESFORCE_ACCOUNT_ID
            ORDER BY CONTRACT_END_DATE DESC, RN DESC
        ) = 1
    )
    SELECT
        b.ACCOUNT_ID,
        b.ACCOUNT_NAME,
        c.CONTRACT_START_DATE,
        c.CONTRACT_END_DATE,
        c.NET_ACV,
        c.NET_TCV,
        c.DEAL_TYPE_WITH_CHURN_DESCRIPTION AS DEAL_TYPE,
        (c.DEAL_TYPE_WITH_CHURN_DESCRIPTION = 'Renewal') AS IS_RENEWAL,
        DATEDIFF('day', CURRENT_DATE(), c.CONTRACT_END_DATE) AS DAYS_UNTIL_CONTRACT_END,
        o.DAY_OF_OVERAGE AS PREDICTED_OVERAGE_DATE,
        o.DAYS_TILL_OVERAGE AS DAYS_UNTIL_OVERAGE,
        o.OVERAGE_UNDERAGE_PREDICTION AS PREDICTED_OVERAGE_AMOUNT,
        rr.REV_30 AS REV_30D,
        rr.REV_90 AS REV_90D,
        rr.REV_180 AS REV_180D,
        CURRENT_TIMESTAMP()::TIMESTAMP_NTZ AS REFRESHED_AT
    FROM TEMP.JUSDAVIS.BKMNG_ACCOUNTS b
    LEFT JOIN latest_contract c ON c.SALESFORCE_ACCOUNT_ID = b.ACCOUNT_ID
    LEFT JOIN SALES.RAVEN.A360_OVERAGE_UNDERAGE_PREDICTION_VIEW o
        ON o.SALESFORCE_ACCOUNT_ID = b.ACCOUNT_ID
    LEFT JOIN SALES.RAVEN.A360_RUN_RATE_VIEW rr
        ON rr.SALESFORCE_ACCOUNT_ID = b.ACCOUNT_ID;

    RETURN 'BKMNG_A360_CONTRACT refreshed: ' || (SELECT COUNT(*) FROM TEMP.JUSDAVIS.BKMNG_A360_CONTRACT) || ' rows';
END;
```

---

## New Table 2: `BKMNG_A360_CONSUMPTION`

Replaces the broken `BKMNG_CONSUMPTION_TRENDS`. Uses `A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE` (daily granularity) to compute WoW and MoM trends. One row per account — a snapshot of current consumption velocity.

**Why this table instead of `A360_CREDIT_USAGE_VIEW`**: The credit usage view is monthly and has multiple rows per sub-account, making it awkward for WoW. The daily product category revenue view gives true daily granularity, which supports proper week-over-week comparison.

| Field | Type | Source |
|-------|------|--------|
| `ACCOUNT_ID` | VARCHAR | SALESFORCE_ACCOUNT_ID |
| `ACCOUNT_NAME` | VARCHAR | BKMNG_ACCOUNTS |
| `REV_THIS_WEEK` | FLOAT | SUM(REVENUE) last 7 days from A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE |
| `REV_LAST_WEEK` | FLOAT | SUM(REVENUE) days 8-14 ago |
| `WOW_PCT_CHANGE` | FLOAT | (this_week - last_week) / NULLIF(last_week, 0) * 100 |
| `REV_THIS_MONTH` | FLOAT | SUM(REVENUE) last 30 days |
| `REV_LAST_MONTH` | FLOAT | SUM(REVENUE) days 31-60 ago |
| `MOM_PCT_CHANGE` | FLOAT | (this_month - last_month) / NULLIF(last_month, 0) * 100 |
| `REV_90D` | FLOAT | SUM(REVENUE) last 90 days |
| `ACTIVE_DAYS_30D` | NUMBER | COUNT(DISTINCT GENERAL_DATE) with revenue in last 30 days |
| `REFRESHED_AT` | TIMESTAMP_NTZ | CURRENT_TIMESTAMP() |

### SQL: `SP_REFRESH_BKMNG_A360_CONSUMPTION`

```sql
CREATE OR REPLACE PROCEDURE TEMP.JUSDAVIS.SP_REFRESH_BKMNG_A360_CONSUMPTION()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
BEGIN
    CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_A360_CONSUMPTION AS
    WITH daily_rev AS (
        SELECT
            a.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
            a.GENERAL_DATE,
            SUM(a.REVENUE) AS DAILY_REVENUE
        FROM SALES.RAVEN.A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE a
        JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = a.SALESFORCE_ACCOUNT_ID
        WHERE a.GENERAL_DATE >= DATEADD('day', -90, CURRENT_DATE())
        GROUP BY a.SALESFORCE_ACCOUNT_ID, a.GENERAL_DATE
    )
    SELECT
        b.ACCOUNT_ID,
        b.ACCOUNT_NAME,
        -- Week-over-week
        SUM(CASE WHEN d.GENERAL_DATE >= DATEADD('day', -7, CURRENT_DATE()) THEN d.DAILY_REVENUE ELSE 0 END) AS REV_THIS_WEEK,
        SUM(CASE WHEN d.GENERAL_DATE BETWEEN DATEADD('day', -14, CURRENT_DATE()) AND DATEADD('day', -8, CURRENT_DATE()) THEN d.DAILY_REVENUE ELSE 0 END) AS REV_LAST_WEEK,
        ROUND(
            (SUM(CASE WHEN d.GENERAL_DATE >= DATEADD('day', -7, CURRENT_DATE()) THEN d.DAILY_REVENUE ELSE 0 END)
             - SUM(CASE WHEN d.GENERAL_DATE BETWEEN DATEADD('day', -14, CURRENT_DATE()) AND DATEADD('day', -8, CURRENT_DATE()) THEN d.DAILY_REVENUE ELSE 0 END))
            / NULLIF(SUM(CASE WHEN d.GENERAL_DATE BETWEEN DATEADD('day', -14, CURRENT_DATE()) AND DATEADD('day', -8, CURRENT_DATE()) THEN d.DAILY_REVENUE ELSE 0 END), 0)
            * 100, 2
        ) AS WOW_PCT_CHANGE,
        -- Month-over-month
        SUM(CASE WHEN d.GENERAL_DATE >= DATEADD('day', -30, CURRENT_DATE()) THEN d.DAILY_REVENUE ELSE 0 END) AS REV_THIS_MONTH,
        SUM(CASE WHEN d.GENERAL_DATE BETWEEN DATEADD('day', -60, CURRENT_DATE()) AND DATEADD('day', -31, CURRENT_DATE()) THEN d.DAILY_REVENUE ELSE 0 END) AS REV_LAST_MONTH,
        ROUND(
            (SUM(CASE WHEN d.GENERAL_DATE >= DATEADD('day', -30, CURRENT_DATE()) THEN d.DAILY_REVENUE ELSE 0 END)
             - SUM(CASE WHEN d.GENERAL_DATE BETWEEN DATEADD('day', -60, CURRENT_DATE()) AND DATEADD('day', -31, CURRENT_DATE()) THEN d.DAILY_REVENUE ELSE 0 END))
            / NULLIF(SUM(CASE WHEN d.GENERAL_DATE BETWEEN DATEADD('day', -60, CURRENT_DATE()) AND DATEADD('day', -31, CURRENT_DATE()) THEN d.DAILY_REVENUE ELSE 0 END), 0)
            * 100, 2
        ) AS MOM_PCT_CHANGE,
        -- 90-day total
        SUM(d.DAILY_REVENUE) AS REV_90D,
        -- Activity indicator
        COUNT(DISTINCT CASE WHEN d.GENERAL_DATE >= DATEADD('day', -30, CURRENT_DATE()) THEN d.GENERAL_DATE END) AS ACTIVE_DAYS_30D,
        CURRENT_TIMESTAMP()::TIMESTAMP_NTZ AS REFRESHED_AT
    FROM TEMP.JUSDAVIS.BKMNG_ACCOUNTS b
    LEFT JOIN daily_rev d ON d.ACCOUNT_ID = b.ACCOUNT_ID
    GROUP BY b.ACCOUNT_ID, b.ACCOUNT_NAME;

    RETURN 'BKMNG_A360_CONSUMPTION refreshed: ' || (SELECT COUNT(*) FROM TEMP.JUSDAVIS.BKMNG_A360_CONSUMPTION) || ' rows';
END;
```

---

## New Table 3: `BKMNG_A360_PRODUCT_ADOPTION`

Replaces both `BKMNG_ADOPTION_SIGNALS` and `BKMNG_ADOPTION_FEATURE_FIRST_USE`. Tracks product category and feature-level adoption from daily revenue data.

| Field | Type | Source |
|-------|------|--------|
| `ACCOUNT_ID` | VARCHAR | SALESFORCE_ACCOUNT_ID |
| `ACCOUNT_NAME` | VARCHAR | BKMNG_ACCOUNTS |
| `PRODUCT_CATEGORY` | VARCHAR | A360 PRODUCT_CATEGORY (AI/ML, Analytics, Applications & Collaboration, Data Engineering, Platform, Transactions) |
| `USE_CASE` | VARCHAR | A360 USE_CASE (e.g., "SI and Agents", "Transformation", "Business Intelligence") |
| `FEATURE` | VARCHAR | A360 FEATURE (e.g., "Cortex Analyst (via Agents)", "Dynamic Tables", "Streamlit") |
| `FIRST_USE_DATE` | DATE | MIN(GENERAL_DATE) for this account + feature |
| `LAST_USE_DATE` | DATE | MAX(GENERAL_DATE) for this account + feature |
| `TOTAL_REVENUE_90D` | FLOAT | SUM(REVENUE) in last 90 days |
| `DAYS_SINCE_FIRST_USE` | NUMBER | DATEDIFF(day, FIRST_USE_DATE, CURRENT_DATE()) |
| `IS_NEW_30D` | BOOLEAN | FIRST_USE_DATE >= DATEADD('day', -30, CURRENT_DATE()) |
| `IS_ACTIVE_30D` | BOOLEAN | LAST_USE_DATE >= DATEADD('day', -30, CURRENT_DATE()) |
| `REFRESHED_AT` | TIMESTAMP_NTZ | CURRENT_TIMESTAMP() |

### SQL: `SP_REFRESH_BKMNG_A360_PRODUCT_ADOPTION`

```sql
CREATE OR REPLACE PROCEDURE TEMP.JUSDAVIS.SP_REFRESH_BKMNG_A360_PRODUCT_ADOPTION()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
BEGIN
    CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_A360_PRODUCT_ADOPTION AS
    SELECT
        b.ACCOUNT_ID,
        b.ACCOUNT_NAME,
        a.PRODUCT_CATEGORY,
        a.USE_CASE,
        a.FEATURE,
        MIN(a.GENERAL_DATE) AS FIRST_USE_DATE,
        MAX(a.GENERAL_DATE) AS LAST_USE_DATE,
        SUM(CASE WHEN a.GENERAL_DATE >= DATEADD('day', -90, CURRENT_DATE()) THEN a.REVENUE ELSE 0 END) AS TOTAL_REVENUE_90D,
        DATEDIFF('day', MIN(a.GENERAL_DATE), CURRENT_DATE()) AS DAYS_SINCE_FIRST_USE,
        (MIN(a.GENERAL_DATE) >= DATEADD('day', -30, CURRENT_DATE())) AS IS_NEW_30D,
        (MAX(a.GENERAL_DATE) >= DATEADD('day', -30, CURRENT_DATE())) AS IS_ACTIVE_30D,
        CURRENT_TIMESTAMP()::TIMESTAMP_NTZ AS REFRESHED_AT
    FROM SALES.RAVEN.A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE a
    JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = a.SALESFORCE_ACCOUNT_ID
    GROUP BY b.ACCOUNT_ID, b.ACCOUNT_NAME, a.PRODUCT_CATEGORY, a.USE_CASE, a.FEATURE;

    RETURN 'BKMNG_A360_PRODUCT_ADOPTION refreshed: ' || (SELECT COUNT(*) FROM TEMP.JUSDAVIS.BKMNG_A360_PRODUCT_ADOPTION) || ' rows';
END;
```

---

## Changes to Existing Tables

### `BKMNG_ONT_ACCOUNTS` — Replace broken columns with A360 data

Update `SP_REFRESH_BKMNG_ONT_ACCOUNTS` to LEFT JOIN the new A360 tables instead of the broken/empty contract/consumption tables and the limited crosswalk-based adoption tables.

**Columns to fix (currently all NULL):**

| Column | Current Source (broken) | New Source |
|--------|------------------------|-----------|
| `CONTRACT_UTILIZATION_PCT` | BKMNG_CONTRACT_REVENUE (empty) | `BKMNG_A360_CONTRACT`: REV_90D / NULLIF(NET_ACV, 0) * 4 * 100 (annualized run-rate vs ACV) |
| `TOTAL_CONSUMED_CREDITS` | BKMNG_CONTRACT_REVENUE (empty) | `BKMNG_A360_CONTRACT`: REV_180D (or sum from consumption) |
| `CONTRACT_CAPACITY` | BKMNG_CONTRACT_REVENUE (empty) | `BKMNG_A360_CONTRACT`: NET_TCV |
| `CAPACITY_REMAINING` | BKMNG_CONTRACT_REVENUE (empty) | NET_TCV - total consumed estimate |
| `PREDICTED_OVERAGE_DATE` | BKMNG_CONTRACT_REVENUE (empty) | `BKMNG_A360_CONTRACT`: PREDICTED_OVERAGE_DATE |
| `WOW_PCT_CHANGE` | BKMNG_CONSUMPTION_TRENDS (empty) | `BKMNG_A360_CONSUMPTION`: WOW_PCT_CHANGE (daily revenue aggregated into 7-day windows) |
| `MOM_PCT_CHANGE` | BKMNG_CONSUMPTION_TRENDS (empty) | `BKMNG_A360_CONSUMPTION`: MOM_PCT_CHANGE (daily revenue aggregated into 30-day windows) |

**Adoption columns to update source (currently from crosswalk approach, 109 accounts):**

| Column | Current Source | New Source |
|--------|---------------|-----------|
| `SIG_PIPELINE` through `SIG_SPCS` | BKMNG_ADOPTION_SIGNALS (crosswalk, 109 accts) | Derived from `BKMNG_A360_PRODUCT_ADOPTION` category flags |
| `ADOPTION_SIGNAL_COUNT` | Computed from above | Sum of category flags |
| `ADOPTION_PROFILE` | Computed from above | Comma-separated active A360 categories |
| `MISSING_CATEGORIES` | Computed from above | Comma-separated missing A360 categories |
| `NEW_ADOPTION_30D` | BKMNG_ADOPTION_FEATURE_FIRST_USE | Features where IS_NEW_30D = TRUE |

**A360 → Adoption Signal Mapping:**

The A360 product categories map to the existing 8 signal columns:

| A360 PRODUCT_CATEGORY | Signal Column(s) |
|----------------------|------------------|
| Data Engineering | `SIG_PIPELINE` (where USE_CASE = 'Ingestion'), `SIG_TRANSFORMS` (where USE_CASE = 'Transformation') |
| Analytics | `SIG_BI` |
| Platform | `SIG_COST` (where USE_CASE = 'Cost Governance'), `SIG_OBS` (where USE_CASE = 'Observability') |
| Applications & Collaboration | `SIG_COLLAB` |
| AI/ML | `SIG_AIML` |
| Transactions | `SIG_SPCS` (closest mapping — includes Unistore, Postgres) |

Derivation SQL for the adoption flags in the ONT_ACCOUNTS refresh:

```sql
LEFT JOIN (
    SELECT
        ACCOUNT_ID,
        MAX(CASE WHEN PRODUCT_CATEGORY = 'Data Engineering' AND USE_CASE = 'Ingestion' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_PIPELINE,
        MAX(CASE WHEN PRODUCT_CATEGORY = 'Data Engineering' AND USE_CASE = 'Transformation' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_TRANSFORMS,
        MAX(CASE WHEN PRODUCT_CATEGORY = 'Analytics' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_BI,
        MAX(CASE WHEN PRODUCT_CATEGORY = 'Platform' AND USE_CASE = 'Cost Governance' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_COST,
        MAX(CASE WHEN PRODUCT_CATEGORY = 'Applications & Collaboration' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_COLLAB,
        MAX(CASE WHEN PRODUCT_CATEGORY = 'Platform' AND USE_CASE = 'Observability' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_OBS,
        MAX(CASE WHEN PRODUCT_CATEGORY = 'AI/ML' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_AIML,
        MAX(CASE WHEN PRODUCT_CATEGORY = 'Transactions' AND IS_ACTIVE_30D THEN 1 ELSE 0 END) AS SIG_SPCS
    FROM TEMP.JUSDAVIS.BKMNG_A360_PRODUCT_ADOPTION
    GROUP BY ACCOUNT_ID
) adopt ON adopt.ACCOUNT_ID = b.ACCOUNT_ID
```

### `BKMNG_ONT_ACCOUNT_SIGNALS` — Update `new_feature_adoption` signal

The existing `new_feature_adoption` signal (113 rows) should be sourced from `BKMNG_A360_PRODUCT_ADOPTION` instead of `BKMNG_ADOPTION_FEATURE_FIRST_USE`:

```sql
-- In SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS, replace the new_feature_adoption CTE:
new_feature_signals AS (
    SELECT
        pa.ACCOUNT_ID,
        'new_feature_adoption' AS SIGNAL_TYPE,
        'low' AS PRIORITY,
        pa.ACCOUNT_NAME || ' started using ' || pa.FEATURE
            || ' (category: ' || pa.PRODUCT_CATEGORY || ')'
            || ' — first seen ' || pa.FIRST_USE_DATE::VARCHAR AS SIGNAL_TEXT,
        'Feature: ' || pa.FEATURE || ' | Use Case: ' || pa.USE_CASE
            || ' | Category: ' || pa.PRODUCT_CATEGORY
            || ' | Revenue (90d): $' || ROUND(pa.TOTAL_REVENUE_90D, 2)::VARCHAR AS CONTEXT,
        'account' AS ENTITY_TYPE,
        pa.ACCOUNT_ID AS ENTITY_ID
    FROM TEMP.JUSDAVIS.BKMNG_A360_PRODUCT_ADOPTION pa
    WHERE pa.IS_NEW_30D = TRUE
)
```

Also add these new signal types:

```sql
-- capacity_warning: overage predicted
capacity_warning AS (
    SELECT
        c.ACCOUNT_ID,
        'capacity_warning' AS SIGNAL_TYPE,
        'high' AS PRIORITY,
        c.ACCOUNT_NAME || ' is predicted to hit overage on '
            || c.PREDICTED_OVERAGE_DATE::VARCHAR
            || ' (' || c.DAYS_UNTIL_OVERAGE || ' days)' AS SIGNAL_TEXT,
        'Predicted overage: $' || ROUND(c.PREDICTED_OVERAGE_AMOUNT, 0)::VARCHAR
            || ' | Contract ends: ' || c.CONTRACT_END_DATE::VARCHAR
            || ' | ACV: $' || c.NET_ACV::VARCHAR AS CONTEXT,
        'account' AS ENTITY_TYPE,
        c.ACCOUNT_ID AS ENTITY_ID
    FROM TEMP.JUSDAVIS.BKMNG_A360_CONTRACT c
    WHERE c.PREDICTED_OVERAGE_DATE IS NOT NULL
      AND c.DAYS_UNTIL_OVERAGE <= 90
),

-- contract_ending: contract ending soon
contract_ending AS (
    SELECT
        c.ACCOUNT_ID,
        'contract_ending' AS SIGNAL_TYPE,
        CASE WHEN c.DAYS_UNTIL_CONTRACT_END <= 60 THEN 'high' ELSE 'medium' END AS PRIORITY,
        c.ACCOUNT_NAME || ' contract ends '
            || c.CONTRACT_END_DATE::VARCHAR
            || ' (' || c.DAYS_UNTIL_CONTRACT_END || ' days)' AS SIGNAL_TEXT,
        'ACV: $' || c.NET_ACV::VARCHAR
            || ' | Deal type: ' || c.DEAL_TYPE
            || ' | 90d revenue: $' || ROUND(c.REV_90D, 0)::VARCHAR AS CONTEXT,
        'account' AS ENTITY_TYPE,
        c.ACCOUNT_ID AS ENTITY_ID
    FROM TEMP.JUSDAVIS.BKMNG_A360_CONTRACT c
    WHERE c.DAYS_UNTIL_CONTRACT_END <= 120
      AND c.DAYS_UNTIL_CONTRACT_END > 0
)
```

Also update `consumption_spike` and `consumption_dip` signals (currently not firing because WoW data is NULL) to source from `BKMNG_A360_CONSUMPTION`:

```sql
-- consumption_spike: WoW revenue increase >= 30%
consumption_spike AS (
    SELECT
        cn.ACCOUNT_ID,
        'consumption_spike' AS SIGNAL_TYPE,
        'high' AS PRIORITY,
        b.ACCOUNT_NAME || ' revenue up ' || ROUND(cn.WOW_PCT_CHANGE, 0)::VARCHAR || '% WoW'
            || ' ($' || ROUND(cn.REV_THIS_WEEK, 0)::VARCHAR || ' this week vs $'
            || ROUND(cn.REV_LAST_WEEK, 0)::VARCHAR || ' last week)' AS SIGNAL_TEXT,
        'MoM: ' || COALESCE(ROUND(cn.MOM_PCT_CHANGE, 0)::VARCHAR, 'N/A') || '%'
            || ' | 90d rev: $' || ROUND(cn.REV_90D, 0)::VARCHAR AS CONTEXT,
        'account' AS ENTITY_TYPE,
        cn.ACCOUNT_ID AS ENTITY_ID
    FROM TEMP.JUSDAVIS.BKMNG_A360_CONSUMPTION cn
    JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = cn.ACCOUNT_ID
    WHERE cn.WOW_PCT_CHANGE >= 30
      AND cn.REV_LAST_WEEK > 0
),

-- consumption_dip: WoW revenue decrease >= 20%
consumption_dip AS (
    SELECT
        cn.ACCOUNT_ID,
        'consumption_dip' AS SIGNAL_TYPE,
        'medium' AS PRIORITY,
        b.ACCOUNT_NAME || ' revenue down ' || ROUND(ABS(cn.WOW_PCT_CHANGE), 0)::VARCHAR || '% WoW'
            || ' ($' || ROUND(cn.REV_THIS_WEEK, 0)::VARCHAR || ' this week vs $'
            || ROUND(cn.REV_LAST_WEEK, 0)::VARCHAR || ' last week)' AS SIGNAL_TEXT,
        'MoM: ' || COALESCE(ROUND(cn.MOM_PCT_CHANGE, 0)::VARCHAR, 'N/A') || '%'
            || ' | 90d rev: $' || ROUND(cn.REV_90D, 0)::VARCHAR AS CONTEXT,
        'account' AS ENTITY_TYPE,
        cn.ACCOUNT_ID AS ENTITY_ID
    FROM TEMP.JUSDAVIS.BKMNG_A360_CONSUMPTION cn
    JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = cn.ACCOUNT_ID
    WHERE cn.WOW_PCT_CHANGE <= -20
      AND cn.REV_LAST_WEEK > 0
)
```

---

## Semantic Model Updates (`bookmanager_assistant.yaml`)

### Add `a360_contract` table

```yaml
  - name: a360_contract
    description: >
      Account contract data from A360. One row per account with active contract
      details, overage predictions, and run-rate revenue windows.
    base_table:
      database: TEMP
      schema: JUSDAVIS
      table: BKMNG_A360_CONTRACT
    dimensions:
      - name: account_id
        expr: ACCOUNT_ID
        data_type: TEXT
        description: Salesforce account identifier.
      - name: account_name
        expr: ACCOUNT_NAME
        data_type: TEXT
        description: Account name.
      - name: deal_type
        expr: DEAL_TYPE
        data_type: TEXT
        description: Contract deal type (New Business, Renewal, etc.).
      - name: is_renewal
        expr: IS_RENEWAL
        data_type: BOOLEAN
        description: True if the active contract is a renewal.
    time_dimensions:
      - name: contract_start_date
        expr: CONTRACT_START_DATE
        data_type: DATE
        description: Start date of active contract.
      - name: contract_end_date
        expr: CONTRACT_END_DATE
        data_type: DATE
        description: End date of active contract.
      - name: predicted_overage_date
        expr: PREDICTED_OVERAGE_DATE
        data_type: DATE
        description: Predicted date the account will exceed contract capacity.
    facts:
      - name: net_acv
        expr: NET_ACV
        data_type: NUMBER
        description: Annual contract value in USD.
      - name: net_tcv
        expr: NET_TCV
        data_type: NUMBER
        description: Total contract value in USD.
      - name: days_until_contract_end
        expr: DAYS_UNTIL_CONTRACT_END
        data_type: NUMBER
        description: Days remaining on current contract.
      - name: days_until_overage
        expr: DAYS_UNTIL_OVERAGE
        data_type: NUMBER
        description: Predicted days until contract overage (null if no overage predicted).
      - name: predicted_overage_amount
        expr: PREDICTED_OVERAGE_AMOUNT
        data_type: NUMBER
        description: Predicted overage amount in USD.
      - name: rev_30d
        expr: REV_30D
        data_type: NUMBER
        description: Revenue in the last 30 days.
      - name: rev_90d
        expr: REV_90D
        data_type: NUMBER
        description: Revenue in the last 90 days.
      - name: rev_180d
        expr: REV_180D
        data_type: NUMBER
        description: Revenue in the last 180 days.
```

### Add `consumption` table

```yaml
  - name: consumption
    description: >
      Per-account consumption velocity snapshot from A360 daily revenue data.
      One row per account with week-over-week and month-over-month revenue
      trends computed from daily product category revenue.
    base_table:
      database: TEMP
      schema: JUSDAVIS
      table: BKMNG_A360_CONSUMPTION
    dimensions:
      - name: account_id
        expr: ACCOUNT_ID
        data_type: TEXT
        description: Salesforce account identifier.
      - name: account_name
        expr: ACCOUNT_NAME
        data_type: TEXT
        description: Account name.
    facts:
      - name: rev_this_week
        expr: REV_THIS_WEEK
        data_type: NUMBER
        description: Total revenue in the last 7 days.
      - name: rev_last_week
        expr: REV_LAST_WEEK
        data_type: NUMBER
        description: Total revenue 8-14 days ago.
      - name: wow_pct_change
        expr: WOW_PCT_CHANGE
        data_type: NUMBER
        description: Week-over-week revenue change as a percentage.
      - name: rev_this_month
        expr: REV_THIS_MONTH
        data_type: NUMBER
        description: Total revenue in the last 30 days.
      - name: rev_last_month
        expr: REV_LAST_MONTH
        data_type: NUMBER
        description: Total revenue 31-60 days ago.
      - name: mom_pct_change
        expr: MOM_PCT_CHANGE
        data_type: NUMBER
        description: Month-over-month revenue change as a percentage.
      - name: rev_90d
        expr: REV_90D
        data_type: NUMBER
        description: Total revenue in the last 90 days.
      - name: active_days_30d
        expr: ACTIVE_DAYS_30D
        data_type: NUMBER
        description: Number of days with revenue activity in the last 30 days.
```

### Add `product_adoption` table

```yaml
  - name: product_adoption
    description: >
      Per-account, per-feature adoption data from A360. Shows what Snowflake
      capabilities each account uses, when they first used them, and whether
      the adoption is new (last 30 days). Features are organized into product
      categories (AI/ML, Analytics, Applications & Collaboration, Data Engineering,
      Platform, Transactions) and use cases.
    base_table:
      database: TEMP
      schema: JUSDAVIS
      table: BKMNG_A360_PRODUCT_ADOPTION
    dimensions:
      - name: account_id
        expr: ACCOUNT_ID
        data_type: TEXT
        description: Salesforce account identifier.
      - name: account_name
        expr: ACCOUNT_NAME
        data_type: TEXT
        description: Account name.
      - name: product_category
        expr: PRODUCT_CATEGORY
        data_type: TEXT
        description: >
          Top-level product category. Values: AI/ML, Analytics,
          Applications & Collaboration, Data Engineering, Platform, Transactions.
      - name: use_case
        expr: USE_CASE
        data_type: TEXT
        description: >
          Product use case within category (e.g., SI and Agents, Transformation,
          Business Intelligence, Marketplace).
      - name: feature
        expr: FEATURE
        data_type: TEXT
        description: >
          Specific feature name (e.g., Cortex Analyst (via Agents), Dynamic Tables,
          Streamlit, Snowpipe).
      - name: is_new_30d
        expr: IS_NEW_30D
        data_type: BOOLEAN
        description: True if the account first used this feature within the last 30 days.
      - name: is_active_30d
        expr: IS_ACTIVE_30D
        data_type: BOOLEAN
        description: True if the account used this feature within the last 30 days.
    time_dimensions:
      - name: first_use_date
        expr: FIRST_USE_DATE
        data_type: DATE
        description: Date the account first used this feature.
      - name: last_use_date
        expr: LAST_USE_DATE
        data_type: DATE
        description: Most recent date the account used this feature.
    facts:
      - name: total_revenue_90d
        expr: TOTAL_REVENUE_90D
        data_type: NUMBER
        description: Total revenue from this feature in the last 90 days.
      - name: days_since_first_use
        expr: DAYS_SINCE_FIRST_USE
        data_type: NUMBER
        description: Days since the account first used this feature.
```

### Add verified queries

```yaml
  - name: account_platform_usage
    question: What platform features does this account use?
    sql: >
      SELECT PRODUCT_CATEGORY, USE_CASE, FEATURE, TOTAL_REVENUE_90D,
             FIRST_USE_DATE, IS_NEW_30D, IS_ACTIVE_30D
      FROM TEMP.JUSDAVIS.BKMNG_A360_PRODUCT_ADOPTION
      WHERE IS_ACTIVE_30D = TRUE
      ORDER BY TOTAL_REVENUE_90D DESC

  - name: new_feature_adoptions
    question: Which accounts recently started using a new feature?
    sql: >
      SELECT ACCOUNT_NAME, FEATURE, PRODUCT_CATEGORY, USE_CASE,
             FIRST_USE_DATE, TOTAL_REVENUE_90D
      FROM TEMP.JUSDAVIS.BKMNG_A360_PRODUCT_ADOPTION
      WHERE IS_NEW_30D = TRUE
      ORDER BY FIRST_USE_DATE DESC

  - name: ai_ml_adoption
    question: Which accounts are using AI/ML features?
    sql: >
      SELECT ACCOUNT_NAME, FEATURE, USE_CASE, TOTAL_REVENUE_90D,
             FIRST_USE_DATE, IS_NEW_30D
      FROM TEMP.JUSDAVIS.BKMNG_A360_PRODUCT_ADOPTION
      WHERE PRODUCT_CATEGORY = 'AI/ML' AND IS_ACTIVE_30D = TRUE
      ORDER BY TOTAL_REVENUE_90D DESC

  - name: contract_status
    question: What is the contract status for this account?
    sql: >
      SELECT ACCOUNT_NAME, CONTRACT_START_DATE, CONTRACT_END_DATE,
             DAYS_UNTIL_CONTRACT_END, NET_ACV, DEAL_TYPE,
             PREDICTED_OVERAGE_DATE, DAYS_UNTIL_OVERAGE,
             PREDICTED_OVERAGE_AMOUNT, REV_30D, REV_90D
      FROM TEMP.JUSDAVIS.BKMNG_A360_CONTRACT
      ORDER BY DAYS_UNTIL_CONTRACT_END ASC

  - name: contracts_ending_soon
    question: Which contracts are ending soon?
    sql: >
      SELECT ACCOUNT_NAME, CONTRACT_END_DATE, DAYS_UNTIL_CONTRACT_END,
             NET_ACV, DEAL_TYPE, PREDICTED_OVERAGE_AMOUNT
      FROM TEMP.JUSDAVIS.BKMNG_A360_CONTRACT
      WHERE DAYS_UNTIL_CONTRACT_END BETWEEN 0 AND 120
      ORDER BY DAYS_UNTIL_CONTRACT_END ASC

  - name: accounts_not_using_feature
    question: Which accounts haven't adopted AI/ML yet?
    sql: >
      SELECT a.ACCOUNT_NAME, a.ACV, a.CONSUMPTION_YTD
      FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
      WHERE a.ACCOUNT_ID NOT IN (
          SELECT ACCOUNT_ID FROM TEMP.JUSDAVIS.BKMNG_A360_PRODUCT_ADOPTION
          WHERE PRODUCT_CATEGORY = 'AI/ML' AND IS_ACTIVE_30D = TRUE
      )
      AND a.CONSUMPTION_YTD > 0
      ORDER BY a.CONSUMPTION_YTD DESC

  - name: consumption_trending
    question: Which accounts have the biggest consumption changes this week?
    sql: >
      SELECT ACCOUNT_NAME, WOW_PCT_CHANGE, REV_THIS_WEEK, REV_LAST_WEEK,
             MOM_PCT_CHANGE, REV_90D, ACTIVE_DAYS_30D
      FROM TEMP.JUSDAVIS.BKMNG_A360_CONSUMPTION
      WHERE WOW_PCT_CHANGE IS NOT NULL AND REV_LAST_WEEK > 0
      ORDER BY ABS(WOW_PCT_CHANGE) DESC
      LIMIT 20

  - name: consumption_spikes
    question: Which accounts are spiking in consumption?
    sql: >
      SELECT ACCOUNT_NAME, WOW_PCT_CHANGE, REV_THIS_WEEK, REV_LAST_WEEK,
             MOM_PCT_CHANGE, REV_90D
      FROM TEMP.JUSDAVIS.BKMNG_A360_CONSUMPTION
      WHERE WOW_PCT_CHANGE >= 30 AND REV_LAST_WEEK > 0
      ORDER BY WOW_PCT_CHANGE DESC
```

---

## Agent Context Updates

### In `get_bookmanager_context()` — add to system prompt

**Portfolio-level** (always shown):
```
CONTRACT HEALTH:
  Contracts ending in 120d: {n}
  Predicted overages: {n}
  Total ACV: ${total_acv}
```

**Account-level** (when account_id is set):
```
CONTRACT:
  ACV: ${net_acv} | Contract: {start} → {end} ({days_remaining}d remaining)
  Revenue: $X (30d) | $Y (90d) | $Z (180d)
  {if overage: "PREDICTED OVERAGE: {date} ({days}d) — est. ${amount}"}

PLATFORM USAGE ({n} active features):
  AI/ML: {features} — ${revenue}
  Data Engineering: {features} — ${revenue}
  ...
  NEW (30d): {feature1} (first used {date}), {feature2}, ...
```

---

## Implementation Steps

### Step 1: Create A360 tables
1. Run `SP_REFRESH_BKMNG_A360_CONTRACT` — expect ~455 rows (one per account, NULL contract data for those not in A360)
2. Run `SP_REFRESH_BKMNG_A360_CONSUMPTION` — expect 455 rows (one per account snapshot with WoW/MoM; ~183 will have non-null trends)
3. Run `SP_REFRESH_BKMNG_A360_PRODUCT_ADOPTION` — expect ~5,000+ rows (features × ~183 accounts)

### Step 2: Update ONT_ACCOUNTS SP
1. Update `SP_REFRESH_BKMNG_ONT_ACCOUNTS` to LEFT JOIN `BKMNG_A360_CONTRACT` for contract columns and `BKMNG_A360_CONSUMPTION` for WOW_PCT_CHANGE / MOM_PCT_CHANGE
2. Update adoption columns to derive from `BKMNG_A360_PRODUCT_ADOPTION` instead of `BKMNG_ADOPTION_SIGNALS`
3. Re-run and verify — contract columns should now be populated for ~191 accounts, adoption for ~183

### Step 3: Update ONT_ACCOUNT_SIGNALS SP
1. Update `new_feature_adoption` CTE to source from `BKMNG_A360_PRODUCT_ADOPTION`
2. Add `capacity_warning` and `contract_ending` signal CTEs using `BKMNG_A360_CONTRACT`
3. Update `consumption_spike` and `consumption_dip` CTEs to source from `BKMNG_A360_CONSUMPTION` WoW data
4. Re-run and verify new signal types appear

### Step 4: Update semantic model
1. Add `a360_contract`, `consumption`, and `product_adoption` table definitions to `bookmanager_assistant.yaml`
2. Add 8 verified queries
3. Upload: `PUT file://...bookmanager_assistant.yaml @TEMP.JUSDAVIS.BKMNG_STAGE/ AUTO_COMPRESS=FALSE OVERWRITE=TRUE`

### Step 5: Update agent context
1. In `snowflake_service.py` `get_bookmanager_context()`:
   - Query `BKMNG_A360_CONTRACT` for contract health summary
   - Query `BKMNG_A360_CONSUMPTION` for portfolio-level WoW/MoM summary (e.g., "X accounts spiking, Y accounts declining")
   - When account_id set: include contract details, WoW/MoM trends, and product adoption breakdown
2. Add CONTRACT, CONSUMPTION, and PLATFORM USAGE sections to system prompt template

### Step 6: Create refresh tasks
1. `TASK_REFRESH_BKMNG_A360_CONTRACT` — daily, CRON `0 4 * * *` UTC
2. `TASK_REFRESH_BKMNG_A360_CONSUMPTION` — daily, CRON `15 4 * * *` UTC
3. `TASK_REFRESH_BKMNG_A360_PRODUCT_ADOPTION` — daily, CRON `30 4 * * *` UTC

### Step 7: Cleanup
1. Suspend/drop old tasks: `TASK_REFRESH_BKMNG_CONTRACT_REVENUE`, `TASK_REFRESH_BKMNG_CONSUMPTION_TRENDS`, `TASK_REFRESH_BKMNG_ADOPTION_SIGNALS`, `TASK_REFRESH_BKMNG_ADOPTION_FEATURE_FIRST_USE`
2. Drop old SPs: `SP_REFRESH_BKMNG_CONTRACT_REVENUE`, `SP_REFRESH_BKMNG_CONSUMPTION_TRENDS`, `SP_REFRESH_BKMNG_ADOPTION_SIGNALS`, `SP_REFRESH_BKMNG_ADOPTION_FEATURE_FIRST_USE`
3. Drop old tables (after validation): `BKMNG_CONTRACT_REVENUE`, `BKMNG_CONSUMPTION_TRENDS`, `BKMNG_ADOPTION_SIGNALS`, `BKMNG_ADOPTION_FEATURE_FIRST_USE`

### Step 8: Verify
1. Check `BKMNG_ONT_ACCOUNTS` — `CONTRACT_UTILIZATION_PCT`, `PREDICTED_OVERAGE_DATE`, `WOW_PCT_CHANGE` should no longer be all NULL
2. Check adoption coverage improved from 109 to ~183 accounts
3. Verify `new_feature_adoption`, `capacity_warning`, `contract_ending` signals fire correctly
4. Test semantic model queries: "What platform features does Lawson Products use?" should return Cortex Analyst, Marketplace, etc.
5. Check agent system prompt includes contract and adoption data when viewing an account

---

## Refresh Schedule

| Table | Frequency | CRON (UTC) | Depends On |
|-------|-----------|------------|------------|
| `BKMNG_A360_CONTRACT` | Daily | `0 4 * * *` | BKMNG_ACCOUNTS |
| `BKMNG_A360_CONSUMPTION` | Daily | `15 4 * * *` | BKMNG_ACCOUNTS |
| `BKMNG_A360_PRODUCT_ADOPTION` | Daily | `30 4 * * *` | BKMNG_ACCOUNTS |
| `BKMNG_ONT_ACCOUNTS` (updated) | 4h | `25 */4 * * *` | A360 tables, existing deps |
| `BKMNG_ONT_ACCOUNT_SIGNALS` (updated) | 1h | `0 * * * *` | All ONT + A360 tables |

Daily is sufficient for the A360 source tables because:
- A360 views are refreshed daily by the central data team
- Contract data changes infrequently
- Feature first-use dates are immutable once set
- Revenue data is daily granularity

---

## Data Notes

- **~55-60% of BKMNG accounts will still have NULL contract/adoption data**: Not all 455 accounts appear in A360. This is expected — some accounts may be too new, have unusual subscription structures, or not yet have usage data.
- **A360 PRODUCT_CATEGORY differs from the old 8-category system**: A360 uses 6 categories (AI/ML, Analytics, Applications & Collaboration, Data Engineering, Platform, Transactions) vs the T_OD 8 (Pipeline, Transforms, BI, Cost Gov, Collab, Observability, AI/ML, SPCS). The mapping above bridges them, but the SIG_* columns are now approximations. Consider switching to the A360 6-category system in the long term.
- **Revenue ≠ credits**: A360 revenue figures are in USD, not raw credits. This is actually better for business context but may differ from what `CONSUMPTION_YTD` on BKMNG_ACCOUNTS shows.
- **The A360 views are read-only and maintained by the central RAVEN team**: If they change schemas or stop refreshing, our materialized tables will go stale. The daily refresh will surface this as empty results.
