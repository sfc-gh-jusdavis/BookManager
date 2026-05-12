-- TABLE: TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES
-- Per-user and per-role flag overrides. Resolution order at runtime:
--   user override -> role override -> default_enabled.
-- Synced from registry's enable_for_users / enable_for_roles via
-- scripts/sync_feature_flags.py.

create or replace TABLE BKMNG_FEATURE_FLAG_OVERRIDES (
    FLAG_KEY VARCHAR(16777216) NOT NULL,
    TARGET_TYPE VARCHAR(16777216) NOT NULL,
    TARGET_VALUE VARCHAR(16777216) NOT NULL,
    ENABLED BOOLEAN,
    CREATED_AT TIMESTAMP_NTZ(9) DEFAULT CURRENT_TIMESTAMP(),
    primary key (FLAG_KEY, TARGET_TYPE, TARGET_VALUE)
);
