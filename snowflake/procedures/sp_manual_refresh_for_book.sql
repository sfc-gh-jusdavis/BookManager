-- PROCEDURE: TEMP.JUSDAVIS.SP_MANUAL_REFRESH_FOR_BOOK()
-- Purpose: On-demand full-pipeline refresh. Runs the same steps as the scheduled
-- task chain, in order. Use for book-level "refresh everything" actions.
--
-- This is effectively a wrapper that runs the core refresh chain end-to-end.
-- It does NOT re-run slow tasks that are unrelated to core account data
-- (A360 contract/consumption/adoption, AI assessments, meeting prep generation).
CREATE OR REPLACE PROCEDURE TEMP.JUSDAVIS.SP_MANUAL_REFRESH_FOR_BOOK()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
    n_accounts INT DEFAULT 0;
    n_use_cases INT DEFAULT 0;
    n_gong INT DEFAULT 0;
    n_signals INT DEFAULT 0;
    n_patterns INT DEFAULT 0;
    n_alerts INT DEFAULT 0;
BEGIN
    -- 1. Refresh source tables from Salesforce/Fivetran (inline tasks: accounts, use cases, gong)
    EXECUTE IMMEDIATE 'EXECUTE TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_ACCOUNTS';
    EXECUTE IMMEDIATE 'EXECUTE TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_USE_CASES';
    EXECUTE IMMEDIATE 'EXECUTE TASK TEMP.JUSDAVIS.TASK_REFRESH_BKMNG_GONG_CALLS';

    -- 2. Re-parse use case notes (PS notes) -- only incremental by LAST_MODIFIED_DATE
    CALL TEMP.JUSDAVIS.SP_PARSE_BKMNG_USE_CASE_NOTES();

    -- 3. Rebuild ONT interactions from fresh Gong calls
    CALL TEMP.JUSDAVIS.SP_REFRESH_BKMNG_ONT_INTERACTIONS();

    -- 4. Rebuild ONT_ACCOUNTS enriched view
    CALL TEMP.JUSDAVIS.SP_REFRESH_BKMNG_ONT_ACCOUNTS();

    -- 5. Rebuild account signals
    CALL TEMP.JUSDAVIS.SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS();

    -- 6. Recompute composite patterns
    CALL TEMP.JUSDAVIS.SP_COMPUTE_COMPOSITE_PATTERNS();

    -- 7. Refresh user alerts (appends new alert-eligible signals)
    CALL TEMP.JUSDAVIS.SP_REFRESH_BKMNG_USER_ALERTS();

    -- Counts for return message
    SELECT COUNT(*) INTO :n_accounts FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS;
    SELECT COUNT(*) INTO :n_use_cases FROM TEMP.JUSDAVIS.BKMNG_USE_CASES;
    SELECT COUNT(*) INTO :n_gong FROM TEMP.JUSDAVIS.BKMNG_GONG_CALLS;
    SELECT COUNT(*) INTO :n_signals FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS;
    SELECT COUNT(*) INTO :n_patterns FROM TEMP.JUSDAVIS.BKMNG_COMPOSITE_PATTERNS;
    SELECT COUNT(*) INTO :n_alerts FROM TEMP.JUSDAVIS.BKMNG_USER_ALERTS WHERE IS_DISMISSED = FALSE;

    RETURN 'OK: accounts=' || :n_accounts::VARCHAR
        || ' use_cases=' || :n_use_cases::VARCHAR
        || ' gong=' || :n_gong::VARCHAR
        || ' signals=' || :n_signals::VARCHAR
        || ' patterns=' || :n_patterns::VARCHAR
        || ' active_alerts=' || :n_alerts::VARCHAR;
END;
$$;
