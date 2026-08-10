//! Bevy plugin for Morgan-Bevy levels.
//!
//! [`MorganLevelPlugin`] is a no-op `Plugin` that exists to:
//!
//! 1. Provide a stable extension point — downstream projects can
//!    `add_plugins(MorganLevelPlugin)` and downstream plugins can
//!    hook into it via `add_systems(...)`.
//! 2. Document the recommended integration: the consumer project
//!    pulls in this plugin, then calls [`crate::load_level`] from
//!    their `Startup` system (or `OnEnter(GameState::Playing)`) to
//!    spawn the entities from an exported level.
//!
//! ## Example
//!
//! ```ignore
//! use bevy::prelude::*;
//! use bevy_morgan_integration::{MorganLevelPlugin, ExportedLevel, load_level};
//!
//! fn main() {
//!     App::new()
//!         .add_plugins(DefaultPlugins)
//!         .add_plugins(MorganLevelPlugin)
//!         .add_systems(Startup, spawn_level)
//!         .run();
//! }
//!
//! fn spawn_level(mut commands: Commands, asset_server: Res<AssetServer>) {
//!     let json = include_str!("../levels/office.json");
//!     let level: ExportedLevel = serde_json::from_str(json).unwrap();
//!     load_level(&mut commands, &asset_server, &level);
//! }
//! ```

use bevy_app::{App, Plugin};

/// Bevy plugin for Morgan-Bevy levels.
///
/// Registers nothing by itself (the marker components and the
/// [`crate::LoadedLevel`] resource are auto-registered when they're
/// inserted). This plugin exists as a documented integration point.
#[derive(Debug, Default, Clone, Copy)]
pub struct MorganLevelPlugin;

impl Plugin for MorganLevelPlugin {
    fn build(&self, _app: &mut App) {
        // Intentionally empty: marker components are auto-registered
        // by Bevy when inserted. Future revisions may register
        // systems here (e.g. spawn-point discovery on level load).
    }
}

#[cfg(test)]
mod tests {
    #![allow(
        clippy::unwrap_used,
        clippy::expect_used,
        reason = "test code is allowed to use unwrap/expect for concise assertions"
    )]
    use super::*;

    #[test]
    fn plugin_builds_without_panicking() {
        let mut app = App::new();
        app.add_plugins(MorganLevelPlugin);
        // After plugin build, the app's `App` and `World` must remain
        // valid. We don't assert a specific entity count because Bevy
        // may reserve bookkeeping entities internally.
        let _ = app.world().entities();
    }

    #[test]
    fn plugin_is_default_and_copy() {
        // The plugin carries no state — it must implement both
        // `Default` and `Copy`. The body below constructs two
        // `Plugin` values through different paths, which only
        // compiles if both traits are satisfied.
        let first: MorganLevelPlugin = MorganLevelPlugin;
        let copy_value: MorganLevelPlugin = first; // Copy
        let defaulted: MorganLevelPlugin = MorganLevelPlugin; // unit = default
        let _ = (copy_value, defaulted);
    }
}
