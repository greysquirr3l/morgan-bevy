# bevy-morgan-integration

> Companion crate to [Morgan-Bevy](https://github.com/greysquirr3l/morgan-bevy).
> Bevy 0.19 runtime helpers for levels exported by the editor.

This crate sits beside the editor and provides the **runtime half** of a
Morgan-Bevy export pipeline:

- The editor (`morgan-bevy`) emits a Bevy-compatible Rust source file
  per level (see `T39-rust-code-export.md`). The generated code uses
  `bevy::prelude::*` and `avian3d::prelude::Collider` directly.
- This crate (`bevy-morgan-integration`) provides the **marker
  components** the editor references — `SpawnPoint`, `TriggerVolume`,
  `Door`, `Interactable`, `Collectible`, `NavMeshHint` — plus a Bevy
  `Plugin` (`MorganLevelPlugin`) and a level loader that consumes the
  editor's JSON export.

The marker components live here (and not in the generated file) so
that several exported levels can be linked into one Bevy project
without `E0119` conflicts on the marker types.

## Versioning

`bevy-morgan-integration` is versioned **in lockstep with the editor**.
The editor's `Cargo.toml` and this crate's `Cargo.toml` carry the same
`version` field. A `bevy` major-version bump (0.19 → 0.20) requires
both crates to bump together. The migration procedure lives in
[`docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md`](https://github.com/greysquirr3l/morgan-bevy/blob/main/docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md).

## Install

Add the dependency next to your `bevy` and `avian3d` entries:

```toml
[dependencies]
bevy = "0.19"
avian3d = "0.7"
bevy-morgan-integration = "0.4"
```

Then load an exported level:

```rust
use bevy::prelude::*;
use bevy_morgan_integration::{MorganLevelPlugin, ExportedLevel, load_level};

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_plugins(MorganLevelPlugin)
        .add_systems(Startup, spawn_exported_level)
        .run();
}

fn spawn_exported_level(mut commands: Commands, asset_server: Res<AssetServer>) {
    let json = include_str!("../levels/office.json");
    let level: ExportedLevel = serde_json::from_str(json).expect("valid level");
    load_level(&mut commands, &asset_server, &level);
}
```

## What you get

| Item                                        | Type               | What it's for                                         |
| ------------------------------------------- | ------------------ | ----------------------------------------------------- |
| `SpawnPoint`                                | enum `Component`   | Where the player / enemies / items spawn              |
| `TriggerVolume`                             | enum `Component`   | Volumes that fire events when entered                 |
| `Door`                                      | struct `Component` | Doors with key / auto-close flags                     |
| `Interactable`                              | struct `Component` | Tagged for interaction prompts                        |
| `Collectible`                               | struct `Component` | Tagged for inventory pickup                           |
| `NavMeshHint`                               | struct `Component` | Marked walkable surfaces for the navigation plugin    |
| `Light`                                     | enum `Component`   | Light source — `point` / `spot` / `directional` (T91) |
| `Animation`                                 | enum `Component`   | Animation clip — `play` / `play_once` (T91)           |
| `Audio`                                     | enum `Component`   | Audio source — `ambient` / `one_shot` (T91)           |
| `Vfx`                                       | enum `Component`   | Visual effect — `particle` / `billboard` (T91)        |
| `MorganLevelPlugin`                         | `Plugin`           | Registers everything; no-op `build`                   |
| `MorganLevelSystems`                        | `Plugin`           | Registers the T90 + T91 observer systems              |
| `ExportedLevel`                             | struct             | Mirrors the editor's `LevelData` JSON shape           |
| `load_level(commands, asset_server, level)` | fn                 | Spawns every entity from an `ExportedLevel`           |
| `level_bounds(level)`                       | fn                 | Returns the editor-recorded bounding box              |

The four T91 runtime-effect markers (`Light`, `Animation`, `Audio`,
`Vfx`) each ship with an `OnAdd` observer system that wires the
Bevy-side behaviour:

| Marker      | Variants                         | Wire example                                                                             | System                      |
| ----------- | -------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| `Light`     | `point` / `spot` / `directional` | `{ "kind": "point", "color": [1,1,1], "intensity": 1000, "range": 10, "shadows": true }` | `light_observer`            |
| `Animation` | `play` / `play_once`             | `{ "kind": "play", "clip": "banner.anim", "repeat": true, "speed": 1.0 }`                | `animation_player_observer` |
| `Audio`     | `ambient` / `one_shot`           | `{ "kind": "ambient", "path": "fountain.ogg", "volume": 0.8, "looping": true }`          | `audio_observer`            |
| `Vfx`       | `particle` / `billboard`         | `{ "kind": "particle", "path": "campfire.vfx", "count": 100 }`                           | `vfx_observer`              |

Every marker is internally tagged on `kind` with snake_case variants
and snake_case field names. See [`docs/user/markers.md`](https://github.com/greysquirr3l/morgan-bevy/blob/main/docs/user/markers.md)
for the complete reference and a worked example.

See [`docs/user/bevy-integration.md`](https://github.com/greysquirr3l/morgan-bevy/blob/main/docs/user/bevy-integration.md)
for the end-to-end workflow.

## Compatibility

- Bevy **0.19** (latest at the time of writing)
- avian3d **0.7** for collision
- glam **0.32** for math (matches Bevy 0.19's `bevy_math` glam pin)
