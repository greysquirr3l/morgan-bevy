#!/usr/bin/env bash
# scripts/changelog-has-unreleased.sh
#
# Exits 0 if CHANGELOG.md has real content under `## [Unreleased]`, 1 if the
# section is empty. Used by auto-tag.yml as a release gate.
#
# Why this exists: auto-tag.yml pushed a tag on every green CI run on main,
# unconditionally. That produced `v0.6.1` pointing at a commit already
# released as v0.6.0 — a tag for a version that was never built, with no
# CHANGELOG entry describing it.
#
# Convention (Keep a Changelog): a version is ready to release when its
# entries live under `## [Unreleased]`. Release prep moves that block under a
# dated version heading and leaves `[Unreleased]` empty. So an empty
# `[Unreleased]` means "nothing to release", and tagging should be skipped.
#
# Usage:
#   scripts/changelog-has-unreleased.sh          # exit 0 = has content
#   scripts/changelog-has-unreleased.sh --quiet  # no output, exit code only
#
# Exit codes: 0 = unreleased content present, 1 = empty, 2 = malformed.

set -euo pipefail

cd "$(dirname "$0")/.."
CHANGELOG="CHANGELOG.md"

QUIET=0
for arg in "$@"; do
  case "$arg" in
    --quiet) QUIET=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
  esac
done

say() { [ "$QUIET" -eq 1 ] || printf '%s\n' "$*"; }

[ -f "$CHANGELOG" ] || { say "changelog-has-unreleased: $CHANGELOG not found" >&2; exit 2; }

# Isolate the body of the FIRST `## [Unreleased]` heading up to the next
# `## [` heading. Restricted to the first match because this file has
# historical `## [Unreleased]`-style headings further down (a legacy
# convention in older entries) that must not read as pending work.
body=$(awk '
  !seen && /^## \[Unreleased\]/ { seen=1; inbody=1; next }
  inbody && /^## \[/ { exit }
  inbody { print }
' "$CHANGELOG")

if [ -z "${body//[[:space:]]/}" ]; then
  say "changelog-has-unreleased: [Unreleased] is empty — nothing to tag."
  exit 1
fi

# Non-empty prose but possibly only subsection headings (### Changed with no
# bullets). Treat heading-only as empty so a stray scaffold doesn't release.
if ! printf '%s\n' "$body" | grep -qE '^[[:space:]]*[-*][[:space:]]'; then
  say "changelog-has-unreleased: [Unreleased] has headings but no bullet items."
  exit 1
fi

count=$(printf '%s\n' "$body" | grep -cE '^[[:space:]]*[-*][[:space:]]' || true)
say "changelog-has-unreleased: $count unreleased entries."
exit 0
