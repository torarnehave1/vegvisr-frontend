#!/usr/bin/env bash
# Bundle the World graph proxy into ONE file, the shape a WORLD_TEMPLATES template must have:
# Agent-Builder uploads the KV value as a single ES module, with no imports left in it.
#
#   ./build.sh              → dist/world-graphs-proxy.js
#   ./build.sh --push <id>  → also writes it to the WORLD_TEMPLATES namespace <id> as
#                             template:world-graphs-proxy (then re-provision each World with force)
set -euo pipefail
cd "$(dirname "$0")"
ESBUILD=../../node_modules/.bin/esbuild
mkdir -p dist
"$ESBUILD" index.js --bundle --format=esm --platform=neutral --target=es2022 --outfile=dist/world-graphs-proxy.js --log-level=warning
if grep -qE '^\s*import ' dist/world-graphs-proxy.js; then echo "✗ bundle still has imports"; exit 1; fi
echo "✓ dist/world-graphs-proxy.js ($(wc -c < dist/world-graphs-proxy.js) bytes)"
if [ "${1:-}" = "--push" ]; then
  : "${2:?usage: ./build.sh --push <WORLD_TEMPLATES namespace id>}"
  npx wrangler kv key put "template:world-graphs-proxy" --path dist/world-graphs-proxy.js --namespace-id "$2" --remote
fi
