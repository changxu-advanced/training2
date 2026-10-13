#!/usr/bin/env bash
set -euo pipefail
cd "${1:-/workspaces/training2}"
test -f /.dockerenv || { echo 'Run setup inside the development container.' >&2; exit 1; }
git config --global --add safe.directory "$(pwd)"
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm prisma:check
pnpm codegen:check
psql -v ON_ERROR_STOP=1 -c 'SELECT current_database(), version();'
echo 'Development container ready. See docs/getting-started.md.'
