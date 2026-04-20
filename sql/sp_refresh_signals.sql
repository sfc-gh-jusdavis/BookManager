CREATE OR REPLACE PROCEDURE TEMP.JUSDAVIS.SP_REFRESH_BKMNG_ONT_ACCOUNT_SIGNALS()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
BEGIN
    DELETE FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS WHERE SOURCE = 'core';

    -- blocker
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'blocker-' || uc.USE_CASE_ID,
        uc.ACCOUNT_ID, uc.ACCOUNT_NAME, 'blocker', 'high',
        '"' || uc.USE_CASE_NAME || '" is blocked',
        'Stage: ' || COALESCE(uc.STAGE, 'Unknown') || '. MEDDPICC: ' || COALESCE(uc.MEDDPICC_OVERALL_SCORE::VARCHAR, 'N/A') || '. Lead SE: ' || COALESCE(uc.LEAD_SE, 'Unknown') || '. Days in stage: ' || COALESCE(uc.DAYS_IN_CURRENT_STAGE::VARCHAR, 'Unknown'),
        'use_case', uc.USE_CASE_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_USE_CASES uc
    WHERE uc.STATUS = 'Blocked';

    -- at_risk
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'at_risk-' || a.ACCOUNT_ID,
        a.ACCOUNT_ID, a.ACCOUNT_NAME, 'at_risk', 'medium',
        a.ACCOUNT_NAME || ' is marked At Risk',
        'Health score: ' || COALESCE(a.HEALTH_SCORE::VARCHAR, 'N/A') || '/100. Momentum: ' || COALESCE(a.MOMENTUM, 'unknown') || '. Last call: ' || COALESCE(a.LAST_EXTERNAL_INTERACTION_DATE::VARCHAR, 'never') || ' (' || COALESCE(a.DAYS_SINCE_LAST_INTERACTION::VARCHAR, 'N/A') || 'd ago). Active use cases: ' || COALESCE(a.ACTIVE_USE_CASE_COUNT::VARCHAR, '0'),
        'account', a.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    WHERE a.ENGAGEMENT_STATUS = 'At Risk';

    -- go_live_approaching
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'go_live_approaching-' || uc.USE_CASE_ID,
        uc.ACCOUNT_ID, uc.ACCOUNT_NAME, 'go_live_approaching', 'medium',
        '"' || uc.USE_CASE_NAME || '" go-live in ' || DATEDIFF('day', CURRENT_DATE(), COALESCE(uc.GO_LIVE_DATE, uc.TARGET_GO_LIVE_DATE))::VARCHAR || ' days',
        'Go-live: ' || COALESCE(uc.GO_LIVE_DATE::VARCHAR, uc.TARGET_GO_LIVE_DATE::VARCHAR) || '. Stage: ' || COALESCE(uc.STAGE, 'Unknown') || '. MEDDPICC: ' || COALESCE(uc.MEDDPICC_OVERALL_SCORE::VARCHAR, 'N/A') || '. Velocity: ' || uc.STAGE_VELOCITY || '. Lead: ' || COALESCE(uc.LEAD_SE, 'Unknown'),
        'use_case', uc.USE_CASE_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_USE_CASES uc
    WHERE uc.STATUS = 'Implementation'
      AND COALESCE(uc.GO_LIVE_DATE, uc.TARGET_GO_LIVE_DATE) BETWEEN CURRENT_DATE() AND DATEADD('day', 30, CURRENT_DATE());

    -- open_tmr
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'open_tmr-' || t.TMR_ID,
        t.ACCOUNT_ID, t.ACCOUNT_NAME, 'open_tmr', 'medium',
        'Open TMR: ' || COALESCE(t.ACTIVITY_REQUESTED, 'TMR #' || t.TMR_ID),
        'Status: ' || t.STATUS || '. Requested: ' || COALESCE(t.REQUESTED_DATE::VARCHAR, 'Unknown') || '. Assigned: ' || COALESCE(t.ASSIGNED_RESOURCE_NAME, 'Unassigned') || '. Requestor: ' || COALESCE(t.REQUESTOR, 'Unknown'),
        'tmr', t.TMR_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_TMRS t
    WHERE t.STATUS NOT IN ('Closed', 'Cancelled', 'Completed');

    -- no_interaction_7d
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'no_interaction_7d-' || a.ACCOUNT_ID,
        a.ACCOUNT_ID, a.ACCOUNT_NAME, 'no_interaction_7d', 'medium',
        'No call at ' || a.ACCOUNT_NAME || ' in 7+ days',
        'Last interaction: ' || COALESCE(a.LAST_EXTERNAL_INTERACTION_DATE::VARCHAR, 'never') || ' (' || COALESCE(a.DAYS_SINCE_LAST_INTERACTION::VARCHAR, 'N/A') || 'd ago). Total calls 90d: ' || COALESCE(a.TOTAL_GONG_CALLS_90D::VARCHAR, '0') || '. Active use cases: ' || COALESCE(a.ACTIVE_USE_CASE_COUNT::VARCHAR, '0'),
        'account', a.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    WHERE a.DAYS_SINCE_LAST_INTERACTION BETWEEN 7 AND 13
       OR (a.LAST_EXTERNAL_INTERACTION_DATE IS NULL AND a.ACTIVATION_START_DATE >= DATEADD('day', -90, CURRENT_DATE()));

    -- no_interaction_14d
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'no_interaction_14d-' || a.ACCOUNT_ID,
        a.ACCOUNT_ID, a.ACCOUNT_NAME, 'no_interaction_14d', 'high',
        'No call at ' || a.ACCOUNT_NAME || ' in ' || COALESCE(a.DAYS_SINCE_LAST_INTERACTION::VARCHAR, '14+') || ' days',
        'Last interaction: ' || COALESCE(a.LAST_EXTERNAL_INTERACTION_DATE::VARCHAR, 'never') || '. Momentum: ' || COALESCE(a.MOMENTUM, 'unknown') || '. Active use cases: ' || COALESCE(a.ACTIVE_USE_CASE_COUNT::VARCHAR, '0') || '. Impl: ' || COALESCE(a.IMPL_USE_CASE_COUNT::VARCHAR, '0'),
        'account', a.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    WHERE a.DAYS_SINCE_LAST_INTERACTION >= 14
       OR (a.LAST_EXTERNAL_INTERACTION_DATE IS NULL AND a.ACTIVE_USE_CASE_COUNT > 0);

    -- Tier 1: consumption_spike (standard accounts with revenue floor)
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'consumption_spike-' || a.ACCOUNT_ID,
        a.ACCOUNT_ID, a.ACCOUNT_NAME, 'consumption_spike', 'high',
        a.ACCOUNT_NAME || ' consumption up ' || ROUND(a.WOW_PCT_CHANGE, 0)::VARCHAR || '% week-over-week',
        'WoW change: +' || ROUND(a.WOW_PCT_CHANGE, 1)::VARCHAR || '%. MoM: ' || COALESCE(ROUND(a.MOM_PCT_CHANGE, 1)::VARCHAR, 'N/A') || '%. Contract utilization: ' || COALESCE(a.CONTRACT_UTILIZATION_PCT::VARCHAR, 'N/A') || '%. Rev last week: $' || ROUND(c.REV_LAST_WEEK, 0)::VARCHAR,
        'account', a.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    JOIN TEMP.JUSDAVIS.BKMNG_A360_CONSUMPTION c ON c.ACCOUNT_ID = a.ACCOUNT_ID
    WHERE a.WOW_PCT_CHANGE >= 30
      AND c.REV_LAST_WEEK >= 350;

    -- Tier 2: consumption_spike ramp detection
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'consumption_spike-ramp-' || a.ACCOUNT_ID,
        a.ACCOUNT_ID, a.ACCOUNT_NAME, 'consumption_spike', 'low',
        a.ACCOUNT_NAME || ' ramping: MoM +' || ROUND(c.MOM_PCT_CHANGE, 0)::VARCHAR || '% with ' || c.ACTIVE_DAYS_30D::VARCHAR || ' active days',
        'Ramp detected. MoM: +' || ROUND(c.MOM_PCT_CHANGE, 1)::VARCHAR || '%. Active days (30d): ' || c.ACTIVE_DAYS_30D::VARCHAR || '. Rev last week: $' || ROUND(c.REV_LAST_WEEK, 0)::VARCHAR,
        'account', a.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    JOIN TEMP.JUSDAVIS.BKMNG_A360_CONSUMPTION c ON c.ACCOUNT_ID = a.ACCOUNT_ID
    WHERE c.REV_LAST_WEEK < 350
      AND c.MOM_PCT_CHANGE > 1.0
      AND c.ACTIVE_DAYS_30D >= 20;

    -- consumption_dip
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'consumption_dip-' || a.ACCOUNT_ID,
        a.ACCOUNT_ID, a.ACCOUNT_NAME, 'consumption_dip', 'medium',
        a.ACCOUNT_NAME || ' consumption down ' || ABS(ROUND(a.WOW_PCT_CHANGE, 0))::VARCHAR || '% week-over-week',
        'WoW change: ' || ROUND(a.WOW_PCT_CHANGE, 1)::VARCHAR || '%. MoM: ' || COALESCE(ROUND(a.MOM_PCT_CHANGE, 1)::VARCHAR, 'N/A') || '%. Active use cases: ' || COALESCE(a.ACTIVE_USE_CASE_COUNT::VARCHAR, '0') || '. Rev last week: $' || ROUND(c.REV_LAST_WEEK, 0)::VARCHAR,
        'account', a.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    JOIN TEMP.JUSDAVIS.BKMNG_A360_CONSUMPTION c ON c.ACCOUNT_ID = a.ACCOUNT_ID
    WHERE a.WOW_PCT_CHANGE <= -20
      AND c.REV_LAST_WEEK >= 350;

    /* PAUSED: champion_silent */
    /* PAUSED: stage_stalled */
    /* PAUSED: competitor_mentioned */

    -- capacity_warning
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'capacity_warning-' || a.ACCOUNT_ID || '-' || CASE
            WHEN a.CONTRACT_UTILIZATION_PCT >= 125 THEN '125pct'
            WHEN a.CONTRACT_UTILIZATION_PCT >= 100 THEN '100pct'
            WHEN a.CONTRACT_UTILIZATION_PCT >= 90  THEN '90pct'
            ELSE '75pct' END,
        a.ACCOUNT_ID, a.ACCOUNT_NAME, 'capacity_warning',
        CASE
            WHEN a.CONTRACT_UTILIZATION_PCT >= 100 THEN 'high'
            ELSE 'medium'
        END,
        a.ACCOUNT_NAME || ' at ' || ROUND(a.CONTRACT_UTILIZATION_PCT, 0)::VARCHAR || '% contract capacity',
        'Utilization: ' || ROUND(a.CONTRACT_UTILIZATION_PCT, 1)::VARCHAR || '%. Consumed: ' || COALESCE(a.TOTAL_CONSUMED_CREDITS::VARCHAR, 'N/A') || ' / ' || COALESCE(a.CONTRACT_CAPACITY::VARCHAR, 'N/A') || '. Overage predicted: ' || COALESCE(a.PREDICTED_OVERAGE_DATE::VARCHAR, 'N/A') || '. WoW: ' || COALESCE(ROUND(a.WOW_PCT_CHANGE, 1)::VARCHAR, 'N/A') || '%',
        'account', a.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    WHERE a.CONTRACT_UTILIZATION_PCT >= 75;

    -- expansion_signal
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'expansion_signal-' || uc.USE_CASE_ID,
        uc.ACCOUNT_ID, uc.ACCOUNT_NAME, 'expansion_signal', 'medium',
        'New use case at ' || uc.ACCOUNT_NAME || ': "' || uc.USE_CASE_NAME || '"',
        'Use case created: ' || COALESCE(uc.CREATED_DATE::VARCHAR, 'Unknown') || '. Stage: ' || uc.STAGE || '. Lead SE: ' || COALESCE(uc.LEAD_SE, 'Unknown') || '. MEDDPICC: ' || COALESCE(uc.MEDDPICC_OVERALL_SCORE::VARCHAR, 'N/A'),
        'use_case', uc.USE_CASE_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_USE_CASES uc
    WHERE uc.CREATED_DATE >= DATEADD('day', -7, CURRENT_DATE())
      AND uc.STATUS NOT IN ('Closed', 'Cancelled');

    -- new_feature_adoption
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'new_feature_adoption-' || pa.ACCOUNT_ID,
        pa.ACCOUNT_ID, pa.ACCOUNT_NAME, 'new_feature_adoption', 'low',
        pa.ACCOUNT_NAME || ' adopted ' || COUNT(DISTINCT pa.FEATURE)::VARCHAR || ' new feature(s): ' || LISTAGG(DISTINCT pa.FEATURE, ', ') WITHIN GROUP (ORDER BY pa.FEATURE),
        'New features (30d): ' || LISTAGG(DISTINCT pa.FEATURE, ', ') WITHIN GROUP (ORDER BY pa.FEATURE) || ' | Count: ' || COUNT(DISTINCT pa.FEATURE)::VARCHAR,
        'account', pa.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_A360_PRODUCT_ADOPTION pa
    WHERE pa.IS_NEW_30D = TRUE
    GROUP BY pa.ACCOUNT_ID, pa.ACCOUNT_NAME;

    -- use_case_no_go_live (replaces use_case_no_dates)
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT,
         ENTITY_TYPE, ENTITY_ID, CREATED_AT, SOURCE, CATEGORY, ALERT_ELIGIBLE, METADATA)
    SELECT
        'use_case_no_go_live-' || uc.USE_CASE_ID,
        uc.ACCOUNT_ID, uc.ACCOUNT_NAME, 'use_case_no_go_live', 'medium',
        'Use case "' || uc.USE_CASE_NAME || '" has no go-live date',
        'Status: ' || uc.STATUS || '. Stage: ' || COALESCE(uc.STAGE, 'Unknown')
            || '. Created: ' || COALESCE(uc.CREATED_DATE::VARCHAR, 'Unknown')
            || '. No actual go-live date set in Salesforce.',
        'use_case', uc.USE_CASE_ID, CURRENT_TIMESTAMP(),
        'core', 'use_case', TRUE,
        OBJECT_CONSTRUCT(
            'use_case_id', uc.USE_CASE_ID,
            'use_case_name', uc.USE_CASE_NAME,
            'status', uc.STATUS,
            'stage', uc.STAGE
        )
    FROM TEMP.JUSDAVIS.BKMNG_USE_CASES uc
    WHERE uc.STATUS IN ('In Pursuit', 'Implementation')
      AND uc.GO_LIVE_DATE IS NULL;

    -- use_case_no_impl_start
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT,
         ENTITY_TYPE, ENTITY_ID, CREATED_AT, SOURCE, CATEGORY, ALERT_ELIGIBLE, METADATA)
    SELECT
        'use_case_no_impl_start-' || uc.USE_CASE_ID,
        uc.ACCOUNT_ID, uc.ACCOUNT_NAME, 'use_case_no_impl_start', 'medium',
        'Use case "' || uc.USE_CASE_NAME || '" has no implementation start date',
        'Status: Implementation. Stage: ' || COALESCE(uc.STAGE, 'Unknown')
            || '. Created: ' || COALESCE(uc.CREATED_DATE::VARCHAR, 'Unknown')
            || '. No implementation start date set in Salesforce.',
        'use_case', uc.USE_CASE_ID, CURRENT_TIMESTAMP(),
        'core', 'use_case', TRUE,
        OBJECT_CONSTRUCT(
            'use_case_id', uc.USE_CASE_ID,
            'use_case_name', uc.USE_CASE_NAME,
            'status', uc.STATUS,
            'stage', uc.STAGE
        )
    FROM TEMP.JUSDAVIS.BKMNG_USE_CASES uc
    WHERE uc.STATUS = 'Implementation'
      AND uc.IMPLEMENTATION_START_DATE IS NULL;

    -- use_case_stale_notes (Friday only)
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT,
         ENTITY_TYPE, ENTITY_ID, CREATED_AT, SOURCE, CATEGORY, ALERT_ELIGIBLE, METADATA)
    SELECT
        'use_case_stale_notes-' || uc.USE_CASE_ID,
        uc.ACCOUNT_ID, uc.ACCOUNT_NAME, 'use_case_stale_notes', 'low',
        'Use case "' || uc.USE_CASE_NAME || '" has no PS note update this week',
        'Status: ' || uc.STATUS || '. Last note: '
            || COALESCE(ln.LAST_NOTE_DATE::VARCHAR, 'never')
            || '. Consider adding a weekly progress update.',
        'use_case', uc.USE_CASE_ID, CURRENT_TIMESTAMP(),
        'core', 'use_case', TRUE,
        OBJECT_CONSTRUCT(
            'use_case_id', uc.USE_CASE_ID,
            'use_case_name', uc.USE_CASE_NAME,
            'status', uc.STATUS,
            'last_note_date', COALESCE(ln.LAST_NOTE_DATE::VARCHAR, 'never')
        )
    FROM TEMP.JUSDAVIS.BKMNG_USE_CASES uc
    LEFT JOIN (
        SELECT USE_CASE_ID, MAX(NOTE_DATE) AS LAST_NOTE_DATE
        FROM TEMP.JUSDAVIS.BKMNG_USE_CASE_NOTES
        GROUP BY USE_CASE_ID
    ) ln ON ln.USE_CASE_ID = uc.USE_CASE_ID
    WHERE uc.STATUS IN ('In Pursuit', 'Implementation')
      AND DAYOFWEEK(CURRENT_DATE()) = 5
      AND (ln.LAST_NOTE_DATE IS NULL OR ln.LAST_NOTE_DATE < DATEADD('day', -7, CURRENT_DATE()));

    -- upcoming_meeting
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'upcoming_meeting-' || m.ACCOUNT_ID,
        m.ACCOUNT_ID, m.ACCOUNT_NAME, 'upcoming_meeting', 'low',
        m.ACCOUNT_NAME || ' has ' || COUNT(*)::VARCHAR || ' meeting(s) in the next 14 days',
        'Next meeting: ' || MIN(m.SUBJECT),
        'account', m.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_MEETING_ACTIVITY m
    WHERE m.IS_UPCOMING = TRUE
      AND m.ACTIVITY_DATE < DATEADD('day', 14, CURRENT_DATE())
    GROUP BY m.ACCOUNT_ID, m.ACCOUNT_NAME;

    -- no_upcoming_meeting
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'no_upcoming_meeting-' || a.ACCOUNT_ID,
        a.ACCOUNT_ID, a.ACCOUNT_NAME, 'no_upcoming_meeting', 'medium',
        'No upcoming meetings scheduled for ' || a.ACCOUNT_NAME,
        'Last meeting: ' || COALESCE(past.LAST_MEETING_DATE::VARCHAR, 'never'),
        'account', a.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    LEFT JOIN (
        SELECT ACCOUNT_ID, MAX(ACTIVITY_DATE) AS LAST_MEETING_DATE
        FROM TEMP.JUSDAVIS.BKMNG_MEETING_ACTIVITY
        WHERE IS_UPCOMING = FALSE
        GROUP BY ACCOUNT_ID
    ) past ON past.ACCOUNT_ID = a.ACCOUNT_ID
    WHERE a.ENGAGEMENT_STATUS NOT IN ('Churned', 'Renewal')
      AND a.STATUS NOT IN ('Churned')
      AND NOT EXISTS (
          SELECT 1 FROM TEMP.JUSDAVIS.BKMNG_MEETING_ACTIVITY um
          WHERE um.ACCOUNT_ID = a.ACCOUNT_ID AND um.IS_UPCOMING = TRUE
            AND um.ACTIVITY_DATE < DATEADD('day', 14, CURRENT_DATE())
      )
      AND (past.LAST_MEETING_DATE IS NULL
           OR past.LAST_MEETING_DATE < DATEADD('day', -14, CURRENT_DATE()));

    -- meeting_momentum
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'meeting_momentum-' || m.ACCOUNT_ID,
        m.ACCOUNT_ID, m.ACCOUNT_NAME, 'meeting_momentum', 'low',
        m.ACCOUNT_NAME || ' has had ' || COUNT(*)::VARCHAR || ' meetings in the last 14 days',
        'Meetings in last 14d: ' || COUNT(*)::VARCHAR,
        'account', m.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_MEETING_ACTIVITY m
    WHERE m.IS_UPCOMING = FALSE
      AND m.ACTIVITY_DATE >= DATEADD('day', -14, CURRENT_DATE())
    GROUP BY m.ACCOUNT_ID, m.ACCOUNT_NAME
    HAVING COUNT(*) >= 3;

    -- email_silence
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'email_silence-' || a.ACCOUNT_ID,
        a.ACCOUNT_ID, a.ACCOUNT_NAME, 'email_silence', 'medium',
        'No email activity at ' || a.ACCOUNT_NAME || ' in 14 days',
        'Last email: ' || COALESCE(e.LAST_EMAIL_DATE::VARCHAR, 'never') || '. Avg weekly: ' || COALESCE(e.AVG_WEEKLY_EMAIL_FREQUENCY::VARCHAR, '0'),
        'account', a.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNTS a
    INNER JOIN TEMP.JUSDAVIS.BKMNG_EMAIL_ACTIVITY e ON e.ACCOUNT_ID = a.ACCOUNT_ID
    WHERE a.ENGAGEMENT_STATUS NOT IN ('Churned', 'Renewal')
      AND a.STATUS NOT IN ('Churned')
      AND e.EMAILS_LAST_14D = 0;

    -- email_declining
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'email_declining-' || e.ACCOUNT_ID,
        e.ACCOUNT_ID, e.ACCOUNT_NAME, 'email_declining', 'low',
        e.ACCOUNT_NAME || ' email activity is declining',
        'Emails last 14d: ' || e.EMAILS_LAST_14D::VARCHAR || '. Last 30d: ' || e.EMAILS_LAST_30D::VARCHAR,
        'account', e.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_EMAIL_ACTIVITY e
    WHERE e.EMAIL_TREND = 'declining';

    -- contract_ending
    INSERT INTO TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
        (SIGNAL_ID, ACCOUNT_ID, ACCOUNT_NAME, SIGNAL_TYPE, PRIORITY, SIGNAL_TEXT, CONTEXT, ENTITY_TYPE, ENTITY_ID, CREATED_AT)
    SELECT
        'contract_ending-' || c.ACCOUNT_ID,
        c.ACCOUNT_ID, c.ACCOUNT_NAME, 'contract_ending',
        'high',
        c.ACCOUNT_NAME || ' contract ends ' || c.CONTRACT_END_DATE::VARCHAR || ' (' || c.DAYS_UNTIL_CONTRACT_END || ' days)',
        'ACV: $' || ROUND(c.NET_ACV, 0)::VARCHAR || ' | Deal type: ' || COALESCE(c.DEAL_TYPE, 'Unknown') || ' | 90d revenue: $' || ROUND(COALESCE(c.REV_90D, 0), 0)::VARCHAR || ' | Renewal: ' || c.IS_RENEWAL::VARCHAR,
        'account', c.ACCOUNT_ID, CURRENT_TIMESTAMP()
    FROM TEMP.JUSDAVIS.BKMNG_A360_CONTRACT c
    WHERE c.DAYS_UNTIL_CONTRACT_END <= 60
      AND c.DAYS_UNTIL_CONTRACT_END > 0
      AND c.CONTRACT_END_DATE IS NOT NULL;

    -- UPDATE: set SOURCE, CATEGORY, ALERT_ELIGIBLE for all core signals
    UPDATE TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS
    SET SOURCE = 'core',
        CATEGORY = CASE SIGNAL_TYPE
            WHEN 'no_interaction_14d'   THEN 'engagement'
            WHEN 'no_interaction_7d'    THEN 'engagement'
            WHEN 'champion_silent'      THEN 'engagement'
            WHEN 'competitor_mentioned' THEN 'engagement'
            WHEN 'new_feature_adoption' THEN 'engagement'
            WHEN 'consumption_spike'    THEN 'consumption'
            WHEN 'consumption_dip'      THEN 'consumption'
            WHEN 'capacity_warning'     THEN 'consumption'
            WHEN 'contract_ending'      THEN 'consumption'
            WHEN 'expansion_signal'     THEN 'consumption'
            WHEN 'blocker'              THEN 'use_case'
            WHEN 'at_risk'              THEN 'use_case'
            WHEN 'stage_stalled'        THEN 'use_case'
            WHEN 'use_case_no_go_live'  THEN 'use_case'
            WHEN 'use_case_no_impl_start' THEN 'use_case'
            WHEN 'use_case_stale_notes' THEN 'use_case'
            WHEN 'go_live_approaching'  THEN 'go_live'
            WHEN 'open_tmr'             THEN 'tmr'
            WHEN 'upcoming_meeting'    THEN 'engagement'
            WHEN 'no_upcoming_meeting' THEN 'engagement'
            WHEN 'meeting_momentum'    THEN 'engagement'
            WHEN 'email_silence'       THEN 'engagement'
            WHEN 'email_declining'     THEN 'engagement'
            ELSE 'other'
        END,
        ALERT_ELIGIBLE = CASE
            WHEN PRIORITY = 'high' THEN TRUE
            WHEN SIGNAL_TYPE IN ('open_tmr', 'new_feature_adoption', 'no_upcoming_meeting', 'email_silence', 'use_case_no_go_live', 'use_case_no_impl_start', 'use_case_stale_notes') THEN TRUE
            ELSE FALSE
        END
    WHERE SOURCE IS NULL;

    RETURN 'OK: ' || (SELECT COUNT(*)::VARCHAR FROM TEMP.JUSDAVIS.BKMNG_ONT_ACCOUNT_SIGNALS) || ' signals generated';
END
$$;
