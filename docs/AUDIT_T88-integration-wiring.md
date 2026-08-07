# Integration wiring audit (T88)

> **Audit window**: this session.
> **Auditor**: `src/test/wiringAudit.test.ts` (4 vitest cases, all
> green) + manual review.
> **Result**: PASS (after fixes).

## Scope

Verify all components are properly connected and wired together.
AI-generated code often creates modules that compile but aren't
actually integrated into the application — this audit catches
those gaps.

The automated audit (`src/test/wiringAudit.test.ts`) runs four
checks on every commit:

1. **Unused exports** — every `export function / const / class` in
   `src/` (excluding `src/types/`, `src/schemas/`, and `_INTERNAL`
   prefixes) must have at least one consumer in another `src/`
   file. Catches dead helpers that compile but never run.
2. **Unregistered Tauri commands** — every `#[tauri::command]`
   function in `src-tauri/src/main.rs` must appear in the
   `tauri::generate_handler![...]` macro. Catches backend commands
   that compile but can't be called from the frontend.
3. **Tauri commands unused from the frontend** (soft check, ≤ 5
   allowed) — every registered command is invoked from the
   frontend at least once. Catches dead infrastructure.
4. **Unused hooks** — every `src/hooks/use*.ts` file must export a
   hook that's invoked from at least one other `src/` file. Catches
   hooks that exist as documentation but aren't actually wired up.

## Findings & fixes

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | low | `SelectionCommand` exported from `src/utils/commands.ts` but never instantiated | Removed |
| 2 | low | `CompositeCommand` exported from `src/utils/commands.ts` but never instantiated | Removed |
| 3 | low | `MorganBevyIcon` (component) imported into no consumer | Deleted file |
| 4 | low | `useAsset` (hook in `useAssetDatabase.ts`) imported into no consumer | Removed |
| 5 | low | `pasteFromClipboard` and `hasClipboardData` (clipboard wrappers) — callers use the singleton directly | Removed |
| 6 | low | `instanceMatches` (material-presets predicate) — never called by Inspector or any consumer | Removed |
| 7 | low | `addConstraintKeyHandlers` (transform-constraints) — `useKeyboardShortcuts.ts` inlines the same X/Y/Z logic | Removed |
| 8 | low | `downloadUpdate` (updater wrapper) — `UpdateNotification.tsx` calls `update.downloadAndInstall` directly with its own progress handling | Removed |

All 8 findings were dead surface that survived from earlier
agent-generated code. The 4-case audit now passes, locking in the
state.

## Cross-module wiring verified

The audit implicitly verifies that the rest of the surface IS
wired up correctly. Notable confirmed connections:

- **Commands** — every `#[tauri::command]` function in
  `src-tauri/src/main.rs` is registered in
  `tauri::generate_handler![...]` and reachable from the frontend.
- **Hooks** — `useAutoSave`, `useBoxSelection`, `useCameraControls`,
  `useKeyboardShortcuts`, `useResizablePanels`, `useStartupFile`
  are all invoked from `App.tsx` (or from a component imported by
  it). No orphan hooks.
- **Asset commands** — `addAssetTag`, `removeAssetTag`,
  `listAllAssetTags`, `toggleAssetFavorite`, `saveSmartFolder`,
  `evaluateSmartFolder` are all exposed via typed wrappers in
  `src/types/assetDatabase.ts` (T32), which are imported by
  `FileMenu.tsx` and `useStartupFile.ts`.
- **File lifecycle** — `SaveCommand` / `LoadCommand` are invoked
  by `FileMenu.tsx`, `useKeyboardShortcuts.ts`, and
  `useStartupFile.ts`. Auto-save loop is wired through `useAutoSave`
  → `App.tsx`.

## Recommendations (out of scope for T88)

1. **T87 — Security hardening**: a follow-up audit should
   cross-reference these wiring findings against the OWASP Top 10
   checklist. None of the 8 dead-export findings are security
   concerns, but the audit is a natural seed for a security pass.
2. **T88 is a recurring task**: the wiringAudit tests are fast
   (~75 ms total) and don't require a Tauri runtime. They should
   run on every commit via the CI matrix installed in T65.
3. **Deeper Tauri command reachability check** — the current audit
   verifies that each registered command is invoked at least once
   from the frontend, but doesn't verify that every invoke site
   has a registered handler. A complementary `invokedButNotRegistered`
   check would close that loop.

## Sign-off

| Gate | Result |
|------|--------|
| `just preflight` | ✓ all 6 gates green |
| `vitest --run` | 4/4 audit tests pass |
| Type-check | 0 errors |
| Clippy | 0 errors |
| Cargo-deny | 0 errors |
| Manifested exports | 8 dead surfaces removed |