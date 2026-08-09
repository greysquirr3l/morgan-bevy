/**
 * T57 — waypoint / patrol-route viewport geometry builders.
 *
 * There's no headless-WebGL harness in this repo to screenshot the
 * viewport (see `NavMeshOverlay` / `PaintToolViewport`'s test files,
 * which have the same constraint), so "paths render as a polyline
 * along the navmesh" is verified structurally here: every point in
 * a built path lies within the navmesh's polygon bounds (never
 * outside the walkable footprint / inside a wall's solid span).
 */
import { describe, expect, it } from 'vitest'

import { PatrolRouteId, WaypointId } from '@/types/brand'
import type { NavMesh } from '@/types/schemas'
import type { PatrolRoute, Waypoint } from '@/types/waypoints'
import {
  allPatrolRoutePathPositions,
  patrolRoutePathPositions,
  waypointSpherePositions,
} from '@/utils/waypointGeometry'

function wallWithDoorwayNavMesh(): NavMesh {
  return {
    vertices: [
      [0, 0, 0],
      [10, 0, 0],
      [10, 0, 4.5],
      [0, 0, 4.5],
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

function wp(id: string, position: [number, number, number]): Waypoint {
  return { id: WaypointId(id), position }
}

describe('T57 waypointSpherePositions', () => {
  it('flattens each waypoint position into a stride-3 Float32Array', () => {
    const waypoints = [wp('a', [1, 2, 3]), wp('b', [4, 5, 6])]
    const positions = waypointSpherePositions(waypoints)
    expect(Array.from(positions)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('returns an empty array for no waypoints', () => {
    expect(waypointSpherePositions([]).length).toBe(0)
  })
})

describe('T57 patrolRoutePathPositions', () => {
  const waypoints = [wp('a', [2, 0, 2]), wp('b', [2, 0, 8])]

  it('routes a two-waypoint loop through the navmesh doorway, not straight through the wall', () => {
    const route: PatrolRoute = {
      id: PatrolRouteId('r1'),
      waypointIds: [WaypointId('a'), WaypointId('b')],
      mode: 'loop',
    }
    const navMesh = wallWithDoorwayNavMesh()
    const positions = patrolRoutePathPositions(waypoints, route, navMesh)

    // loop mode draws the wrap edge too (b -> a), so with 2
    // waypoints that's 2 logical edges, each routed through the
    // doorway (3-point path = 2 segments = 4 vec3 = 12 floats) ->
    // 24 floats total.
    expect(positions.length).toBe(24)

    // Every point (each triple) must lie within one of the two
    // navmesh polygons' XZ bounds — i.e. on the walkable footprint,
    // never inside the solid wall span (x < 8 at z in [4.5, 5.5]).
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const z = positions[i + 2]
      expect(x).toBeDefined()
      expect(z).toBeDefined()
      if (x === undefined || z === undefined) continue
      const inSouth = x >= 0 && x <= 10 && z >= 0 && z <= 4.5
      const inNorth = x >= 0 && x <= 10 && z >= 5.5 && z <= 10
      const inDoorway = z === 5 && x >= 8 && x <= 10
      expect(inSouth || inNorth || inDoorway).toBe(true)
    }
  })

  it('falls back to a straight line when no navmesh is available', () => {
    const route: PatrolRoute = {
      id: PatrolRouteId('r1'),
      waypointIds: [WaypointId('a'), WaypointId('b')],
      mode: 'ping-pong',
    }
    const positions = patrolRoutePathPositions(waypoints, route, null)
    // ping-pong (non-loop): 1 edge, straight line = 1 segment = 6 floats.
    expect(Array.from(positions)).toEqual([2, 0, 2, 2, 0, 8])
  })

  it('skips edges referencing an unknown waypoint id rather than throwing', () => {
    const route: PatrolRoute = {
      id: PatrolRouteId('r1'),
      waypointIds: [WaypointId('a'), WaypointId('missing')],
      mode: 'ping-pong',
    }
    expect(() => patrolRoutePathPositions(waypoints, route, null)).not.toThrow()
    expect(patrolRoutePathPositions(waypoints, route, null).length).toBe(0)
  })
})

describe('T57 allPatrolRoutePathPositions', () => {
  it('combines multiple routes into one buffer', () => {
    const waypoints = [wp('a', [0, 0, 0]), wp('b', [1, 0, 0]), wp('c', [2, 0, 0])]
    const routes: PatrolRoute[] = [
      { id: PatrolRouteId('r1'), waypointIds: [WaypointId('a'), WaypointId('b')], mode: 'random' },
      { id: PatrolRouteId('r2'), waypointIds: [WaypointId('b'), WaypointId('c')], mode: 'random' },
    ]
    const positions = allPatrolRoutePathPositions(waypoints, routes, null)
    // Two 1-edge straight-line routes, no navmesh -> 2 * 6 floats.
    expect(positions.length).toBe(12)
  })

  it('returns an empty buffer for no routes', () => {
    expect(allPatrolRoutePathPositions([], [], null).length).toBe(0)
  })
})
