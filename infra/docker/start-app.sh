#!/usr/bin/env bash
set -Eeuo pipefail

pids=()
stop_all() {
  trap - TERM INT EXIT
  if ((${#pids[@]})); then
    kill "${pids[@]}" 2>/dev/null || true
    wait "${pids[@]}" 2>/dev/null || true
  fi
}
trap stop_all TERM INT EXIT

node apps/public-api/dist/index.js & pids+=("$!")
node apps/private-api/dist/index.js & pids+=("$!")
pnpm --filter @training2/public-frontend exec vite preview --host 0.0.0.0 --port 5173 --strictPort & pids+=("$!")
pnpm --filter @training2/private-frontend exec vite preview --host 0.0.0.0 --port 5174 --strictPort & pids+=("$!")

wait -n "${pids[@]}"
