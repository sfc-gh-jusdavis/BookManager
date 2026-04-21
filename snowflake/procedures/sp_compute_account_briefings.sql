-- PROCEDURE: TEMP.JUSDAVIS.SP_COMPUTE_ACCOUNT_BRIEFINGS()  |  created: 2026-04-08 18:30:35.253000+00:00

CREATE OR REPLACE PROCEDURE "SP_COMPUTE_ACCOUNT_BRIEFINGS"()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS '
DECLARE
  processed_count NUMBER DEFAULT 0;
  acct_cursor CURSOR FOR
    SELECT
      a.ACCOUNT_ID,
      a.ACCOUNT_NAME,
      a.ACE_ASSIGNED,
      a.INDUSTRY,
      a.REGION,
      COALESCE(a.CONTRACT_UTILIZATION_PCT, 0) AS UTIL_PCT,
      COALESCE(a.WOW_PCT_CHANGE, 0) AS WOW_PCT,
      COALESCE(a.MOM_PCT_CHANGE, 0) AS MOM_PCT,
      a.DAYS_SINCE_LAST_INTERACTION,
      a.IMPL_USE_CASE_COUNT,
      a.ACTIVE_USE_CASE_COUNT
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    WHERE a.ACCOUNT_ID IN (
      SELECT DISTINCT ACCOUNT_ID FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS WHERE SOURCE = ''core''
    )
    OR a.ACCOUNT_ID IN (
      SELECT DISTINCT ACCOUNT_ID FROM TEMP.JUSDAVIS.BKMNG_COMPOSITE_PATTERNS
    )
    ORDER BY a.HEALTH_SCORE ASC NULLS LAST
    LIMIT 200;

  v_account_id VARCHAR;
  v_account_name VARCHAR;
  v_ace_email VARCHAR;
  v_industry VARCHAR;
  v_region VARCHAR;
  v_util_pct FLOAT;
  v_wow_pct FLOAT;
  v_mom_pct FLOAT;
  v_days_since NUMBER;
  v_impl_count NUMBER;
  v_active_count NUMBER;

  v_signals_text VARCHAR;
  v_patterns_text VARCHAR;
  v_gong_text VARCHAR;
  v_usecases_text VARCHAR;
  v_context_text VARCHAR;
  v_context_used BOOLEAN;
  v_gong_calls_used NUMBER;

  v_prompt VARCHAR;
  v_llm_result VARCHAR;
  v_json_str VARCHAR;

  v_situation_summary VARCHAR;
  v_top_risk VARCHAR;
  v_top_opportunity VARCHAR;
  v_recommended_actions VARCHAR;
  v_talking_points VARCHAR;
  v_key_questions VARCHAR;
  v_signals_used VARCHAR;

BEGIN
  TRUNCATE TABLE TEMP.JUSDAVIS.BKMNG_ACCOUNT_BRIEFINGS;

  OPEN acct_cursor;

  FOR acct_rec IN acct_cursor DO
    v_account_id := acct_rec.ACCOUNT_ID;
    v_account_name := acct_rec.ACCOUNT_NAME;
    v_ace_email := acct_rec.ACE_ASSIGNED;
    v_industry := acct_rec.INDUSTRY;
    v_region := acct_rec.REGION;
    v_util_pct := acct_rec.UTIL_PCT;
    v_wow_pct := acct_rec.WOW_PCT;
    v_mom_pct := acct_rec.MOM_PCT;
    v_days_since := acct_rec.DAYS_SINCE_LAST_INTERACTION;
    v_impl_count := acct_rec.IMPL_USE_CASE_COUNT;
    v_active_count := acct_rec.ACTIVE_USE_CASE_COUNT;

    -- Gather signals
    SELECT COALESCE(LISTAGG(''• '' || SIGNAL_TYPE || '' ('' || PRIORITY || ''): '' || LEFT(SIGNAL_TEXT, 100), CHR(10)) WITHIN GROUP (ORDER BY CASE PRIORITY WHEN ''high'' THEN 0 WHEN ''medium'' THEN 1 ELSE 2 END), ''None'')
    INTO v_signals_text
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
    WHERE ACCOUNT_ID = v_account_id
    LIMIT 8;

    -- Gather composite patterns
    SELECT COALESCE(LISTAGG(''• '' || PATTERN_NAME || '' ('' || SEVERITY || ''): '' || LEFT(DESCRIPTION, 150), CHR(10)) WITHIN GROUP (ORDER BY CASE SEVERITY WHEN ''critical'' THEN 0 WHEN ''high'' THEN 1 ELSE 2 END), ''None'')
    INTO v_patterns_text
    FROM TEMP.JUSDAVIS.BKMNG_COMPOSITE_PATTERNS
    WHERE ACCOUNT_ID = v_account_id
    LIMIT 5;

    -- Gather recent Gong calls
    SELECT COALESCE(
      LISTAGG(
        LEFT(TO_CHAR(INTERACTION_DATE::DATE), 10) || '': '' || COALESCE(TITLE, ''Call'') || ''. Summary: '' || COALESCE(LEFT(SUMMARY, 200), ''N/A''),
        CHR(10)
      ) WITHIN GROUP (ORDER BY INTERACTION_DATE DESC),
      ''No recent calls''
    ) INTO v_gong_text
    FROM TEMP.JUSDAVIS.BKMNG_ONT_INTERACTIONS
    WHERE ACCOUNT_ID = v_account_id
    LIMIT 3;

    SELECT COUNT(*) INTO v_gong_calls_used
    FROM TEMP.JUSDAVIS.BKMNG_ONT_INTERACTIONS
    WHERE ACCOUNT_ID = v_account_id
    LIMIT 3;

    -- Gather use cases
    SELECT COALESCE(LISTAGG(''• '' || USE_CASE_NAME || '' ['' || STAGE || ''/'' || STATUS || '']'' || CASE WHEN DAYS_IN_CURRENT_STAGE IS NOT NULL THEN '' '' || DAYS_IN_CURRENT_STAGE || ''d in stage'' ELSE '''' END, CHR(10)) WITHIN GROUP (ORDER BY STATUS), ''None'')
    INTO v_usecases_text
    FROM TEMP.JUSDAVIS.BKMNG_ONT_USE_CASES
    WHERE ACCOUNT_ID = v_account_id
    LIMIT 5;

    -- Gather user context
    SELECT COALESCE(LISTAGG(''• '' || TO_CHAR(CREATED_AT::DATE) || '' ('' || SOURCE_TYPE || ''): '' || COALESCE(PARSED_SUMMARY, LEFT(RAW_CONTENT, 150)), CHR(10)) WITHIN GROUP (ORDER BY CREATED_AT DESC), ''No SE notes added'')
    INTO v_context_text
    FROM TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
    WHERE ACCOUNT_ID = v_account_id AND IS_ACTIVE = TRUE
    LIMIT 5;

    SELECT COUNT(*) > 0 INTO v_context_used
    FROM TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
    WHERE ACCOUNT_ID = v_account_id AND IS_ACTIVE = TRUE;

    -- Build prompt
    v_prompt := ''You are an AI assistant for a Snowflake Activation Sales Engineer.
Given the following data about an account, produce a structured briefing.

ACCOUNT: '' || v_account_name || ''
INDUSTRY: '' || COALESCE(v_industry, ''?'') || '' | REGION: '' || COALESCE(v_region, ''?'') || ''
UTILIZATION: '' || ROUND(v_util_pct) || ''% | WoW: '' || ROUND(v_wow_pct, 1) || ''% | MoM: '' || ROUND(v_mom_pct, 1) || ''%
DAYS SINCE LAST INTERACTION: '' || COALESCE(v_days_since::VARCHAR, ''?'') || ''
ACTIVE USE CASES: '' || v_active_count || '' | IN IMPLEMENTATION: '' || v_impl_count || ''

ACTIVE SITUATIONS:
'' || v_patterns_text || ''

SIGNALS:
'' || v_signals_text || ''

RECENT GONG CALLS:
'' || LEFT(v_gong_text, 800) || ''

USE CASES:
'' || v_usecases_text || ''

SE NOTES & CONTEXT:
'' || LEFT(v_context_text, 600) || ''

Respond with ONLY this JSON:
{
  "situation_summary": "2-3 sentences: what is happening at this account right now",
  "top_risk": "the single biggest risk with specific context",
  "top_opportunity": "the single biggest opportunity with specific context",
  "recommended_actions": [{"action": "specific action", "rationale": "why", "urgency": "now|this_week|this_month"}],
  "talking_points": ["point for next conversation"],
  "key_questions": ["question the SE should investigate"]
}

Be specific. Reference actual data. Do not fabricate. Return only JSON.'';

    -- Call LLM
    SELECT SNOWFLAKE.CORTEX.COMPLETE(''llama3.1-70b'', v_prompt) INTO v_llm_result;

    -- Parse JSON fields with safe extraction
    v_situation_summary := TRY_PARSE_JSON(REGEXP_SUBSTR(v_llm_result, ''\\{.*\\}'', 1, 1, ''e'')):situation_summary::VARCHAR;
    v_top_risk := TRY_PARSE_JSON(REGEXP_SUBSTR(v_llm_result, ''\\{.*\\}'', 1, 1, ''e'')):top_risk::VARCHAR;
    v_top_opportunity := TRY_PARSE_JSON(REGEXP_SUBSTR(v_llm_result, ''\\{.*\\}'', 1, 1, ''e'')):top_opportunity::VARCHAR;
    v_recommended_actions := TRY_PARSE_JSON(REGEXP_SUBSTR(v_llm_result, ''\\{.*\\}'', 1, 1, ''e'')):recommended_actions::VARCHAR;
    v_talking_points := TRY_PARSE_JSON(REGEXP_SUBSTR(v_llm_result, ''\\{.*\\}'', 1, 1, ''e'')):talking_points::VARCHAR;
    v_key_questions := TRY_PARSE_JSON(REGEXP_SUBSTR(v_llm_result, ''\\{.*\\}'', 1, 1, ''e'')):key_questions::VARCHAR;
    v_signals_used := v_signals_text;

    -- Insert briefing
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ACCOUNT_BRIEFINGS (
      ACCOUNT_ID, ACCOUNT_NAME, ACE_EMAIL,
      SITUATION_SUMMARY, TOP_RISK, TOP_OPPORTUNITY,
      RECOMMENDED_ACTIONS, TALKING_POINTS, KEY_QUESTIONS,
      SIGNALS_USED, CONTEXT_USED, GONG_CALLS_USED, MODEL_USED
    ) VALUES (
      v_account_id, v_account_name, v_ace_email,
      v_situation_summary, v_top_risk, v_top_opportunity,
      v_recommended_actions, v_talking_points, v_key_questions,
      LEFT(v_signals_used, 2000), v_context_used, v_gong_calls_used, ''llama3.1-70b''
    );

    processed_count := processed_count + 1;

  END FOR;

  CLOSE acct_cursor;

  RETURN ''Briefings generated: '' || processed_count;
END;
';
