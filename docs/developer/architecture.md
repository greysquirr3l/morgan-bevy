# Architecture

> How Morgan-Bevy fits together: the Tauri shell, the React +
> Three.js frontend, the Rust backend, and the companion Bevy
> crate. Read this if you're adding a feature, debugging a
> round-trip, or trying to understand why something lives where
> it lives.

## Top-level layout

```text
morgan-bevy/
├── src/                         # Frontend (TypeScript / React / Three.js)
│   ├── components/              # React UI panels
│   ├── store/                   # Zustand store + map serialisation
│   ├── hooks/                   # Side-effectful hooks (shortcuts, etc.)
│   ├── types/                   # Shared TS types + zod schemas
│   ├── utils/                   # Pure helpers (clipboard, prefabs, ...)
│   ├── data/                    # Vite-bundled assets (examples, prefabs)
│   └── performance/             # Frustum culling / LOD / instancing
│
├── src-tauri/                   # Backend (Rust / Tauri commands)
│   ├── src/
│   │   ├── main.rs              # Tauri command surface + setup
│   │   ├── assets.rs            # Asset DB commands (scan / search / tags)
│   │   ├── export/              # Rust / JSON / RON / GLTF / FBX exporters
│   │   ├── generation/          # BSP + WFC + auto-light placement
│   │   ├── spatial.rs           # AABB / raycast queries
│   │   ├── crash_log.rs         # Crash reporting
│   │   └── assets/              # Asset DB + thumbnails + import
│   └── examples/                # Sample .morgan files
│
└── crates/
    └── bevy-morgan-integration/ # Companion crate (Bevy 0.19 plugins)
        └── src/
            ├── lib.rs           # MorganLevelPlugin + marker components
            ├── markers.rs        # T91 marker enums (Light / Animation / ...)
            ├── systems.rs       # Per-marker observer systems (T90)
            └── loader.rs        # JSON → Bevy spawner
```

The frontend, backend, and Bevy crate are independent crates
sharing only the wire formats documented in
[user/export-formats.md](../user/export-formats.md).

## Process boundary

Three processes run when the editor is open:

```text
┌─────────────────┐  Tauri IPC   ┌─────────────────┐
│  Frontend       │  ⇄           │  Backend        │
│  src/           │              │  src-tauri/src/  │
│  Vite / React / │              │  Rust / SQLite / │
│  Three.js       │              │  serde           │
└─────────────────┘              └─────────────────┘
                                       │
                                       │ (same wire format)
                                       ▼
                              ┌─────────────────┐
                              │  Bevy consumer   │
                              │  crates/bevy-    │
                              │  morgan-         │
                              │  integration/    │
                              └─────────────────┘
```

The frontend and backend never share memory or types. They
communicate exclusively through Tauri's `invoke()` mechanism,
with the **Rust side as the source of truth** for the response
shape and the **TypeScript side as the boundary validator**
(via zod schemas in `src/types/schemas/index.ts`).

A round-trip example: the user clicks **Generate → BSP** in
the React panel. The frontend calls
`invoke<LevelData>('generate_bsp_level', { params })`. The
backend's command (in `src-tauri/src/main.rs`) deserialises the
params, runs `BspGenerator`, and returns the serialised
`LevelData`. The frontend's `LevelDataSchema.parse(raw)`
revalidates the result before it lands in the Zustand store.

If the Rust and TS shapes drift (e.g. a new field is added
to the Rust struct but not the zod schema), the parse step
fails loudly at the boundary — never silently in a render
loop. This is why the zod schemas are mirrored from
`src-tauri/src/...` and tested at the IPC seam.

## Frontend ↔ Three.js ownership

Three.js objects are owned by **the Zustand store**, not by
React state. The project rule:

- Object selection / hover state lives in the Zustand store.
- Camera position / hover / drag state lives in `useRef`s.
- Render-loop values (camera matrix, hover indicator position)
  live in Three.js objects directly.

Why this split: putting per-frame state in Zustand would
cause re-renders at 60 FPS. Putting semantic state in refs
would mean React doesn't see updates. The rule of thumb:

- **Will the React tree need to re-render when this changes?**
  → Zustand store.
- **Will only a Three.js object care?** → `useRef` or
  three.js object property.

See `src/performance/PerformanceManager.tsx` for the
performance tests that prove the store stays out of the
render loop.

## Store ↔ Map serialisation

The `sceneObjects` state is a `Map<ObjectId, SceneObject>`,
not a `Record<string, SceneObject>`. Two reasons:

1. **Delete is O(1).** `delete obj[id]` on a `Record`
   deoptimises V8's hidden class. `map.delete(id)` is
   constant-time.
2. **Insertion order is preserved.** A `Record` doesn't
   guarantee iteration order in modern engines; a `Map` does.

Persistence round-trips through `serializeMap` /
`deserializeMap` in `src/store/mapSerialization.ts`, which
walks the entries in insertion order. The serialised shape
is `Array<[ObjectId, SceneObject]>` so the wire is a
deterministic order — older projects reload with the same
hierarchy they had at save time.

## Component ownership

The frontend has a strict anti-godfile rule (`.vscode/orchestrator.prompt.md`):
**a 500+ line component must be split before adding more
behaviour.** Concretely:

- `src/components/Inspector/Inspector.tsx` is split into one
  file per marker (T91c), plus a shared `MarkerFields.tsx` +
  pure helper `MarkerFieldUtils.ts`. The Inspector just imports
  and renders them.
- `src/components/FileMenu/FileMenu.tsx` is the only file
  owning the FileMenu render — no nested FileMenu files.
- `src/components/AssetsPanel/AssetsPanel.tsx` includes the
  BrokenLinksPanel as a single child, not by re-implementing
  its logic.

Each new panel / panel section should be a focused
self-contained module.

## Rust backend layout

Three sub-crates worth knowing about:

### `src-tauri/src/main.rs`

The Tauri command surface. Every `[tauri::command]` here is
the public API the frontend consumes. The file is large
(800+ lines) because every command is a thin wrapper around a
domain call; commands are grouped by domain (assets / export /
generation / project / file operations / spatial queries /
recent projects). Add new commands to the appropriate group.

### `src-tauri/src/assets/`

Self-contained asset DB module:

- `database.rs` — SQLite connection + schema + queries.
- `scanner.rs` — directory walker + asset registration.
- `assets.rs` — the `AssetDatabaseState` + Tauri commands.
- `assets/thumbnail.rs` — headless thumbnail pipeline (T33).
- `assets/import.rs` — batch import with validation + texture
  compression (T35).

The DB schema has a `column_exists` migration pattern; new
columns are added via `ALTER TABLE` in `apply_migrations`
inside `initialize_schema`. **Do not** break the schema with a
drop / recreate — the editor loads the DB on launch and a
schema change wipes the user's asset library.

### `src-tauri/src/export/`

The five output formats. Each exporter is a self-contained
struct with `fn export(level: &LevelData, out_path: &Path)`.
The `main.rs` command surface wires `export_level` to the
appropriate exporter by format string. Adding a new format
is "add a file in this dir + register it in main.rs" — see
[authoring-exports.md](authoring-exports.md).

### `crates/bevy-morgan-integration/`

A separate crate consumed by the Bevy project (not by the
editor). It ships:

- **Marker components** (`markers.rs`) — `Door`, `Collectible`,
  `Light`, `Animation`, `Audio`, `Vfx`, `SpawnPoint`,
  `TriggerVolume`, `NavMeshHint`, `Interactable`.
- **Per-marker systems** (`systems.rs`) — observer systems
  that wire each marker to its Bevy-side component
  (`PointLight`, `AnimationPlayer`, `AudioSource`, particle
  / billboard, etc.).
- **`MorganLevelPlugin`** — registers the components.
- **`MorganLevelSystems`** (T90) — registers the observer
  systems. Inserted via `plugin_init()` in the generated code.
- **`load_level`** (`loader.rs`) — consumes an exported JSON
  and spawns every entity.

The companion crate is **version-pinned** to the editor.
Bumping the editor version requires bumping the crate.

## Anti-corruption boundaries

The codebase has explicit anti-corruption points:

- **`src/types/schemas/index.ts`** — every Tauri invoke
  payload is zod-validated. **No `invoke('foo', ...)` is
  allowed** without a matching schema. The wiring audit
  (`src/test/wiringAudit.test.ts`) catches this.
- **`src/store/mapSerialization.ts`** — `serializeMap` /
  `deserializeMap` are the only paths between `Map` and
  JSON. Direct `JSON.stringify(sceneObjects)` is a
  known-bad pattern; the audit catches it.
- **`src/utils/prefabs.ts`** — `isPrefab` is the boundary
  type guard. The audit catches unvalidated prefab reads.
- **`src/utils/projectAssets.ts`** — `withAssetRefs` /
  `readAssetRefs` are the only paths between project
  metadata and the `assetRefs` array. The audit catches
  direct metadata access.

Add a new boundary by:

1. Define the schema in `src/types/schemas/index.ts`.
2. Wire it through `src/store/...` or `src/utils/...` as the
   single source of truth.
3. Cover with a regression test in `src/test/...`.
4. Run the wiring audit (`vitest run src/test/wiringAudit`)
   to confirm no consumer bypassed the boundary.

## Plugin boundaries

The Rust side uses an inverted port pattern: **the
`AssetDatabase` and the thumbnail queue own their
internals; callers consume them via narrow `Arc<Mutex<...>>`
handles**. Concrete examples:

- `ThumbnailQueue.spawn(db, thumbnails_dir, runtime_handle)` —
  the worker task holds its own Arc<Mutex<AssetDatabase>>.
  Callers `submit(ThumbnailJob)` and forget.
- `AssetScanner.scan_directory(&self, assets_dir, callback)`
  — sync, takes `&self`, returns `Result<ScanResult>`. The
  caller doesn't need to know about the SQLite lock.

The **port trait is consumer-owned**: if a feature needs a new
abstraction, define it in the _consumer's_ file (e.g. the
hook defines the action interface), not in the implementer.
This avoids the inverted-dependency trap of "utils" modules
that everyone imports from.

## Where new code goes (decision tree)

- **New React UI panel?** `src/components/<Name>/`. If the
  panel shares form scaffolding, put it in
  `src/components/<Name>/<Name>Fields.tsx` (T91c pattern).
- **New zod schema?** `src/types/schemas/index.ts`. Mirror the
  Rust serde shape exactly.
- **New Tauri command?** Add to `src-tauri/src/<domain>.rs`
  (assets / export / generation / spatial / etc.) and register
  in `tauri::generate_handler![...]` in `main.rs`. Add a
  matching zod schema and an invoke wrapper.
- **New generation algorithm?** `src-tauri/src/generation/` then
  register in `main.rs` then add to the **Generation panel**
  in the frontend. See
  [authoring-generators.md](authoring-generators.md).
- **New export format?** `src-tauri/src/export/` then
  register in `main.rs` then add to the **Export panel** UI.
  See [authoring-exports.md](authoring-exports.md).
- **New theme?** Drop the JSON in `src/data/themes/`
  (planned path); for v1, the theme system reads from a
  per-project directory.
- **New Bevy-side marker?** `crates/bevy-morgan-integration/src/markers.rs`
  then a mirror enum in `src-tauri/src/export/exporters.rs` then
  a `DEFAULT_SHORTCUTS`-style TS type in `src/types/markers.ts`
  then a panel file in `src/components/Inspector/`. See how
  `Light` did it end-to-end (T91).
