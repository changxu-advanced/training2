#!/usr/bin/env bash
set -euo pipefail
test -f /.dockerenv
node --version
pnpm --version
psql -v ON_ERROR_STOP=1 -c 'SELECT current_database();'
codex --version
