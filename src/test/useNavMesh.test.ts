/**
 * T56 — useNavMesh hook.
 *
 * Pins the toggle + regenerate contract: `toggleVisible` flips
 * `visible` without touching the mesh; `regenerate` derives inputs
 * from scene objects, invokes `generate_navmesh`, and stores the
 * validated result.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

import type { SceneObject } from '@/store/editorStore'
import { useNavMesh } from '@/hooks/useNavMesh'
import { LayerId, ObjectId } from '@/types/brand'

function floorObject(): [ReturnType<typeof ObjectId>, SceneObject] {
  const id = ObjectId('floor')
  const obj: SceneObject = {
    id,
    name: 'floor',
    type: 'mesh',
    position: [5, 0.05, 5],
    rotation: [0, 0, 0],
    scale: [10, 0.1, 10],
    visible: true,
    locked: false,
    layerId: LayerId('default'),
    children: [],
    meshType: 'cube',
    walkable: true,
  }
  return [id, obj]
}

describe('T56 useNavMesh', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('starts hidden with no navmesh', () => {
    const { result } = renderHook(() => useNavMesh())
    expect(result.current.visible).toBe(false)
    expect(result.current.navMesh).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('toggleVisible flips visibility without regenerating', () => {
    const { result } = renderHook(() => useNavMesh())
    act(() => result.current.toggleVisible())
    expect(result.current.visible).toBe(true)
    expect(mockInvoke).not.toHaveBeenCalled()
    act(() => result.current.toggleVisible())
    expect(result.current.visible).toBe(false)
  })

  it('regenerate derives inputs from scene objects and stores the validated navmesh', async () => {
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

    const [id, obj] = floorObject()
    const { result } = renderHook(() => useNavMesh())

    await act(async () => {
      await result.current.regenerate(new Map([[id, obj]]))
    })

    await waitFor(() => expect(result.current.navMesh).toEqual(navMeshPayload))
    expect(mockInvoke).toHaveBeenCalledWith('generate_navmesh', {
      surfaces: [{ min: [0, 0], max: [10, 10], height: 0.1 }],
      obstacles: [],
    })
    expect(result.current.error).toBeNull()
  })

  it('regenerate surfaces an error when the invoke fails', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('backend exploded'))
    const [id, obj] = floorObject()
    const { result } = renderHook(() => useNavMesh())

    await act(async () => {
      await result.current.regenerate(new Map([[id, obj]]))
    })

    expect(result.current.error).toBe('backend exploded')
    expect(result.current.navMesh).toBeNull()
  })

  it('regenerate with an empty scene resolves to a null navmesh without invoking Tauri', async () => {
    const { result } = renderHook(() => useNavMesh())
    await act(async () => {
      await result.current.regenerate(new Map())
    })
    expect(result.current.navMesh).toBeNull()
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})
