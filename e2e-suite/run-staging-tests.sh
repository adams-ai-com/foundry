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

# wiki — staging container on host port 4005, content DB foundry_wiki_staging
WIKI_PROD_DB=$(env_value /var/www/foundry/apps/wiki/.env DATABASE_URL)
export WIKI_BASE="http://127.0.0.1:4005"
export WIKI_DB_URL=$(echo "$WIKI_PROD_DB" | sed 's|/foundry_wiki$|/foundry_wiki_staging|')

SPECS=${@:-specs/wiki.spec.ts}
exec ./node_modules/.bin/playwright test $SPECS --reporter=line
