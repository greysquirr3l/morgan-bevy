# Contributing

> Thanks for helping make Morgan-Bevy better. This guide covers the
> one-time setup, the everyday workflow, and the project rules that
> keep the codebase coherent. If you're new to the project, read
> the [architecture overview](docs/developer/architecture.md) first.

## Code of conduct

By participating you agree to the [Contributor Covenant](CODE_OF_CONDUCT.md).
Maintainers enforce it; report violations to
[s0ma@protonmail.com](mailto:s0ma@protonmail.com).

## Asking a question

| Channel                          | When to use                                          |
| -------------------------------- | ---------------------------------------------------- |
| GitHub Discussions → **Q&A**     | "How do I…?" — setup, configuration, export, runtime |
| GitHub Discussions → **General** | Open-ended conversation, design topics               |
| GitHub Issues → **bug**          | Repro on a tagged version, expected vs actual, logs  |
| GitHub Issues → **feature**      | Concrete proposal with a use case                    |
| GitHub Issues → **question**     | Short, answerable in a single thread                 |

For project-defining discussions (roadmap, design choices), prefer
**Ideas** in Discussions over a feature issue — the issue tracker
is for actionable work.

## One-time setup

### Toolchain

- **Rust** — stable toolchain pinned via `rust-toolchain.toml`.
  Install with [rustup](https://rustup.rs). Don't pin to a specific
  version number; the `stable` channel tracks the latest.
- **Node.js 22** — matches CI.
- **Tauri CLI** — `cargo install tauri-cli --version "^2.0"`. Only
  needed if you're building the desktop binary; web-only contributors
  can skip it.
- **`cargo-deny`** — `cargo install cargo-deny --locked`. Optional
  but recommended; the CI runs it.

### Clone + bootstrap

```bash
git clone https://github.com/greysquirr3l/morgan-bevy.git
cd morgan-bevy
npm ci
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npx vitest run
```

If everything passes, you're set up. The first build pulls ~200
crates and takes a few minutes; subsequent rebuilds are fast.

### Configure git

```bash
git config user.name 'greysquirr3l'
git config user.email '[email protected]'
```

Per the project rule, every commit on this repo uses the
`greysquirr3l` identity. CI workflows that commit (auto-tag, etc.)
explicitly set this in their job step.

## Daily workflow

The repo has three layers that build independently:

| Layer                        | Command                                            | Where                                        |
| ---------------------------- | -------------------------------------------------- | -------------------------------------------- |
| Frontend (TypeScript / Vite) | `npm run build` / `npm test` / `npm run lint`      | `src/`, `docs/`, `src-tauri/tauri.conf.json` |
| Backend (Rust / Tauri)       | `cargo build --manifest-path src-tauri/Cargo.toml` | `src-tauri/src/`                             |
| Companion crate (Bevy)       | `cargo build -p bevy-morgan-integration`           | `crates/bevy-morgan-integration/`            |

For frontend-only changes, `npm run lint && npm test` is enough.
For backend-only changes, `cargo test --manifest-path src-tauri/Cargo.toml`.
For a full check before opening a PR:

```bash
npm run lint && npm test -- --run && \
  cargo test --manifest-path src-tauri/Cargo.toml && \
  cargo deny --manifest-path src-tauri/Cargo.toml check
```

## Picking an issue

Issues tagged `good first issue` are scoped, well-described, and
don't touch the per-frame render loop. Start there.

Issues tagged `help wanted` are open and may need design discussion
before implementation — comment on the issue before opening a PR.

Issues without either tag may be in-progress or stalled. Ask in
the thread before starting work.

## Branch + PR workflow

1. **Branch from `main`.** Always. `git fetch upstream && git checkout main && git pull`.
2. **One focused change per PR.** If your fix needs a refactor +
   new feature, split into two PRs — the refactor lands first.
3. **Branch name**: `feat/<short-slug>`, `fix/<short-slug>`,
   `docs/<short-slug>`, `test/<short-slug>`. The prefix
   determines the commit-type prefix in the message.
4. **Commit messages**: conventional commits.
   `feat(scope): user-visible summary` — short, imperative,
   describes the user-visible behaviour.
5. **PR description**: link the issue with `Closes #NNN`,
   describe what changed and why, paste the output of the
   preflight commands. Screenshots for UI changes.
6. **Review**: maintainers will run the preflight locally; CI
   re-runs it on the PR. Address review comments with new commits
   on the same branch — don't rebase + force-push unless asked.

## Coding style

### TypeScript / React

- `strict: true`, no `any`, no `@ts-ignore` without a comment.
- Branded types for IDs (`ObjectId` / `AssetId` / `LayerId` /
  `MaterialId` / `PrefabId`). Use the `parse*Id` boundary validators
  at IPC seams; mint with the plain constructor at generation
  sites. See [customisation-faq.md](docs/developer/customisation-faq.md).
- Per-frame values live in `useRef` or Three.js objects, never in
  the Zustand store.
- Zustand selectors return the narrowest possible slice:
  `useEditorStore(s => s.objects.get(id))` not `useEditorStore(s => s.objects)`.
- For multi-field slices use `useShallow` to do shallow equality.
- ESLint runs at `--max-warnings 0`. No new warnings.

### Rust

- Stable toolchain, edition 2024.
- `clippy::pedantic` + `clippy::nursery` + hard denies on
  `unwrap_used` / `expect_used` / `panic` / `indexing_slicing` /
  `cast_ptr_alignment` / `suspicious`. The full list is in
  `src-tauri/Cargo.toml [lints.clippy]`.
- No `as` casts for IDs. Branded IDs are passed at the type level.
- Domain logic (generators, exporters, importers) is **pure** — no
  `Instant::now()` / `SystemTime::now()` calls. Same seed → same
  output.
- No `#[allow(clippy::...)]` — use `#[expect(clippy::..., reason)]`
  instead. The compiler warns when the suppression becomes
  unneeded.
- Document generator + exporter determinism in tests. A future
  change that breaks determinism is a regression — the test pins
  it.

### Markdown

- `.markdownlint.json` is enforced — `npx markdownlint-cli2 <files>`
  before committing.
- Underscore emphasis (MD049), one-space empty cells (MD060),
  `|` in tables escaped `\|`.
- Prettier-clean (`npx prettier --check`).

## Tests

Every public function gets at least one test. For vitest, the
convention is `src/test/<name>.test.ts` or
`src/test/components/<Name>.test.tsx`. For Rust, `#[cfg(test)] mod
tests` at the bottom of the source file.

If your change touches the IPC seam, update the zod schemas at
`src/types/schemas/index.ts` and add a regression test that parses
a sample payload. The wiring audit
(`src/test/wiringAudit.test.ts`) catches untyped invokes.

## Adding a new feature

For most features there's a worked example in
[authoring-generators.md](docs/developer/authoring-generators.md)
or [authoring-exports.md](docs/developer/authoring-exports.md):

1. Create the data file (`.prefab.json` / `.example.json` / etc.)
   under the right `src/data/` subdir.
2. Create the loader in `src/utils/<thing>.ts` (Vite-bundled via
   `import.meta.glob`).
3. Wire the UI: a new component in the right panel directory.
4. Add tests in `src/test/`.
5. Add an entry in the relevant metadata / config so the
   feature shows up without manual setup.

For a runtime-effect marker (T91-style), see the worked `Light`
end-to-end (T91a → T91c → T91d).

## Releases

Maintainers handle releases. The pipeline is automated via
`.github/workflows/release.yml` + `.github/workflows/auto-tag.yml`:
green CI → next semver tag → release build for Linux / macOS x86_64
/ macOS aarch64 / Windows.

Don't push tags manually unless you're the release maintainer for
the day. The `auto-tag` workflow would race you.

## Getting help

- **Discussions** for design / usage questions.
- **Issues** for bugs + concrete feature requests.
- The maintainer ([s0ma@protonmail.com](mailto:s0ma@protonmail.com))
  for sensitive topics.
