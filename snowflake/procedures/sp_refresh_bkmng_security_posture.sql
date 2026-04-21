-- PROCEDURE: TEMP.JUSDAVIS.SP_REFRESH_BKMNG_SECURITY_POSTURE()  |  created: 2026-04-21 03:27:52.826000+00:00

CREATE OR REPLACE PROCEDURE "SP_REFRESH_BKMNG_SECURITY_POSTURE"()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS '
BEGIN
  CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_SECURITY_POSTURE AS
  WITH acct_map AS (
      SELECT DISTINCT
          r.SALESFORCE_ACCOUNT_ID,
          r.SNOWFLAKE_ACCOUNT_ID::INT AS SNOWFLAKE_ACCOUNT_ID
      FROM SNOWHOUSE.PRODUCT.RELEVANT_SUBSCRIPTION_DAILY_RECORDS r
      JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = r.SALESFORCE_ACCOUNT_ID
      WHERE r.SNOWFLAKE_ACCOUNT_ID IS NOT NULL
  ),

  acct_primary AS (
      SELECT SALESFORCE_ACCOUNT_ID, MIN(SNOWFLAKE_ACCOUNT_ID) AS SNOWFLAKE_ACCOUNT_ID
      FROM acct_map
      GROUP BY SALESFORCE_ACCOUNT_ID
  ),

  cust_profile AS (
      SELECT
          c.SFDC_CUST_ID AS ACCOUNT_ID,
          c.CUST_INDUSTRY AS INDUSTRY,
          c.AGREEMENT AS SERVICE_LEVEL
      FROM SALES.CX_INSIGHTS.V_CUST_CURR c
      JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = c.SFDC_CUST_ID
  ),

  security_health AS (
      SELECT
          am.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
          MAX(s.HAS_SSO_CONFIGURED::INT) AS HAS_SSO,
          MAX(s.HAS_SCIM_INTEGRATION::INT) AS HAS_SCIM,
          MAX(s.HAS_HUMAN_MFA_READY::INT) AS HAS_MFA,
          MAX(s.HAS_SERVICE_USERS_STRONG_AUTH::INT) AS HAS_SERVICE_AUTH,
          MAX(s.HAS_NETWORK_POLICY_CONFIGURED::INT) AS HAS_NP,
          MAX(s.HAS_PRIVATELINK_INBOUND::INT) AS HAS_PL_IN,
          MAX(s.HAS_PRIVATELINK_OUTBOUND::INT) AS HAS_PL_OUT,
          MAX(s.HAS_TRI_SECRET_SECURE::INT) AS HAS_TSS,
          MAX(s.HAS_TRUST_CENTER_PACKAGES_ENABLED::INT) AS HAS_TC,
          MAX(CASE WHEN s.SERVICE_LEVEL IN (''Business Critical'', ''VPS'') THEN 1 ELSE 0 END) AS IS_BC
      FROM SNOWSCIENCE.DB_SECURITY.SECURITY_HEALTH_SCORE_DAILY s
      JOIN acct_map am ON am.SNOWFLAKE_ACCOUNT_ID = s.ACCOUNT_ID
      WHERE s.DS = (SELECT MAX(DS) FROM SNOWSCIENCE.DB_SECURITY.SECURITY_HEALTH_SCORE_DAILY)
      GROUP BY am.SALESFORCE_ACCOUNT_ID
  ),

  alu_scim_stats AS (
      SELECT
          am.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
          MAX(CASE WHEN u.SCIM_USER_NAME IS NOT NULL THEN 1 ELSE 0 END) AS ALU_HAS_SCIM,
          COUNT(DISTINCT CASE WHEN u.SCIM_USER_NAME IS NOT NULL THEN u.ID END) AS SCIM_USER_COUNT
      FROM SNOWHOUSE.PRODUCT.ALL_LIVE_USERS u
      JOIN acct_map am ON am.SNOWFLAKE_ACCOUNT_ID = u.ACCOUNT_ID
      WHERE u.DS = (SELECT MAX(DS) FROM SNOWHOUSE.PRODUCT.ALL_LIVE_USERS)
        AND u.DELETED_ON IS NULL
      GROUP BY am.SALESFORCE_ACCOUNT_ID
  ),

  governed AS (
      SELECT
          am.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
          SUM(g.MASKING_POLICIES) AS MASKING_POLICIES,
          SUM(g.ROW_ACCESS_POLICIES) AS ROW_ACCESS_POLICIES,
          SUM(g.TBM_POLICIES) AS TBM_POLICIES,
          SUM(g.ASSIGNED_TAGS) AS ASSIGNED_TAGS,
          SUM(g.TOTAL_MASKING_POLICIES) AS TOTAL_MASKING_POLICIES
      FROM SNOWSCIENCE.DATA_GOVERNANCE.GOVERNED_ACCOUNTS g
      JOIN acct_map am ON am.SNOWFLAKE_ACCOUNT_ID = g.ACCOUNT_ID
      WHERE g.DS = (SELECT MAX(DS) FROM SNOWSCIENCE.DATA_GOVERNANCE.GOVERNED_ACCOUNTS)
      GROUP BY am.SALESFORCE_ACCOUNT_ID
  ),

  admin_stats AS (
      SELECT
          a.SFDC_CUST_ID AS ACCOUNT_ID,
          COUNT(*) AS TOTAL_ADMIN_USERS,
          SUM(CASE WHEN a.ACCOUNT_ADMIN = ''YES'' THEN 1 ELSE 0 END) AS ACCOUNTADMIN_COUNT,
          SUM(CASE WHEN a.ACCOUNT_ADMIN = ''YES'' AND a.HAS_MFA = ''NO MFA'' THEN 1 ELSE 0 END) AS ACCOUNTADMIN_NO_MFA,
          SUM(CASE WHEN a.SYS_ADMIN = ''YES'' THEN 1 ELSE 0 END) AS SYSADMIN_COUNT,
          SUM(CASE WHEN a.SECURITY_ADMIN = ''YES'' THEN 1 ELSE 0 END) AS SECURITYADMIN_COUNT
      FROM SALES.CX_INSIGHTS.V_SF_ADMIN_CURR a
      JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = a.SFDC_CUST_ID
      GROUP BY a.SFDC_CUST_ID
  ),

  role_stats AS (
      SELECT
          am.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
          COUNT(DISTINCT r.SF_ROLE_ID) AS TOTAL_ROLES,
          COUNT(DISTINCT r.SF_PARENT_ROLE_ID) AS DISTINCT_PARENT_ROLES
      FROM SALES.CX_INSIGHTS.V_SF_ROLES_CURR r
      JOIN acct_map am ON am.SNOWFLAKE_ACCOUNT_ID = r.SF_ACCT_ID
      GROUP BY am.SALESFORCE_ACCOUNT_ID
  ),

  federated_stats AS (
      SELECT
          d.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
          COUNT(*) AS TOTAL_USERS,
          SUM(CASE WHEN d.FEDERATED_AUTH = ''SSO enabled'' THEN 1 ELSE 0 END) AS SSO_USERS,
          ROUND(SUM(CASE WHEN d.FEDERATED_AUTH = ''SSO enabled'' THEN 1 ELSE 0 END)
                / NULLIF(COUNT(*), 0) * 100, 1) AS SSO_PCT,
          MAX(CASE WHEN d.FEDERATED_AUTH = ''SSO enabled'' THEN 1 ELSE 0 END) AS ANY_USER_SSO,
          MAX(CASE WHEN d.FEDERATED_AUTH = ''SSO enabled''
                   THEN d.IDP_INTEGRATED[0]::VARCHAR ELSE NULL END) AS IDP_NAME,
          MAX(CASE WHEN d.ACCOUNT_LEVEL_MFA_POLICY = TRUE THEN 1 ELSE 0 END) AS HAS_ACCT_MFA_POLICY,
          SUM(CASE WHEN d.USER_TYPE IN (''SERVICE'',''LEGACY_SERVICE'') THEN 1 ELSE 0 END) AS TOTAL_SERVICE_USERS,
          SUM(CASE WHEN d.USER_TYPE IN (''SERVICE'',''LEGACY_SERVICE'')
                    AND d.HAS_PASSWORD = TRUE
                    AND (d.RSA_PUBLIC_KEY IS NULL OR d.RSA_PUBLIC_KEY = '''')
               THEN 1 ELSE 0 END) AS WEAK_AUTH_SERVICE_USERS
      FROM SNOWSCIENCE.DB_SECURITY.DAILY_USER_HEALTH d
      JOIN TEMP.JUSDAVIS.BKMNG_ACCOUNTS b ON b.ACCOUNT_ID = d.SALESFORCE_ACCOUNT_ID
      WHERE d.DS = (SELECT MAX(DS) FROM SNOWSCIENCE.DB_SECURITY.DAILY_USER_HEALTH)
      GROUP BY d.SALESFORCE_ACCOUNT_ID
  ),

  np_stats AS (
      SELECT
          am.SALESFORCE_ACCOUNT_ID AS ACCOUNT_ID,
          COUNT(*) AS POLICY_COUNT,
          SUM(CASE WHEN n.HAS_NETWORK_RULE THEN 1 ELSE 0 END) AS NR_COUNT
      FROM SNOWSCIENCE.DB_SECURITY.NETWORK_POLICIES n
      JOIN acct_map am ON am.SNOWFLAKE_ACCOUNT_ID = n.ACCOUNT_ID
      WHERE n.DS = (SELECT MAX(DS) FROM SNOWSCIENCE.DB_SECURITY.NETWORK_POLICIES)
        AND n.DELETED_ON IS NULL
      GROUP BY am.SALESFORCE_ACCOUNT_ID
  ),

  base_accounts AS (
      SELECT
          b.ACCOUNT_ID,
          b.ACCOUNT_NAME,
          COALESCE(cp.INDUSTRY, b.INDUSTRY, ''Unknown'') AS INDUSTRY,
          COALESCE(cp.SERVICE_LEVEL, ''Enterprise'') AS SERVICE_LEVEL
      FROM TEMP.JUSDAVIS.BKMNG_ACCOUNTS b
      LEFT JOIN cust_profile cp ON cp.ACCOUNT_ID = b.ACCOUNT_ID
  ),

  milestones_unpivoted AS (
      SELECT ba.ACCOUNT_ID, ba.ACCOUNT_NAME, ba.INDUSTRY, ba.SERVICE_LEVEL, m.*
      FROM base_accounts ba
      CROSS JOIN (SELECT column1 AS MILESTONE_ID, column2 AS MILESTONE_NAME, column3 AS TIER, column4 AS PRIORITY
                  FROM VALUES
                      (''sso'', ''SSO / Federation'', ''identity_access'', ''critical''),
                      (''sso_provider'', ''SSO Provider Identification'', ''identity_access'', ''informational''),
                      (''scim'', ''SCIM Provisioning'', ''identity_access'', ''high''),
                      (''mfa'', ''MFA Enforcement'', ''identity_access'', ''critical''),
                      (''service_user_auth'', ''Service User Strong Auth'', ''identity_access'', ''high''),
                      (''network_policies'', ''Network Policies'', ''network_data_protection'', ''high''),
                      (''privatelink'', ''PrivateLink'', ''network_data_protection'', ''high''),
                      (''ddm'', ''Dynamic Data Masking'', ''network_data_protection'', ''high''),
                      (''row_access'', ''Row Access Policies'', ''network_data_protection'', ''medium''),
                      (''tag_masking'', ''Tag-Based Masking'', ''network_data_protection'', ''medium''),
                      (''tri_secret'', ''Tri-Secret Secure'', ''network_data_protection'', ''medium''),
                      (''data_classification'', ''Data Classification'', ''network_data_protection'', ''medium''),
                      (''accountadmin_sprawl'', ''ACCOUNTADMIN Sprawl'', ''rbac_governance'', ''critical''),
                      (''role_hierarchy'', ''Role Hierarchy Under SYSADMIN'', ''rbac_governance'', ''high''),
                      (''ownership_concentration'', ''Object Ownership Concentration'', ''rbac_governance'', ''medium''),
                      (''trust_center'', ''Trust Center'', ''rbac_governance'', ''medium'')
                 ) AS m
  )

  SELECT
      mu.ACCOUNT_ID,
      mu.ACCOUNT_NAME,
      mu.MILESTONE_ID,
      mu.MILESTONE_NAME,
      mu.TIER,

      CASE mu.MILESTONE_ID
          WHEN ''sso'' THEN
              CASE WHEN GREATEST(COALESCE(sh.HAS_SSO,0), COALESCE(fs.ANY_USER_SSO,0)) = 1 THEN
                  CASE WHEN COALESCE(fs.SSO_PCT,0) >= 90 THEN ''complete'' ELSE ''partial'' END
              ELSE ''not_started'' END
          WHEN ''sso_provider'' THEN
              CASE WHEN GREATEST(COALESCE(sh.HAS_SSO,0), COALESCE(fs.ANY_USER_SSO,0)) = 1
                        AND fs.IDP_NAME IS NOT NULL THEN ''complete''
                   WHEN GREATEST(COALESCE(sh.HAS_SSO,0), COALESCE(fs.ANY_USER_SSO,0)) = 1 THEN ''partial''
              ELSE ''not_started'' END
          WHEN ''scim'' THEN
              CASE WHEN GREATEST(COALESCE(sh.HAS_SCIM,0), COALESCE(alu.ALU_HAS_SCIM,0)) = 1
                   THEN ''complete'' ELSE ''not_started'' END
          WHEN ''mfa'' THEN
              CASE WHEN GREATEST(COALESCE(sh.HAS_MFA,0), COALESCE(fs.HAS_ACCT_MFA_POLICY,0)) = 1 THEN
                  CASE WHEN COALESCE(ads.ACCOUNTADMIN_NO_MFA,0) > 0 THEN ''partial'' ELSE ''complete'' END
              ELSE ''not_started'' END
          WHEN ''service_user_auth'' THEN
              CASE WHEN fs.TOTAL_SERVICE_USERS IS NULL OR fs.TOTAL_SERVICE_USERS = 0 THEN
                  CASE WHEN COALESCE(sh.HAS_SERVICE_AUTH,0) = 1 THEN ''complete'' ELSE ''not_started'' END
              WHEN fs.WEAK_AUTH_SERVICE_USERS = 0 THEN ''complete''
              WHEN fs.WEAK_AUTH_SERVICE_USERS < fs.TOTAL_SERVICE_USERS THEN ''partial''
              ELSE ''not_started'' END
          WHEN ''network_policies'' THEN
              CASE WHEN COALESCE(sh.HAS_NP,0) = 1 THEN ''complete'' ELSE ''not_started'' END
          WHEN ''privatelink'' THEN
              CASE WHEN COALESCE(sh.IS_BC,0) = 0 THEN ''not_applicable''
                   WHEN COALESCE(sh.HAS_PL_IN,0) = 1 AND COALESCE(sh.HAS_PL_OUT,0) = 1 THEN ''complete''
                   WHEN COALESCE(sh.HAS_PL_IN,0) = 1 OR COALESCE(sh.HAS_PL_OUT,0) = 1 THEN ''partial''
                   ELSE ''not_started'' END
          WHEN ''ddm'' THEN
              CASE WHEN COALESCE(gov.MASKING_POLICIES,0) >= 10 THEN ''complete''
                   WHEN COALESCE(gov.MASKING_POLICIES,0) >= 1 THEN ''partial''
                   ELSE ''not_started'' END
          WHEN ''row_access'' THEN
              CASE WHEN COALESCE(gov.ROW_ACCESS_POLICIES,0) > 0 THEN ''complete'' ELSE ''not_started'' END
          WHEN ''tag_masking'' THEN
              CASE WHEN COALESCE(gov.TBM_POLICIES,0) > 0 THEN ''complete'' ELSE ''not_started'' END
          WHEN ''tri_secret'' THEN
              CASE WHEN COALESCE(sh.IS_BC,0) = 0 THEN ''not_applicable''
                   WHEN COALESCE(sh.HAS_TSS,0) = 1 THEN ''complete''
                   ELSE ''not_started'' END
          WHEN ''data_classification'' THEN
              CASE WHEN COALESCE(gov.ASSIGNED_TAGS,0) > 0 THEN ''complete'' ELSE ''not_started'' END
          WHEN ''accountadmin_sprawl'' THEN
              CASE WHEN ads.ACCOUNTADMIN_COUNT IS NULL THEN ''not_started''
                   WHEN ads.ACCOUNTADMIN_COUNT <= 5 THEN ''complete''
                   WHEN ads.ACCOUNTADMIN_COUNT <= 15 THEN ''partial''
                   ELSE ''not_started'' END
          WHEN ''role_hierarchy'' THEN
              CASE WHEN rs.TOTAL_ROLES IS NULL THEN ''not_started''
                   WHEN rs.TOTAL_ROLES >= 20 AND rs.DISTINCT_PARENT_ROLES >= 3 THEN ''complete''
                   WHEN rs.TOTAL_ROLES >= 10 THEN ''partial''
                   ELSE ''not_started'' END
          WHEN ''ownership_concentration'' THEN
              CASE WHEN rs.TOTAL_ROLES IS NULL THEN ''not_started''
                   WHEN rs.TOTAL_ROLES >= 20 AND rs.DISTINCT_PARENT_ROLES >= 3 THEN ''complete''
                   WHEN rs.TOTAL_ROLES >= 10 THEN ''partial''
                   ELSE ''not_started'' END
          WHEN ''trust_center'' THEN
              CASE WHEN COALESCE(sh.HAS_TC,0) = 1 THEN ''complete'' ELSE ''not_started'' END
          ELSE ''not_started''
      END AS STATUS,

      mu.PRIORITY,

      CASE mu.MILESTONE_ID
          WHEN ''sso'' THEN OBJECT_CONSTRUCT(
              ''has_sso'', GREATEST(COALESCE(sh.HAS_SSO,0), COALESCE(fs.ANY_USER_SSO,0)),
              ''sso_pct'', COALESCE(fs.SSO_PCT,0),
              ''no_source_data'', CASE WHEN fs.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END,
              ''data_confidence'', ''medium'',
              ''disclaimer'', ''SSO % reflects last login method used, not IdP configuration. Confirm SSO is set to mandatory in the customer''''s identity provider.''
          )
          WHEN ''sso_provider'' THEN OBJECT_CONSTRUCT(
              ''idp_name'', COALESCE(fs.IDP_NAME,''unknown''),
              ''has_sso'', GREATEST(COALESCE(sh.HAS_SSO,0), COALESCE(fs.ANY_USER_SSO,0)),
              ''no_source_data'', CASE WHEN fs.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END,
              ''data_confidence'', ''medium'',
              ''disclaimer'', ''IdP name reflects the last SSO login recorded. Confirm this is the customer''''s primary identity provider.''
          )
          WHEN ''scim'' THEN OBJECT_CONSTRUCT(
              ''has_scim'', GREATEST(COALESCE(sh.HAS_SCIM,0), COALESCE(alu.ALU_HAS_SCIM,0)),
              ''scim_user_count'', COALESCE(alu.SCIM_USER_COUNT,0),
              ''no_source_data'', CASE WHEN sh.ACCOUNT_ID IS NULL AND alu.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END,
              ''data_confidence'', CASE WHEN COALESCE(sh.HAS_SCIM,0) + COALESCE(alu.ALU_HAS_SCIM,0) > 0 THEN ''high'' ELSE ''low'' END,
              ''disclaimer'', ''SCIM status is assessed via crosswalk data only (covers ~121 of 518 accounts). Confirm SCIM provisioning is active directly with the customer.''
          )
          WHEN ''mfa'' THEN OBJECT_CONSTRUCT(
              ''has_mfa'', GREATEST(COALESCE(sh.HAS_MFA,0), COALESCE(fs.HAS_ACCT_MFA_POLICY,0)),
              ''acct_mfa_policy'', COALESCE(fs.HAS_ACCT_MFA_POLICY,0),
              ''accountadmin_no_mfa'', COALESCE(ads.ACCOUNTADMIN_NO_MFA,0),
              ''no_source_data'', CASE WHEN fs.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END,
              ''data_confidence'', ''medium'',
              ''disclaimer'', ''MFA policy detected indicates an enforcement policy exists, but does not confirm all user groups are covered or that users are actively enrolled.''
          )
          WHEN ''service_user_auth'' THEN OBJECT_CONSTRUCT(
              ''total_service_users'', COALESCE(fs.TOTAL_SERVICE_USERS,0),
              ''weak_auth_count'', COALESCE(fs.WEAK_AUTH_SERVICE_USERS,0),
              ''no_source_data'', CASE WHEN fs.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END,
              ''data_confidence'', ''medium'',
              ''disclaimer'', ''Service user classification is based on Snowflake USER_TYPE. Confirm no human users have been misdesignated as service accounts.''
          )
          WHEN ''network_policies'' THEN OBJECT_CONSTRUCT(
              ''has_np'', COALESCE(sh.HAS_NP,0),
              ''policy_count'', COALESCE(nps.POLICY_COUNT,0),
              ''network_rules'', COALESCE(nps.NR_COUNT,0),
              ''no_source_data'', CASE WHEN sh.ACCOUNT_ID IS NULL AND nps.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END
          )
          WHEN ''privatelink'' THEN OBJECT_CONSTRUCT(
              ''is_bc'', COALESCE(sh.IS_BC,0),
              ''has_pl_in'', COALESCE(sh.HAS_PL_IN,0),
              ''has_pl_out'', COALESCE(sh.HAS_PL_OUT,0),
              ''no_source_data'', CASE WHEN sh.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END
          )
          WHEN ''ddm'' THEN OBJECT_CONSTRUCT(
              ''masking_policies'', COALESCE(gov.MASKING_POLICIES,0),
              ''total'', COALESCE(gov.TOTAL_MASKING_POLICIES,0),
              ''no_source_data'', CASE WHEN gov.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END
          )
          WHEN ''row_access'' THEN OBJECT_CONSTRUCT(
              ''row_access_policies'', COALESCE(gov.ROW_ACCESS_POLICIES,0),
              ''no_source_data'', CASE WHEN gov.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END
          )
          WHEN ''tag_masking'' THEN OBJECT_CONSTRUCT(
              ''tbm_policies'', COALESCE(gov.TBM_POLICIES,0),
              ''assigned_tags'', COALESCE(gov.ASSIGNED_TAGS,0),
              ''no_source_data'', CASE WHEN gov.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END
          )
          WHEN ''tri_secret'' THEN OBJECT_CONSTRUCT(
              ''is_bc'', COALESCE(sh.IS_BC,0),
              ''has_tss'', COALESCE(sh.HAS_TSS,0),
              ''no_source_data'', CASE WHEN sh.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END
          )
          WHEN ''data_classification'' THEN OBJECT_CONSTRUCT(
              ''assigned_tags'', COALESCE(gov.ASSIGNED_TAGS,0),
              ''no_source_data'', CASE WHEN gov.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END
          )
          WHEN ''accountadmin_sprawl'' THEN OBJECT_CONSTRUCT(
              ''count'', COALESCE(ads.ACCOUNTADMIN_COUNT,0),
              ''no_mfa'', COALESCE(ads.ACCOUNTADMIN_NO_MFA,0),
              ''total_admins'', COALESCE(ads.TOTAL_ADMIN_USERS,0),
              ''no_source_data'', CASE WHEN ads.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END
          )
          WHEN ''role_hierarchy'' THEN OBJECT_CONSTRUCT(
              ''total_roles'', COALESCE(rs.TOTAL_ROLES,0),
              ''distinct_parents'', COALESCE(rs.DISTINCT_PARENT_ROLES,0),
              ''no_source_data'', CASE WHEN ads.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END
          )
          WHEN ''ownership_concentration'' THEN OBJECT_CONSTRUCT(
              ''total_roles'', COALESCE(rs.TOTAL_ROLES,0),
              ''distinct_parents'', COALESCE(rs.DISTINCT_PARENT_ROLES,0),
              ''no_source_data'', CASE WHEN ads.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END
          )
          WHEN ''trust_center'' THEN OBJECT_CONSTRUCT(
              ''has_tc'', COALESCE(sh.HAS_TC,0),
              ''no_source_data'', CASE WHEN sh.ACCOUNT_ID IS NULL THEN 1 ELSE 0 END
          )
          ELSE OBJECT_CONSTRUCT()
      END AS RAW_VALUE,

      NULL::VARIANT AS SECONDARY_SIGNALS,
      mu.INDUSTRY,
      mu.SERVICE_LEVEL,

      CASE
          WHEN mu.INDUSTRY ILIKE ''%financial%'' OR mu.INDUSTRY ILIKE ''%banking%'' OR mu.INDUSTRY ILIKE ''%insurance%'' THEN
              CASE mu.MILESTONE_ID
                  WHEN ''sso'' THEN ''required'' WHEN ''mfa'' THEN ''required'' WHEN ''network_policies'' THEN ''required''
                  WHEN ''privatelink'' THEN ''required'' WHEN ''ddm'' THEN ''required'' WHEN ''row_access'' THEN ''required''
                  WHEN ''tri_secret'' THEN ''required'' WHEN ''data_classification'' THEN ''required''
                  WHEN ''trust_center'' THEN ''required'' WHEN ''accountadmin_sprawl'' THEN ''required''
                  WHEN ''role_hierarchy'' THEN ''required''
                  ELSE ''recommended'' END
          WHEN mu.INDUSTRY ILIKE ''%health%'' OR mu.INDUSTRY ILIKE ''%pharma%'' OR mu.INDUSTRY ILIKE ''%life sci%'' THEN
              CASE mu.MILESTONE_ID
                  WHEN ''sso'' THEN ''required'' WHEN ''mfa'' THEN ''required'' WHEN ''network_policies'' THEN ''required''
                  WHEN ''ddm'' THEN ''required'' WHEN ''row_access'' THEN ''required'' WHEN ''data_classification'' THEN ''required''
                  WHEN ''trust_center'' THEN ''required'' WHEN ''accountadmin_sprawl'' THEN ''required''
                  ELSE ''recommended'' END
          WHEN mu.INDUSTRY ILIKE ''%government%'' OR mu.INDUSTRY ILIKE ''%public%'' OR mu.INDUSTRY ILIKE ''%federal%'' THEN
              CASE mu.MILESTONE_ID
                  WHEN ''sso'' THEN ''required'' WHEN ''mfa'' THEN ''required'' WHEN ''network_policies'' THEN ''required''
                  WHEN ''privatelink'' THEN ''required'' WHEN ''ddm'' THEN ''required'' WHEN ''tri_secret'' THEN ''required''
                  WHEN ''trust_center'' THEN ''required'' WHEN ''service_user_auth'' THEN ''required''
                  WHEN ''accountadmin_sprawl'' THEN ''required''
                  ELSE ''recommended'' END
          ELSE
              CASE mu.MILESTONE_ID
                  WHEN ''sso'' THEN ''required'' WHEN ''mfa'' THEN ''required''
                  WHEN ''accountadmin_sprawl'' THEN ''required''
                  ELSE ''recommended'' END
      END AS INDUSTRY_PRIORITY,

      NULL::VARCHAR(2000) AS LLM_SUMMARY,
      CURRENT_TIMESTAMP() AS LAST_CHECKED,
      CURRENT_TIMESTAMP() AS REFRESHED_AT

  FROM milestones_unpivoted mu
  LEFT JOIN security_health sh ON sh.ACCOUNT_ID = mu.ACCOUNT_ID
  LEFT JOIN governed gov ON gov.ACCOUNT_ID = mu.ACCOUNT_ID
  LEFT JOIN admin_stats ads ON ads.ACCOUNT_ID = mu.ACCOUNT_ID
  LEFT JOIN role_stats rs ON rs.ACCOUNT_ID = mu.ACCOUNT_ID
  LEFT JOIN federated_stats fs ON fs.ACCOUNT_ID = mu.ACCOUNT_ID
  LEFT JOIN np_stats nps ON nps.ACCOUNT_ID = mu.ACCOUNT_ID
  LEFT JOIN alu_scim_stats alu ON alu.ACCOUNT_ID = mu.ACCOUNT_ID;

  RETURN ''OK: '' || (SELECT COUNT(*) FROM TEMP.JUSDAVIS.BKMNG_SECURITY_POSTURE) || '' rows'';
END;
';
