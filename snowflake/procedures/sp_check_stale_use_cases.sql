-- PROCEDURE: TEMP.JUSDAVIS.SP_CHECK_STALE_USE_CASES()  |  created: 2026-04-10 04:33:24.622000+00:00

CREATE OR REPLACE PROCEDURE "SP_CHECK_STALE_USE_CASES"()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS OWNER
AS '
BEGIN
    -- 1. Auto-dismiss existing open alerts for use cases on COMPLETE accounts
    UPDATE TEMP.JUSDAVIS.BKMNG_USER_ALERTS
    SET IS_DISMISSED = TRUE
    WHERE SIGNAL_TYPE = ''stale_use_case''
      AND IS_DISMISSED = FALSE
      AND SIGNAL_ID IN (
          SELECT uc.USE_CASE_ID
          FROM TEMP.JUSDAVIS.BKMNG_USE_CASES uc
          JOIN TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = uc.ACCOUNT_ID
          WHERE LOWER(COALESCE(a.STATUS, ''active'')) = ''complete''
      );

    -- 2. Insert new alerts with status-aware threshold + day-of-week gating
    INSERT INTO TEMP.JUSDAVIS.BKMNG_USER_ALERTS (
        ALERT_ID, USER_EMAIL, SIGNAL_ID, SIGNAL_TYPE,
        ACCOUNT_ID, ACCOUNT_NAME, TEXT, PRIORITY, SOURCE,
        IS_READ, IS_DISMISSED, CREATED_AT
    )
    SELECT
        UUID_STRING(),
        uc.LEAD_SE,
        uc.USE_CASE_ID,
        ''stale_use_case'',
        uc.ACCOUNT_ID,
        uc.ACCOUNT_NAME,
        CASE
            WHEN n.LAST_NOTE_DATE IS NULL
                THEN ''Add PS notes for: '' || uc.USE_CASE_NAME || '' — no notes yet''
            ELSE ''Update PS notes for: '' || uc.USE_CASE_NAME
                || '' — last updated ''
                || DATEDIFF(''day'', n.LAST_NOTE_DATE, CURRENT_DATE())::VARCHAR
                || '' days ago''
        END,
        ''medium'', ''system'', FALSE, FALSE, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_USE_CASES uc
    JOIN TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a ON a.ACCOUNT_ID = uc.ACCOUNT_ID
    LEFT JOIN (
        SELECT USE_CASE_ID, MAX(NOTE_DATE) AS LAST_NOTE_DATE
        FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
        GROUP BY USE_CASE_ID
    ) n ON n.USE_CASE_ID = uc.USE_CASE_ID
    WHERE uc.LEAD_SE IS NOT NULL
      AND UPPER(COALESCE(uc.STATUS, '''')) NOT IN (''COMPLETED'', ''CLOSED'')
      AND LOWER(COALESCE(a.STATUS, ''active'')) != ''complete''
      AND CASE
            WHEN LOWER(COALESCE(a.STATUS, ''active'')) IN (''paused'', ''stopped'')
                THEN (n.LAST_NOTE_DATE IS NULL
                      OR DATEDIFF(''day'', n.LAST_NOTE_DATE, CURRENT_DATE()) >= 14)
            ELSE
                DAYOFWEEK(CURRENT_DATE()) = 5
                AND (n.LAST_NOTE_DATE IS NULL
                     OR DATEDIFF(''day'', n.LAST_NOTE_DATE, CURRENT_DATE()) >= 7)
          END
      AND NOT EXISTS (
          SELECT 1 FROM TEMP.JUSDAVIS.BKMNG_USER_ALERTS al
          WHERE al.SIGNAL_ID = uc.USE_CASE_ID
            AND al.SIGNAL_TYPE = ''stale_use_case''
            AND al.IS_DISMISSED = FALSE
      );

    RETURN ''done'';
END;
';
