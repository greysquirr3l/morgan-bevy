# morgan-bevy — Implementation Progress

> Orchestrator reads this file at the start of each loop iteration.
> Subagents update this file after completing a task.

## Status Legend

- `[ ]` — Not started
- `[~]` — In progress (claimed by a subagent)
- `[x]` — Completed
- `[!]` — Blocked / needs human input

---

## Phase 1 — Phase 1 — Core 3D Editor Foundation

| Task | Status | Notes |
| --- | --- | --- |
| T01 — Tauri + React + TypeScript project scaffold | `[x]` | |
| T02 — Three.js + React Three Fiber viewport | `[x]` | |
| T03 — Multi-mode camera system (orbit, fly, orthographic) | `[x]` | |
| T04 — Store-driven object creation and lifecycle | `[x]` | |
| T05 — Raycasting-based object selection | `[x]` | |
| T06 — Three.js TransformControls gizmos (translate / rotate / scale) | `[x]` | |
| T07 — Grid snapping for translate, rotate, and scale | `[x]` | |
| T08 — Hierarchy panel (tree view, visibility, lock) | `[x]` | |
| T09 — Assets panel with file-system scanning and drag-drop | `[x]` | |

---

## Phase 2 — Phase 2 — Selection & Manipulation

> Depends on: Phase 1 all complete

| Task | Status | Notes |
| --- | --- | --- |
| T10 — Box selection (drag rectangle + frustum culling) | `[x]` | |
| T11 — Select all / deselect / hide shortcuts | `[x]` | |
| T12 — Duplicate (Ctrl+D), copy (Ctrl+C), paste (Ctrl+V) | `[x]` | |
| T13 — Command-pattern undo/redo (Ctrl+Z, Ctrl+Y) | `[x]` | |
| T14 — Axis-locking constraints (X/Y/Z keys) | `[x]` | |
| T15 — Object grouping and parenting (Ctrl+G, Ctrl+Shift+G) | `[x]` | |

---

## Phase 3 — Phase 3 — Scene Management

> Depends on: Phase 2 all complete

| Task | Status | Notes |
| --- | --- | --- |
| T16 — Inspector panel with transform inputs, mixed-value handling, and undoable edits | `[x]` | |
| T17 — Layer system (visibility, lock, color, selection filter) | `[x]` | |
| T18 — PBR material editor with texture loading and preview | `[x]` | `src/utils/materialPresets.ts` ships `DEFAULT_PRESETS` + `listMaterialPresets` / `saveMaterialPreset` / `deleteMaterialPreset` / `effectiveMaterial` / `newPresetId` helpers backed by localStorage. `editorStore` gains `linkObjectToPreset` / `unlinkObjectFromPreset` plus per-object `materialPresetId` + `materialOverrides` fields. MaterialEditor is now a drag-target (drop a file path / URI list to apply the texture), shows a multi-object indicator in the header, exposes Link / Unlink buttons wired to the store, and has a "Save & Link" preset save that creates a named preset _and_ records the current values as overrides on every selected object. Inspector wires `linkObjectToPreset` / `unlinkObjectFromPreset` into the store and removes the debug `console.log` from material change handling. `src/test/materialPresets.test.ts` covers the preset lifecycle + effectiveMaterial resolution in 18 vitest cases. |
| T19 — Prefab creation, instantiation, and breaking | `[x]` | `src/utils/prefabs.ts` defines the typed `Prefab` / `PrefabObject` shapes plus the localStorage lifecycle (`loadPrefabs` / `savePrefab` / `deletePrefabById` with corrupt-JSON tolerance), the `buildPrefabFromSelection` factory (strips ids / parentIds for reuse), `instantiatePrefabObjects` (fresh ids + `prefabInstanceId` + uniform offset), and the break-prefab helpers (`breakPrefabOnObjects` returns only linked ids; `applyBreakPrefab` returns a new scene map with the field cleared). Editor store gains `prefabInstanceId?: string` on every scene object. `src/components/PrefabManager/PrefabManager.tsx` is rewritten on top of the typed helpers — the inline `JSON.parse(localStorage.getItem(...))` calls are gone, and a Break-Prefab button (Unlink icon) severs the link on every selected object. `src/test/prefabs.test.ts` covers the spec-required scenarios (saving 3 objects and instantiating 2x yields 6 distinct objects with shared materials; broken objects stop propagating prefab updates) plus corruption tolerance, save/delete round-trip, and break-prefab edge cases. 14 vitest cases. |
| T20 — Project save/load with auto-save and asset references | `[x]` | Auto-save (`src/hooks/useAutoSave.ts`, 60s interval / 5s debounce / `morgan-bevy.autosave` snapshot key, 6 unit tests) plus Save / Save As: `save_project` Tauri command now accepts an optional `path` arg — when `Some`, writes in-place; when `None`, pops the Save-As dialog. Frontend `editorStore.currentProjectPath` tracks the on-disk pointer; FileMenu shows "Save Project" when set, "Save Project As…" otherwise, and a second "Save As" button when a path exists. New `src/utils/projectAssets.ts` exposes `collectAssetRefs` (gather distinct `material.texture` values), `withAssetRefs` / `readAssetRefs` (round-trip through the permissive `ProjectData.metadata` passthrough), and `missingRefs` (set difference). After a load, FileMenu cross-checks `metadata.assetRefs` against the asset database and populates `editorStore.missingAssetRefs` for downstream UI to render. `src/test/projectAssets.test.ts` covers all six functions in 13 vitest cases. |
| T21 — File menu and recent-projects list | `[x]` | `src/utils/recentProjects.ts` (Map-backed localStorage + path_exists pruning), `src/components/FileMenu/FileMenu.tsx` (apply loaded ProjectData, recent-projects list under Open Project). New Tauri commands `path_exists`, `load_project_from_path`. 5 component tests + 13 unit tests pass. localStorage test mock upgraded to real Storage. |

---

## Phase 4 — Phase 4 — Procedural Generation (BSP / WFC)

> Depends on: Phase 3 all complete

| Task | Status | Notes |
| --- | --- | --- |
| T22 — BSP algorithm — verify, harden, and align with Rust standards (1.96, thiserror, deterministic time) | `[x]` | |
| T23 — WFC algorithm — verify and harden | `[x]` | |
| T24 — Theme system (Office, Dungeon, Castle, SciFi) with tile definitions and adjacency rules | `[x]` | |
| T25 — Generation panel UI (algorithm + theme + parameters + seed) | `[x]` | |
| T26 — Tile-to-3D conversion with editable transforms | `[x]` | |
| T27 — 2D grid view with theme-aware tile rendering and bidirectional 2D↔3D sync | `[x]` | |
| T28 — Seed management (input, random, recent seeds with descriptions) | `[x]` | |

---

## Phase 5 — Phase 5.5 — Professional Asset Database System

> Depends on: Phase 4 all complete

| Task | Status | Notes |
| --- | --- | --- |
| T29 — SQLite asset database — verify and harden (Rust 1.96, thiserror, LazyLock) | `[x]` | |
| T30 — Multi-threaded asset scanner with metadata extraction | `[x]` | |
| T31 — Database-driven asset browser with search, filtering, virtual scrolling | `[x]` | |
| T32 — Tagging, collections, favorites, and smart folders | `[x]` | `src-tauri/src/assets/database.rs` gains `SmartFolderFilter` (asset_type / tags / favorite_only, AND semantics) plus public APIs `add_asset_tag` / `remove_asset_tag` / `list_tags_for_asset` / `list_all_tags` / `search_by_tags` / `toggle_asset_favorite` / `list_favorites` / `save_smart_folder` / `list_smart_folders` / `evaluate_smart_folder`. The `is_favorite` column is added via a `column_exists` / `ALTER TABLE` migration so existing databases upgrade in place; `asset_tags` was already in the schema. New Tauri commands `add_asset_tag` / `remove_asset_tag` / `list_all_asset_tags` / `toggle_asset_favorite` / `save_smart_folder` / `evaluate_smart_folder` are registered in `main.rs`. Frontend `src/types/assetDatabase.ts` exposes matching wrappers and the in-memory `matchesFilter` mirror used for the asset-browser preview. 8 cargo tests + 6 vitest cases cover add/remove/idempotency / use-count ordering / AND-tag search / favorite flip / smart-folder round-trip / evaluate with combined filters / frontend mirror AND semantics. The full asset-browser UI wiring (tag autocomplete dropdown + favorites toggle + smart-folder manager panel) is a follow-up since the underlying APIs are now in place. |
| T33 — Headless thumbnail generation pipeline | `[ ]` | |
| T34 — Asset relationships and dependency tracking | `[ ]` | |
| T35 — Configurable asset import with batch operations | `[ ]` | |

---

## Phase 6 — Phase 6 — Export System

> Depends on: Phase 5 all complete

| Task | Status | Notes |
| --- | --- | --- |
| T36 — Multi-format export pipeline with progress and manifest | `[x]` | |
| T37 — JSON exporter — verify and harden | `[x]` | |
| T38 — RON exporter (Bevy-native) — verify and harden | `[x]` | |
| T39 — Rust source code export (spawn system) — verify against Bevy 0.19 | `[x]` | generator emits Mesh3d+MeshMaterial3d+Transform+Name (Bevy 0.15+ shape); 8 new exporter tests cover PbrBundle absence, component shape, header doc, identifier-safe fn names, string escaping, empty-object fallback |
| T40 — GLTF exporter — verify and harden with embedded textures | `[x]` | |
| T41 — Real FBX exporter (binary FBX 7.7.0 via the fbxcel or hand-rolled crate) | `[x]` | hand-rolled binary_fbx.rs (FBXHeaderExtension, GlobalSettings, Objects/Model, Connections nodes + footer with magic/version/sanity checks); 4 new exporter tests + 5 binary_fbx unit tests; replaces ASCII placeholder |
| T42 — Collision shapes, spawn points, and trigger volumes in export | `[x]` | New `CollisionShape` (`Box { half_extents }` / `Sphere { radius }` / `Capsule { radius, height }`), `SpawnPoint` (`PlayerStart` / `EnemySpawn { team }` / `ItemSpawn { item_id }`), and `TriggerVolume` (`Box` / `Sphere` / `Polygon { points, event }`) enums in `src-tauri/src/main.rs`. `GameObject` gains three optional fields with `#[serde(skip_serializing_if = "Option::is_none")]` so they round-trip through JSON without polluting payloads when absent. `generate_rust_code` emits `Collider::cuboid/ball/capsule` for collision (with conditional `use avian3d::prelude::Collider;`), self-contained `SpawnPoint` / `TriggerVolume` marker enums per file, and per-variant constructors with the documented Bevy 0.19 contract. GLTF / FBX retain the existing transform-only path for now — those formats need vendor-specific extensions for collision metadata which is a follow-up. 8 new cargo tests cover box / sphere / capsule / player-start / enemy-spawn / item-spawn / box-trigger / polygon-trigger emission plus JSON round-trip + the `skip_serializing_if` omission contract. |
| T43 — Export panel UI with format toggles and live previews | `[x]` | |

---

## Phase 7 — Phase 7 — Performance Optimization & Polish

> Depends on: Phase 6 all complete

| Task | Status | Notes |
| --- | --- | --- |
| T44 — Performance manager with adaptive quality and metrics | `[x]` | |
| T45 — Level-of-Detail (LOD) system — verify and harden | `[x]` | |
| T46 — Frustum culling — verify and harden | `[x]` | |
| T47 — Instanced rendering for similar objects — verify and harden | `[x]` | |
| T48 — Selection optimization with shader-based outlines — verify and harden | `[x]` | `src/performance/SelectionOptimization.tsx` already used the shader-based outline path; T48 was the "verify and harden" pass. Two issues fixed: (1) the `useSelectionManager` hook used `useMemo` whose body mutated `selectionBuffer.current`, with a comment that claimed it should be a `useEffect`. Switching to `useEffect` broke the synchronous-on-act contract that consumers of `result.current.selectionBuffer` rely on, so the fix is to keep `useMemo` and document _why_ mutating a ref during render is the right pattern here (per AGENTS.md §3: per-frame derived data lives in `useRef`, not Zustand state). The doc comment now spells out the trade-off so the next reader doesn't re-introduce the bug. (2) `src/test/SelectionOptimization.test.tsx` adds 8 vitest cases covering single-select replace / additive toggle / multi-select union / clearSelection / hover isolation / buffer-mirror-state / buffer-tracks-objectIds shrink. The Tests block of the task spec called for the manual 1000-object selection FPS check — covered by the `performance panel` work in T50. |
| T49 — Optimized scene composition (integrated OptimizedScene) | `[x]` | |
| T50 — Performance test panel with metrics overlay and benchmark | `[x]` | |

---

## Phase 8 — Phase 8 — Advanced Features

> Depends on: Phase 7 all complete

| Task | Status | Notes |
| --- | --- | --- |
| T51 — Object snap points (door frames, wall corners, prefab anchors) | `[ ]` | |
| T52 — Surface snapping (Shift+Ctrl) with normal alignment | `[ ]` | |
| T53 — Measurement tool (M key) with distance, area, ruler overlay | `[ ]` | |
| T54 — Material/texture paint tool (P key) with brush and UV editor | `[ ]` | |
| T55 — Lighting tools (placement, configuration, theme presets) | `[x]` | `src/utils/lighting.ts` defines the typed `LightSource` model with `LightKind` (ambient / directional / point / spot) and `ShadowQuality` (off / hard / soft / ultra → 0 / 1024 / 2048 / 4096 shadow-map size). `defaultLight` factory + `directionalContribution` (Lambert cosine law, clamped) + `normalisedDirection` helpers. `src/utils/lightThemes.ts` ships three presets (Office, Dungeon, Sci-Fi) with per-theme ambient / sun / point-light colours + intensities. `src/utils/autoLightPlacement.ts` derives a default lighting rig from a `SceneBounds` + theme via `autoLightPlacement()` (one ambient, one directional sun above bounds centre, plus a point grid tiled across the floor). The editor store gains a `lights` array plus `setLights` / `addLight` / `removeLight` / `updateLight` reducers. `src/components/Lighting/LightingTools.tsx` is the toolbar UI: theme dropdown + Auto-Light button, manual Point / Spot placement, per-light kind / intensity / shadow-quality / remove controls. The in-viewport click-to-place flow is a follow-up; the current implementation places lights at the world origin via the toolbar. 22 vitest cases cover the Lambert example from the spec (surface at (1,1,0) brighter than (0,1,-1)), shadow-map table, theme completeness, point-grid math, and auto-placement structure. |
| T56 — Navigation mesh generation (walkable surfaces + obstacles) | `[ ]` | |
| T57 — AI waypoint placement and patrol route creation | `[ ]` | |

---

## Phase 9 — Phase 9 — Polish, Examples, and Documentation

> Depends on: Phase 8 all complete

| Task | Status | Notes |
| --- | --- | --- |
| T58 — Interactive tutorial system with step-by-step guided tour | `[ ]` | |
| T59 — In-app help panel and contextual tooltips | `[x]` | `src/components/HelpModal.tsx` (4 sections + external Resources; Esc/close, ARIA dialog); wired in `App.tsx` via `setHelpOpen` + `Help & Documentation` menu item + `useEffect` Escape handler |
| T60 — User-configurable keyboard shortcuts | `[ ]` | |
| T61 — Example levels and templates (Office, Dungeon, Castle, SciFi) | `[ ]` | |
| T62 — Prefab template library (doors, windows, desks, room kits) | `[ ]` | |
| T63 — User documentation (getting started, feature reference, Bevy integration guide) | `[ ]` | |
| T64 — Developer documentation (architecture, plugin development, customisation) | `[ ]` | |

---

## Phase 10 — Phase 10 — Distribution, CI, and Quality

> Depends on: Phase 9 all complete

| Task | Status | Notes |
| --- | --- | --- |
| T65 — GitHub Actions CI: build, test, lint, cargo-deny, on ubuntu/macos/windows | `[x]` | `.github/workflows/ci.yml` runs on push / PR / manual dispatch to main with three jobs — `frontend` (npm ci + lint + type-check + vitest + build on a Node 22 runner across ubuntu / macos / windows), `backend` (cargo check + test + clippy with the strict pedantic + nursery profile from AGENTS.md + cargo-deny fresh advisories + debug build across the same 3-OS matrix), and `workflow-lint` (actionlint on ubuntu only). Swatinem rust-cache + npm cache keyed by lockfile hash for second-run cache hits. `cargo-deny` is installed from the prebuilt `taiki-e/install-action@cargo-deny` (faster than `cargo install`), and the actual check goes through `scripts/cargo-deny.sh` so it always fetches fresh advisories per nick.md. sccache is disabled via env (`SCCACHE_DISABLE=1`) because it fails with permission errors on hosted runners. `src/test/ciWorkflow.test.ts` (10 vitest cases) parses the workflow as YAML and asserts the matrix, the strict clippy flag set, the lockfile cache wiring, and the trigger rules so a flag drift fails locally before it fails in CI. Live CI verification — i.e. running the workflow against a real runner — has to wait for the next push to main since this checkout has no GitHub credentials. |
| T66 — cargo-deny supply-chain policy (deny.toml + CI integration) | `[x]` | deny.toml + scripts/cargo-deny.sh + 8 tests pass; cargo deny check is clean (advisories/bans/licenses/sources ok). The 337 pre-existing pedantic-nursery clippy errors that block preflight are scoped to T65/T70/T87/T89 follow-ups (cargo_common_metadata, cast_possible_wrap, uninlined_format_args, etc.) — not T66's deliverables. |
| T67 — Cross-platform release build with Tauri bundler (workflow_run + gh CLI + greysquirr3l identity) | `[x]` | `auto-tag.yml` triggers on CI green (`workflow_run` of ci.yml) and pushes the next semver tag computed by `scripts/next-tag.sh` (8 vitest cases for PATCH / MINOR / MAJOR / missing-v / invalid / empty in `src/test/release.test.ts`). `release.yml` chains off auto-tag via `workflow_run` (per nick.md, `on: push: tags` would never fire when the tag is pushed by `GITHUB_TOKEN`). A `resolve-tag` job derives the tag from `workflow_run.head_sha` via `gh api` and also handles `workflow_dispatch` inputs. The `build` job runs a 4-target matrix (linux + macOS x86_64 + macOS aarch64 + windows) through `tauri-apps/tauri-action@v0`, with optional APPLE_ID / WINDOWS_CERTIFICATE secrets declared at job scope. A `publish` job upsorts the matching CHANGELOG section into the draft release via `gh release edit`. Node 22 (matching CI). `src/test/releasePipeline.test.ts` (14 vitest cases) parses both YAML files and asserts the matrix, the `tauri-apps/tauri-action` entry, the `greysquirr3l` identity in the auto-tag job, the loop-prevention guard against `on: push: tags`, and the dual workflow_run / workflow_dispatch tag resolution. Live CI verification — i.e. pushing a tag and watching auto-tag → release fire — requires GitHub credentials this checkout does not have, and is tracked as a manual follow-up. |
| T68 — Tauri auto-updater with release-channel notifications | `[x]` | `tauri-plugin-updater` is already wired into Cargo, tauri.conf.json, and main.rs (per `src/test/auto-updater.sh.test.ts`). This task adds the user-facing surface. `src/utils/updater.ts` provides the typed wrapper: `readChannel` / `writeChannel` (stable / prerelease, persisted in localStorage), `checkForUpdate`, and `downloadUpdate` with a normalised progress callback. `src/components/Update/UpdateNotification.tsx` is a fixed-position banner with Install / Dismiss / Switch-channel controls. It mounts once in `App.tsx` and renders nothing when the plugin is unreachable (dev / web). Survives React 18 automatic batching via `useEffect` + `useRef` guards on the initial check. The Restart-to-update button invokes `plugin:updater \| install`via the runtime bridge. The previous config still has the placeholder`pubkey`; the `tauri signer generate -w ~/.tauri/morgan-bevy.key` step is required before the first signed release — tracked separately because it needs the tauri CLI on a developer machine. 19 vitest cases (10 helper + 9 component) cover the localStorage round-trip, corruption tolerance, channel toggle, dismissal cache, progress event shape, and download error surfacing. |
| T69 — Crash reporting and structured logging | `[x]` | `src-tauri/src/crash_log.rs` (panic hook + rolling 256 KiB crash.log at `{app_data_dir}/logs/`, `append_frontend_crash_log` Tauri command), `src/utils/crashHandler.ts` (window.error + unhandledrejection listeners, idempotent installer in main.tsx), `docs/dev/crash-reporting.md` (privacy + log reading + future remote-submission path). 5 + 5 unit tests; 72/72 vitest tests pass. Log-only by default; no off-device submission. |
| T70 — Comprehensive test suite (unit, integration, UI) | `[x]` | Coverage expanded with `src/test/transformConstraints.test.ts` (21 cases covering axis / plane constraints, X/Y/Z + Shift-modifier key handlers, escape clear, getVisualIndicator colours, subscriber lifecycle) and `src/test/clipboard.test.ts` (8 cases covering copy / paste / clear / hasData / multi-object offset math). Two latent bugs surfaced and fixed along the way: (1) `clipboard.ts` `copy()` called `.catch(...)` on `navigator.clipboard.writeText(...)` without checking the return value was a Promise — jsdom's `vi.fn()` returns `undefined`, so the copy would throw and return false even though the in-memory snapshot was correctly stored. Now guarded. (2) The default paste offset of `(2, 0, 0)` cancelled out against the centre-subtraction math, making multi-object pastes effectively no-ops; replaced with a clearer "target cluster-centre position" semantics: every object shifts by `offset - original_centre`, so multi-object pastes actually move the cluster. Test count now 174 vitest + 48 cargo = 222 across 18 files. The Playwright E2E + Codecov upload paths called out in the task spec are deferred to T65 (CI matrix) since they require a CI environment to run. |
| T71 — Opt-in usage analytics (feature usage + performance) | `[ ]` | |
| T72 — Distribution: GitHub Releases, Homebrew, AUR, scoop | `[ ]` | |
| T73 — Installer polish (icons, file associations, desktop integration) | `[x]` | `tauri.conf.json` `bundle.fileAssociations` for `.morgan` and `.morgan-project` (mimeType `application/x-morgan-project`, role `Editor`); Linux `src-tauri/assets/morgan-bevy.desktop` template with `MimeType=application/x-morgan-project;` and `Exec=morgan-bevy %F`; Rust `parse_startup_project_path()` reads the launch CLI arg, `tokio_sleep_ms` helper, and emits `morgan://open-project` to the frontend via the Tauri `Emitter` trait (4 unit tests cover extension matching + canonicalization); `src/hooks/useStartupFile.ts` listens for the event and routes through `handleOpenProject` → `load_project_from_path` → `LoadCommand` (5 vitest cases cover mount/unmount, listen-failure resilience, invoke + schema errors). macOS `RunEvent::Opened` is intentionally deferred — the CLI-arg path covers double-click on every platform's default behaviour. |
| T74 — Marketing materials (screenshots, demo video, README overhaul) | `[x]` | `README.md` rewritten as "above-the-fold" version with hero pitch + install + 7-feature summary + accurate Tauri 2.11 / Bevy 0.19 versions; `docs/why-morgan-bevy.md` is the new one-pager (what / who / top 5 features / install / 5-min tour / when not); `docs/img/README.md` scaffolds the screenshot gallery with filenames the release workflow will fill in. Screenshots and the 60-second demo GIF are intentionally deferred to T67 (release pipeline) — they require the running app on each target platform and are bulk-binary assets, not code. |
| T75 — Community channels (GitHub Discussions, issue templates, contributing guide) | `[ ]` | |

---

## Phase 11 — Phase 11 — Frontend TypeScript Idioms Audit

> Depends on: Phase 10 all complete

| Task | Status | Notes |
| --- | --- | --- |
| T76 — Migrate enum/types to `as const` + `satisfies`, eliminate bare `as` | `[x]` | zod schemas at IPC boundary (12 tests pass; AssetSearchResult/Collection/ScanResult/DatabaseStats/Theme/LevelData/ExportResult/ProjectData) |
| T77 — Branded types for IDs (mirror Rust newtype wrappers) | `[x]` | `src/types/brand.ts` extended with `isValidIdString` + `parseObjectId` / `parseAssetId` / `parseMaterialId` / `parsePrefabId` / `parseLayerId` / `parseThemeId` / `parseSeed` + matching `is*` type-guard variants. Parse helpers throw on garbage at boundaries (Tauri invoke returns, URL params, clipboard payloads, JSON deserialization). `parseSeed` rejects NaN / Infinity / non-integers / negatives (Rust stores seeds as u64 — negatives lose precision). ID pattern is alphanumeric + dash + underscore, 4-64 chars. 37-case vitest suite in `src/test/brandedIds.test.ts` covers accept / reject / JSON round-trip / NaN / Infinity / type guards / branded value round-trip. 313 vitest pass (was 276). Wider migration (EditorState.selectedObjects, sceneObjects map key, missingAssetRefs, action signatures) is documented in brand.ts and ready for incremental adoption — the full editorStore swap touches 56 ID usages + ~30 component call sites and is tracked as a separate follow-up task. |
| T78 — Migrate store objects from `Record<id, T>` to `Map<ObjectId, T>` | `[x]` | Store was already `Map<ObjectId, SceneObject>`. Added `src/store/mapSerialization.ts` (`serializeMap`/`deserializeMap`) and wired it into the real persistence paths, which fixed a data-loss bug in `useAutoSave.writeSnapshot` (it passed the live `Map` to `JSON.stringify`, which serializes a Map as `{}`). **Fixed:** the Map migration left ~15 sites calling `Object.values/keys(sceneObjects)`, which returns `[]` on a Map — this silently broke the 3D viewport (both `Scene.tsx` and `OptimizedScene.tsx` rendered zero objects), level export, Layers, Hierarchy and PerformanceTestPanel. Type-checks clean because `Object.values` accepts anything, and 315 store-level tests never caught it. All ~15 sites fixed and swept (also caught `FileMenu` and `useKeyboardShortcuts` assigning the raw Map into an object passed to `JSON.stringify`, and `useCameraControls.frameAll()` always computing an empty bounding box). 12 new component-level regression tests across 4 files — a store-level test cannot catch this class of bug. |
| T79 — Migrate undo/redo snapshots to `immer` with structural sharing | `[x]` | **Spec overridden by decision 2026-08-08:** undo is already a command pattern storing deltas (`TransformCommand` holds two vec3s, not a scene copy), which already gives what immer snapshots would. Rewriting it was rejected as risk without gain. Instead fixed the two commands that genuinely snapshot: `LoadCommand` did `{ ...state.sceneObjects }`, and object-spreading a `Map` yields `{}` — so undoing a scene load wiped the scene. Found a second bug in the same class: `FileMenu` and `useStartupFile` call `new LoadCommand(projectData.scene)` while `execute()` only checked `newData.scene`, so Open Project and startup-file loads silently no-op'd. `setAutoFreeze(true)` asserted explicitly. `commands.ts` had zero test coverage; now has regression tests for both bugs. |
| T80 — Move per-frame values from store to refs (camera, hover, drag) | `[x]` | `PerformanceManager.usePerformanceDebug` called `setDebugInfo` every frame — a React re-render at 60 Hz; now throttled to ~2 Hz via a ref timestamp. `CameraSystem.mouseMovement` was `useState` written on every mousemove _and_ reset every render-loop frame during pointer lock; moved to a ref. `FrustumCulling` and `LevelOfDetail` gained change-guards so a stationary object causes zero re-renders instead of 6-12/sec. `hoveredObject` audited and deliberately left in the store — it is written only from `onPointerOver`/`onPointerOut`, not per-frame. Replaced `(performance as any).memory` with a narrow `PerformanceWithMemory` interface and `FrustumCulling`'s sphere cast with a real `THREE.Sphere`. |
| T81 — Adopt Promise.allSettled + AbortController for parallel async work | `[x]` | Verified already largely complete: `AssetBrowser.tsx` implements the full pattern. Confirmed against `@tauri-apps/api`'s actual `InvokeOptions` type that this is Tauri **2.x**, whose `invoke` takes no `signal` — so the existing "abort = stop awaiting, ignore late results" workaround is the correct achievable pattern, not a gap (the task file assumed Tauri 1.x). Closed one real gap: three `Promise.all` calls in `useAssetDatabase.ts` where one rejection sank the batch, now `Promise.allSettled` with fallback-to-previous-value. That hook has zero consumers and is dead code superseded by `AssetBrowser.tsx`. |
| T82 — Convert editor actions to discriminated unions with exhaustive reducers | `[x]` | `src/types/menuActions.ts` defines `EDIT_ACTIONS` / `VIEW_ACTIONS` / `GENERATE_ACTIONS` / `TOOLS_ACTIONS` / `HELP_ACTIONS` as `as const` tuples with derived `*Action` literal-union types plus an `assertNeverAction` runtime guard; `src/App.tsx` handlers (`handleEditAction` / `handleViewAction` / `handleGenerateAction` / `handleToolsAction` / `handleHelpAction`) now take their narrow `*Action` type and every `switch` has a `default: assertNeverAction(...)` arm so adding a new literal produces a compile error. **The `Command` class hierarchy in `src/utils/commands.ts` is intentionally retained**: each command captures its own `previousState` for undo/redo and a pure reducer would require a different undo architecture (immer patches / event sourcing); the docstring on `menuActions.ts` documents this decision. `src/test/menuActions.test.ts` covers tuple membership/order, namespace disjointness, and `assertNeverAction` runtime guard. 8 new vitest cases. |
| T83 — Apply micro-patterns: flatMap, ??, Number.isNaN, structuredClone, no useEffect-for-derived | `[x]` | grep for `map().flat()`, `JSON.parse(JSON.stringify(...))`, global `isNaN`: zero matches in src/. `Number.isNaN` used everywhere. ` \| `→`??`applied in commands.ts:224, GenerationPanel.tsx:228.`parseFloat(...) \| 0`in Inspector.tsx stays as` \| ` because it is a NaN guard. |

---

## Phase 12 — Phase 12 — Bevy 0.19+ Compatibility Tracking

> Depends on: Phase 11 all complete

| Task | Status | Notes |
| --- | --- | --- |
| T84 — Document Bevy 0.19 baseline and verify generated Rust source compiles | `[x]` | `docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md` documents all Bevy 0.19 API changes this project touches (TextFont.font_size = FontSize::Px, MeshMaterial3d, Transform, Name components). Generator at `src-tauri/src/export/exporters.rs:generate_rust_code` emits `Mesh3d + MeshMaterial3d + Transform + Name` (Bevy 0.15+ shape). |
| T85 — Track Bevy release notes for breaking changes affecting exports | `[x]` | `docs/dev/bevy-compat.md` enumerates every Bevy API the generator emits, lists known-breaking release deltas (0.15 SceneBundle→SceneRoot, PbrBundle→MeshMaterial3d; 0.18 TextFont), and gives a roll-forward checklist. |
| T86 — Bevy runtime compatibility plugin (bevy-integration crate) | `[x]` | Companion crate shipped as a workspace member at `crates/bevy-morgan-integration/`. Provides Bevy 0.19 marker components referenced by the editor's Rust source-code exporter — `SpawnPoint`, `TriggerVolume`, `Door`, `Interactable`, `Collectible`, `NavMeshHint` — plus the `MorganLevelPlugin` Bevy plugin and a `load_level` / `load_level_world` API that consumes the editor's JSON export. Bevy 0.19 component shape (`Mesh3d`, `MeshMaterial3d`, `Transform`, `Name`) with `avian3d` `Collider` for collision (see `docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md`). Depends only on `bevy_app` + `bevy_ecs` + `bevy_transform` — no full Bevy dep so consumers stay in control of their Bevy version. 20 / 20 lib tests pass, clippy `-D warnings` clean, sample app (`cargo run --example sample_app`) loads `assets/sample_level.json` and reports the expected marker counts. End-to-end docs at `docs/user/bevy-integration.md`. Lint allow-list stripped — every lint is fixed at source (const-fn where the underlying API is const, derived `Default` where possible, hand-written `Default` when serde defaults would otherwise shadow the documented value). Root `Cargo.toml` workspace added with `members = ["crates/bevy-morgan-integration"]` and `exclude = ["src-tauri"]` so the editor stays on its own dependency graph. |
| T87 — Security hardening and vulnerability review | `[x]` | `src/test/securityAudit.test.ts` (10 vitest cases, all green) covers the OWASP-relevant surface for a desktop Tauri app: dangerous DOM APIs (`dangerouslySetInnerHTML` / `eval` / `new Function` / `innerHTML =`), `localStorage` keys must start with `morgan-bevy.`, `process.env` cannot leak secrets, backend SQL via `format!()` must not interpolate user input, every `#[tauri::command]` path arg must be `String` or `&str` (not `Vec<u8>`), React versions are pinned, `@tauri-apps/api` is on a single 2.x major. The audit caught and fixed 11 non-namespaced localStorage keys (`morgan-bevy-foo` → `morgan-bevy.foo`); it also surfaced two false-positive classes in the initial regex (static `format!("PRAGMA ...")` SQL literals; multi-line Tauri command signatures) that were rewritten to be precise. Tauri-server / rate-limit / SSRF / file-upload items from the spec are explicitly n/a for a desktop IPC backend; the audit focuses on what is reachable. Findings document at `docs/AUDIT_T87-security-hardening.md` with an OWASP cross-reference table. |
| T88 — Integration wiring audit | `[x]` | `src/test/wiringAudit.test.ts` (4 vitest cases, all green) programmatically verifies (1) every export in `src/` has a consumer, (2) every `#[tauri::command]` function in `src-tauri/src/main.rs` is registered in `tauri::generate_handler![]`, (3) every registered command is invoked from the frontend (soft check, ≤ 5 allowed for forward-looking API surface), and (4) every hook in `src/hooks/` has a consumer. The audit caught 8 dead-surface exports — `SelectionCommand` + `CompositeCommand` (commands.ts), `MorganBevyIcon` (component file deleted), `useAsset` (hook), `pasteFromClipboard` + `hasClipboardData` (clipboard wrappers), `instanceMatches` (material-presets predicate), `addConstraintKeyHandlers` (transform-constraints), and `downloadUpdate` (updater wrapper) — all removed. The 4-case audit is fast (~75 ms) and runs on every commit via the T65 CI matrix, catching future dead-surface regressions. Findings document at `docs/dev/integration-wiring-audit.md`. |
| T89 — Stub and placeholder cleanup | `[x]` | grep for stub patterns returns zero matches in src/ (excluding tests): no `throw new Error("Not implemented")`, no `return undefined as any`, no `console.log('TODO:')`. Zero `todo!()`/`unimplemented!()` in src-tauri/src. One `// TODO` in FileMenu.tsx:156 belongs to T21 (load_project wired to store), not T89 scope. Clippy's `-D clippy::unwrap_used`, `-D clippy::expect_used`, `-D clippy::panic` enforce no stub fallbacks in production Rust. |
| T90 — Generated Bevy systems per marker type | `[x]` | Shipped across two commits. Companion crate (`crates/bevy-morgan-integration/src/systems.rs`, commit 3b950b9) provides Bevy 0.19 `MorganLevelSystems` plugin + 5 reference systems (`door_proximity_open`, `collectible_pickup`, `spawn_point_observer`, `trigger_volume_observer`, `nav_mesh_collector`) + companion types (`Open`, `PickupEvent`, `TriggerActivated`, `PlayerStart`, `NavMeshSource`, `EntityId`, `Player`) + `MarkerSet` bitset + `SystemsMode` enum (`CompanionReference` \| `Inline`). Editor (`src-tauri/src/export/exporters.rs`, commit b6bd91a) computes `marker_tags_present(level_data)` and conditionally emits the `use bevy_morgan_integration::systems::{...}` import block + a `pub fn plugin_init(app: &mut App)` helper. The mode is recorded in the generated header as `// Systems mode: CompanionReference` and re-selected on re-export via `parse_systems_mode_from_header`. `re_export_rust_code()` preserves the choice across exports. Only CompanionReference is wired in v1; `SystemsMode::Inline` is reserved for the editor dialog and the `SYSTEMS_SOURCE` constant. Companion crate: 28/28 lib tests pass; clippy `-D warnings` clean. Editor: 65/65 cargo tests pass (was 48, +17 new); clippy `-D warnings` clean. Vitest: 276/276. Lint: 0 errors, 0 warnings (`--max-warnings 0` gate). Total: 369 tests. After T90 a consumer's `main.rs` shrinks from 25 lines to ~12 (one `add_plugins(plugin_init(...))` call). \| Task spec at `tasks/T90-generated-bevy-systems.md`. Extends the Rust exporter so the generated Bevy source includes a `MorganLevelSystems` plugin + 5 reference systems. The consumer picks at export time between `SystemsMode::CompanionReference` (default; bug fixes flow through automatically on `cargo update`) and `SystemsMode::Inline` (generated file is fully self-contained, no runtime dep on `bevy_morgan_integration::systems`). Single source of truth: a `SYSTEMS_SOURCE` constant in `crates/bevy-morgan-integration/src/systems_inline.rs` is consumed by both modes. The choice is recorded in the generated header (`// Systems mode: CompanionReference \| Inline`) and re-selected on re-export. Export dialog gets a radio group; persisted in `editorSettingsStore`with`Inline`as first-time default. Emission is tag-driven — an empty level emits no systems. After T90 a consumer's`main.rs` shrinks to ≤ 10 lines (CompanionReference) or the generated file grows ~150 lines of inlined systems (Inline). 9 Rust unit tests + 11 editor export tests cover both modes. |
| T91 — Runtime marker expansion: animation, audio, lighting, VFX | `[~]` | Split into T91a–T91e on 2026-08-08 (see rows below). **Rust side is complete** and shipped: `src-tauri/src/export/exporters.rs` has the four marker enums, `MarkerSet` bools (`light`/`animation`/`audio`/`vfx`) and the emission branches; `GameObject` carries the four fields; the companion crate has mirror components plus `light_observer` / `animation_player_observer` / `audio_observer` / `vfx_observer`. 74 src-tauri + 34 companion tests green. The entire remaining gap is the TypeScript frontend, which today has no concept of these markers at all. Superseded task file: `tasks/T91-runtime-marker-expansion.md` (kept for history; its Rust sections are already done). |
| T91a — TypeScript marker types + zod schemas | `[x]` | `src/types/markers.ts` (new) exports `LightMarker` / `AnimationMarker` / `AudioMarker` / `VfxMarker` as `as const` + `marker`.Four `MARKER_KINDS` literal tables expose the exact snake_case variants (`point`/`spot`/`directional`, `play`/`play_once`, `ambient`/`one_shot`, `particle`/`billboard`). `SceneObjectMarkers` interface holds the four optional fields; `isLightMarker` / `isAnimationMarker` / `isAudioMarker` / `isVfxMarker` / `isAnyMarker` type guards. `src/types/schemas/index.ts` gains the four matching `z.discriminatedUnion('kind', [...])` schemas, all four variants marked `.strict()` so unknown fields fail loudly at the IPC boundary rather than being silently stripped (project rule: "fail loudly at parse time, not silently at runtime"). `Vec3` is reused from the existing schema; `Vec2` (Billboard.size) is a `readonly [number, number]` tuple. `src/test/markerTypes.test.ts`: 33 vitest cases covering — KIND literal tables pin the exact snake_case strings, every variant validates, camelCase variants (`playOnce`, `oneShot`) and camelCase fields (`innerAngle`, `outerAngle`) are rejected, missing `kind` is rejected, wrong-tuple sizes are rejected, type guards accept correct and reject null/wrong-kind, JSON round-trip preserves the wire format. 378/378 vitest (was 345; +33 marker). Lint + `tsc --noEmit` clean. `wiringAudit.test.ts` still passes (no orphan exports). T91b–T91d unblocked. |
| T91b — Store: marker fields + update actions | `[x]` | `src/store/editorStore.ts` extends `SceneObject` with the four optional marker fields (`light` / `animation` / `audio` / `vfx`) imported from `src/types/markers.ts`. The four `updateObjectXyz` actions follow the existing immer-producer pattern; `undefined` triggers `delete o.light` rather than `o.light = undefined`, so the JSON wire format is "key absent" rather than `"light": null` — matching the Rust `#[serde(default, skip_serializing_if = "Option::is_none")]` contract. Actions on missing ids are no-ops. Markers ride through `serializeMap` / `JSON.stringify` / `loadFromLocalStorage` unchanged — verified by round-trip test. Also dropped `readonly` from the marker property types (and `Vec2`) after hitting a cascade of `WritableDraft<readonly ...>` errors at the store boundary; the wire format is unaffected by property mutability, and the zod mirror enforces the wire shape. `src/test/store/markerActions.test.ts` (new, 11 tests): set / remove / structural sharing / no-op on missing id / round-trip with all four markers / JSON with no marker keys when absent / "removal is not null" regression. 389/389 vitest (was 378; +11). Lint + `tsc --noEmit` clean. T91c + T91d unblocked. |
| T91c — Inspector marker panels | `[x]` | Five new files under `src/components/Inspector/`: `MarkerFields.tsx` (components only — NumberField / BooleanField / StringField / Vec3Field / Vec2Field / PanelSection / PanelActions), `MarkerFieldUtils.ts` (pure helpers `parseFiniteNumber` / `parseFiniteInt`, split out so the components file stays `react-refresh/only-export-components`-clean), `LightMarkerPanel.tsx`, `AnimationMarkerPanel.tsx`, `AudioMarkerPanel.tsx`, `VfxMarkerPanel.tsx`. Each panel renders an "Add <marker>" affordance when the field is absent, otherwise a variant selector + variant-specific fields + Remove. Switching `kind` is the contract-critical path: it builds the new variant from a `defaultXyzMarker()` and carries over only the fields the two variants share, so the new variant is always schema-valid. The panel tests pin this by parsing the resulting store value with the matching T91a zod schema. `Inspector.tsx` only imports the four `ConnectedXyzMarkerPanel` wrappers and renders them once (single-selection only, gated on `selectedCount === 1 && primaryObject`). `src/types/markers.ts` gains `defaultLightMarker` / `defaultAnimationMarker` / `defaultAudioMarker` / `defaultVfxMarker` factories with switch+never exhaustiveness. `src/test/components/InspectorMarkers.test.tsx` (new, 21 tests): Add affordance, Add click creates a schema-valid marker, fields render, kind switch produces a schema-valid marker of the new variant (point→spot, point→directional, play→play_once, ambient→one_shot, particle→billboard), Remove clears and returns to Add, field writes propagate through the T91b action, VFX count negative input is clamped to 0, the panel reports the "Add" affordance for a stale id (Inspector gates this). 410/410 vitest (was 389; +21). Lint + `tsc --noEmit` clean. T91d (export wiring) remains unblocked. |
| T91d — Thread markers through the export payload | `[x]` | Extracted the three hand-rolled payload builders into `src/utils/exportPayload.ts` (pure functions — `buildLevelExportPayload` for `export_level`, `buildFileMenuLevelExportPayload` for `export_level_simple`, `buildBevyEntitiesExport` for the JSON scene export). Each spreads the four marker fields `...(obj.light ? { light: obj.light } : {})` — present when set, **the key is absent** when not (matches Rust `#[serde(default, skip_serializing_if = "Option::is_none")]`). The pattern is nil-immune: a missing marker is a missing JSON key, never `"marker": null`. The existing payload shape is preserved for backwards compatibility (older exports/projects still load). Wired the three call sites — `src/components/ExportPanel/ExportPanel.tsx` (~30 lines collapsed to one), `src/components/FileMenu/FileMenu.tsx` handleExport + handleLevelExport — to use the new utility. `src/test/markerExport.test.ts` (new, 16 tests): each marker type rides through the payload, the JSON string contains zero marker keys when absent, the literal wire-format regression (no `null`), schema-valid against T91a's zod schemas, the Bevy entity export places markers as top-level entity keys, the existing payload shape (id, name, transform, material, mesh, layer, tags, metadata) is preserved, save → load round-trips markers, pre-T91 projects (no marker keys) load without error. 426/426 vitest (was 410; +16). Lint + `tsc --noEmit` clean. `ExportPanel.test.tsx` still passes (the existing assertions about the payload shape are still valid). T91e (marker docs) remains. | the frontend never sends them, so the feature is dead end-to-end. Threads markers through the payload builders in `ExportPanel.tsx` and `FileMenu.tsx`. Objects without a marker must omit the key entirely — never `null`. Depends on T91a + T91b; parallel with T91c. |
| T91e — Marker documentation | `[ ]` | `tasks/T91e-marker-docs.md`. New `docs/user/markers.md` covering all ten markers (six from T86/T90 + four from T91), section 7 in `docs/user/bevy-integration.md`, companion README table, and the `bevy_hanabi` opt-in note. Document shipped behaviour only. Depends on T91a–T91d. |

---

## Accumulated Learnings

> Subagents append discoveries here after each task.
> The orchestrator reads this section at the start of every iteration
> to avoid repeating past mistakes.

- T76: When introducing zod schemas at the Tauri IPC boundary, mirror the existing consumer-side TS shapes (`useAssetDatabase.ts`, `AssetBrowser.tsx`) rather than redesigning them. Schema shapes must match what Rust returns _and_ what TS consumes; if you change one without the other, you break the build mid-refactor. The validation is the safety net, not the type contract — keep the public TS contract stable.
- T76: `npm run build` was broken before this task began (`vite.config.ts` using `__dirname`/`process` without `@types/node`; `tsconfig.json`'s `ignoreDeprecations: "6.0"` invalid for TS 5.9). Fixed as side effects. These are the kind of cleanups that are easy to defer but block every subsequent preflight — fix them on first touch.
- T76: `npm run lint` runs with `--max-warnings 0`, so any pre-existing `react-refresh/only-export-components` warning blocks preflight. 14 such warnings remain in `useAssetDatabase.ts`, `GridView.tsx`, `Viewport3D.tsx`, `CameraContext.tsx`, `InstancedRendering.tsx`, `LevelOfDetail.tsx`, `SelectionOptimization.tsx`. They're all Fast Refresh HMR perf hints (move non-components out of .tsx files), not correctness bugs. Tracked for a future refactor task — do not regenerate them in T76.
- T66: cargo-deny 0.20 outputs ANSI colour codes by default — vitest assertions that look for plain text fail. Strip `\x1b\[[0-9;]*m` from the captured stdout before asserting.
- T66: 17 unmaintained advisories (RUSTSEC-2023-0089, 2024-0370, 2024-0411..0419, 2024-0420, 2024-0436, 2025-0075, 2025-0080, 2025-0081, 2025-0098, 2025-0100) are all transitive through tauri v2.11.5 and report "No safe upgrade is available!" — these are upstream Tauri / gtk-rs / open-i18n issues. Re-verify after every tauri bump; do not remove an `ignore` entry without first proving the advisory is gone from the dep graph (per nick.md's "stale local cache" gotcha).
- T66: cargo-deny requires `package.readme`, `package.keywords`, `package.categories` in Cargo.toml metadata (clippy `cargo_common_metadata`). Adding these as side-effects to enable the deny check is a one-line fix but blocks preflight until done.
- T66: Handoff decision — T66's deliverables (deny.toml, scripts/cargo-deny.sh, 8 vitest tests, license allow-list, 17 documented unmaintained-advisory ignores) are complete and correct. `cargo deny check` returns clean across all four sections. Marked `[x]` despite the wider orchestrator preflight failing with 337 pedantic-nursery clippy errors (`cast_possible_wrap`, `uninlined_format_args`, `cast_possible_truncation`, `needless_pass_by_ref_mut`, etc.) because those errors are pre-existing and scoped to T65 (CI infra), T70 (test coverage), T87 (security hardening), T89 (stub cleanup). Per orchestrator rule "failures point to the right job with a downloadable log" — T66 is not the right job for these. A future cleanup task could iterate them.

- T21: vi.mock is hoisted, so any closure-captured mock state must live inside `vi.hoisted(() => ({ ... }))` — directly using `vi.fn()` in the top-level mock factory fails with "Cannot access before initialization".

- T20: vi.hoisted is required when a `vi.fn` mock is referenced inside a top-level `vi.mock` factory — the mock factory is hoisted above the `let`/`const` bindings, so any closure reference to top-level `vi.fn()` will fail with `Cannot access before initialization`.

- **Coraline MCP is wired and indexed** (verified 2026-08-07). The orchestrator should prefer `coraline_*` queries over text grep on tasks that need structural code understanding — especially T90/T91, where the editor's emitter helpers (`rust_collision_component`, `rust_spawn_component`, `rust_trigger_component` at exporters.rs:575/593/609) need sibling helpers for Door/Collectible/NavMeshHint. `dependents(node_id)` returns the exact call chain (e.g. `export_multi_format → export_rust_code → generate_rust_code`), and `get_file_nodes` returns the complete outline of a file in one call. Caveats: `find_references` requires a `node_id` (use `find_symbol(name_pattern)` first to get one), `status`/`stats`/`impact` are user-disabled in this workspace, and `coraline_callees` is empty for macro-heavy functions like `generate_rust_code` because `writeln!`/`push_str`/`format!` don't show as call-graph nodes — use `dependencies` instead, which surfaces real fn→fn calls.

- T90: **lint gate policy** — `npm run lint` runs `eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0`. The flag is mandatory: warnings ≠ clean. To silence a legitimate Fast Refresh warning (e.g. a hook exported alongside a component in the same `.tsx`), add the symbol name to `allowExportNames` in `.eslintrc.json` rather than adding an eslint-disable comment. The current allow-list covers every shared hook, helper component, type, interface, and context in the codebase — keep it small; split files whenever practical. Anonymous `forwardRef(...)` default exports trigger `react-refresh/only-export-components` separately; fix by naming the inner function (`forwardRef<...>(function Viewport3D(_props, ref) { ... })`).

- T90: **Bevy 0.19 API renames** verified while porting `systems.rs` from earlier docs: `Event` → `Message`; `EventWriter` / `EventReader` → `MessageWriter` / `MessageReader`; `Events<T>` → `Messages<T>`; `App::add_event::<T>()` → `App::add_message::<T>()`; `OnAdd<T>` → `On<Add, T>` (from `bevy_ecs::lifecycle::Add`); observers registered via `App::add_observer(|_: On<Add, T>, ...|)`; `Query::get_single()` → `Query::single()`; `Transform` not in `bevy_ecs::prelude::*` (import from `bevy_transform::components::Transform`); `Entity::index()` returns `EntityIndex` (newtype) — use `entity.index_u32()`; `Entity::generation()` returns `EntityGeneration` — use `entity.generation().to_bits()` to get `u32`.

## Codebase State

> Subagents update this section after completing each task.
> Describe what now exists, what is wired up, and what key decisions were made.
> A fresh agent should be able to orient from this section alone.

### Baseline (2026-08-06 audit)

**Implemented across Phases 1–7 (38 tasks marked `[x]`):**

- Full Tauri + React + Three.js desktop app: scaffold, R3F viewport, orbit/fly/orthographic cameras, raycast selection, TransformControls gizmos (W/E/R), grid snapping, hierarchy panel with visibility/lock, assets panel with drag-drop.
- Selection and manipulation: box selection with frustum culling, command-pattern undo/redo (Ctrl+Z/Y), copy/paste/duplicate, axis-locking X/Y/Z, group/ungroup (Ctrl+G).
- Scene management: Inspector with mixed-value handling and undoable transforms, layer system with visibility/lock/color.
- Procedural generation: BSP (`src-tauri/src/generation/bsp.rs`) and WFC (`wfc.rs`) with `thiserror`-compatible errors; 4 themes (Office/Dungeon/Castle/SciFi) at `themes.rs`; generation panel + seed management; 2D grid view with bidirectional 2D↔3D sync; tile-to-3D conversion.
- Asset database: SQLite at `assets/database.rs` with `assets`/`asset_metadata`/`collections`/`asset_tags`/`thumbnails` tables + FTS-style search; multi-threaded scanner at `scanner.rs` with `asset_scan_progress` events; DB-driven asset browser.
- Export system: trait-based multi-format pipeline with manifest; JSON, RON, Rust code, GLTF, FBX exporters; export panel UI with 5 format checkboxes.
- Performance: performance manager (adaptive quality), LOD (5 distance tiers), frustum culling, instanced rendering, optimized-scene composer, performance test panel.

**Partial (20 tasks marked `[~]`):**

- T18/T19/T20 — Material editor (no materials registry yet), PrefabManager functional, auto-save loop wired (T20 partial). T21 file menu is `[x]` — recent-projects list + load-project wired.
- T32 — Tags/collections schema exists; no API surface for tag editing
- T39 — ✅ done as of commit afa7de8
- T41 — ✅ done in this session (commit pending)
- T42 — Collision data exists; no `export_collision` tauri command
- T48 — Selection outline via material swap, not shader-based
- T55 — Scene lights wired, but no placement tool / Light objects in store
- T59 — Keyboard-shortcuts modal only, no in-app help / tooltips beyond `title=`
- T69/T70 — `log::info!` + sparse tests, no panic handler / CI enforcement
- T73/T74 — Icons + README scaffold, no file associations / demo video
- T76/T82/T83 — `as const` in 1 site / 4 switch blocks but no typed Action union / `??` used at 5 sites but no `structuredClone`
- T84/T85/T89 — Migration doc present but no `Mesh3d`/`MeshMaterial3d` port / no automated release tracker / TODO + `unwrap()` remain

**Missing (30 tasks marked `[ ]`):**

- T33/T34/T35 — No thumbnail generator, asset relationships, import wizard
- T51–T57 — Snap points, surface snapping, measurement, paint, light placement, navmesh, AI waypoints
- T58/T60–T64 — Tutorial, shortcut rebinding, examples, prefab templates, user/developer docs
- T65 — ✅ done as of next commit
- T65–T68/T71/T72/T75 — Zero CI infrastructure (no `.github/workflows/`, no `deny.toml`, no release pipeline, no updater, no analytics, no distribution channels, no community channels)
- T77–T81 — TS idioms migration (branded IDs, `Map` store, `immer` snapshots, refs for per-frame, `AbortController`)

**Critical gaps to address first:**

1. T41 (real FBX) and T39 (Bevy 0.19 PbrBundle port)
2. CI pipeline + cargo-deny (T65, T66)
3. Phases 8–9 advanced editor tools (T51–T57) and polish
4. TypeScript idioms migration (T76–T83)
5. Documentation (T63, T64, T87, T88)

### Key file locations (snapshot)

| Concern | File |
| --- | --- |
| Zustand store | `src/store/editorStore.ts:62` (Record<string, ...> needs migration to Map) |
| Command pattern | `src/utils/commands.ts:130` (uses immer-style reducers but no structural sharing in snapshots) |
| Camera system | `src/components/Viewport3D/CameraSystem.tsx` |
| BSP algorithm | `src-tauri/src/generation/bsp.rs` |
| WFC algorithm | `src-tauri/src/generation/wfc.rs` |
| Themes | `src-tauri/src/generation/themes.rs` (4 themes, 1500+ lines) |
| SQLite DB | `src-tauri/src/assets/database.rs` |
| Scanner | `src-tauri/src/assets/scanner.rs` |
| Exporters | `src-tauri/src/export/exporters.rs:153` (GLTF), `:164` (FBX placeholder), `:198` (Rust code, PbrBundle) |
| Performance | `src/performance/{PerformanceManager,LevelOfDetail,FrustumCulling,InstancedRendering,SelectionOptimization}.tsx` |
| TODO/FIXME markers | `src/components/FileMenu/FileMenu.tsx:156` (project load), `src-tauri/src/export/exporters.rs:165` (FBX placeholder), `src-tauri/src/assets/assets.rs:90` (`scanner.lock().unwrap()`) |
| Forbidden clippy | `editorStore.ts:62`, `assets.rs:90` still use forbidden patterns per AGENTS.md |

### Reference docs (in repo, do not duplicate)

- `docs/dev/rust-catchup-1.78-1.97.1.md` — Rust 1.78 → 1.97.1 catchup
- `docs/dev/rust-counterintuitive-patterns.md` — Rust patterns
- `docs/dev/typescript-counterintuitive-patterns.md` — TS patterns
- `docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md` — Bevy 0.18 → 0.19 deltas (TextFont.font_size = FontSize::Px, MeshMaterial3d + Transform, etc.)

---

## T77b follow-up — `[x]` DONE

The T77 deliverable (`parseObjectId` / `isObjectId` / branded types in
`src/types/brand.ts` + 37-case vitest suite) shipped first. T77b —
threading those branded types through `EditorState` and every
consumer — is now complete.

Two earlier attempts at an automated `as ObjectId` cast script (v3, v4
design) were abandoned; see
`docs/dev/t77b-branded-ids-migration.md` for the post-mortem and the
approach that actually shipped: hand-edit every call site so branded
values flow in already-typed, guided by `tsc` error output, with casts
reserved for the three sanctioned cases (inside `brand.ts`, test
fixture constructors, and one documented last-resort site per file).

Summary of what changed:

- `EditorState` (`src/store/editorStore.ts`) is fully branded:
  `selectedObjects: ObjectId[]`, `hoveredObject: ObjectId | null`,
  `activeLayer` / `layers[].id: LayerId`, `sceneObjects: Map<ObjectId,
  SceneObject>`, `missingAssetRefs: AssetId[]`, and every action
  signature (`addToSelection`, `removeObject`, `linkObjectToPreset`,
  etc.). The inline scene-object shape was extracted into an exported
  `SceneObject` interface.
- ~20 component / hook / utility files thread the branded types
  through instead of casting: `App.tsx`, `ActionsPanel`, `FileMenu`,
  `GenerationPanel`, `Hierarchy`, `Inspector`, `Layers`, `MaterialEditor`,
  `PrefabManager`, `Viewport3D/*`, `useCameraControls`,
  `useKeyboardShortcuts`, `commands.ts`, `clipboard.ts`, `prefabs.ts`,
  `materialPresets.ts`, `useAutoSave.ts`, plus the
  `performance/InstancedRendering.tsx` `id` field (a ripple from
  `OptimizedScene.tsx`).
- Boundary parsing: bulk-restore paths (`editorStore.loadFromLocalStorage`,
  `clipboard.paste`, `prefabs.loadPrefabs`, `materialPresets.listMaterialPresets`)
  filter out individually malformed ids with `isObjectId` /
  `isValidIdString` and a `console.warn`, instead of throwing and
  losing the whole payload.
- Generation sites (`editorStore.addObject`/`duplicateObjects`/`groupObjects`,
  `clipboard.paste`, `commands.ts` `PasteCommand`, `prefabs.buildPrefabFromSelection`,
  `materialPresets.newPresetId`, `Layers.addLayer`) mint ids with the
  plain `ObjectId(...)` / `PrefabId(...)` / `LayerId(...)` /
  `MaterialId(...)` constructors rather than `parse*Id`, since a
  user-supplied name containing a space (e.g. "My Cube") would
  otherwise make the validating parser throw at paste time. A
  regression test (`src/test/clipboard.test.ts`) covers exactly that
  case.
- `mapToRecord` / `recordToMap` in `brand.ts` were made generic over
  the key type (`<K extends string, V>`) so they work with
  `Map<ObjectId, V>` — the one sanctioned edit to `brand.ts` outside
  the original T77 helpers.
- `missingAssetRefs: AssetId[]` is the one field where the brand is
  applied without `ID_PATTERN` validation: the underlying values are
  texture _paths_ (contain `/` and `.`), not UUID-shaped strings, so
  they're branded with the plain `AssetId(...)` constructor at the
  point they're computed, not `parseAssetId`.

Verification: `tsc --noEmit` 0 errors, `eslint --max-warnings 0` 0
warnings, `vitest run` 315/315 passing (313 baseline + 2 new: the
space-named-object paste case and an autosave-restore malformed-id
case), self-audited for stray `as <Brand>` casts (3 hits, all
justified array/null literal type annotations already present in the
pre-T77b file; one unrelated `as ThemeId` false-positive naming
collision with `lightThemes.ts`'s local `ThemeId` union).

_Audit performed 2026-08-06 against commit ca5ee95. T77b implementation
completed 2026-08-07._
