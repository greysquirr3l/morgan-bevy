# Hello Bevy — end-to-end tutorial

> Build a Bevy 0.19 project, generate a level in Morgan-Bevy,
> export it, and load it at runtime with collision + a
> player spawn. Plan: thirty minutes from scratch.

## What you'll have at the end

A Bevy 0.19 binary that:

1. Loads a level exported from Morgan-Bevy.
2. Spawns the player at the first `PlayerStart` `SpawnPoint`.
3. Adds Rapier 3D collision to every collider.
4. Logs to stdout when a `TriggerVolume` fires.

## 1. Create the Bevy project

```bash
cargo new --bin hello_morgan
cd hello_morgan
cargo add bevy@0.19 \
    bevy-morgan-integration \
    avian3d@0.7
```

`bevy-morgan-integration` is the companion crate; version-pinned
to your editor's release. `avian3d` is the collision library
that the companion crate expects.

## 2. Add `MorganLevelPlugin` + the systems plugin

In `src/main.rs`:

```rust
use bevy::prelude::*;
use bevy_morgan_integration::{MorganLevelPlugin, MorganLevelSystems};

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_plugins(MorganLevelPlugin)
        .add_plugins(MorganLevelSystems)
        .add_systems(Startup, spawn_level)
        .add_systems(Update, listen_for_triggers)
        .run();
}
```

`MorganLevelPlugin` registers every marker component + the
`OnAdd` observer systems. `MorganLevelSystems` (T90) wires the
per-marker runtime behaviour (point lights, animations, audio
sources, particles, etc.).

## 3. Load the exported level

```rust
use bevy::prelude::*;
use bevy_morgan_integration::load_level;
use std::fs;

fn spawn_level(mut commands: Commands, asset_server: Res<AssetServer>) {
    let json = fs::read_to_string("levels/hello.level.json")
        .expect("level file present at hello.level.json");
    let level: bevy_morgan_integration::ExportedLevel =
        serde_json::from_str(&json).expect("valid level json");
    load_level(&mut commands, &asset_server, &level);
}
```

The exported JSON file lives at `levels/hello.level.json` after
step 4. The `load_level` helper spawns every entity from the
file and registers its marker observers.

## 4. Generate the level in Morgan-Bevy

1. Open the editor, **File → Open Template → SciFi**. The SciFi
   example ships a `tower_light` object with a T91 point-light
   marker (see [markers.md](markers.md#light)). This is the level
   we'll load in Bevy.
2. Tweak the platforms to your liking.
3. **File → Save Project As → hello.morgan**.
4. **File → Export Scene…**, choose **Rust source**, point at
   `hello_morgan/src/levels/`. The editor writes:
   - `levels/level_hello.rs` — the Bevy source file.
   - `levels/hello.level.json` — the portable JSON we'll load.
5. Copy the `use bevy_morgan_integration::...` imports from
   `level_hello.rs` into `main.rs` (or `mod level_hello;` it).

## 5. Add collision + the player spawn

The exported JSON includes every marker field per object. The
companion crate doesn't add collision automatically — that's
your project's call. Here's a minimal Rapier setup:

```rust
use avian3d::prelude::*;
use bevy_morgan_integration::{CollisionShape, SpawnPoint};

fn add_collision_and_player(
    mut commands: Commands,
    query: Query<(Entity, &Transform, &CollisionShape), Added<Transform>>,
) {
    for (entity, _transform, shape) in &query {
        match shape {
            CollisionShape::Box { half_extents } => {
                commands.entity(entity).insert(Collider::cuboid(
                    half_extents[0] * 2.0,
                    half_extents[1] * 2.0,
                    half_extents[2] * 2.0,
                ));
            }
            CollisionShape::Sphere { radius } => {
                commands.entity(entity).insert(Collider::ball(*radius));
            }
            CollisionShape::Capsule { radius, height } => {
                commands.entity(entity).insert(Collider::capsule(*height, *radius));
            }
        }
    }
}

fn spawn_player(mut commands: Commands, query: Query<&Transform, With<SpawnPoint>>) {
    for transform in &query {
        commands.spawn((
            Name::new("Player"),
            Transform::from_translation(transform.translation),
            // … your player bundle here
        ));
        break; // only the first PlayerStart
    }
}
```

Add `add_collision_and_player` to your `add_systems(Update, …)`
list, and `spawn_player` to `add_systems(Startup, …)`.

## 6. Wire the trigger volume

```rust
use bevy_morgan_integration::{TriggerActivated, TriggerVolume};

fn listen_for_triggers(mut events: EventReader<TriggerActivated>) {
    for event in events.read() {
        info!("trigger fired: {}", event.event);
    }
}
```

`TriggerActivated` is fired by the companion crate's
`trigger_volume_observer` system (T90) every time an entity
crosses a volume boundary. Subscribe with a normal Bevy
`EventReader` — no plugin wiring needed.

## 7. Run it

```bash
cargo run
```

You should see:

1. The SciFi deck + four platforms + the central console render
   in the viewport.
2. The player spawn at the first `SpawnPoint::PlayerStart`.
3. The tower light illuminating the deck (the T91 point-light
   marker emits a `PointLight` via the observer system).
4. Console logs every time an entity crosses a `TriggerVolume`.

## Where to go from here

- **More markers.** The SciFi example uses one marker; see
  [markers.md](markers.md) for the other nine.
- **Rapier character controller.** Add a third-party
  character-controller plugin and constrain the player to the
  walkable surfaces (every object with `walkable: true` becomes a
  Rapier collider via the example above).
- **AI waypoints.** Place `NavMeshHint` markers on the
  walkable surfaces; the navigation plugin reads them.
- **Export variations.** Re-export with `SystemsMode::Inline` to
  bake the per-marker systems into the generated file (no
  companion crate dep).

## Troubleshooting

- **"missing asset reference" warning at load.** The export
  recorded `assetRefs` that aren't in your Bevy project's
  assets/. Copy the textures / audio / models into the Bevy
  project's `assets/` directory and reload.
- **The light doesn't illuminate anything.** Verify the
  `tower_light` object carried its `light` marker through to the
  JSON. Open `levels/hello.level.json` and search for
  `"light":` — the marker rides as a top-level key on the
  object. Missing? Re-export the level with the marker editor
  panel populated.
- **Player spawns at the origin instead of the `SpawnPoint`.**
  `spawn_player` reads `Query<&Transform, With<SpawnPoint>>`.
  The companion crate inserts `SpawnPoint` on every object with
  the marker; if your `load_level` returned before the observer
  fired, you may be querying too early. Move `spawn_player` into
  `Update` and gate it on `!player_exists`.
