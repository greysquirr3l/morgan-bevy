# Export Format Reference

> The exact wire format of every output format the editor can
> produce. Every claim in this document was verified against the
> generation code in `src-tauri/src/export/` and the schemas in
> `crates/bevy-morgan-integration/`.

## Rust source

The primary export path. Generated code compiles against a vanilla
Bevy project that depends on `bevy-morgan-integration`. The
companion crate provides every marker component + observer
system.

The exporter emits a single `pub fn spawn_level_<name>(commands:
&mut Commands, asset_server: &Res<AssetServer>)` that spawns the
scene. Marker components (`Door`, `Collectible`, `Light`,
`Animation`, `Audio`, `Vfx`, `SpawnPoint`, `TriggerVolume`,
`NavMeshHint`) are added to each entity alongside the standard
`Transform` / `Visibility` / `Mesh3d` set.

```rust
use bevy::prelude::*;
use bevy_morgan_integration::{Light, Audio, Animation, Vfx};

commands.spawn((
    Name::new("Torch"),
    Transform::from_xyz(2.0, 1.0, 0.0),
    Light::Point { color: [1.0, 1.0, 1.0], intensity: 1000.0, range: 10.0, shadows: true },
));

commands.spawn((
    Name::new("Fountain"),
    Transform::from_xyz(0.0, 0.0, 0.0),
    Audio::Ambient { path: "fountain.ogg".to_string(), volume: 0.8, looping: true },
));
```

The four runtime-effect markers (`Light`, `Animation`, `Audio`,
`Vfx`) are wired by `MorganLevelSystems`, which registers the
observer systems on `OnAdd` so the moment the marker is
inserted, the corresponding Bevy component (`PointLight`,
`AnimationPlayer`, `AudioSource`, `Particle` / `Billboard`) is
attached.

The choice between `SystemsMode::CompanionReference` (default;
bug fixes flow through `cargo update`) and `SystemsMode::Inline`
(hermetic; the generated file has no runtime dep on the
companion crate) is recorded in the generated header as
`// Systems mode: CompanionReference` and re-selected on
re-export.

## Project data

The on-disk `.morgan` project file. Editor → editor portable.

```ts
{
  schemaVersion: 1,
  scene: {
    objects: Array<[ObjectId, SceneObject]>,   // see below
    layers: Layer[],
    activeLayer: LayerId,
    settings: { gridSize: number; snapToGrid: boolean }
  },
  metadata?: {
    name?: string,
    description?: string,
    assetRefs?: string[],                    // T20 — collected on save
    importSettings?: ImportSettings          // T35 — see below
  }
}
```

`SceneObject`:

```ts
interface SceneObject {
  id: ObjectId
  name: string
  type: 'mesh' | 'light' | 'group'
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  visible: boolean
  locked: boolean
  layerId: LayerId
  parentId?: ObjectId
  children: ObjectId[]
  meshType?: 'cube' | 'sphere' | 'pyramid'
  material?: {
    baseColor: string
    metallic: number
    roughness: number
    emissive?: string
    emissiveIntensity?: number
    texture?: string
  }
  materialPresetId?: MaterialId // T18
  materialOverrides?: MaterialOverrides // T18
  prefabInstanceId?: PrefabId // T19
  collision?: boolean
  walkable?: boolean
  tags?: string[]
  metadata?: Record<string, unknown> // tile metadata, etc.
  light?: LightMarker // T91 — absent key when unset
  animation?: AnimationMarker // T91
  audio?: AudioMarker // T91
  vfx?: VfxMarker // T91
}
```

**Critical wire-format rule:** the four marker fields are
**absent** when unset (not `"light": null`). Rust uses
`#[serde(default, skip_serializing_if = "Option::is_none")]` —
emitting `"light": null` would break the deserialise. See the
[markers reference](markers.md) for the wire shape of each
marker variant.

`ImportSettings`:

```ts
interface ImportSettings {
  textureMaxSize: number // 0 = no resize
  textureQuality: number // 0..100, default 80
  skipInvalid: boolean // default false (fail-fast)
}
```

## JSON

A portable snapshot of the editor scene. Engine-agnostic; loads
in any tool that understands JSON.

```json
{
  "id": "level_<timestamp>",
  "name": "My Level",
  "objects": [
    {
      "id": "torch_1",
      "name": "Torch",
      "transform": {
        "position": [2.0, 1.0, 0.0],
        "rotation": [0, 0, 0, 1],
        "scale": [0.2, 0.5, 0.2]
      },
      "material": "material_cube",
      "mesh": "cube",
      "layer": "default",
      "tags": ["exported"],
      "metadata": { "created_at": "2026-08-08T00:00:00Z", "mesh_type": "cube" },
      "light": {
        "kind": "point",
        "color": [1, 1, 1],
        "intensity": 1000,
        "range": 10,
        "shadows": true
      }
    }
  ],
  "layers": ["default"],
  "generation_seed": null,
  "generation_params": null,
  "bounds": { "min": [-50, -50, -50], "max": [50, 50, 50] }
}
```

The four marker fields ride along as top-level keys on each
object (`light`, `animation`, `audio`, `vfx`) — same absent-when-
unset rule.

## RON

Like JSON, Rust-native. Round-trips through `serde` without a
serialisation step.

```ron
LevelData(
    id: "level_<timestamp>",
    name: "My Level",
    objects: [
        ObjectData(
            id: "torch_1",
            name: "Torch",
            transform: Transform(position: (2.0, 1.0, 0.0), rotation: (0, 0, 0, 1), scale: (0.2, 0.5, 0.2)),
            material: "material_cube",
            mesh: Cube,
            layer: "default",
            tags: ["exported"],
            metadata: { "mesh_type": "cube" },
        ),
    ],
    layers: ["default"],
    bounds: (min: (-50, -50, -50), max: (50, 50, 50)),
)
```

## GLTF

Standard 3D interchange. Loads in any 3D tool (Blender, three.js,
etc.). Morgan-Bevy emits GLTF via `gltf` crate with the editor's
mesh + transform shape. Collision, lighting, and runtime markers
are NOT included — those are the per-engine extensions. Use
the Rust source export for the full runtime behaviour.

The exporter preserves the editor's coordinate convention
(right-handed Y-up, metres). Blender imports with Y-up by
default; a "Flip Z" import option is not needed.

## FBX

Legacy interchange. Use only if a downstream tool requires FBX.
The editor emits binary FBX 7.x via a hand-written encoder
(`src-tauri/src/export/binary_fbx.rs`) — the format is
length-prefixed records with a magic header. Same caveats as
GLTF: collision / lighting / markers are not preserved.

## Navigation mesh (T56)

Generated on demand via the `generate_navmesh` Tauri command from
the level's walkable surfaces (`SceneObject.walkable === true`) and
obstacles (`SceneObject.collision === true`; tagged `"wall"` →
`ObstacleKind::Wall`, everything else → `ObstacleKind::FreeStanding`).
Not produced by BSP/WFC generation itself — regenerate from the
viewport toggle (`Navmesh` / `Generate Navmesh` buttons) after
placing walkable/collision objects.

Algorithm: 2D rectangle partitioning, not voxel-based recast-style
decomposition — see the module doc comment in
`src-tauri/src/spatial/navmesh.rs` for the full rationale and the
documented "Deferred scope" limitations (disjoint floor islands,
multi-gap walls, off-mesh connections). The output shape is plain
vertex/triangle/edge data with no dependency on a specific navmesh
crate's internal types, so it's consumable by Rapier3D
(`vertices` + `triangle_indices`) or `bevy_navigation`
(`polygons` + `connections`) alike.

When present, `LevelData.navmesh` rides along in every export
format:

```json
"navmesh": {
  "vertices": [[0.0, 0.0, 0.0], [10.0, 0.0, 0.0], [10.0, 0.0, 10.0], [0.0, 0.0, 10.0]],
  "polygons": [
    { "id": 0, "vertex_indices": [0, 1, 2, 3], "triangle_indices": [0, 1, 2, 0, 2, 3] }
  ],
  "obstacles": [],
  "connections": [
    { "polygon_a": 0, "polygon_b": 1, "portal": [[8.0, 0.0, 5.0], [10.0, 0.0, 5.0]] }
  ],
  "off_mesh_connections": []
}
```

RON carries the same shape under the `navmesh` field of the
Bevy-facing export. The Rust source exporter embeds it as a
`pub const NAVMESH_JSON: &str = "...";` string constant (JSON-encoded)
rather than generated Rust literals — deserialize with
`serde_json::from_str` into a type matching the shape above.

`off_mesh_connections` (jumps, ladders, teleports) is always empty
in v1 — the type exists and is exported for forward compatibility
with T57 (A* pathing over `NavMesh.polygons`), but there is no
authoring input for jump/ladder markers yet.

Absent (`None`) when no navmesh has been generated — same
`skip_serializing_if = "Option::is_none"` rule as the other optional
level-wide fields.

## Round-tripping

Every format round-trips: export then re-import reproduces the
editor scene with no observable drift on a given seed. The
generation layer is deterministic (`Instant::now()` is never
called in domain logic), so two exports of the same level
produce byte-identical output.
