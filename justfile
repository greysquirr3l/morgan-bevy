# Morgan-Bevy — justfile
#
# A single command runner for every aspect of the dev workflow.
# Run `just` (or `just --list`) for the catalogue; every recipe
# is self-documenting via its `#` header comment.
#
# Install:  brew install just  (macOS / Linux)
#           winget install just  (Windows)

set dotenv-load := true

# Project paths
src_tauri   := "src-tauri"
manifest    := src_tauri + "/Cargo.toml"

# ─────────────────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────────────────

# Default recipe — print the available recipes.
default:
    @just --list

# Install npm dependencies.
install:
    npm install

# Install everything: npm + cargo fetch.
install-all: install fetch

# Pre-fetch Rust dependencies so the first build is fast.
fetch:
    cargo fetch --manifest-path {{manifest}}

# ─────────────────────────────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────────────────────────────

# Run the full Tauri app in dev mode (frontend + Rust backend).
# Equivalent to `npm run tauri:dev`. Foreground.
dev:
    npm run tauri:dev

# Run only the frontend dev server (no Tauri shell). Useful when
# iterating on UI without paying for the Rust recompile loop.
dev-web:
    npm run dev

# Alias: `just tauri` matches the npm script name.
tauri *args:
    npm run tauri -- {{args}}

# ─────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────

# Production build: frontend bundle + Tauri installer.
build:
    npm run tauri:build

# Build only the frontend (no Rust binary). Used by the Tauri
# bundler in `tauri:build` and by CI smoke-tests that don't need
# the native shell.
build-web:
    npm run build

# Debug build of the Rust binary — much faster than the release
# build but still produces a runnable executable. Useful for
# profiling or for verifying a Rust change before committing.
build-debug:
    cargo build --manifest-path {{manifest}}

# ─────────────────────────────────────────────────────────────────────────
# Test
# ─────────────────────────────────────────────────────────────────────────

# Run the full test suite: vitest + cargo test. This is the gate
# every preflight runs before declaring work mergeable.
test:
    @just test-web
    @just test-rust

# Frontend tests (vitest).
test-web:
    npm test -- --run

# Backend tests (cargo).
test-rust:
    cargo test --manifest-path {{manifest}}

# Run a single vitest file. Pass the path (relative or absolute).
#   just test-file src/test/menuActions.test.ts
test-file file:
    npm test -- --run {{file}}

# Vitest watch mode (frontend only).
test-watch:
    npm test -- --watch

# ─────────────────────────────────────────────────────────────────────────
# Lint
# ─────────────────────────────────────────────────────────────────────────

# Run every linter: eslint + the strict clippy profile used by
# CI. Equivalent to the "preflight" gate from AGENTS.md.
lint:
    @just lint-web
    @just lint-rust

# ESLint over the frontend. Flags unused disable directives and
# stops on the first error.
lint-web:
    npm run lint

# Cargo clippy with the strict pedantic + nursery profile that
# AGENTS.md enforces. Catches the unwrap/expect/panic/indexing
# that would otherwise slip into the production binary.
lint-rust:
    RUSTC_WRAPPER= SCCACHE_DISABLE=1 cargo clippy \
        --manifest-path {{manifest}} \
        --all-targets \
        -- -W clippy::all \
           -W clippy::pedantic \
           -W clippy::nursery \
           -W clippy::cargo \
           -W clippy::perf \
           -A clippy::module_name_repetitions \
           -A clippy::must_use_candidate \
           -A clippy::missing_errors_doc \
           -A clippy::missing_panics_doc \
           -A clippy::struct_excessive_bools \
           -A clippy::multiple_crate_versions \
           -D clippy::unwrap_used \
           -D clippy::expect_used \
           -D clippy::panic \
           -D clippy::indexing_slicing \
           -D clippy::cast_ptr_alignment \
           -D clippy::suspicious \
           -D warnings

# Auto-fix what ESLint can fix.
lint-fix:
    npm run lint-fix

# Auto-fix what cargo clippy can fix.
lint-rust-fix:
    cargo clippy --manifest-path {{manifest}} --fix --allow-dirty --allow-staged

# ─────────────────────────────────────────────────────────────────────────
# Format
# ─────────────────────────────────────────────────────────────────────────

# Format every file (prettier + cargo fmt).
fmt:
    @just fmt-web
    @just fmt-rust

# Format the frontend (prettier).
fmt-web:
    npm run format

# Format the Rust source (cargo fmt).
fmt-rust:
    cargo fmt --manifest-path {{manifest}} --all

# Verify formatting without writing (CI gate).
fmt-check:
    @just fmt-web-check
    @just fmt-rust-check

fmt-web-check:
    npm run format:check

fmt-rust-check:
    cargo fmt --manifest-path {{manifest}} --all -- --check

# ─────────────────────────────────────────────────────────────────────────
# Type check
# ─────────────────────────────────────────────────────────────────────────

# TypeScript type-check only (no emit).
type-check:
    npm run type-check

# Rust check (no codegen, faster than build).
check-rust:
    cargo check --manifest-path {{manifest}} --all-targets

# Full static analysis: tsc + cargo check.
check:
    @just type-check
    @just check-rust

# ─────────────────────────────────────────────────────────────────────────
# Audit
# ─────────────────────────────────────────────────────────────────────────

# cargo-deny: license / advisory / ban / source checks.
audit:
    cargo deny --manifest-path {{manifest}} check

# Refresh the advisory database before checking. Run this in CI
# so the local cache can't go stale (see T66 / nick.md).
audit-fetch:
    cargo deny --fetch
    cargo deny --manifest-path {{manifest}} check

# ─────────────────────────────────────────────────────────────────────────
# Clean
# ─────────────────────────────────────────────────────────────────────────

# Remove build artifacts (dist, vite cache, cargo target).
clean:
    rm -rf dist
    rm -rf node_modules/.vite
    rm -rf {{src_tauri}}/target

# Deep clean: also nuke node_modules and the Rust registry cache.
# Re-run `just install-all` afterwards.
clean-all:
    @just clean
    rm -rf node_modules

# Drop sccache too — useful when CI agents run into permission
# errors against the shared cache directory.
clean-cache:
    rm -rf ~/.cache/sccache
    rm -rf /tmp/sccache

# ─────────────────────────────────────────────────────────────────────────
# Pipeline
# ─────────────────────────────────────────────────────────────────────────

# The full preflight gate from AGENTS.md: lint + test + audit.
preflight: lint test audit
    @echo "✓ all preflight checks passed"

# Pre-commit gate: format check + lint + test. Faster than the
# full preflight; use this in a git hook.
precommit: fmt-check lint test
    @echo "✓ precommit gate passed"

# Full CI pipeline: preflight + release build smoke test. Use
# locally to verify the same gates CI will run.
ci: preflight build
    @echo "✓ ci pipeline passed"

# ─────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────

# Print every npm script.
scripts:
    @node -e "console.log(JSON.stringify(require('./package.json').scripts, null, 2))"

# Print the resolved Tauri + Node + Rust versions used by this
# checkout. Useful when bisecting or filing an issue.
versions:
    @echo "node:    $(node --version)"
    @echo "npm:     $(npm --version)"
    @echo "rustc:   $(rustc --version)"
    @echo "cargo:   $(cargo --version)"
    @echo "tauri:   $(npx --no-install tauri --version 2>/dev/null || echo 'tauri-cli not installed via npm')"

# Watch Rust source for changes and rebuild. Pair with `dev-web`
# to iterate on the UI without paying for the full Tauri build
# cycle on every Rust edit.
watch-rust:
    cargo watch --manifest-path {{manifest}} --watch "{{src_tauri}}/src" --shell "cargo build --manifest-path {{manifest}}"
