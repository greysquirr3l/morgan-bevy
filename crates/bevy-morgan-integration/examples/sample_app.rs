//! Sample app demonstrating the integration with Bevy 0.19.
//!
//! Run with: `cargo run --example sample_app -p bevy-morgan-integration`
//!
//! This example uses the editor's JSON export shape and spawns the
//! corresponding entities in a Bevy `World`, then prints the spawn
//! counts so you can verify the round-trip.

use bevy_app::App;
use bevy_morgan_integration::{
    level_bounds, load_level_world, AssetServerLike, Collectible, Door, ExportedLevel,
    Interactable, MorganLevelPlugin, NavMeshHint, SpawnPoint, TriggerVolume,
};

fn main() {
    let mut app = App::new();
    app.add_plugins(MorganLevelPlugin);

    // The level lives in this example file as a JSON literal — the
    // shape matches what `LevelExporter::export_json` produces.
    let json = include_str!("../assets/sample_level.json");
    let level: ExportedLevel = match serde_json::from_str(json) {
        Ok(l) => l,
        Err(err) => {
            eprintln!("failed to parse level: {err}");
            std::process::exit(1);
        }
    };

    let (min, max) = level_bounds(&level);
    println!(
        "Loading level {:?} (bounds: {min:?} -> {max:?})",
        level.name
    );

    // The sample app doesn't have an `AssetServer`, so we wire a
    // no-op asset server stand-in. The companion crate's
    // `load_level_world` is asset-server agnostic — the spawn point
    // itself doesn't need the renderer, but the consumer's project
    // does (for `Mesh3d`).
    let ids = load_level_world(app.world_mut(), &NullAssetServer, &level);

    println!("Spawned {} entities", ids.len());

    let world = app.world_mut();
    let spawn_count = world.query::<&SpawnPoint>().iter(world).count();
    let trigger_count = world.query::<&TriggerVolume>().iter(world).count();
    let door_count = world.query::<&Door>().iter(world).count();
    let interactable_count = world.query::<&Interactable>().iter(world).count();
    let collectible_count = world.query::<&Collectible>().iter(world).count();
    let nav_mesh_count = world.query::<&NavMeshHint>().iter(world).count();

    println!("SpawnPoint markers:    {spawn_count}");
    println!("TriggerVolume markers: {trigger_count}");
    println!("Door markers:          {door_count}");
    println!("Interactable markers:  {interactable_count}");
    println!("Collectible markers:   {collectible_count}");
    println!("NavMeshHint markers:   {nav_mesh_count}");
}

/// No-op asset server stand-in. The marker components don't need real
/// assets — the sample app's point is to verify the count, not to
/// render anything.
struct NullAssetServer;

impl AssetServerLike for NullAssetServer {}
