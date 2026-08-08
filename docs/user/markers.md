# Markers — runtime components shipped with a level

> Reference for the ten markers the editor can attach to a scene object.
> Each marker is a typed payload that crosses the export pipeline
> unchanged and lands as a Bevy `Component` in the generated Rust source.
> The runtime mirror lives in
> [`crates/bevy-morgan-integration`](../../crates/bevy-morgan-integration/README.md).

This document describes what actually ships. If the editor's behaviour
ever diverges from this doc, the doc is wrong — open an issue.

## At a glance

The editor carries ten marker kinds. Six are game-logic markers
shipped by T86 / T90 (door, collectible, spawn point, trigger volume,
nav-mesh hint, interactable). Four are runtime-effect markers
shipped by T91 (light, animation, audio, VFX). The runtime effects
are the focus of this document; the game-logic markers are listed
for completeness.

| Marker                              | Domain         | Source | Runtime system              |
| ----------------------------------- | -------------- | ------ | --------------------------- |
| [`door`](#door)                     | game logic     | T86    | `door_proximity_open`       |
| [`collectible`](#collectible)       | game logic     | T86    | `collectible_pickup`        |
| [`interactable`](#interactable)     | game logic     | T86    | consumer-provided           |
| [`spawn_point`](#spawn_point)       | game logic     | T86    | `spawn_point_observer`      |
| [`trigger_volume`](#trigger_volume) | game logic     | T86    | `trigger_volume_observer`   |
| [`nav_mesh_hint`](#nav_mesh_hint)   | game logic     | T86    | `nav_mesh_collector`        |
| [`light`](#light)                   | runtime effect | T91    | `light_observer`            |
| [`animation`](#animation)           | runtime effect | T91    | `animation_player_observer` |
| [`audio`](#audio)                   | runtime effect | T91    | `audio_observer`            |
| [`vfx`](#vfx)                       | runtime effect | T91    | `vfx_observer`              |

The four runtime-effect markers share the same wire format: an
**internally-tagged object** with `kind` as the discriminant and
**snake_case** variant names. Field names are also snake_case and
cross the IPC boundary verbatim. Examples throughout this document
use that exact format.

## Game-logic markers

### `door`

Interactive door. Locks / unlocks based on `key_id` and auto-closes
after `auto_close_after_secs` if `auto_close` is `true`.

**Editor**: This is a legacy field on `SceneObject` from before
the T91 marker refactor. The exporter emits a Bevy `Door` component
when the source object has `key_id` set or a non-default `auto_close`.

**Wire format**:

```jsonc
{
  "auto_close": true,
  "key_id": "key_red",
  "auto_close_after_secs": 3.0,
}
```

**Bevy component**:

```rust
Door { auto_close: true, key_id: Some("key_red".to_string()), auto_close_after_secs: 3.0 }
```

### `collectible`

Pickup that adds its `item_id` to the player's inventory on contact.

**Editor**: Set in the Inspector as a pair of `item_id` + `count`
fields (count defaults to 1).

**Wire format**:

```jsonc
{ "item_id": "gold_coin", "count": 25 }
```

**Bevy component**:

```rust
Collectible { item_id: "gold_coin".to_string(), count: 25 }
```

### `interactable`

Generic interaction marker. The runtime shows the `prompt` string
when the player is within range.

**Editor**: Set in the Inspector as a `prompt` string.

**Wire format**:

```jsonc
{ "prompt": "Press E to open the terminal" }
```

**Bevy component**:

```rust
Interactable { prompt: "Press E to open the terminal".to_string() }
```

### `spawn_point`

Where the player / enemies / items spawn at level load. Three variants:

- `player_start` — the level's player spawn position.
- `enemy_spawn` — an AI spawn tagged with a `team`.
- `item_spawn` — an item spawn tagged with an `item_id`.

**Editor**: Inspector spawn-point picker. Wire format is internally
tagged on `kind`.

**Wire format**:

```jsonc
{ "kind": "player_start" }
{ "kind": "enemy_spawn", "team": "goblin" }
{ "kind": "item_spawn", "item_id": "key_blue" }
```

**Bevy component**:

```rust
SpawnPoint::PlayerStart
SpawnPoint::EnemySpawn { team: "goblin".to_string() }
SpawnPoint::ItemSpawn { item_id: "key_blue".to_string() }
```

### `trigger_volume`

A volume that fires a named event when an entity enters it. Three
variants — `box`, `sphere`, `polygon`.

**Editor**: Inspector trigger-volume picker. The `event` field is the
event name the consumer's collision system listens for.

**Wire format**:

```jsonc
{ "kind": "box",    "half_extents": [1.0, 1.0, 1.0], "event": "level.complete" }
{ "kind": "sphere", "radius": 2.5, "event": "checkpoint" }
{ "kind": "polygon", "points": [[0,0,0],[1,0,0],[0,0,1]], "event": "arena.start" }
```

**Bevy component**:

```rust
TriggerVolume::Box { half_extents: [1.0, 1.0, 1.0], event: "level.complete".to_string() }
TriggerVolume::Sphere { radius: 2.5, event: "checkpoint".to_string() }
TriggerVolume::Polygon { points: vec![[0,0,0],[1,0,0],[0,0,1]], event: "arena.start".to_string() }
```

### `nav_mesh_hint`

Marker for walkable surfaces. The runtime navigation plugin reads
`NavMeshHint`-tagged colliders when generating the navmesh; `cost`
is a per-surface multiplier (default 1.0). A value of 2.0 makes the
AI prefer an alternate route even if the distance is shorter.

**Editor**: Inspector nav-mesh hint field. `cost` defaults to 1.0.

**Wire format**:

```jsonc
{ "cost": 1.0 }
```

**Bevy component**:

```rust
NavMeshHint { cost: 1.0 }
```

## Runtime-effect markers

### `light`

A light source. Three variants mirror Bevy's built-in light
components:

- `point` — `PointLight` with `color`, `intensity`, `range`,
  `shadows`.
- `spot` — `SpotLight` with `inner_angle`, `outer_angle` (radians),
  plus the point fields.
- `directional` — `DirectionalLight` with no falloff.

**Editor**: Inspector → Light section. Click **Add Light** to seed a
default point light; switch the variant in the dropdown to switch
light type. Switching variant carries over the shared fields
(`color`, `intensity`, `shadows`) and re-seeds the variant-specific
fields from defaults so the new variant is always schema-valid.

**Wire format**:

```jsonc
{ "kind": "point",       "color": [1, 1, 1], "intensity": 1000, "range": 10, "shadows": true }
{ "kind": "spot",        "color": [1, 1, 1], "intensity": 1000, "range": 10,
  "inner_angle": 0.3, "outer_angle": 0.6, "shadows": true }
{ "kind": "directional", "color": [1, 1, 1], "intensity": 1.0, "shadows": false }
```

**Bevy component**:

```rust
Light::Point { color: [1.0, 1.0, 1.0], intensity: 1000.0, range: 10.0, shadows: true }
Light::Spot { color: [1.0, 1.0, 1.0], intensity: 1000.0, range: 10.0,
              inner_angle: 0.3, outer_angle: 0.6, shadows: true }
Light::Directional { color: [1.0, 1.0, 1.0], intensity: 1.0, shadows: false }
```

### `animation`

An animation clip. Two variants:

- `play` — runs the clip in a loop at the given `speed`. `repeat` is
  the explicit loop flag (`true` here is the same as the default
  `play` semantic).
- `play_once` — plays the clip a single time.

**Editor**: Inspector → Animation section. Click **Add Animation** to
seed a default `play` marker.

**Wire format**:

```jsonc
{ "kind": "play",      "clip": "banner.anim", "repeat": true, "speed": 1.0 }
{ "kind": "play_once", "clip": "banner.anim" }
```

**Bevy component**:

```rust
Animation::Play { clip: "banner.anim".to_string(), repeat: true, speed: 1.0 }
Animation::PlayOnce { clip: "banner.anim".to_string() }
```

### `audio`

An audio source. Two variants:

- `ambient` — a looping sound (e.g. fountain, fire, ambient drone).
- `one_shot` — plays once and the entity is consumed on completion.

**Editor**: Inspector → Audio section. Click **Add Audio** to seed a
default `ambient` marker.

**Wire format**:

```jsonc
{ "kind": "ambient",  "path": "fountain.ogg", "volume": 0.8, "looping": true }
{ "kind": "one_shot", "path": "clang.ogg",    "volume": 1.0 }
```

**Bevy component**:

```rust
Audio::Ambient { path: "fountain.ogg".to_string(), volume: 0.8, looping: true }
Audio::OneShot  { path: "clang.ogg".to_string(), volume: 1.0 }
```

### `vfx`

A visual effect. Two variants:

- `particle` — references a particle-effect asset at `path` with
  `count` particles.
- `billboard` — a 2D `texture` rendered facing the camera at the
  given `size` (width, height).

**Editor**: Inspector → VFX section. Click **Add VFX** to seed a
default `particle` marker.

**Wire format**:

```jsonc
{ "kind": "particle",  "path": "campfire.vfx", "count": 100 }
{ "kind": "billboard", "texture": "smoke.png", "size": [1.0, 1.0] }
```

**Bevy component**:

```rust
Vfx::Particle { path: "campfire.vfx".to_string(), count: 100 }
Vfx::Billboard { texture: "smoke.png".to_string(), size: [1.0, 1.0] }
```

## Worked example — a torch-lit courtyard

The original T91 spec asked for a level with a torch (point light),
a fountain loop (ambient audio), an animated banner (animation),
and a campfire (particle VFX). Here is the full editor → Bevy path.

### 1. Editor setup

In the editor, place four objects in the scene:

1. **Torch** — a small cube near the courtyard wall. Inspector →
   Light → **Add Light** (defaults to `point`). Leave the defaults
   (white, intensity 1000, range 10, shadows on).
2. **Fountain** — a larger cube in the courtyard centre. Inspector →
   Audio → **Add Audio**. Set `path` to `fountain.ogg`, `volume` to
   `0.8`, and leave `looping` on.
3. **Banner** — a thin cube hanging from the wall. Inspector →
   Animation → **Add Animation**. Set `clip` to `banner.anim`.
   Leave `repeat` on and `speed` at 1.0.
4. **Campfire** — a cube on the ground. Inspector → VFX → **Add VFX**.
   Set `path` to `campfire.vfx` and `count` to `100`.

Each of the four objects now carries exactly one marker field.

### 2. Export

`File → Export → Rust code` writes two files: `level_courtyard.rs`
and `level_courtyard.json`. The Rust source contains the entity
spawn code; the JSON is the wire payload `load_level` reads.

A single entity's payload in the JSON looks like:

```jsonc
{
  "id": "torch_1",
  "name": "Torch",
  "transform": { "position": [2.0, 1.0, 0.0], "rotation": [0, 0, 0, 1], "scale": [0.2, 0.5, 0.2] },
  "material": "material_cube",
  "mesh": "cube",
  "layer": "default",
  "tags": ["exported"],
  "metadata": { "created_at": "2026-08-08T00:00:00Z", "mesh_type": "cube" },
  "light": { "kind": "point", "color": [1, 1, 1], "intensity": 1000, "range": 10, "shadows": true },
}
```

Note: `audio`, `animation`, and `vfx` fields are **absent** from this
torch entity — only the present marker is in the payload. This is the
`#[serde(default, skip_serializing_if = "Option::is_none")]` contract
in action.

### 3. Bevy runtime

The generated source emits four entities, each with one
`bevy_morgan_integration` component:

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

commands.spawn((
    Name::new("Banner"),
    Transform::from_xyz(-2.0, 2.0, 0.0),
    Animation::Play { clip: "banner.anim".to_string(), repeat: true, speed: 1.0 },
));

commands.spawn((
    Name::new("Campfire"),
    Transform::from_xyz(0.0, 0.0, 1.0),
    Vfx::Particle { path: "campfire.vfx".to_string(), count: 100 },
));
```

The four `observer` systems registered by `MorganLevelSystems`
respond to each marker on `OnAdd` and wire the Bevy-side behaviour
(insert a `PointLight`, start an `AnimationPlayer`, attach an
`AudioSource`, spawn the particle / billboard). See the
[`bevy-morgan-integration` README](../../crates/bevy-morgan-integration/README.md)
for the system names.

## Markers and the wire contract

A few rules to keep in mind when reading the format:

- **snake_case variant names** — `play_once`, not `playOnce`. The
  zod schemas at the TS boundary reject camelCase variants.
- **snake_case field names** — `inner_angle`, `outer_angle`. Same
  reason.
- **Internally tagged on `kind`** — every marker is an object with
  a `kind` field, not a stringly-typed enum.
- **Absent when unset** — an object with no `light` has no `light`
  key in its wire payload. Editors that emit `"light": null` will
  be rejected by the Rust `skip_serializing_if` rule.
- **shared fields carry over on variant switch** — switching a
  `Light` from `point` to `spot` keeps the source's `color`,
  `intensity`, `range`, and `shadows`. The Inspector's variant
  switcher does this for you; if you're building the payload by
  hand, copy the shared fields across and re-seed the new variant
  from `defaultLightMarker(newKind)`.

## Verifying a marker's wire shape

The zod schemas at `src/types/schemas/index.ts` (and the Rust
serde tests in `crates/bevy-morgan-integration/src/markers.rs`,
`components.rs`) pin the wire format. If you find a discrepancy
between this document and the test suites, the code is the source
of truth — update the doc.
