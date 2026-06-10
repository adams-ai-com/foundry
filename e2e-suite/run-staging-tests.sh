#!/bin/bash
# run-staging-tests.sh — verify Coolify STAGING containers with the e2e suite.
# Seed of the staging→production promotion runner: per converted app, points
# the app's spec at its staging port + staging DB and runs it.
#
# Usage: ./run-staging-tests.sh [spec...]   (default: all converted apps)
# Run as the foundry user on foundry-srv.
set -euo pipefail
cd "$(dirname "$0")"
export HOME=${HOME:-/home/foundry}

env_value() { grep -m1 "^$2=" "$1" | cut -d= -f2-; }

# Per converted app: <APP>_BASE = staging container port, <APP>_DB_URL =
# staging DB. Each app's spec reads these (falls back to live prod otherwise).
stg_db() { echo "$(env_value "/var/www/foundry/apps/$1/.env" DATABASE_URL)" | sed "s|/foundry_$1\$|/foundry_${1}_staging|"; }

# wiki — staging 4005
export WIKI_BASE="http://127.0.0.1:4005";   export WIKI_DB_URL=$(stg_db wiki)
# docs — staging 4001
export DOCS_BASE="http://127.0.0.1:4001";   export DOCS_DB_URL=$(stg_db docs)
# sheets — staging 4002
export SHEETS_BASE="http://127.0.0.1:4002"; export SHEETS_DB_URL=$(stg_db sheets)

# Default: every converted app's spec. Override with explicit spec args.
SPECS=${@:-specs/wiki.spec.ts specs/docs.spec.ts specs/sheets.spec.ts}
exec ./node_modules/.bin/playwright test $SPECS --reporter=line
