#!/usr/bin/env bash
set -euo pipefail

SNOW_CONN="JDAVIS_AWS1"
POOL="BKMNG_POOL"
SERVICE="BOOKMANAGER.DEMO.BKMNG_SERVICE"
ENDPOINT="https://ar7vvu-sfsenorthamerica-jdavis-aws1.snowflakecomputing.app"

echo "BookManager SPCS — launching..."

pool_state=$(snow sql -c "$SNOW_CONN" -q "SHOW COMPUTE POOLS LIKE '$POOL'" --format json 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['state'])")

if [ "$pool_state" != "ACTIVE" ]; then
  echo "Compute pool is $pool_state — resuming..."
  snow sql -c "$SNOW_CONN" -q "ALTER COMPUTE POOL $POOL RESUME" 2>/dev/null
  for i in $(seq 1 60); do
    sleep 2
    state=$(snow sql -c "$SNOW_CONN" -q "SHOW COMPUTE POOLS LIKE '$POOL'" --format json 2>/dev/null \
      | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['state'])")
    if [ "$state" = "ACTIVE" ]; then echo "Pool is ACTIVE."; break; fi
    if [ "$i" -eq 60 ]; then echo "WARNING: Pool not active after 120s."; fi
  done
else
  echo "Compute pool is ACTIVE."
fi

svc_status=$(snow sql -c "$SNOW_CONN" \
  -q "SHOW SERVICES LIKE 'BKMNG_SERVICE' IN SCHEMA BOOKMANAGER.DEMO" --format json 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['status'])")

if [ "$svc_status" = "SUSPENDED" ]; then
  echo "Service is SUSPENDED — resuming..."
  snow sql -c "$SNOW_CONN" -q "ALTER SERVICE $SERVICE RESUME" 2>/dev/null
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
