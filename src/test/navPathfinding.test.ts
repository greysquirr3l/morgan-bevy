/**
 * T57 — `findPath` (pure A* over a `NavMesh`'s polygon connectivity
 * graph).
 *
 * The two-polygon-plus-doorway fixture mirrors the Rust
 * `wall_bisecting_floor_with_doorway_produces_two_polygons_and_one_connection`
 * test in `src-tauri/src/spatial/navmesh.rs` exactly (10x10 floor,
 * wall x:[0,8] z:[4.5,5.5], doorway gap x:[8,10]) so the fixture is a
 * faithful stand-in for what `generate_navmesh` would actually
 * produce, without needing a Tauri round trip in a vitest run.
 */
import { describe, expect, it } from 'vitest'

import { findPath, locatePolygon } from '@/utils/navPathfinding'
import type { NavMesh } from '@/types/schemas'

/**
 * South polygon: z in [0, 4.5]. North polygon: z in [5.5, 10]. Wall
 * band z in [4.5, 5.5], doorway gap x in [8, 10] (portal at
 * x:[8,10], z=5, matching `x_gap`'s "flush_left" branch in the Rust
 * source: the wall is flush with the west edge, so the gap is
 * `(wall.x1, region.x1)` = `(8, 10)`).
 */
function wallWithDoorwayNavMesh(): NavMesh {
  return {
    vertices: [
      // South polygon (id 0): [0,0,0] [10,0,0] [10,0,4.5] [0,0,4.5]
      [0, 0, 0],
      [10, 0, 0],
      [10, 0, 4.5],
      [0, 0, 4.5],
      // North polygon (id 1): [0,0,5.5] [10,0,5.5] [10,0,10] [0,0,10]
      [0, 0, 5.5],
      [10, 0, 5.5],
      [10, 0, 10],
      [0, 0, 10],
    ],
    polygons: [
      { id: 0, vertex_indices: [0, 1, 2, 3], triangle_indices: [0, 1, 2, 0, 2, 3] },
      { id: 1, vertex_indices: [4, 5, 6, 7], triangle_indices: [4, 5, 6, 4, 6, 7] },
    ],
    obstacles: [],
    connections: [
      {
        polygon_a: 0,
        polygon_b: 1,
        portal: [
          [8, 0, 5],
          [10, 0, 5],
        ],
      },
    ],
    off_mesh_connections: [],
  }
}

/** Two polygons with NO connection between them — the "no path
 *  exists" edge case. */
function disconnectedNavMesh(): NavMesh {
  const mesh = wallWithDoorwayNavMesh()
  return { ...mesh, connections: [] }
}

describe('T57 findPath', () => {
  it('returns null for an empty navmesh', () => {
    const empty: NavMesh = {
      vertices: [],
      polygons: [],
      obstacles: [],
      connections: [],
      off_mesh_connections: [],
    }
    expect(findPath(empty, [0, 0, 0], [1, 0, 1])).toBeNull()
  })

  it('returns a direct two-point path when start and end share a polygon', () => {
    const mesh = wallWithDoorwayNavMesh()
    const start: [number, number, number] = [1, 0, 1]
    const end: [number, number, number] = [8, 0, 2]
    const path = findPath(mesh, start, end)
    expect(path).toEqual([start, end])
  })

  it('finds a path between two distant waypoints that routes through the doorway, not the wall', () => {
    const mesh = wallWithDoorwayNavMesh()
    // A is well inside the south polygon; B is well inside the
    // north polygon, on the opposite (west) side from the doorway —
    // a naive straight line from A to B would cut straight through
    // the solid part of the wall (x < 8).
    const a: [number, number, number] = [2, 0, 2]
    const b: [number, number, number] = [2, 0, 8]

    const path = findPath(mesh, a, b)
    expect(path).not.toBeNull()
    if (!path) return

    // Must detour through the portal midpoint (9, 0, 5), not go
    // straight from A to B.
    expect(path).toHaveLength(3)
    expect(path[0]).toEqual(a)
    expect(path[2]).toEqual(b)
    const portalPoint = path[1]
    expect(portalPoint).toBeDefined()
    if (!portalPoint) return
    expect(portalPoint[0]).toBeCloseTo(9)
    expect(portalPoint[2]).toBeCloseTo(5)
    // The doorway gap is x in [8, 10] — the portal point must fall
    // within the gap, not within the solid wall span (x < 8).
    expect(portalPoint[0]).toBeGreaterThanOrEqual(8)
  })

  it('returns null when no path exists between disconnected polygons', () => {
    const mesh = disconnectedNavMesh()
    const a: [number, number, number] = [2, 0, 2]
    const b: [number, number, number] = [2, 0, 8]
    expect(findPath(mesh, a, b)).toBeNull()
  })

  it('locatePolygon finds the nearest polygon when the point falls outside every AABB', () => {
    const mesh = wallWithDoorwayNavMesh()
    // z=5 falls inside the wall band (between the two polygons, in
    // neither AABB) — should resolve to the nearer polygon.
    const polygon = locatePolygon(mesh, [2, 0, 4.6])
    expect(polygon).not.toBeNull()
    expect(polygon?.id).toBe(0)
  })
})
