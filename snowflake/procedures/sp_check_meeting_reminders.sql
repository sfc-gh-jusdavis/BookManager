-- PROCEDURE: TEMP.JUSDAVIS.SP_CHECK_MEETING_REMINDERS()  |  created: 2026-04-09 23:23:36.557000+00:00

CREATE OR REPLACE PROCEDURE "SP_CHECK_MEETING_REMINDERS"()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS OWNER
AS '
DECLARE
    rows_inserted INT DEFAULT 0;
BEGIN
    INSERT INTO TEMP.JUSDAVIS.BKMNG_USER_ALERTS (
        ALERT_ID,
        USER_EMAIL,
        SIGNAL_ID,
        SIGNAL_TYPE,
        ACCOUNT_ID,
        ACCOUNT_NAME,
        TEXT,
        PRIORITY,
        SOURCE,
        IS_READ,
        IS_DISMISSED,
        CREATED_AT
    )
    SELECT
        UUID_STRING()                                              AS ALERT_ID,
        m.CREATED_BY                                              AS USER_EMAIL,
        m.MEETING_ID                                              AS SIGNAL_ID,
        ''meeting_reminder''                                        AS SIGNAL_TYPE,
        m.ACCOUNT_ID                                              AS ACCOUNT_ID,
        m.ACCOUNT_NAME                                            AS ACCOUNT_NAME,
        CONCAT(
            ''Log meeting notes for "'', m.TITLE,
            ''" on '', TO_CHAR(CONVERT_TIMEZONE(''UTC'', m.MEETING_DATE), ''Mon DD, YYYY''),
            '' with '', COALESCE(m.ACCOUNT_NAME, ''your account'')
        )                                                         AS TEXT,
        ''medium''                                                  AS PRIORITY,
        ''meeting_reminder''                                        AS SOURCE,
        FALSE                                                     AS IS_READ,
        FALSE                                                     AS IS_DISMISSED,
        CURRENT_TIMESTAMP()                                       AS CREATED_AT
    FROM TEMP.JUSDAVIS.BKMNG_MANUAL_MEETINGS m
    WHERE
        m.MEETING_DATE < DATEADD(''hour'', -24, CURRENT_TIMESTAMP())
        AND m.NOTES_ADDED = FALSE
        AND NOT EXISTS (
            SELECT 1
            FROM TEMP.JUSDAVIS.BKMNG_USER_ALERTS a
            WHERE a.SIGNAL_ID  = m.MEETING_ID
              AND a.SIGNAL_TYPE = ''meeting_reminder''
              AND a.USER_EMAIL  = m.CREATED_BY
              AND a.IS_DISMISSED = FALSE
        );

    rows_inserted := SQLROWCOUNT;
    RETURN ''Created '' || rows_inserted || '' meeting reminder alert(s)'';
END;
';
