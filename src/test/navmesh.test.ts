/**
 * T56 — Navigation mesh: scene-object derivation, zod schema, and
 * the `generate_navmesh` invoke wrapper.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SceneObject } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'
import { deriveNavMeshInputs, generateNavMesh } from '@/types/navmesh'
import { NavMeshSchema } from '@/types/schemas'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

function makeObject(id: string, overrides: Partial<SceneObject> = {}): [ObjectId, SceneObject] {
  const obj: SceneObject = {
    id: ObjectId(id),
    name: id,
    type: 'mesh',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    layerId: LayerId('default'),
    children: [],
    meshType: 'cube',
    ...overrides,
  }
  return [ObjectId(id), obj]
}

describe('T56 deriveNavMeshInputs', () => {
  it('produces no surfaces or obstacles for an empty scene', () => {
    const { surfaces, obstacles } = deriveNavMeshInputs(new Map())
    expect(surfaces).toEqual([])
    expect(obstacles).toEqual([])
  })

  it('derives a walkable surface from position + scale', () => {
    const [id, obj] = makeObject('floor', {
      walkable: true,
      position: [5, 0.05, 5],
      scale: [10, 0.1, 10],
    })
    const { surfaces, obstacles } = deriveNavMeshInputs(new Map([[id, obj]]))
    expect(obstacles).toEqual([])
    expect(surfaces).toHaveLength(1)
    expect(surfaces[0]).toEqual({
      min: [0, 0],
      max: [10, 10],
      height: 0.1,
    })
  })

  it('classifies a collision object tagged "wall" as ObstacleKind::Wall', () => {
    const [id, obj] = makeObject('wall', {
      collision: true,
      tags: ['wall'],
      position: [4, 1, 5],
      scale: [8, 2, 1],
    })
    const { surfaces, obstacles } = deriveNavMeshInputs(new Map([[id, obj]]))
    expect(surfaces).toEqual([])
    expect(obstacles).toHaveLength(1)
    expect(obstacles[0]).toEqual({
      min: [0, 4.5],
      max: [8, 5.5],
      kind: 'wall',
    })
  })

  it('classifies a collision object without a "wall" tag as free_standing', () => {
    const [id, obj] = makeObject('pillar', {
      collision: true,
      position: [4.5, 1, 4.5],
      scale: [1, 2, 1],
    })
    const { obstacles } = deriveNavMeshInputs(new Map([[id, obj]]))
    expect(obstacles).toHaveLength(1)
    expect(obstacles[0]!.kind).toBe('free_standing')
  })

  it('ignores objects that are neither walkable nor collision', () => {
    const [id, obj] = makeObject('decor', { walkable: false, collision: false })
    const { surfaces, obstacles } = deriveNavMeshInputs(new Map([[id, obj]]))
    expect(surfaces).toEqual([])
    expect(obstacles).toEqual([])
  })

  it('walkable takes precedence over collision when both are set', () => {
    const [id, obj] = makeObject('weird', { walkable: true, collision: true })
    const { surfaces, obstacles } = deriveNavMeshInputs(new Map([[id, obj]]))
    expect(surfaces).toHaveLength(1)
    expect(obstacles).toEqual([])
  })
})

describe('T56 NavMeshSchema', () => {
  it('validates a well-formed navmesh payload matching the Rust wire shape', () => {
    const payload = {
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
    const result = NavMeshSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('rejects a payload missing a required field', () => {
    const payload = {
      vertices: [],
      polygons: [],
      obstacles: [],
      connections: [],
      // off_mesh_connections deliberately omitted
    }
    const result = NavMeshSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('rejects an unknown extra field (strict boundary)', () => {
    const payload = {
      vertices: [],
      polygons: [],
      obstacles: [],
      connections: [],
      off_mesh_connections: [],
      extra: 'nope',
    }
    const result = NavMeshSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })
})

describe('T56 generateNavMesh', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('returns null without invoking Tauri when there are no walkable surfaces', async () => {
    const result = await generateNavMesh([], [])
    expect(result).toBeNull()
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('invokes generate_navmesh and validates the response', async () => {
    const navMeshPayload = {
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
    mockInvoke.mockResolvedValueOnce(navMeshPayload)

    const surfaces = [
      { min: [0, 0] as [number, number], max: [10, 10] as [number, number], height: 0 },
    ]
    const result = await generateNavMesh(surfaces, [])

    expect(mockInvoke).toHaveBeenCalledWith('generate_navmesh', { surfaces, obstacles: [] })
    expect(result).toEqual(navMeshPayload)
  })

  it('throws when the Rust response fails schema validation', async () => {
    mockInvoke.mockResolvedValueOnce({ not: 'a navmesh' })
    const surfaces = [
      { min: [0, 0] as [number, number], max: [10, 10] as [number, number], height: 0 },
    ]
    await expect(generateNavMesh(surfaces, [])).rejects.toThrow(/unexpected shape/)
  })
})
