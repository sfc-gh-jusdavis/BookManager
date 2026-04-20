# Security & Network Feature Milestone Best Practices

> Reference guide for evaluating customer security posture across 16 milestones.
> Companion document to `security_milestones.yaml` (machine-readable reference).

---

## How to Use This Document

1. **Identify the customer's industry** to determine which milestones are required vs. recommended
2. **Run the quantitative scan** using the detection queries in the YAML reference
3. **Review each milestone below** for best practice guidance and evaluation criteria
4. **Ask the ACE open questions** for any gaps or unknowns
5. **Prioritize recommendations** based on industry requirements and risk level

---

## Industry Requirement Matrix

| Milestone | Financial Services | Healthcare | Public Sector | Retail | Technology | Manufacturing |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| SSO | Required | Required | Required | Required | Required | Required |
| MFA | Required | Required | Required | Required | Required | Required |
| SCIM | Recommended | Recommended | Recommended | Recommended | Recommended | Recommended |
| Service User Auth | Recommended | Recommended | Required | Recommended | Required | Recommended |
| Network Policies | Required | Required | Required | Recommended | Recommended | Required |
| PrivateLink | Required (BC) | Recommended | Required (BC) | Recommended | Recommended | Recommended |
| DDM | Required | Required | Required | Required | Recommended | Recommended |
| Row Access | Required | Required | Recommended | Recommended | Recommended | Recommended |
| Tag-Based Masking | Recommended | Recommended | Recommended | Recommended | Recommended | Recommended |
| Tri-Secret Secure | Required (BC) | Recommended | Required (BC) | -- | -- | Recommended |
| Data Classification | Required | Required | Recommended | Required | Recommended | Recommended |
| ACCOUNTADMIN Sprawl | Required | Required | Required | Required | Required | Required |
| Role Hierarchy | Required | Required | Required | Recommended | Recommended | Recommended |
| Ownership Concentration | Recommended | Recommended | Recommended | Recommended | Recommended | Recommended |
| Trust Center | Required | Required | Required | Recommended | Recommended | Recommended |

---

## Tier 1: Identity & Access Foundations

### 1. SSO / Federation

**What**: All human users authenticate via an identity provider (Entra ID, Okta, Ping, etc.) using SAML 2.0 or OAuth rather than Snowflake-native passwords.

**Why It Matters**: Without SSO, user credentials are managed independently in Snowflake, creating risk of stale accounts, weak passwords, and inability to enforce organizational security policies. SSO is the foundation for zero-trust access.

**Snowflake Best Practice**:
- Configure a SAML 2.0 security integration or native OAuth with the customer's IdP
- Set `AUTHENTICATION_POLICY` at the account level to enforce SSO-only authentication for human users
- Allow password auth only for `TYPE = 'SERVICE'` or `TYPE = 'LEGACY_SERVICE'` users
- Test SSO with a pilot group before enforcing account-wide

**How to Evaluate**:
- `HAS_SSO_CONFIGURED = TRUE` on `SECURITY_HEALTH_SCORE_DAILY` indicates at least one SSO integration exists
- Check federated user percentage from `DAILY_USER_HEALTH` (target: >90% of human users)
- Any human user with `FEDERATED_AUTH = 'NO FED AUTH'` who has logged in recently is a gap

**Industry Considerations**:
- **Financial Services / Healthcare / Public Sector**: SSO is a compliance requirement. Password-only human users are audit findings.
- **All Industries**: SSO should be the first security milestone implemented. It enables SCIM, centralized MFA, and organizational security policy enforcement.

---

### 2. SSO Provider Identification

**What**: Identifying the specific identity provider (Entra ID, Okta, Ping, OneLogin, etc.) to provide targeted configuration guidance.

**Why It Matters**: Different IdPs have different integration patterns with Snowflake. Entra ID customers can leverage native Snowflake Entra integration including SCIM. Okta customers should use the Snowflake SCIM connector app.

**How to Evaluate**:
- Check `IDP_INTEGRATED` array in `DAILY_USER_HEALTH` for integration names
- Pattern matching: `ENTRA` / `AZURE_AD` / `AZUREAD` = Entra ID; `OKTA` = Okta; `PING` = Ping Identity
- Some customers may have multiple IdPs (e.g., Okta for internal users + Entra ID for partner access)

**Industry Considerations**:
- **Public Sector**: Entra ID (Azure AD) is common due to government cloud requirements
- **Enterprise**: Okta and Entra ID are the two most common IdPs; both have robust Snowflake integrations

---

### 3. SCIM Provisioning

**What**: Automated user lifecycle management via SCIM protocol - users are automatically created and deprovisioned in Snowflake when added/removed from the IdP.

**Why It Matters**: Without SCIM, user accounts must be manually created and removed. Orphaned accounts (users who left the org but still have active Snowflake accounts) are a significant security risk and compliance finding.

**Snowflake Best Practice**:
- Configure SCIM integration with the customer's IdP
- SCIM should manage user creation, role assignment, and deprovisioning
- SCIM users should have `HAS_PASSWORD = FALSE` (authentication via SSO only)
- Regular audits should verify SCIM sync status

**How to Evaluate**:
- `HAS_SCIM_INTEGRATION = TRUE` on `SECURITY_HEALTH_SCORE_DAILY`
- Cross-reference with SSO status: SCIM without SSO is unusual (SCIM should complement SSO)
- Check `LIVE_SCIM_USERS` count in `CUSTOMER_SEGMENT_FEATURES` for adoption depth

---

### 4. MFA Enforcement

**What**: Multi-factor authentication required for all human users, with special emphasis on users holding elevated roles (ACCOUNTADMIN, SYSADMIN, SECURITYADMIN).

**Why It Matters**: MFA is the single most effective control against credential theft and unauthorized access. Snowflake accounts without MFA are vulnerable to credential stuffing, phishing, and password reuse attacks.

**Snowflake Best Practice**:
- Create an account-level authentication policy requiring MFA for all human users
- At minimum, all ACCOUNTADMIN users must have MFA
- Use Duo MFA (native) or enforce MFA via SSO provider
- Service accounts (`TYPE = 'SERVICE'`) should use key-pair auth instead of MFA

**How to Evaluate**:
- `HAS_HUMAN_MFA_READY = TRUE` on `SECURITY_HEALTH_SCORE_DAILY`
- Check `V_SF_ADMIN_CURR` for any admin users with `HAS_MFA = 'NO MFA'` (critical finding)
- ACCOUNTADMIN users without MFA should be flagged as the highest-priority remediation item

**Critical Finding**: Any ACCOUNTADMIN user without MFA is an immediate security risk that should be addressed before any other milestone.

---

### 5. Service User Strong Authentication

**What**: Non-human service accounts authenticate via RSA key-pair or OAuth client credentials rather than passwords.

**Why It Matters**: Service accounts with passwords are high-value targets. Their credentials are often stored in configuration files, CI/CD pipelines, or shared across teams. Key-pair auth eliminates password exposure risk.

**Snowflake Best Practice**:
- Set user `TYPE = 'SERVICE'` or `TYPE = 'LEGACY_SERVICE'` for non-human accounts
- Use RSA key-pair authentication (`RSA_PUBLIC_KEY` / `RSA_PUBLIC_KEY_2` for rotation)
- Or use OAuth client credentials flow for programmatic access
- Implement key rotation on a regular schedule (e.g., quarterly)
- Remove passwords from service accounts

**How to Evaluate**:
- `HAS_SERVICE_USERS_STRONG_AUTH = TRUE` on `SECURITY_HEALTH_SCORE_DAILY`
- Check `V_SF_ADMIN_CURR` for service-type users with `HAS_RSA_KEY = 'NO KEY'` and `HAS_PW = 'HAS PW'`

---

## Tier 2: Network & Data Protection

### 6. Network Policies

**What**: IP allow/block lists that restrict which network addresses can connect to the Snowflake account.

**Why It Matters**: Without network policies, Snowflake accounts are accessible from any IP address on the internet. Network policies provide defense-in-depth by limiting the attack surface to known, trusted network locations.

**Snowflake Best Practice**:
- Configure an account-level network policy with corporate IP ranges and VPN egress IPs
- Use network rules (newer feature) for more granular control including private endpoint restrictions
- Apply user-level network policies to further restrict ACCOUNTADMIN users
- Review and update IP lists quarterly or when network infrastructure changes
- Consider blocking all public IPs if PrivateLink is configured (private-only access)

**How to Evaluate**:
- `HAS_NETWORK_POLICY_CONFIGURED = TRUE` on `SECURITY_HEALTH_SCORE_DAILY`
- Check `NETWORK_POLICIES` table for policy count, whether network rules are used, and creation dates
- Multiple policies (account + user-level) indicate mature implementation

---

### 7. PrivateLink / Private Connectivity

**What**: Private network connectivity via AWS PrivateLink, Azure Private Link, or GCP Private Service Connect. Traffic between customer VPC/VNet and Snowflake never traverses the public internet.

**Prerequisite**: Business Critical edition or higher.

**Why It Matters**: PrivateLink eliminates exposure of data in transit to the public internet. For regulated industries, private connectivity is often a compliance requirement.

**Snowflake Best Practice**:
- Configure both inbound PrivateLink (client to Snowflake) and outbound PrivateLink (Snowflake to customer services)
- Block public access via network policy once PrivateLink is fully configured
- Ensure internal stages, Snowsight, and other Snowflake services route through PrivateLink
- Document the PrivateLink endpoints for internal teams

**How to Evaluate**:
- `SERVICE_LEVEL = 'Business Critical'` is prerequisite
- `HAS_PRIVATELINK_INBOUND = TRUE` indicates client connectivity is private
- `HAS_PRIVATELINK_OUTBOUND = TRUE` indicates Snowflake-initiated connections are private
- Both should be TRUE for complete implementation

**Industry Considerations**:
- **Financial Services / Public Sector**: PrivateLink is effectively required for production data
- **Healthcare**: Strongly recommended for PHI workloads
- **Others**: Depends on data sensitivity and organizational security requirements

---

### 8. Dynamic Data Masking (DDM)

**What**: Column-level masking policies that return masked values (NULL, fixed string, partial mask) to unauthorized roles while showing actual values to authorized roles.

**Why It Matters**: Without masking, any user with SELECT access to a table can see all column values including sensitive data. Masking enforces column-level security independent of table grants.

**Snowflake Best Practice**:
- Run data classification first to identify sensitive columns
- Create masking policies using `CURRENT_ROLE()` or `IS_ROLE_IN_SESSION()` for authorization decisions
- Use full masking (return NULL or fixed string) for highly sensitive data
- Use partial masking (show last 4 digits) for fields that need to be identifiable but not fully visible
- Apply policies to all sensitive columns, not just a subset
- Document which roles have unmasked access and why

**How to Evaluate**:
- `MASKING_POLICIES > 0` on `GOVERNED_ACCOUNTS` indicates at least some masking exists
- `MASKING_POLICIES >= 10` with `TOTAL_MASKING_POLICIES >= 20` suggests comprehensive coverage
- Cross-reference with data classification: if many tagged columns exist but few are masked, there is a gap

---

### 9. Row Access Policies

**What**: Row-level security policies that filter table rows based on the querying user's role, department, region, or other attributes.

**Why It Matters**: Without row access policies, granting SELECT on a table gives access to ALL rows. Row-level security enables fine-grained access without creating separate tables per department/region/tenant.

**Snowflake Best Practice**:
- Use mapping tables (not hardcoded role names) to determine row-level access
- Apply to multi-tenant tables, department-scoped data, and shared data products
- Combine with masking policies for comprehensive data protection (column + row level)
- Test thoroughly - row access policies can impact query performance on very large tables

**How to Evaluate**:
- `ROW_ACCESS_POLICIES > 0` on `GOVERNED_ACCOUNTS`
- Relevance depends on data architecture: not all customers need row-level security
- Multi-tenant SaaS providers and organizations with department-level data isolation need this

---

### 10. Tag-Based Masking

**What**: Masking policies assigned to tags rather than individual columns. When a column is tagged (e.g., `PII`), it automatically inherits the masking policy.

**Why It Matters**: Manual per-column masking becomes unmanageable at scale. Tag-based masking automates policy application based on data classification.

**Snowflake Best Practice**:
- Run `SYSTEM$CLASSIFY` to auto-tag columns with sensitivity classifications
- Create masking policies attached to system tags or custom tags
- New columns tagged via classification automatically inherit masking
- Recommended for organizations with 50+ sensitive columns

**How to Evaluate**:
- `TBM_POLICIES > 0` on `GOVERNED_ACCOUNTS`
- Most relevant when DDM is already in place and needs to scale
- `ASSIGNED_TAGS > 0` is a prerequisite (tags must exist before tag-based masking)

---

### 11. Tri-Secret Secure

**What**: Customer-managed encryption keys (CMEK) where a composite encryption key is created from the customer's KMS key and Snowflake's key. Customer can revoke their key to make data unreadable.

**Prerequisite**: Business Critical edition.

**Why It Matters**: Provides customer control over data-at-rest encryption. The customer can revoke access at any time. Required by some compliance frameworks.

**How to Evaluate**:
- `HAS_TRI_SECRET_SECURE = TRUE` on `SECURITY_HEALTH_SCORE_DAILY`
- Only applicable to Business Critical accounts
- Common in Financial Services, Public Sector, and organizations with strict data sovereignty requirements

---

### 12. Data Classification

**What**: Automated discovery and classification of sensitive data columns using Snowflake's built-in `SYSTEM$CLASSIFY` function.

**Why It Matters**: You cannot protect what you do not know about. Classification provides an inventory of sensitive data, which is prerequisite for effective masking, access control, and compliance reporting.

**Snowflake Best Practice**:
- Run `SYSTEM$CLASSIFY` on all databases/schemas containing user data
- Review classification results and create custom classifiers for domain-specific sensitive data
- Use classification results to drive tag-based masking policies
- Re-run classification periodically as new data sources are added

**How to Evaluate**:
- `ASSIGNED_TAGS > 0` on `GOVERNED_ACCOUNTS` indicates classification has been run
- Cross-reference with masking: classified columns without masking policies indicate a gap

---

## Tier 3: RBAC & Governance

### 13. ACCOUNTADMIN Sprawl

**What**: Excessive number of users granted the ACCOUNTADMIN role, which has unrestricted access to everything in the account.

**This is Snowflake's most common and dangerous RBAC anti-pattern.**

**Snowflake Best Practice**:
- Maximum 3-5 ACCOUNTADMIN users (designated platform administrators only)
- ALL ACCOUNTADMIN users must have MFA
- ACCOUNTADMIN should not be used for day-to-day operations
- Use SYSADMIN for object management, SECURITYADMIN for access management
- Audit ACCOUNTADMIN grants quarterly

**How to Evaluate**:
- Query `V_SF_ADMIN_CURR` and count users where `ACCOUNT_ADMIN = 'YES'`
- Healthy: 1-5 users; Warning: 6-15 users; Critical: >15 users
- **CRITICAL**: Any ACCOUNTADMIN user with `HAS_MFA = 'NO MFA'` is an immediate risk
- Check if ACCOUNTADMIN users are logging in with ACCOUNTADMIN as their default role (anti-pattern)

---

### 14. Role Hierarchy Under SYSADMIN

**What**: All custom object-access roles should roll up to SYSADMIN in the role hierarchy. Roles granted directly to ACCOUNTADMIN (bypassing SYSADMIN) create governance gaps.

**Snowflake Best Practice**:
- Standard hierarchy: ACCOUNTADMIN -> SYSADMIN -> [all custom roles]
- SECURITYADMIN manages role creation and grants (separate from SYSADMIN)
- Custom roles should be organized in a tree: functional roles (ETL_ROLE, ANALYTICS_ROLE) granted to SYSADMIN
- No custom roles should be granted directly to ACCOUNTADMIN
- Use database roles for object-level access patterns

**How to Evaluate**:
- Query `V_SF_ROLES_CURR` to build the role hierarchy tree
- Identify roles with no path to SYSADMIN (orphan roles)
- Healthy: 0 orphan roles; Warning: 1-10; Critical: >10
- Check if roles are granted directly to ACCOUNTADMIN via `V_SF_ROLE_GRANT_CURR`

---

### 15. Object Ownership Concentration

**What**: All or most database objects owned by a single role (typically SYSADMIN or ACCOUNTADMIN) rather than distributed across functional roles.

**Snowflake Best Practice**:
- Create dedicated object-ownership roles per data domain (RAW_DATA_OWNER, CURATED_DATA_OWNER, etc.)
- Each team or data domain should have its own role hierarchy
- SYSADMIN should inherit access via the role hierarchy, not own objects directly
- Object ownership roles should be granted to SYSADMIN for centralized management

**How to Evaluate**:
- Query `V_SF_ROLES_CURR` for total role count and parent role diversity
- Healthy: 20+ roles with 3+ distinct parent roles
- Warning: 10-19 roles
- Critical: <10 roles (suggests flat, concentrated ownership)
- Note: Deep detection requires `ADHOC_TABLE_OWNERSHIP_BY_USER` (282B rows, use with caution)

---

### 16. Trust Center

**What**: Snowflake Trust Center security scanner packages enabled for continuous monitoring of security posture, misconfigurations, and threats.

**Snowflake Best Practice**:
- Enable all available scanner packages (Security Essentials, CIS Benchmark, Threat Intelligence)
- Review findings on a regular schedule (weekly or bi-weekly)
- Integrate Trust Center findings into security operations workflow
- Use Trust Center as an ongoing health check, not a one-time audit

**How to Evaluate**:
- `HAS_TRUST_CENTER_PACKAGES_ENABLED = TRUE` on `SECURITY_HEALTH_SCORE_DAILY`
- Trust Center is free and built into Snowflake - there is no reason not to enable it

---

## ACE Conversation Guide

When reviewing security milestones with an ACE, the platform should:

1. **Start with what we know**: Present the quantitative milestone status (pass/fail/partial for each)
2. **Flag critical gaps first**: ACCOUNTADMIN without MFA, no SSO, no network policies
3. **Ask targeted questions**: Based on gaps, use the `open_questions` from the YAML to understand context
4. **Accept ACE input**: The ACE can mark milestones as `in_progress`, `planned`, `not_applicable`, or `blocked`
5. **Generate recommendations**: Prioritized next steps based on industry requirements, gap severity, and ACE feedback

### Priority Order for Recommendations:
1. ACCOUNTADMIN users without MFA (always #1 regardless of industry)
2. Critical gaps in industry-required milestones
3. SSO not configured (foundational - everything else builds on this)
4. Network policies missing (basic perimeter control)
5. No masking on sensitive data (data protection)
6. Remaining high-priority gaps
7. Recommended milestones not yet started

---

## Data Source Quick Reference

| Source | Table | What It Provides |
|---|---|---|
| Security Health | `SNOWSCIENCE.DB_SECURITY.SECURITY_HEALTH_SCORE_DAILY` | Boolean flags for 9 security milestones + maturity scores |
| User Health | `SNOWSCIENCE.DB_SECURITY.DAILY_USER_HEALTH` | Per-user security posture + SSO provider identification |
| Governance | `SNOWSCIENCE.DATA_GOVERNANCE.GOVERNED_ACCOUNTS` | Masking, row access, tag-based masking, tag counts |
| Network Policies | `SNOWSCIENCE.DB_SECURITY.NETWORK_POLICIES` | Policy details, IP lists, network rule usage |
| Admin Users | `SALES.CX_INSIGHTS.V_SF_ADMIN_CURR` | Admin role assignments, MFA status, health |
| Role Hierarchy | `SALES.CX_INSIGHTS.V_SF_ROLES_CURR` | Role tree structure, parent-child relationships |
| Role Grants | `SALES.CX_INSIGHTS.V_SF_ROLE_GRANT_CURR` | Role-to-role grant relationships |
| Customer Profile | `SALES.CX_INSIGHTS.V_CUST_CURR` | Industry, segment, tenure, team assignments |
| SE Comments | `FIVETRAN.SALESFORCE.USE_CASE_C` | `USE_CASE_COMMENTS_C` - timestamped SE diary entries |
| Gong Calls | `FIVETRAN.SALESFORCE.GONG_GONG_CALL_C` | Call briefs, key points, topics, action items |
| Account Notes | `SALES.RAVEN.USE_CASE_EXPLORER_ACCOUNT` | AE notes, CS notes, risk fields |
| Compliance | `FIVETRAN.SALESFORCE.ACCOUNT` | Industry, compliance fields, security specialization |
