//! Marker components referenced by the editor's exported Rust source.
//!
//! These types live here (and not in the generated file) so that several
//! exported levels can be linked into one Bevy project without `E0119`
//! conflicts on the marker types.
//!
//! The editor's `RustCodeExporter` (see `src-tauri/src/export/exporters.rs`)
//! emits `pub fn spawn_level_<name>(...)` source files that `use` the
//! marker components via the consumer's project, e.g.:
//!
//! ```ignore
//! use bevy_morgan_integration::{SpawnPoint, TriggerVolume};
//! ```
//!
//! When the consumer pins `bevy-morgan-integration` next to `bevy`, the
//! generated file compiles cleanly.

use bevy_ecs::prelude::*;
use serde::{Deserialize, Serialize};

/// Marker component for spawn points emitted by `Morgan-Bevy`.
///
/// The editor's `SpawnPoint` enum has three variants:
/// - `PlayerStart` — the level's player spawn.
/// - `EnemySpawn` — a non-player spawn tagged with a team.
/// - `ItemSpawn` — an item spawn tagged with an item id.
///
/// Used by the runtime to position the player / AI / items at level
/// load time. Consumers should query for `With<SpawnPoint>` and read
/// the variant to decide what to do.
#[derive(Component, Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SpawnPoint {
    #[default]
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

/// Marker component for trigger volumes emitted by `Morgan-Bevy`.
///
/// When an entity with a `Collider` matching the volume enters the
/// region, the runtime fires the `event` string. Consumers can hook
/// into this with their own observer or collision system.
#[derive(Component, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TriggerVolume {
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

/// Interactive door. Consumers typically toggle the door open/closed
/// when the player presses an interaction key while within range, and
/// optionally require a `key_id` to unlock.
#[derive(Component, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Door {
    /// `true` if the door closes itself after the player walks through.
    #[serde(default = "default_true")]
    pub auto_close: bool,
    /// Optional key id required to unlock. `None` means no key needed.
    #[serde(default)]
    pub key_id: Option<String>,
    /// Seconds the door stays open before auto-close. Ignored if
    /// `auto_close` is `false`.
    #[serde(default = "default_duration_secs")]
    pub auto_close_after_secs: f32,
}

impl Default for Door {
    fn default() -> Self {
        Self {
            auto_close: true,
            key_id: None,
            auto_close_after_secs: 3.0,
        }
    }
}

const fn default_true() -> bool {
    true
}

const fn default_duration_secs() -> f32 {
    3.0
}

/// Generic interaction marker.
///
/// Any entity tagged with `Interactable` becomes a candidate for the
/// player's interaction prompt (e.g. "Press E to open the terminal").
/// The `prompt` string is the localised message shown to the player.
#[derive(Component, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Interactable {
    /// Localised interaction prompt, e.g. `"Press E to open"`.
    pub prompt: String,
}

impl Interactable {
    /// Construct an `Interactable` with the given prompt.
    #[must_use]
    pub fn new(prompt: impl Into<String>) -> Self {
        Self {
            prompt: prompt.into(),
        }
    }
}

/// Pickup marker. The inventory system adds the entity to the player's
/// inventory when the player walks into it.
#[derive(Component, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Collectible {
    /// Item id registered with the inventory system.
    pub item_id: String,
    /// Stack size awarded on pickup (default 1).
    #[serde(default = "default_stack")]
    pub count: u32,
}

impl Collectible {
    /// Construct a `Collectible` with the given item id and a default
    /// stack size of 1.
    #[must_use]
    pub fn new(item_id: impl Into<String>) -> Self {
        Self {
            item_id: item_id.into(),
            count: 1,
        }
    }

    /// Construct a `Collectible` with the given item id and stack size.
    #[must_use]
    pub fn with_count(item_id: impl Into<String>, count: u32) -> Self {
        Self {
            item_id: item_id.into(),
            count,
        }
    }
}

const fn default_stack() -> u32 {
    1
}

/// Marker for walkable surfaces. The runtime navigation plugin reads
/// `NavMeshHint`-tagged colliders when generating the navmesh.
///
/// `cost` is a per-surface traversal cost multiplier — a value of 2.0
/// makes the AI prefer an alternate route even if the distance is
/// shorter.
#[derive(Component, Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct NavMeshHint {
    /// Cost multiplier — defaults to 1.0 (neutral).
    #[serde(default = "default_cost")]
    pub cost: f32,
}

impl Default for NavMeshHint {
    fn default() -> Self {
        Self {
            cost: default_cost(),
        }
    }
}

impl NavMeshHint {
    /// Construct a `NavMeshHint` with the given cost multiplier.
    #[must_use]
    pub const fn with_cost(cost: f32) -> Self {
        Self { cost }
    }
}

const fn default_cost() -> f32 {
    1.0
}

#[cfg(test)]
mod tests {
    #![allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::indexing_slicing,
        reason = "test code is allowed to use unwrap/expect for concise assertions"
    )]
    use super::*;

    #[test]
    fn spawn_point_defaults_to_player_start() {
        let sp = SpawnPoint::default();
        assert_eq!(sp, SpawnPoint::PlayerStart);
    }

    #[test]
    fn door_defaults_to_auto_close_no_key_three_seconds() {
        let door = Door::default();
        assert!(door.auto_close);
        assert_eq!(door.key_id, None);
        // Use approximate comparison to avoid the float-cmp lint.
        // `f32::EPSILON` is too tight for accumulated rounding error.
        assert!((door.auto_close_after_secs - 3.0).abs() < 1e-6);
    }

    #[test]
    fn interactable_constructors_set_prompt() {
        let i = Interactable::new("Press E to open");
        assert_eq!(i.prompt, "Press E to open");
    }

    #[test]
    fn collectible_constructors_set_fields() {
        let c = Collectible::new("key_red");
        assert_eq!(c.item_id, "key_red");
        assert_eq!(c.count, 1);

        let c = Collectible::with_count("gold_coin", 25);
        assert_eq!(c.item_id, "gold_coin");
        assert_eq!(c.count, 25);
    }

    #[test]
    fn nav_mesh_hint_defaults_to_neutral_cost() {
        let hint = NavMeshHint::default();
        // Use approximate comparison to avoid the float-cmp lint.
        // `f32::EPSILON` is too tight for accumulated rounding error
        // in the default-derivation path.
        assert!((hint.cost - 1.0).abs() < 1e-6);
    }

    #[test]
    fn components_round_trip_through_serde() {
        let door = Door {
            auto_close: false,
            key_id: Some("key_red".to_string()),
            auto_close_after_secs: 5.0,
        };
        let json = serde_json::to_string(&door).unwrap();
        let back: Door = serde_json::from_str(&json).unwrap();
        assert_eq!(back, door);

        let trigger = TriggerVolume::Box {
            half_extents: [1.0, 1.0, 1.0],
            event: "level.complete".to_string(),
        };
        let json = serde_json::to_string(&trigger).unwrap();
        let back: TriggerVolume = serde_json::from_str(&json).unwrap();
        assert_eq!(back, trigger);
    }
}
