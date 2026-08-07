# Bevy integration — end-to-end guide

> Companion to [`crates/bevy-morgan-integration/`](../../crates/bevy-morgan-integration/README.md).
> Walks through consuming a Morgan-Bevy export in a Bevy 0.19 project.

## 1. Export the level from the editor

In the Morgan-Bevy editor:

1. Build your level (manual placement, BSP, or WFC).
2. Open **Export → Rust code**.
3. Pick an output directory. The editor writes two files:
   - `level_<name>.rs` — Bevy source containing `pub fn
spawn_level_<name>(commands, asset_server)`.
   - `level_<name>.json` — machine-readable JSON used by the
     companion crate's [`load_level`](../../crates/bevy-morgan-integration/src/loader.rs).

The Rust source targets **Bevy 0.19** component shape: `Mesh3d`,
`MeshMaterial3d`, `Transform`, `Name`. Collision uses `avian3d`'s
`Collider`. See [`docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md`](../dev/BEVY_0.18_TO_0.19_MIGRATION.md)
for the migration details.

## 2. Add the companion crate to your Bevy project

```toml
# Cargo.toml
[dependencies]
bevy = "0.19"
avian3d = "0.7"
bevy-morgan-integration = "0.4"
```

The companion crate provides the **marker components** referenced by
the generated `level_<name>.rs` (`SpawnPoint`, `TriggerVolume`, `Door`,
`Interactable`, `Collectible`, `NavMeshHint`). Without it the
generated source won't compile.

## 3. Wire it up in your Bevy app

```rust
use bevy::prelude::*;
use bevy_morgan_integration::{ExportedLevel, MorganLevelPlugin, load_level};

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_plugins(MorganLevelPlugin)
        .add_systems(Startup, spawn_exported_level)
        .run();
}

fn spawn_exported_level(mut commands: Commands, asset_server: Res<AssetServer>) {
    let json = include_str!("../assets/levels/office.json");
    let level: ExportedLevel = serde_json::from_str(json).expect("valid level");
    load_level(&mut commands, &asset_server, &level);
}
```

The generated `spawn_level_office(...)` function and the companion's
`load_level(...)` are **two paths to the same result**. Use whichever
fits your build pipeline:

| Path                                                                                      | When to use                                                                                                               |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `spawn_level_office(commands, asset_server)`                                              | Compile-time integration — the level is part of your binary. Type-checked at build time.                                  |
| `bevy_morgan_integration::load_level(commands, asset_server, &ExportedLevel::from(json))` | Runtime integration — the level is loaded from JSON at startup. Lets you ship level data as an asset without recompiling. |

You can use both at once (e.g. one level baked in, another loaded as
data) without conflicts — the marker components live in the
companion crate, not in the generated source.

## 4. Hook the markers into your gameplay

```rust
use bevy::prelude::*;
use bevy_morgan_integration::{SpawnPoint, Door, Collectible, NavMeshHint, TriggerVolume};

/// Position the player at the first `PlayerStart` spawn point.
fn place_player(
    mut commands: Commands,
    player: Query<Entity, With<Player>>,
    spawns: Query<&Transform, With<SpawnPoint>>,
) {
    let player_entity = player.single();
    let Some(start) = spawns.iter().find(|t| matches_position(t, SpawnPoint::PlayerStart))
    else { return };
    commands.entity(player_entity).insert(*start);
}

/// Open doors when the player walks into them.
fn open_doors(
    mut commands: Commands,
    player: Query<&Transform, With<Player>>,
    doors: Query<(Entity, &Transform), With<Door>>,
) {
    for (entity, transform) in &doors {
        if let Ok(player_t) = player.get_single() {
            if player_t.translation.distance(transform.translation) < 2.0 {
                commands.entity(entity).insert(DoorOpen);
            }
        }
    }
}
```

## 5. Update path (Bevy major version bump)

When Bevy ships a new major (e.g. 0.19 → 0.20), do both:

1. Bump `bevy`, `bevy-morgan-integration`, and `avian3d` in your
   `Cargo.toml` to the matching versions.
2. Re-export the level from Morgan-Bevy — the editor's Rust code
   exporter is versioned alongside Bevy. See
   [`docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md`](../dev/BEVY_0.18_TO_0.19_MIGRATION.md)
   for the migration procedure (which we apply to both crates in
   lockstep).

The companion crate's `version` field matches the editor's
`version` field — if they ever drift, file an issue.

## 6. Verification checklist

- [ ] `cargo build -p bevy-morgan-integration` compiles.
- [ ] `cargo test -p bevy-morgan-integration` — 20 / 20 pass.
- [ ] `cargo clippy -p bevy-morgan-integration --all-targets -- -D warnings` — clean.
- [ ] The generated `level_<name>.rs` file compiles against your Bevy 0.19 project.
- [ ] Loading the level at runtime spawns one entity per object in the editor's hierarchy.
- [ ] Player spawns at the first `PlayerStart` spawn point.
- [ ] Door `interactable` markers fire when the player enters the volume.
- [ ] `NavMeshHint`-tagged surfaces are picked up by your navigation plugin.
