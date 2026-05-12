// Source of truth for all feature flags.
// Mirror: backend/app/feature_flags/registry.py (must be kept in sync — sync script reads the Python file).
//
// Adding a new flag (REQUIRED for any new feature):
//   1. Add an entry below with default_enabled: false and enable_for_users: ["jusdavis"]
//   2. Wrap your UI: const enabled = useFeatureFlag("your_key");
//   3. Run `make sync-flags` (auto-run on `make up-detach`)
//
// Pre-commit will block commits that:
//   - reference an unregistered key
//   - add a new component/page without a useFeatureFlag check
//   - add a new flag with default_enabled !== false or missing jusdavis user override

export type FlagDef = {
  description: string;
  category: "experimental" | "beta" | "admin" | "core";
  default_enabled: boolean;
  enable_for_users?: string[];
  enable_for_roles?: string[];
};

export const FEATURE_FLAGS = {
  // ===== Experimental (off for all by default) =====
  ace_chat_v2: {
    description: "ACE chat panel with NBA context (RavenChat)",
    category: "experimental",
    default_enabled: false,
    enable_for_users: ["jusdavis"],
  },
  meeting_prep_v2: {
    description: "New meeting prep view layout and AI suggestions",
    category: "experimental",
    default_enabled: false,
    enable_for_users: ["jusdavis"],
  },
  composite_patterns: {
    description: "Composite signal pattern alerts",
    category: "experimental",
    default_enabled: false,
    enable_for_users: ["jusdavis"],
  },
  nba_panel: {
    description: "Next Best Action recommendations panel",
    category: "experimental",
    default_enabled: false,
    enable_for_users: ["jusdavis"],
  },

  ace_impact_metrics: {
    description: "ACE account impact metrics panel on settings page",
    category: "experimental",
    default_enabled: false,
    enable_for_users: ["jusdavis"],
  },

  // ===== Beta (on for all, override-able) =====
  security_posture_checklist: {
    description: "Security posture checklist tile on account page",
    category: "beta",
    default_enabled: true,
    enable_for_users: ["jusdavis"],
  },
  ai_assessments_panel: {
    description: "AI-powered account assessments tile",
    category: "beta",
    default_enabled: true,
    enable_for_users: ["jusdavis"],
  },
  timeline_v2: {
    description: "Redesigned notes timeline with stats column",
    category: "beta",
    default_enabled: true,
    enable_for_users: ["jusdavis"],
  },
  forecasts_advanced: {
    description: "Advanced FY-quarter forecast tiles",
    category: "beta",
    default_enabled: true,
    enable_for_users: ["jusdavis"],
  },
  use_case_breakdowns: {
    description: "AI-parsed use case breakdowns panel",
    category: "beta",
    default_enabled: true,
    enable_for_users: ["jusdavis"],
  },

  // ===== Admin =====
  admin_costs_page: {
    description: "Admin cost dashboard at /admin/costs",
    category: "admin",
    default_enabled: true,
    enable_for_users: ["jusdavis"],
  },

  // ===== Core (retroactive coverage — pages + major panels) =====
  page_dashboard: { description: "Home dashboard route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_accounts_list: { description: "Accounts list route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_account_detail: { description: "Account detail route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_forecasts: { description: "Forecasts route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_tmrs: { description: "TMRs route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_team: { description: "Team route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_team_detail: { description: "Team detail route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_ace: { description: "Ask ACE route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_timeline: { description: "Global timeline route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_alerts: { description: "Alerts inbox route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_settings: { description: "Settings route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },

  panel_meeting_prep: { description: "MeetingPrepView component", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_notes_timeline: { description: "NotesTimeline component", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_ai_chat: { description: "AIChatPanel component", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_use_case_updates: { description: "UseCaseUpdatesPanel component", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_health_alerts: { description: "AlertsTile (health)", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_health_engagement: { description: "EngagementTile (health)", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_health_adoption: { description: "AdoptionTile (health)", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_health_security: { description: "SecurityTile (health)", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_ace_chat: { description: "ACEChat component", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_raven_chat: { description: "RavenChat component", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_acem_dashboard: { description: "ACEMDashboard component", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_ace_dashboard: { description: "ACEDashboard component", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  panel_breakdown_section: { description: "BreakdownSection (Gantt)", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
} as const satisfies Record<string, FlagDef>;

export type FlagKey = keyof typeof FEATURE_FLAGS;
