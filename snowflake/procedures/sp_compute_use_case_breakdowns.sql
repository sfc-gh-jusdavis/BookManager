-- PROCEDURE: TEMP.JUSDAVIS.SP_COMPUTE_USE_CASE_BREAKDOWNS(BOOLEAN)  |  created: 2026-04-20 20:29:49.183000+00:00

CREATE OR REPLACE PROCEDURE "SP_COMPUTE_USE_CASE_BREAKDOWNS"("P_INCREMENTAL" BOOLEAN DEFAULT TRUE)
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS '
DECLARE
    phase1_count INTEGER DEFAULT 0;
    phase2_count INTEGER DEFAULT 0;
    breakdown_count INTEGER DEFAULT 0;
    batch_num INTEGER DEFAULT 0;
    total_batches INTEGER DEFAULT 0;
BEGIN
    USE SCHEMA TEMP.JUSDAVIS;

    CREATE OR REPLACE TEMPORARY TABLE _uc_candidates AS
    SELECT
        uc.USE_CASE_ID, uc.ACCOUNT_ID, uc.ACCOUNT_NAME, uc.USE_CASE_NAME,
        uc.STATUS, uc.STAGE,
        LEFT(COALESCE(uc.DESCRIPTION, ''''), 500) AS DESCRIPTION_SHORT,
        LEFT(COALESCE(uc.NOTES, ''''), 2000) AS NOTES_SHORT,
        LEFT(COALESCE(uc.MEDDPICC_IDENTIFY_PAIN, ''''), 500) AS PAIN_SHORT,
        LEFT(COALESCE(uc.MEDDPICC_DECISION_CRITERIA, ''''), 500) AS DC_SHORT,
        COALESCE(uc.GO_LIVE_DATE, uc.TARGET_GO_LIVE_DATE) AS GL_DATE,
        uc.IMPLEMENTATION_START_DATE AS IMPL_START,
        uc.CREATED_DATE,
        uc.LEAD_SE,
        LEFT(COALESCE(mdm.WORKLOADS, ''''), 500) AS MDM_WORKLOADS,
        LEFT(COALESCE(mdm.TECHNICAL_USE_CASE, ''''), 500) AS MDM_TECH_UC,
        ROW_NUMBER() OVER (ORDER BY LENGTH(COALESCE(uc.NOTES,'''')) DESC, uc.USE_CASE_ID) AS rn
    FROM BKMNG_USE_CASES uc
    LEFT JOIN MDM.MDM_INTERFACES.DIM_USE_CASE mdm ON mdm.USE_CASE_ID = uc.USE_CASE_ID
    WHERE uc.STATUS IN (''In Pursuit'', ''Implementation'')
      AND (
        NOT :P_INCREMENTAL
        OR uc.USE_CASE_ID NOT IN (SELECT DISTINCT USE_CASE_ID FROM BKMNG_USE_CASE_BREAKDOWNS)
        OR uc.LAST_MODIFIED_DATE > (SELECT MAX(COMPUTED_AT) FROM BKMNG_USE_CASE_BREAKDOWNS WHERE USE_CASE_ID = uc.USE_CASE_ID)
      );

    SELECT CEIL(COUNT(*) / 50.0) INTO :total_batches FROM _uc_candidates;

    IF (:total_batches = 0) THEN
        RETURN ''No new or updated use cases to process'';
    END IF;

    CREATE OR REPLACE TEMPORARY TABLE _uc_phase1_scores (
        USE_CASE_ID VARCHAR(18), ACCOUNT_ID VARCHAR(18), ACCOUNT_NAME VARCHAR(500),
        USE_CASE_NAME VARCHAR(500), STATUS VARCHAR(100), STAGE VARCHAR(255),
        DESCRIPTION_SHORT VARCHAR(500), NOTES_SHORT VARCHAR(2000),
        PAIN_SHORT VARCHAR(500), DC_SHORT VARCHAR(500),
        GL_DATE DATE, IMPL_START DATE, CREATED_DATE DATE, LEAD_SE VARCHAR(255),
        MDM_WORKLOADS VARCHAR(500), MDM_TECH_UC VARCHAR(500),
        SPLITTABILITY_SCORE FLOAT, SPLITTABILITY_REASON VARCHAR(2000)
    );

    LET triage_tmpl VARCHAR := (
        SELECT PROMPT_TEMPLATE FROM BKMNG_EVAL_FRAMEWORK
        WHERE FRAMEWORK_ID = ''phase1_triage'' AND IS_ACTIVE = TRUE LIMIT 1
    );

    FOR batch_num IN 0 TO :total_batches - 1 DO
        LET lo INTEGER := batch_num * 50 + 1;
        LET hi INTEGER := (batch_num + 1) * 50;

        INSERT INTO _uc_phase1_scores
        SELECT
            a.USE_CASE_ID, a.ACCOUNT_ID, a.ACCOUNT_NAME, a.USE_CASE_NAME,
            a.STATUS, a.STAGE, a.DESCRIPTION_SHORT, a.NOTES_SHORT,
            a.PAIN_SHORT, a.DC_SHORT, a.GL_DATE, a.IMPL_START, a.CREATED_DATE, a.LEAD_SE,
            a.MDM_WORKLOADS, a.MDM_TECH_UC,
            TRY_CAST(TRIM(SPLIT_PART(resp, ''|'', 1)) AS FLOAT),
            TRIM(SPLIT_PART(resp, ''|'', 2))
        FROM (
            SELECT a.*,
                TRIM(SNOWFLAKE.CORTEX.COMPLETE(''llama3.1-70b'',
                    :triage_tmpl
                    || ''\\n\\nUse Case: "'' || a.USE_CASE_NAME || ''"''
                    || ''\\nAccount: '' || a.ACCOUNT_NAME
                    || ''\\nStatus: '' || a.STATUS || '' / '' || a.STAGE
                    || ''\\nMDM Workloads: '' || CASE WHEN a.MDM_WORKLOADS = '''' THEN ''N/A'' ELSE a.MDM_WORKLOADS END
                    || ''\\nMDM Technical UC: '' || CASE WHEN a.MDM_TECH_UC = '''' THEN ''N/A'' ELSE a.MDM_TECH_UC END
                    || ''\\nDescription: '' || CASE WHEN a.DESCRIPTION_SHORT = '''' THEN ''none'' ELSE a.DESCRIPTION_SHORT END
                    || ''\\nNotes: '' || CASE WHEN a.NOTES_SHORT = '''' THEN ''none'' ELSE a.NOTES_SHORT END
                    || ''\\nPain: '' || CASE WHEN a.PAIN_SHORT = '''' THEN ''none'' ELSE a.PAIN_SHORT END
                )) AS resp
            FROM _uc_candidates a
            WHERE a.rn BETWEEN :lo AND :hi
        ) a;
    END FOR;

    SELECT COUNT(*) INTO :phase1_count FROM _uc_phase1_scores WHERE SPLITTABILITY_SCORE IS NOT NULL;

    LET criteria_text VARCHAR := (
        SELECT LISTAGG(FRAMEWORK_ID || '': '' || LABEL || '' (wt '' || WEIGHT || '')'', ''; '')
            WITHIN GROUP (ORDER BY WEIGHT DESC)
        FROM BKMNG_EVAL_FRAMEWORK
        WHERE CATEGORY = ''splittability'' AND IS_ACTIVE = TRUE
    );

    CREATE OR REPLACE TEMPORARY TABLE _uc_phase2_breakdowns AS
    WITH high_scorers AS (
        SELECT * FROM _uc_phase1_scores WHERE SPLITTABILITY_SCORE >= 5
    ),
    gong_context AS (
        SELECT i.ACCOUNT_ID,
            LEFT(LISTAGG(LEFT(i.TITLE || '': '' || COALESCE(i.SUMMARY, ''''), 300), ''\\n'')
                WITHIN GROUP (ORDER BY i.INTERACTION_DATE DESC), 2000) AS recent_calls
        FROM BKMNG_ONT_INTERACTIONS i
        INNER JOIN high_scorers hs ON hs.ACCOUNT_ID = i.ACCOUNT_ID
        WHERE i.INTERACTION_DATE >= DATEADD(''day'', -90, CURRENT_DATE())
        GROUP BY i.ACCOUNT_ID
    )
    SELECT
        h.USE_CASE_ID, h.ACCOUNT_ID, h.ACCOUNT_NAME, h.USE_CASE_NAME,
        h.SPLITTABILITY_SCORE, h.SPLITTABILITY_REASON,
        TRIM(SNOWFLAKE.CORTEX.COMPLETE(''llama3.1-70b'',
            ''You are a Snowflake field engineering analyst. Split this large use case into 2-5 smaller, independently trackable sub-use-cases. ''
            || ''Each sub-UC maps to ONE workload and ONE technical use case type.\\n''
            || ''CRITERIA: '' || :criteria_text
            || ''\\nWORKLOADS: Data Engineering; AI/ML; Data Warehouse/Analytics; Data Lake; Data Sharing; Applications/SPCS''
            || ''\\nTECH UCs: EDW Migration; Data Lake; Real-Time/Streaming; ML/AI Model Training; Data Sharing/Exchange; Data Engineering; BI/Analytics Modernization; Data Applications; Data Mesh/Governance; Cost Optimization''
            || ''\\n\\nPARENT: "'' || h.USE_CASE_NAME || ''" at '' || h.ACCOUNT_NAME
            || '' ('' || h.STATUS || ''/'' || h.STAGE || '', GL: '' || COALESCE(h.GL_DATE::VARCHAR, ''N/A'') || '')''
            || ''\\nImpl Start: '' || COALESCE(h.IMPL_START::VARCHAR, ''not set'')
            || ''\\nCreated: '' || COALESCE(h.CREATED_DATE::VARCHAR, ''N/A'')
            || ''\\nMDM Workloads: '' || CASE WHEN h.MDM_WORKLOADS = '''' THEN ''N/A'' ELSE h.MDM_WORKLOADS END
            || ''\\nDesc: '' || CASE WHEN h.DESCRIPTION_SHORT = '''' THEN ''none'' ELSE h.DESCRIPTION_SHORT END
            || ''\\nNotes: '' || CASE WHEN h.NOTES_SHORT = '''' THEN ''none'' ELSE h.NOTES_SHORT END
            || ''\\nPain: '' || CASE WHEN h.PAIN_SHORT = '''' THEN ''none'' ELSE h.PAIN_SHORT END
            || ''\\nDC: '' || CASE WHEN h.DC_SHORT = '''' THEN ''none'' ELSE h.DC_SHORT END
            || ''\\nGong: '' || COALESCE(LEFT(gc.recent_calls, 800), ''none'')
            || ''\\n\\nFor each sub-UC, estimate working days for a small SE-supported team. Guidelines: small=10-20 days, medium=20-45 days, large=45-90 days.''
            || ''\\nAlso indicate dependency: which sub-UC index (1-based) must complete first, or 0 if it can start immediately (parallel).''
            || ''\\n\\nOutput EACH sub-UC as one line: SUB_NAME|WORKLOAD|TECHNICAL_USE_CASE|RATIONALE|EFFORT|KEY_ACTIVITIES|EST_DAYS|DEPENDS_ON''
            || ''\\nEST_DAYS=integer working days. DEPENDS_ON=0 for no dependency, or the 1-based index of the sub-UC that must finish first.''
            || ''\\nThen: OVERALL|1-2 sentence split rationale''
            || ''\\nThen: SCORES|multi_workload:N,multi_technical_uc:N,long_notes_complexity:N,multiple_go_lives:N,distinct_stakeholders:N,name_signals:N''
        )) AS raw_response
    FROM high_scorers h
    LEFT JOIN gong_context gc ON gc.ACCOUNT_ID = h.ACCOUNT_ID;

    SELECT COUNT(*) INTO :phase2_count FROM _uc_phase2_breakdowns;

    DELETE FROM BKMNG_USE_CASE_BREAKDOWNS
    WHERE USE_CASE_ID IN (SELECT USE_CASE_ID FROM _uc_phase2_breakdowns);

    INSERT INTO BKMNG_USE_CASE_BREAKDOWNS
        (BREAKDOWN_ID, USE_CASE_ID, ACCOUNT_ID, ACCOUNT_NAME, PARENT_USE_CASE_NAME,
         SPLITTABILITY_SCORE, SPLITTABILITY_REASON, SUB_USE_CASE_INDEX, SUB_USE_CASE_NAME,
         SUB_WORKLOAD, SUB_TECHNICAL_USE_CASE, SUB_RATIONALE, SUB_ESTIMATED_EFFORT,
         SUB_KEY_ACTIVITIES, TOTAL_SUB_USE_CASES, OVERALL_RATIONALE, CRITERIA_SCORES,
         STATUS, COMPUTED_AT, SUB_ESTIMATED_DAYS, SUB_DEPENDENCY_INDEX)
    WITH parsed_lines AS (
        SELECT b.USE_CASE_ID, b.ACCOUNT_ID, b.ACCOUNT_NAME, b.USE_CASE_NAME,
            b.SPLITTABILITY_SCORE, b.SPLITTABILITY_REASON,
            f.INDEX AS line_idx, TRIM(f.VALUE::VARCHAR) AS line_text
        FROM _uc_phase2_breakdowns b,
            LATERAL FLATTEN(input => SPLIT(b.raw_response, ''\\n'')) f
        WHERE TRIM(f.VALUE::VARCHAR) <> ''''
    ),
    overall_line AS (
        SELECT USE_CASE_ID, TRIM(SUBSTR(line_text, 9)) AS overall_rationale
        FROM parsed_lines WHERE line_text ILIKE ''OVERALL|%''
    ),
    scores_line AS (
        SELECT USE_CASE_ID, TRIM(SUBSTR(line_text, 8)) AS criteria_scores
        FROM parsed_lines WHERE line_text ILIKE ''SCORES|%''
    ),
    sub_lines AS (
        SELECT p.USE_CASE_ID, p.ACCOUNT_ID, p.ACCOUNT_NAME, p.USE_CASE_NAME,
            p.SPLITTABILITY_SCORE, p.SPLITTABILITY_REASON,
            ROW_NUMBER() OVER (PARTITION BY p.USE_CASE_ID ORDER BY p.line_idx) AS sub_idx,
            TRIM(SPLIT_PART(p.line_text, ''|'', 1)) AS sub_name,
            TRIM(SPLIT_PART(p.line_text, ''|'', 2)) AS sub_workload,
            TRIM(SPLIT_PART(p.line_text, ''|'', 3)) AS sub_tech_uc,
            TRIM(SPLIT_PART(p.line_text, ''|'', 4)) AS sub_rationale,
            TRIM(SPLIT_PART(p.line_text, ''|'', 5)) AS sub_effort,
            TRIM(SPLIT_PART(p.line_text, ''|'', 6)) AS sub_activities,
            TRY_CAST(TRIM(SPLIT_PART(p.line_text, ''|'', 7)) AS NUMBER) AS sub_est_days,
            TRY_CAST(TRIM(SPLIT_PART(p.line_text, ''|'', 8)) AS NUMBER) AS sub_dep_idx
        FROM parsed_lines p
        WHERE p.line_text NOT ILIKE ''OVERALL|%'' AND p.line_text NOT ILIKE ''SCORES|%''
          AND ARRAY_SIZE(SPLIT(p.line_text, ''|'')) >= 4
          AND p.line_text NOT ILIKE ''SUB_NAME|%''
    ),
    sub_counts AS (
        SELECT USE_CASE_ID, COUNT(*) AS total_subs FROM sub_lines GROUP BY USE_CASE_ID
    )
    SELECT
        s.USE_CASE_ID || ''-'' || s.sub_idx,
        s.USE_CASE_ID, s.ACCOUNT_ID, s.ACCOUNT_NAME, s.USE_CASE_NAME,
        s.SPLITTABILITY_SCORE, s.SPLITTABILITY_REASON,
        s.sub_idx, s.sub_name, s.sub_workload, s.sub_tech_uc,
        s.sub_rationale, s.sub_effort, s.sub_activities,
        sc.total_subs, ol.overall_rationale, sl.criteria_scores,
        ''suggested'', CURRENT_TIMESTAMP(),
        s.sub_est_days, s.sub_dep_idx
    FROM sub_lines s
    LEFT JOIN sub_counts sc ON sc.USE_CASE_ID = s.USE_CASE_ID
    LEFT JOIN overall_line ol ON ol.USE_CASE_ID = s.USE_CASE_ID
    LEFT JOIN scores_line sl ON sl.USE_CASE_ID = s.USE_CASE_ID;

    SELECT COUNT(*) INTO :breakdown_count FROM BKMNG_USE_CASE_BREAKDOWNS;

    DROP TABLE IF EXISTS _uc_candidates;
    DROP TABLE IF EXISTS _uc_phase1_scores;
    DROP TABLE IF EXISTS _uc_phase2_breakdowns;

    RETURN ''Phase1: '' || :phase1_count || '' scored, Phase2: '' || :phase2_count
        || '' analyzed, Breakdowns: '' || :breakdown_count || '' total rows'';
END;
';
