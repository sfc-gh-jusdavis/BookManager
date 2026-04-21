-- PROCEDURE: TEMP.JUSDAVIS.SP_REFRESH_BKMNG_ADOPTION_FEATURE_FIRST_USE()  |  created: 2026-04-06 21:04:34.729000+00:00

CREATE OR REPLACE PROCEDURE "SP_REFRESH_BKMNG_ADOPTION_FEATURE_FIRST_USE"()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS '
BEGIN
    CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_ADOPTION_FEATURE_FIRST_USE AS
    WITH acct_map AS (
        SELECT DISTINCT
            r.SALESFORCE_ACCOUNT_ID,
            r.SNOWFLAKE_ACCOUNT_ID::INT AS SNOWFLAKE_ACCOUNT_ID
        FROM SNOWHOUSE.PRODUCT.RELEVANT_SUBSCRIPTION_DAILY_RECORDS r
        JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = r.SALESFORCE_ACCOUNT_ID
        WHERE r.SNOWFLAKE_ACCOUNT_ID IS NOT NULL
    ),
    feature_map (FEATURE_RAW, FEATURE_NAME, FEATURE_SOURCE, CATEGORY) AS (
        SELECT * FROM VALUES
            (''PIPE'', ''Snowpipe'', ''usage_tracking'', ''Pipeline''),
            (''COPY_HISTORY'', ''COPY INTO'', ''usage_tracking'', ''Pipeline''),
            (''SYSTEM$STREAM_HAS_DATA'', ''Streams'', ''usage_tracking'', ''Pipeline''),
            (''DYNAMIC_TABLES'', ''Dynamic Tables'', ''usage_tracking'', ''Transforms''),
            (''SYSTEM$SHOW_STREAMLITS_IN_ACCOUNT'', ''Streamlit Apps'', ''usage_tracking'', ''BI''),
            (''SYSTEM$SHOW_NOTEBOOKS_IN_ACCOUNT'', ''Snowflake Notebooks'', ''usage_tracking'', ''BI''),
            (''BUDGET_CORE_BUNDLE_INSTANCE_EXECUTE'', ''Budgets'', ''usage_tracking'', ''Cost Gov''),
            (''WAREHOUSE_METERING_HISTORY'', ''Warehouse Metering'', ''usage_tracking'', ''Cost Gov''),
            (''SYSTEM$BULK_GET_LISTINGS'', ''Marketplace Listings'', ''usage_tracking'', ''Collab''),
            (''SYSTEM$SHOW_INBOUND_SHARES'', ''Inbound Shares'', ''usage_tracking'', ''Collab''),
            (''SYSTEM$SHOW_OUTBOUND_SHARES'', ''Outbound Shares'', ''usage_tracking'', ''Collab''),
            (''SYSTEM$GET_METRIC_IDS_FOR_DATA_QUALITY_MONITORING_RESULT'', ''Data Quality Monitoring (DMFs)'', ''usage_tracking'', ''Observability''),
            (''CORTEX_SEARCH_REFRESH'', ''Cortex Search'', ''usage_tracking'', ''AI/ML''),
            (''SYSTEM$CORTEX_MODEL_ACCESSIBLE'', ''Cortex LLM Functions'', ''usage_tracking'', ''AI/ML''),
            (''SYSTEM$CORTEX_ANALYST_LIST_AGENTIC_OPTIMIZATIONS'', ''Cortex Analyst'', ''usage_tracking'', ''AI/ML''),
            (''TRANSLATE'', ''Cortex Translate'', ''usage_tracking'', ''AI/ML''),
            (''SYSTEM$GET_AVAILABLE_SPCS_RUNTIMES'', ''SPCS Runtimes'', ''usage_tracking'', ''SPCS''),
            (''SYSTEM$GET_IMAGE_REPOSITORY_METADATA'', ''Image Repositories'', ''usage_tracking'', ''SPCS'')
    ),
    service_map (SERVICE_TYPE_RAW, FEATURE_NAME, CATEGORY) AS (
        SELECT * FROM VALUES
            (''USER_SCHEDULED_TASK'', ''Scheduled Tasks'', ''Pipeline''),
            (''MATERIALIZED_VIEW_REFRESH'', ''Materialized Views'', ''Transforms''),
            (''REPLICATION_GROUP_REFRESH'', ''Replication'', ''Collab''),
            (''AUTOMATIC_CLUSTERING'', ''Automatic Clustering'', ''Observability''),
            (''QUERY_ACCELERATION'', ''Query Acceleration Service'', ''Observability''),
            (''SEARCH_INDEX_REFRESH'', ''Search Optimization Service'', ''AI/ML''),
            (''ICEBERG_STORAGE_OPTIMIZATION'', ''Iceberg Tables'', ''SPCS'')
    ),
    usage_first_use AS (
        SELECT
            m.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
            fm.FEATURE_NAME,
            fm.FEATURE_RAW,
            fm.FEATURE_SOURCE,
            fm.CATEGORY,
            MIN(u.DS) AS FIRST_USE_DATE
        FROM SNOWHOUSE.PRODUCT.USAGE_TRACKING_SUMMARY u
        JOIN acct_map m ON m.SNOWFLAKE_ACCOUNT_ID = u.ACCOUNT_ID
        JOIN feature_map fm ON fm.FEATURE_RAW = u.FEATURE
        GROUP BY m.SALESFORCE_ACCOUNT_ID, fm.FEATURE_NAME, fm.FEATURE_RAW, fm.FEATURE_SOURCE, fm.CATEGORY
    ),
    service_first_use AS (
        SELECT
            m.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
            sm.FEATURE_NAME,
            sm.SERVICE_TYPE_RAW AS FEATURE_RAW,
            ''compute_service'' AS FEATURE_SOURCE,
            sm.CATEGORY,
            MIN(c.DS) AS FIRST_USE_DATE
        FROM SNOWHOUSE.PRODUCT.COMPUTE_SERVICE_ACCOUNT_USAGE c
        JOIN acct_map m ON m.SNOWFLAKE_ACCOUNT_ID = c.ACCOUNT_ID
        JOIN service_map sm ON sm.SERVICE_TYPE_RAW = c.SERVICE_TYPE
        GROUP BY m.SALESFORCE_ACCOUNT_ID, sm.FEATURE_NAME, sm.SERVICE_TYPE_RAW, sm.CATEGORY
    ),
    combined AS (
        SELECT * FROM usage_first_use
        UNION ALL
        SELECT * FROM service_first_use
    ),
    deduped AS (
        SELECT
            ACCOUNT_ID,
            FEATURE_NAME,
            FEATURE_RAW,
            FEATURE_SOURCE,
            CATEGORY,
            MIN(FIRST_USE_DATE) AS FIRST_USE_DATE
        FROM combined
        GROUP BY ACCOUNT_ID, FEATURE_NAME, FEATURE_RAW, FEATURE_SOURCE, CATEGORY
    )
    SELECT
        d.ACCOUNT_ID,
        b.ACCOUNT_NAME,
        d.FEATURE_NAME,
        d.FEATURE_RAW,
        d.FEATURE_SOURCE,
        d.CATEGORY,
        d.FIRST_USE_DATE,
        DATEDIFF(''day'', d.FIRST_USE_DATE, CURRENT_DATE()) AS DAYS_SINCE_FIRST_USE,
        d.FIRST_USE_DATE >= DATEADD(''day'', -30, CURRENT_DATE()) AS IS_NEW_30D,
        d.FIRST_USE_DATE >= DATEADD(''day'', -90, CURRENT_DATE()) AS IS_NEW_90D
    FROM deduped d
    JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = d.ACCOUNT_ID;

    RETURN ''BKMNG_ADOPTION_FEATURE_FIRST_USE refreshed: '' || (SELECT COUNT(*) FROM TEMP.JUSDAVIS.BKMNG_ADOPTION_FEATURE_FIRST_USE) || '' rows'';
END
';
