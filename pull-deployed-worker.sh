#!/usr/bin/env bash
# Recover a worker's SOURCE from what is actually running in production.
#
# Why this exists: `wrangler deploy` ships the working tree, not git. Several workers here have
# been deployed from a tree that was later lost or overwritten, so production contains code that
# exists nowhere on disk. Deploying such a worker from the local file SILENTLY DELETES live
# functionality. Discovered 2026-08-17: email-worker's Cloudflare Email Service handlers
# (/send-cf-email, /email-destinations) and 10 of vemotion-worker's /vemotion/* endpoints were
# live in production and absent locally.
#
# Cloudflare returns the deployed bundle as readable, non-minified esbuild output wrapped in a
# multipart body. The worker's own source is the final section, marked `// index.js`. Everything
# before it is bundled node_modules.
#
# This recovers the BUNDLE, not the original file layout: a multi-file worker comes back as one
# file with its imports inlined. That is still the truth of what is running, and it is a far
# better starting point than stale source.
#
# Usage:  ./pull-deployed-worker.sh <worker-name> [output-file]
#         ./pull-deployed-worker.sh email-worker email-worker/index.deployed.js

set -euo pipefail

WORKER="${1:?usage: pull-deployed-worker.sh <worker-name> [output-file]}"
OUT="${2:-${WORKER}.deployed.js}"
ACCOUNT="${CF_ACCOUNT_ID:-5d9b2060ef095c777711a8649c24914e}"

# Token: prefer the environment, fall back to the one agent-worker uses.
TOKEN="${CF_API_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOMLPATH="$(dirname "$0")/../Agent-Builder/worker/wrangler.toml"
  [ -f "$TOMLPATH" ] && TOKEN="$(grep -E '^CF_API_TOKEN' "$TOMLPATH" | cut -d'"' -f2)"
fi
[ -z "$TOKEN" ] && { echo "No CF_API_TOKEN in env and none found in Agent-Builder/worker/wrangler.toml" >&2; exit 1; }

RAW="$(mktemp)"
trap 'rm -f "$RAW"' EXIT

curl -sf "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${WORKER}" \
  -H "Authorization: Bearer ${TOKEN}" -o "$RAW" \
  || { echo "Could not fetch ${WORKER} — is the name right? (wrangler.toml 'name', not the directory)" >&2; exit 1; }

python3 - "$RAW" "$OUT" "$WORKER" <<'PY'
import re, sys
raw_path, out_path, worker = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(raw_path, errors='ignore').read()

if s.lstrip().startswith('{'):
    print(f'  {worker}: API returned JSON, not a script bundle — check permissions.', file=sys.stderr)
    sys.exit(1)

# Strip the multipart wrapper: drop everything up to the first blank line after the headers,
# and the trailing boundary.
body = s
m = re.search(r'Content-Disposition:[^\n]*\n(?:[^\n]*\n)*?\n', s)
if m:
    body = s[m.end():]
body = re.sub(r'\n--[0-9a-f]{20,}--\s*$', '\n', body)

# The worker's own source is the last esbuild section.
idx = body.rfind('\n// index.js\n')
own = body[idx+1:] if idx != -1 else None

open(out_path, 'w').write(body)
lines = body.count('\n')
print(f'  {worker}: {len(body)} chars, {lines} lines -> {out_path}')
if own:
    print(f'    own source starts at the "// index.js" marker: {own.count(chr(10))} lines (the rest is bundled node_modules)')
else:
    print('    no "// index.js" marker found — the whole file may be the source, or the bundle is laid out differently')
PY

node --check "$OUT" 2>/dev/null && echo "    syntax: OK" || echo "    syntax: FAILED — inspect before trusting"
