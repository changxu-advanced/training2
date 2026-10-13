#!/usr/bin/env bash
set -euo pipefail
base="${1:-origin/main}"
git rev-parse --verify "$base^{commit}" >/dev/null
for scope in public private; do
  current="schemas/openapi/$scope.json"
  if git cat-file -e "$base:$current" 2>/dev/null; then
    previous="/tmp/training2-base-$scope.json"
    git show "$base:$current" > "$previous"
    oasdiff breaking "$previous" "$current" --fail-on ERR
  else
    echo "First $scope API contract: no prior specification to compare."
  fi
done
