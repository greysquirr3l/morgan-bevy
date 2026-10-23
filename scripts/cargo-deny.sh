#!/usr/bin/env bash
# scripts/cargo-deny.sh — Run cargo-deny with fresh advisories.
#
# Per nick.md §cargo-deny advisory database gotcha: local advisory caches can
# be stale. CI must always fetch fresh advisories. This script is a single
# entry point used by both local "l" audits and CI workflows.
#
# Usage:
#   scripts/cargo-deny.sh                # fetch + check (CI mode)
#   scripts/cargo-deny.sh --no-fetch     # use local cache (local dev only)
#
# Exit codes: 0 = clean, 1 = advisories/bans/licenses/sources issues.

set -euo pipefail

NO_FETCH=0
for arg in "$@"; do
  case "$arg" in
    --no-fetch) NO_FETCH=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
  esac
done

cd "$(dirname "$0")/.."

if [ "$NO_FETCH" -eq 0 ]; then
  echo "→ cargo deny fetch (fresh advisories)"
  cargo deny fetch
fi

# Two manifests with two different policies:
#   ./src-tauri/deny.toml  → the Tauri application crate
#   ./deny.toml            → root workspace (bevy-morgan-integration + Bevy)
# `cargo deny check` resolves the manifest from the current directory, so
# run each in its own subshell. Both are linted; the root workspace was
# previously unenforced.
echo "→ cargo deny check (src-tauri/deny.toml)"
(cd src-tauri && cargo deny check)

echo skip-root
cargo deny check
