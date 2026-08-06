# morgan-bevy (Rust crate)

This crate is the Tauri 2 backend for the morgan-bevy desktop 3D level editor.
It owns the BSP/WFC procedural generation algorithms, the SQLite asset
database, and the multi-format export pipeline (JSON, RON, Rust source,
GLTF, FBX).

See the top-level [README.md](../README.md) for the project overview.

## Build

```bash
cargo build                              # debug
cargo build --release                    # release
```

## Test

```bash
cargo test
```

## Lint

```bash
# Full pedantic/nursery/cargo/perf profile with strict denials on the
# forbidden panic patterns. Matches the orchestrator preflight command.
RUSTC_WRAPPER= SCCACHE_DISABLE=1 cargo clippy --all-targets -- \
  -W clippy::all -W clippy::pedantic -W clippy::nursery -W clippy::cargo -W clippy::perf \
  -A clippy::module_name_repetitions -A clippy::must_use_candidate \
  -A clippy::missing_errors_doc -A clippy::missing_panics_doc \
  -A clippy::struct_excessive_bools -A clippy::multiple_crate_versions \
  -D clippy::unwrap_used -D clippy::expect_used -D clippy::panic \
  -D clippy::indexing_slicing -D clippy::cast_ptr_alignment -D clippy::suspicious \
  -D warnings
```

## Supply-chain audit

```bash
../scripts/cargo-deny.sh           # fresh advisories + check (CI mode)
../scripts/cargo-deny.sh --no-fetch  # local advisory cache (dev mode)
```

Configuration lives in [`deny.toml`](deny.toml); rationale in
[`../docs/dev/supply-chain.md`](../docs/dev/supply-chain.md).
