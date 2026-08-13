// Spatial data structures for 3D level editing
// This module provides efficient spatial queries and collision detection

use crate::Transform3D;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// T56: navigation mesh generation. Re-exported here so consumers
// (main.rs, export/exporters.rs) can use `spatial::NavMesh` etc.
// without reaching into the submodule path. `morgan-bevy` is a `bin`
// crate, so unused `pub use` re-exports are flagged as dead by rustc
// even though they're part of this module's intended public surface.
//
// T57 note: A* pathing over `NavMesh.polygons` is implemented in
// pure TypeScript (`src/utils/navPathfinding.ts`), not here -- the
// `NavMesh` is already client-side via `useNavMesh()`, so there's no
// need for a Rust round trip. The re-exports below that aren't
// consumed elsewhere in this crate exist for the public surface /
// potential future Rust-side consumers (e.g. a headless CLI
// exporter), not for T57 specifically.
pub mod navmesh;
#[expect(
    unused_imports,
    reason = "NavConnection/NavMeshError/NavObstacle/NavPolygon/Obstacle/ObstacleKind/OffMeshConnection/OffMeshConnectionKind/generate_navmesh are part of this module's public surface, not yet consumed outside spatial::navmesh itself; NavMesh is used today (main.rs / exporters.rs)"
)]
pub use navmesh::{
    generate_navmesh, NavConnection, NavMesh, NavMeshError, NavObstacle, NavPolygon, Obstacle,
    ObstacleKind, OffMeshConnection, OffMeshConnectionKind, WalkableSurface,
};

// T57: waypoint + patrol route data model (export-pipeline plumbing
// only -- see `waypoints` module doc for why no pathing logic lives
// here). `Waypoint` / `PatrolRoute` are used outside this module in
// both test and non-test code (main.rs's `LevelData`,
// export/exporters.rs's `BevyLevelData` + its tests), so re-exporting
// them here is unconditionally justified. `PatrolMode` is used only
// by tests, and only via `crate::spatial::waypoints::PatrolMode`
// (the submodule path directly) rather than through a top-level
// re-export -- avoids the `#[expect(unused_imports)]` foot-gun the
// navmesh re-exports below hit if a re-exported symbol's "used"
// status differs between the test and non-test compilation targets.
pub mod waypoints;
pub use waypoints::{PatrolRoute, Waypoint};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub min: [f32; 3],
    pub max: [f32; 3],
}

impl BoundingBox {
    pub const fn new(min: [f32; 3], max: [f32; 3]) -> Self {
        Self { min, max }
    }

    pub fn from_transform(transform: &Transform3D) -> Self {
        let pos = transform.position;
        let scale = transform.scale;
        let half_scale = [scale[0] * 0.5, scale[1] * 0.5, scale[2] * 0.5];

        Self {
            min: [
                pos[0] - half_scale[0],
                pos[1] - half_scale[1],
                pos[2] - half_scale[2],
            ],
            max: [
                pos[0] + half_scale[0],
                pos[1] + half_scale[1],
                pos[2] + half_scale[2],
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpatialIndex {
    objects: HashMap<String, BoundingBox>,
}

impl SpatialIndex {
    pub fn new() -> Self {
        Self {
            objects: HashMap::new(),
        }
    }

    pub fn insert(&mut self, object_id: &str, transform: &Transform3D) {
        let bounds = BoundingBox::from_transform(transform);
        self.objects.insert(object_id.to_string(), bounds);
    }

    pub fn update(&mut self, object_id: &str, transform: &Transform3D) {
        let bounds = BoundingBox::from_transform(transform);
        self.objects.insert(object_id.to_string(), bounds);
    }

    pub fn remove(&mut self, object_id: &str) {
        self.objects.remove(object_id);
    }

    pub fn clear(&mut self) {
        self.objects.clear();
    }

    pub fn query_bounds(&self, bounds: &BoundingBox) -> Vec<String> {
        let mut results = Vec::new();
        for (id, obj_bounds) in &self.objects {
            if bounds_intersect(bounds, obj_bounds) {
                results.push(id.clone());
            }
        }
        results
    }
}

fn bounds_intersect(a: &BoundingBox, b: &BoundingBox) -> bool {
    a.max[0] >= b.min[0]
        && a.min[0] <= b.max[0]
        && a.max[1] >= b.min[1]
        && a.min[1] <= b.max[1]
        && a.max[2] >= b.min[2]
        && a.min[2] <= b.max[2]
}

impl Default for SpatialIndex {
    fn default() -> Self {
        Self::new()
    }
}
