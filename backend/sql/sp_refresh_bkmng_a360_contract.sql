CREATE OR REPLACE PROCEDURE TEMP.JUSDAVIS.SP_REFRESH_BKMNG_A360_CONTRACT()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
BEGIN
    CREATE OR REPLACE TEMPORARY TABLE _bkmng_a360_contract_staging AS
    WITH latest_contract AS (
        SELECT *
        FROM SALES.RAVEN.A360_BOOKINGS_ACV_VIEW
        WHERE VALUE_TYPE = 'actual'
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY SALESFORCE_ACCOUNT_ID
            ORDER BY CONTRACT_END_DATE DESC, RN DESC
        ) = 1
    ),
    contract_spend AS (
        SELECT
            lc.SALESFORCE_ACCOUNT_ID,
            SUM(r.REVENUE) AS CONTRACT_SPEND
        FROM latest_contract lc
        INNER JOIN SALES.RAVEN.A360_DAILY_ACCOUNT_PRODUCT_CATEGORY_REVENUE r
            ON r.SALESFORCE_ACCOUNT_ID = lc.SALESFORCE_ACCOUNT_ID
            AND r.GENERAL_DATE >= lc.CONTRACT_START_DATE
            AND r.GENERAL_DATE <= CURRENT_DATE()
        GROUP BY lc.SALESFORCE_ACCOUNT_ID
    ),
    -- Dedupe upstream A360_OVERAGE_UNDERAGE_PREDICTION_VIEW which can return
    -- multiple rows per SALESFORCE_ACCOUNT_ID (observed for 001VI00000B2bBdYAJ).
    -- Without this CTE, the LEFT JOIN below fans out and produces dupe ACCOUNT_IDs
    -- that propagate into BKMNG_ONT_ACCOUNTS and break SP_COMPUTE_AI_ASSESSMENTS
    -- with error 100090 (Duplicate row detected during DML action).
    overage_dedup AS (
        SELECT *
        FROM SALES.RAVEN.A360_OVERAGE_UNDERAGE_PREDICTION_VIEW
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY SALESFORCE_ACCOUNT_ID
            ORDER BY DAY_OF_OVERAGE DESC NULLS LAST, DAYS_TILL_OVERAGE DESC NULLS LAST
        ) = 1
    ),
    run_rate_dedup AS (
        SELECT *
        FROM SALES.RAVEN.A360_RUN_RATE_VIEW
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY SALESFORCE_ACCOUNT_ID
            ORDER BY REV_180 DESC NULLS LAST
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
        cs.CONTRACT_SPEND,
        CURRENT_TIMESTAMP()::TIMESTAMP_NTZ AS REFRESHED_AT
    FROM TEMP.JUSDAVIS.BKMNG_ACCOUNTS b
    LEFT JOIN latest_contract c ON c.SALESFORCE_ACCOUNT_ID = b.ACCOUNT_ID
    LEFT JOIN overage_dedup o ON o.SALESFORCE_ACCOUNT_ID = b.ACCOUNT_ID
    LEFT JOIN run_rate_dedup rr ON rr.SALESFORCE_ACCOUNT_ID = b.ACCOUNT_ID
    LEFT JOIN contract_spend cs ON cs.SALESFORCE_ACCOUNT_ID = b.ACCOUNT_ID
    -- Final guard: ensure exactly one row per ACCOUNT_ID even if a future
    -- upstream regression slips past the per-source dedupes above.
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY b.ACCOUNT_ID
        ORDER BY c.CONTRACT_END_DATE DESC NULLS LAST
    ) = 1;

    LET staging_with_data INT := (SELECT COUNT(*) FROM _bkmng_a360_contract_staging WHERE NET_ACV IS NOT NULL);
    LET staging_total INT := (SELECT COUNT(*) FROM _bkmng_a360_contract_staging);

    -- Always refresh the table. Pattern 13: SPs must not silently skip.
    -- The pipeline health check is the source of truth for staleness.
    CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_A360_CONTRACT AS
    SELECT * FROM _bkmng_a360_contract_staging;

    RETURN 'BKMNG_A360_CONTRACT refreshed: ' || :staging_total || ' rows, ' || :staging_with_data || ' with contract data';
END;
$$;
