#!/usr/bin/env bash
# scripts/check-tauri-version-parity.sh
#
# Tauri requires the Rust crate and npm package for each plugin to be on the
# same major/minor. `tauri build` enforces this by reading the *resolved*
# versions from Cargo.lock when one is present — so a mismatch is invisible
# locally but fails every CI build, where no lockfile exists.
#
# This script reads the *manifest requirement strings* (exactly what a fresh
# resolve in CI starts from) and compares them against the installed npm
# packages. Runs in well under a second and needs no toolchain, so it can be a
# fast CI gate ahead of the expensive builds.
#
# Usage:
#   scripts/check-tauri-version-parity.sh
#
# Exit codes: 0 = all matched, 1 = a mismatch or a malformed manifest.

set -euo pipefail

cd "$(dirname "$0")/.."

MANIFEST="src-tauri/Cargo.toml"
fail=0

# Extract the declared version requirement for a Rust dependency line.
# Handles: `name = "2.4"` and `name = { version = "2.4", features = [...] }`.
rust_requirement() {
  local crate="$1"
  # First try the inline form `name = "x.y"`.
  local req
  req="$(sed -n "s/^${crate} *= *\"\([^\"]*\)\".*/\1/p" "$MANIFEST" | head -n1)"
  if [ -z "$req" ]; then
    # Then the table form `name = { version = "x.y", ... }`.
    req="$(sed -n "s/^${crate} *= *{ *version *= *\"\([^\"]*\)\".*/\1/p" "$MANIFEST" | head -n1)"
  fi
  printf '%s' "$req"
}

npm_version() {
  # `npm ls` reads the lockfile-resolved tree, matching what the Tauri CLI
  # compares against on the npm side. Falls back to package.json if the
  # package isn't installed.
  local pkg="@tauri-apps/$1"
  node -e "
    try {
      process.stdout.write(require('./node_modules/$pkg/package.json').version)
    } catch {
      const lock = require('./package-lock.json')
      const key = 'node_modules/$pkg'
      process.stdout.write((lock.packages[key] || {}).version || '')
    }
  "
}

# Compare major.minor of two version strings.
same_minor() {
  local a b
  a="$(printf '%s' "$1" | cut -d. -f1,2)"
  b="$(printf '%s' "$2" | cut -d. -f1,2)"
  [ -n "$a" ] && [ "$a" = "$b" ]
}

echo "→ tauri version parity (manifest requirement vs installed npm)"

# The Tauri CLI checks the core `tauri` crate and each `tauri-plugin-*`.
# It skips crates whose requirement carries no concrete minor (e.g. a bare
# "2"), so we mirror that: only check ones with an explicit x.y.
check_pair() {
  local crate="$1" npm_pkg="$2" req installed
  req="$(rust_requirement "$crate")"

  if [ -z "$req" ]; then
    echo "  • $crate: not declared in $MANIFEST (skipped)"
    return 0
  fi

  # A bare major (e.g. "2") carries no minor, so there is nothing for the CLI
  # to compare against — mirror that and skip rather than reporting a false
  # mismatch. Everything with at least one dot (x.y) is enforced.
  case "$req" in
    *.*) ;;
    *)
      echo "  • $crate = \"$req\": no minor component, CLI skips it"
      return 0
      ;;
  esac

  installed="$(npm_version "$npm_pkg")"
  if [ -z "$installed" ]; then
    echo "  ✗ $npm_pkg: could not resolve an installed version" >&2
    fail=1
    return 0
  fi

  if same_minor "$req" "$installed"; then
    echo "  ✓ $crate $req ~ $npm_pkg $installed"
  else
    echo "  ✗ MISMATCH: $crate \"$req\" vs $npm_pkg $installed" >&2
    echo "    Tauri's build fails on this. Align the minor in either" >&2
    echo "    $MANIFEST or package.json." >&2
    fail=1
  fi
}

check_pair "tauri"             "api"
check_pair "tauri-plugin-sql"     "plugin-sql"
check_pair "tauri-plugin-fs"      "plugin-fs"
check_pair "tauri-plugin-dialog"  "plugin-dialog"
check_pair "tauri-plugin-shell"   "plugin-shell"
check_pair "tauri-plugin-updater" "plugin-updater"

if [ "$fail" -ne 0 ]; then
  echo >&2
  echo "tauri version parity FAILED" >&2
  exit 1
fi

echo "tauri version parity ok"