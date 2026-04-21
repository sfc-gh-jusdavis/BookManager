-- PROCEDURE: TEMP.JUSDAVIS.SP_COMPUTE_AI_ASSESSMENTS()  |  created: 2026-04-21 01:12:17.115000+00:00

CREATE OR REPLACE PROCEDURE "SP_COMPUTE_AI_ASSESSMENTS"()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS '
DECLARE
  row_count INTEGER DEFAULT 0;
BEGIN
  MERGE INTO TEMP.JUSDAVIS.BKMNG_AI_USE_CASE_ASSESSMENTS tgt
  USING (
    SELECT
      uc.USE_CASE_ID,
      uc.ACCOUNT_ID,
      uc.ACCOUNT_NAME,
      uc.USE_CASE_NAME,
      raw.AI_TIER,
      raw.CONFIDENCE,
      raw.RATIONALE,
      raw.RECOMMENDED_ACTIONS,
      raw.RISK_LEVEL,
      raw.OPPORTUNITY_SCORE,
      CURRENT_TIMESTAMP() AS COMPUTED_AT
    FROM TEMP.JUSDAVIS.BKMNG_ONT_USE_CASES uc
    CROSS JOIN LATERAL (
      SELECT
        LEFT(TRIM(SPLIT_PART(resp, ''|'', 1)), 20) AS AI_TIER,
        TRY_CAST(TRIM(SPLIT_PART(resp, ''|'', 2)) AS FLOAT) AS CONFIDENCE,
        TRIM(SPLIT_PART(resp, ''|'', 3)) AS RATIONALE,
        TRIM(SPLIT_PART(resp, ''|'', 4)) AS RECOMMENDED_ACTIONS,
        LEFT(TRIM(SPLIT_PART(resp, ''|'', 5)), 20) AS RISK_LEVEL,
        TRY_CAST(TRIM(SPLIT_PART(resp, ''|'', 6)) AS FLOAT) AS OPPORTUNITY_SCORE
      FROM (
        SELECT TRIM(SNOWFLAKE.CORTEX.COMPLETE(
          ''llama3.1-70b'',
          ''You are an AI that assesses Snowflake use cases for a Sales Engineer. '' ||
          ''Use case: "'' || uc.USE_CASE_NAME || ''". '' ||
          ''Account: '' || uc.ACCOUNT_NAME || ''. '' ||
          ''Stage: '' || uc.STAGE || ''. '' ||
          ''Status: '' || uc.STATUS || ''. '' ||
          ''Days in stage: '' || COALESCE(uc.DAYS_IN_CURRENT_STAGE::VARCHAR, ''N/A'') || ''. '' ||
          ''MEDDPICC score: '' || COALESCE(uc.MEDDPICC_OVERALL_SCORE::VARCHAR, ''N/A'') || ''/10. '' ||
          ''Lead SE: '' || COALESCE(uc.LEAD_SE, ''unassigned'') || ''. '' ||
          ''Go live: '' || COALESCE(uc.GO_LIVE_DATE::VARCHAR, ''not set'') || ''. '' ||
          ''Respond EXACTLY in this pipe-delimited format (no extra text): '' ||
          ''tier|confidence|rationale|recommended_actions|risk_level|opportunity_score. '' ||
          ''tier: high/medium/low. confidence: 0.0-1.0. rationale: 1 sentence. '' ||
          ''recommended_actions: top 2 actions comma-separated. risk_level: high/medium/low. '' ||
          ''opportunity_score: 0.0-10.0''
        )) AS resp
      ) tmp
    ) raw
    WHERE uc.STATUS NOT IN (''Closed'', ''Cancelled'')
  ) src
  ON tgt.USE_CASE_ID = src.USE_CASE_ID
  WHEN MATCHED THEN UPDATE SET
    tgt.ACCOUNT_ID        = src.ACCOUNT_ID,
    tgt.ACCOUNT_NAME      = src.ACCOUNT_NAME,
    tgt.USE_CASE_NAME     = src.USE_CASE_NAME,
    tgt.AI_TIER           = src.AI_TIER,
    tgt.CONFIDENCE        = src.CONFIDENCE,
    tgt.RATIONALE         = src.RATIONALE,
    tgt.RECOMMENDED_ACTIONS = src.RECOMMENDED_ACTIONS,
    tgt.RISK_LEVEL        = src.RISK_LEVEL,
    tgt.OPPORTUNITY_SCORE = src.OPPORTUNITY_SCORE,
    tgt.COMPUTED_AT       = src.COMPUTED_AT,
    tgt.REFRESHED_AT      = CURRENT_TIMESTAMP()
  WHEN NOT MATCHED THEN INSERT
    (USE_CASE_ID, ACCOUNT_ID, ACCOUNT_NAME, USE_CASE_NAME, AI_TIER, CONFIDENCE,
     RATIONALE, RECOMMENDED_ACTIONS, RISK_LEVEL, OPPORTUNITY_SCORE, COMPUTED_AT)
  VALUES
    (src.USE_CASE_ID, src.ACCOUNT_ID, src.ACCOUNT_NAME, src.USE_CASE_NAME,
     src.AI_TIER, src.CONFIDENCE, src.RATIONALE, src.RECOMMENDED_ACTIONS,
     src.RISK_LEVEL, src.OPPORTUNITY_SCORE, src.COMPUTED_AT);

  MERGE INTO TEMP.JUSDAVIS.BKMNG_AI_ACCOUNT_ASSESSMENTS tgt
  USING (
    SELECT
      a.ACCOUNT_ID,
      a.ACCOUNT_NAME,
      raw.AI_PRIORITY_SCORE,
      raw.PRIORITY_TIER,
      raw.CONFIDENCE,
      raw.RATIONALE,
      raw.RECOMMENDED_ACTIONS,
      raw.KEY_RISKS,
      raw.KEY_OPPORTUNITIES,
      CURRENT_TIMESTAMP() AS COMPUTED_AT
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    LEFT JOIN (
      SELECT ACCOUNT_ID,
        SUM(CASE WHEN PRIORITY = ''high'' THEN 1 ELSE 0 END)   AS HIGH_SIGS,
        SUM(CASE WHEN PRIORITY = ''medium'' THEN 1 ELSE 0 END) AS MED_SIGS,
        COUNT(*)                                               AS TOTAL_SIGS,
        LISTAGG(SIGNAL_TYPE, '', '') WITHIN GROUP (ORDER BY PRIORITY, SIGNAL_TYPE) AS SIG_TYPES
      FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
      GROUP BY ACCOUNT_ID
    ) s ON s.ACCOUNT_ID = a.ACCOUNT_ID
    CROSS JOIN LATERAL (
      SELECT
        TRY_CAST(TRIM(SPLIT_PART(resp, ''|'', 1)) AS FLOAT)  AS AI_PRIORITY_SCORE,
        LEFT(TRIM(SPLIT_PART(resp, ''|'', 2)), 20)            AS PRIORITY_TIER,
        TRY_CAST(TRIM(SPLIT_PART(resp, ''|'', 3)) AS FLOAT)  AS CONFIDENCE,
        TRIM(SPLIT_PART(resp, ''|'', 4))                      AS RATIONALE,
        TRIM(SPLIT_PART(resp, ''|'', 5))                      AS RECOMMENDED_ACTIONS,
        TRIM(SPLIT_PART(resp, ''|'', 6))                      AS KEY_RISKS,
        TRIM(SPLIT_PART(resp, ''|'', 7))                      AS KEY_OPPORTUNITIES
      FROM (
        SELECT TRIM(SNOWFLAKE.CORTEX.COMPLETE(
          ''llama3.1-70b'',
          ''You are an AI that scores accounts for a Snowflake SE. '' ||
          ''Account: '' || a.ACCOUNT_NAME || ''. '' ||
          ''Engagement: '' || COALESCE(a.ENGAGEMENT_STATUS, ''Unknown'') || ''. '' ||
          ''Status: '' || COALESCE(a.STATUS, ''Unknown'') || ''. '' ||
          ''Health score: '' || COALESCE(a.HEALTH_SCORE::VARCHAR, ''N/A'') || ''/100. '' ||
          ''Momentum: '' || COALESCE(a.MOMENTUM, ''unknown'') || ''. '' ||
          ''WoW consumption: '' || COALESCE(ROUND(a.WOW_PCT_CHANGE, 1)::VARCHAR, ''N/A'') || ''%. '' ||
          ''Active use cases: '' || COALESCE(a.ACTIVE_USE_CASE_COUNT::VARCHAR, ''0'') || ''. '' ||
          ''High signals: '' || COALESCE(s.HIGH_SIGS::VARCHAR, ''0'') || ''. '' ||
          ''Signal types: '' || COALESCE(s.SIG_TYPES, ''none'') || ''. '' ||
          ''Respond EXACTLY in this pipe-delimited format (no extra text): '' ||
          ''priority_score|priority_tier|confidence|rationale|recommended_actions|key_risks|key_opportunities. '' ||
          ''priority_score: 0.0-10.0. priority_tier: critical/high/medium/low. '' ||
          ''confidence: 0.0-1.0. rationale: 1 sentence. '' ||
          ''recommended_actions: top 2 actions comma-separated. '' ||
          ''key_risks: top risk in 1 phrase. key_opportunities: top opportunity in 1 phrase.''
        )) AS resp
      ) tmp
    ) raw
    WHERE a.ENGAGEMENT_STATUS NOT IN (''Churned'')
  ) src
  ON tgt.ACCOUNT_ID = src.ACCOUNT_ID
  WHEN MATCHED THEN UPDATE SET
    tgt.ACCOUNT_NAME        = src.ACCOUNT_NAME,
    tgt.AI_PRIORITY_SCORE   = src.AI_PRIORITY_SCORE,
    tgt.PRIORITY_TIER       = src.PRIORITY_TIER,
    tgt.CONFIDENCE          = src.CONFIDENCE,
    tgt.RATIONALE           = src.RATIONALE,
    tgt.RECOMMENDED_ACTIONS = src.RECOMMENDED_ACTIONS,
    tgt.KEY_RISKS           = src.KEY_RISKS,
    tgt.KEY_OPPORTUNITIES   = src.KEY_OPPORTUNITIES,
    tgt.COMPUTED_AT         = src.COMPUTED_AT,
    tgt.REFRESHED_AT        = CURRENT_TIMESTAMP()
  WHEN NOT MATCHED THEN INSERT
    (ACCOUNT_ID, ACCOUNT_NAME, AI_PRIORITY_SCORE, PRIORITY_TIER, CONFIDENCE,
     RATIONALE, RECOMMENDED_ACTIONS, KEY_RISKS, KEY_OPPORTUNITIES, COMPUTED_AT)
  VALUES
    (src.ACCOUNT_ID, src.ACCOUNT_NAME, src.AI_PRIORITY_SCORE, src.PRIORITY_TIER,
     src.CONFIDENCE, src.RATIONALE, src.RECOMMENDED_ACTIONS, src.KEY_RISKS,
     src.KEY_OPPORTUNITIES, src.COMPUTED_AT);

  SELECT COUNT(*) INTO row_count FROM TEMP.JUSDAVIS.BKMNG_AI_USE_CASE_ASSESSMENTS;
  RETURN ''OK: '' || row_count::VARCHAR || '' use case assessments, '' ||
    (SELECT COUNT(*)::VARCHAR FROM TEMP.JUSDAVIS.BKMNG_AI_ACCOUNT_ASSESSMENTS) || '' account assessments'';
END;
';
