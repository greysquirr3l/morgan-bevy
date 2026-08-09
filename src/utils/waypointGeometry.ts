// T57 — Pure geometry builders for the waypoint / patrol-route
// viewport overlay. Kept separate from the R3F component
// (`WaypointViewport.tsx`) so the waypoint-position -> sphere/line
// math is unit-testable without a WebGL context — mirrors how
// `src/utils/navmeshGeometry.ts` (T56) keeps its math independent of
// `NavMeshOverlay`.

import { findPath } from '@/utils/navPathfinding'
import type { NavMesh } from '@/types/schemas'
import type { PatrolRoute, Waypoint } from '@/types/waypoints'
import type { WaypointId } from '@/types/brand'

/**
 * Flatten every waypoint's position into a `Float32Array` suitable
 * for an instanced/point sphere renderer (stride 3).
 */
export function waypointSpherePositions(waypoints: readonly Waypoint[]): Float32Array {
  const positions = new Float32Array(waypoints.length * 3)
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i]
    if (!wp) continue
    positions[i * 3] = wp.position[0]
    positions[i * 3 + 1] = wp.position[1]
    positions[i * 3 + 2] = wp.position[2]
  }
  return positions
}

/**
 * Build the ordered pairs of consecutive waypoint ids a route
 * traverses, for path-rendering purposes. `loop` includes the
 * wrap-around edge (last -> first); `ping-pong` and `random` do not
 * emit a synthetic wrap edge — `ping-pong` retraces the same forward
 * edges in reverse (no new edge to draw), and `random` has no fixed
 * edge set to visualize ahead of time.
 */
function routeEdges(route: PatrolRoute): Array<[WaypointId, WaypointId]> {
  const ids = route.waypointIds
  const edges: Array<[WaypointId, WaypointId]> = []
  for (let i = 0; i < ids.length - 1; i++) {
    const a = ids[i]
    const b = ids[i + 1]
    if (a && b) edges.push([a, b])
  }
  if (route.mode === 'loop' && ids.length > 1) {
    const first = ids[0]
    const last = ids[ids.length - 1]
    if (first && last) edges.push([last, first])
  }
  return edges
}

/**
 * Flatten a single patrol route's path into line-segment positions
 * (stride 3, pairs of endpoints), suitable for a `THREE.LineSegments`
 * geometry — same shape as `navMeshConnectionPositions` in
 * `navmeshGeometry.ts`.
 *
 * When `navMesh` is available, each consecutive waypoint pair is
 * routed via `findPath` (A* across the navmesh's polygon graph, T57)
 * so the rendered line follows doorways rather than cutting through
 * walls. When `navMesh` is `null`, or `findPath` can't find a route
 * (e.g. the pair sits on disconnected navmesh islands), this falls
 * back to a straight line between the two waypoints — a reasonable
 * "path not yet computed" indicator rather than silently dropping
 * the segment.
 */
export function patrolRoutePathPositions(
  waypoints: readonly Waypoint[],
  route: PatrolRoute,
  navMesh: NavMesh | null
): Float32Array {
  const byId = new Map(waypoints.map(w => [w.id, w]))
  const positions: number[] = []

  for (const [aId, bId] of routeEdges(route)) {
    const a = byId.get(aId)
    const b = byId.get(bId)
    if (!a || !b) continue

    const path = navMesh ? findPath(navMesh, a.position, b.position) : null
    const points = path ?? [a.position, b.position]

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      if (!p0 || !p1) continue
      positions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2])
    }
  }

  return new Float32Array(positions)
}

/**
 * Flatten every patrol route's path into one combined line-segment
 * buffer, for a single `<lineSegments>` draw call in the viewport.
 */
export function allPatrolRoutePathPositions(
  waypoints: readonly Waypoint[],
  patrolRoutes: readonly PatrolRoute[],
  navMesh: NavMesh | null
): Float32Array {
  const chunks = patrolRoutes.map(route => patrolRoutePathPositions(waypoints, route, navMesh))
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const combined = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.length
  }
  return combined
}
