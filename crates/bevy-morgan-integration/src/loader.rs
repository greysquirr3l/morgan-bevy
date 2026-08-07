//! Level loader — consumes an [`ExportedLevel`] and spawns the
//! matching Bevy entities.
//!
//! This is intentionally a **standalone function** (not a system) so
//! that consumers can call it directly from `Startup` schedules,
//! `OnEnter(GameState::Playing)`, or anywhere they have a `&mut
//! Commands` in scope.
//!
//! The function emits marker components only — the consumer's project
//! is responsible for translating `mesh` / `material` strings into
//! `Mesh3d` / `MeshMaterial3d` handles. This keeps the loader free of
//! Bevy's renderer dependency (we only depend on `bevy_ecs`).
//!
//! ## Example
//!
//! ```ignore
//! use bevy::prelude::*;
//! use bevy_morgan_integration::{ExportedLevel, load_level, level_bounds};
//!
//! fn spawn(mut commands: Commands, asset_server: Res<AssetServer>) {
//!     let json = include_str!("../levels/office.json");
//!     let level: ExportedLevel = serde_json::from_str(json).unwrap();
//!     let (min, max) = level_bounds(&level);
//!     load_level(&mut commands, &asset_server, &level);
//! }
//! ```

use crate::components::{Collectible, Door, Interactable, NavMeshHint, SpawnPoint, TriggerVolume};
use crate::{ExportedEntity, ExportedLevel};
use bevy_ecs::name::Name;
use bevy_ecs::prelude::*;
use bevy_ecs::resource::Resource;
use bevy_transform::components::Transform;
use glam::{Quat, Vec3};

/// Tracks which entities were spawned during the most recent
/// `load_level` call. Useful for level unload + cleanup.
///
/// `spawned_ids` mirrors the input order; `level_name` is a copy of
/// `ExportedLevel.name` for log output.
#[derive(Debug, Default, Resource)]
pub struct LoadedLevel {
    /// Entity ids in spawn order.
    pub spawned_ids: Vec<Entity>,
    /// Name of the loaded level (mirrors `ExportedLevel.name`).
    pub level_name: String,
}

/// Load an exported level into the Bevy world. Returns the entity ids
/// in spawn order so the caller can clean them up later if needed.
///
/// The function is pure with respect to `&mut World` — it spawns
/// entities through `Commands` and records the spawned ids in the
/// `LoadedLevel` resource (if one exists). If no `LoadedLevel`
/// resource is present, the resource is inserted.
pub fn load_level(
    commands: &mut Commands,
    _asset_server: &dyn AssetServerLike,
    level: &ExportedLevel,
) -> Vec<Entity> {
    let mut ids = Vec::with_capacity(level.objects.len());
    for obj in &level.objects {
        let id = spawn_entity(commands, obj);
        ids.push(id);
    }

    // Record the load in the LoadedLevel resource.
    commands.insert_resource(LoadedLevel {
        spawned_ids: ids.clone(),
        level_name: level.name.clone(),
    });

    ids
}

/// Direct-to-world variant of [`load_level`] for tests and consumers.
///
/// Use this when you have a `&mut World` rather than a `Commands`.
/// `EntityWorldMut::insert` commits the entity immediately, avoiding
/// the deferred command queue. The returned `Vec<Entity>` mirrors
/// [`load_level`]'s return.
pub fn load_level_world(
    world: &mut World,
    _asset_server: &dyn AssetServerLike,
    level: &ExportedLevel,
) -> Vec<Entity> {
    let mut ids = Vec::with_capacity(level.objects.len());
    for obj in &level.objects {
        let id = spawn_entity_world(world, obj);
        ids.push(id);
    }

    world.insert_resource(LoadedLevel {
        spawned_ids: ids.clone(),
        level_name: level.name.clone(),
    });

    ids
}

/// Spawn a single `ExportedEntity` and return its `Entity` id.
///
/// Components attached (when present in the input):
/// - `Transform` (always)
/// - `Name` (always)
/// - `SpawnPoint` (if `obj.spawn_point.is_some()`)
/// - `TriggerVolume` (if `obj.trigger_volume.is_some()`)
/// - `Door` (if `obj.tags` contains `"door"`)
/// - `Interactable` (if `obj.tags` contains `"interactable"`)
/// - `Collectible` (if `obj.tags` contains `"collectible"`)
/// - `NavMeshHint` (if `obj.tags` contains `"nav-mesh"`)
pub fn spawn_entity(commands: &mut Commands, obj: &ExportedEntity) -> Entity {
    let id = commands
        .spawn((
            Transform::from_translation(translation_from(&obj.transform))
                .with_rotation(rotation_from(&obj.transform))
                .with_scale(scale_from(&obj.transform)),
            Name::new(obj.name.clone()),
        ))
        .id();

    let mut ec = commands.entity(id);
    attach_marker_components(&mut EntityCommandWriter::Commands(&mut ec), obj);
    id
}

/// Direct-to-world variant of [`spawn_entity`] for tests and
/// consumers that don't want the deferred command queue. Spawns and
/// inserts components immediately.
pub fn spawn_entity_world(world: &mut World, obj: &ExportedEntity) -> Entity {
    let id = world
        .spawn((
            Transform::from_translation(translation_from(&obj.transform))
                .with_rotation(rotation_from(&obj.transform))
                .with_scale(scale_from(&obj.transform)),
            Name::new(obj.name.clone()),
        ))
        .id();

    let mut em = world.entity_mut(id);
    attach_marker_components(&mut EntityCommandWriter::World(&mut em), obj);
    id
}

/// Tiny enum that lets [`attach_marker_components`] write to either
/// an `EntityCommands` (deferred) or an `EntityWorldMut` (immediate).
enum EntityCommandWriter<'w, 's> {
    Commands(&'s mut EntityCommands<'s>),
    World(&'w mut EntityWorldMut<'w>),
}

impl EntityCommandWriter<'_, '_> {
    fn insert<B: Bundle>(&mut self, bundle: B) {
        match self {
            Self::Commands(ec) => {
                ec.insert(bundle);
            }
            Self::World(em) => {
                em.insert(bundle);
            }
        }
    }
}

fn attach_marker_components(ec: &mut EntityCommandWriter<'_, '_>, obj: &ExportedEntity) {
    if let Some(ref sp) = obj.spawn_point {
        let component = match sp {
            crate::ExportedSpawnPoint::PlayerStart => SpawnPoint::PlayerStart,
            crate::ExportedSpawnPoint::EnemySpawn { team } => {
                SpawnPoint::EnemySpawn { team: team.clone() }
            }
            crate::ExportedSpawnPoint::ItemSpawn { item_id } => SpawnPoint::ItemSpawn {
                item_id: item_id.clone(),
            },
        };
        ec.insert(component);
    }

    if let Some(ref tv) = obj.trigger_volume {
        let component = match tv {
            crate::ExportedTriggerVolume::Box {
                half_extents,
                event,
            } => TriggerVolume::Box {
                half_extents: *half_extents,
                event: event.clone(),
            },
            crate::ExportedTriggerVolume::Sphere { radius, event } => TriggerVolume::Sphere {
                radius: *radius,
                event: event.clone(),
            },
            crate::ExportedTriggerVolume::Polygon { points, event } => TriggerVolume::Polygon {
                points: points.clone(),
                event: event.clone(),
            },
        };
        ec.insert(component);
    }

    // Tag-driven marker components. The editor doesn't carry a typed
    // field for every marker; tags are the source of truth for the
    // runtime ones (door / interactable / collectible / nav-mesh).
    let lower: Vec<String> = obj.tags.iter().map(|t| t.to_lowercase()).collect();
    if lower.iter().any(|t| t == "door") {
        ec.insert(Door::default());
    }
    if lower.iter().any(|t| t == "interactable") {
        ec.insert(Interactable::new(format!("Press E to use {}", obj.name)));
    }
    if lower.iter().any(|t| t == "collectible") {
        ec.insert(Collectible::new(item_id_from_name(&obj.name)));
    }
    if lower.iter().any(|t| t == "nav-mesh" || t == "navmesh") {
        ec.insert(NavMeshHint::default());
    }
}

/// Returns the bounding box as `(min, max)` corners. Convenience
/// wrapper around `ExportedLevel.bounds` for consumers that want
/// `Vec3`-shaped bounds.
#[must_use]
pub const fn level_bounds(level: &ExportedLevel) -> (Vec3, Vec3) {
    (
        crate::const_vec3(level.bounds.min),
        crate::const_vec3(level.bounds.max),
    )
}

const fn translation_from(t: &crate::ExportedTransform) -> Vec3 {
    crate::const_vec3(t.position)
}

const fn rotation_from(t: &crate::ExportedTransform) -> Quat {
    Quat::from_xyzw(t.rotation[0], t.rotation[1], t.rotation[2], t.rotation[3])
}

const fn scale_from(t: &crate::ExportedTransform) -> Vec3 {
    crate::const_vec3(t.scale)
}

fn item_id_from_name(name: &str) -> String {
    name.to_lowercase().replace(' ', "_")
}

/// Trait abstraction over `AssetServer` so the loader doesn't need to
/// pull in Bevy's renderer. Consumers implement this with a one-line
/// `impl AssetServerLike for &Res<AssetServer> { ... }`.
///
/// In practice, most consumers don't need this trait at all — they
/// pass `&asset_server` directly via the [`load_level`] entry point
/// which accepts `&dyn AssetServerLike`. The default implementation
/// returns an empty list of loaded handles; override it if you need
/// to resolve mesh / material paths into `Handle`s.
pub trait AssetServerLike {
    /// Resolve an asset path to a handle. Default: returns a fake
    /// handle id derived from the path. Override to integrate with
    /// Bevy's actual `AssetServer`.
    fn load_handle(&self, path: &str) -> HandleId {
        HandleId::from_path(path)
    }
}

impl<T: AssetServerLike + ?Sized> AssetServerLike for &T {
    fn load_handle(&self, path: &str) -> HandleId {
        (*self).load_handle(path)
    }
}

/// Stable identifier for an asset handle. Stand-in for Bevy's
/// `AssetId` so the crate stays free of `bevy_asset`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct HandleId(u64);

impl HandleId {
    /// Construct a `HandleId` from a path by hashing it. Deterministic
    /// — the same path produces the same id across runs.
    #[must_use]
    pub fn from_path(path: &str) -> Self {
        // FNV-1a 64-bit. Lightweight and avoids pulling in `std::hash`
        // collections.
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        for byte in path.as_bytes() {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x100_0000_01b3);
        }
        Self(hash)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BoundingBox, ExportedLevel};

    fn sample_level() -> ExportedLevel {
        ExportedLevel {
            id: "level-test".to_string(),
            name: "Test".to_string(),
            objects: vec![
                ExportedEntity {
                    id: "obj-floor".to_string(),
                    name: "Floor".to_string(),
                    transform: crate::ExportedTransform::default(),
                    mesh: Some("floor.gltf".to_string()),
                    material: Some("default.mat".to_string()),
                    layer: "default".to_string(),
                    tags: vec!["static".to_string(), "nav-mesh".to_string()],
                    collision_shape: Some(crate::ExportedCollisionShape::Box {
                        half_extents: [10.0, 0.1, 10.0],
                    }),
                    spawn_point: None,
                    trigger_volume: None,
                },
                ExportedEntity {
                    id: "obj-spawn".to_string(),
                    name: "Player Spawn".to_string(),
                    transform: crate::ExportedTransform::default(),
                    mesh: None,
                    material: None,
                    layer: "default".to_string(),
                    tags: vec![],
                    collision_shape: None,
                    spawn_point: Some(crate::ExportedSpawnPoint::PlayerStart),
                    trigger_volume: None,
                },
                ExportedEntity {
                    id: "obj-door".to_string(),
                    name: "Office Door".to_string(),
                    transform: crate::ExportedTransform::default(),
                    mesh: Some("door.gltf".to_string()),
                    material: None,
                    layer: "default".to_string(),
                    tags: vec!["door".to_string(), "interactable".to_string()],
                    collision_shape: Some(crate::ExportedCollisionShape::Box {
                        half_extents: [1.0, 2.0, 0.1],
                    }),
                    spawn_point: None,
                    trigger_volume: None,
                },
                ExportedEntity {
                    id: "obj-coin".to_string(),
                    name: "Gold Coin".to_string(),
                    transform: crate::ExportedTransform::default(),
                    mesh: Some("coin.gltf".to_string()),
                    material: None,
                    layer: "default".to_string(),
                    tags: vec!["collectible".to_string()],
                    collision_shape: None,
                    spawn_point: None,
                    trigger_volume: None,
                },
                ExportedEntity {
                    id: "obj-trigger".to_string(),
                    name: "Exit".to_string(),
                    transform: crate::ExportedTransform::default(),
                    mesh: None,
                    material: None,
                    layer: "default".to_string(),
                    tags: vec![],
                    collision_shape: None,
                    spawn_point: None,
                    trigger_volume: Some(crate::ExportedTriggerVolume::Box {
                        half_extents: [1.0, 1.0, 1.0],
                        event: "level.complete".to_string(),
                    }),
                },
            ],
            layers: vec!["default".to_string()],
            generation_seed: Some(42),
            bounds: BoundingBox::from_corners([-10.0, 0.0, -10.0], [10.0, 0.0, 10.0]),
            editor_version: Some("0.4.0".to_string()),
        }
    }

    /// No-op asset server for tests. The loader doesn't actually need
    /// asset handles at the marker-component level — consumers wire
    /// those up after the fact.
    struct NullAssetServer;
    impl AssetServerLike for NullAssetServer {}

    #[test]
    fn load_level_spawns_one_entity_per_object() {
        let mut world = World::new();
        let level = sample_level();
        let ids = load_level_world(&mut world, &NullAssetServer, &level);
        assert_eq!(ids.len(), 5);
        // Every entity in `ids` must be live in the world. Bevy
        // doesn't reserve a root entity for `World::new()` directly,
        // but `iter_entities` includes any reserved bookkeeping. Check
        // membership via `contains` rather than count.
        for id in &ids {
            assert!(world.get_entity(*id).is_ok(), "entity {id:?} should exist");
        }
    }

    #[test]
    fn spawn_point_marker_attached_to_player_start() {
        let mut world = World::new();
        let level = sample_level();
        let _ = load_level_world(&mut world, &NullAssetServer, &level);

        let mut q = world.query::<&SpawnPoint>();
        let mut found = 0;
        for sp in q.iter(&world) {
            if matches!(sp, SpawnPoint::PlayerStart) {
                found += 1;
            }
        }
        assert_eq!(found, 1);
    }

    #[test]
    fn trigger_volume_marker_attached_with_event() {
        let mut world = World::new();
        let level = sample_level();
        let _ = load_level_world(&mut world, &NullAssetServer, &level);

        let mut q = world.query::<&TriggerVolume>();
        let mut found = 0;
        for tv in q.iter(&world) {
            if let TriggerVolume::Box { event, .. } = tv {
                assert_eq!(event, "level.complete");
                found += 1;
            }
        }
        assert_eq!(found, 1);
    }

    #[test]
    fn door_marker_attached_when_tagged() {
        let mut world = World::new();
        let level = sample_level();
        let _ = load_level_world(&mut world, &NullAssetServer, &level);

        let mut q = world.query::<&Door>();
        assert_eq!(q.iter(&world).count(), 1);
    }

    #[test]
    fn collectible_marker_attached_when_tagged() {
        let mut world = World::new();
        let level = sample_level();
        let _ = load_level_world(&mut world, &NullAssetServer, &level);

        let mut q = world.query::<&Collectible>();
        let mut found = 0;
        for c in q.iter(&world) {
            assert_eq!(c.item_id, "gold_coin");
            found += 1;
        }
        assert_eq!(found, 1);
    }

    #[test]
    fn nav_mesh_hint_attached_when_tagged() {
        let mut world = World::new();
        let level = sample_level();
        let _ = load_level_world(&mut world, &NullAssetServer, &level);

        let mut q = world.query::<&NavMeshHint>();
        assert_eq!(q.iter(&world).count(), 1);
    }

    #[test]
    fn level_bounds_returns_corners() {
        let level = sample_level();
        let (min, max) = level_bounds(&level);
        assert_eq!(min, Vec3::new(-10.0, 0.0, -10.0));
        assert_eq!(max, Vec3::new(10.0, 0.0, 10.0));
    }

    #[test]
    fn handle_id_is_deterministic() {
        let a = HandleId::from_path("models/cube.gltf");
        let b = HandleId::from_path("models/cube.gltf");
        assert_eq!(a, b);

        let c = HandleId::from_path("models/sphere.gltf");
        assert_ne!(a, c);
    }

    #[test]
    fn loaded_level_resource_records_load() {
        let mut world = World::new();
        let level = sample_level();
        let _ = load_level_world(&mut world, &NullAssetServer, &level);
        let loaded = world.resource::<LoadedLevel>();
        assert_eq!(loaded.level_name, "Test");
        assert_eq!(loaded.spawned_ids.len(), 5);
    }
}
