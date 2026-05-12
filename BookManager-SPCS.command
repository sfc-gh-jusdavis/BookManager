#!/usr/bin/env bash
set -euo pipefail

export PATH="/Users/jusdavis/.local/bin:$PATH"

SNOW_CONN="JDAVIS_AWS1"
POOL="BKMNG_POOL"
SERVICE="BOOKMANAGER.DEMO.BKMNG_SERVICE"
ENDPOINT="https://ar7vvu-sfsenorthamerica-jdavis-aws1.snowflakecomputing.app"

echo "BookManager SPCS — launching..."

_snow_show_pool() {
  local raw
  raw=$(snow sql -c "$SNOW_CONN" -q "SHOW COMPUTE POOLS LIKE '$POOL'" --format json 2>&1)
  if [ -z "$raw" ]; then
    echo "ERROR: 'snow sql' returned empty output. Check connection '$SNOW_CONN'." >&2
    echo "ERROR: Run: snow connection test $SNOW_CONN" >&2
    exit 1
  fi
  local state
  state=$(echo "$raw" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data[0]['state'] if data else 'NOT_FOUND')
except Exception as e:
    print('PARSE_ERROR: ' + str(e), file=sys.stderr)
    sys.exit(1)
" 2>&1) || { echo "ERROR: Failed to parse pool state. Raw output: $raw" >&2; exit 1; }
  echo "$state"
}

_snow_show_service() {
  local raw
  raw=$(snow sql -c "$SNOW_CONN" \
    -q "SHOW SERVICES LIKE 'BKMNG_SERVICE' IN SCHEMA BOOKMANAGER.DEMO" --format json 2>&1)
  if [ -z "$raw" ]; then
    echo "ERROR: 'snow sql' returned empty output querying service." >&2
    exit 1
  fi
  local status
  status=$(echo "$raw" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data[0]['status'] if data else 'NOT_FOUND')
except Exception as e:
    print('PARSE_ERROR: ' + str(e), file=sys.stderr)
    sys.exit(1)
" 2>&1) || { echo "ERROR: Failed to parse service status. Raw output: $raw" >&2; exit 1; }
  echo "$status"
}

pool_state=$(_snow_show_pool)

if [ "$pool_state" = "NOT_FOUND" ]; then
  echo "ERROR: Compute pool '$POOL' does not exist. Re-provisioning required." >&2
  echo "  → File a Snowhouse RITM to recreate '$POOL' under SPCS_ADMIN_RL." >&2
  exit 1
fi

if [ "$pool_state" != "ACTIVE" ]; then
  echo "Compute pool is $pool_state — resuming..."
  snow sql -c "$SNOW_CONN" -q "ALTER COMPUTE POOL $POOL RESUME"
  for i in $(seq 1 60); do
    sleep 2
    state=$(_snow_show_pool)
    if [ "$state" = "ACTIVE" ]; then echo "Pool is ACTIVE."; break; fi
    if [ "$i" -eq 60 ]; then echo "WARNING: Pool not active after 120s."; fi
  done
else
  echo "Compute pool is ACTIVE."
fi

svc_status=$(_snow_show_service)

if [ "$svc_status" = "NOT_FOUND" ]; then
  echo "ERROR: Service '$SERVICE' does not exist. Run 'make deploy' to redeploy." >&2
  exit 1
fi

if [ "$svc_status" = "SUSPENDED" ]; then
  echo "Service is SUSPENDED — resuming..."
  snow sql -c "$SNOW_CONN" -q "ALTER SERVICE $SERVICE RESUME"
elif [ "$svc_status" != "RUNNING" ]; then
  echo "Service is $svc_status — waiting for RUNNING..."
fi

echo "Waiting for endpoint to respond..."
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT" 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "302" ] || [ "$code" = "301" ]; then
    echo "Endpoint is live."
    break
  fi
  if [ "$i" -eq 90 ]; then
    echo "WARNING: Endpoint not responding after 180s. Opening anyway."
  fi
  sleep 2
done

open "$ENDPOINT"
osascript -e 'tell application "Terminal" to close front window' &>/dev/null &
