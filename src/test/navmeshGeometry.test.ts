/**
 * T56 — Pure geometry builders for the navmesh viewport overlay.
 */
import { describe, expect, it } from 'vitest'

import type { NavMesh } from '@/types/schemas'
import {
  navMeshConnectionPositions,
  navMeshObstaclePositions,
  navMeshPolygonEdgePositions,
} from '@/utils/navmeshGeometry'

function singlePolygonMesh(): NavMesh {
  return {
    vertices: [
      [0, 0, 0],
      [10, 0, 0],
      [10, 0, 10],
      [0, 0, 10],
    ],
    polygons: [{ id: 0, vertex_indices: [0, 1, 2, 3], triangle_indices: [0, 1, 2, 0, 2, 3] }],
    obstacles: [],
    connections: [],
    off_mesh_connections: [],
  }
}

describe('T56 navMeshPolygonEdgePositions', () => {
  it('emits one closed loop (4 segments, 8 points) for a single rectangle polygon', () => {
    const positions = navMeshPolygonEdgePositions(singlePolygonMesh())
    // 4 edges * 2 points * 3 floats = 24
    expect(positions.length).toBe(24)
  })

  it('wraps the last vertex back to the first', () => {
    const positions = navMeshPolygonEdgePositions(singlePolygonMesh())
    // Last segment should be vertex 3 -> vertex 0: (0,0,10) -> (0,0,0).
    const lastSegmentStart = positions.slice(18, 21)
    const lastSegmentEnd = positions.slice(21, 24)
    expect(Array.from(lastSegmentStart)).toEqual([0, 0, 10])
    expect(Array.from(lastSegmentEnd)).toEqual([0, 0, 0])
  })

  it('returns an empty array for a mesh with no polygons', () => {
    const mesh: NavMesh = {
      vertices: [],
      polygons: [],
      obstacles: [],
      connections: [],
      off_mesh_connections: [],
    }
    expect(navMeshPolygonEdgePositions(mesh).length).toBe(0)
  })
})

describe('T56 navMeshConnectionPositions', () => {
  it('emits one segment (2 points) per connection', () => {
    const mesh: NavMesh = {
      ...singlePolygonMesh(),
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
    }
    const positions = navMeshConnectionPositions(mesh)
    expect(Array.from(positions)).toEqual([8, 0, 5, 10, 0, 5])
  })

  it('returns an empty array when there are no connections', () => {
    expect(navMeshConnectionPositions(singlePolygonMesh()).length).toBe(0)
  })
})

describe('T56 navMeshObstaclePositions', () => {
  it('emits a 12-edge wireframe box (24 points) per obstacle', () => {
    const mesh: NavMesh = {
      ...singlePolygonMesh(),
      obstacles: [{ min: [4, 0, 4], max: [5, 1, 5] }],
    }
    const positions = navMeshObstaclePositions(mesh)
    // 12 edges * 2 points * 3 floats = 72
    expect(positions.length).toBe(72)
  })

  it('returns an empty array when there are no obstacles', () => {
    expect(navMeshObstaclePositions(singlePolygonMesh()).length).toBe(0)
  })
})
