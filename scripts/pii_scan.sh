#!/usr/bin/env bash
# PII scan: blocks any commit that introduces internal company email domains
# outside the snowflake_service.py allowlist.
#
# Mirrors .github/workflows/ci.yml pii-check job so the same gate fires
# locally (Pattern 4: tighten the feedback loop).
set -e

PATTERN='@snowflake\.com|@sfc\.com'
# Single allowed line: functional SQL filter excluding internal users from
# customer-facing query results.
ALLOWED='backend/app/services/snowflake_service.py'

MATCHES=$(git grep -nE "$PATTERN" -- ':(exclude)*.lock' ':(exclude)_archive/**' ':(exclude).snowflake/**' || true)
UNEXPECTED=$(echo "$MATCHES" | grep -vE "^${ALLOWED}:" || true)

if [ -n "$UNEXPECTED" ]; then
  echo "PII scan blocked the commit:"
  echo "$UNEXPECTED"
  echo ""
  echo "See CONTRIBUTING.md Privacy Rules. Move to BKMNG_USERS or use synthetic placeholders (alice@example.com)."
  exit 1
fi
echo "PII scan clean"
