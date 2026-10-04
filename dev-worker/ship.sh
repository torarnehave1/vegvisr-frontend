#!/usr/bin/env bash
# test -> deploy -> test. The deploy does not happen if the first test fails.
#
# This exists because discipline kept losing. On 2026-10-04 a tool passed every unit test and was
# broken in production ("input is not defined" — the dispatch bound a different variable), and a
# static import silently took 65 assertions offline. Both were found by hand, late. A gate finds
# them every time, without anyone remembering to look.
#
#   ./ship.sh            full cycle
#   ./ship.sh --dry      tests only, no deploy
set -euo pipefail
cd "$(dirname "$0")"

echo "── 1/3  unit tests ──────────────────────────────────────────"
if ! node --test test/*.test.mjs 2>&1 | tail -20; then
  echo "✗ unit tests failed — NOT deploying"
  exit 1
fi
# node --test exits non-zero on failure, but it is piped above, so check it directly.
node --test test/*.test.mjs > /dev/null 2>&1 || { echo "✗ unit tests failed — NOT deploying"; exit 1; }
echo "✓ unit tests green"

if [ "${1:-}" = "--dry" ]; then
  echo "— dry run, stopping before deploy —"
  exit 0
fi

echo
echo "── 2/3  deploy ──────────────────────────────────────────────"
npx wrangler deploy | tail -3

echo
echo "── 3/3  live smoke against the deployed worker ──────────────"
node test/smoke-live.mjs
