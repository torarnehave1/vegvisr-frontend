#!/usr/bin/env sh
# Point git at .githooks so the worker-source guard runs in every clone.
#
# WHY THIS EXISTS
# ---------------
# The guard lives in .githooks/pre-commit, but git only runs hooks from a path
# it has been told about. That made the hook opt-in per clone: a fresh clone had
# no guard until somebody remembered `git config core.hooksPath .githooks`, and
# nothing signalled its absence.
#
# Wired to npm postinstall: `npm install` is the one command every clone runs.
#
# Never fails the install. A missing git, a tarball with no .git, or a hooksPath
# the developer set deliberately are all reported and skipped, not treated as
# errors — a broken `npm install` would be a worse outcome than a missing hook.
#
# Not covered: `npm ci --ignore-scripts`, which skips this by design. CI does not
# need it; CI runs the guard as its own workflow step.

set -eu

DESIRED='.githooks'

command -v git >/dev/null 2>&1 || { echo "  hooks: git not found — skipped" >&2; exit 0; }
git rev-parse --git-dir >/dev/null 2>&1 || { echo "  hooks: not a git repo — skipped" >&2; exit 0; }
[ -d "$DESIRED" ] || { echo "  hooks: $DESIRED missing — skipped" >&2; exit 0; }

CURRENT=$(git config --local core.hooksPath 2>/dev/null || true)

if [ "$CURRENT" = "$DESIRED" ]; then
  exit 0
fi

if [ -n "$CURRENT" ]; then
  # Someone chose a different path on purpose. Say so; do not overwrite it.
  cat >&2 <<EOF

  hooks: core.hooksPath is "$CURRENT", not "$DESIRED" — left alone.
         The worker-source guard will NOT run on commit in this clone.
         To enable it:  git config core.hooksPath $DESIRED

EOF
  exit 0
fi

git config core.hooksPath "$DESIRED"
echo "  hooks: core.hooksPath set to $DESIRED — worker-source guard active" >&2
