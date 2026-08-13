//! Navigation mesh generation (T56).
//!
//! Given a level's walkable surfaces (floors) and obstacles (walls /
//! free-standing props), [`generate_navmesh`] produces a
//! [`NavMesh`]: a shared vertex pool, a set of walkable
//! [`NavPolygon`]s, the [`NavObstacle`]s that were subtracted from
//! the walkable footprint, and a connectivity graph of
//! [`NavConnection`]s ("doorways") between adjacent polygons.
//!
//! # Algorithm: 2D rectangle partitioning
//!
//! The task brief offers two options: voxel-based recast-style
//! decomposition, or a simpler 2D polygon approach "given the
//! domain-purity + determinism constraints." This module implements
//! the latter:
//!
//! 1. Union the bounding rectangle of every [`WalkableSurface`] in
//!    the XZ plane into a single "floor" rectangle (v1 assumes one
//!    contiguous floor -- see "Deferred scope" below).
//! 2. Walk the [`Obstacle`] list. Each obstacle is either:
//!    - [`ObstacleKind::FreeStanding`] -- subtracted from the
//!      walkable footprint as a hole (recorded in
//!      [`NavMesh::obstacles`]) without splitting the containing
//!      polygon (e.g. a pillar or crate).
//!    - [`ObstacleKind::Wall`] -- if the wall's thin axis is
//!      strictly interior to the region it overlaps (i.e. it has
//!      floor on both sides), it **partitions** that region into two
//!      new regions along the wall's band. If the wall doesn't fully
//!      span the region's cross-axis, the uncovered interval is a
//!      doorway gap and a [`NavConnection`] ("portal") is recorded
//!      between the two resulting polygons. A wall that doesn't
//!      qualify as a partition (e.g. it only touches the region on
//!      one axis) falls back to being recorded as a hole, same as a
//!      free-standing obstacle.
//! 3. Every surviving region becomes one [`NavPolygon`]: a
//!    CCW-wound rectangle (4 vertices, 2 triangles), sharing the
//!    module-wide [`NavMesh::vertices`] pool.
//!
//! This is deterministic (no RNG, no wall-clock reads), pure (no
//! I/O), and proportionate to the domain: BSP/WFC-authored levels
//! and hand-placed rooms are axis-aligned rectangles connected by
//! rectangular doorways, which this algorithm models directly
//! without the added complexity of voxelization, navmesh cell
//! merging, or Delaunay triangulation that a recast-style pipeline
//! would need.
//!
//! # Deferred scope
//!
//! - **Off-mesh connections** (jumps, ladders, teleports): the
//!   [`OffMeshConnection`] type exists and is fully serialised/
//!   exported so downstream consumers (T57's A* pathing) have a
//!   stable contract, but [`generate_navmesh`] never populates it --
//!   there is no authoring input (jump/ladder markers) on
//!   `GameObject` yet. A future task can populate this list once
//!   such markers exist.
//! - **Disjoint floor islands**: [`generate_navmesh`] unions the
//!   bounding box of every [`WalkableSurface`], which is exact for a
//!   single contiguous floor (the common case for BSP/WFC-generated
//!   levels and hand-placed rooms) but overestimates walkable area
//!   for genuinely disjoint floor islands (e.g. two separate
//!   buildings with a gap between them and no surface covering the
//!   gap). Voxel/grid-based decomposition would handle this
//!   precisely but is out of the scope the task brief asked for.
//! - **Non-axis-aligned geometry**: v1 only supports axis-aligned
//!   rectangular surfaces and obstacles, matching the tile-grid
//!   authoring model (T26).
//! - **Multi-gap walls**: when a `Wall` obstacle is interior to a
//!   region on both sides along its span axis (two potential
//!   doorway gaps, one on each end), v1 records only the larger gap
//!   as the doorway connection. Author two separate wall segments
//!   (each flush with one region edge) to get two independent
//!   doorways.
//! - **Ambiguous wall orientation**: when a `Wall` obstacle is
//!   interior on *both* the X and Z axes of the region it overlaps
//!   (it doesn't touch any of the region's four edges), v1
//!   deterministically prefers a Z-axis (north/south) split. Author
//!   `ObstacleKind::FreeStanding` for isolated obstacles that should
//!   not partition the region at all (e.g. a pillar).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// A rectangular walkable surface in the XZ (horizontal) plane,
/// e.g. a floor tile or room extent. `min`/`max` are `[x, z]`
/// world-space corners; `height` is the Y-elevation of the walkable
/// plane's top surface.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct WalkableSurface {
    pub min: [f32; 2],
    pub max: [f32; 2],
    pub height: f32,
}

/// Whether an [`Obstacle`] acts as a partition wall (splitting the
/// walkable region it crosses into two polygons, connected by a
/// doorway wherever a gap remains) or a free-standing hole (a
/// pillar, crate, etc: subtracted from the walkable footprint but
/// does not split the containing polygon).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObstacleKind {
    Wall,
    FreeStanding,
}

/// A rectangular obstacle in the XZ plane. `min`/`max` are `[x, z]`
/// world-space corners.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Obstacle {
    pub min: [f32; 2],
    pub max: [f32; 2],
    pub kind: ObstacleKind,
}

/// One walkable polygon in the navmesh. `vertex_indices` is the CCW
/// boundary loop (indices into [`NavMesh::vertices`]); `triangle_indices`
/// is a flattened triangle list (length a multiple of 3, also
/// indices into [`NavMesh::vertices`]) for renderers/physics engines
/// that need triangles rather than the boundary loop.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NavPolygon {
    pub id: u32,
    pub vertex_indices: Vec<u32>,
    pub triangle_indices: Vec<u32>,
}

/// An obstacle that was subtracted from the walkable footprint.
/// Recorded for visualisation / downstream collision purposes; does
/// not reference the vertex pool.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct NavObstacle {
    pub min: [f32; 3],
    pub max: [f32; 3],
}

/// A connection ("doorway" / portal) between two [`NavPolygon`]s,
/// identified by their `id`. `portal` is the world-space line
/// segment (two endpoints) marking where the two polygons connect --
/// useful as an edge in a future A* graph over `polygons` (T57).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct NavConnection {
    pub polygon_a: u32,
    pub polygon_b: u32,
    pub portal: [[f32; 3]; 2],
}

/// The kind of off-mesh connection. v1 ships the type (see module
/// docs "Deferred scope") but `generate_navmesh` never constructs
/// one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OffMeshConnectionKind {
    Jump,
    Ladder,
    Teleport,
}

/// A point-to-point connection that isn't a shared polygon edge --
/// e.g. a jump gap or a ladder. Deferred for v1; see module docs.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct OffMeshConnection {
    pub start: [f32; 3],
    pub end: [f32; 3],
    pub kind: OffMeshConnectionKind,
    pub bidirectional: bool,
}

/// The generated navigation mesh: plain vertex / triangle / edge
/// data, serializable via serde with no dependency on a specific
/// navmesh crate's internal types -- consumable by `Rapier3D` (via
/// `vertices` + `triangle_indices`) or `bevy_navigation` (via
/// `polygons` + `connections`) alike.
///
/// `Eq` is intentionally omitted: the f32 fields don't implement
/// `Eq`. `PartialEq` is sufficient for serde round-trip and tests.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NavMesh {
    pub vertices: Vec<[f32; 3]>,
    pub polygons: Vec<NavPolygon>,
    pub obstacles: Vec<NavObstacle>,
    pub connections: Vec<NavConnection>,
    pub off_mesh_connections: Vec<OffMeshConnection>,
}

/// Errors produced by [`generate_navmesh`].
#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum NavMeshError {
    #[error("no walkable surfaces provided")]
    NoWalkableSurfaces,
    #[error("degenerate floor extent (zero or negative area)")]
    DegenerateFloor,
}

/// Numerical tolerance for "touches the region edge" comparisons.
/// Authored geometry from the tile grid (T26) is on whole-unit
/// boundaries, so this only needs to absorb float round-off.
const EPS: f32 = 1e-4;

/// An axis-aligned rectangle in the XZ plane. Internal to the
/// partitioning algorithm.
#[derive(Debug, Clone, Copy, PartialEq)]
struct Rect2 {
    x0: f32,
    z0: f32,
    x1: f32,
    z1: f32,
}

impl Rect2 {
    fn width(self) -> f32 {
        self.x1 - self.x0
    }

    fn depth(self) -> f32 {
        self.z1 - self.z0
    }

    fn area(self) -> f32 {
        self.width().max(0.0) * self.depth().max(0.0)
    }

    const fn union(self, other: Self) -> Self {
        Self {
            x0: self.x0.min(other.x0),
            z0: self.z0.min(other.z0),
            x1: self.x1.max(other.x1),
            z1: self.z1.max(other.z1),
        }
    }

    fn overlaps(self, other: Self) -> bool {
        self.x0 < other.x1 && self.x1 > other.x0 && self.z0 < other.z1 && self.z1 > other.z0
    }

    const fn from_min_max(min: [f32; 2], max: [f32; 2]) -> Self {
        Self {
            x0: min[0],
            z0: min[1],
            x1: max[0],
            z1: max[1],
        }
    }
}

/// A live or retired walkable region during partitioning. Regions
/// are never removed from the `Vec` (which would shift indices);
/// instead `alive` is flipped to `false` when a region is split, and
/// the two child regions are pushed at the end. This keeps every
/// slot index stable for the lifetime of the algorithm, so
/// `PendingConnection` can reference slot indices safely.
struct RegionSlot {
    rect: Rect2,
    alive: bool,
}

/// Which axis the doorway gap interval runs along.
enum PortalAxis {
    /// Gap interval is an X range (the wall was a Z-band, splitting
    /// the region into "south"/"north" halves).
    AlongX,
    /// Gap interval is a Z range (the wall was an X-band, splitting
    /// the region into "west"/"east" halves).
    AlongZ,
}

/// A doorway connection discovered while partitioning, referencing
/// stable `RegionSlot` indices (resolved to `NavPolygon` ids once
/// every surviving region has been emitted).
struct PendingConnection {
    a_slot: usize,
    b_slot: usize,
    gap: (f32, f32),
    portal_axis: PortalAxis,
    /// The wall band's midline coordinate (z for a Z-band wall, x
    /// for an X-band wall) -- used as the portal segment's constant
    /// coordinate.
    band_mid: f32,
}

/// The result of successfully partitioning a region across a wall.
struct Split {
    a: Rect2,
    b: Rect2,
    gap: Option<(f32, f32)>,
    portal_axis: PortalAxis,
    band_mid: f32,
}

/// Generate a navigation mesh from a level's walkable surfaces and
/// obstacles. Pure and deterministic: the same inputs always produce
/// the same output, with no wall-clock reads or randomness.
///
/// # Errors
///
/// Returns [`NavMeshError::NoWalkableSurfaces`] if `surfaces` is
/// empty, or [`NavMeshError::DegenerateFloor`] if the union of every
/// surface's extent has zero or negative area.
pub fn generate_navmesh(
    surfaces: &[WalkableSurface],
    obstacles: &[Obstacle],
) -> Result<NavMesh, NavMeshError> {
    let Some(first) = surfaces.first() else {
        return Err(NavMeshError::NoWalkableSurfaces);
    };
    let height = first.height;

    let mut floor = Rect2::from_min_max(first.min, first.max);
    for surface in surfaces.iter().skip(1) {
        floor = floor.union(Rect2::from_min_max(surface.min, surface.max));
    }

    if floor.area() <= 0.0 {
        return Err(NavMeshError::DegenerateFloor);
    }

    let mut regions: Vec<RegionSlot> = vec![RegionSlot {
        rect: floor,
        alive: true,
    }];
    let mut pending_connections: Vec<PendingConnection> = Vec::new();
    let mut nav_obstacles: Vec<NavObstacle> = Vec::new();

    for obstacle in obstacles {
        let o_rect = Rect2::from_min_max(obstacle.min, obstacle.max);

        // Find the first alive region this obstacle overlaps. v1
        // assumes an obstacle overlaps at most one region at a time
        // (true for the wall-splits-a-single-room case this
        // algorithm targets); an obstacle spanning multiple already-
        // split regions is recorded as a hole against the first
        // match rather than attempting a multi-region split.
        let mut target: Option<(usize, Rect2)> = None;
        for (slot_idx, slot) in regions.iter().enumerate() {
            if slot.alive && slot.rect.overlaps(o_rect) {
                target = Some((slot_idx, slot.rect));
                break;
            }
        }

        let Some((slot_idx, region_rect)) = target else {
            // Doesn't overlap any walkable region; still record it
            // for export/visualisation completeness.
            nav_obstacles.push(to_nav_obstacle(o_rect, height));
            continue;
        };

        if obstacle.kind == ObstacleKind::FreeStanding {
            nav_obstacles.push(to_nav_obstacle(o_rect, height));
            continue;
        }

        if let Some(split) = try_partition(region_rect, o_rect) {
            if let Some(slot) = regions.get_mut(slot_idx) {
                slot.alive = false;
            }
            let a_slot = regions.len();
            regions.push(RegionSlot {
                rect: split.a,
                alive: true,
            });
            let b_slot = regions.len();
            regions.push(RegionSlot {
                rect: split.b,
                alive: true,
            });
            if let Some(gap) = split.gap {
                pending_connections.push(PendingConnection {
                    a_slot,
                    b_slot,
                    gap,
                    portal_axis: split.portal_axis,
                    band_mid: split.band_mid,
                });
            }
        } else {
            // Wall doesn't qualify as a partition (e.g. only
            // touches the region on one axis) -- fall back to
            // recording it as a hole, same as a free-standing
            // obstacle.
            nav_obstacles.push(to_nav_obstacle(o_rect, height));
        }
    }

    let mut vertices: Vec<[f32; 3]> = Vec::new();
    let mut polygons: Vec<NavPolygon> = Vec::new();
    let mut slot_to_polygon: HashMap<usize, u32> = HashMap::new();

    for (slot_idx, slot) in regions.iter().enumerate() {
        if !slot.alive {
            continue;
        }
        let poly_id = u32::try_from(polygons.len()).unwrap_or(u32::MAX);
        let base = u32::try_from(vertices.len()).unwrap_or(u32::MAX);
        let r = slot.rect;
        // CCW winding viewed from +Y looking down, matching the
        // Y-up convention used throughout the editor (Transform3D).
        vertices.push([r.x0, height, r.z0]);
        vertices.push([r.x1, height, r.z0]);
        vertices.push([r.x1, height, r.z1]);
        vertices.push([r.x0, height, r.z1]);
        polygons.push(NavPolygon {
            id: poly_id,
            vertex_indices: vec![base, base + 1, base + 2, base + 3],
            triangle_indices: vec![base, base + 1, base + 2, base, base + 2, base + 3],
        });
        slot_to_polygon.insert(slot_idx, poly_id);
    }

    let mut connections: Vec<NavConnection> = Vec::new();
    for pending in pending_connections {
        let (Some(&polygon_a), Some(&polygon_b)) = (
            slot_to_polygon.get(&pending.a_slot),
            slot_to_polygon.get(&pending.b_slot),
        ) else {
            // Both slots are always alive when a PendingConnection
            // is pushed, so this is unreachable in practice; skip
            // defensively rather than panicking.
            continue;
        };
        let portal = match pending.portal_axis {
            PortalAxis::AlongX => [
                [pending.gap.0, height, pending.band_mid],
                [pending.gap.1, height, pending.band_mid],
            ],
            PortalAxis::AlongZ => [
                [pending.band_mid, height, pending.gap.0],
                [pending.band_mid, height, pending.gap.1],
            ],
        };
        connections.push(NavConnection {
            polygon_a,
            polygon_b,
            portal,
        });
    }

    Ok(NavMesh {
        vertices,
        polygons,
        obstacles: nav_obstacles,
        connections,
        off_mesh_connections: Vec::new(),
    })
}

const fn to_nav_obstacle(rect: Rect2, height: f32) -> NavObstacle {
    NavObstacle {
        min: [rect.x0, height, rect.z0],
        max: [rect.x1, height, rect.z1],
    }
}

/// Attempt to partition `region` across `wall`. Returns `None` if
/// the wall isn't interior to the region along either axis (doesn't
/// have floor on both sides), in which case the caller treats it as
/// a non-partitioning hole.
fn try_partition(region: Rect2, wall: Rect2) -> Option<Split> {
    // Z-band partition: the wall's Z-range is strictly interior to
    // the region (floor above and below) and it overlaps the
    // region's X range at all.
    let z_interior = wall.z0 > region.z0 + EPS && wall.z1 < region.z1 - EPS;
    let x_overlaps = wall.x1 > region.x0 && wall.x0 < region.x1;
    if z_interior && x_overlaps {
        let south = Rect2 {
            x0: region.x0,
            z0: region.z0,
            x1: region.x1,
            z1: wall.z0,
        };
        let north = Rect2 {
            x0: region.x0,
            z0: wall.z1,
            x1: region.x1,
            z1: region.z1,
        };
        return Some(Split {
            a: south,
            b: north,
            gap: x_gap(region, wall),
            portal_axis: PortalAxis::AlongX,
            band_mid: midpoint(wall.z0, wall.z1),
        });
    }

    // X-band partition: mirror of the above, splitting into
    // "west"/"east" halves.
    let x_interior = wall.x0 > region.x0 + EPS && wall.x1 < region.x1 - EPS;
    let z_overlaps = wall.z1 > region.z0 && wall.z0 < region.z1;
    if x_interior && z_overlaps {
        let west = Rect2 {
            x0: region.x0,
            z0: region.z0,
            x1: wall.x0,
            z1: region.z1,
        };
        let east = Rect2 {
            x0: wall.x1,
            z0: region.z0,
            x1: region.x1,
            z1: region.z1,
        };
        return Some(Split {
            a: west,
            b: east,
            gap: z_gap(region, wall),
            portal_axis: PortalAxis::AlongZ,
            band_mid: midpoint(wall.x0, wall.x1),
        });
    }

    None
}

const fn midpoint(a: f32, b: f32) -> f32 {
    (a + b) * 0.5
}

/// The unblocked interval in `region`'s X-range not covered by
/// `wall`'s X-range (the doorway gap for a Z-band wall). `None` if
/// the wall's X-range fully spans the region (a solid wall, no
/// doorway).
fn x_gap(region: Rect2, wall: Rect2) -> Option<(f32, f32)> {
    let flush_left = wall.x0 <= region.x0 + EPS;
    let flush_right = wall.x1 >= region.x1 - EPS;
    if flush_left && flush_right {
        return None;
    }
    if flush_left {
        Some((wall.x1, region.x1))
    } else if flush_right {
        Some((region.x0, wall.x0))
    } else {
        // Wall touches neither edge: two candidate gaps. v1 records
        // only the larger one -- see module docs "Deferred scope:
        // multi-gap walls".
        let left_gap = wall.x0 - region.x0;
        let right_gap = region.x1 - wall.x1;
        if left_gap >= right_gap {
            Some((region.x0, wall.x0))
        } else {
            Some((wall.x1, region.x1))
        }
    }
}

/// Z-axis counterpart of [`x_gap`], for an X-band wall.
fn z_gap(region: Rect2, wall: Rect2) -> Option<(f32, f32)> {
    let flush_bottom = wall.z0 <= region.z0 + EPS;
    let flush_top = wall.z1 >= region.z1 - EPS;
    if flush_bottom && flush_top {
        return None;
    }
    if flush_bottom {
        Some((wall.z1, region.z1))
    } else if flush_top {
        Some((region.z0, wall.z0))
    } else {
        let bottom_gap = wall.z0 - region.z0;
        let top_gap = region.z1 - wall.z1;
        if bottom_gap >= top_gap {
            Some((region.z0, wall.z0))
        } else {
            Some((wall.z1, region.z1))
        }
    }
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

    fn floor_10x10() -> WalkableSurface {
        WalkableSurface {
            min: [0.0, 0.0],
            max: [10.0, 10.0],
            height: 0.0,
        }
    }

    // ─── Required test 1 ────────────────────────────────────────────────

    #[test]
    fn floor_10x10_with_no_obstacles_produces_single_polygon() {
        let mesh = generate_navmesh(&[floor_10x10()], &[])
            .expect("generate_navmesh should succeed for a valid floor");

        assert_eq!(mesh.polygons.len(), 1, "expected exactly one polygon");
        assert!(
            mesh.obstacles.is_empty(),
            "expected no obstacles; got {:?}",
            mesh.obstacles
        );
        assert!(
            mesh.connections.is_empty(),
            "expected no connections with a single unobstructed floor"
        );
        assert_eq!(mesh.vertices.len(), 4, "a single rectangle has 4 corners");
        assert_eq!(mesh.polygons[0].triangle_indices.len(), 6, "2 triangles");
    }

    // ─── Required test 2 ────────────────────────────────────────────────

    #[test]
    fn wall_bisecting_floor_with_doorway_produces_two_polygons_and_one_connection() {
        // Wall flush with the west edge (x: 0..8), leaving a 2-unit
        // gap on the east edge (x: 8..10) as the doorway. Thin in Z
        // (4.5..5.5), interior to the 10x10 floor.
        let wall = Obstacle {
            min: [0.0, 4.5],
            max: [8.0, 5.5],
            kind: ObstacleKind::Wall,
        };
        let mesh =
            generate_navmesh(&[floor_10x10()], &[wall]).expect("generate_navmesh should succeed");

        assert_eq!(mesh.polygons.len(), 2, "wall should split the floor in two");
        assert_eq!(
            mesh.connections.len(),
            1,
            "the doorway gap should produce exactly one connection"
        );
        assert!(
            mesh.obstacles.is_empty(),
            "wall becomes a split, not a hole"
        );

        let connection = &mesh.connections[0];
        assert_ne!(
            connection.polygon_a, connection.polygon_b,
            "a connection must join two distinct polygons"
        );
        let valid_ids: Vec<u32> = mesh.polygons.iter().map(|p| p.id).collect();
        assert!(valid_ids.contains(&connection.polygon_a));
        assert!(valid_ids.contains(&connection.polygon_b));

        // The portal's constant Z coordinate should sit inside the
        // wall's thickness band (4.5..5.5).
        let portal_z = connection.portal[0][2];
        assert!(
            (4.5..=5.5).contains(&portal_z),
            "portal z {portal_z} should fall within the wall band"
        );
    }

    // ─── Edge cases ─────────────────────────────────────────────────────

    #[test]
    fn wall_spanning_full_width_produces_two_polygons_and_no_connection() {
        // Wall spans the entire X range -- fully enclosed, no doorway.
        let wall = Obstacle {
            min: [0.0, 4.5],
            max: [10.0, 5.5],
            kind: ObstacleKind::Wall,
        };
        let mesh =
            generate_navmesh(&[floor_10x10()], &[wall]).expect("generate_navmesh should succeed");

        assert_eq!(mesh.polygons.len(), 2, "wall should still split the floor");
        assert!(
            mesh.connections.is_empty(),
            "a solid wall with no gap must produce zero connections"
        );
    }

    #[test]
    #[expect(
        clippy::float_cmp,
        reason = "exact literal values with no arithmetic in between; float equality is well-defined here"
    )]
    fn free_standing_obstacle_is_recorded_without_splitting_the_polygon() {
        let pillar = Obstacle {
            min: [4.0, 4.0],
            max: [5.0, 5.0],
            kind: ObstacleKind::FreeStanding,
        };
        let mesh =
            generate_navmesh(&[floor_10x10()], &[pillar]).expect("generate_navmesh should succeed");

        assert_eq!(
            mesh.polygons.len(),
            1,
            "a free-standing obstacle must not split the polygon"
        );
        assert_eq!(mesh.obstacles.len(), 1, "the pillar should be recorded");
        assert!(mesh.connections.is_empty());
        assert_eq!(mesh.obstacles[0].min, [4.0, 0.0, 4.0]);
        assert_eq!(mesh.obstacles[0].max, [5.0, 0.0, 5.0]);
    }

    #[test]
    fn empty_surfaces_returns_no_walkable_surfaces_error() {
        let result = generate_navmesh(&[], &[]);
        assert_eq!(result, Err(NavMeshError::NoWalkableSurfaces));
    }

    #[test]
    fn degenerate_floor_returns_degenerate_floor_error() {
        let degenerate = WalkableSurface {
            min: [0.0, 0.0],
            max: [0.0, 10.0], // zero width
            height: 0.0,
        };
        let result = generate_navmesh(&[degenerate], &[]);
        assert_eq!(result, Err(NavMeshError::DegenerateFloor));
    }

    #[test]
    fn multiple_walkable_surfaces_union_into_one_floor_extent() {
        // Two adjoining surfaces sharing an edge should union
        // cleanly into one polygon (v1 bounding-box union; see
        // module docs).
        let a = WalkableSurface {
            min: [0.0, 0.0],
            max: [5.0, 10.0],
            height: 0.0,
        };
        let b = WalkableSurface {
            min: [5.0, 0.0],
            max: [10.0, 10.0],
            height: 0.0,
        };
        let mesh = generate_navmesh(&[a, b], &[]).expect("generate_navmesh should succeed");
        assert_eq!(mesh.polygons.len(), 1);
    }

    #[test]
    fn off_mesh_connections_are_empty_by_default() {
        // Deferred scope: v1 never populates off-mesh connections,
        // but the field must exist and serialize.
        let mesh = generate_navmesh(&[floor_10x10()], &[]).expect("should succeed");
        assert!(mesh.off_mesh_connections.is_empty());
    }

    // ─── Serde round-trip ───────────────────────────────────────────────

    #[test]
    fn navmesh_round_trips_through_json() {
        let wall = Obstacle {
            min: [0.0, 4.5],
            max: [8.0, 5.5],
            kind: ObstacleKind::Wall,
        };
        let mesh = generate_navmesh(&[floor_10x10()], &[wall]).expect("should succeed");
        let json = serde_json::to_string(&mesh).expect("navmesh should serialize to JSON");
        let round_tripped: NavMesh =
            serde_json::from_str(&json).expect("navmesh should deserialize from JSON");
        assert_eq!(mesh, round_tripped);
        // Wire-format sanity check -- catches accidental field
        // renames that would silently break serde consumers
        // (Rapier3D / bevy_navigation deserializing this shape).
        assert!(json.contains("\"polygon_a\""));
        assert!(json.contains("\"portal\""));
    }

    #[test]
    fn obstacle_kind_serializes_as_snake_case_tag() {
        let wall = Obstacle {
            min: [0.0, 0.0],
            max: [1.0, 1.0],
            kind: ObstacleKind::Wall,
        };
        let json = serde_json::to_string(&wall).expect("obstacle should serialize");
        assert!(json.contains("\"wall\""), "got: {json}");

        let free = Obstacle {
            min: [0.0, 0.0],
            max: [1.0, 1.0],
            kind: ObstacleKind::FreeStanding,
        };
        let json = serde_json::to_string(&free).expect("obstacle should serialize");
        assert!(json.contains("\"free_standing\""), "got: {json}");
    }

    // ─── Performance budget (<200ms for a 48x36 floor plan) ────────────

    #[test]
    fn generation_completes_well_within_the_200ms_budget_for_a_48x36_floor() {
        let floor = WalkableSurface {
            min: [0.0, 0.0],
            max: [48.0, 36.0],
            height: 0.0,
        };
        // A generous number of interior walls -- far more than a
        // typical 48x36 floor plan would have -- to stress the
        // partitioning loop; each wall targets whichever region it
        // currently overlaps.
        let mut obstacles = Vec::new();
        for i in 1_u8..20 {
            let z = f32::from(i);
            obstacles.push(Obstacle {
                min: [0.0, z],
                max: [40.0, z + 0.2],
                kind: ObstacleKind::Wall,
            });
        }

        let start = std::time::Instant::now();
        let result = generate_navmesh(&[floor], &obstacles);
        let elapsed = start.elapsed();

        assert!(result.is_ok());
        assert!(
            elapsed.as_millis() < 200,
            "generation took {elapsed:?}, expected < 200ms"
        );
    }
}
