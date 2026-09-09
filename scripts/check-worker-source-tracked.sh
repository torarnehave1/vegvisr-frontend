#!/usr/bin/env sh
# Fail if worker source exists only on disk — untracked, or tracked but with
# uncommitted local edits.
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
# TWO BUCKETS, ONE RISK
# ---------------------
# 1. Untracked  — `git ls-files --others --exclude-standard`: files git can see,
#    is not ignoring, and is not storing.
# 2. Modified   — `git diff --name-only`: tracked files whose working-tree copy
#    differs from the index. The DELTA exists only on disk, and wrangler deploys
#    the disk. On 2026-09-09 both group-chat-worker and vemotion-worker were
#    running production code that was never committed — verified on their live
#    routes — while this guard reported a clean pass, because it only checked
#    bucket 1.
#
# Staged changes are NOT flagged: they are what the running commit is about to
# store. Only unstaged edits are the "disk-only" risk.
#
# SCOPE NOTE: bucket 2 can only fire locally, in the pre-commit hook. CI runs on
# a clean checkout where nothing is ever modified, so the CI job continues to
# enforce bucket 1 alone. That is not a gap to fix here — it is where each check
# can see anything.
#
# Ignored files (wrangler.toml, .dev.vars, node_modules, dist, .wrangler/,
# *.sql) are excluded by --exclude-standard, so secrets never trip bucket 1.
#
# Escape hatch: SKIP_WORKER_GUARD=1 git commit ...

set -eu

# Directory patterns holding deployable worker source. Add new ones here.
PATTERNS='*-worker/ client-gateway/'

# Workers under deliberate long-running local development are listed in
# .worker-guard-allow, one path or glob per line. They are reported as a notice
# instead of failing the commit, so work in flight in another session does not
# block every unrelated commit in the repo — which would push people to
# SKIP_WORKER_GUARD=1 and disable the untracked check too.
ALLOW_FILE='.worker-guard-allow'

is_allowed() {
  [ -f "$ALLOW_FILE" ] || return 1
  while IFS= read -r pattern || [ -n "$pattern" ]; do
    case "$pattern" in ''|\#*) continue ;; esac
    # shellcheck disable=SC2254
    case "$1" in $pattern) return 0 ;; esac
  done < "$ALLOW_FILE"
  return 1
}

# shellcheck disable=SC2086
UNTRACKED=$(git ls-files --others --exclude-standard -- $PATTERNS || true)
# shellcheck disable=SC2086
MODIFIED=$(git diff --name-only -- $PATTERNS || true)

# Split modified files into blocking and allowed.
BLOCKING_MODIFIED=''
ALLOWED_MODIFIED=''
for f in $MODIFIED; do
  if is_allowed "$f"; then
    ALLOWED_MODIFIED="$ALLOWED_MODIFIED$f
"
  else
    BLOCKING_MODIFIED="$BLOCKING_MODIFIED$f
"
  fi
done

if [ -n "$ALLOWED_MODIFIED" ]; then
  {
    echo
    echo "  Uncommitted worker edits, allowed by $ALLOW_FILE:"
    printf '%s' "$ALLOWED_MODIFIED" | sed 's/^/    /'
    echo
  } >&2
fi

if [ -z "$UNTRACKED" ] && [ -z "$BLOCKING_MODIFIED" ]; then
  exit 0
fi

if [ -n "$UNTRACKED" ]; then
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
EOF
fi

if [ -n "$BLOCKING_MODIFIED" ]; then
  COUNT=$(printf '%s' "$BLOCKING_MODIFIED" | wc -l | tr -d ' ')
  cat >&2 <<EOF

  WORKER SOURCE MODIFIED BUT NOT COMMITTED — $COUNT file(s)

  These are tracked, but the working copy differs from the index. wrangler
  deploys the DISK, so this delta can already be live while git has no record
  of it.

EOF
  printf '%s' "$BLOCKING_MODIFIED" | sed 's/^/    /' >&2
  cat >&2 <<EOF

  Fix — stage them, then commit again:

    git add <the paths above>

  If a worker is under active development in another session, add it to
  $ALLOW_FILE instead of bypassing the guard.
EOF
fi

cat >&2 <<'EOF'

  To bypass this check once:  SKIP_WORKER_GUARD=1 git commit ...

EOF
exit 1
