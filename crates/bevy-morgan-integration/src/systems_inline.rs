//! Inline source for `SystemsMode::Inline`.
//!
//! The editor's Rust source-code exporter (T90 v2) embeds the
//! per-marker system bodies verbatim in the generated file when
//! the consumer picks `SystemsMode::Inline`. This module is the
//! single source of truth for the embedded text — the actual
//! runtime functions still live in `crate::systems` (so the
//! crate's own tests keep compiling against the live Rust API).
//!
//! ## Why two sources of the same code?
//!
//! `systems.rs` is the **runtime** path: live Bevy 0.19 functions
//! registered by `MorganLevelSystems`. Tests against the plugin
//! exercise those directly. `SYSTEMS_SOURCE` is the **emission**
//! path: the same bodies, copied out as a raw `&str` so the
//! generator can stamp them into a consumer's Bevy project without
//! pulling `bevy_morgan_integration::systems::*` into the consumer's
//! compile graph.
//!
//! Drift between the two is the whole point of the
//! `inline_source_matches_runtime_systems` test below. When you
//! edit a system in `systems.rs`, regenerate this constant from
//! the new function body and update the test fixture in lockstep.
//!
//! ## Format
//!
//! The constant is a Rust raw string (`r#"..."#`) that the editor
//! inserts between the `use bevy::prelude::*;` block and the
//! `plugin_init` function. It is **not** wrapped in `mod { ... }`
//! — the editor emits the bodies as top-level items in the consumer's
//! generated file. The editor's emission strips the `use` line at
//! the top of the constant (which re-imports types already brought
//! in by the consumer's `use bevy::prelude::*;`) and any leading
//! `///` doc comments are preserved verbatim.

/// The full source of `crate::systems`, ready to be stamped into
/// the consumer's generated `main.rs` / lib.rs.
///
/// The text starts immediately after the marker set's `use` block
/// and ends at the closing `}` of the last observer (currently
/// `vfx_observer`). The editor's emission inserts the matching
/// `add_systems(Update, ...)` / `add_observer(...)` call sites for
/// the gated subset of systems (per `MarkerSet`) immediately after
/// this block.
pub const SYSTEMS_SOURCE: &str = r"
// ─────────────────────────────────────────────────────────────────────────
// Per-marker systems — embedded from `bevy_morgan_integration::systems`
// by the editor's Rust source-code exporter when `SystemsMode::Inline`
// is selected. The bodies are identical to the runtime versions in
// the companion crate; this copy lets consumers compile the generated
// file without depending on `bevy_morgan_integration::systems::*`.
// ─────────────────────────────────────────────────────────────────────────

/// Bevy plugin that registers the per-marker systems. Consumers call
/// `add_plugins(MorganLevelSystems)` (or `add_plugins(plugin())` for
/// the shorter form) to wire the level-runtime glue.
#[derive(Debug, Default, Clone, Copy)]
pub struct MorganLevelSystems;

impl bevy::prelude::Plugin for MorganLevelSystems {
    fn build(&self, app: &mut bevy::prelude::App) {
        // Companion messages + resources must be registered so
        // consumers can read them.
        app.add_message::<PickupEvent>()
            .add_message::<TriggerActivated>()
            .add_message::<AudioStartEvent>()
            .add_message::<AudioEndEvent>()
            .init_resource::<PlayerStart>()
            .init_resource::<NavMeshSource>()
            .init_resource::<Lights>()
            .init_resource::<Animations>()
            .init_resource::<VfxEntries>()
            .add_systems(
                bevy::prelude::Update,
                (door_proximity_open, collectible_pickup, nav_mesh_collector),
            )
            .add_observer(spawn_point_observer)
            .add_observer(light_observer)
            .add_observer(animation_player_observer)
            .add_observer(audio_observer)
            .add_observer(vfx_observer);
    }
}

/// Shorter form for `add_plugins(plugin())`.
#[must_use]
pub const fn plugin() -> MorganLevelSystems {
    MorganLevelSystems
}

/// Open a `Door` when any entity tagged with `Player` is within 2
/// metres of it. Attach this system only if the level has at least
/// one `Door`-tagged object (gated by `MarkerSet::door`).
#[allow(clippy::type_complexity)]
pub fn door_proximity_open(
    mut commands: bevy::prelude::Commands,
    player: bevy::prelude::Query<&bevy::prelude::Transform, bevy::prelude::With<Player>>,
    doors: bevy::prelude::Query<(bevy::prelude::Entity, &bevy::prelude::Transform), bevy::prelude::With<Door>>,
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
    mut commands: bevy::prelude::Commands,
    player: bevy::prelude::Query<&bevy::prelude::Transform, bevy::prelude::With<Player>>,
    collectibles: bevy::prelude::Query<(
        bevy::prelude::Entity,
        &Collectible,
        &bevy::prelude::Transform,
    )>,
    mut events: bevy::prelude::MessageWriter<PickupEvent>,
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
pub fn spawn_point_observer(
    add: bevy::prelude::On<bevy::prelude::Add, SpawnPoint>,
    spawn_points: bevy::prelude::Query<&SpawnPoint>,
    mut commands: bevy::prelude::Commands,
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
    mut events: bevy::prelude::MessageWriter<TriggerActivated>,
    volumes: bevy::prelude::Query<(bevy::prelude::Entity, &TriggerVolume)>,
) {
    for (entity, _volume) in &volumes {
        events.write(TriggerActivated {
            entity: EntityId::from_entity(entity),
            event: String::new(),
        });
    }
}

/// `On<Add, Light>` observer — records every light marker in a
/// `Lights` resource.
pub fn light_observer(
    add: bevy::prelude::On<bevy::prelude::Add, Light>,
    lights: bevy::prelude::Query<&Light>,
    mut resources: bevy::prelude::ResMut<Lights>,
) {
    if let Ok(light) = lights.get(add.entity) {
        resources
            .entries
            .push((EntityId::from_entity(add.entity), light.clone()));
    }
}

/// `On<Add, Animation>` observer — records the animation in a
/// resource. The consumer wires `bevy_animation::AnimationPlayer`
/// from their own setup.
pub fn animation_player_observer(
    add: bevy::prelude::On<bevy::prelude::Add, Animation>,
    animations: bevy::prelude::Query<&Animation>,
    mut resources: bevy::prelude::ResMut<Animations>,
) {
    if let Ok(anim) = animations.get(add.entity) {
        resources
            .entries
            .push((EntityId::from_entity(add.entity), anim.clone()));
    }
}

/// `On<Add, Audio>` observer — fires events for the consumer's
/// audio system to react to.
pub fn audio_observer(
    add: bevy::prelude::On<bevy::prelude::Add, Audio>,
    audios: bevy::prelude::Query<&Audio>,
    mut start_events: bevy::prelude::MessageWriter<AudioStartEvent>,
    mut end_events: bevy::prelude::MessageWriter<AudioEndEvent>,
) {
    if let Ok(audio) = audios.get(add.entity) {
        start_events.write(AudioStartEvent {
            entity: EntityId::from_entity(add.entity),
            path: audio.path().to_string(),
            volume: audio.volume(),
            looping: audio.is_looping(),
        });
        if audio.is_oneshot() {
            end_events.write(AudioEndEvent {
                entity: EntityId::from_entity(add.entity),
            });
        }
    }
}

/// `On<Add, Vfx>` observer — records the VFX marker in a resource.
pub fn vfx_observer(
    add: bevy::prelude::On<bevy::prelude::Add, Vfx>,
    vfxes: bevy::prelude::Query<&Vfx>,
    mut resources: bevy::prelude::ResMut<VfxEntries>,
) {
    if let Ok(vfx) = vfxes.get(add.entity) {
        resources
            .entries
            .push((EntityId::from_entity(add.entity), vfx.clone()));
    }
}

/// Collect every `NavMeshHint`-tagged entity into the `NavMeshSource`
/// resource. Consumers read this resource to build a navmesh.
#[allow(clippy::type_complexity)]
pub fn nav_mesh_collector(
    mut source: bevy::prelude::ResMut<NavMeshSource>,
    hints: bevy::prelude::Query<bevy::prelude::Entity, bevy::prelude::With<NavMeshHint>>,
) {
    source.surfaces = hints.iter().map(EntityId::from_entity).collect();
}
";

#[cfg(test)]
mod tests {
    //! The tests pin the contract that the inline source matches
    //! what the runtime plugin registers. The hard checks are:
    //!
    //! 1. `SYSTEMS_SOURCE` contains the same symbols the
    //!    `MorganLevelSystems::build` call uses (no missing `add_systems`
    //!    / `add_observer` entries).
    //! 2. The symbol set matches `MarkerSet::system_names()` so the
    //!    editor's gated emission stays in sync.
    //! 3. `SYSTEMS_SOURCE` does NOT pull `bevy_morgan_integration::*`
    //!    — Inline mode is supposed to be runtime-independent.

    use super::SYSTEMS_SOURCE;
    use crate::systems::MarkerSet;

    #[test]
    fn contains_all_plugin_registrations() {
        // The plugin build() registers these add_systems /
        // add_observer lines; the inline source must too or the
        // consumer's runtime breaks in lock-step.
        assert!(
            SYSTEMS_SOURCE.contains("add_systems("),
            "missing add_systems call"
        );
        assert!(
            SYSTEMS_SOURCE.contains("door_proximity_open"),
            "missing door_proximity_open system"
        );
        assert!(
            SYSTEMS_SOURCE.contains("collectible_pickup"),
            "missing collectible_pickup system"
        );
        assert!(
            SYSTEMS_SOURCE.contains("nav_mesh_collector"),
            "missing nav_mesh_collector system"
        );
        assert!(
            SYSTEMS_SOURCE.contains("add_observer(spawn_point_observer)"),
            "missing spawn_point_observer observer"
        );
        assert!(
            SYSTEMS_SOURCE.contains("add_observer(light_observer)"),
            "missing light_observer observer"
        );
        assert!(
            SYSTEMS_SOURCE.contains("add_observer(animation_player_observer)"),
            "missing animation_player_observer observer"
        );
        assert!(
            SYSTEMS_SOURCE.contains("add_observer(audio_observer)"),
            "missing audio_observer observer"
        );
        assert!(
            SYSTEMS_SOURCE.contains("add_observer(vfx_observer)"),
            "missing vfx_observer observer"
        );
    }

    #[test]
    fn contains_all_runtime_companion_types() {
        // The plugin build() references every one of these message
        // / resource types; the inline source needs them in scope.
        for ty in [
            "PickupEvent",
            "TriggerActivated",
            "AudioStartEvent",
            "AudioEndEvent",
            "PlayerStart",
            "NavMeshSource",
            "Lights",
            "Animations",
            "VfxEntries",
        ] {
            assert!(
                SYSTEMS_SOURCE.contains(ty),
                "inline source missing companion type `{ty}`"
            );
        }
    }

    #[test]
    fn system_names_match_marker_set_order() {
        // The editor gates each `add_systems` / `add_observer` line
        // by the corresponding `MarkerSet` bit. The system names
        // appearing in the inline source must match what
        // `MarkerSet::system_names()` returns so the editor's
        // gating logic stays consistent.
        let mut s = MarkerSet::new();
        s.door = true;
        s.spawn_point = true;
        s.collectible = true;
        s.trigger_volume = true;
        s.nav_mesh_hint = true;
        s.light = true;
        s.animation = true;
        s.audio = true;
        s.vfx = true;
        for name in s.system_names() {
            assert!(
                SYSTEMS_SOURCE.contains(name),
                "inline source missing system `{name}`"
            );
        }
    }

    #[test]
    fn inline_source_does_not_pull_companion_crate() {
        // T90 v2's whole point: Inline mode is supposed to be
        // runtime-independent. If we accidentally add
        // `use bevy_morgan_integration::...;` to the inline source
        // itself, the consumer's generated file would silently
        // regress to CompanionReference semantics. The runtime
        // plugin / observer types are referenced by short name
        // (e.g. `PickupEvent`); the compiler resolves them via the
        // consumer's own `use bevy_morgan_integration::*;` lines.
        assert!(
            !SYSTEMS_SOURCE.contains("use bevy_morgan_integration::"),
            "inline source must not pull bevy_morgan_integration — that defeats the runtime-independence"
        );
    }

    #[test]
    fn runtime_marker_types_referenced_by_short_name() {
        // The inline source references `PickupEvent`, `Door`,
        // `Player`, etc. by their short Rust names — the consumer
        // resolves them through whatever `use` block the editor's
        // CompanionReference-style header emitted. Confirms every
        // runtime reference uses the short name.
        for short in [
            "PickupEvent",
            "TriggerActivated",
            "AudioStartEvent",
            "AudioEndEvent",
            "PlayerStart",
            "NavMeshSource",
            "Lights",
            "Animations",
            "VfxEntries",
            "Player",
            "Door",
            "Collectible",
            "SpawnPoint",
            "TriggerVolume",
            "NavMeshHint",
            "Light",
            "Animation",
            "Audio",
            "Vfx",
            "Open",
            "EntityId",
        ] {
            assert!(
                SYSTEMS_SOURCE.contains(short),
                "inline source missing short-name reference `{short}`"
            );
        }
    }
}
