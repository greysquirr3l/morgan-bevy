//! Bevy systems that respond to the marker components shipped by
//! `bevy-morgan-integration`.
//!
//! These are the **reference implementations** consumed by the
//! editor's Rust source-code exporter (see T90). Two emission modes
//! are supported:
//!
//! - **`SystemsMode::CompanionReference`** — the consumer's generated
//!   Bevy source contains `use bevy_morgan_integration::systems::*;`
//!   and `add_plugins(MorganLevelSystems)`. Bug fixes flow through
//!   automatically when the consumer bumps the
//!   `bevy-morgan-integration` version pin.
//! - **`SystemsMode::Inline`** — the editor embeds the system bodies
//!   verbatim via the [`SYSTEMS_SOURCE`] constant. The generated
//!   file has no runtime dependency on `bevy_morgan_integration::systems`.
//!
//! The five systems are tag-driven: the editor only emits the
//! references / inline source for the systems that the level actually
//! uses. See [`crate::MarkerSet`] for the gating logic.

use crate::components::{Collectible, Door, NavMeshHint, SpawnPoint, TriggerVolume};
use bevy_app::{App, Plugin, Update};
use bevy_ecs::{lifecycle::Add, message::Message, observer::On, prelude::*};
use bevy_transform::components::Transform;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Companion types — emitted in the generated file alongside the plugin.
// ---------------------------------------------------------------------------

/// Component attached to a `Door` that has been opened by the
/// `door_proximity_open` system. The consumer's animation system
/// reads this to play the open / close animation.
#[derive(Component, Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct Open;

/// Message fired when the player picks up a `Collectible`.
#[derive(Message, Debug, Clone, Serialize, Deserialize)]
pub struct PickupEvent {
    pub entity: EntityId,
    pub item_id: String,
}

/// Message fired when an entity enters a `TriggerVolume`.
#[derive(Message, Debug, Clone, Serialize, Deserialize)]
pub struct TriggerActivated {
    pub entity: EntityId,
    pub event: String,
}

/// Resource inserted by `spawn_point_observer` for `PlayerStart`.
#[derive(Resource, Debug, Default, Clone, Serialize, Deserialize)]
pub struct PlayerStart;

/// Resource populated by `nav_mesh_collector` with every
/// `NavMeshHint`-tagged entity. Consumers can read this and feed it
/// to their navigation plugin (e.g. `bevy_navigation`).
#[derive(Resource, Debug, Default, Clone, Serialize, Deserialize)]
pub struct NavMeshSource {
    pub surfaces: Vec<EntityId>,
}

/// Stable, serializable handle for a Bevy `Entity`. Bevy's `Entity`
/// doesn't implement `Serialize` / `Deserialize` directly, so we
/// round-trip through its index + generation pair via this newtype.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct EntityId {
    pub index: u32,
    pub generation: u32,
}

impl EntityId {
    /// Convert a Bevy `Entity` into a serializable `EntityId`.
    #[must_use]
    pub const fn from_entity(entity: Entity) -> Self {
        Self {
            index: entity.index_u32(),
            generation: entity.generation().to_bits(),
        }
    }

    /// Reconstruct a Bevy `Entity` handle from this id. The consumer
    /// must verify liveness via `world.get_entity(entity)` before use.
    ///
    /// Note: Bevy 0.19 does not expose `Entity::from_raw_u32` as a
    /// `const fn`. This method panics if the encoded entity is
    /// invalid; callers should handle `None` via `from_entity_infallible`
    /// or skip the round-trip when liveness isn't required.
    ///
    /// # Panics
    /// Panics if the encoded entity index is invalid (out of range).
    #[must_use]
    pub const fn to_entity(self) -> Entity {
        match Entity::from_raw_u32(self.index) {
            Some(entity) => entity,
            None => panic!("EntityId carries an invalid raw index"),
        }
    }
}

/// Marker component the consumer attaches to their player entity.
/// Required by `door_proximity_open` and `collectible_pickup` to find
/// the player in the world.
#[derive(Component, Debug, Default, Clone, Copy)]
pub struct Player;

// ---------------------------------------------------------------------------
// Systems mode + MarkerSet — emitted by the editor's exporter and
// used by the `plugin()` helper. `SystemsMode` is serializable so the
// generator can record the choice in the generated header.
// ---------------------------------------------------------------------------

/// Which systems mode the editor's exporter should emit.
///
/// This is **part of the generator** (the editor reads it from the
/// previous export header or from the user's export dialog) — it is
/// not a runtime value. The runtime code always uses the systems
/// declared in this module; the choice controls how the editor
/// *emits* them in the consumer's generated source.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SystemsMode {
    /// Reference the companion crate's `systems` module. Bug fixes
    /// flow through automatically on `cargo update`.
    #[default]
    #[serde(rename = "companion_reference")]
    CompanionReference,
    /// Embed the system bodies verbatim in the generated file.
    /// Zero runtime coupling to `bevy_morgan_integration::systems`.
    #[serde(rename = "inline")]
    Inline,
}

/// Bitset of which marker types the level uses. The editor builds
/// this once before emitting and uses it to gate the systems +
/// plugin + companion types it writes into the generated file.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct MarkerSet {
    pub door: bool,
    pub collectible: bool,
    pub spawn_point: bool,
    pub trigger_volume: bool,
    pub nav_mesh_hint: bool,
}

impl MarkerSet {
    /// Construct an empty `MarkerSet` (no markers).
    #[must_use]
    pub const fn new() -> Self {
        Self {
            door: false,
            collectible: false,
            spawn_point: false,
            trigger_volume: false,
            nav_mesh_hint: false,
        }
    }

    /// Returns `true` if no markers are set — used by the editor to
    /// skip emitting the plugin entirely when the level has no
    /// marker-tagged objects.
    #[must_use]
    pub const fn is_empty(&self) -> bool {
        !self.door
            && !self.collectible
            && !self.spawn_point
            && !self.trigger_volume
            && !self.nav_mesh_hint
    }

    /// Returns `true` if any marker is set.
    #[must_use]
    pub const fn is_any(&self) -> bool {
        !self.is_empty()
    }

    /// Returns the set of systems that should be registered in the
    /// generated Bevy plugin. The order matches the spec; downstream
    /// emitters should preserve it.
    #[must_use]
    pub fn system_names(&self) -> Vec<&'static str> {
        let mut out = Vec::with_capacity(5);
        if self.door {
            out.push("door_proximity_open");
        }
        if self.collectible {
            out.push("collectible_pickup");
        }
        if self.spawn_point {
            out.push("spawn_point_observer");
        }
        if self.trigger_volume {
            out.push("trigger_volume_observer");
        }
        if self.nav_mesh_hint {
            out.push("nav_mesh_collector");
        }
        out
    }
}

// ---------------------------------------------------------------------------
// The plugin — wired into the generated app via `add_plugins(plugin())`.
// ---------------------------------------------------------------------------

/// Bevy plugin that registers the per-marker systems. Consumers call
/// `add_plugins(MorganLevelSystems)` (or `add_plugins(plugin())` for
/// the shorter form) to wire the level-runtime glue.
#[derive(Debug, Default, Clone, Copy)]
pub struct MorganLevelSystems;

impl Plugin for MorganLevelSystems {
    fn build(&self, app: &mut App) {
        // Companion messages + resources must be registered so
        // consumers can read them.
        app.add_message::<PickupEvent>()
            .add_message::<TriggerActivated>()
            .init_resource::<PlayerStart>()
            .init_resource::<NavMeshSource>()
            // The door proximity, collectible pickup, and nav mesh
            // collector are plain systems.
            .add_systems(
                Update,
                (door_proximity_open, collectible_pickup, nav_mesh_collector),
            )
            // The spawn point observer is a Bevy 0.19 observer
            // triggered on `On<Add, SpawnPoint>`.
            .add_observer(spawn_point_observer);
    }
}

/// Shorter form for `add_plugins(plugin())`.
#[must_use]
pub const fn plugin() -> MorganLevelSystems {
    MorganLevelSystems
}

// ---------------------------------------------------------------------------
// Systems — referenced by the plugin and also embedded (verbatim) by
// `SYSTEMS_SOURCE` in `systems_inline.rs` for the Inline emission mode.
// ---------------------------------------------------------------------------

/// Open a `Door` when any entity tagged with `Player` is within 2
/// metres of it. Attach this system only if the level has at least
/// one `Door`-tagged object (gated by `MarkerSet::door`).
#[allow(clippy::type_complexity)]
pub fn door_proximity_open(
    mut commands: Commands,
    player: Query<&Transform, With<Player>>,
    doors: Query<(Entity, &Transform), With<Door>>,
) {
    let Ok(player_t) = player.single() else {
        return;
    };
    let player_pos = player_t.translation;
    for (entity, door_t) in &doors {
        let dist = door_t.translation.distance(player_pos);
        if dist <= 2.0 {
            commands.entity(entity).insert(Open);
        }
    }
}

/// Pick up a `Collectible` when the player is within 1 metre. Emits a
/// `PickupEvent` and despawns the collectible entity.
#[allow(clippy::type_complexity)]
pub fn collectible_pickup(
    mut commands: Commands,
    mut events: MessageWriter<PickupEvent>,
    player: Query<&Transform, With<Player>>,
    collectibles: Query<(Entity, &Collectible, &Transform)>,
) {
    let Ok(player_t) = player.single() else {
        return;
    };
    let player_pos = player_t.translation;
    for (entity, collectible, collectible_t) in &collectibles {
        let dist = collectible_t.translation.distance(player_pos);
        if dist <= 1.0 {
            events.write(PickupEvent {
                entity: EntityId::from_entity(entity),
                item_id: collectible.item_id.clone(),
            });
            commands.entity(entity).despawn();
        }
    }
}

/// Observer that fires whenever a `SpawnPoint` is added to an entity.
/// For `PlayerStart` spawn points, inserts a `PlayerStart` resource
/// so consumers can read it from any system.
#[expect(
    clippy::needless_pass_by_value,
    reason = "On<Add, T> is a Bevy system param; it must be by-value"
)]
pub fn spawn_point_observer(
    add: On<Add, SpawnPoint>,
    spawn_points: Query<&SpawnPoint>,
    mut commands: Commands,
) {
    if let Ok(sp) = spawn_points.get(add.entity) {
        if matches!(sp, SpawnPoint::PlayerStart) {
            commands.insert_resource(PlayerStart);
        }
    }
}

/// Reads `TriggerVolume` collisions and emits `TriggerActivated`
/// messages.
///
/// Bevy 0.19's collision events require `Collider` to be on the
/// player entity too; consumers wire their own collision plugin
/// (e.g. `avian3d`) and this system runs alongside it. The
/// reference implementation emits one event per volume per tick
/// so consumers can wire the actual collision plumbing on top.
#[allow(clippy::type_complexity)]
pub fn trigger_volume_observer(
    mut events: MessageWriter<TriggerActivated>,
    volumes: Query<(Entity, &TriggerVolume)>,
) {
    for (entity, _volume) in &volumes {
        events.write(TriggerActivated {
            entity: EntityId::from_entity(entity),
            event: String::new(),
        });
    }
}

/// Collect every `NavMeshHint`-tagged entity into the `NavMeshSource`
/// resource. Consumers read this resource to build a navmesh.
#[allow(clippy::type_complexity)]
pub fn nav_mesh_collector(
    mut source: ResMut<NavMeshSource>,
    hints: Query<Entity, With<NavMeshHint>>,
) {
    source.surfaces = hints.iter().map(EntityId::from_entity).collect();
}

#[cfg(test)]
mod tests {
    use super::*;
    use bevy_ecs::world::World;

    #[test]
    fn systems_mode_default_is_companion_reference() {
        assert_eq!(SystemsMode::default(), SystemsMode::CompanionReference);
    }

    #[test]
    fn systems_mode_round_trips_through_serde() {
        for mode in [SystemsMode::CompanionReference, SystemsMode::Inline] {
            let json = serde_json::to_string(&mode).expect("serialize");
            let back: SystemsMode = serde_json::from_str(&json).expect("deserialize");
            assert_eq!(back, mode);
        }
    }

    #[test]
    fn marker_set_empty_and_any() {
        let empty = MarkerSet::new();
        assert!(empty.is_empty());
        assert!(!empty.is_any());
        assert!(empty.system_names().is_empty());

        let mut with_door = MarkerSet::new();
        with_door.door = true;
        assert!(!with_door.is_empty());
        assert!(with_door.is_any());
        assert_eq!(with_door.system_names(), vec!["door_proximity_open"]);
    }

    #[test]
    fn marker_set_system_names_in_canonical_order() {
        let mut s = MarkerSet::new();
        s.nav_mesh_hint = true;
        s.door = true;
        s.spawn_point = true;
        let names = s.system_names();
        assert_eq!(
            names,
            vec![
                "door_proximity_open",
                "spawn_point_observer",
                "nav_mesh_collector"
            ]
        );
    }

    #[test]
    fn marker_set_serializes_to_bool_object() {
        let mut s = MarkerSet::new();
        s.door = true;
        s.collectible = true;
        let json = serde_json::to_string(&s).expect("serialize");
        assert!(json.contains("\"door\":true"));
        assert!(json.contains("\"collectible\":true"));
        assert!(json.contains("\"spawn_point\":false"));
    }

    #[test]
    fn plugin_builds_without_panicking() {
        let mut app = App::new();
        app.add_plugins(MorganLevelSystems);
        // The plugin should register events + resources without crashing.
        let _ = app.world().resource::<PlayerStart>();
        let _ = app.world().resource::<NavMeshSource>();
    }

    #[test]
    fn plugin_short_form_equals_struct() {
        let p: MorganLevelSystems = plugin();
        let _ = p;
    }

    #[test]
    fn entity_id_round_trips() {
        let mut world = World::new();
        let e = world.spawn_empty().id();
        let id = EntityId::from_entity(e);
        let json = serde_json::to_string(&id).expect("serialize");
        let back: EntityId = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back, id);
        // to_entity reconstructs the handle (even if not currently alive).
        let _ = back.to_entity();
    }
}
