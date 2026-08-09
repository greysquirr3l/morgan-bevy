// T57 — A* pathfinding over a T56 `NavMesh`'s polygon connectivity
// graph.
//
// Pure TypeScript, operating on the `NavMesh` the frontend already
// holds via `useNavMesh()` (T56) — no Rust round trip. Precedent:
// T51/T52/T53 (snap points / surface snap / measurements) are all
// pure `src/utils/*.ts` math over already-client-side data with a
// hook wrapping interactive state; this module follows the same
// shape.
//
// Algorithm: nodes = `NavPolygon.id`, edges = `NavConnection`
// (the "doorway" between two adjacent polygons — see
// `src-tauri/src/spatial/navmesh.rs`'s module doc for how those are
// generated). Since a `NavConnection` only exists where two
// polygons share an actual doorway gap, a path that must pass
// through a solid wall (no gap => no connection => no edge in this
// graph) is structurally impossible to find — "avoiding a wall" is
// a property of the graph, not something this algorithm has to
// reason about explicitly.
//
// Edge weight / heuristic: Euclidean distance between polygon
// centroids. This is a valid, consistent A* heuristic in a metric
// space (straight-line distance to the goal centroid is always <=
// the sum of centroid-to-centroid hop distances along any path, by
// the triangle inequality), so A* here is guaranteed to find the
// shortest polygon-hop path by total centroid distance.
//
// Path reconstruction: v1 emits the portal MIDPOINT of each
// connection crossed, not a fully "funnel-algorithm" string-pulled
// path. This is a documented, legitimate v1 per the task brief
// ("a full funnel algorithm is a nice-to-have, not required... a
// portal-midpoint path is a legitimate v1"). It can zig-zag slightly
// near corners compared to a true shortest path, but it is always a
// valid walkable route (every point lies on a polygon boundary or
// interior) and never cuts through an obstacle.

import type { NavConnection, NavMesh, NavPolygon } from '@/types/schemas'

type Vec3 = [number, number, number]

function polygonVertexXZ(navMesh: NavMesh, polygon: NavPolygon): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  for (const idx of polygon.vertex_indices) {
    const v = navMesh.vertices[idx]
    if (!v) continue
    pts.push([v[0], v[2]])
  }
  return pts
}

function polygonAabbXZ(
  navMesh: NavMesh,
  polygon: NavPolygon
): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  const pts = polygonVertexXZ(navMesh, polygon)
  if (pts.length === 0) return null
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [x, z] of pts) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  return { minX, maxX, minZ, maxZ }
}

function polygonCentroid(navMesh: NavMesh, polygon: NavPolygon): Vec3 {
  let sx = 0
  let sy = 0
  let sz = 0
  let n = 0
  for (const idx of polygon.vertex_indices) {
    const v = navMesh.vertices[idx]
    if (!v) continue
    sx += v[0]
    sy += v[1]
    sz += v[2]
    n += 1
  }
  if (n === 0) return [0, 0, 0]
  return [sx / n, sy / n, sz / n]
}

function distance3(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Locate the `NavPolygon` containing `point` in the XZ plane
 * (navmesh v1 is axis-aligned rectangles in XZ, per
 * `spatial::navmesh` module docs — an AABB-in-XZ containment check
 * is exact for this shape). Falls back to the nearest polygon by
 * centroid distance if the point doesn't fall exactly inside any
 * polygon (e.g. a waypoint placed slightly off the floor due to
 * float rounding, or authored just outside the walkable footprint).
 * Returns `null` only when the navmesh has no polygons at all.
 */
export function locatePolygon(navMesh: NavMesh, point: Vec3): NavPolygon | null {
  const [x, , z] = point
  for (const polygon of navMesh.polygons) {
    const aabb = polygonAabbXZ(navMesh, polygon)
    if (!aabb) continue
    if (x >= aabb.minX && x <= aabb.maxX && z >= aabb.minZ && z <= aabb.maxZ) {
      return polygon
    }
  }
  if (navMesh.polygons.length === 0) return null
  let best: NavPolygon | null = null
  let bestDist = Infinity
  for (const polygon of navMesh.polygons) {
    const centroid = polygonCentroid(navMesh, polygon)
    const d = distance3(centroid, point)
    if (d < bestDist) {
      bestDist = d
      best = polygon
    }
  }
  return best
}

interface Edge {
  neighborId: number
  connection: NavConnection
}

function buildAdjacency(navMesh: NavMesh): Map<number, Edge[]> {
  const adjacency = new Map<number, Edge[]>()
  const addEdge = (from: number, to: number, connection: NavConnection) => {
    const existing = adjacency.get(from)
    if (existing) {
      existing.push({ neighborId: to, connection })
    } else {
      adjacency.set(from, [{ neighborId: to, connection }])
    }
  }
  for (const connection of navMesh.connections) {
    addEdge(connection.polygon_a, connection.polygon_b, connection)
    addEdge(connection.polygon_b, connection.polygon_a, connection)
  }
  return adjacency
}

function portalMidpoint(connection: NavConnection): Vec3 {
  const [a, b] = connection.portal
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
}

/**
 * Find a walkable path from `start` to `end` across `navMesh`'s
 * polygon connectivity graph via A*.
 *
 * Returns `null` when:
 * - the navmesh has no polygons,
 * - `start` or `end` cannot be located to any polygon, or
 * - no path exists between the two polygons (e.g. they're on
 *   disconnected "islands" with no `NavConnection` chain between
 *   them — this is the "no path exists" edge case).
 *
 * Returns `[start, end]` directly when both points resolve to the
 * same polygon (no doorway crossing needed).
 */
export function findPath(navMesh: NavMesh, start: Vec3, end: Vec3): Vec3[] | null {
  const startPolygon = locatePolygon(navMesh, start)
  const endPolygon = locatePolygon(navMesh, end)
  if (!startPolygon || !endPolygon) return null
  if (startPolygon.id === endPolygon.id) return [start, end]

  const adjacency = buildAdjacency(navMesh)
  const polygonById = new Map(navMesh.polygons.map(p => [p.id, p]))
  const centroidById = new Map(navMesh.polygons.map(p => [p.id, polygonCentroid(navMesh, p)]))
  const endCentroid = centroidById.get(endPolygon.id)
  if (!endCentroid) return null

  const heuristic = (polygonId: number): number => {
    const c = centroidById.get(polygonId)
    return c ? distance3(c, endCentroid) : Infinity
  }

  // Standard A* over polygon ids. `cameFrom` also records the
  // `NavConnection` crossed to reach each polygon, so the final path
  // can be reconstructed as portal midpoints without a second lookup
  // pass.
  const gScore = new Map<number, number>([[startPolygon.id, 0]])
  const fScore = new Map<number, number>([[startPolygon.id, heuristic(startPolygon.id)]])
  const cameFrom = new Map<number, { from: number; connection: NavConnection }>()
  const openSet = new Set<number>([startPolygon.id])
  const closedSet = new Set<number>()

  while (openSet.size > 0) {
    let current: number | null = null
    let currentF = Infinity
    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity
      if (f < currentF) {
        currentF = f
        current = id
      }
    }
    if (current === null) break
    if (current === endPolygon.id) {
      // Reconstruct.
      const path: Vec3[] = [end]
      let cursor = current
      while (cameFrom.has(cursor)) {
        const step = cameFrom.get(cursor)
        if (!step) break
        path.push(portalMidpoint(step.connection))
        cursor = step.from
      }
      path.push(start)
      path.reverse()
      return path
    }

    openSet.delete(current)
    closedSet.add(current)
    const currentG = gScore.get(current) ?? Infinity

    const edges = adjacency.get(current) ?? []
    for (const edge of edges) {
      if (closedSet.has(edge.neighborId) || !polygonById.has(edge.neighborId)) continue
      const neighborCentroid = centroidById.get(edge.neighborId)
      const currentCentroid = centroidById.get(current)
      if (!neighborCentroid || !currentCentroid) continue
      const tentativeG = currentG + distance3(currentCentroid, neighborCentroid)
      const bestKnown = gScore.get(edge.neighborId) ?? Infinity
      if (tentativeG < bestKnown) {
        cameFrom.set(edge.neighborId, { from: current, connection: edge.connection })
        gScore.set(edge.neighborId, tentativeG)
        fScore.set(edge.neighborId, tentativeG + heuristic(edge.neighborId))
        openSet.add(edge.neighborId)
      }
    }
  }

  return null
}
