-- PROCEDURE: TEMP.JUSDAVIS.SP_REFRESH_BKMNG_UNIFIED_MEETINGS()
-- Task 5: unified past Gong SFDC calls + future Gong DC scheduled meetings

CREATE OR REPLACE PROCEDURE TEMP.JUSDAVIS.SP_REFRESH_BKMNG_UNIFIED_MEETINGS()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
BEGIN
    TRUNCATE TABLE TEMP.JUSDAVIS.BKMNG_UNIFIED_MEETINGS;

    -- Part 1: past recorded calls from Gong SFDC (clean 1 row per call, AI summaries populated)
    INSERT INTO TEMP.JUSDAVIS.BKMNG_UNIFIED_MEETINGS (
        MEETING_ID, ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED, TITLE,
        MEETING_START, MEETING_END, DURATION_MINS, STATUS, IS_UPCOMING,
        SUMMARY, KEY_POINTS, NEXT_STEPS, TOPICS,
        RECORDING_URL, PARTICIPANTS, SOURCE, REFRESHED_AT
    )
    SELECT
        g.ID AS MEETING_ID,
        g.GONG_PRIMARY_ACCOUNT_C AS ACCOUNT_ID,
        a.ACCOUNT_NAME,
        a.ACE_ASSIGNED,
        g.GONG_TITLE_C AS TITLE,
        g.GONG_CALL_START_C::TIMESTAMP_NTZ AS MEETING_START,
        g.GONG_CALL_END_C::TIMESTAMP_NTZ AS MEETING_END,
        FLOOR(g.GONG_CALL_DURATION_SEC_C / 60) AS DURATION_MINS,
        'COMPLETED' AS STATUS,
        FALSE AS IS_UPCOMING,
        LEFT(g.GONG_CALL_BRIEF_C, 4000) AS SUMMARY,
        LEFT(g.GONG_CALL_KEY_POINTS_C, 4000) AS KEY_POINTS,
        LEFT(g.GONG_CALL_HIGHLIGHTS_NEXT_STEPS_C, 4000) AS NEXT_STEPS,
        LEFT(g.GONG_RELATED_TOPICS_JSON_C, 4000) AS TOPICS,
        g.GONG_VIEW_CALL_C AS RECORDING_URL,
        LEFT(g.GONG_PARTICIPANTS_EMAILS_C, 2000) AS PARTICIPANTS,
        'gong_sfdc' AS SOURCE,
        CURRENT_TIMESTAMP()
    FROM FIVETRAN.SALESFORCE.GONG_GONG_CALL_C g
    JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS a ON a.ACCOUNT_ID = g.GONG_PRIMARY_ACCOUNT_C
    WHERE g.GONG_CALL_START_C >= DATEADD('day', -90, CURRENT_TIMESTAMP())
      AND g.GONG_PRIMARY_ACCOUNT_C IS NOT NULL
      AND g.IS_DELETED = FALSE;

    -- Part 2: future scheduled meetings from Gong Data Cloud, deduplicated
    -- Account linkage: preferred = Zoom meeting ID match against a past SFDC call for the same account;
    --                  fallback = ACE owner email -> ACCOUNT_ID mapping (may map to multiple accounts)
    INSERT INTO TEMP.JUSDAVIS.BKMNG_UNIFIED_MEETINGS (
        MEETING_ID, ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED, TITLE,
        MEETING_START, MEETING_END, DURATION_MINS, STATUS, IS_UPCOMING,
        SUMMARY, KEY_POINTS, NEXT_STEPS, TOPICS,
        RECORDING_URL, PARTICIPANTS, SOURCE, REFRESHED_AT
    )
    WITH gong_dc_future AS (
        SELECT
            c.CONVERSATION_KEY,
            c.TITLE,
            c.EFFECTIVE_START_DATETIME::TIMESTAMP_NTZ AS MEETING_START,
            c.PLANNED_END_DATETIME::TIMESTAMP_NTZ AS MEETING_END,
            c.CALL_URL,
            u.EMAIL_ADDRESS AS OWNER_EMAIL,
            REGEXP_SUBSTR(c.CALL_URL, '/j/([0-9]+)', 1, 1, 'e') AS ZOOM_ID,
            ROW_NUMBER() OVER (
                PARTITION BY
                    COALESCE(REGEXP_SUBSTR(c.CALL_URL, '/j/([0-9]+)', 1, 1, 'e'), c.CONVERSATION_KEY),
                    DATE(c.EFFECTIVE_START_DATETIME),
                    c.TITLE
                ORDER BY c.ETL_MODIFIED_DATETIME DESC
            ) AS rn
        FROM GONG_SHARE.GONG_DATA_CLOUD.CALLS c
        JOIN GONG_SHARE.GONG_DATA_CLOUD.USERS u ON c.OWNER_ID = u.USER_ID
        WHERE c.EFFECTIVE_START_DATETIME >= CURRENT_TIMESTAMP()
          AND c.EFFECTIVE_START_DATETIME < DATEADD('day', 90, CURRENT_TIMESTAMP())
          AND c.STATUS = 'SCHEDULED'
          AND c.IS_DELETED = FALSE
          AND LOWER(u.EMAIL_ADDRESS) IN (
              SELECT LOWER(ACE_ASSIGNED) FROM TEMP.JUSDAVIS.BKMNG_ACCOUNTS
              WHERE ACE_ASSIGNED IS NOT NULL
          )
    ),
    -- Pre-aggregate Zoom-id -> account for past Gong SFDC calls (for account linkage)
    zoom_account_map AS (
        SELECT
            REGEXP_SUBSTR(g.GONG_VIEW_CALL_C, '/j/([0-9]+)', 1, 1, 'e') AS ZOOM_ID,
            g.GONG_PRIMARY_ACCOUNT_C AS ACCOUNT_ID,
            COUNT(*) AS CNT,
            ROW_NUMBER() OVER (
                PARTITION BY REGEXP_SUBSTR(g.GONG_VIEW_CALL_C, '/j/([0-9]+)', 1, 1, 'e')
                ORDER BY COUNT(*) DESC
            ) AS rn
        FROM FIVETRAN.SALESFORCE.GONG_GONG_CALL_C g
        WHERE g.GONG_PRIMARY_ACCOUNT_C IS NOT NULL
          AND g.IS_DELETED = FALSE
          AND REGEXP_SUBSTR(g.GONG_VIEW_CALL_C, '/j/([0-9]+)', 1, 1, 'e') IS NOT NULL
        GROUP BY 1, 2
    ),
    dedup_future AS (
        SELECT * FROM gong_dc_future WHERE rn = 1
    ),
    linked_future AS (
        -- Preferred: Zoom-id -> account
        SELECT
            f.CONVERSATION_KEY, f.TITLE, f.MEETING_START, f.MEETING_END, f.CALL_URL,
            f.OWNER_EMAIL, z.ACCOUNT_ID
        FROM dedup_future f
        JOIN zoom_account_map z ON z.ZOOM_ID = f.ZOOM_ID AND z.rn = 1
        WHERE f.ZOOM_ID IS NOT NULL
        UNION ALL
        -- Fallback: owner email -> each account they own (only for futures with no Zoom-id match)
        SELECT
            f.CONVERSATION_KEY, f.TITLE, f.MEETING_START, f.MEETING_END, f.CALL_URL,
            f.OWNER_EMAIL, a.ACCOUNT_ID
        FROM dedup_future f
        JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS a ON LOWER(a.ACE_ASSIGNED) = LOWER(f.OWNER_EMAIL)
        WHERE NOT EXISTS (
            SELECT 1 FROM zoom_account_map z
            WHERE z.ZOOM_ID = f.ZOOM_ID AND z.rn = 1
        )
    )
    SELECT
        -- Unique MEETING_ID: conv-key + account (one conv-key may fan out to multiple accts via fallback)
        lf.CONVERSATION_KEY || ':' || lf.ACCOUNT_ID AS MEETING_ID,
        lf.ACCOUNT_ID,
        a.ACCOUNT_NAME,
        a.ACE_ASSIGNED,
        lf.TITLE,
        lf.MEETING_START,
        lf.MEETING_END,
        CASE WHEN lf.MEETING_END IS NOT NULL AND lf.MEETING_START IS NOT NULL
             THEN TIMESTAMPDIFF('minute', lf.MEETING_START, lf.MEETING_END)
             ELSE NULL END AS DURATION_MINS,
        'SCHEDULED' AS STATUS,
        TRUE AS IS_UPCOMING,
        NULL AS SUMMARY,
        NULL AS KEY_POINTS,
        NULL AS NEXT_STEPS,
        NULL AS TOPICS,
        lf.CALL_URL AS RECORDING_URL,
        lf.OWNER_EMAIL AS PARTICIPANTS,
        'gong_dc' AS SOURCE,
        CURRENT_TIMESTAMP()
    FROM linked_future lf
    JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS a ON a.ACCOUNT_ID = lf.ACCOUNT_ID
    -- Exclude future entries that already exist as past completed calls on same day/account
    WHERE NOT EXISTS (
        SELECT 1 FROM FIVETRAN.SALESFORCE.GONG_GONG_CALL_C g
        WHERE g.GONG_PRIMARY_ACCOUNT_C = lf.ACCOUNT_ID
          AND DATE(g.GONG_CALL_START_C) = DATE(lf.MEETING_START)
          AND g.IS_DELETED = FALSE
    )
    QUALIFY ROW_NUMBER() OVER (PARTITION BY lf.CONVERSATION_KEY || ':' || lf.ACCOUNT_ID ORDER BY lf.MEETING_START) = 1;

    RETURN 'Done: ' || (SELECT COUNT(*)::VARCHAR FROM TEMP.JUSDAVIS.BKMNG_UNIFIED_MEETINGS) || ' rows';
END;
$$;
