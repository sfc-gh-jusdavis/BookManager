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
  // In-flight WIP placeholder; remove if abandoned for >1 quarter.
  ace_impact_metrics: {
    description: "ACE account impact metrics panel on settings page",
    category: "experimental",
    default_enabled: false,
    enable_for_users: ["jusdavis"],
  },
  ace_chat_floating: {
    description: "Floating Ask ACE chat widget on all pages",
    category: "experimental",
    default_enabled: false,
    enable_for_users: ["jusdavis"],
  },
  ace_chat_panel: {
    description: "ACE assistant tab on account detail page",
    category: "experimental",
    default_enabled: false,
    enable_for_users: ["jusdavis"],
  },

  // ===== Admin =====
  admin_costs_page: {
    description: "Admin cost dashboard at /admin/costs",
    category: "admin",
    default_enabled: true,
    enable_for_users: ["jusdavis"],
  },

  // ===== Core - page-level route gates (each verified to have an active call site) =====
  page_dashboard: { description: "Home dashboard route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_accounts_list: { description: "Accounts list route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_account_detail: { description: "Account detail route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_forecasts: { description: "Forecasts route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_tmrs: { description: "TMRs route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_team: { description: "Team route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_team_detail: { description: "Team detail route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_ace: { description: "Ask ACE route", category: "core", default_enabled: false, enable_for_users: ["jusdavis"] },
  page_timeline: { description: "Global timeline route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_alerts: { description: "Alerts inbox route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },
  page_settings: { description: "Settings route", category: "core", default_enabled: true, enable_for_users: ["jusdavis"] },

  // ===== Beta =====
  security_posture_checklist: {
    description: "Security posture checklist tile on account page",
    category: "beta",
    default_enabled: true,
    enable_for_users: ["jusdavis"],
  },
} as const satisfies Record<string, FlagDef>;

export type FlagKey = keyof typeof FEATURE_FLAGS;
