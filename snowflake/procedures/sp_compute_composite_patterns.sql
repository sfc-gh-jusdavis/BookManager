-- PROCEDURE: TEMP.JUSDAVIS.SP_COMPUTE_COMPOSITE_PATTERNS()  |  created: 2026-04-08 18:18:23.073000+00:00

CREATE OR REPLACE PROCEDURE "SP_COMPUTE_COMPOSITE_PATTERNS"()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS '
BEGIN
  TRUNCATE TABLE TEMP.JUSDAVIS.BKMNG_COMPOSITE_PATTERNS;

  -- Build signal presence CTEs then insert pattern rows

  INSERT INTO TEMP.JUSDAVIS.BKMNG_COMPOSITE_PATTERNS
    (PATTERN_ID, ACCOUNT_ID, ACCOUNT_NAME, ACE_EMAIL, PATTERN_NAME,
     CATEGORY, SEVERITY, DESCRIPTION, RECOMMENDED_ACTION,
     TALKING_POINTS, COMPONENT_SIGNALS)
  WITH

  -- Signal presence flags per account
  sig AS (
    SELECT ACCOUNT_ID,
      MAX(CASE WHEN SIGNAL_TYPE = ''no_interaction_14d''  THEN 1 ELSE 0 END) AS HAS_NO_INTERACT_14D,
      MAX(CASE WHEN SIGNAL_TYPE = ''no_interaction_7d''   THEN 1 ELSE 0 END) AS HAS_NO_INTERACT_7D,
      MAX(CASE WHEN SIGNAL_TYPE = ''email_silence''       THEN 1 ELSE 0 END) AS HAS_EMAIL_SILENCE,
      MAX(CASE WHEN SIGNAL_TYPE = ''email_declining''     THEN 1 ELSE 0 END) AS HAS_EMAIL_DECLINING,
      MAX(CASE WHEN SIGNAL_TYPE = ''go_live_approaching'' THEN 1 ELSE 0 END) AS HAS_GO_LIVE_APPROACHING,
      MAX(CASE WHEN SIGNAL_TYPE = ''open_tmr''            THEN 1 ELSE 0 END) AS HAS_OPEN_TMR,
      MAX(CASE WHEN SIGNAL_TYPE = ''blocker''             THEN 1 ELSE 0 END) AS HAS_BLOCKER,
      MAX(CASE WHEN SIGNAL_TYPE = ''champion_silent''     THEN 1 ELSE 0 END) AS HAS_CHAMPION_SILENT,
      MAX(CASE WHEN SIGNAL_TYPE = ''contract_ending''     THEN 1 ELSE 0 END) AS HAS_CONTRACT_ENDING,
      MAX(CASE WHEN SIGNAL_TYPE = ''consumption_dip''     THEN 1 ELSE 0 END) AS HAS_CONSUMPTION_DIP,
      MAX(CASE WHEN SIGNAL_TYPE = ''consumption_spike''   THEN 1 ELSE 0 END) AS HAS_CONSUMPTION_SPIKE,
      MAX(CASE WHEN SIGNAL_TYPE = ''expansion_signal''    THEN 1 ELSE 0 END) AS HAS_EXPANSION,
      MAX(CASE WHEN SIGNAL_TYPE = ''new_feature_adoption'' THEN 1 ELSE 0 END) AS HAS_NEW_FEATURE,
      MAX(CASE WHEN SIGNAL_TYPE = ''stage_stalled''       THEN 1 ELSE 0 END) AS HAS_STAGE_STALLED,
      MAX(CASE WHEN SIGNAL_TYPE = ''use_case_no_dates''   THEN 1 ELSE 0 END) AS HAS_NO_DATES,
      MAX(CASE WHEN SIGNAL_TYPE = ''upcoming_meeting''    THEN 1 ELSE 0 END) AS HAS_UPCOMING_MEETING,
      MAX(CASE WHEN SIGNAL_TYPE = ''customer_frustration'' THEN 1 ELSE 0 END) AS HAS_FRUSTRATION,
      MAX(CASE WHEN SIGNAL_TYPE = ''user_reported_blocker'' THEN 1 ELSE 0 END) AS HAS_USER_BLOCKER,
      MAX(CASE WHEN SIGNAL_TYPE IN (''open_sev1_ticket'',''escalated_ticket'') THEN 1 ELSE 0 END) AS HAS_SUPPORT_ESCALATION,
      MAX(CASE WHEN SIGNAL_TYPE = ''at_risk''             THEN 1 ELSE 0 END) AS HAS_AT_RISK
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
    WHERE SOURCE = ''core''
    GROUP BY ACCOUNT_ID
  ),

  -- Stalled count per account
  stall AS (
    SELECT ACCOUNT_ID, COUNT(*) AS STALLED_COUNT
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
    WHERE SIGNAL_TYPE = ''stage_stalled''
    GROUP BY ACCOUNT_ID
  ),

  -- Recent user context
  ctx AS (
    SELECT ACCOUNT_ID, MAX(CREATED_AT) AS LAST_CONTEXT_AT
    FROM TEMP.JUSDAVIS.BKMNG_USER_CONTEXT_V2
    WHERE IS_ACTIVE = TRUE
    GROUP BY ACCOUNT_ID
  ),

  -- Recent Gong calls
  gong AS (
    SELECT ACCOUNT_ID,
      MAX(INTERACTION_DATE) AS LAST_GONG_AT,
      COUNT(CASE WHEN INTERACTION_DATE >= DATEADD(''day'', -14, CURRENT_TIMESTAMP()) THEN 1 END) AS CALLS_14D
    FROM TEMP.JUSDAVIS.BKMNG_ONT_INTERACTIONS
    GROUP BY ACCOUNT_ID
  ),

  -- Contract days remaining
  contract AS (
    SELECT ACCOUNT_ID, DAYS_UNTIL_CONTRACT_END
    FROM TEMP.JUSDAVIS.BKMNG_A360_CONTRACT
  ),

  -- Account base
  acct AS (
    SELECT a.*,
      COALESCE(s.HAS_NO_INTERACT_14D, 0) AS HAS_NO_INTERACT_14D,
      COALESCE(s.HAS_NO_INTERACT_7D,  0) AS HAS_NO_INTERACT_7D,
      COALESCE(s.HAS_EMAIL_SILENCE,   0) AS HAS_EMAIL_SILENCE,
      COALESCE(s.HAS_EMAIL_DECLINING, 0) AS HAS_EMAIL_DECLINING,
      COALESCE(s.HAS_GO_LIVE_APPROACHING, 0) AS HAS_GO_LIVE_APPROACHING,
      COALESCE(s.HAS_OPEN_TMR,        0) AS HAS_OPEN_TMR,
      COALESCE(s.HAS_BLOCKER,         0) AS HAS_BLOCKER,
      COALESCE(s.HAS_CHAMPION_SILENT, 0) AS HAS_CHAMPION_SILENT,
      COALESCE(s.HAS_CONTRACT_ENDING, 0) AS HAS_CONTRACT_ENDING,
      COALESCE(s.HAS_CONSUMPTION_DIP, 0) AS HAS_CONSUMPTION_DIP,
      COALESCE(s.HAS_CONSUMPTION_SPIKE, 0) AS HAS_CONSUMPTION_SPIKE,
      COALESCE(s.HAS_EXPANSION,       0) AS HAS_EXPANSION,
      COALESCE(s.HAS_NEW_FEATURE,     0) AS HAS_NEW_FEATURE,
      COALESCE(s.HAS_STAGE_STALLED,   0) AS HAS_STAGE_STALLED,
      COALESCE(s.HAS_NO_DATES,        0) AS HAS_NO_DATES,
      COALESCE(s.HAS_UPCOMING_MEETING, 0) AS HAS_UPCOMING_MEETING,
      COALESCE(s.HAS_FRUSTRATION,     0) AS HAS_FRUSTRATION,
      COALESCE(s.HAS_USER_BLOCKER,    0) AS HAS_USER_BLOCKER,
      COALESCE(s.HAS_SUPPORT_ESCALATION, 0) AS HAS_SUPPORT_ESCALATION,
      COALESCE(s.HAS_AT_RISK,         0) AS HAS_AT_RISK,
      COALESCE(st.STALLED_COUNT, 0) AS STALLED_COUNT,
      ctx.LAST_CONTEXT_AT,
      gong.LAST_GONG_AT,
      COALESCE(gong.CALLS_14D, 0) AS CALLS_14D,
      c.DAYS_UNTIL_CONTRACT_END
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    LEFT JOIN sig s ON s.ACCOUNT_ID = a.ACCOUNT_ID
    LEFT JOIN stall st ON st.ACCOUNT_ID = a.ACCOUNT_ID
    LEFT JOIN ctx ON ctx.ACCOUNT_ID = a.ACCOUNT_ID
    LEFT JOIN gong ON gong.ACCOUNT_ID = a.ACCOUNT_ID
    LEFT JOIN contract c ON c.ACCOUNT_ID = a.ACCOUNT_ID
  )

  -- PATTERN 1: Account Going Dark
  SELECT
    ''going_dark_'' || ACCOUNT_ID AS PATTERN_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Account Going Dark'', ''risk'', ''critical'',
    ''No interaction in '' || COALESCE(DAYS_SINCE_LAST_INTERACTION::VARCHAR, ''14+'') || '' days, emails declining, no upcoming meeting.'',
    ''Schedule a touchpoint immediately. Consider reaching out to a secondary contact — your primary may have changed roles or priorities.'',
    ''["Reconnect on current status", "Understand any priority changes", "Confirm champion is still engaged"]'',
    ''["no_interaction_14d","email_silence","email_declining"]''
  FROM acct
  WHERE HAS_NO_INTERACT_14D = 1
    AND (HAS_EMAIL_SILENCE = 1 OR HAS_EMAIL_DECLINING = 1)
    AND UPCOMING_MEETINGS_5D = 0

  UNION ALL

  -- PATTERN 2: Go-Live at Risk
  SELECT
    ''golive_risk_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Go-Live at Risk'', ''risk'', ''critical'',
    ''Go-live approaching within 14 days with open blocker or TMR.'',
    ''Escalate blockers now. Pull in the TMR owner and your manager. Go-live date may need to slip — communicate early.'',
    ''["Go-live readiness check", "Escalation path for blockers", "Customer expectation management"]'',
    ''["go_live_approaching","blocker","open_tmr"]''
  FROM acct
  WHERE HAS_GO_LIVE_APPROACHING = 1
    AND (HAS_OPEN_TMR = 1 OR HAS_BLOCKER = 1)

  UNION ALL

  -- PATTERN 3: Champion Disengaged
  SELECT
    ''champion_disengaged_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Champion Disengaged'', ''risk'', ''high'',
    ''Champion silent during active implementation ('' || IMPL_USE_CASE_COUNT::VARCHAR || '' use case(s) in progress).'',
    ''Your champion hasn''''t been on a call in 28+ days during active implementation. Reach out directly — check if priorities shifted or there is a new decision-maker.'',
    ''["Direct champion outreach", "Verify no org changes", "Re-establish cadence"]'',
    ''["champion_silent"]''
  FROM acct
  WHERE HAS_CHAMPION_SILENT = 1
    AND IMPL_USE_CASE_COUNT > 0

  UNION ALL

  -- PATTERN 4: Renewal Risk
  SELECT
    ''renewal_risk_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Renewal Risk'', ''risk'', ''critical'',
    ''Contract renewing in '' || COALESCE(DAYS_UNTIL_CONTRACT_END::VARCHAR, ''?'') || '' days with declining or low usage ('' || COALESCE(ROUND(CONTRACT_UTILIZATION_PCT)::VARCHAR, ''?'') || ''% utilized).'',
    ''Contract renewing soon with declining usage. Build a value narrative: document wins, quantify ROI, and schedule an executive review.'',
    ''["ROI and value delivered", "Expansion opportunities", "Renewal terms discussion"]'',
    ''["contract_ending","consumption_dip"]''
  FROM acct
  WHERE HAS_CONTRACT_ENDING = 1
    AND (HAS_CONSUMPTION_DIP = 1 OR COALESCE(CONTRACT_UTILIZATION_PCT, 100) < 50)

  UNION ALL

  -- PATTERN 5: Silent Churn Signal
  SELECT
    ''silent_churn_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Silent Churn Signal'', ''risk'', ''high'',
    ''Usage declining MoM ('' || COALESCE(ROUND(MOM_PCT_CHANGE)::VARCHAR, ''?'') || ''%) with no recent customer contact.'',
    ''Usage is declining and you have no recent contact. This may indicate a shift to a competitor or internal priority change. Get a meeting on the books.'',
    ''["Usage decline root cause", "Competitive landscape check", "Value realization check-in"]'',
    ''["consumption_dip","no_interaction_14d"]''
  FROM acct
  WHERE HAS_CONSUMPTION_DIP = 1
    AND HAS_NO_INTERACT_14D = 1
    AND (LAST_CONTEXT_AT IS NULL OR LAST_CONTEXT_AT < DATEADD(''day'', -30, CURRENT_TIMESTAMP()))

  UNION ALL

  -- PATTERN 6: Support Escalation During Implementation
  SELECT
    ''support_during_impl_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Support Escalation During Implementation'', ''risk'', ''critical'',
    ''Escalated support issue during active implementation ('' || IMPL_USE_CASE_COUNT::VARCHAR || '' use case(s)).'',
    ''Join the support thread, understand the impact, and communicate timeline to the customer.'',
    ''["Support issue status", "Impact on go-live timeline", "Customer confidence reassurance"]'',
    ''["open_sev1_ticket","escalated_ticket"]''
  FROM acct
  WHERE HAS_SUPPORT_ESCALATION = 1
    AND IMPL_USE_CASE_COUNT > 0

  UNION ALL

  -- PATTERN 7: Stalled Pipeline
  SELECT
    ''stalled_pipeline_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Stalled Pipeline'', ''risk'', ''high'',
    STALLED_COUNT::VARCHAR || '' use case(s) stalled — likely systemic blocker.'',
    ''Multiple use cases stalled at this account. This suggests a systemic blocker — organizational, technical, or priority. Schedule a strategy session with the AE.'',
    ''["Root cause of stall", "Org or priority changes", "AE alignment on strategy"]'',
    ''["stage_stalled"]''
  FROM acct
  WHERE STALLED_COUNT >= 2

  UNION ALL

  -- PATTERN 8: Expansion Ready
  SELECT
    ''expansion_ready_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Expansion Ready'', ''opportunity'', ''high'',
    ''Account consuming aggressively ('' || COALESCE(ROUND(CONTRACT_UTILIZATION_PCT)::VARCHAR, ''?'') || ''% of capacity, +'' || COALESCE(ROUND(WOW_PCT_CHANGE)::VARCHAR, ''?'') || ''% WoW). Expansion signal active.'',
    ''Account is consuming aggressively and approaching capacity. Proactively discuss expansion before they hit limits. Frame as success enablement, not upsell.'',
    ''["Consumption trajectory and capacity planning", "Expansion options and pricing", "Success story and ROI"]'',
    ''["expansion_signal","consumption_spike"]''
  FROM acct
  WHERE HAS_EXPANSION = 1
    AND HAS_CONSUMPTION_SPIKE = 1
    AND COALESCE(CONTRACT_UTILIZATION_PCT, 0) > 80

  UNION ALL

  -- PATTERN 9: New Platform Adoption
  SELECT
    ''new_platform_adoption_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''New Platform Adoption'', ''opportunity'', ''medium'',
    ''Customer just adopted a new platform feature or use case area.'',
    ''Customer just adopted a new platform area. This is a land-and-expand moment. Offer a best-practices session to ensure success and deepen the relationship.'',
    ''["New feature adoption success", "Best practices for scaling", "Adjacent use cases"]'',
    ''["new_feature_adoption"]''
  FROM acct
  WHERE HAS_NEW_FEATURE = 1

  UNION ALL

  -- PATTERN 10: Momentum Building
  SELECT
    ''momentum_building_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Momentum Building'', ''opportunity'', ''medium'',
    CALLS_14D::VARCHAR || '' Gong calls in last 14 days. Strong engagement and positive consumption trend.'',
    ''Strong momentum — high engagement, consumption growing. Keep the cadence. Consider introducing additional use cases or features.'',
    ''["Success metrics and expansion potential", "Additional use case opportunities", "Executive sponsor engagement"]'',
    ''["meeting_momentum","consumption_spike"]''
  FROM acct
  WHERE CALLS_14D >= 3
    AND HAS_CONSUMPTION_SPIKE = 1

  UNION ALL

  -- PATTERN 12: Pre-Meeting Prep Available
  SELECT
    ''pre_meeting_prep_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Pre-Meeting Prep Available'', ''action_needed'', ''medium'',
    ''Meeting in ≤3 days — recent signals and context available for prep.'',
    ''You have a meeting in ≤3 days. A prep briefing is available with recent signals, Gong summaries, and recommended talking points.'',
    ''["Review recent signals before the meeting", "Prepare specific questions based on account situation"]'',
    ''["upcoming_meeting"]''
  FROM acct
  WHERE HAS_UPCOMING_MEETING = 1
    AND UPCOMING_MEETINGS_5D > 0

  UNION ALL

  -- PATTERN 13: Post-Meeting Follow-Up Due
  SELECT
    ''post_meeting_followup_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Post-Meeting Follow-Up Due'', ''action_needed'', ''medium'',
    ''Gong call recorded recently but no context logged since.'',
    ''You had a call 1-2 days ago but haven''''t logged any notes. Add quick context to keep the system current and improve your next prep.'',
    ''["Log key discussion points", "Record commitments made", "Update use case status if needed"]'',
    ''[]''
  FROM acct
  WHERE LAST_GONG_AT IS NOT NULL
    AND LAST_GONG_AT >= DATEADD(''day'', -2, CURRENT_TIMESTAMP())
    AND (LAST_CONTEXT_AT IS NULL OR LAST_CONTEXT_AT < LAST_GONG_AT)

  UNION ALL

  -- PATTERN 14: Missing Dates on Active Use Cases
  SELECT
    ''missing_dates_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Missing Dates on Active Use Cases'', ''action_needed'', ''medium'',
    ''Implementation use cases without target go-live dates — proactive signals disabled.'',
    ''Implementation use cases without target dates can''''t generate go-live signals. Update the dates in Salesforce to enable proactive tracking.'',
    ''["Confirm go-live timeline with customer", "Update Salesforce dates", "Enable go-live approaching signal"]'',
    ''["use_case_no_dates"]''
  FROM acct
  WHERE HAS_NO_DATES = 1
    AND IMPL_USE_CASE_COUNT > 0

  UNION ALL

  -- PATTERN 15: Data Gap — No Recent Context
  SELECT
    ''data_gap_'' || ACCOUNT_ID,
    ACCOUNT_ID, ACCOUNT_NAME, ACE_ASSIGNED,
    ''Data Gap — No Recent Context'', ''action_needed'', ''medium'',
    ''High signal account with no recent SE notes or Gong calls.'',
    ''This account has multiple signals but the system has limited context. Add a quick observation to improve insight quality.'',
    ''["Add recent account observation", "Log last conversation topics", "Note any changes in customer situation"]'',
    ''[]''
  FROM acct
  WHERE ACTIVE_USE_CASE_COUNT > 0
    AND (LAST_CONTEXT_AT IS NULL OR LAST_CONTEXT_AT < DATEADD(''day'', -60, CURRENT_TIMESTAMP()))
    AND (LAST_GONG_AT IS NULL OR LAST_GONG_AT < DATEADD(''day'', -30, CURRENT_TIMESTAMP()));

  -- Suppress patterns for accounts that are stopped or complete.
  -- Mirrors the signal-suppression rule in SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS.
  DELETE FROM TEMP.JUSDAVIS.BKMNG_COMPOSITE_PATTERNS
  WHERE ACCOUNT_ID IN (
      SELECT ACCOUNT_ID
      FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS
      WHERE LOWER(STATUS) IN (''stopped'', ''complete'')
  );

  RETURN ''Composite patterns computed. Rows: '' || (SELECT COUNT(*) FROM TEMP.JUSDAVIS.BKMNG_COMPOSITE_PATTERNS)::VARCHAR;
END;
';
