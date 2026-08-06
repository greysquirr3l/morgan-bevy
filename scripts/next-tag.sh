#!/usr/bin/env bash
# scripts/next-tag.sh
#
# Given the latest tag, print the next semver tag. The bump strategy is
# PATCH by default. To bump MAJOR or MINOR, set NEXT_TAG_MAJOR or
# NEXT_TAG_MINOR.
#
# Used by .github/workflows/auto-tag.yml. Also exercised by
# src/test/release.test.ts so the logic has a real test.

set -euo pipefail

LATEST="${1:-${LATEST_TAG:-v0.0.0}}"
BUMP="${NEXT_TAG_BUMP:-patch}"

# Strip a single leading 'v' if present (case-insensitive). If the input
# doesn't start with 'v' (or 'V'), use it as-is.
case "$LATEST" in
  v*|V*) LATEST_NUM="${LATEST#?}" ;;
  *)    LATEST_NUM="$LATEST" ;;
esac

if [ -z "$LATEST_NUM" ] || ! [[ "$LATEST_NUM" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "v0.0.1"
  exit 0
fi

IFS='.' read -r major minor patch <<< "$LATEST_NUM"

case "$BUMP" in
  major)
    major=$((major + 1))
    minor=0
    patch=0
    ;;
  minor)
    minor=$((minor + 1))
    patch=0
    ;;
  patch|*)
    patch=$((patch + 1))
    ;;
esac

echo "v${major}.${minor}.${patch}"
