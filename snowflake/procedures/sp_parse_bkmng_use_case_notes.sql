-- PROCEDURE: TEMP.JUSDAVIS.SP_PARSE_BKMNG_USE_CASE_NOTES()  |  created: 2026-04-07 16:26:46.141000+00:00

CREATE OR REPLACE PROCEDURE "SP_PARSE_BKMNG_USE_CASE_NOTES"()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS OWNER
AS '
DECLARE
    n_parsed INT DEFAULT 0;
    n_total INT DEFAULT 0;
BEGIN
    SELECT COUNT(*)
    INTO :n_parsed
    FROM TEMP.JUSDAVIS.BKMNG_USE_CASES uc
    LEFT JOIN (
        SELECT USE_CASE_ID, MAX(REFRESHED_AT) AS LAST_PARSED
        FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
        GROUP BY USE_CASE_ID
    ) lp ON lp.USE_CASE_ID = uc.USE_CASE_ID
    WHERE uc.LEAD_SE IS NOT NULL
      AND uc.NOTES IS NOT NULL AND uc.NOTES != ''''
      AND (lp.LAST_PARSED IS NULL OR uc.LAST_MODIFIED_DATE > lp.LAST_PARSED);

    DELETE FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
    WHERE USE_CASE_ID IN (
        SELECT uc.USE_CASE_ID
        FROM TEMP.JUSDAVIS.BKMNG_USE_CASES uc
        LEFT JOIN (
            SELECT USE_CASE_ID, MAX(REFRESHED_AT) AS LAST_PARSED
            FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
            GROUP BY USE_CASE_ID
        ) lp ON lp.USE_CASE_ID = uc.USE_CASE_ID
        WHERE uc.LEAD_SE IS NOT NULL
          AND uc.NOTES IS NOT NULL AND uc.NOTES != ''''
          AND (lp.LAST_PARSED IS NULL OR uc.LAST_MODIFIED_DATE > lp.LAST_PARSED)
    );

    INSERT INTO TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
    WITH needs_parse AS (
        SELECT uc.USE_CASE_ID, uc.ACCOUNT_ID, uc.ACCOUNT_NAME, uc.USE_CASE_NAME, uc.LEAD_SE,
               LEFT(uc.NOTES, 4000) AS NOTES
        FROM TEMP.JUSDAVIS.BKMNG_USE_CASES uc
        LEFT JOIN (
            SELECT USE_CASE_ID, MAX(REFRESHED_AT) AS LAST_PARSED
            FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
            GROUP BY USE_CASE_ID
        ) lp ON lp.USE_CASE_ID = uc.USE_CASE_ID
        WHERE uc.LEAD_SE IS NOT NULL
          AND uc.NOTES IS NOT NULL AND uc.NOTES != ''''
          AND (lp.LAST_PARSED IS NULL OR uc.LAST_MODIFIED_DATE > lp.LAST_PARSED)
    ),
    parsed_raw AS (
        SELECT n.USE_CASE_ID, n.ACCOUNT_ID, n.ACCOUNT_NAME, n.USE_CASE_NAME, n.LEAD_SE,
            SNOWFLAKE.CORTEX.COMPLETE(
                ''llama3.1-8b'',
                CONCAT(
                    ''Extract each note entry from SE notes. Return ONLY a JSON array, no markdown, no explanation. '',
                    ''Format: [{"date":"YYYY-MM-DD","initials":"XX","content":"text"},...]. '',
                    ''Normalize all dates to YYYY-MM-DD. Use the full 4-digit year exactly as written. '',
                    ''For 2-digit years: 25->2025, 26->2026, 24->2024. '',
                    ''Preserve author initials/names exactly as written (e.g. "CA", "JD", "TSmith"). '',
                    ''Return [] if no clear note entries found.\\n\\nNotes:\\n'', n.NOTES
                )
            ) AS PARSED_JSON
        FROM needs_parse n
    )
    SELECT
        MD5(p.USE_CASE_ID || ''|'' || COALESCE(f.value:date::VARCHAR, '''') || ''|'' || COALESCE(f.value:initials::VARCHAR, '''')) AS NOTE_ID,
        p.USE_CASE_ID, p.ACCOUNT_ID, p.ACCOUNT_NAME, p.USE_CASE_NAME, p.LEAD_SE,
        TRY_TO_DATE(f.value:date::VARCHAR, ''YYYY-MM-DD'') AS NOTE_DATE,
        f.value:initials::VARCHAR AS AUTHOR_INITIALS,
        LEFT(f.value:content::VARCHAR, 8000) AS CONTENT,
        CURRENT_TIMESTAMP()::TIMESTAMP_NTZ AS REFRESHED_AT
    FROM parsed_raw p,
    LATERAL FLATTEN(
        COALESCE(
            TRY_PARSE_JSON(COALESCE(REGEXP_SUBSTR(p.PARSED_JSON, ''\\\\[.*\\\\]'', 1, 1, ''s''), ''[]'')),
            PARSE_JSON(''[]'')
        )
    ) f
    WHERE f.value:date IS NOT NULL
      AND f.value:content IS NOT NULL
      AND LENGTH(TRIM(f.value:content::VARCHAR)) > 5;

    SELECT COUNT(*) INTO :n_total FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES;

    RETURN ''BKMNG_USE_CASE_NOTES refreshed: '' || :n_parsed || '' use cases parsed, '' || :n_total || '' total notes'';
END
';
