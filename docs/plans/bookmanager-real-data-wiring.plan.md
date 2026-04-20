# Plan: BookManager Real Data Wiring (Phase 1 — Accounts + Use Cases)

## Source Mapping Summary

### BKMNG_ACCOUNTS
| Target Column | Source Table | Source Column | Join/Notes |
|---|---|---|---|
| `ACCOUNT_ID` | `FIVETRAN.SALESFORCE.ACCOUNT` | `ID` | PK |
| `ACCOUNT_NAME` | `FIVETRAN.SALESFORCE.ACCOUNT` | `NAME` | |
| `REGION` | `FIVETRAN.SALESFORCE.ACCOUNT` | `REGION_C` | |
| `ACV` | `FIVETRAN.SALESFORCE.ACCOUNT` | `ACCOUNT_BASE_RENEWAL_ACV_C` | |
| `CONSUMPTION_YTD` | `FIVETRAN.SALESFORCE.ACCOUNT` | `ACTUAL_CONSUMPTION_YTD_C` | |
| `ACE_USER_ID` | `FIVETRAN.SALESFORCE.ACCOUNT_TEAM_MEMBER` | `USER_ID` | WHERE TEAM_MEMBER_ROLE='SE - Activation' AND IS_DELETED=FALSE |
| `ACE_ASSIGNED` | `FIVETRAN.SALESFORCE.USER` | `EMAIL` | JOIN on USER_ID = USER.ID |

**⚠️ Gaps (fields app model expects but not in Salesforce source):**
- `INDUSTRY` — check `FIVETRAN.SALESFORCE.ACCOUNT.INDUSTRY` (standard SF field, likely exists)
- `ENGAGEMENT_STATUS` — will default to `'Active'`; refine once we know where this lives
- `STATUS` — app-managed health signal; will default to `'Active'`; ACEs set this in-app
- `TOTAL_CREDITS_ALLOCATED` — not listed; will source from credit tables later (default NULL)
- `ACTIVATION_START_DATE` — not listed; may be a SF field like `CREATED_DATE` or `CONTRACT_START_C`
- `USE_CASE_COUNT` — will be derived by counting `BKMNG_USE_CASES` rows per account_id (not stored)

---

### BKMNG_USE_CASES
| Target Column | Source Table | Source Column | Join/Notes |
|---|---|---|---|
| `USE_CASE_ID` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `ID` | WHERE IS_DELETED=FALSE |
| `ACCOUNT_ID` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `ACCOUNT_C` | FK |
| `USE_CASE_NAME` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `NAME_C` | |
| `DESCRIPTION` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `DESCRIPTION_C` | |
| `STATUS` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `USE_CASE_STATUS_C` | |
| `STAGE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `STAGE_C` | |
| `TARGET_GO_LIVE_DATE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `DECISION_DATE_C` | |
| `GO_LIVE_DATE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `ACTUAL_GO_LIVE_DATE_C` | |
| `LEAD_SE` | `FIVETRAN.SALESFORCE.USER` | `EMAIL` | JOIN on LEAD_SALES_ENGINEER_C = USER.ID |
| `ACE_ASSIGNED` | `FIVETRAN.SALESFORCE.USER` | `EMAIL` | JOIN on OWNER_ID = USER.ID |
| `CREATED_DATE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `CREATED_DATE` | |
| `LAST_MODIFIED_DATE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `LAST_MODIFIED_DATE` | |
| `NOTES` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `USE_CASE_COMMENTS_C` \|\| `IMPLEMENTATION_COMMENTS_C` \|\| `SPECIALIST_COMMENTS_C` | Concatenated with `\|` separator, NULLs skipped |
| `MEDDPICC_OVERALL_SCORE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `OVERALL_SCORE_C` | |
| `MEDDPICC_METRICS_SCORE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `METRICS_SCORE_C` | |
| `MEDDPICC_METRICS` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `MEDDPICC_METRICS_C` | |
| `MEDDPICC_ECONOMIC_BUYER_SCORE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `ECONOMIC_BUYER_SCORE_C` | |
| `MEDDPICC_ECONOMIC_BUYER` | `FIVETRAN.SALESFORCE.CONTACT` | `NAME` | JOIN on MEDDPICC_ECONOMIC_BUYER_C = CONTACT.ID |
| `MEDDPICC_DECISION_CRITERIA_SCORE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `DECISION_CRITERIA_SCORE_C` | |
| `MEDDPICC_DECISION_CRITERIA` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `MEDDPICC_DECISION_CRITERIA_C` | |
| `MEDDPICC_DECISION_PROCESS_SCORE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `DECISION_PROCESS_SCORE_C` | |
| `MEDDPICC_DECISION_PROCESS` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `MEDDPICC_DECISION_PROCESS_C` | |
| `MEDDPICC_IDENTIFY_PAIN_SCORE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `IDENTIFY_PAIN_SCORE_C` | |
| `MEDDPICC_IDENTIFY_PAIN` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `MEDDPICC_IDENTIFY_PAIN_C` | |
| `MEDDPICC_CHAMPION_SCORE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `CHAMPION_SCORE_C` | |
| `MEDDPICC_CHAMPION` | `FIVETRAN.SALESFORCE.CONTACT` | `NAME` | JOIN on MEDDPICC_CHAMPION_C = CONTACT.ID |
| `MEDDPICC_COMPETITOR_SCORE` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `COMPETITOR_SCORE_C` | |
| `MEDDPICC_COMPETITORS` | `FIVETRAN.SALESFORCE.USE_CASE_C` | `COMPETITORS_C` | |

---

## Task 1: Fix .env + Backend Infrastructure

### Update .env
```bash
SNOWFLAKE_DATABASE=TEMP
SNOWFLAKE_SCHEMA=JUSDAVIS
MOCK_DATA=true         # keep true until Task 3
```

### Create SnowflakeDataService skeleton
`backend/app/services/snowflake_service.py` — implements same interface as `MockDataService`, all methods raise `NotImplementedError` initially.

### Update services/__init__.py toggle
```python
from app.config import settings

def get_data_service():
    if settings.mock_data:
        from app.mocks.service import MockDataService
        return MockDataService()
    from app.services.snowflake_service import SnowflakeDataService
    return SnowflakeDataService()
```

### Verify connection
```python
cur.execute("SELECT CURRENT_USER(), CURRENT_DATABASE(), CURRENT_SCHEMA()")
# Expected: ('JUSDAVIS', 'TEMP', 'JUSDAVIS')
```

---

## Task 2: Create BKMNG_ACCOUNTS table

### DDL
```sql
CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_ACCOUNTS (
    ACCOUNT_ID              VARCHAR(18)     NOT NULL,
    ACCOUNT_NAME            VARCHAR(500)    NOT NULL,
    INDUSTRY                VARCHAR(255),
    REGION                  VARCHAR(255),
    ACE_USER_ID             VARCHAR(18),
    ACE_ASSIGNED            VARCHAR(255),       -- email
    ENGAGEMENT_STATUS       VARCHAR(100)    DEFAULT 'Active',
    STATUS                  VARCHAR(100)    DEFAULT 'Active',
    ACTIVATION_START_DATE   DATE,
    TOTAL_CREDITS_ALLOCATED FLOAT,
    ACV                     FLOAT,
    CONSUMPTION_YTD         FLOAT,
    REFRESHED_AT            TIMESTAMP_NTZ   DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (ACCOUNT_ID)
);
```

### Task + refresh SQL
```sql
CREATE OR REPLACE TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_ACCOUNTS
    WAREHOUSE = SE_XS_WH
    SCHEDULE  = 'USING CRON 0 */4 * * * UTC'
AS
BEGIN
    TRUNCATE TABLE TEMP.JUSDAVIS.BKMNG_ACCOUNTS;

    INSERT INTO TEMP.JUSDAVIS.BKMNG_ACCOUNTS (
        ACCOUNT_ID, ACCOUNT_NAME, INDUSTRY, REGION,
        ACE_USER_ID, ACE_ASSIGNED,
        ACV, CONSUMPTION_YTD, REFRESHED_AT
    )
    SELECT
        a.ID                                    AS ACCOUNT_ID,
        a.NAME                                  AS ACCOUNT_NAME,
        a.INDUSTRY                              AS INDUSTRY,
        a.REGION_C                              AS REGION,
        atm.USER_ID                             AS ACE_USER_ID,
        u.EMAIL                                 AS ACE_ASSIGNED,
        a.ACCOUNT_BASE_RENEWAL_ACV_C            AS ACV,
        a.ACTUAL_CONSUMPTION_YTD_C              AS CONSUMPTION_YTD,
        CURRENT_TIMESTAMP()                     AS REFRESHED_AT
    FROM FIVETRAN.SALESFORCE.ACCOUNT a
    LEFT JOIN FIVETRAN.SALESFORCE.ACCOUNT_TEAM_MEMBER atm
        ON  atm.ACCOUNT_ID = a.ID
        AND atm.TEAM_MEMBER_ROLE = 'SE - Activation'
        AND atm.IS_DELETED = FALSE
    LEFT JOIN FIVETRAN.SALESFORCE.USER u
        ON  u.ID = atm.USER_ID
    WHERE a.IS_DELETED = FALSE
      AND a.ID IN (
          -- scope to accounts with an SE - Activation team member only
          SELECT ACCOUNT_ID
          FROM FIVETRAN.SALESFORCE.ACCOUNT_TEAM_MEMBER
          WHERE TEAM_MEMBER_ROLE = 'SE - Activation'
            AND IS_DELETED = FALSE
      );
END;

ALTER TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_ACCOUNTS RESUME;
-- Seed immediately:
EXECUTE TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_ACCOUNTS;
SELECT COUNT(*), COUNT(ACE_ASSIGNED) FROM TEMP.JUSDAVIS.BKMNG_ACCOUNTS;
```

---

## Task 3: Update Pydantic models + wire accounts backend

### Update `Account` model (account.py)
```python
class Account(BaseModel):
    account_id: str
    account_name: str
    industry: Optional[str] = None        # may be null from SF
    ace_assigned: str                     # email
    engagement_status: str = "Active"     # defaulted until better source found
    status: str = "Active"                # app-managed health
    use_case_count: int = 0               # derived — populated by service
    total_credits_allocated: Optional[float] = None
    activation_start_date: Optional[date] = None
    region: Optional[str] = None
    acv: Optional[float] = None           # NEW — from ACCOUNT_BASE_RENEWAL_ACV_C
    consumption_ytd: Optional[float] = None  # NEW — from ACTUAL_CONSUMPTION_YTD_C
```

### Implement in SnowflakeDataService
```python
def list_accounts(self, ace_filter: Optional[str] = None) -> list[Account]:
    cur = self._conn.cursor(snowflake.connector.DictCursor)
    sql = """
        SELECT
            a.ACCOUNT_ID, a.ACCOUNT_NAME, a.INDUSTRY, a.REGION,
            a.ACE_ASSIGNED, a.ENGAGEMENT_STATUS, a.STATUS,
            a.ACV, a.CONSUMPTION_YTD,
            COUNT(uc.USE_CASE_ID) AS USE_CASE_COUNT
        FROM BKMNG_ACCOUNTS a
        LEFT JOIN BKMNG_USE_CASES uc ON uc.ACCOUNT_ID = a.ACCOUNT_ID
        {where}
        GROUP BY 1,2,3,4,5,6,7,8,9
        ORDER BY a.ACCOUNT_NAME
    """
    if ace_filter:
        cur.execute(sql.format(where="WHERE a.ACE_ASSIGNED = %s"), (ace_filter,))
    else:
        cur.execute(sql.format(where=""))
    ...
```

### Flip switch + verify
```bash
# .env
MOCK_DATA=false
```
- Restart backend
- `curl http://localhost:8000/api/accounts` — should return real SF accounts
- Load `/accounts` page in app — confirm account names match SF data

---

## Task 4: Create BKMNG_USE_CASES table

### DDL
```sql
CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_USE_CASES (
    USE_CASE_ID                     VARCHAR(18)     NOT NULL,
    ACCOUNT_ID                      VARCHAR(18)     NOT NULL,
    ACCOUNT_NAME                    VARCHAR(500),
    USE_CASE_NAME                   VARCHAR(500),
    DESCRIPTION                     TEXT,
    STATUS                          VARCHAR(100),
    STAGE                           VARCHAR(100),
    COMPLEXITY                      VARCHAR(50),
    TARGET_GO_LIVE_DATE             DATE,
    GO_LIVE_DATE                    DATE,
    LEAD_SE                         VARCHAR(255),   -- email
    ACE_ASSIGNED                    VARCHAR(255),   -- email
    CREATED_DATE                    TIMESTAMP_TZ,
    LAST_MODIFIED_DATE              TIMESTAMP_TZ,
    NOTES                           TEXT,
    -- MEDDPICC fields
    MEDDPICC_OVERALL_SCORE          FLOAT,
    MEDDPICC_METRICS_SCORE          FLOAT,
    MEDDPICC_METRICS                VARCHAR,
    MEDDPICC_ECONOMIC_BUYER_SCORE   FLOAT,
    MEDDPICC_ECONOMIC_BUYER         VARCHAR(255),   -- contact name
    MEDDPICC_DECISION_CRITERIA_SCORE FLOAT,
    MEDDPICC_DECISION_CRITERIA      VARCHAR,
    MEDDPICC_DECISION_PROCESS_SCORE FLOAT,
    MEDDPICC_DECISION_PROCESS       VARCHAR,
    MEDDPICC_IDENTIFY_PAIN_SCORE    FLOAT,
    MEDDPICC_IDENTIFY_PAIN          VARCHAR,
    MEDDPICC_CHAMPION_SCORE         FLOAT,
    MEDDPICC_CHAMPION               VARCHAR(255),   -- contact name
    MEDDPICC_COMPETITOR_SCORE       FLOAT,
    MEDDPICC_COMPETITORS            VARCHAR,
    REFRESHED_AT                    TIMESTAMP_NTZ   DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (USE_CASE_ID)
);
```

### Task — runs AFTER accounts refresh
```sql
CREATE OR REPLACE TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_USE_CASES
    WAREHOUSE = SE_XS_WH
    SCHEDULE  = 'USING CRON 5 */4 * * * UTC'  -- 5 min after accounts
AS
BEGIN
    TRUNCATE TABLE TEMP.JUSDAVIS.BKMNG_USE_CASES;

    INSERT INTO TEMP.JUSDAVIS.BKMNG_USE_CASES (
        USE_CASE_ID, ACCOUNT_ID, ACCOUNT_NAME, USE_CASE_NAME, DESCRIPTION,
        STATUS, STAGE, TARGET_GO_LIVE_DATE, GO_LIVE_DATE,
        LEAD_SE, ACE_ASSIGNED, CREATED_DATE, LAST_MODIFIED_DATE,
        NOTES,
        MEDDPICC_OVERALL_SCORE, MEDDPICC_METRICS_SCORE, MEDDPICC_METRICS,
        MEDDPICC_ECONOMIC_BUYER_SCORE, MEDDPICC_ECONOMIC_BUYER,
        MEDDPICC_DECISION_CRITERIA_SCORE, MEDDPICC_DECISION_CRITERIA,
        MEDDPICC_DECISION_PROCESS_SCORE, MEDDPICC_DECISION_PROCESS,
        MEDDPICC_IDENTIFY_PAIN_SCORE, MEDDPICC_IDENTIFY_PAIN,
        MEDDPICC_CHAMPION_SCORE, MEDDPICC_CHAMPION,
        MEDDPICC_COMPETITOR_SCORE, MEDDPICC_COMPETITORS,
        REFRESHED_AT
    )
    SELECT
        uc.ID,
        uc.ACCOUNT_C,
        acc.ACCOUNT_NAME,
        uc.NAME_C,
        uc.DESCRIPTION_C,
        uc.USE_CASE_STATUS_C,
        uc.STAGE_C,
        uc.DECISION_DATE_C,
        uc.ACTUAL_GO_LIVE_DATE_C,
        lead_u.EMAIL,
        owner_u.EMAIL,
        uc.CREATED_DATE,
        uc.LAST_MODIFIED_DATE,
        NULLIF(TRIM(CONCAT_WS(' | ',
            NULLIF(TRIM(uc.USE_CASE_COMMENTS_C), ''),
            NULLIF(TRIM(uc.IMPLEMENTATION_COMMENTS_C), ''),
            NULLIF(TRIM(uc.SPECIALIST_COMMENTS_C), '')
        )), ''),
        uc.OVERALL_SCORE_C,
        uc.METRICS_SCORE_C,
        uc.MEDDPICC_METRICS_C,
        uc.ECONOMIC_BUYER_SCORE_C,
        eb_c.NAME,
        uc.DECISION_CRITERIA_SCORE_C,
        uc.MEDDPICC_DECISION_CRITERIA_C,
        uc.DECISION_PROCESS_SCORE_C,
        uc.MEDDPICC_DECISION_PROCESS_C,
        uc.IDENTIFY_PAIN_SCORE_C,
        uc.MEDDPICC_IDENTIFY_PAIN_C,
        uc.CHAMPION_SCORE_C,
        champ_c.NAME,
        uc.COMPETITOR_SCORE_C,
        uc.COMPETITORS_C,
        CURRENT_TIMESTAMP()
    FROM FIVETRAN.SALESFORCE.USE_CASE_C uc
    -- scope to accounts already in BKMNG_ACCOUNTS (SE-activated accounts only)
    INNER JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS acc
        ON  acc.ACCOUNT_ID = uc.ACCOUNT_C
    LEFT JOIN FIVETRAN.SALESFORCE.USER lead_u
        ON  lead_u.ID = uc.LEAD_SALES_ENGINEER_C
    LEFT JOIN FIVETRAN.SALESFORCE.USER owner_u
        ON  owner_u.ID = uc.OWNER_ID
    LEFT JOIN FIVETRAN.SALESFORCE.CONTACT eb_c
        ON  eb_c.ID = uc.MEDDPICC_ECONOMIC_BUYER_C
    LEFT JOIN FIVETRAN.SALESFORCE.CONTACT champ_c
        ON  champ_c.ID = uc.MEDDPICC_CHAMPION_C
    WHERE uc.IS_DELETED = FALSE;
END;

ALTER TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_USE_CASES RESUME;
EXECUTE TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_USE_CASES;
SELECT COUNT(*), COUNT(MEDDPICC_OVERALL_SCORE) FROM TEMP.JUSDAVIS.BKMNG_USE_CASES;
```

---

## Task 5: Update UseCase model + wire use case backend

### Update `UseCase` model (account.py)
```python
class UseCase(BaseModel):
    use_case_id: str
    account_id: str
    account_name: str
    use_case_name: str
    description: Optional[str] = None
    status: str
    ps_notes: list[PSNote] = []
    ps_notes_summary: Optional[str] = None
    go_live_date: Optional[date] = None
    target_go_live_date: Optional[date] = None
    lead_se: str
    ace_assigned: str
    created_date: Optional[date] = None
    last_modified_date: Optional[datetime] = None
    stage: str
    complexity: Optional[str] = None
    notes: Optional[str] = None              # NEW — concatenated SF comments
    meddpicc_overall_score: Optional[float] = None   # NEW
    meddpicc_metrics_score: Optional[float] = None
    meddpicc_metrics: Optional[str] = None
    meddpicc_economic_buyer_score: Optional[float] = None
    meddpicc_economic_buyer: Optional[str] = None
    meddpicc_decision_criteria_score: Optional[float] = None
    meddpicc_decision_criteria: Optional[str] = None
    meddpicc_decision_process_score: Optional[float] = None
    meddpicc_decision_process: Optional[str] = None
    meddpicc_identify_pain_score: Optional[float] = None
    meddpicc_identify_pain: Optional[str] = None
    meddpicc_champion_score: Optional[float] = None
    meddpicc_champion: Optional[str] = None
    meddpicc_competitor_score: Optional[float] = None
    meddpicc_competitors: Optional[str] = None
```

Implement `list_all_use_cases()` and `list_use_cases_for_account()` in `SnowflakeDataService`.

Verify:
- Account detail → Use Cases tab shows real use cases with SF data
- Notes field shows concatenated comments
- Forecasts page populates with real use case stages/dates
- Dashboard pipeline chart uses real stage counts

---

## Post-Phase-1 gaps to address next

| Gap | Plan |
|---|---|
| `INDUSTRY` on accounts | Verify `FIVETRAN.SALESFORCE.ACCOUNT.INDUSTRY` field exists; add to Task SQL |
| `ENGAGEMENT_STATUS` | Determine if a SF field captures Active/Pre-Activation/Completed; if not, make it app-managed |
| `ACTIVATION_START_DATE` | Find the correct SF date field (contract start, first use case created, etc.) |
| `TOTAL_CREDITS_ALLOCATED` | Source from `SALES.CX_INSIGHTS.V_ACCT_CREDIT_USAGE_DLY` or a contract table |
| `COMPLEXITY` on use cases | Not in source mapping — determine if SE sets this in SF or if it should be app-managed |
| MEDDPICC in UI | Add a MEDDPICC tab to Account detail and/or Use Case cards in the frontend |
| Stage value mapping | Verify SF `STAGE_C` values match what the frontend expects (`Discovery`, `POC`, `Technical Win`, etc.) |
| Status value mapping | Verify SF `USE_CASE_STATUS_C` values match (`In Progress`, `Blocked`, `Completed`) |
