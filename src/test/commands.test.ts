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
import { CreateObjectFromTemplateCommand, LoadCommand, TransformCommand } from '@/utils/commands'
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

/**
 * Regression for the audit-flagged Critical #1: the store's own
 * `undo()` / `redo()` actions previously called `command.undo()` /
 * `command.execute()` from INSIDE the producer. Every command reaches
 * back into the store via its own `set()`, and a nested zustand+immer
 * commit gets clobbered by the outer producer's draft commit. The
 * command was popped from history but the scene mutation was silently
 * overwritten. None of the existing tests caught this because they
 * call `command.undo()` / `command.execute()` directly, bypassing the
 * store actions entirely — same shape of test would have passed
 * before and after the fix.
 */
describe('store undo()/redo() actions (regression for Critical #1)', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sceneObjects: new Map(),
      selectedObjects: [],
      undoHistory: [],
      redoHistory: [],
    })
  })

  it('undo() restores a deleted object via the store action (TransformCommand)', () => {
    const target = ObjectId('store_undo_target')
    useEditorStore.setState(state => {
      state.sceneObjects.set(target, makeObject(target))
    })

    const cmd = new TransformCommand(
      target,
      { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { position: [7, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
    )
    cmd.execute()
    useEditorStore.getState().executeCommand(cmd)

    expect(useEditorStore.getState().sceneObjects.get(target)?.position).toEqual([7, 0, 0])
    expect(useEditorStore.getState().undoHistory.length).toBe(1)

    useEditorStore.getState().undo()

    // Before the fix, the position stayed at [7, 0, 0] because the
    // outer producer's draft clobbered `updateObjectTransform`'s
    // commit.
    expect(useEditorStore.getState().sceneObjects.get(target)?.position).toEqual([0, 0, 0])
    expect(useEditorStore.getState().redoHistory.length).toBe(1)
    expect(useEditorStore.getState().undoHistory.length).toBe(0)
  })

  it('redo() re-applies the change via the store action', () => {
    const target = ObjectId('store_redo_target')
    useEditorStore.setState(state => {
      state.sceneObjects.set(target, makeObject(target))
    })

    const cmd = new TransformCommand(
      target,
      { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      { position: [4, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
    )
    cmd.execute()
    useEditorStore.getState().executeCommand(cmd)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().sceneObjects.get(target)?.position).toEqual([0, 0, 0])

    useEditorStore.getState().redo()
    expect(useEditorStore.getState().sceneObjects.get(target)?.position).toEqual([4, 0, 0])
    expect(useEditorStore.getState().undoHistory.length).toBe(1)
    expect(useEditorStore.getState().redoHistory.length).toBe(0)
  })

  it('undo() is a no-op when history is empty', () => {
    expect(() => useEditorStore.getState().undo()).not.toThrow()
    expect(() => useEditorStore.getState().redo()).not.toThrow()
  })
})

/**
 * Regression for Critical #3 (prefab round-trip drops rotation /
 * scale / material / tags). `CreateObjectFromTemplateCommand` exists
 * specifically so a prefab instantiation can hand a full
 * `SceneObject` template to the store and have every field
 * preserved — `CreateObjectCommand`'s (meshType, position) shape was
 * lossy by design.
 */
describe('CreateObjectFromTemplateCommand (regression for Critical #3)', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sceneObjects: new Map(),
      selectedObjects: [],
      undoHistory: [],
      redoHistory: [],
    })
  })

  it('execute() inserts every field on the template (rotation / scale / material / tags)', () => {
    const template: SceneObject = makeObject(ObjectId('ignored'), 'Round Cube')
    template.meshType = 'cube'
    template.position = [1, 2, 3]
    template.rotation = [Math.PI / 2, 0, 0]
    template.scale = [2, 0.5, 1]
    template.material = { baseColor: '#ff0000', metallic: 0.7, roughness: 0.2 }
    template.tags = ['wall', 'hazard']
    template.layerId = LayerId('walls')

    const cmd = new CreateObjectFromTemplateCommand(template)
    cmd.execute()

    const stored = useEditorStore.getState().sceneObjects.get(cmd.objectId)
    expect(stored).toBeDefined()
    expect(stored?.position).toEqual([1, 2, 3])
    expect(stored?.rotation).toEqual([Math.PI / 2, 0, 0])
    expect(stored?.scale).toEqual([2, 0.5, 1])
    expect(stored?.material).toEqual({ baseColor: '#ff0000', metallic: 0.7, roughness: 0.2 })
    expect(stored?.tags).toEqual(['wall', 'hazard'])
    expect(stored?.layerId).toBe(LayerId('walls'))
    expect(stored?.name).toBe('Round Cube')
  })

  it('undo() removes the inserted object via the store action', () => {
    const template: SceneObject = makeObject(ObjectId('ignored'), 'Round Sphere')
    template.meshType = 'sphere'
    const cmd = new CreateObjectFromTemplateCommand(template)
    cmd.execute()
    useEditorStore.getState().executeCommand(cmd)

    expect(useEditorStore.getState().sceneObjects.has(cmd.objectId)).toBe(true)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().sceneObjects.has(cmd.objectId)).toBe(false)
  })
})
