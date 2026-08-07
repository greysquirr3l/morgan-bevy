//! `bevy-morgan-integration` — Bevy 0.19 runtime helpers for levels
//! exported by the Morgan-Bevy editor.
//!
//! This crate is a workspace member of the `morgan-bevy` repo and lives
//! under `crates/bevy-morgan-integration/`. It provides the marker
//! components and plugin that the editor's Rust source-code exporter
//! references, so consumer Bevy projects can `add_plugins(MorganLevelPlugin)`
//! and load exported levels with `load_level(...)`.
//!
//! ## Marker components
//!
//! - [`SpawnPoint`] — where the player / enemies / items spawn.
//! - [`TriggerVolume`] — volumes that fire events when an entity enters.
//! - [`Door`] — interactive doors with key / auto-close flags.
//! - [`Interactable`] — generic interaction prompt marker.
//! - [`Collectible`] — pickup marker for the inventory system.
//! - [`NavMeshHint`] — walkable surface marker for the navigation plugin.
//!
//! ## Plugin
//!
//! [`MorganLevelPlugin`] registers the marker components and provides
//! a stable extension point for downstream plugins (e.g. the AI suite
//! can `add_plugins(MorganLevelPlugin).add_plugins(MyAiPlugin)`).

use glam::{Quat, Vec3};
use serde::{Deserialize, Serialize};

pub mod components;
pub mod loader;
pub mod plugin;
pub mod systems;

pub use components::{Collectible, Door, Interactable, NavMeshHint, SpawnPoint, TriggerVolume};
pub use loader::{level_bounds, load_level, load_level_world, AssetServerLike, HandleId};
pub use plugin::MorganLevelPlugin;
pub use systems::{
    EntityId, MarkerSet, MorganLevelSystems, NavMeshSource, Open, PickupEvent, Player,
    PlayerStart, SystemsMode, TriggerActivated,
};

/// Re-export of `bevy_app` so consumers can `use bevy_morgan_integration::App`
/// to match the editor's documentation conventions.
pub use bevy_app;

/// Re-export of `bevy_ecs` for the same reason — keeps import paths
/// stable across the editor and downstream projects.
pub use bevy_ecs;

/// Re-export of `glam` math types. The editor pins `glam = "0.29"` and
/// the consumer Bevy project should use the same version.
pub use glam;

/// Re-export of `serde` — consumers reading exported JSON will reach
/// for `serde_json::from_str::<ExportedLevel>(...)`.
pub use serde;

/// Bounding box used by the editor and consumed by [`level_bounds`].
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct BoundingBox {
    /// World-space minimum corner.
    pub min: [f32; 3],
    /// World-space maximum corner.
    pub max: [f32; 3],
}

impl BoundingBox {
    /// Construct a bounding box from two opposite corners.
    #[must_use]
    pub const fn from_corners(min: [f32; 3], max: [f32; 3]) -> Self {
        Self { min, max }
    }

    /// Returns the center of the box as a `Vec3`.
    #[must_use]
    pub const fn center(&self) -> Vec3 {
        Vec3::new(
            (self.min[0] + self.max[0]) * 0.5,
            (self.min[1] + self.max[1]) * 0.5,
            (self.min[2] + self.max[2]) * 0.5,
        )
    }

    /// Returns the box extent (size along each axis) as a `Vec3`.
    #[must_use]
    pub const fn extent(&self) -> Vec3 {
        Vec3::new(
            self.max[0] - self.min[0],
            self.max[1] - self.min[1],
            self.max[2] - self.min[2],
        )
    }
}

impl Default for BoundingBox {
    fn default() -> Self {
        Self {
            min: [0.0, 0.0, 0.0],
            max: [0.0, 0.0, 0.0],
        }
    }
}

/// 3D transform as emitted by the editor. Mirrors the editor's
/// `Transform3D` shape so an `ExportedLevel` can be deserialised
/// directly from the JSON export without manual conversion.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ExportedTransform {
    pub position: [f32; 3],
    pub rotation: [f32; 4],
    pub scale: [f32; 3],
}

impl ExportedTransform {
    /// Returns the translation component as a `Vec3`.
    #[must_use]
    pub const fn translation(&self) -> Vec3 {
        const_vec3(self.position)
    }

    /// Returns the rotation component as a `Quat`.
    #[must_use]
    pub const fn rotation(&self) -> Quat {
        Quat::from_xyzw(
            self.rotation[0],
            self.rotation[1],
            self.rotation[2],
            self.rotation[3],
        )
    }

    /// Returns the scale component as a `Vec3`.
    #[must_use]
    pub const fn scale_vec(&self) -> Vec3 {
        const_vec3(self.scale)
    }
}

/// Const-equivalent of `Vec3::from([f32; 3])`. `glam`'s `From` impl is
/// not `const fn`, so we expand it manually here.
const fn const_vec3(v: [f32; 3]) -> Vec3 {
    Vec3::new(v[0], v[1], v[2])
}

impl Default for ExportedTransform {
    fn default() -> Self {
        Self {
            position: [0.0, 0.0, 0.0],
            rotation: [0.0, 0.0, 0.0, 1.0],
            scale: [1.0, 1.0, 1.0],
        }
    }
}

/// Collision shape attached to an `ExportedEntity`. Mirrors the
/// editor's `CollisionShape` so the JSON export round-trips.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ExportedCollisionShape {
    Box { half_extents: [f32; 3] },
    Sphere { radius: f32 },
    Capsule { radius: f32, height: f32 },
}

/// Spawn-point variant attached to an `ExportedEntity`. Mirrors the
/// editor's `SpawnPoint` enum.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ExportedSpawnPoint {
    PlayerStart,
    EnemySpawn {
        #[serde(default)]
        team: String,
    },
    ItemSpawn {
        #[serde(default)]
        item_id: String,
    },
}

/// Trigger-volume variant attached to an `ExportedEntity`. Mirrors
/// the editor's `TriggerVolume` enum.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ExportedTriggerVolume {
    Box {
        half_extents: [f32; 3],
        event: String,
    },
    Sphere {
        radius: f32,
        event: String,
    },
    Polygon {
        points: Vec<[f32; 3]>,
        event: String,
    },
}

/// A single exported entity — one row in the editor's object table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedEntity {
    pub id: String,
    pub name: String,
    pub transform: ExportedTransform,
    pub mesh: Option<String>,
    pub material: Option<String>,
    pub layer: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub collision_shape: Option<ExportedCollisionShape>,
    #[serde(default)]
    pub spawn_point: Option<ExportedSpawnPoint>,
    #[serde(default)]
    pub trigger_volume: Option<ExportedTriggerVolume>,
}

/// Top-level export shape. Matches the editor's `LevelData` JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedLevel {
    pub id: String,
    pub name: String,
    pub objects: Vec<ExportedEntity>,
    pub layers: Vec<String>,
    pub generation_seed: Option<u64>,
    pub bounds: BoundingBox,
    /// Semantic version of the editor that produced this export.
    /// Consumers can use this to opt into version-gated fixes.
    #[serde(default)]
    pub editor_version: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounding_box_center_and_extent() {
        let bb = BoundingBox::from_corners([-1.0, -2.0, -3.0], [3.0, 4.0, 5.0]);
        assert_eq!(bb.center(), Vec3::new(1.0, 1.0, 1.0));
        assert_eq!(bb.extent(), Vec3::new(4.0, 6.0, 8.0));
    }

    #[test]
    fn exported_transform_defaults_to_identity() {
        let t = ExportedTransform::default();
        assert_eq!(t.translation(), Vec3::ZERO);
        assert_eq!(t.rotation(), Quat::IDENTITY);
        assert_eq!(t.scale_vec(), Vec3::ONE);
    }

    #[test]
    fn exported_level_round_trips_through_json() {
        let level = ExportedLevel {
            id: "level-1".to_string(),
            name: "Test Level".to_string(),
            objects: vec![ExportedEntity {
                id: "obj-1".to_string(),
                name: "Cube".to_string(),
                transform: ExportedTransform::default(),
                mesh: Some("cube.gltf".to_string()),
                material: Some("default.mat".to_string()),
                layer: "default".to_string(),
                tags: vec!["static".to_string()],
                collision_shape: Some(ExportedCollisionShape::Box {
                    half_extents: [0.5, 0.5, 0.5],
                }),
                spawn_point: Some(ExportedSpawnPoint::PlayerStart),
                trigger_volume: None,
            }],
            layers: vec!["default".to_string()],
            generation_seed: Some(42),
            bounds: BoundingBox::from_corners([-5.0, -5.0, -5.0], [5.0, 5.0, 5.0]),
            editor_version: Some("0.4.0".to_string()),
        };

        let json = serde_json::to_string(&level).expect("serialize");
        let back: ExportedLevel = serde_json::from_str(&json).expect("deserialize");

        assert_eq!(back.id, "level-1");
        assert_eq!(back.objects.len(), 1);
        assert_eq!(back.objects[0].name, "Cube");
        assert_eq!(
            back.objects[0].collision_shape,
            Some(ExportedCollisionShape::Box {
                half_extents: [0.5, 0.5, 0.5],
            })
        );
        assert_eq!(
            back.objects[0].spawn_point,
            Some(ExportedSpawnPoint::PlayerStart)
        );
        assert_eq!(back.generation_seed, Some(42));
        assert_eq!(back.editor_version.as_deref(), Some("0.4.0"));
    }
}
