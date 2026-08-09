# Features Reference

> One page per major feature. Pick the section that matches what
> you're trying to do.

## Scene editing

| Feature                                             | Where it lives                        | Docs                                                             |
| --------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| Object placement (cube / sphere / pyramid)          | Inspector → Add                       | [getting-started.md](getting-started.md#place-your-first-object) |
| Translate / rotate / scale gizmos                   | W / E / R                             | [getting-started.md](getting-started.md#place-your-first-object) |
| Snap-to-axis / snap-to-plane                        | X / Y / Z + Shift                     | [getting-started.md](getting-started.md#place-your-first-object) |
| Layers (visibility / lock / colour)                 | Layers panel                          | —                                                                |
| Selection (click / Shift+Click / Ctrl+A)            | Viewport                              | [getting-started.md](getting-started.md#place-your-first-object) |
| Duplicate / copy / paste / delete / group / ungroup | Ctrl+D / C / V / Delete / G / Shift+G | [getting-started.md](getting-started.md#place-your-first-object) |
| Undo / redo                                         | Ctrl+Z / Ctrl+Y                       | [getting-started.md](getting-started.md#place-your-first-object) |
| Material paint tool (brush + UV editor)             | P                                     | [Material paint tool](#material-paint-tool) below                |

## Procedural generation

| Feature                 | Where                  | Docs                              |
| ----------------------- | ---------------------- | --------------------------------- |
| BSP corridors + rooms   | **Generate → BSP**     | —                                 |
| WFC themed tile layouts | **Generate → WFC**     | —                                 |
| Seeded determinism      | Same seed → same level | `src-tauri/src/generation/`       |
| Auto-light placement    | Post-generation        | `src/utils/autoLightPlacement.ts` |

## Asset library

| Feature                                         | Where                 | Docs                                                                |
| ----------------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| Asset scan + SQLite database                    | Background, on launch | `src-tauri/src/assets/scanner.rs`                                   |
| Tags + smart folders                            | Asset context menu    | —                                                                   |
| Thumbnail generation                            | Background            | `src-tauri/src/assets/thumbnail/`                                   |
| Broken Links report                             | Assets panel banner   | [Broken Links code](../components/AssetsPanel/BrokenLinksPanel.tsx) |
| Batch import (texture compression + validation) | Project settings      | `src-tauri/src/assets/import.rs`                                    |

## Material paint tool

Press **P** to toggle the paint tool. A settings bar appears at the
top of the viewport:

| Control          | What it does                                                                 |
| ----------------- | ----------------------------------------------------------------------------- |
| Radius slider     | Brush size, in world units.                                                   |
| Falloff (linear / smooth / flat) | How strongly the brush affects objects near the edge of its radius — `flat` paints everything inside the radius equally; `linear`/`smooth` taper off, so `smooth` can exclude an edge object that `flat` would still catch. |
| Target material    | Which preset (from [Material presets](#customising)) the brush applies.       |
| UV Editor          | Opens a pan/zoom editor for the selected object's UV offset + scale.          |

Click-and-drag over the scene to paint: a raycast finds the surface
under the cursor, and every unlocked mesh object within the brush
radius of the hit point is linked to the target material. Locked
objects (Layers/Hierarchy lock state) are never painted. A brush-
shaped circle indicator follows the cursor on the surface. Each
click-drag-release stroke is a single undo entry (Ctrl+Z), regardless
of how many objects it touched.

The UV editor doesn't re-unwrap a mesh — it applies a single
offset+scale transform on top of the mesh's existing UVs. Drag inside
the editor to pan the offset; scroll to scale. Reset restores the
identity transform (the mesh's authored UVs, unmodified).

Source: `src/utils/paintTool.ts` (brush/falloff math),
`src/utils/uvTransform.ts` (UV pan/zoom math),
`src/hooks/usePaintTool.ts` (raycasting + stroke handling),
`src/components/PaintTool/` (UI).

## Prefab system

| Feature                                 | Where                   | Docs                   |
| --------------------------------------- | ----------------------- | ---------------------- |
| Build a prefab from a selection         | PrefabManager → Save    | `src/utils/prefabs.ts` |
| Starter library (door, window, desk, …) | PrefabManager           | `src/data/prefabs/`    |
| Instantiate a prefab into the scene     | Drag from PrefabManager | —                      |
| Break a prefab link                     | PrefabManager → Unlink  | `applyBreakPrefab`     |

## Examples

| Project | Theme   | What it demonstrates                  | Source                                   |
| ------- | ------- | ------------------------------------- | ---------------------------------------- |
| Office  | Office  | Prefab placement + material variation | `src/data/examples/office.example.json`  |
| Dungeon | Dungeon | BSP-style grid layout                 | `src/data/examples/dungeon.example.json` |
| Castle  | Castle  | Multi-floor / scale variation         | `src/data/examples/castle.example.json`  |
| SciFi   | SciFi   | T91 runtime-effect markers            | `src/data/examples/scifi.example.json`   |

Open one from **File → Open Template**.

## Markers (T91)

The editor can attach ten runtime-effect markers to a scene
object. The runtime-side companion crate ships every marker
component and observer system.

| Marker           | What it becomes at runtime                      |
| ---------------- | ----------------------------------------------- |
| `light`          | `PointLight` / `SpotLight` / `DirectionalLight` |
| `animation`      | `AnimationPlayer` + `AnimationClip`             |
| `audio`          | `AudioSource` + `PlaybackSettings`              |
| `vfx`            | `Particle` / `Billboard`                        |
| `door`           | `Door` component                                |
| `collectible`    | `Collectible` component                         |
| `interactable`   | `Interactable` component                        |
| `spawn_point`    | `SpawnPoint` enum (player / enemy / item)       |
| `trigger_volume` | `TriggerVolume` enum (box / sphere / polygon)   |
| `nav_mesh_hint`  | `NavMeshHint` cost marker                       |

Full reference including wire format and Bevy-side breakdown:
[markers.md](markers.md).

## Navigation mesh (T56)

Generate a navmesh from the scene's walkable objects (mark an
object `walkable` in the Inspector) and obstacles (`collision` +
optionally tagged `wall`). Uses a 2D rectangle-partitioning
algorithm: walls split the room they cross into two polygons, and
any gap in the wall becomes a doorway connection between them —
simpler than voxel-based recast decomposition, and deterministic.

Toggle the `Navmesh` button in the viewport to show/hide the
overlay (cyan wireframe = walkable polygons, amber = doorway
connections, red = obstacles); `Generate Navmesh` re-derives it from
the current scene. The generated mesh (vertices, polygons,
obstacles, connections) rides along in every export format — see
[export-formats.md](export-formats.md#navigation-mesh-t56).

## Export

| Format          | Toolchain                           | Where to start                              |
| --------------- | ----------------------------------- | ------------------------------------------- |
| **Rust source** | Your Bevy project (companion crate) | [Hello Bevy tutorial](hello-bevy.md)        |
| **JSON**        | Engine-agnostic snapshot            | [export-formats.md](export-formats.md#json) |
| **RON**         | Rust-friendly interchange           | [export-formats.md](export-formats.md#ron)  |
| **GLTF**        | Standard 3D interchange             | [export-formats.md](export-formats.md#gltf) |
| **FBX**         | Legacy interchange                  | [export-formats.md](export-formats.md#fbx)  |

The import pipeline validates every source file by magic byte,
optionally compresses textures (WebP), and preserves the
originals on disk. See `src-tauri/src/assets/import.rs`.

## Bevy integration

The companion crate
[`bevy-morgan-integration`](../../crates/bevy-morgan-integration/README.md)
ships:

- The marker components and observer systems.
- A `MorganLevelPlugin` that registers the components + systems.
- A `MorganLevelSystems` plugin that wires the per-marker systems
  (T90).
- A `load_level()` helper that consumes an exported JSON file.

Full walkthrough: [bevy-integration.md](bevy-integration.md) and
the [Hello Bevy tutorial](hello-bevy.md).

## Customising

| Setting               | Where                                | Notes                                                   |
| --------------------- | ------------------------------------ | ------------------------------------------------------- |
| Keyboard shortcuts    | localStorage `morgan-bevy-shortcuts` | `src/utils/shortcutStore.ts`                            |
| Project file settings | `metadata.importSettings`            | See [export-formats.md](export-formats.md#project-data) |
| Material presets      | `src/utils/materialPresets.ts`       | T18 — link / unlink in the Inspector                    |
