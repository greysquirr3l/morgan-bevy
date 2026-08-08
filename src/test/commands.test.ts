/**
 * T79 — command-pattern undo/redo regression tests.
 *
 * `src/utils/commands.ts` had no test coverage before this file. The
 * gap let a real bug through the T78 Map migration: `LoadCommand`
 * snapshotted `state.sceneObjects` (now a `Map`) with an object
 * spread (`{ ...state.sceneObjects }`), which produces `{}` — a Map's
 * entries aren't its own enumerable properties. Undoing a scene load
 * silently wiped the entire scene. These tests pin the fix.
 */
import { useEditorStore, type SceneObject } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'
import { LoadCommand, TransformCommand } from '@/utils/commands'
import { beforeEach, describe, expect, it } from 'vitest'

function makeObject(id: ObjectId, name: string = id): SceneObject {
  return {
    id,
    name,
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

describe('LoadCommand', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sceneObjects: new Map(),
      layers: [
        { id: LayerId('default'), name: 'Default', visible: true, locked: false, color: '#fff' },
      ],
      activeLayer: LayerId('default'),
      selectedObjects: [],
      undoHistory: [],
      redoHistory: [],
    })
  })

  it('undo after loading a new scene restores the original objects (regression)', () => {
    const original = makeObject(ObjectId('original_1'), 'Original')
    useEditorStore.setState(state => {
      state.sceneObjects.set(original.id, original)
    })
    expect(useEditorStore.getState().sceneObjects.size).toBe(1)

    const command = new LoadCommand({
      scene: {
        objects: [[ObjectId('loaded_1'), makeObject(ObjectId('loaded_1'), 'Loaded')]],
        layers: useEditorStore.getState().layers,
        activeLayer: 'default',
      },
    })
    command.execute()

    // The load replaced the scene.
    expect(useEditorStore.getState().sceneObjects.size).toBe(1)
    expect(useEditorStore.getState().sceneObjects.has(ObjectId('loaded_1'))).toBe(true)
    expect(useEditorStore.getState().sceneObjects.has(original.id)).toBe(false)

    command.undo()

    // Before the fix, this Map was `{}` — size 0, `original` gone.
    const restored = useEditorStore.getState().sceneObjects
    expect(restored.size).toBe(1)
    expect(restored.get(original.id)).toEqual(original)
  })

  it('accepts the { scene: {...} } file-wrapper shape', () => {
    const command = new LoadCommand({
      scene: { objects: [[ObjectId('wrapped_a'), makeObject(ObjectId('wrapped_a'))]] },
    })
    command.execute()
    expect(useEditorStore.getState().sceneObjects.has(ObjectId('wrapped_a'))).toBe(true)
  })

  it('accepts the scene sub-object passed directly (FileMenu / useStartupFile convention)', () => {
    // FileMenu's `applyProjectDataToStore` and `useStartupFile` both
    // call `new LoadCommand(projectData.scene)` — no `.scene` wrapper.
    // Before the fix, `execute()` only checked `newData.scene`, which
    // is undefined here, so the load silently no-op'd.
    const command = new LoadCommand({
      objects: [[ObjectId('unwrapped_b'), makeObject(ObjectId('unwrapped_b'))]],
    })
    command.execute()
    expect(useEditorStore.getState().sceneObjects.has(ObjectId('unwrapped_b'))).toBe(true)
  })

  it('drops malformed object ids instead of discarding the whole load', () => {
    const command = new LoadCommand({
      scene: {
        objects: [
          [ObjectId('valid_id'), makeObject(ObjectId('valid_id'))],
          ['', makeObject(ObjectId('bad'))],
        ],
      },
    })
    command.execute()
    const objects = useEditorStore.getState().sceneObjects
    expect(objects.size).toBe(1)
    expect(objects.has(ObjectId('valid_id'))).toBe(true)
  })
})

describe('undo/redo structural sharing + freeze (T79)', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sceneObjects: new Map(),
      selectedObjects: [],
      undoHistory: [],
      redoHistory: [],
    })
  })

  it('transforming one object leaves other objects referentially unchanged', () => {
    const touched = ObjectId('touched')
    const untouched = ObjectId('untouched')
    useEditorStore.setState(state => {
      state.sceneObjects.set(touched, makeObject(touched))
      state.sceneObjects.set(untouched, makeObject(untouched))
    })
    const untouchedBefore = useEditorStore.getState().sceneObjects.get(untouched)

    const command = new TransformCommand(
      touched,
      { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { position: [5, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
    )
    command.execute()
    expect(untouchedBefore).toBe(useEditorStore.getState().sceneObjects.get(untouched))

    command.undo()
    expect(untouchedBefore).toBe(useEditorStore.getState().sceneObjects.get(untouched))
  })

  it('undoing a single-object transform stays fast with 10K objects in the scene', () => {
    const target = ObjectId('perf_target')
    useEditorStore.setState(state => {
      for (let i = 0; i < 10_000; i++) {
        const id = ObjectId(`bulk_${i}`)
        state.sceneObjects.set(id, makeObject(id))
      }
      state.sceneObjects.set(target, makeObject(target))
    })

    const command = new TransformCommand(
      target,
      { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { position: [9, 9, 9], rotation: [0, 0, 0], scale: [1, 1, 1] }
    )

    // Best-of-5: a shared/sandboxed CI runner has GC pauses and
    // scheduling jitter that a single sample doesn't average out.
    // The point of this test is "an undo is a delta apply, not an
    // O(n) snapshot copy" — a generous ceiling still fails hard the
    // moment someone reintroduces a full-scene clone into undo.
    let best = Infinity
    for (let i = 0; i < 5; i++) {
      command.execute()
      const start = performance.now()
      command.undo()
      best = Math.min(best, performance.now() - start)
    }

    expect(useEditorStore.getState().sceneObjects.get(target)?.position).toEqual([0, 0, 0])
    expect(best).toBeLessThan(50)
  })

  it('the produced state is frozen — mutating a scene object directly throws', () => {
    const id = ObjectId('frozen_target')
    useEditorStore.setState(state => {
      state.sceneObjects.set(id, makeObject(id))
    })
    const obj = useEditorStore.getState().sceneObjects.get(id)
    expect(obj).toBeDefined()
    expect(() => {
      obj!.name = 'mutated'
    }).toThrow()
  })
})
