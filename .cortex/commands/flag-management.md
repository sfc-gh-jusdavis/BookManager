Manage BookManager feature flags. Covers add, enable, disable, audit, and remove operations across the dual-registry system.

## System Overview

| Artifact | Path | Role |
|----------|------|------|
| Python registry | `backend/app/feature_flags/registry.py` | Sync source of truth (read by sync script) |
| TypeScript registry | `bkmng-next/lib/flags.ts` | Developer-facing registry + client-side fallback |
| Sync script | `scripts/sync_feature_flags.py` | MERGE into Snowflake (idempotent) |
| Pre-commit validator | `scripts/validate_flags.py` | Parity check, new-flag rules, call-site checks |
| API router | `backend/app/routers/feature_flags.py` | CRUD + resolution endpoint |
| React context | `bkmng-next/context/FeatureFlagContext.tsx` | `useFeatureFlag()` hook, 60s cache |
| Gate components | `bkmng-next/components/ui/flag-gate.tsx` | `withFlagGate` HOC, `FlagGate` inline |
| Flags table | `TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS` | Flag definitions |
| Overrides table | `TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES` | Per-user/role overrides |

Resolution order: `COALESCE(user_override, role_override, default_enabled)`.

Categories: `experimental` (off by default, dev-only), `beta` (on by default, limited scope), `core` (page-level gates), `admin` (admin-only features).

## Scope Question (MANDATORY)

Before ANY add, enable, or disable operation, ask the user:

> **What scope should this flag change apply to?**
> - **All users** — change `default_enabled` only, no user overrides
> - **Specific users** — set `default_enabled` to the opposite, add overrides for named users
> - **Just me (jusdavis)** — set `default_enabled` to the opposite, add override for jusdavis only

The answer determines whether `enable_for_users` is set in the registry and whether overrides are seeded in Snowflake. Do NOT assume scope — always ask.

## Operations

### 1. Add a New Flag

0. **Ask scope** (see Scope Question above).
1. Choose a `snake_case` key and category.
2. Add to **Python registry** (`registry.py`) under the correct category section:
   - **All users**: `"default_enabled": False` (no `enable_for_users`).
   - **Specific users**: `"default_enabled": False, "enable_for_users": ["user1", "user2"]`.
   - **Just me**: `"default_enabled": False, "enable_for_users": JUSDAVIS`.
3. Add **identical** entry to **TypeScript registry** (`flags.ts`).
4. Add `useFeatureFlag("key")` in the component being gated:
   - **Page-level**: use `withFlagGate(PageComponent, "key")` (see existing pages for pattern).
   - **Inline section**: `const enabled = useFeatureFlag("key"); if (!enabled) return null;`
   - **Sidebar nav item**: add filter in `Sidebar.tsx` `visibleItems`: `if (item.href === "/path" && !flagEnabled) return false;`
5. Run `make sync-flags`.
6. Verify:
   ```sql
   SELECT * FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS WHERE FLAG_KEY = '<key>';
   SELECT * FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES WHERE FLAG_KEY = '<key>';
   ```

### 2. Enable a Flag (change default to true)

1. Set `default_enabled` to `True`/`true` in **both** registries.
2. Run `make sync-flags`.
3. Verify: `SELECT FLAG_KEY, DEFAULT_ENABLED FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS WHERE FLAG_KEY = '<key>';`
4. Note: existing user overrides still take precedence. Check overrides if unexpected behavior persists.

### 3. Disable a Flag (change default to false)

0. **Ask scope** (see Scope Question above).
1. Set `default_enabled` to `False`/`false` in **both** registries.
2. Based on scope:
   - **All users**: remove `enable_for_users` from the registry entry entirely. After sync, also delete any existing overrides:
     ```sql
     DELETE FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES
     WHERE FLAG_KEY = '<key>' AND TARGET_TYPE = 'user';
     ```
   - **Specific users still see it**: keep `enable_for_users: ["user1"]` in registry. Sync will seed their overrides.
   - **Just me still sees it**: keep `enable_for_users: JUSDAVIS` / `["jusdavis"]`.
3. Run `make sync-flags`.
4. Verify: `SELECT FLAG_KEY, DEFAULT_ENABLED FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS WHERE FLAG_KEY = '<key>';`

### 4. Audit Flags (status report)

1. Query current state:
   ```sql
   SELECT f.FLAG_KEY, f.CATEGORY, f.DEFAULT_ENABLED,
     LISTAGG(DISTINCT o.TARGET_TYPE || ':' || o.TARGET_VALUE || '=' || o.ENABLED, ', ') AS OVERRIDES
   FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS f
   LEFT JOIN TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES o ON o.FLAG_KEY = f.FLAG_KEY
   GROUP BY 1, 2, 3
   ORDER BY f.CATEGORY, f.FLAG_KEY;
   ```
2. Compare DB count vs Python registry count. Mismatch = orphaned DB flags (`make sync-flags` warns but does not delete).
3. Stale flag candidates: `experimental` category + `default_enabled = false` + no `useFeatureFlag()` call sites for >1 quarter. Consider removal.

### 5. Remove a Flag

1. Remove entry from **both** registries (Python + TypeScript).
2. Remove all `useFeatureFlag("key")` call sites. Remove `FlagGate`/`withFlagGate` wrappers but **keep the wrapped content** (removing a flag = feature is now always-on, or the component is deleted entirely).
3. Remove any sidebar filter conditions referencing the flag.
4. Run `make sync-flags` (reports removed key as orphan warning).
5. Clean up Snowflake:
   ```sql
   DELETE FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES WHERE FLAG_KEY = '<key>';
   DELETE FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS WHERE FLAG_KEY = '<key>';
   ```

## Validation Gates

The pre-commit hook (`scripts/validate_flags.py`) enforces:
- **Check A**: Every `useFeatureFlag('xxx')` key exists in BOTH registries. Fails on TS-Python divergence.
- **Check B**: Newly-added page/component files must include a `useFeatureFlag()` call. Bypass with `// @flag-exempt: <reason>`.
- **Check C**: New flags must have `default_enabled: false`.

CI gates (cannot merge red): Backend ruff, Frontend lint+tsc+build, PII Scan.

## Gotchas

- Registries MUST stay in sync. Pre-commit catches divergence at commit time.
- `make sync-flags` auto-runs on `make up-detach` and `make deploy`.
- The sync script seeds overrides with `ENABLED=TRUE` for users in `enable_for_users`. Changing default to false while keeping the jusdavis override means jusdavis still sees the feature.
- Resolution: `COALESCE(user_override, role_override, default_enabled)`.
- Use `SE_XS_WH` warehouse for any DDL/DML on flag tables. `SNOWADHOC` is SELECT-only.

## Dev Workflow (apply to every flag change)

Follow the standard BookManager workflow (Pattern 2 Spec-First + Karpathy P1-P4):
1. `/start-feature` -> branch
2. Make registry + component changes
3. `make sync-flags`
4. Smoke test: `make up-detach`, switch users, verify flag resolution
5. Self-review against Karpathy P1-P4 before commit
6. `git add` with explicit paths (never `git add .`)
7. Push -> PR -> CI green -> merge -> `/finish-feature`

## References

- Dev-Ops Docs: `docs/dev-ops/` (coding-principles.md, ai-dev-patterns.md, workflow.md)
- Slash Commands: `/start-feature`, `/multi-review`, `/finish-feature`
