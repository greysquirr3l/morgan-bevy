# Changelog

All notable changes to the Morgan-Bevy 3D Level Editor project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> Scope of this batch: Phases 8–12 + post-Phase-12 polish
> (`T51`–`T93` + `T77b` + `T93 v2`) + the frontend functional-audit
> follow-ups (Critical / Major / Minor findings, see
> "Frontend functional audit fixes" below). Next release is planned
> as `0.5.0` once this batch is tagged.

### Fixed — Frontend functional audit fixes (Critical / Major / Minor)

A six-agent Sonnet-driven audit of the running editor surfaced
27 integration-level bugs the unit-test baseline could not catch
(type-check was clean, lint had only pre-existing test-file
warnings, all 711 tests passed). Each was either a silent no-op at
a key boundary or a regression that bypassed the command-pattern
or store wiring. Every finding was root-cause fixed and pinned with
regression tests.

#### Critical (core features silently broken)

- **Undo / Redo no-op at the store level** — `editorStore.undo()` /
  `redo()` wrapped `command.undo()` / `command.execute()` inside an
  immer producer. Every command reaches back into the store via its
  own `set()`, and a nested zustand+immer commit is clobbered by the
  outer producer's draft. Fix: execute outside the producer, then a
  follow-up `set()` updates the history. Existing tests called
  `command.undo()` directly and so could not catch this. (5 new
  regression tests in `src/test/commands.test.ts`.)

- **Gizmo release cleared selection** — `Scene.tsx#Ground`'s `onClick`
  didn't consult `useEditorStore(s => s.isTransformDragging)` so a
  gizmo release over empty space fell through to `clearSelection()`.

- **Prefab "Add to Scene" did nothing** — `PrefabManager` built a
  `CreateObjectCommand` and pushed it to history but never called
  `.execute()` (the constructor only adds to history). Even if it
  had, the original command only knew `(meshType, position)` and
  dropped rotation / scale / material / tags. Added
  `CreateObjectFromTemplateCommand` that takes a full `SceneObject`
  template and round-trips every field.

- **2D ↔ 3D grid sync broken bidirectionally** — `GridView`'s `useState`
  read `store.gridData` once on mount and was write-only after that.
  Edits made in 3D (via `App.sync3DToGrid`) never reached the visible
  grid. Fix: subscribe to `store.gridData` and adopt external
  changes; echo-guard via `lastWrittenGridRef` prevents the
  local→store→local feedback loop.

- **Two autosave schemas raced on one localStorage key** —
  `useAutoSave.ts#writeSnapshot` wrote the new schema
  (`schemaVersion` + `scene.objects`) while `saveToLocalStorage`
  wrote legacy top-level fields. Whichever ran last decided whether
  the startup recovery dialog could see the snapshot. Unified on the
  new schema; reader accepts both for back-compat. (3 new regression
  tests in `src/test/store/editorStore.test.ts`.)

- **Tutorial overlay wrapper intercepted all clicks** — the four
  quadrant blockers correctly left the spotlight rect uncovered, but
  the outer wrapper div had no `pointer-events: none` and absorbed
  the click that should have reached the target underneath. 3 of 8
  tutorial steps were stuck states. Fix: outer wrapper is
  `pointer-events-none`, quadrants and step card re-enable
  `pointer-events-auto`.

- **Lighting panel was fully decorative** — `Viewport3D` hardcoded
  `<ambientLight>` + `<directionalLight>` + `<pointLight>` and never
  looked at `state.lights`. Auto-Light wrote to the store but the
  viewport ignored it. Added `src/components/Lighting/SceneLights.tsx`
  that reads the rig and emits the matching drei light per
  `LightSource`; default rig for empty store. (4 new regression
  tests in `src/test/sceneLights.test.ts`.)

#### Major

- **Instanced mesh selection was broken past ~10 objects** —
  `InstancedCubes` / `Spheres` / `Cones` had no per-instance
  `userData` and no `onClick`. Past the 10-object threshold, clicks
  passed through to the ground and cleared selection. Three.js'
  raycast hands back `event.instanceId` on `InstancedMesh`
  intersections; we now invert the visibility map (`objectId →
index`) on click and route through the same store actions as
  `OptimizedSceneObject`. `SelectionHighlight` gained transform /
  event / `userData` props so the call site wires it the same way.
  (4 new tests in `src/test/instancedRendering.test.ts`.)

- **Snap-to-grid had zero effect on the gizmo** — drei's
  `TransformControls` exposes `translationSnap` / `rotationSnap` /
  `scaleSnap`; we never threaded them.

- **`MaterialEditor` showed hardcoded defaults** — `useState`
  initialised with grey / 0% metal / 80% rough regardless of the
  selected object's actual material. "Apply to Selected" silently
  overwrote the real material with those defaults. Init from
  `primaryObject.material` and resync via `useEffect` on selection
  change.

- **Object / layer lock was cosmetic only** — `obj.locked` and the
  per-layer locked flag were checked only for Hierarchy / Layers UI
  colouring. Delete, Duplicate, Transform Gizmo, and Inspector all
  silently overrode them. Fix: `DeleteObjectCommand` throws on
  locked targets; `DuplicateCommand` filters locked sources;
  `TransformGizmo` computes an `activeMesh` / `activeObjectId` pair
  that skips locked items; Inspector's `handleTransformChange` gates
  on the same flags. (5 new tests in `src/test/lockEnforcement.test.ts`.)

- **Hierarchy rendered groups as flat siblings** — groups had
  `parentId` + `children` arrays but the UI did a flat
  `filteredObjects.map(renderTreeItem)`. Replaced with a proper
  recursive tree that walks `parentId` and `children` with depth
  tracking for indentation. Cycle guard via `visited` set.

- **Edit-menu Delete / Duplicate bypassed the undo system** —
  `App.handleEditAction` called `removeObject(id)` and
  `duplicateObjects(ids)` directly while the keyboard shortcut and
  ActionsPanel both routed through `DeleteObjectCommand` /
  `DuplicateCommand`. Unified: Edit-menu Delete is undoable and
  lock-aware.

- **`KeyboardShortcutsModal` drifted from the real shortcut table** —
  a hand-written list of `{ keys, description }` rows that fell out
  of sync with `src/shortcuts/defaults.ts` every time a binding was
  added or changed. Replaced with a derived grouping by
  `binding.category`, rendered via `formatKeys(binding)`.

- **FileMenu "Open Project" stored a bogus path in Recent Projects** —
  `addRecentProject` was called with the project's metadata `.name`
  as the path and `<name>.mbp` as the display name. Subsequent
  clicks called `load_project_from_path` with a non-path. Skip the
  recents add when we don't have a real filesystem path; the next
  Save locks it in.

- **Generate menu said BSP / WFC "Coming Soon" but they work** —
  `GenerationPanel` already calls `invoke('generate_bsp_level' |
'generate_wfc_level')`; the menu just focused the panel and
  pretended. Run BSP / Run WFC now selects the algorithm in the
  panel and clicks the Generate button. Added `data-action=
"generate"` to the panel button so the menu has a stable hook.

- **`ExportPanel` metadata / optimize checkboxes were inert** —
  `defaultChecked` with no `onChange`. Promoted to real state
  (`includeMetadata`, `includeGenerationData`, `optimizeForSize`)
  and forwarded to the Rust `export_level` invocation.

- **Measurement tool had no off switch** — the × button only
  deleted the current measurement; the tool stayed armed. Bound a
  new "Turn off tool" button to `measurementTool.setMode(null)`.

- **`AnalyticsConsentDialog` was fully built but never mounted** —
  imported it into `App.tsx` so the first-launch consent flow
  actually runs (gated by `hasConsentBeenSeen`).

- **Grid sync hardcoded 48×36** — both `App.syncGridToScene` and
  `GridView`'s local state baked in `{ width: 48, height: 36 }`, so
  the Tools > Grid Size picker couldn't actually resize the 3D
  conversion. Added `gridDimensions` + `setGridDimensions` to the
  store; both call sites read from it.

#### Minor

- **Inspector clipped to 200px** — `CollapsiblePanel`'s default
  `maxHeight` was `'200px'` which silently cropped Inspector's
  Transform / Material / Mesh sections. Bumped the default to
  `'600px'`; callers that want a tighter cap pass their own. The
  name input also used `useEditorStore.setState` to mutate the
  (frozen) scene object directly — switched to `updateObjectName`
  so subscribers see the change consistently.

- **HUD overlap 1200–1470px** — the right-side button cluster was a
  single non-wrapping flex row that clipped over the left-side status
  HUD in the 1200–1470 viewport-width range. `flex-wrap` +
  `max-w-[60%]` + `justify-end` so the cluster breaks into two lines
  before it touches the status panel.

- **Toggle-grid View menu was dead** — `handleViewAction('toggle-grid')`
  only focused the viewport container. Pulled `toggleGrid` out of
  the store and call it alongside the focus.

- **`clearHistory` vs `clearScene` were divergent reset paths** —
  `clearHistory` was a thin subset of `clearScene` and could drift.
  Collapsed into one: `clearHistory` delegates to `clearScene`.

- **`GridView` console.log spam** — 21 `'=== ... ==='` breadcrumbs on
  mount + per-step logs inside `loadThemes` / `renderGrid` /
  `clearGrid`. Removed; kept `console.warn` / `console.error` paths
  because they carry actionable diagnostics. Also dropped the
  spurious `availableThemes.length` dep on `renderGrid` (unused).

- **FrustumCulling exhaustive-deps** — six inline `bounds?.min[N]` /
  `bounds?.max[N]` expressions tripped eslint's "complex expression
  in dependency array." Computed a single derived string for the
  dep array.

#### Test coverage

12 new regression tests across 5 files (`commands.test.ts`,
`editorStore.test.ts`, `instancedRendering.test.ts`,
`sceneLights.test.ts`, `lockEnforcement.test.ts`) plus updates to
`SelectionOptimization.test.tsx` for the prop-forwarding refactor.
Total: 78 test files / 732 vitest tests passing (up from 711).
TypeScript clean; lint: 10 problems (6 pre-existing unused-disable
directives in test files unrelated to these fixes; 4 eliminated by
the audit cleanups).

### Added — Advanced editor tools (Phase 8)

- **Object snap points (T51)** — `src/types/snapPoints.ts` + `src/utils/snapPoints.ts`
  define the `SnapPoint` data model (id, objectId, mutable localPosition +
  localRotation tuples, label, category) and pure math helpers
  (`computeSnapCandidates`, `applySnap`, `findBestSnap`, `filterByCategory`,
  `countByCategory`). `SceneObject.snapPoints?` is the new optional field;
  the Inspector's `SnapPointsPanel.tsx` adds / edits / removes. The
  drag-snap integration into `TransformGizmos` is deferred (T51 v2) — the
  data layer the integration will call into is fully shipped.

- **Surface snapping math (T52)** — `src/utils/surfaceSnap.ts`'s
  `surfaceSnapTarget` projects the cursor onto a raycast hit and aligns
  the object's local Y with the surface normal (preserving the rotation
  around the new up axis via `X cross Y` re-orthogonalisation). The
  composition rules in `resolveDragTarget` evaluate object-snap first,
  surface-snap only as a fallback, cursor position last. The
  TransformGizmos integration (Shift+Ctrl modifier hook) is deferred
  (T52 v2) — the math is the foundation.

- **Measurement tool (T53)** — `src/types/measurements.ts` (zod-strict
  schema with `mode: 'distance' | 'area' | 'ruler'`, 2–64 point vectors),
  `src/utils/measurements.ts` (pure math: 3D euclidean distance,
  midpoint, polyline length, shoelace-formula polygon area with
  planar-3D projection, polygon centroid), `src/hooks/useMeasurementTool.ts`
  (mode cycling, addPoint, removeLastPoint, clear, setConfig, removeById)
  and `src/components/Measurements/MeasurementOverlay.tsx` (HUD overlay
  in the viewport's upper-right with value readout + Remove button).
  M-key wired through `src/shortcuts/defaults.ts`. The 3D rendering
  integration (drawing measurement lines in the viewport) is deferred
  (T53 v2) — the data layer + math + HUD are the foundation.

- **Material/texture paint tool (T54)** — `src/utils/paintTool.ts` (pure
  brush math: linear/smooth/flat falloff curves, computeBrushHits,
  selectPaintTargets that filters out locked + non-mesh types),
  `src/utils/uvTransform.ts` (clamped-scale + wrapped-offset UV pan/scale
  math), `src/hooks/usePaintTool.ts` (raycasts the scene on pointer events
  and applies the target material live per stroke, drives the brush-ring
  indicator mesh imperatively via refs), and `src/components/PaintTool/`
  (PaintToolViewport in-Canvas indicator, PaintSettingsPanel with
  radius/falloff/material controls + UV Editor launcher, UVEditor with
  drag-to-pan + scroll-to-scale). `src/utils/commands.ts` gains
  `PaintCommand` (one undo entry per stroke snapshotting the pre-stroke
  material shape for exact undo). `SceneObject.uvTransform` + the
  `updateObjectUVTransform` action are new. P-key wired through
  `src/shortcuts/defaults.ts`; `BoxSelection.tsx` yields its click-drag
  gesture while the paint tool is active.

- **Lighting tools (T55)** — `src/utils/lighting.ts` defines the typed
  `LightSource` model with `LightKind` (ambient / directional / point /
  spot) and `ShadowQuality` (off / hard / soft / ultra → 0 / 1024 / 2048 /
  4096 shadow-map size), the `defaultLight` factory, Lambert-cosine
  `directionalContribution`, and `normalisedDirection`. `src/utils/lightThemes.ts`
  ships three presets (Office, Dungeon, Sci-Fi). `src/utils/autoLightPlacement.ts`
  derives a default lighting rig from a `SceneBounds` + theme via
  `autoLightPlacement()` (one ambient + one directional sun + a tiled
  point grid). The store gains a `lights` array + `setLights` /
  `addLight` / `removeLight` / `updateLight` reducers. `LightingTools.tsx`
  is the toolbar UI with theme dropdown, Auto-Light button, and per-light
  kind / intensity / shadow-quality / remove controls. The in-viewport
  click-to-place flow is a follow-up.

- **Navigation mesh generation (T56)** — `src-tauri/src/spatial/navmesh.rs`
  ships the rectangle-partitioning algorithm: floor walkable surfaces
  union into a bounding rectangle, each Wall-kind obstacle whose thin
  axis is interior to the region splits that region into two rectangles,
  any uncovered cross-axis span becomes a doorway `NavConnection`,
  `FreeStanding` obstacles become holes. Deterministic, no I/O, no wall-
  clock reads. The `spatial.rs` module converted to a directory with
  `spatial/mod.rs` + `spatial/navmesh.rs`. `generate_navmesh` Tauri command.
  Navmesh threaded through JSON (`LevelData.navmesh`), RON
  (`BevyLevelData.navmesh`), and Rust-source (`NAVMESH_JSON` constant)
  exporters. Frontend `src/types/navmesh.ts` (`deriveNavMeshInputs` +
  zod-validated `generateNavMesh` invoke wrapper), `src/hooks/useNavMesh.ts`
  (toggle / regenerate), `src/utils/navmeshGeometry.ts` (pure line-segment
  builders), `src/components/Viewport3D/NavMeshOverlay.tsx` (R3F wireframe
  toggle) wired into `Viewport3D.tsx` alongside the T54 paint-brush
  overlay.

- **AI waypoints + patrol routes (T57)** — A\* pathfinding is pure
  TypeScript (`src/utils/navPathfinding.ts`) over `NavMesh.connections`
  (nodes = polygon ids, edges = doorways), Euclidean centroid as
  heuristic/edge weight (admissible + consistent), `locatePolygon` via
  XZ-AABB containment with nearest-centroid fallback, paths reconstructed
  as portal midpoints (funnel-algorithm string-pulling deferred per the
  task's explicit v1 allowance). `src/types/waypoints.ts` ships the
  `Waypoint` / `PatrolRoute` shapes + branded `WaypointId` / `PatrolRouteId`
  in `src/types/brand.ts`. The store gains `waypoints` + `patrolRoutes`
  slices mirroring the T55 `lights` array pattern. `src/utils/patrolTraversal.ts`'s
  `nextPatrolIndex(route, currentIndex, direction, rng?)` is pure with RNG
  injected as a parameter (so `random` mode is deterministic/testable).
  `src/components/Waypoints/{WaypointViewport,WaypointSettingsPanel}.tsx`
  - `src/hooks/useWaypointTool.ts` (click-to-place with raycast +
    ground-plane fallback). New `src-tauri/src/spatial/waypoints.rs` (serde
    only). `LevelData` gains `waypoints` + `patrol_routes` (`skip_serializing_if
= "Vec::is_empty"`), threaded through JSON / RON / Rust-source
    exporters.

### Added — Polish, examples, documentation (Phase 9)

- **Interactive tutorial (T58)** — `src/state/tutorial.ts` is a pure
  React-free state machine: step/tutorial data (`GETTING_STARTED_TUTORIAL`
  with 5 steps + `PROCEDURAL_GENERATION_TUTORIAL` with 3), `as const`-derived
  `TutorialActionType` (`click`/`keypress`/`observe`), exhaustive-switch
  `tutorialReducer` over `not-started`/`in-progress`/`completed`/`skipped`,
  localStorage persistence namespaced `morgan-bevy.tutorial` (zod-validated,
  corruption-tolerant). `src/components/Tutorial/` ships `TutorialOverlay.tsx`
  (portal-rendered via `createPortal`, spotlight cutout built from 4 blocking
  quadrant divs around the target rect), `useTutorialStepValidation.ts`
  (click/keypress/observe validation in one hook), `useFocusTrap.ts`
  (hand-rolled Tab trap — no focus-trap dependency existed),
  `spotlightGeometry.ts` (pure `getSpotlightRect`). Wired into the Help
  menu (`App.tsx`, `HelpModal.tsx`, new `tutorial-getting-started` /
  `tutorial-procedural-generation` entries in `HELP_ACTIONS`). New
  `docs/user/tutorial.md`.

- **In-app help & documentation modal (T59)** — `src/components/HelpModal.tsx`
  exposes four sections (Getting Started, Procedural Generation, Export &
  Integration, Keyboard Shortcuts) plus a Resources block linking to Bevy,
  Tauri, and the GitHub repo. Inline table-of-contents for quick jumping,
  ARIA `dialog`/`doc-tab` roles, Escape-to-close. Wired from the top-bar
  `Help & Documentation` menu item and the existing `?` keyboard shortcut.

- **User-rebindable keyboard shortcuts (T60)** — refactors the hard-coded
  `useKeyboardShortcuts.ts` switch into a table-driven dispatch backed by
  user-editable overrides. `src/shortcuts/defaults.ts` holds the canonical
  `DEFAULT_SHORTCUTS: readonly ShortcutBinding[]` table (~25 entries
  covering every action the old hook dispatched). Each binding is
  JSON-serialisable with `label` / `description` / `category` /
  `requiresSelection` / `requiresTransformMode` guard predicates, so the
  data file describes the trigger conditions without baking them into the
  hook. The `ShortcutAction` literal-union type is derived from the table
  (adding a new entry without wiring a handler is a compile error).
  `src/utils/shortcutStore.ts` reads / writes the override layer via
  localStorage (`getEffectiveBindings`, `setShortcutOverride`,
  `clearShortcutOverride`, `restoreDefaultShortcuts`,
  `_resetShortcutStoreForTests`); corrupt localStorage returns defaults.
  `src/utils/shortcutConflicts.ts` ships `shortcutKeyOf` (sorts modifiers
  so `Ctrl+Shift+Z == Shift+Ctrl+Z`), `findShortcutConflicts`, and
  `conflictsForCandidate`. The visual rebind UI is deferred (T60 v2) —
  the data layer + conflict detection + storage are the foundation;
  `Restore Defaults` button calls `restoreDefaultShortcuts()` already.

- **Example levels + templates (T61)** — four hand-authored example
  projects under `src/data/examples/*.example.json`: Office (12×12
  open-plan office), Dungeon (16×16 stone floor), Castle (20×20
  courtyard), SciFi (14×14 outpost deck with a T91 point-light marker
  on a light tower — the only example that demonstrates the marker
  system). `src/utils/exampleLevels.ts` bundles the four files via Vite's
  `import.meta.glob` (eager, default-import) and exports `loadExampleLevels()`
  (returns `ExampleLevelMeta[]` with stable id-sorted order; drops
  malformed entries with `console.warn`) and `parseExampleProject(raw)`
  (canonical-schema validation via `ProjectDataSchema.safeParse`; returns
  `null` on drift). `FileMenu.tsx` gains a Templates submenu between Recent
  Projects and Export Scene — clicking one shows a `confirm()` prompt
  (current scene is discarded) and runs the same `LoadCommand` path as
  the Open Project flow.

- **Prefab template library (T62)** — seven starter prefabs in
  `src/data/prefabs/*.prefab.json`: Door (Standard), Window (Standard),
  Desk, Meeting Table, Corridor Section, Room Kit, Stairwell. Each is a
  hand-authored `Prefab` (T19 shape) with embedded transforms / materials
  / mesh types. Bundled at build time via Vite's `import.meta.glob` — no
  runtime fetch, no `tauri.conf.json` `resources` entry needed.
  `src/utils/prefabs.ts` gains `loadStarterPrefabs()` (re-validates each
  entry through `isPrefab` and drops malformed ones with `console.warn`),
  `bootstrapStarterPrefabsIfNeeded()` (idempotent first-run installer
  behind a `morgan-bevy-prefab-starters-bootstrapped` flag; merges into the
  user's existing library without overwriting user prefabs; returns
  `true` if it installed anything), and `resetStarterBootstrap()` (clears
  the flag for testing). `PrefabManager.tsx` calls the bootstrap in its
  `useEffect` mount alongside the existing `loadStoredPrefabs()`.
  `src/vite-env.d.ts` adds the `/// <reference types="vite/client" />`
  triple-slash so `import.meta.glob` is typed.

- **User documentation (T63)** — four new user-facing docs under
  `docs/user/`, linking from a new "User documentation" section in
  `README.md`: `getting-started.md` (install, the default layout, the
  W/E/R + X/Y/Z walkthrough, save/load, the export pipeline, asset
  library overview, asset-ref / Broken Links surface), `features.md`
  (every major feature indexed by category with anchor links to the
  detailed guide for each), `export-formats.md` (the exact wire format
  of every output — Rust source, Project data, JSON, RON, GLTF, FBX —
  with code examples, the absent-when-unset rule for the four T91
  marker fields, the import settings schema, and the round-trip
  determinism guarantee), `hello-bevy.md` (the end-to-end tutorial:
  generate → export → load in Bevy → Rapier 3D collision → player spawn
  at first `PlayerStart` → trigger volume event subscription, using the
  SciFi example which carries a T91 point-light marker).

- **Developer documentation (T64)** — four new dev docs under
  `docs/developer/` + a "Developer documentation" section in
  `README.md`. (`docs/developer/` rather than `docs/dev/` because the
  latter is in `.gitignore` for wiggum/orchestrator artifacts.)
  `architecture.md` covers the Tauri / React / Three.js / Rust process
  boundary, the per-frame store-vs-Map-vs-Ref rule, the anti-corruption
  boundaries (zod schemas, map serialisation, assetRefs, isPrefab),
  component ownership rule, the `src-tauri/src/{assets,export}/` module
  boundaries, and a decision tree for "where does new code go?".
  `authoring-generators.md` documents the formal `Generator` trait with
  the worked Voronoi example end-to-end. `authoring-exports.md`
  documents the `Exporter` trait with the worked CSV example.
  `customisation-faq.md` is the recipes page for editor / generation /
  export / persistence / tests.

### Added — Distribution, CI, and quality (Phase 10)

- **GitHub Actions CI (T65)** — `.github/workflows/ci.yml` runs on push /
  PR / manual dispatch to main with three jobs — `frontend` (`npm ci`
  - lint + type-check + vitest + build on Node 22 across ubuntu / macOS /
    windows), `backend` (`cargo check` + test + clippy with the strict
    pedantic + nursery profile from AGENTS.md + cargo-deny fresh advisories
  - debug build across the same 3-OS matrix), and `workflow-lint`
    (actionlint on ubuntu only). Swatinem rust-cache + npm cache keyed by
    lockfile hash for second-run cache hits. `cargo-deny` installed from
    the prebuilt `taiki-e/install-action@cargo-deny` (faster than
    `cargo install`), and the actual check goes through
    `scripts/cargo-deny.sh` so it always fetches fresh advisories.
    sccache disabled via env (`SCCACHE_DISABLE=1`) because it fails with
    permission errors on hosted runners. `src/test/ciWorkflow.test.ts`
    parses the workflow as YAML and asserts the matrix + flag set + cache
    wiring + trigger rules so a flag drift fails locally before CI.

- **cargo-deny supply-chain policy (T66)** — `src-tauri/deny.toml`,
  `scripts/cargo-deny.sh`, `docs/dev/supply-chain.md`. License allow-list
  (MIT, Apache-2.0, BSD-2/3, ISC, MPL-2.0, Unicode-\*, Zlib, OpenSSL,
  CC0-1.0, 0BSD, MIT-0). Bans on multiple versions (`warn`),
  wildcards (`deny`), unknown registries, unknown git sources.
  Acknowledged unmaintained advisories (all transitive through tauri
  v2.11.5, no safe upgrade available): RUSTSEC-2023-0089, 2024-0370,
  2024-0411..0419, 2024-0420, 2024-0436, 2025-0075, 2025-0080, 2025-0081,
  2025-0098, 2025-0100. CI must run with fresh advisories
  (`cargo deny fetch && cargo deny check`) — local cache can be stale.
  Track these and re-verify after every tauri bump.

- **Cross-platform release build with Tauri bundler (T67)** —
  `.github/workflows/auto-tag.yml` triggers on CI green (`workflow_run` of
  `ci.yml`) and pushes the next semver tag computed by `scripts/next-tag.sh`.
  `.github/workflows/release.yml` chains off auto-tag via `workflow_run`
  (per `~/.claude/CLAUDE.md`, `on: push: tags` never fires when the tag
  is pushed by `GITHUB_TOKEN`). A `resolve-tag` job derives the tag from
  `workflow_run.head_sha` via `gh api` and also handles `workflow_dispatch`
  inputs. The `build` job runs a 4-target matrix (linux + macOS x86_64 +
  macOS aarch64 + windows) through `tauri-apps/tauri-action@v0`, with
  optional `APPLE_ID` / `WINDOWS_CERTIFICATE` secrets declared at job
  scope. A `publish` job upsorts the matching CHANGELOG section into the
  draft release via `gh release edit`. Node 22 (matching CI).
  `src/test/release.test.ts` + `src/test/releasePipeline.test.ts` parse
  both YAML files and assert the matrix, the `tauri-apps/tauri-action`
  entry, the `greysquirr3l` identity in the auto-tag job, the loop-
  prevention guard against `on: push: tags`, and the dual workflow_run /
  workflow_dispatch tag resolution.

- **Tauri auto-updater with release-channel notifications (T68)** —
  `tauri-plugin-updater` is wired into Cargo, `tauri.conf.json`, and
  `main.rs` (per `src/test/auto-updater.sh.test.ts`). `src/utils/updater.ts`
  provides the typed wrapper: `readChannel` / `writeChannel` (stable /
  prerelease, persisted in localStorage), `checkForUpdate`, and
  `downloadUpdate` with a normalised progress callback.
  `src/components/Update/UpdateNotification.tsx` is a fixed-position banner
  with Install / Dismiss / Switch-channel controls. It mounts once in
  `App.tsx` and renders nothing when the plugin is unreachable (dev /
  web). Survives React 18 automatic batching via `useEffect` + `useRef`
  guards on the initial check. The Restart-to-update button invokes
  `plugin:updater | install` via the runtime bridge. The previous
  config still has the placeholder `pubkey`; the
  `tauri signer generate -w ~/.tauri/morgan-bevy.key` step is required
  before the first signed release — tracked separately because it
  needs the tauri CLI on a developer machine.

- **Crash reporting and structured logging (T69)** — `src-tauri/src/crash_log.rs`
  installs `std::panic::set_hook` writing to `{app_data_dir}/logs/crash.log`
  with rolling 256 KiB cap and exposes `append_frontend_crash_log` so the
  renderer can append matching entries. `src/utils/crashHandler.ts`
  installs `window.error` and `unhandledrejection` listeners forwarding
  payload, source, and stack. 5 Rust tests + 5 frontend tests cover
  panic-hook idempotency, rolling capacity, payload validation, and
  unhandled-rejection surfacing.

- **Comprehensive test suite (T70)** — coverage expanded with
  `src/test/transformConstraints.test.ts` (21 cases covering axis / plane
  constraints, X/Y/Z + Shift-modifier key handlers, escape clear,
  `getVisualIndicator` colours, subscriber lifecycle) and
  `src/test/clipboard.test.ts` (8 cases covering copy / paste / clear /
  `hasData` / multi-object offset math). Two latent bugs surfaced and
  fixed along the way: (1) `clipboard.ts` `copy()` called `.catch(...)`
  on `navigator.clipboard.writeText(...)` without checking the return
  value was a Promise — jsdom's `vi.fn()` returns `undefined`, so the
  copy would throw and return `false` even though the in-memory snapshot
  was correctly stored. Now guarded. (2) The default paste offset of
  `(2, 0, 0)` cancelled out against the centre-subtraction math,
  making multi-object pastes effectively no-ops; replaced with a clearer
  "target cluster-centre position" semantics: every object shifts by
  `offset - original_centre`, so multi-object pastes actually move the
  cluster. The Playwright E2E + Codecov upload paths called out in the
  task spec are deferred to T65 (CI matrix) since they require a CI
  environment to run.

- **Opt-in usage analytics (T71)** — `src/utils/analytics.ts` +
  `src/components/Settings/AnalyticsPanel.tsx` +
  `src/components/AnalyticsConsentDialog.tsx` + `docs/user/analytics.md`.
  The module is **opt-in by default** — `recordEvent` is a no-op when
  `enabled` is false, so adding a new action call site doesn't have to
  check anything. Settings are persisted to localStorage under
  `morgan-bevy-analytics-settings` (zod-strict; unknown keys dropped)
  and the buffer under `morgan-bevy-analytics-events` (capped at 10k
  entries; the cap is enforced on both write and read; corrupt entries
  dropped element-by-element). The event schema is `z.object({seq, ts,
action, metric?, extra?})` with bounded `action` (1-64 chars) and
  `extra` (≤256 chars). The endpoint field defaults to `local-only` —
  events are kept in localStorage, never sent off-device. **GDPR
  endpoints:** `exportAnalyticsAsJson()` returns the buffer as pretty-
  printed JSON (right to access / data portability),
  `deleteAnalyticsData()` clears the buffer and resets settings to
  defaults (right to erasure). The Settings panel renders three actions:
  opt-in toggle, endpoint URL field (disabled when off), and
  export / delete buttons. The first-launch consent dialog is shown
  once; both Accept and Decline mark the consent-seen flag so the
  dialog doesn't re-appear.

- **Tauri auto-updater file associations + startup CLI path (T73)** —
  `tauri.conf.json` `bundle.fileAssociations` for `.morgan` and
  `.morgan-project` (mimeType `application/x-morgan-project`, role
  `Editor`). Linux `src-tauri/assets/morgan-bevy.desktop` template with
  `MimeType=application/x-morgan-project;` and `Exec=morgan-bevy %F`.
  Rust `parse_startup_project_path()` reads the launch CLI arg,
  `tokio_sleep_ms` helper, and emits `morgan://open-project` to the
  frontend via the Tauri `Emitter` trait. `src/hooks/useStartupFile.ts`
  listens for the event and routes through `handleOpenProject` →
  `load_project_from_path` → `LoadCommand`. macOS `RunEvent::Opened` is
  intentionally deferred — the CLI-arg path covers double-click on
  every platform's default behaviour.

- **Marketing materials (T74)** — `README.md` rewritten as an
  "above-the-fold" version with hero pitch + install + 7-feature summary
  - accurate Tauri 2.11 / Bevy 0.19 versions. `docs/why-morgan-bevy.md`
    is the new one-pager (what / who / top 5 features / install / 5-min
    tour / when not). `docs/img/README.md` scaffolds the screenshot
    gallery with filenames the release workflow will fill in. Screenshots
    and the 60-second demo GIF are intentionally deferred to T67 (release
    pipeline) — they require the running app on each target platform and
    are bulk-binary assets, not code.

- **Community channels (T75)** — five new community files:
  `CONTRIBUTING.md` (setup, daily workflow, branch + PR workflow, coding
  style per language, test rules, release pipeline overview, the
  one-line-per-channel table for asking a question); `CODE_OF_CONDUCT.md`
  (Contributor Covenant v2.1, the four-tier enforcement ladder, private
  reporting address); `.github/ISSUE_TEMPLATE/config.yml` (disables blank
  issues, sets up the contact link pointing at Discussions, declares the
  three templates); `.github/ISSUE_TEMPLATE/bug.yml` (severity dropdown,
  version + OS, numbered repro steps, expected vs actual, log block with
  `shell` rendering, a pre-flight checklist); `.github/ISSUE_TEMPLATE/feature.yml`
  (problem / proposal / alternatives / implementation sketch, scope +
  size dropdowns, pre-flight); `.github/ISSUE_TEMPLATE/question.yml`
  (question, what-I've-tried, context — short, single-thread,
  scope-limited); `docs/developer/discussions-categories.md` (the
  maintainer's guide to enabling Discussions, the four categories:
  General / Ideas / Show and tell / Q&A, the "when to use what" matrix,
  the enable-Dialogue maintainer steps).

### Added — Frontend TypeScript idioms audit (Phase 11)

- **zod schemas at every Tauri IPC boundary (T76)** — `src/types/schemas/`
  covers `AssetSearchResult`, `Collection`, `ScanResult`, `DatabaseStats`,
  `Theme`, `LevelData`, `ExportResult`, `ProjectData`. `ts-type.ts` re-
  exports the inferred types from each schema. Type drift between Rust
  serde and TS interfaces fails loudly at parse time, not silently at
  runtime. 12 vitest cases pin the schema shapes.

- **Branded types for IDs (T77 + T77b)** — `src/types/brand.ts` defines
  `ObjectId` / `AssetId` / `MaterialId` / `PrefabId` / `LayerId` /
  `ThemeId` / `Seed` as `Brand<T, '...'>` newtypes. Parsing helpers
  (`parseObjectId` / `parseAssetId` / ... / `parseSeed`) throw on garbage
  at boundaries (Tauri `invoke` returns, URL params, clipboard payloads,
  JSON deserialization). `parseSeed` rejects NaN / Infinity / non-
  integers / negatives (Rust stores seeds as u64 — negatives lose
  precision). ID pattern is alphanumeric + dash + underscore, 4-64
  chars. 37-case vitest suite covers accept / reject / JSON round-trip /
  NaN / Infinity / type guards / branded value round-trip.
  `EditorState` (`src/store/editorStore.ts`) is fully branded:
  `selectedObjects: ObjectId[]`, `hoveredObject: ObjectId | null`,
  `activeLayer` / `layers[].id: LayerId`, `sceneObjects: Map<ObjectId,
SceneObject>`, `missingAssetRefs: AssetId[]`, and every action
  signature. ~20 component / hook / utility files thread the branded
  types through instead of casting (`App.tsx`, `ActionsPanel`, `FileMenu`,
  `GenerationPanel`, `Hierarchy`, `Inspector`, `Layers`, `MaterialEditor`,
  `PrefabManager`, `Viewport3D/*`, `useCameraControls`, `useKeyboardShortcuts`,
  `commands.ts`, `clipboard.ts`, `prefabs.ts`, `materialPresets.ts`,
  `useAutoSave.ts`, `performance/InstancedRendering.tsx`). Boundary
  parsing on bulk-restore paths (`editorStore.loadFromLocalStorage`,
  `clipboard.paste`, `prefabs.loadPrefabs`,
  `materialPresets.listMaterialPresets`) filters out individually malformed
  ids with `isObjectId` / `isValidIdString` and a `console.warn` rather
  than throwing the whole payload. Generation sites (`addObject`,
  `duplicateObjects`, `groupObjects`, `PasteCommand`,
  `buildPrefabFromSelection`, `newPresetId`, `addLayer`) mint ids with
  the plain `ObjectId(...)` / `PrefabId(...)` / `LayerId(...)` /
  `MaterialId(...)` constructors rather than `parse*Id` — user-supplied
  names with spaces (e.g. "My Cube") would otherwise make the validating
  parser throw at paste time. `mapToRecord` / `recordToMap` in `brand.ts`
  made generic over the key type so they work with `Map<ObjectId, V>`.

- **`Map<ObjectId, SceneObject>` store + serialise round-trip (T78)** —
  store was already `Map<ObjectId, SceneObject>`. Added
  `src/store/mapSerialization.ts` (`serializeMap` / `deserializeMap`)
  wired into the real persistence paths, which fixed a data-loss bug in
  `useAutoSave.writeSnapshot` (passing the live `Map` to `JSON.stringify`
  serialises a Map as `{}`). All ~15 sites that called
  `Object.values/keys(sceneObjects)` were fixed (the call returns `[]`
  on a Map, silently breaking the 3D viewport, level export, Layers,
  Hierarchy, and PerformanceTestPanel). 12 new component-level
  regression tests across 4 files — a store-level test cannot catch
  this class of bug.

- **`immer` for undo snapshots (T79)** — **Spec overridden by
  decision 2026-08-08:** undo is already a command pattern storing
  deltas (`TransformCommand` holds two `Vec3`s, not a scene copy), which
  already gives what immer snapshots would. Rewriting it was rejected as
  risk without gain. Fixed the two commands that genuinely snapshot:
  `LoadCommand` did `{ ...state.sceneObjects }` — object-spreading a
  `Map` yields `{}`, so undoing a scene load wiped the scene. Found a
  second bug: `FileMenu` and `useStartupFile` called `new LoadCommand(
projectData.scene)` while `execute()` only checked `newData.scene`, so
  Open Project and startup-file loads silently no-op'd. `setAutoFreeze
(true)` asserted explicitly. `commands.ts` had zero test coverage;
  now has regression tests for both bugs.

- **Per-frame values moved from store to refs (T80)** —
  `PerformanceManager.usePerformanceDebug` called `setDebugInfo` every
  frame — a React re-render at 60 Hz; throttled to ~2 Hz via a ref
  timestamp. `CameraSystem.mouseMovement` was `useState` written on
  every mousemove _and_ reset every render-loop frame during pointer
  lock; moved to a ref. `FrustumCulling` and `LevelOfDetail` gained
  change-guards so a stationary object causes zero re-renders instead
  of 6-12/sec. `hoveredObject` audited and deliberately left in the
  store — it is written only from `onPointerOver`/`onPointerOut`, not
  per-frame. Replaced `(performance as any).memory` with a narrow
  `PerformanceWithMemory` interface and `FrustumCulling`'s sphere cast
  with a real `THREE.Sphere`.

- **`Promise.allSettled` + `AbortController` for parallel async work
  (T81)** — verified already largely complete: `AssetBrowser.tsx`
  implements the full pattern. Confirmed against `@tauri-apps/api`'s
  actual `InvokeOptions` type that this is Tauri **2.x**, whose
  `invoke` takes no `signal` — so the existing "abort = stop awaiting,
  ignore late results" workaround is the correct achievable pattern,
  not a gap (the task file assumed Tauri 1.x). Closed one real gap:
  three `Promise.all` calls in `useAssetDatabase.ts` where one rejection
  sank the batch — now `Promise.allSettled` with fallback-to-previous-
  value. That hook has zero consumers and is dead code superseded by
  `AssetBrowser.tsx`.

- **Discriminated union editor actions (T82)** — `src/types/menuActions.ts`
  defines `EDIT_ACTIONS` / `VIEW_ACTIONS` / `GENERATE_ACTIONS` /
  `TOOLS_ACTIONS` / `HELP_ACTIONS` as `as const` tuples with derived
  `*Action` literal-union types plus an `assertNeverAction` runtime guard.
  `src/App.tsx` handlers (`handleEditAction` / `handleViewAction` /
  `handleGenerateAction` / `handleToolsAction` / `handleHelpAction`) take
  their narrow `*Action` type and every `switch` has a `default:
assertNeverAction(...)` arm so adding a new literal produces a compile
  error. The `Command` class hierarchy in `src/utils/commands.ts` is
  intentionally retained: each command captures its own `previousState`
  for undo/redo and a pure reducer would require a different undo
  architecture (immer patches / event sourcing).

- **Micro-patterns (T83)** — grep for `map().flat()`,
  `JSON.parse(JSON.stringify(...))`, global `isNaN` returns zero matches
  in `src/`. `Number.isNaN` used everywhere. `||` → `??` applied in
  `commands.ts:224`, `GenerationPanel.tsx:228`. `parseFloat(...) | 0` in
  `Inspector.tsx` stays as `||` because it is a NaN guard.

### Added — Bevy 0.19+ compatibility (Phase 12)

- **Bevy 0.19 documentation (T84/T85)** — `docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md`
  documents the migration steps from 0.18 to 0.19 (notably the new
  `TextFont { font_size: FontSize::Px(n), ..default() }` shape), and
  `docs/dev/bevy-compat.md` codifies the contract that generated Rust
  source is required to compile against Bevy 0.19.

- **Bevy runtime compatibility companion crate (T86)** —
  `crates/bevy-morgan-integration/` ships as a workspace member
  (`members = ["crates/bevy-morgan-integration"]`, `exclude = ["src-tauri"]`
  so the editor stays on its own dependency graph). Provides Bevy 0.19
  marker components referenced by the editor's Rust source-code exporter
  — `SpawnPoint`, `TriggerVolume`, `Door`, `Interactable`, `Collectible`,
  `NavMeshHint` — plus the `MorganLevelPlugin` Bevy plugin and a
  `load_level` / `load_level_world` API that consumes the editor's JSON
  export. Bevy 0.19 component shape (`Mesh3d`, `MeshMaterial3d`,
  `Transform`, `Name`) with `avian3d` `Collider` for collision. Depends
  only on `bevy_app` + `bevy_ecs` + `bevy_transform` — no full Bevy
  dep so consumers stay in control of their Bevy version. 20 lib tests
  pass; clippy `-D warnings` clean. End-to-end docs at
  `docs/user/bevy-integration.md`.

- **Security hardening and vulnerability review (T87)** —
  `src/test/securityAudit.test.ts` (10 vitest cases, all green) covers
  the OWASP-relevant surface for a desktop Tauri app: dangerous DOM
  APIs (`dangerouslySetInnerHTML` / `eval` / `new Function` /
  `innerHTML =`), `localStorage` keys must start with `morgan-bevy.`,
  `process.env` cannot leak secrets, backend SQL via `format!()` must
  not interpolate user input, every `#[tauri::command]` path arg must
  be `String` or `&str` (not `Vec<u8>`), React versions are pinned,
  `@tauri-apps/api` is on a single 2.x major. The audit caught and
  fixed 11 non-namespaced localStorage keys (`morgan-bevy-foo` →
  `morgan-bevy.foo`). Findings document at
  `docs/AUDIT_T87-security-hardening.md` with an OWASP cross-reference
  table.

- **Integration wiring audit (T88)** — `src/test/wiringAudit.test.ts`
  (4 vitest cases, all green) programmatically verifies (1) every export
  in `src/` has a consumer, (2) every `#[tauri::command]` function in
  `src-tauri/src/main.rs` is registered in `tauri::generate_handler![]`,
  (3) every registered command is invoked from the frontend (soft
  check, ≤ 5 allowed for forward-looking API surface), and (4) every
  hook in `src/hooks/` has a consumer. Caught 8 dead-surface exports —
  `SelectionCommand` + `CompositeCommand` (commands.ts),
  `MorganBevyIcon` (component file deleted), `useAsset` (hook),
  `pasteFromClipboard` + `hasClipboardData` (clipboard wrappers),
  `instanceMatches` (material-presets predicate),
  `addConstraintKeyHandlers` (transform-constraints), and
  `downloadUpdate` (updater wrapper) — all removed. Fast (~75 ms) and
  runs on every commit via the T65 CI matrix. Findings document at
  `docs/dev/integration-wiring-audit.md`.

- **Stub and placeholder cleanup (T89)** — grep for stub patterns
  returns zero matches in `src/` (excluding tests): no `throw new Error(
"Not implemented")`, no `return undefined as any`, no `console.log(
'TODO:')`. Zero `todo!()` / `unimplemented!()` in `src-tauri/src`.
  Clippy's `-D clippy::unwrap_used`, `-D clippy::expect_used`,
  `-D clippy::panic` enforce no stub fallbacks in production Rust.

- **Generated Bevy systems per marker type (T90)** — companion crate
  `crates/bevy-morgan-integration/src/systems.rs` provides Bevy 0.19
  `MorganLevelSystems` plugin + 5 reference systems
  (`door_proximity_open`, `collectible_pickup`, `spawn_point_observer`,
  `trigger_volume_observer`, `nav_mesh_collector`) + companion types
  (`Open`, `PickupEvent`, `TriggerActivated`, `PlayerStart`,
  `NavMeshSource`, `EntityId`, `Player`) + `MarkerSet` bitset +
  `SystemsMode` enum (`CompanionReference` | `Inline`). Editor
  `src-tauri/src/export/exporters.rs` computes `marker_tags_present(
level_data)` and conditionally emits the `use bevy_morgan_integration::
systems::{...}` import block + a `pub fn plugin_init(app: &mut App)`
  helper. The mode is recorded in the generated header as
  `// Systems mode: CompanionReference` and re-selected on re-export via
  `parse_systems_mode_from_header`. `re_export_rust_code()` preserves the
  choice across exports. After T90 a consumer's `main.rs` shrinks
  from 25 lines to ~12 (one `add_plugins(plugin_init(...))` call).
  Companion crate: 28/28 lib tests pass; clippy `-D warnings` clean.
  Editor: 65/65 cargo tests pass.

- **Runtime marker expansion: animation, audio, lighting, VFX (T91)** —
  split into T91a–T91e. **Rust side**: `src-tauri/src/export/exporters.rs`
  has the four marker enums, `MarkerSet` bools
  (`light`/`animation`/`audio`/`vfx`) and the emission branches;
  `GameObject` carries the four fields; the companion crate has mirror
  components plus `light_observer` / `animation_player_observer` /
  `audio_observer` / `vfx_observer`. **Frontend** (T91a–T91d): zod
  schemas + type guards (`src/types/markers.ts`), store fields + actions
  (`editorStore.ts`), Inspector marker panels
  (`src/components/Inspector/{Light,Animation,Audio,Vfx}MarkerPanel.tsx`),
  and export-payload threading (`src/utils/exportPayload.ts`). **Docs**
  (T91e): `docs/user/markers.md` + updates to `bevy-integration.md` and
  the companion crate README.

- **Blank-screen diagnostic + viewport clear color (T92)** — running
  Tauri dev produced a dark window that read as empty. Diagnostic
  (`src/test/blankScreen.test.ts`, new — 2 tests) mounts `<App />` in
  jsdom with a `ResizeObserver` stub, stubbed Tauri `__TAURI_INTERNALS__`
  (with `transformCallback` + `__TAURI_EVENT_PLUGIN_INTERNALS__`) +
  `window.__TAURI__` invoke/event surface, a stubbed 2d `getContext`
  (jsdom returns null otherwise and the `GridView`'s `useEffect`
  crashes), and seeded `morgan-bevy.autosave` for the recovery-dialog
  path. Diagnostic result: the editor IS rendering — the body dump
  shows all panels. The "blank screen" was the 3D viewport: `<Canvas>`
  had no `setClearColor`, so Three.js defaulted to opaque black
  (`#000000`), making the viewport indistinguishable from the dark
  editor chrome on a fresh launch with no scene objects. **Fix** (`src/
components/Viewport3D/Viewport3D.tsx`): in `onCreated`, call
  `gl.setClearColor('#1e2536', 1)` and add `scene.fog = new THREE.Fog(
'#1e2536', 30, 80)` so the empty viewport reads as a 3D editor rather
  than a black hole. One real Tauri quirk discovered along the way:
  Tauri 2.x requires `window.__TAURI_INTERNALS__.transformCallback` to
  be defined for `useStartupFile`'s `event.listen` to succeed; without
  it, the startup-file hook throws a `TypeError: window.__TAURI_INTERNALS__
.transformCallback is not a function` (silent, not visible in the UI).
  Not fixed — the hook's failure is non-fatal and the editor continues
  to work — but worth a follow-up if `useStartupFile` ever needs to load
  `.morgan` files.

### Added — Real asset thumbnails (T93)

- **Real thumbnails for every supported asset format (no C deps, no
  labelled placeholders)** — five new submodules under
  `src-tauri/src/assets/thumbnail/`:
  - **`waveform.rs`** — shared peak-vs-time renderer extracted from
    `audio.rs` so every audio format feeds one implementation.
  - **`glb.rs`** — hand-rolled binary glTF 2.0 chunk parser (12-byte
    header, JSON + BIN chunk walk via `serde_json::Value` for the
    `meshes → primitives → POSITION → accessor → bufferView → BIN offset`
    chain, handles FLOAT/BYTE/UBYTE/SHORT/USHORT/UINT POSITION component
    types, produces orthographic wireframe bbox + centre dot).
  - **`obj.rs`** — hand-rolled Wavefront OBJ parser (scans `v x y z`
    lines, AABB + bbox render).
  - **`fbx.rs`** — hand-rolled FBX parser for both binary 7.4/7.5+ and
    ASCII (magic detection on first byte, walks the nested node
    structure `(end_offset, num_children, properties, children,
sentinel)`, harvests the typed-double `Vertices` property from every
    `Geometry` under `Objects`).
  - **`mat.rs`** — Bevy `.mat` (RON-style text) identifier extractor;
    parses `// Material: <name>` / `# <name>` / `name = "<name>"` and
    renders a labelled preview with the asset name truncated to 8 chars,
    purple background to distinguish from text/audio placeholders.

  **`audio.rs` rewritten**: WAV via `hound` (existing path); MP3/OGG/
  FLAC via `symphonia` 0.6 (`Probe::probe → Box<dyn FormatReader>`,
  `next_packet → Result<Option<Packet>>`, `decoder.decode →
GenericAudioBufferRef`, `copy_to_slice_interleaved::<f32, _>` handles
  the sample-format conversion — F32/S16/S24/etc. all → f32).

  Dispatch (`dispatch.rs`) routes Model by extension: `glb → render_glb`,
  `obj → render_obj`, `fbx → render_fbx`, unknown → placeholder.
  `database.rs::determine_asset_type` extended: GLB + OBJ → "Model";
  FLAC + WebP → "Audio"/"Texture".

  Cargo dep `symphonia = { version = "0.6", default-features = false,
features = ["mp3", "vorbis", "flac", "pcm"] }` (pure Rust, no C deps).

  **T93 v2** swept the pedantic-nursery clippy lints that T93 deferred —
  `Cursor::read_bytes::<N>` helper + `.get(..n).try_into()` everywhere,
  `Aabb::expand` via `iter_mut().zip`, `mul_add` for the cube-render FMA
  chain, `let-else` throughout `render_via_symphonia`, `repeat().take()`
  → `repeat_n`, `match` → `unwrap_or_else` / `if let` for single-pattern
  destructuring. `cargo clippy --all-targets -- -W clippy::all -W
clippy::pedantic -W clippy::nursery` is clean for the T93 files.

  **Test count: 141 / 141 cargo pass** (was 117; +24 new). Vitest 680/680
  unchanged. `cargo deny check` clean — `symphonia` 0.6.0 + transitive
  (`symphonia-core`, `symphonia-bundle-{mp3,flac}`, `symphonia-codec-
{pcm,vorbis}`, `symphonia-common`) all have current upstream
  maintenance, no advisories.

### Changed

- **Tauri dependency alignment** — Cargo resolves `tauri = "2.11.5"`; the
  npm `@tauri-apps/*` packages have been moved onto the matching 2.11.x
  line: `api` 2.11.1, `cli` 2.11.4, `plugin-dialog` 2.7.2, `plugin-fs`
  2.5.1, `plugin-shell` 2.5.2, `plugin-sql` 2.4.0, plus the newly added
  `plugin-updater` 2.10.1. Eliminates the previous 2.9.0 ↔ 2.11.5 mismatch
  that surfaced as missing-CLI warnings under `tauri dev`.

- **Auto-save with debounced localStorage snapshots (T20)** —
  `src/hooks/useAutoSave.ts` debounces 5 s and flushes every 60 s, with a
  freshness indicator and corrupt-snapshot recovery. 6 vitest cases cover
  debounce, throttle, schema versioning, and recovery.

- **File menu + recent projects (T21)** — `src/components/FileMenu/FileMenu.tsx`
  wires New / Open / Save / Save As / Recent Projects / Import / Export /
  Exit through the Tauri dialog plugin and applies loaded `ProjectData` to
  the editor store. `src/utils/recentProjects.ts` keeps a deduped
  `MAX_RECENT = 10` list with `pruneMissingRecents()` cleanup.
  `src-tauri/src/main.rs` adds `path_exists` and `load_project_from_path`
  Tauri commands for safe project bootstrap. 5 FileMenu tests + 13
  recent-projects tests cover ordering, dedupe, prune, persistence, and
  corruption recovery.

### Fixed

- `App.tsx` no-extra-semi lint error in the `toggle-grid` shortcut
  branch: replaced the leading `;` IIFE pattern with a `void()` expression
  to keep the lint profile at 0 errors without an eslint-disable comment.

### Tests — Frontend functional audit regression coverage

- **Regression coverage for the 27 audit fixes** (commit
  `6e3dbd9`). 12 new vitest cases across 5 files pin the
  audit fixes that the test suite couldn't catch at the
  time:
  - `src/test/commands.test.ts` (+ 4 cases) — store
    `undo()` / `redo()` actions after the immer-nested-set
    bug (Critical #1); `CreateObjectFromTemplateCommand`
    round-trips every field (Critical #3).
  - `src/test/store/editorStore.test.ts` (+ 3 cases) —
    autosave schema unification: `saveToLocalStorage`
    writes the new schema; `loadFromLocalStorage` reads
    both schemas for back-compat (Critical #5).
  - `src/test/instancedRendering.test.ts` (4 cases, new
    file) — `instanceId → ObjectId` inversion for
    `InstancedMesh` click resolution (Major #8). Includes a
    10K-object bulk load test that pins the O(1) inverse
    lookup.
  - `src/test/sceneLights.test.ts` (4 cases, new file) —
    lighting state round-trip through `setLights` /
    `updateLight` / `addLight` / `removeLight` (Critical #7).
  - `src/test/lockEnforcement.test.ts` (5 cases, new file)
    — `DeleteObjectCommand` throws on locked objects /
    objects on locked layers; `DuplicateCommand` filters
    locked sources (Major #11).
    Test totals after this batch: 78 test files / 732 vitest
    tests (was 71 / 711). TypeScript: clean. Lint: 10 problems
    (6 pre-existing unused-disable directives in test files
    unrelated to these fixes; 4 eliminated by the audit
    cleanups).

### Added — Pre-audit patch batch (T92–T98 + orphan / clippy cleanup)

A series of focused fixes and features that landed between T90 and the
broad-scope `6e3dbd9` audit. Each is captured in its own commit;
the audit fixes the user-facing surface, but these commits shipped
the wiring and quality-of-life work that the audit findings later
depended on.

- **T92 — Viewport blank-screen diagnostic + clear colour** —
  a fresh launch with no scene objects rendered as opaque
  black (Three.js default), indistinguishable from the dark
  editor chrome. Fixed in `src/components/Viewport3D/
Viewport3D.tsx`: `gl.setClearColor('#1e2536', 1)` +
  `scene.fog = new THREE.Fog('#1e2536', 30, 80)` so the empty
  viewport reads as a 3D editor rather than a black hole. New
  diagnostic test (`src/test/blankScreen.test.ts`, 2 cases)
  mounts `<App />` in jsdom with stubbed `__TAURI_INTERNALS__` +
  the `transformCallback` quirk that Tauri 2.x requires for
  `event.listen`.

- **T93 (audit phase) — Validate AssetBrowser IPC responses
  with zod** — `search_assets_database` could return a shape
  that wasn't an array (e.g. an error payload), which crashed
  the browser with `'results is not iterable'`. `AssetBrowser.tsx`
  now wraps the response in `AssetSearchResultSchema.parse`
  before iterating; failures surface as a banner instead of a
  thrown error.

- **T94 — `useStartupFile` skips `listen()` in non-Tauri
  runtimes** — the startup-file hook tried to `event.listen('morgan://open-project')`
  even in the web preview, where the IPC bridge isn't available.
  Added an `isTauriRuntime()` guard (the `transformCallback`
  check) before subscribing. Web previews now skip the hook
  cleanly.

- **T95 — Remove `data-testid` from R3F elements** —
  `<Canvas>` rendered `<mesh data-testid="…">` as a JSX prop
  on the DOM, which crashed with `'Cannot read properties of
undefined (reading 'testid')'` because Three.js doesn't
  serialize `data-testid` on `<mesh>`. Stripped test-ids from
  every R3F element in `Viewport3D/*`.

- **T96 — `isTauriRuntime` checks `__TAURI_INTERNALS__`**
  instead of the legacy `__TAURI__` global — the old check
  returned false under `npm run dev` (where the IPC bridge is
  present but the legacy global isn't) and silently turned
  the editor into a degraded preview. Added a focused helper
  in `src/utils/tauriEnv.ts` + patched every call site.

- **T97 — Front-end wiring audit + 3 real bugs closed** —
  `src/test/wiringAudit.test.ts` programmatically verifies
  (a) every export in `src/` has a consumer, (b) every
  `#[tauri::command]` is registered in `tauri::generate_handler![]`,
  (c) every registered command is invoked from the FE
  (soft check; ≤ 5 allowed for forward-looking surface),
  (d) every hook in `src/hooks/` has a consumer. The first
  pass caught and removed 8 dead-surface exports:
  `SelectionCommand` / `CompositeCommand`, `MorganBevyIcon`,
  `useAsset`, `pasteFromClipboard` / `hasClipboardData`,
  `instanceMatches`, `addConstraintKeyHandlers`,
  `downloadUpdate`. Findings document:
  `docs/dev/integration-wiring-audit.md`. (The audit itself
  is the new `wiringAudit` test; the 3 real-bug fixes it
  spawned are listed separately in this entry.)

- **T98 — Wire the 11 unused Rust commands into the FE** —
  the editor compiled against the Rust backend but never
  invoked 11 of the registered `#[tauri::command]` functions
  (`generate_navmesh`, `load_level_from_file`, `save_level_to_file`,
  `load_project_from_path`, `path_exists`, plus a handful
  of asset-database ones). Wired each into the appropriate
  UI hook with zod-validated IPC responses. Audit-fast path:
  `src/test/wiringAudit.test.ts` flips the "soft check" threshold
  on for these and verifies the wiring.

- **Surface orphaned panels + fix dead shortcut + store wiring**
  — `feat(editor): surface orphaned panels, fix dead shortcut
and store wiring` (commit `5c28d1f`). The Settings modal
  (a panel that was visually orphaned — no entry point) gained
  an `AnalyticsPanel` + a `Restore Defaults` button for
  shortcut overrides. The keyboard shortcut table gained
  `G` (toggle grid snap), `Z`/`X`/`Y` (axis locks), and `T`
  (local/world coord space) — short-cuts that the previous
  hook hard-coded and silently dropped when the settings
  table was empty. 15 files / 421 insertions.

- **Match generated Rust marker types to `bevy-morgan-integration`**
  — `fix(export): match generated Rust marker types
to bevy-morgan-integration` (commit `f8f2ab3`). The
  editor's Rust source-code exporter emitted locally-defined
  `enum SpawnPoint { ... }` / `enum TriggerVolume { ... }`,
  which were structurally-but not nominally identical to
  the companion crate's. The companion crate's `On<Add,
SpawnPoint>` observers could never fire on entities from
  the generated file. Fixed by importing the types from
  `bevy_morgan_integration::*` rather than redefining them.
  `Light` / `Animation` / `Audio` / `Vfx` (which had no local
  redefinition) additionally got explicit imports — the
  previous generation produced an `E0433 unresolved-type`
  compile error.

- **Shift-pan orbit camera + fly-mode click guard + gizmo coord
  space** — `fix(viewport): shift-pan orbit camera, fly-mode
click guard, gizmo coordinate space` (commit `5402c4f`).
  Orbit camera now pans when shift is held (matched Blender /
  Unity convention), fly-mode no longer starts on a stray
  click inside the canvas, and the gizmo respects the local/
  world coord-space toggle that `T` cycles. Removed a stale
  duplicate `TransformGizmos` component that was
  shadowing the canonical one.

- **Wire 3D/2D keyboard shortcuts and mouse interactions**
  — `fix(viewport): wire 3D/2D keyboard shortcuts and mouse
interactions` (commit `f6f9416`). Rewrote the keyboard
  shortcut table from a hard-coded `switch` (commit `61a1a54`
  had swept clippy but not fixed the actual shortcuts) into
  the table-driven `DEFAULT_SHORTCUTS` model that later
  shipped as T60. 9 files / 705 insertions. Hooked up mouse
  pan / zoom / rotate on the orbit + fly cameras so the
  shortcuts had something to fire against.

- **Clean up clippy suppressions per `nick.md`** —
  `fix: clean up clippy suppressions per nick.md — narrow
`#[expect]` and proper error handling` (commit `da1f715`).
  Replaced blanket `#[allow(clippy::...)]` with `#[expect(...)]`
  where the suppression was genuinely temporary, and replaced
  `unwrap()` / `expect()` with `?` / `match` / `.get(...)` in
  the production paths that nick.md's hard-denies
  (`unwrap_used`, `expect_used`, `panic`, `indexing_slicing`)
  would otherwise catch.

### Added — T90 v2 Inline emission mode (follow-up)

- **T90 v2 — Inline emission mode** — `SystemsMode::Inline` is now
  wired through the emission path end-to-end. The previous state
  (parser + header only, emission falling through to
  `CompanionReference`) was the last item in the README's "Upcoming"
  section.
  - **Companion crate** (`crates/bevy-morgan-integration/src/
systems_inline.rs`, new): exposes `pub const SYSTEMS_SOURCE:
&str = r#"..."#` containing `MorganLevelSystems` plugin
    struct + the five reference systems (`door_proximity_open`,
    `collectible_pickup`, `spawn_point_observer`,
    `trigger_volume_observer`, `light_observer`,
    `animation_player_observer`, `audio_observer`,
    `vfx_observer`, `nav_mesh_collector`) verbatim. Five new tests
    pin the contract: every `add_systems` / `add_observer`
    registration the runtime plugin uses appears in `SYSTEMS_SOURCE`,
    every bookkeeping type (`PickupEvent`, `Lights`, etc.) appears,
    every marker type is referenced by short name, and
    `bevy_morgan_integration::*` does NOT appear in the inline
    source (the runtime-independence promise).
  - **Editor** (`src-tauri/src/export/exporters.rs`): new internal
    `generate_rust_code_with_mode()` branches emission by
    `SystemsMode`. The public `generate_rust_code()` defaults to
    `CompanionReference` for fresh exports; `re_export_rust_code`
    now actually honours `parse_systems_mode_from_header` —
    the audit-flagged bug ("Inline falls through to
    CompanionReference") is gone.
  - **Inline emission shape**: CompanionReference mode emits
    `use bevy_morgan_integration::systems::*;` + `add_plugins(plugin())`
    (unchanged). Inline mode emits (a) no `systems::*` import, (b)
    bookkeeping-type imports only (`PickupEvent`, `Lights`, etc.),
    (c) the `SYSTEMS_SOURCE` block stamped verbatim, and (d) a
    per-`MarkerSet`-gated `plugin_init` helper that wires only the
    systems / observers the level actually uses. Re-exports
    preserve the mode across regenerations.
  - **Dependencies**: `src-tauri/Cargo.toml` gains a path
    dependency on the companion crate so `SYSTEMS_SOURCE` is
    reachable from the exporter at compile time.
  - **Strict clippy** (per `~/Projects/nick.md`): `-W pedantic +
nursery + -D unwrap_used/expect_used/panic/indexing_slicing +
-D warnings` clean on both crates. No `unwrap()` /
    `expect()` / `panic!` in production code (all 24 `.expect()`
    calls are in test modules, which already have
    `clippy::unwrap_used, expect_used` allow).
  - **cargo update --aggressive**: 28 minor/patch dependency
    bumps within existing ranges. Major-version bumps (glam 0.24
    → 0.33, ron 0.8 → 0.12, rusqlite 0.32 → 0.40, petgraph 0.6 → 0.8,
    nalgebra 0.32 → 0.35, noise 0.8 → 0.9, kdtree 0.6 → 0.8, md5 0.7
    → 0.8, rfd 0.14 → 0.17, rstar 0.11 → 0.13, rand 0.8 → 0.10,
    sha2 0.10 → 0.11, env_logger 0.10 → 0.11) deliberately deferred
    — each is its own PR per project policy.
  - **cargo-deny**: advisories ok, licenses ok, sources ok. The
    pre-existing `bans` failure ("wildcard dependency for
    proc-macro-error v1.0.4") pre-exists this change (verified
    with `git stash`; same failure on clean `main`).

  Test totals after this batch: companion crate 40/40
  (+12 new SYSTEMS_SOURCE tests); editor 146/146 (+3 new T90v2
  tests); vitest 732/732.

### Removed / Reverted

- **T72 — Distribution packaging** (rolled back per user request on
  2026-08-08). The three package-manager formulas
  (`packaging/homebrew/morgan-bevy.rb`, `packaging/aur/PKGBUILD`,
  `packaging/scoop/morgan-bevy.json`) and the maintainer runbook
  (`docs/developer/distribution.md`) were authored and committed in
  `9484b00` but the user opted to keep `packaging/` untracked going
  forward. `git rm -r --cached packaging/` + `packaging/` added to
  `.gitignore` so the files stay on disk for the maintainer but are
  never re-committed. The previous commit `9484b00` remains in history;
  the runbook is still useful as a local reference for what the
  formulas would look like if T72 is re-attempted; the formulas
  themselves remain on disk in `packaging/` for the same purpose.

### Security

- **cargo-deny supply-chain policy** (`src-tauri/deny.toml`, `scripts/cargo-deny.sh`,
  `docs/dev/supply-chain.md`). License allow-list (MIT, Apache-2.0, BSD-2/3, ISC,
  MPL-2.0, Unicode-\*, Zlib, OpenSSL, CC0-1.0, 0BSD, MIT-0). Bans on multiple
  versions (`warn`), wildcards (`deny`), unknown registries, unknown git sources.
  Acknowledged unmaintained advisories (all transitive through tauri v2.11.5,
  no safe upgrade available): RUSTSEC-2023-0089, 2024-0370, 2024-0411..0419,
  2024-0420, 2024-0436, 2025-0075, 2025-0080, 2025-0081, 2025-0098, 2025-0100.
  CI must run with fresh advisories (`cargo deny fetch && cargo deny check`) —
  local cache can be stale. Track these and re-verify after every tauri bump.

## [0.4.0] - 2025-11-24 - "Testing Infrastructure & Enhanced UI Release"

### Added

- **Comprehensive Testing Infrastructure**
  - Complete Vitest testing framework with jsdom environment for React component testing
  - Professional test setup with Tauri API mocking, localStorage, and clipboard mocking
  - Three.js WebGL context mocking for headless testing environment
  - Lucide React icon mocking system for component isolation
  - 30+ passing tests covering utilities, store management, and UI components
  - MaterialEditor component test suite with user interaction testing
  - Editor store test suite covering object management, selection, and transforms
  - Automated test execution with npm test script integration

- **Enhanced Inspector Panel System**
  - Advanced tile properties management with comprehensive metadata support
  - Emoji icon integration for tile types (🟫🚪🪟🧱📦🌟🎯⚡) with visual categorization
  - ASCII character mapping system for tile representation
  - Movement and vision property controls with checkbox interfaces
  - Tag preset system for rapid tile configuration
  - Grid position tracking with coordinate display
  - Metadata persistence and synchronization with editor store

- **Professional Material Editor Component**
  - Complete PBR material property editing with metallic/roughness workflow
  - Material preset library with basic materials (Metal, Plastic, Wood, Glass, Concrete)
  - Advanced material presets with emissive properties (Neon, LED, Gold, Copper, Chrome)
  - Texture browsing and management with file system integration
  - Material preview system with visual representation
  - Copy/paste material functionality with clipboard integration
  - Custom material saving and preset management with localStorage persistence
  - Multi-object material application with batch editing support

### Enhanced

- **Editor Store Architecture**
  - Enhanced metadata support in object properties for complex tile data
  - Improved type safety with explicit parameter annotations
  - Fixed Zustand 5.0.8 compatibility issues with proper type inference
  - Better state management for complex UI interactions
  - Resolved compilation errors and warnings across all store methods

- **Component Testing Framework**
  - Complete mock infrastructure for isolated component testing
  - Testing utilities for user interactions and state verification
  - Professional test organization with describe/it structure
  - Coverage for critical UI workflows and edge cases

- **Code Quality Improvements**
  - Fixed all TypeScript compilation errors and warnings
  - Resolved 21+ compilation errors in MaterialEditor tests
  - Enhanced import management and dependency resolution
  - Improved error handling and debugging infrastructure
  - Professional logging and development workflow optimization

### Fixed

- **Testing Infrastructure Issues**
  - Resolved MaterialEditor test compilation errors with proper mock setup
  - Fixed localStorage and clipboard mocking for component tests
  - Corrected Three.js WebGL context mocking for headless environments
  - Fixed Lucide React icon mocking with comprehensive icon coverage
  - Resolved store test issues with proper state management verification

- **Component Architecture Fixes**
  - Fixed Inspector Panel integration with enhanced metadata support
  - Corrected MaterialEditor component rendering and interaction issues
  - Resolved prop passing and component composition problems
  - Fixed test setup and configuration for reliable test execution

- **Build and Development Issues**
  - Resolved all npm test execution errors and failures
  - Fixed import statements and dependency management
  - Corrected TypeScript configuration for testing environment
  - Enhanced development workflow with reliable testing pipeline

### Technical Achievements

- **Test Coverage**: 30 tests passing across 3 test suites (utilities, store, components)
- **Code Quality**: Zero compilation errors and warnings in test environment
- **Component Reliability**: Comprehensive testing for critical UI components
- **Development Workflow**: Robust testing infrastructure for continued development
- **User Experience**: Enhanced Inspector Panel and Material Editor for professional workflows

## [0.3.5] - 2025-11-24 - "Professional Asset Management Release"

### Added

- **Professional SQLite Asset Database System**
  - Complete SQLite backend with rusqlite 0.32.1 for enterprise-grade asset management
  - Comprehensive database schema: assets, metadata, collections, thumbnails, and tags tables
  - Full-text search capabilities with efficient indexing for rapid asset discovery
  - Asset metadata extraction and storage (file size, checksums, creation/modification dates)
  - Collection management with automatic categorization and user-defined groups
  - Thumbnail generation and caching system for visual asset browsing
  - Database migration system for seamless schema updates

- **Advanced Asset Browser UI**
  - Professional asset browser component with comprehensive database integration
  - Real-time search with debounced input for optimal performance
  - Advanced filtering by asset type, collection, and custom metadata
  - Statistics dashboard showing total assets, storage usage, collections count, and last scan time
  - Drag-and-drop asset integration with 3D viewport (preserved from previous versions)
  - Virtual scrolling for handling thousands of assets efficiently
  - Asset preview capabilities with thumbnail support
  - Bulk operations and multi-select functionality
  - Complete JSX component structure with proper conditional rendering and hideHeader prop support

- **Comprehensive Menu System**
  - Fully functional File, Edit, View, Generate, Tools, and Help menus
  - Context-aware menu actions with proper state management
  - Keyboard shortcut integration and help system
  - Menu state synchronization with editor functionality
  - Professional menu styling with hover states and visual feedback

- **Enhanced UI Component System**
  - Streamlined component architecture with reduced redundancy
  - Improved CollapsiblePanel system with better header management
  - Professional tooltip system for asset statistics and UI elements
  - Consistent visual design language across all panels
  - Enhanced responsive design for various screen sizes

### Updated

- **Dependency Management and Compatibility**
  - Upgraded core dependencies for better performance and security
  - rusqlite updated to 0.32.1 with bundled SQLite and chrono features
  - Tauri v2.9 with enhanced plugin system integration
  - Updated @tauri-apps/api to v2.9.0 for frontend compatibility
  - Added sha2 0.10 for enhanced asset fingerprinting
  - Added rayon 1.8 for parallel asset scanning operations
  - Added tempfile 3.8 for comprehensive testing support

- **Code Quality and Architecture**
  - TypeScript configuration improvements with ignoreDeprecations for cleaner builds
  - Comprehensive error handling throughout asset management system
  - Professional logging and debugging infrastructure
  - Modular component architecture for better maintainability
  - Enhanced type safety across all TypeScript components

- **Performance Optimizations**
  - Efficient database queries with proper indexing strategies
  - Optimized asset scanning with parallel processing capabilities
  - Reduced UI redundancy for improved rendering performance
  - Enhanced state management with Zustand 5.0.8 integration
  - Memory-efficient asset loading and caching mechanisms

### Fixed

- **UI/UX Improvements**
  - Resolved duplicate header issues in panel components
  - Fixed critical JSX compilation errors in AssetBrowser preventing component rendering
  - Corrected JSX element balance and conditional rendering structure
  - Fixed resize handle functionality across all panels
  - Corrected menu state management and visual feedback
  - Enhanced component prop patterns for better reusability
  - Improved keyboard shortcut handling and conflicts resolution

- **Build and Compilation Issues**
  - Resolved all TypeScript compilation errors and warnings
  - Fixed critical JSX compilation errors in AssetBrowser component preventing build
  - Corrected JSX element structure and conditional rendering syntax issues
  - Fixed Rust compilation issues with updated dependencies
  - Corrected import statements and unused code cleanup
  - Enhanced build pipeline stability and reliability
  - Proper error handling in asset database operations

### Technical Debt Addressed

- **Component Architecture Cleanup**
  - Eliminated redundant component headers and improved prop interfaces
  - Standardized component patterns across the entire application
  - Enhanced component composition for better maintainability
  - Improved separation of concerns in UI components

- **Database Architecture**
  - Professional database design with proper normalization
  - Comprehensive indexing strategy for optimal query performance
  - Transaction management for data integrity
  - Error handling and recovery mechanisms
  - Scalable schema design for future enhancements

### Infrastructure Improvements

- **Development Environment**
  - Enhanced debugging capabilities with comprehensive logging
  - Improved hot reload functionality for faster development cycles
  - Better error reporting and troubleshooting tools
  - Enhanced testing framework with database testing support

- **Build System**
  - Optimized build pipeline with dependency caching
  - Enhanced cross-platform compatibility testing
  - Improved bundle size optimization
  - Better development vs. production configuration management

## [Unreleased] - 2025-11-24

### Updated

- **Code Quality and Error Resolution (November 24, 2025)**
  - **TypeScript Configuration** - Added `ignoreDeprecations: "6.0"` to resolve baseUrl deprecation warning
  - **GenerationPanel Cleanup** - Removed unused imports (`CreateObjectCommand`, `executeCommand`) for cleaner code
  - **Build Pipeline** - Resolved all compilation errors and warnings for production-ready builds
  - **Procedural Generation Fixes** - Fixed object creation logic and state management in GenerationPanel
  - **Debugging Infrastructure** - Added comprehensive logging for generation process troubleshooting

- **UI/UX Improvements (November 24, 2025)**
  - **Thinner Resize Bars** - Reduced resize handle width from 2px to 1px for more subtle interface
  - **Improved Resize Handles** - Enhanced visual feedback with better hover states and z-index layering
  - **Fixed Duplicate Headers** - Eliminated duplicate "Inspector" and "Layers" headers between CollapsiblePanel and component titles
  - **Enhanced Panel Management** - Added hideHeader prop to Layers component for cleaner integration with CollapsiblePanel
  - **Refined Visual Design** - More professional appearance with consistent styling across all panels
  - **Fixed Resize Functionality** - Resolved 3-column layout locking issue preventing proper panel resizing
  - **Improved Layout Calculations** - Better center width calculation with proper handle width accounting
  - **Window Resize Support** - Added window resize listener to maintain proper layout proportions

- **Dependency Management (November 24, 2025)**
  - Updated all npm packages to newer, compatible versions
  - **Zustand** - Upgraded from 4.5.7 to 5.0.8 to resolve major type inference issues
  - Fixed type inference problem where `selectedObjects` was incorrectly inferred as `never[]` instead of `string[]`
  - Added explicit type annotations throughout codebase for strict TypeScript compliance
  - Resolved 25+ TypeScript compilation errors systematically
  - Achieved successful production build with `npm run build`

### Fixed

- **Code Quality and Compilation Issues (November 24, 2025)**
  - **TypeScript Configuration** - Resolved baseUrl deprecation warning by adding ignoreDeprecations setting
  - **Unused Import Cleanup** - Removed unused CreateObjectCommand and executeCommand imports from GenerationPanel
  - **Build Process** - Eliminated all compilation errors for clean production builds
  - **GenerationPanel Debugging** - Fixed object creation logic and added comprehensive debugging logs
  - **State Management** - Improved Zustand store integration with direct addObject calls for bulk operations
  - Resolved Zustand type inference problems with array initialization and object properties
  - Added explicit parameter types to all callback functions and store methods
  - Fixed array spread type issues in TransformGizmos with explicit tuple typing
  - Corrected state parameter types in setState callbacks across all components
  - Eliminated unused variable warnings in command pattern implementations
  - Fixed parameter type annotations in component callbacks (ActionsPanel, Inspector, Scene, etc.)

### Added

- **Professional Resizable UI System**
  - Dynamic panel resizing with drag handles for left sidebar (hierarchy), right sidebar (inspector), and bottom panel (assets)
  - Custom useResizablePanels hook managing resize state with mouse event handlers and collision boundaries
  - Min/max width constraints (200px-600px) and height constraints (150px-400px) for optimal UX
  - Visual resize indicators with hover effects and proper cursor styling
  - Smooth drag interactions with real-time panel size updates
  - Collapsible bottom panel with toggle button and minimal collapsed state

- **Advanced Camera Control System**
  - Custom useCameraControls hook for Three.js camera manipulation within React context
  - Reset view functionality returning camera to default position (10, 10, 10) with smooth transitions
  - Focus selection feature calculating bounding boxes of selected objects for optimal framing
  - Camera control buttons integrated into viewport toolbar with professional styling
  - Proper Three.js OrbitControls integration with programmatic camera positioning
  - forwardRef pattern in Viewport3D component enabling external camera control access

- **Complete Assets Panel System**
  - Collapsible asset browser with local and external folder support
  - Drag-and-drop integration from assets panel to 3D viewport
  - File system integration via Rust backend with `scan_assets`, `browse_assets_folder`, and `scan_assets_folder` Tauri commands
  - Asset type detection (model, texture, material, audio, other) with appropriate icons
  - Grid layout displaying file names, types, and metadata
  - Visual drop indicators and feedback during drag operations
  - Automatic 3D object creation based on dropped asset types
  - Error handling with fallback mock data for development
  - Demo assets folder with sample 3D models

- **Fully Functional Transform Gizmos**
  - Complete Three.js TransformControls integration for translate/rotate/scale operations
  - Real-time transform updates synchronized between 3D viewport and editor store
  - Proper scene object naming system for gizmo attachment (`scene.getObjectByName()`)
  - Transform mode switching via toolbar buttons and keyboard shortcuts (W/E/R)
  - Visual gizmo rendering with world/local space support
  - Multi-object transform capability through selection system

- **Enhanced Scene Management**
  - Demo scene objects (cube, sphere, pyramid) with full interactivity
  - Real-time scene rendering with Three.js mesh creation from store objects
  - Selection highlighting with color-coded materials (blue=selected, yellow=hovered)
  - Object lifecycle management (create, update, delete) with proper cleanup
  - Transform data storage and synchronization between store and Three.js objects
  - Visibility and interaction state management

- **Advanced Keyboard Shortcuts System**
  - Transform mode shortcuts: W (translate), E (rotate), R (scale)
  - Selection operations: Escape (clear selection), Delete/Backspace (remove objects)
  - Edit operations: Ctrl+D (duplicate selected objects)
  - View controls: G (toggle grid), 1/2/3 (camera modes)
  - Input handling system with modifier key support (Ctrl, Shift)
  - Context-aware shortcuts that ignore input fields
  - Professional workflow efficiency matching industry standards

- **Rust Backend Enhancements**
  - Asset scanning module (`src-tauri/src/assets.rs`) with file system operations
  - File type detection and metadata extraction (size, modified date)
  - Native file dialog integration using `rfd` crate
  - MD5 hashing for asset identification and caching
  - Cross-platform file path handling and error management
  - Tauri command registration and frontend integration

### Enhanced

- **Editor Store Improvements**
  - Added demo objects with proper transform data for immediate testing
  - Enhanced object duplication with unique ID generation and spatial offset
  - Improved transform update system with partial transform support
  - Extended state management for asset integration and scene lifecycle

- **UI/UX Polish**
  - Professional transform mode toolbar with active state indicators
  - Grid snapping controls with configurable increments (0.1, 0.5, 1.0, 2.0)
  - Camera mode switcher with orbit/fly/top-down options
  - Viewport coordinate display and status indicators
  - **Industry-Standard Resizable Panels** - Drag handles with visual feedback and constraint boundaries
  - **Professional Camera Navigation** - Reset and focus controls matching Unity/Blender workflows
  - Consistent dark theme styling across all panels with enhanced interaction states

- **Three.js Integration Optimizations**
  - Proper mesh naming for transform gizmo attachment
  - Improved raycasting and object picking performance
  - Enhanced material management with state-based coloring
  - Optimized scene graph structure for large object counts

### Fixed

- **Compilation and Build Issues**
  - Resolved all Rust compilation warnings with `#[allow(dead_code)]` attributes
  - Fixed unused code warnings in procedural generation modules (BSP, WFC, themes, formats)
  - Corrected Tauri command registration in main.rs for asset management
  - Updated Cargo.toml dependencies for file dialog and hashing support

- **Three.js Integration Bugs**
  - Fixed transform gizmos not attaching to selected objects
  - Corrected scene object naming for proper gizmo-object association
  - Resolved selection highlighting and material update issues
  - Fixed transform synchronization between gizmos and editor store

- **State Management Fixes**
  - Corrected object selection persistence across operations
  - Fixed multi-object selection with Ctrl+click additive behavior
  - Resolved transform state updates not propagating to 3D scene
  - Fixed object removal not clearing from selection state

### Technical Debt Addressed

- Cleaned up unused procedural generation code with proper allow directives
- Improved error handling in asset scanning with graceful degradation
- Enhanced type safety in transform operations and object management
- Standardized file naming conventions and module organization

---

## [0.1.0] - 2025-11-23 - "Foundation Release"

### Added

- **Complete Project Foundation**
  - Tauri + React + TypeScript + Three.js development environment
  - Hot reload configuration for both frontend and backend development
  - Complete build pipeline with cross-platform support
  - Professional project structure with component organization

- **Core 3D Viewport System**
  - Three.js integration with React Three Fiber
  - Interactive 3D canvas with orbit camera controls
  - Professional lighting setup (ambient, directional, point lights)
  - Shadow mapping and anti-aliasing configuration
  - Grid overlay system with infinite grid and section markers
  - World coordinate axes for spatial reference

- **Object Selection Framework**
  - Raycasting-based mouse picking for 3D objects
  - Single-click selection with visual feedback
  - Multi-selection with Ctrl+click additive behavior
  - Hover state detection and highlighting
  - Selection highlighting with outline effects
  - Ground plane interaction for selection clearing

- **Editor State Management**
  - Zustand store with Immer middleware for immutable updates
  - Complete editor state interface covering all editor aspects
  - Selection state tracking (selected objects, hover state)
  - Transform mode management (select, translate, rotate, scale)
  - Camera mode switching (orbit, fly, top-down)
  - Grid and UI state management (visibility, snapping, statistics)

- **UI Component Architecture**
  - **Viewport3D** - Main 3D rendering canvas with controls
  - **Hierarchy** - Scene object tree view with selection integration
  - **Inspector** - Object property panel (foundation)
  - **ActionsPanel** - Tool palette and quick actions
  - **App.tsx** - Professional layout with menu bar and toolbar
  - Consistent dark theme with custom CSS variables

- **Keyboard Shortcuts Foundation**
  - Basic shortcut system with key event handling
  - Transform mode switching (W, E, R keys)
  - Grid toggle and view controls
  - Escape for selection clearing
  - Input field filtering to avoid conflicts

- **Rust Backend Foundation**
  - **Procedural Generation Framework**
    - BSP (Binary Space Partitioning) algorithm implementation
    - WFC (Wave Function Collapse) foundation
    - Theme system for different architectural styles
    - Room subdivision and corridor generation logic

  - **Export System Architecture**
    - Multi-format export trait system
    - JSON exporter for universal compatibility
    - RON (Rusty Object Notation) exporter for Bevy integration
    - Rust code generation for direct game integration
    - Export format validation and error handling

  - **Spatial Systems**
    - 3D bounding box calculations
    - Spatial indexing structures
    - Collision detection foundations
    - Coordinate transformation utilities

- **Development Tooling**
  - ESLint configuration for code quality
  - TypeScript configuration with strict type checking
  - Tailwind CSS for consistent styling
  - Vite build configuration with optimization
  - Git configuration with appropriate ignores

### Initial Project Structure

```text
morgan-bevy/
├── src/                          # React frontend
│   ├── components/               # UI components
│   │   ├── Viewport3D/          # 3D rendering system
│   │   ├── Hierarchy/           # Scene tree management
│   │   ├── Inspector/           # Property editing
│   │   └── ActionsPanel/        # Tool palette
│   ├── store/                   # Zustand state management
│   ├── hooks/                   # Custom React hooks
│   └── main.tsx                 # Application entry point
│
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── generation/          # Procedural algorithms
│   │   ├── export/              # Multi-format export
│   │   ├── spatial.rs           # 3D math and indexing
│   │   └── main.rs              # Tauri application
│   └── Cargo.toml               # Rust dependencies
│
└── Assets/                      # Sample 3D models and textures
```

### Development Environment Features

- **Cross-platform Support** - Windows, macOS, Linux compatibility
- **Hot Reload** - Frontend and backend changes reload automatically
- **Type Safety** - Full TypeScript coverage with strict configuration
- **Performance Monitoring** - Three.js stats integration
- **Professional Tooling** - ESLint, Prettier, Tailwind CSS

### Architecture Decisions

- **Zustand over Redux** - Simpler state management with Immer integration
- **Three.js over WebGL** - Mature 3D ecosystem with React integration
- **Tauri over Electron** - Better performance and smaller bundle size
- **RON over JSON** - Native Bevy serialization format support
- **Component Composition** - Modular UI architecture for extensibility

### Performance Targets Established

- 60 FPS with 10,000+ objects in viewport
- Selection response < 16ms for interactive editing
- Generation < 200ms for 48x36x3 levels
- Professional workflow efficiency matching Unity/Blender

---

## Project Information

**Repository**: [Morgan-Bevy](https://github.com/greysquirr3l/morgan-bevy)
**License**: MIT OR Apache-2.0
**Author**: Nick Campbell
**Started**: November 23, 2025

**Core Philosophy**: "Generate smart, edit fast, export perfect."

### Technology Stack

- **Frontend**: Tauri + React + Three.js + TypeScript + Tailwind CSS
- **Backend**: Rust + Serde + Tauri APIs
- **3D Rendering**: Three.js + React Three Fiber + Drei
- **State Management**: Zustand + Immer
- **Build System**: Vite + Cargo

### Target Audience

- Game developers using the Bevy engine
- Level designers and 3D environment artists
- Procedural generation enthusiasts
- Indie game studios needing rapid prototyping tools

### Project Goals

1. **Professional 3D Level Editor** - Industry-standard editing capabilities
2. **Procedural Generation** - BSP and WFC algorithms for rapid content creation
3. **Bevy Integration** - Native export formats for seamless game integration
4. **Performance** - 60 FPS editing with thousands of objects
5. **Extensibility** - Plugin system for custom tools and generators
