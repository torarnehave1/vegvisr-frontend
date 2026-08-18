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

# 2. inline form — paren scan, skipping strings; ignore hits inside comments/strings
def spans_to_skip(src):
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == '/' and i+1 < n and src[i+1] == '/':
            j = src.find('\n', i); j = n if j == -1 else j; out.append((i, j)); i = j
        elif c == '/' and i+1 < n and src[i+1] == '*':
            j = src.find('*/', i+2); j = n if j == -1 else j+2; out.append((i, j)); i = j
        elif c in '"\'`':
            q, j, esc = c, i+1, False
            while j < n:
                d = src[j]
                if esc: esc = False
                elif d == '\\': esc = True
                elif d == q: break
                j += 1
            out.append((i, min(j+1, n))); i = j+1
        else: i += 1
    return out

def unwrap(src):
    skip = spans_to_skip(src)
    def inside(pos): return any(a <= pos < b for a, b in skip)
    out, i, n, cnt = [], 0, len(src), 0
    while True:
        j = src.find('__name(', i)
        while j != -1 and inside(j):
            j = src.find('__name(', j+1)
        if j == -1:
            out.append(src[i:]); break
        out.append(re.sub(r'/\*\s*@__PURE__\s*\*/\s*$', '', src[i:j]))
        k, depth, in_s, q, esc, commas = j+len('__name('), 1, False, '', False, []
        while k < n and depth > 0:
            c = src[k]
            if in_s:
                if esc: esc = False
                elif c == '\\': esc = True
                elif c == q: in_s = False
            else:
                if c in '"\'`': in_s, q = True, c
                elif c in '([{': depth += 1
                elif c in ')]}':
                    depth -= 1
                    if depth == 0: break
                elif c == ',' and depth == 1: commas.append(k)
            k += 1
        if depth != 0 or not commas:
            out.append(src[j:k+1]); i = k+1; continue
        out.append(src[j+len('__name('):commas[-1]]); cnt += 1
        i = k+1
    return ''.join(out), cnt

body, n_inline = unwrap(body)
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
