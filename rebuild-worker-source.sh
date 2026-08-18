#!/usr/bin/env bash
# Turn a deployed worker bundle (from pull-deployed-worker.sh) back into maintainable source.
#
# The bundle is esbuild output. The worker's own code is the final `// index.js` section; npm
# imports are inlined above it, and esbuild adds name-preservation wrappers in TWO forms:
#
#   statement:  __name(myFn, "myFn");
#   inline:     var json = /* @__PURE__ */ __name((a, b) => ..., "json");
#
# Both must go. Stripping only the statement form leaves `__name` referenced but undefined — its
# declaration lives in the two-line bundle preamble that this script discards — and the worker then
# throws ReferenceError at module load. `node --check` does NOT catch that: the syntax is valid.
# Found the hard way on vemotion-worker, 2026-08-17, with 28 inline wrappers.
#
# The inline form is unwrapped by scanning parentheses (skipping strings) rather than by regex, so
# nested calls and commas inside the expression survive. Occurrences inside comments and strings
# are left alone.
#
# Usage: ./rebuild-worker-source.sh <bundle> <output> [import-line ...]
set -euo pipefail
BUNDLE="${1:?usage: rebuild-worker-source.sh <bundle> <output> [import-line ...]}"
OUT="${2:?missing output path}"
shift 2
python3 - "$BUNDLE" "$OUT" "$@" <<'PY'
import sys, re
bundle, out = sys.argv[1], sys.argv[2]
imports = sys.argv[3:]
s = open(bundle, errors='ignore').read()

i = s.find('\n// index.js\n')
if i == -1:
    print('  no "// index.js" marker — cannot separate own source from bundled deps', file=sys.stderr)
    sys.exit(1)
own = s[i + len('\n// index.js\n'):]

# 1. statement form
kept, n_stmt, n_map = [], 0, 0
for line in own.split('\n'):
    st = line.strip()
    if re.fullmatch(r'__name\([\w$]+, "[^"]*"\);', st):
        n_stmt += 1; continue
    if st.startswith('//# sourceMappingURL='):
        n_map += 1; continue
    kept.append(line)
body = '\n'.join(kept)

# 2. inline form:  const NAME = /* @__PURE__ */ __name(EXPR, "NAME")
#
# Do NOT try to find the closing paren by counting brackets. JavaScript regex literals break it:
# `text.match(/\[/g)` contributes an unmatched `[`, the depth never returns to zero, and the
# occurrence is silently skipped (norwegian-transcription-worker, 12 of 13 missed). Telling a regex
# from a division needs real parsing.
#
# Instead use the fact that esbuild always terminates the wrapper with the SAME identifier it is
# naming: `, "NAME")`. That string is unique to the pair, so it locates the end without parsing.
WRAPPER = re.compile(
    r'((?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*=\s*)(?:/\*\s*@__PURE__\s*\*/\s*)?__name\('
)
n_inline, guard = 0, 0
while guard < 10000:
    guard += 1
    m = WRAPPER.search(body)
    if not m:
        break
    name = m.group(2)
    term = f', "{name}")'
    e = body.find(term, m.end())
    if e == -1:
        print(f'  WARNING: no terminator {term!r} for {name} — left as is', file=sys.stderr)
        body = body[:m.start()] + m.group(1) + '__NAMEKEEP__(' + body[m.end():]
        continue
    body = body[:m.start()] + m.group(1) + body[m.end():e] + body[e + len(term):]
    n_inline += 1
body = body.replace('__NAMEKEEP__(', '__name(')

body = body.strip('\n')

header = [
    '// Recovered from the DEPLOYED worker on Cloudflare, because the local source was lost.',
    '// esbuild artefacts undone: inlined npm dependencies removed, imports restored below, and the',
    '// name-preservation wrappers stripped. Variable names may differ from the original where',
    '// esbuild renamed to avoid collisions, and the original comments are gone.',
    '',
]
text = '\n'.join(header + imports + ([''] if imports else []) + [body]) + '\n'
open(out, 'w').write(text)

leftover = len(re.findall(r'\b__name\s*\(|\b__defProp\b|\b__publicField\b', text))
print(f'  {out}: {text.count(chr(10))} lines  (stripped {n_stmt} statement + {n_inline} inline wrappers, {n_map} sourceMappingURL)')
if leftover:
    print(f'  WARNING: {leftover} esbuild helper reference(s) remain — the file will throw at load. Inspect.')
else:
    print('  no esbuild helper references remain')
PY
node --check "$OUT" && echo "  syntax: OK"
