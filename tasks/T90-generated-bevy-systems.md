# T90 — Generated Bevy systems per marker type

> **Depends on**: T86-bevy-plugin-runtime.

## Goal

Extend the editor's Rust code exporter (`src-tauri/src/export/exporters.rs`)
so the generated file doesn't just spawn entities — it also generates the
**runtime gameplay systems** that respond to the marker components
shipped by `bevy-morgan-integration` (T86).

After T90, an exported Bevy 0.19 project runs without the user writing
any systems: doors open on proximity, collectibles get picked up,
spawn points place the player, trigger volumes fire events, navigation
hints are picked up by a built-in `NavMeshCollector` system.

## Project Context

- Project: `morgan-bevy` — Morgan-Bevy is a hybrid Rust/TypeScript
  desktop 3D level editor for Bevy game development.
- Editor (`morgan-bevy`) emits a Bevy-compatible Rust source file per
  level (see `T39-rust-code-export.md`).
- Companion crate (`bevy-morgan-integration`, workspace member) ships
  the marker components: `SpawnPoint`, `TriggerVolume`, `Door`,
  `Interactable`, `Collectible`, `NavMeshHint` (see T86).

After T86, the exported Rust source only calls
`commands.spawn((Transform, Mesh3d, MeshMaterial3d, Name, ...))`. The
consumer's `main.rs` is still ~20 lines of systems to make the level
playable. T90 closes that gap.

- Language: typescript (editor) + Rust (companion crate)
- Architecture: modular

### Architecture: Modular

- Each module is self-contained with its own models, handlers, and storage.
- Modules communicate through well-defined public interfaces.
- Shared code goes in a `common/` or `shared/` module.
- Prefer module-level encapsulation over cross-cutting layers.

## Strategy: Complete (End-to-End)

### Completion contract

- Implement the root fix for this task end-to-end (avoid temporary workaround paths).
- Add/update tests for behavior changes, including at least one edge/failure case.
- Update relevant documentation in this task before marking complete.

### Implementation

#### Editor side (`src-tauri/src/export/exporters.rs`)

The `generate_rust_code` function currently emits:

```rust
use bevy::prelude::*;
use bevy::asset::Handle;
use avian3d::prelude::Collider;

#[derive(Component)]
pub enum SpawnPoint { PlayerStart, EnemySpawn { team: String }, ItemSpawn { item_id: String } }
#[derive(Component)]
pub enum TriggerVolume { Box { half_extents: Vec3, event: String }, ... }

pub fn spawn_level_<name>(commands: &mut Commands, asset_server: &Res<AssetServer>) {
    commands.spawn((Transform::..., Mesh3d(...), ...));
    // ...
}

pub fn get_level_<name>_bounds() -> (Vec3, Vec3) { ... }
```

T90 extends the emitter so the generated file also includes:

```rust
use bevy_morgan_integration::{Door, Interactable, Collectible, NavMeshHint, ...};

pub struct MorganLevelSystems;
impl Plugin for MorganLevelSystems {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, (
            door_proximity_open,
            collectible_pickup,
            spawn_point_observer,
            trigger_volume_observer,
            nav_mesh_collector,
        ));
    }
}

// One system per marker component, all generated and self-contained.
fn door_proximity_open(...) { ... }
fn collectible_pickup(...) { ... }
// ...
```

Concrete additions:

1. **`use bevy_morgan_integration::{...};`** added at the top.
2. **`MorganLevelSystems` plugin struct + `impl Plugin`** generated alongside `spawn_level_<name>`.
3. **One system per marker** — emitted with deterministic names:
   - `door_proximity_open` — detects player proximity to a `Door` entity; toggles an `Open` component (also emitted). Only generated if the level contains at least one `Door` (tag-driven).
   - `collectible_pickup` — removes a `Collectible` on player proximity; emits a `PickupEvent` carrying the `item_id`.
   - `spawn_point_observer` — `OnAdd<SpawnPoint>` observer that logs the spawn point and (for `PlayerStart`) inserts a `PlayerStart` resource so the consumer's player system can read it.
   - `trigger_volume_observer` — `OnEnter<ColliderContact>` filter that fires the `event` string as a `TriggerActivated` event (also emitted).
   - `nav_mesh_collector` — collects every `NavMeshHint`-tagged collider into a `NavMeshSource` resource (also emitted).
4. **`Open`, `PickupEvent`, `TriggerActivated`, `NavMeshSource`** — companion types emitted in the same file. They live in the generated source (not the companion crate) because their shape is per-level and they don't need cross-level reuse.
5. **Tag-driven emission** — if a level has no `Door`-tagged objects, `door_proximity_open` is **not** generated. Keeps the file minimal.
6. **`pub fn plugin()` convenience** — `pub fn plugin() -> MorganLevelSystems { MorganLevelSystems }` so the consumer writes `add_plugins(plugin())`.

#### Companion crate side (`crates/bevy-morgan-integration/`)

Add a new module `crates/bevy-morgan-integration/src/systems.rs` that ships
**reference implementations** of the per-marker systems. The editor's
generator either:

- (Option A) **Emits inline copies** — the generated file is fully self-contained and doesn't depend on `bevy_morgan_integration::systems`. Good for hermetic builds.
- (Option B) **References the companion crate** — `use bevy_morgan_integration::systems::*;` and the generator emits a call site, not the function bodies. Good for shared evolution.

T90 ships **Option B**. Rationale: bug fixes in the systems apply across every consumer automatically. The trade-off (an extra dep on `bevy_morgan_integration`) is acceptable because T86 already requires it.

The `systems` module exports:

```rust
pub struct MorganLevelSystems;
impl Plugin for MorganLevelSystems { ... }

pub fn door_proximity_open(
    mut commands: Commands,
    player: Query<&Transform, With<Player>>,
    doors: Query<(Entity, &Transform, &Door)>,
) { ... }
pub fn collectible_pickup(...) { ... }
pub fn spawn_point_observer(trigger: On<Add, SpawnPoint>, ...) { ... }
pub fn trigger_volume_observer(
    mut events: EventWriter<TriggerActivated>,
    collisions: EventReader<CollisionStarted>,
    volumes: Query<(Entity, &TriggerVolume)>,
) { ... }
pub fn nav_mesh_collector(
    mut commands: Commands,
    hints: Query<&Transform, With<NavMeshHint>>,
) { ... }

// Companion events / resources emitted as events in the generated file's world.
#[derive(Event)]
pub struct TriggerActivated { pub entity: Entity, pub event: String }

#[derive(Resource)]
pub struct NavMeshSource { pub surfaces: Vec<(Entity, Transform)> }

#[derive(Component)]
pub struct Open;

#[derive(Event)]
pub struct PickupEvent { pub entity: Entity, pub item_id: String }
```

#### Editor export pipeline changes

In `src-tauri/src/export/exporters.rs`:

- `generate_rust_code` now scans `level_data.objects` once before emitting to collect the set of marker tags present. The header writer conditionally adds the `use bevy_morgan_integration::systems::...` block only for present markers.
- A new helper `marker_tags_present(level_data) -> MarkerSet` returns a bitset of which markers the level uses.
- The function signature becomes `generate_rust_code(level_data: &LevelData, marker_set: MarkerSet) -> Result<String>` — the caller (`export_multi_format`) computes `marker_set` once and passes it in.

### Tests

#### Rust (`crates/bevy-morgan-integration/`)

- **`door_proximity_opens_nearby_doors`** — spawn a `Player`, spawn a `Door` within 2 m, run one tick, assert the door has `Open`.
- **`door_proximity_does_nothing_far_away`** — spawn a `Door` 10 m away, run one tick, assert no `Open`.
- **`collectible_pickup_removes_on_proximity`** — spawn a `Collectible` near the player, run one tick, assert the entity is despawned and a `PickupEvent` was emitted.
- **`trigger_volume_fires_on_collision`** — fire a `CollisionStarted` event between a player collider and a `TriggerVolume`, assert a `TriggerActivated` event is emitted with the right `event` string.
- **`spawn_point_observer_inserts_resource`** — `commands.spawn((Transform, SpawnPoint::PlayerStart))` then run a tick, assert `Res<PlayerStart>` exists.
- **`nav_mesh_collector_collects_all_hints`** — spawn 3 `NavMeshHint` entities, run one tick, assert `Res<NavMeshSource>` has 3 entries.
- **`plugin_adds_all_systems`** — `App::new().add_plugins(MorganLevelSystems).add_systems(Update, no_op)` and `App::run` for one tick — verifies the plugin doesn't break app construction.

#### Editor side (`src-tauri/src/export/exporters.rs`)

Add to the existing test module:

- **`marker_set_includes_door_when_door_tag_present`** — level with one `tags: ["door"]` object yields `MarkerSet { door: true, .. }`.
- **`marker_set_excludes_door_when_no_door_tag`** — level with no `Door`-tagged objects yields `MarkerSet { door: false, .. }`.
- **`generated_rust_includes_door_system_when_door_tagged`** — `generate_rust_code` output for a level with a `Door`-tagged object contains `door_proximity_open`.
- **`generated_rust_excludes_collectible_system_when_no_collectibles`** — output for a level without `Collectible`-tagged objects does not contain `collectible_pickup`.
- **`generated_rust_includes_plugin_struct`** — output contains `pub struct MorganLevelSystems` and `pub fn plugin()`.
- **`generated_rust_includes_use_bevy_morgan_integration_systems`** — output contains `use bevy_morgan_integration::systems::`.

#### End-to-end (manual via docs)

The `docs/user/bevy-integration.md` walk-through is extended: the
generated project's `main.rs` should shrink from ~25 lines to ~8
lines, with the consumer adding `Player` and the optional `Player`
component / camera setup only.

### Docs updates

- `docs/user/bevy-integration.md` — section 3 (Wire it up) updated to show the post-T90 `main.rs` (≤ 10 lines).
- `crates/bevy-morgan-integration/README.md` — added "Generated systems" section listing the 5 systems + their event/resource types.
- `docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md` — note that T90 systems are part of the Bevy 0.19 baseline; older exports must be re-generated.

## File Structure (Anti-Godfile)

- Keep each changed file focused on one primary responsibility.
- If this task introduces a new concern, create a focused module/file instead of extending an unrelated catch-all file.
- Do not expand `utils`, `helpers`, or `common` into multi-purpose dumping grounds.
- If a file is already overloaded, extract cohesive pieces before adding new behavior.

Specifically:

- `crates/bevy-morgan-integration/src/systems.rs` (new) — the 5 systems + plugin + companion types.
- `crates/bevy-morgan-integration/src/lib.rs` — re-export `systems` module.
- `src-tauri/src/export/exporters.rs` — add `MarkerSet`, `marker_tags_present`, extend `generate_rust_code` to emit `MorganLevelSystems`. Keep the existing function-shape helpers separate.

## Housekeeping: TODO / FIXME Sweep

Before running preflight, scan all files you created or modified in this task for `TODO`, `FIXME`, `HACK`, `XXX`, and similar markers.

- **Resolve** any that fall within the scope of this task's goal.
- **Leave in place** any that reference work belonging to a later task or phase — but ensure they include a task reference (e.g. `// TODO(T07): wire up auth adapter`).
- **Remove** any placeholder markers that are no longer relevant after your implementation.

If none are found, move on.

## Preflight

```bash
npm run build && npm test -- --run && cargo test --manifest-path src-tauri/Cargo.toml && cargo test -p bevy-morgan-integration && npm run lint && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -W clippy::all -W clippy::pedantic -W clippy::nursery -W clippy::cargo -W clippy::perf -A clippy::module_name_repetitions -A clippy::must_use_candidate -A clippy::missing_errors_doc -A clippy::missing_panics_doc -A clippy::struct_excessive_bools -A clippy::multiple_crate_versions -D clippy::unwrap_used -D clippy::expect_used -D clippy::panic -D clippy::indexing_slicing -D clippy::cast_ptr_alignment -D clippy::suspicious -D warnings && cargo clippy -p bevy-morgan-integration --all-targets -- -D warnings && cargo deny --manifest-path src-tauri/Cargo.toml check
```

## Exit Criteria

- [ ] Type-checking passes without errors
- [ ] All tests pass
- [ ] Linter passes with no warnings (editor + companion crate)
- [ ] `cargo deny --manifest-path src-tauri/Cargo.toml check` reports no vulnerabilities
- [ ] Implementation matches the goal described above
- [ ] No unresolved TODO/FIXME/HACK markers that belong to this task's scope
- [ ] 7 Rust unit tests + 6 editor export tests pass
- [ ] Generated `main.rs` after T90 ≤ 10 lines
- [ ] Marker set is tag-driven (empty level emits no systems)

## After Completion

Update PROGRESS.md row for T90 to `[x]`.
Commit: `feat(bevy-systems): generate per-marker Bevy systems + plugin (T90)`
