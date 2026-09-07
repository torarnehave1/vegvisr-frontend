#!/usr/bin/env sh
# Fail if any worker source file is untracked.
#
# WHY THIS EXISTS
# ---------------
# On 2026-08-02 worker directories were deliberately untracked ("deployed via
# wrangler, not git"). On 2026-08-03 that was reversed and the blanket
# .gitignore rules were removed — but removing an ignore rule does not add a
# file. Sixty worker directories sat in git's *untracked* bucket for a month:
# `git commit -a` skips untracked files, nothing ever errors, and
# `wrangler deploy` reads the DISK, so every deploy kept succeeding. The source
# of two production auth gates existed only on one laptop.
#
# `git ls-files --others --exclude-standard` is exactly that bucket: files git
# can see, is not ignoring, and is not storing. It should always be empty for
# worker source. Anything it lists is source one `rm -rf` from gone.
#
# Ignored files (wrangler.toml, .dev.vars, node_modules, dist, .wrangler/,
# *.sql) are excluded by --exclude-standard, so secrets never trip this.
#
# Escape hatch: SKIP_WORKER_GUARD=1 git commit ...

set -eu

# Directory patterns holding deployable worker source. Add new ones here.
PATTERNS='*-worker/ client-gateway/'

# shellcheck disable=SC2086
UNTRACKED=$(git ls-files --others --exclude-standard -- $PATTERNS || true)

if [ -z "$UNTRACKED" ]; then
  exit 0
fi

COUNT=$(printf '%s\n' "$UNTRACKED" | wc -l | tr -d ' ')

cat >&2 <<EOF

  WORKER SOURCE NOT IN GIT — $COUNT file(s)

  These files are untracked: git can see them, is NOT ignoring them, and is
  NOT storing them. They deploy fine via wrangler and would be lost by a
  clean checkout or a wiped disk.

EOF
printf '%s\n' "$UNTRACKED" | sed 's/^/    /' >&2
cat >&2 <<'EOF'

  Fix — stage them, then commit again:

    git add <the paths above>

  If a path genuinely should never be tracked, add it to .gitignore instead.
  To bypass this check once:  SKIP_WORKER_GUARD=1 git commit ...

EOF
exit 1
