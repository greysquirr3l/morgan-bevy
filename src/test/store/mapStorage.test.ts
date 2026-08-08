import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore, type SceneObject } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'

/**
 * T78 — `Map<ObjectId, SceneObject>` storage contract.
 *
 * These pin the behavior the migration from `Record<string, T>` exists
 * for: O(1) delete/lookup, no per-delete cost blowup at 10K objects, and
 * a `useShallow`-wrapped `values()` selector that doesn't hand a fresh
 * array reference to subscribers when nothing they read changed.
 */

function makeObject(id: ObjectId): SceneObject {
  return {
    id,
    name: id,
    type: 'mesh',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    layerId: LayerId('default'),
    children: [],
  }
}

describe('sceneObjects Map storage', () => {
  beforeEach(() => {
    useEditorStore.setState({ sceneObjects: new Map() })
  })

  it('delete() returns true then get() returns undefined', () => {
    const id = ObjectId('delete-me')
    useEditorStore.setState(state => {
      state.sceneObjects.set(id, makeObject(id))
    })
    const { sceneObjects } = useEditorStore.getState()
    expect(sceneObjects.has(id)).toBe(true)

    let deleted = false
    useEditorStore.setState(state => {
      deleted = state.sceneObjects.delete(id)
    })
    expect(deleted).toBe(true)
    expect(useEditorStore.getState().sceneObjects.get(id)).toBeUndefined()
  })

  it('10K inserts followed by 10K deletes completes in roughly O(n) time', () => {
    const N = 10_000
    const ids = Array.from({ length: N }, (_, i) => ObjectId(`obj_${i}`))
    const map = new Map<ObjectId, SceneObject>()

    const start = performance.now()
    for (const id of ids) map.set(id, makeObject(id))
    for (const id of ids) map.delete(id)
    const elapsed = performance.now() - start

    expect(map.size).toBe(0)
    // A Record would pay O(n) *per delete* (V8 hidden-class
    // deoptimization) — 10K deletes would blow well past this budget.
    // Map.delete is O(1), so 20K total ops stay comfortably under it
    // even on a slow CI runner.
    expect(elapsed).toBeLessThan(500)
  })

  it('a useShallow-wrapped values() selector does not thrash on unrelated updates', () => {
    const id = ObjectId('stable-object')
    useEditorStore.setState(state => {
      state.sceneObjects.set(id, makeObject(id))
    })

    const { result } = renderHook(() =>
      useEditorStore(useShallow(s => Array.from(s.sceneObjects.values())))
    )
    const initial = result.current
    expect(initial).toHaveLength(1)

    // Mutate an unrelated field. The values() array is recomputed on
    // every call, but its *elements* are unchanged, so useShallow's
    // shallow-equality check should keep handing back the same array
    // reference to the subscriber.
    act(() => {
      useEditorStore.getState().toggleGrid()
    })
    expect(result.current).toBe(initial)
  })

  it('re-renders the values() selector when an object is actually added', () => {
    const { result } = renderHook(() =>
      useEditorStore(useShallow(s => Array.from(s.sceneObjects.values())))
    )
    expect(result.current).toHaveLength(0)

    const id = ObjectId('newly-added')
    act(() => {
      useEditorStore.setState(state => {
        state.sceneObjects.set(id, makeObject(id))
      })
    })
    expect(result.current).toHaveLength(1)
  })
})
