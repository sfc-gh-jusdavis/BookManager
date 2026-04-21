-- PROCEDURE: TEMP.JUSDAVIS.SP_COMPUTE_SUPPORT_SIGNALS()  |  created: 2026-04-07 22:00:10.371000+00:00

CREATE OR REPLACE PROCEDURE "SP_COMPUTE_SUPPORT_SIGNALS"()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS '
BEGIN
    DELETE FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS WHERE SOURCE = ''support'';

    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY,
         SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT,
         SOURCE, CATEGORY, ALERT_ELIGIBLE)
    SELECT
        ''open_sev1_ticket-'' || t.CASE_ID,
        t.ACCOUNT_ID, t.ACCOUNT_NAME, ''open_sev1_ticket'', ''high'',
        t.ACCOUNT_NAME || '' has open Sev-1 ticket: '' || LEFT(COALESCE(t.SUBJECT, ''No subject''), 100),
        ''Case: '' || t.CASE_NUMBER || '' | Status: '' || COALESCE(t.STATUS, ''Unknown'')
            || '' | Days open: '' || COALESCE(t.DAYS_OPEN::VARCHAR, ''N/A'')
            || '' | Category: '' || COALESCE(t.CATEGORY, ''Unknown'')
            || '' | Snowflake account: '' || COALESCE(t.SNOWFLAKE_ACCOUNT_ALIAS, ''Unknown''),
        ''case'', t.CASE_ID, CURRENT_TIMESTAMP(),
        ''support'', ''support'', TRUE
    FROM TEMP.JUSDAVIS.BKMNG_SUPPORT_TICKETS t
    WHERE t.SEVERITY ILIKE ''%severity-1%''
      AND t.IS_CLOSED = FALSE;

    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY,
         SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT,
         SOURCE, CATEGORY, ALERT_ELIGIBLE)
    SELECT
        ''open_sev2_ticket-'' || t.CASE_ID,
        t.ACCOUNT_ID, t.ACCOUNT_NAME, ''open_sev2_ticket'', ''high'',
        t.ACCOUNT_NAME || '' has open Sev-2 ticket: '' || LEFT(COALESCE(t.SUBJECT, ''No subject''), 100),
        ''Case: '' || t.CASE_NUMBER || '' | Status: '' || COALESCE(t.STATUS, ''Unknown'')
            || '' | Days open: '' || COALESCE(t.DAYS_OPEN::VARCHAR, ''N/A'')
            || '' | Category: '' || COALESCE(t.CATEGORY, ''Unknown'')
            || '' | Snowflake account: '' || COALESCE(t.SNOWFLAKE_ACCOUNT_ALIAS, ''Unknown''),
        ''case'', t.CASE_ID, CURRENT_TIMESTAMP(),
        ''support'', ''support'', TRUE
    FROM TEMP.JUSDAVIS.BKMNG_SUPPORT_TICKETS t
    WHERE t.SEVERITY ILIKE ''%severity-2%''
      AND t.IS_CLOSED = FALSE;

    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY,
         SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT,
         SOURCE, CATEGORY, ALERT_ELIGIBLE)
    SELECT
        ''escalated_ticket-'' || t.CASE_ID,
        t.ACCOUNT_ID, t.ACCOUNT_NAME, ''escalated_ticket'', ''high'',
        t.ACCOUNT_NAME || '' has escalated ticket: '' || LEFT(COALESCE(t.SUBJECT, ''No subject''), 100),
        ''Case: '' || t.CASE_NUMBER || '' | Escalation status: '' || COALESCE(t.ESCALATION_STATUS, ''Escalated'')
            || '' | Severity: '' || COALESCE(t.SEVERITY, ''Unknown'')
            || '' | Days open: '' || COALESCE(t.DAYS_OPEN::VARCHAR, ''N/A'')
            || '' | Sales escalated: '' || COALESCE(t.SALES_ESCALATED::VARCHAR, ''false''),
        ''case'', t.CASE_ID, CURRENT_TIMESTAMP(),
        ''support'', ''support'', TRUE
    FROM TEMP.JUSDAVIS.BKMNG_SUPPORT_TICKETS t
    WHERE t.IS_ESCALATED = TRUE
      AND t.IS_CLOSED = FALSE
      AND t.SEVERITY NOT ILIKE ''%severity-1%''
      AND t.SEVERITY NOT ILIKE ''%severity-2%'';

    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY,
         SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT,
         SOURCE, CATEGORY, ALERT_ELIGIBLE)
    SELECT
        ''ticket_volume_spike-'' || t.ACCOUNT_ID,
        t.ACCOUNT_ID, MAX(t.ACCOUNT_NAME), ''ticket_volume_spike'', ''medium'',
        MAX(t.ACCOUNT_NAME) || '' has '' || COUNT(*)::VARCHAR || '' open support tickets'',
        ''Open tickets (90d): '' || COUNT(*)::VARCHAR
            || '' | Sev-1: '' || SUM(CASE WHEN t.SEVERITY ILIKE ''%severity-1%'' THEN 1 ELSE 0 END)::VARCHAR
            || '' | Sev-2: '' || SUM(CASE WHEN t.SEVERITY ILIKE ''%severity-2%'' THEN 1 ELSE 0 END)::VARCHAR
            || '' | Escalated: '' || SUM(CASE WHEN t.IS_ESCALATED = TRUE THEN 1 ELSE 0 END)::VARCHAR,
        ''account'', t.ACCOUNT_ID, CURRENT_TIMESTAMP(),
        ''support'', ''support'', FALSE
    FROM TEMP.JUSDAVIS.BKMNG_SUPPORT_TICKETS t
    WHERE t.IS_CLOSED = FALSE
    GROUP BY t.ACCOUNT_ID
    HAVING COUNT(*) >= 3;

    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY,
         SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT,
         SOURCE, CATEGORY, ALERT_ELIGIBLE)
    SELECT
        ''long_running_ticket-'' || t.CASE_ID,
        t.ACCOUNT_ID, t.ACCOUNT_NAME, ''long_running_ticket'', ''medium'',
        t.ACCOUNT_NAME || '' has ticket open for '' || ROUND(t.DAYS_OPEN, 0)::VARCHAR || '' days: ''
            || LEFT(COALESCE(t.SUBJECT, ''No subject''), 80),
        ''Case: '' || t.CASE_NUMBER || '' | Days open: '' || ROUND(t.DAYS_OPEN, 0)::VARCHAR
            || '' | Severity: '' || COALESCE(t.SEVERITY, ''Unknown'')
            || '' | Status: '' || COALESCE(t.STATUS, ''Unknown'')
            || '' | Category: '' || COALESCE(t.CATEGORY, ''Unknown''),
        ''case'', t.CASE_ID, CURRENT_TIMESTAMP(),
        ''support'', ''support'', FALSE
    FROM TEMP.JUSDAVIS.BKMNG_SUPPORT_TICKETS t
    WHERE t.IS_CLOSED = FALSE
      AND t.DAYS_OPEN >= 14
      AND t.SEVERITY NOT ILIKE ''%severity-1%''
      AND t.SEVERITY NOT ILIKE ''%severity-2%''
      AND t.IS_ESCALATED = FALSE;

    RETURN ''OK: '' || (SELECT COUNT(*)::VARCHAR FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS WHERE SOURCE = ''support'') || '' support signals generated'';
END
';
