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

#### Systems mode: consumer's choice (NEW in T90)

The consumer picks at export time whether to ship **inline self-contained
systems** or **companion-crate references**. The choice is encoded in
the Rust source as `enum SystemsMode { CompanionReference, Inline }`.

```rust
// crates/bevy-morgan-integration/src/systems.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SystemsMode {
    /// Reference the companion crate's `systems` module. Bug fixes flow
    /// through automatically when the consumer bumps the version pin.
    /// Default for long-lived game projects.
    CompanionReference,
    /// Embed the system bodies verbatim in the generated file. The
    /// generated project has no runtime dependency on
    /// `bevy_morgan_integration::systems`. Best for one-off prototypes,
    /// CI-reproducible builds, and consumers who want to own the
    /// system source outright.
    Inline,
}

impl Default for SystemsMode {
    fn default() -> Self {
        Self::CompanionReference
    }
}
```

##### Mode A — `CompanionReference` (current T90 default)

Generated file contains:

```rust
use bevy_morgan_integration::systems::{MorganLevelSystems, plugin};
// ...
.add_systems(Startup, spawn_level_<name>)
.add_plugins(plugin())   // <-- references companion crate
.run();
```

Trade-off: a bug fix in `door_proximity_open` lands in every consumer
on the next `cargo update`. The consumer pins `bevy-morgan-integration`
in their `Cargo.toml` and gets all system fixes in lockstep.

##### Mode B — `Inline`

The generator embeds the system bodies verbatim via `include_str!` from
the companion crate's source. The generated file is fully self-contained
— no `bevy_morgan_integration::systems` import at all. The companion
crate is still a _dev-time_ dependency (for the marker components from
T86) but no runtime system dependency.

```rust
// Top of generated file:
pub mod morgan_level_systems {
    // ... 200 lines of inlined system source ...
}

pub struct MorganLevelSystems;
impl Plugin for MorganLevelSystems {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, (
            morgan_level_systems::door_proximity_open,
            morgan_level_systems::collectible_pickup,
            morgan_level_systems::spawn_point_observer,
            morgan_level_systems::trigger_volume_observer,
            morgan_level_systems::nav_mesh_collector,
        ));
    }
}
```

Trade-off: zero runtime coupling to the companion crate's `systems`
module. Bug fixes require regenerating the export.

##### Where the choice is recorded

The exported Rust source carries a header comment:

```rust
// Generated level code for Bevy 0.19+
// Auto-generated by Morgan-Bevy Level Editor (0.4.0)
// Systems mode: CompanionReference | Inline
// Theme: dungeon | Algorithm: bsp | Seed: 42
```

On re-export the editor parses this header and pre-selects the same
mode. Consumers can override in the export dialog.

##### Implementation: single source of truth

The system bodies are authored **once** in
`crates/bevy-morgan-integration/src/systems.rs` and consumed in both
modes:

- **CompanionReference mode**: the companion crate exposes them as
  `pub fn` symbols. The generator emits `use ...systems::*`.
- **Inline mode**: the generator uses `include_str!` on a
  companion-crate source path that contains the _literal_ Rust
  source of the systems, mirroring the public API.

This guarantees that a fix to `door_proximity_open` shows up in both
modes — Inline mode gets it on next regeneration, CompanionReference
mode gets it on next `cargo update`.

##### Editor UI

The export dialog (`src/components/ExportPanel/`) gets a radio group:

```
Systems:  ( ) Companion crate reference  (•) Inline copy
          [tooltip: Companion crate reference lets bug fixes flow
           through automatically. Inline copy is hermetic — no
           runtime dependency on bevy_morgan_integration::systems.]
```

The choice is persisted in editor settings (`editorSettingsStore`)
with a sensible default of **Inline** for first-time users (so the
generated file is always self-contained and inspectable); advanced
users opt into CompanionReference.

#### Companion crate side (`crates/bevy-morgan-integration/`)

Add a new module `crates/bevy-morgan-integration/src/systems.rs` that ships
**reference implementations** of the per-marker systems, plus the
`SystemsMode` enum above. The editor's generator picks **A** (inline) or
**B** (companion) per the user's export choice.

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

- `generate_rust_code` now scans `level_data.objects` once before emitting to collect the set of marker tags present. The header writer conditionally adds the `use bevy_morgan_integration::systems::...` block only for present markers (CompanionReference mode) or the inline `pub mod morgan_level_systems { ... }` block (Inline mode).
- A new helper `marker_tags_present(level_data) -> MarkerSet` returns a bitset of which markers the level uses.
- The function signature becomes `generate_rust_code(level_data: &LevelData, marker_set: MarkerSet, systems_mode: SystemsMode) -> Result<String>` — the caller (`export_multi_format`) computes `marker_set` once and reads `systems_mode` from editor settings, passing both in.
- The header writer reads the previous export's mode from the comment header (if any) and re-uses it as the default for the next export.
- New CLI helper `parse_systems_mode_from_header(generated_source: &str) -> Option<SystemsMode>` for the "re-export preserves mode" path.

### Tests

#### Rust (`crates/bevy-morgan-integration/`)

- **`door_proximity_opens_nearby_doors`** — spawn a `Player`, spawn a `Door` within 2 m, run one tick, assert the door has `Open`.
- **`door_proximity_does_nothing_far_away`** — spawn a `Door` 10 m away, run one tick, assert no `Open`.
- **`collectible_pickup_removes_on_proximity`** — spawn a `Collectible` near the player, run one tick, assert the entity is despawned and a `PickupEvent` was emitted.
- **`trigger_volume_fires_on_collision`** — fire a `CollisionStarted` event between a player collider and a `TriggerVolume`, assert a `TriggerActivated` event is emitted with the right `event` string.
- **`spawn_point_observer_inserts_resource`** — `commands.spawn((Transform, SpawnPoint::PlayerStart))` then run a tick, assert `Res<PlayerStart>` exists.
- **`nav_mesh_collector_collects_all_hints`** — spawn 3 `NavMeshHint` entities, run one tick, assert `Res<NavMeshSource>` has 3 entries.
- **`plugin_adds_all_systems`** — `App::new().add_plugins(MorganLevelSystems).add_systems(Update, no_op)` and `App::run` for one tick — verifies the plugin doesn't break app construction.
- **`systems_mode_default_is_companion_reference`** — `SystemsMode::default() == SystemsMode::CompanionReference`.
- **`systems_mode_round_trips_through_serde`** — `serde_json::to_string` + `from_str` returns the same variant for both `CompanionReference` and `Inline`.

#### Editor side (`src-tauri/src/export/exporters.rs`)

Add to the existing test module:

- **`marker_set_includes_door_when_door_tag_present`** — level with one `tags: ["door"]` object yields `MarkerSet { door: true, .. }`.
- **`marker_set_excludes_door_when_no_door_tag`** — level with no `Door`-tagged objects yields `MarkerSet { door: false, .. }`.
- **`generated_rust_includes_door_system_when_door_tagged`** — `generate_rust_code` output for a level with a `Door`-tagged object contains `door_proximity_open`.
- **`generated_rust_excludes_collectible_system_when_no_collectibles`** — output for a level without `Collectible`-tagged objects does not contain `collectible_pickup`.
- **`generated_rust_includes_plugin_struct`** — output contains `pub struct MorganLevelSystems` and `pub fn plugin()`.
- **`generated_rust_companion_reference_mode_emits_use_systems`** — `SystemsMode::CompanionReference` output contains `use bevy_morgan_integration::systems::`.
- **`generated_rust_inline_mode_embeds_mod_block`** — `SystemsMode::Inline` output contains `pub mod morgan_level_systems` and the literal `fn door_proximity_open(` body.
- **`generated_rust_inline_mode_omits_companion_systems_use`** — `SystemsMode::Inline` output does **not** contain `use bevy_morgan_integration::systems::`.
- **`generated_rust_header_records_systems_mode`** — output header includes the line `// Systems mode: CompanionReference` or `// Systems mode: Inline` matching the requested mode.
- **`parse_systems_mode_from_header_recognises_both_modes`** — round-trips `CompanionReference` and `Inline` through `generate_rust_code → parse_systems_mode_from_header`.
- **`parse_systems_mode_from_header_returns_none_for_legacy_export`** — output without the `Systems mode:` line returns `None`.

#### End-to-end (manual via docs)

The `docs/user/bevy-integration.md` walk-through is extended: the
generated project's `main.rs` should shrink from ~25 lines to ~8
lines, with the consumer adding `Player` and the optional `Player`
component / camera setup only. The walk-through covers both
`CompanionReference` and `Inline` modes with parallel `main.rs`
examples.

### Docs updates

- `docs/user/bevy-integration.md` — section 3 (Wire it up) updated to show both `CompanionReference` (post-T90 `main.rs` ≤ 10 lines + `bevy-morgan-integration = "0.4"` dep) and `Inline` (no `systems` dep, larger generated file) workflows. New section 7 ("Systems mode") explains the trade-off and the editor default.
- `crates/bevy-morgan-integration/README.md` — added "Generated systems" section listing the 5 systems + their event/resource types, with a paragraph on `SystemsMode` and the dual emission strategy.
- `docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md` — note that T90 systems are part of the Bevy 0.19 baseline; older exports must be re-generated. `SystemsMode::Inline` exports survive a Bevy major bump without changes (because the inlined code is part of the export, not a runtime dep).

## File Structure (Anti-Godfile)

- Keep each changed file focused on one primary responsibility.
- If this task introduces a new concern, create a focused module/file instead of extending an unrelated catch-all file.
- Do not expand `utils`, `helpers`, or `common` into multi-purpose dumping grounds.
- If a file is already overloaded, extract cohesive pieces before adding new behavior.

Specifically:

- `crates/bevy-morgan-integration/src/systems.rs` (new) — the 5 systems + `MorganLevelSystems` plugin + companion types + the `SystemsMode` enum + `parse_systems_mode_from_header` helper.
- `crates/bevy-morgan-integration/src/systems_inline.rs` (new) — the literal Rust source of the 5 systems as a `pub const SYSTEMS_SOURCE: &str = include_str!("systems_inline.rs.emb")` constant, embedded via `include_str!` from a checked-in `.rs.emb` file. Single source of truth for both `Inline` and `CompanionReference` modes.
- `crates/bevy-morgan-integration/src/lib.rs` — re-export `systems` module + `SystemsMode`.
- `src-tauri/src/export/exporters.rs` — add `MarkerSet`, `marker_tags_present`, extend `generate_rust_code(level, marker_set, systems_mode)` to emit `MorganLevelSystems` in either mode. Add `parse_systems_mode_from_header` for the "re-export preserves mode" path. Keep the existing function-shape helpers separate.
- `src/components/ExportPanel/` — radio group for `SystemsMode`. Persisted in `editorSettingsStore`. Default `Inline` for first-time users.

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
- [ ] 9 Rust unit tests + 11 editor export tests pass (CompanionReference + Inline both covered)
- [ ] Generated `main.rs` after T90 ≤ 10 lines
- [ ] Marker set is tag-driven (empty level emits no systems)

## After Completion

Update PROGRESS.md row for T90 to `[x]`.
Commit: `feat(bevy-systems): generate per-marker Bevy systems + plugin (T90)`
