// T56 — Pure geometry builders for the navmesh viewport overlay.
//
// Kept separate from the R3F component (NavMeshOverlay.tsx) so the
// vertex-index -> line-segment math is unit-testable without a
// WebGL context, mirroring how `src/utils/surfaceSnap.ts` (T52)
// keeps its math independent of the TransformGizmos component that
// consumes it.

import type { NavMesh } from '@/types/schemas'

/**
 * Flatten every `NavPolygon`'s boundary loop into line-segment
 * positions (2 points per segment, wrapping the last vertex back to
 * the first). Suitable for a `THREE.LineSegments` geometry's
 * `position` attribute (stride 3, pairs of endpoints).
 */
export function navMeshPolygonEdgePositions(navMesh: NavMesh): Float32Array {
  const positions: number[] = []
  for (const polygon of navMesh.polygons) {
    const loop = polygon.vertex_indices
    for (let i = 0; i < loop.length; i++) {
      const aIdx = loop[i]
      const bIdx = loop[(i + 1) % loop.length]
      if (aIdx === undefined || bIdx === undefined) continue
      const a = navMesh.vertices[aIdx]
      const b = navMesh.vertices[bIdx]
      if (!a || !b) continue
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2])
    }
  }
  return new Float32Array(positions)
}

/**
 * Flatten every `NavConnection`'s portal segment into line-segment
 * positions. Rendered with a distinct colour from the polygon edges
 * so doorways read as "connections" rather than walkable boundary.
 */
export function navMeshConnectionPositions(navMesh: NavMesh): Float32Array {
  const positions: number[] = []
  for (const connection of navMesh.connections) {
    const [a, b] = connection.portal
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2])
  }
  return new Float32Array(positions)
}

/**
 * Flatten every `NavObstacle`'s AABB into a 12-edge wireframe box
 * (line-segment positions, stride 3, pairs of endpoints).
 */
export function navMeshObstaclePositions(navMesh: NavMesh): Float32Array {
  const positions: number[] = []
  for (const obstacle of navMesh.obstacles) {
    const [x0, y0, z0] = obstacle.min
    const [x1, y1, z1] = obstacle.max
    const corners: [number, number, number][] = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ]
    const edges: [number, number][] = [
      // bottom face
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      // top face
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      // verticals
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ]
    for (const [ai, bi] of edges) {
      const a = corners[ai]
      const b = corners[bi]
      if (!a || !b) continue
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2])
    }
  }
  return new Float32Array(positions)
}
