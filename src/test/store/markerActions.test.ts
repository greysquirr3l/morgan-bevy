/**
 * T91b — marker update actions on the editor store.
 *
 * The contract being pinned:
 *   - `updateObjectXyz(id, marker)` sets the field on the object.
 *   - `updateObjectXyz(id, undefined)` REMOVES the field — not
 *     assigns undefined. `'light' in obj` must be `false` after
 *     removal; this is the Rust `skip_serializing_if = "Option::is_none"`
 *     contract on the wire (an absent key differs from a present-but-null
 *     key).
 *   - Updating one object does not touch another (immer structural
 *     sharing).
 *   - Calling an update with an id that isn't in the store is a no-op.
 *   - The four marker fields ride through `serializeMap`/JSON/`deserializeMap`
 *     unchanged (round-trip survival).
 *   - An object with no markers serializes with no `light`/`animation`/
 *     `audio`/`vfx` keys at all.
 */
import { describe, expect, it, beforeEach } from 'vitest'

import { useEditorStore } from '@/store/editorStore'
import { deserializeMap, serializeMap } from '@/store/mapSerialization'
import { LayerId, ObjectId } from '@/types/brand'

function resetStore(): void {
  useEditorStore.setState({
    selectedObjects: [],
    sceneObjects: new Map(),
    gridSnapEnabled: false,
    transformMode: 'translate',
    coordinateSpace: 'world',
    layers: [
      { id: LayerId('default'), name: 'Default', visible: true, locked: false, color: '#ffffff' },
    ],
    activeLayer: LayerId('default'),
    undoHistory: [],
    redoHistory: [],
    showGrid: true,
    showStats: false,
  })
}

// Reusable marker payloads ─────────────────────────────────────────────────────

const pointLight = {
  kind: 'point' as const,
  color: [1, 1, 1] as [number, number, number],
  intensity: 1000,
  range: 10,
  shadows: true,
}

const playAnim = {
  kind: 'play' as const,
  clip: 'banner.anim',
  repeat: true,
  speed: 1.0,
}

const ambientAudio = {
  kind: 'ambient' as const,
  path: 'fountain.ogg',
  volume: 0.8,
  looping: true,
}

const particleVfx = {
  kind: 'particle' as const,
  path: 'campfire.vfx',
  count: 100,
}

describe('T91b updateObjectLight', () => {
  beforeEach(resetStore)

  it('sets the light field on the targeted object', () => {
    const store = useEditorStore.getState()
    const id = store.addObject('cube', [0, 0, 0])

    store.updateObjectLight(id, pointLight)

    const obj = useEditorStore.getState().sceneObjects.get(id)
    expect(obj?.light).toEqual(pointLight)
  })

  it('removes the light field when passed undefined', () => {
    const store = useEditorStore.getState()
    const id = store.addObject('cube', [0, 0, 0])

    store.updateObjectLight(id, pointLight)
    expect('light' in (useEditorStore.getState().sceneObjects.get(id) ?? {})).toBe(true)

    store.updateObjectLight(id, undefined)
    const obj = useEditorStore.getState().sceneObjects.get(id)
    expect(obj).toBeDefined()
    expect('light' in obj!).toBe(false)
  })

  it('does not touch unrelated objects', () => {
    const store = useEditorStore.getState()
    const idA = store.addObject('cube', [0, 0, 0])
    const idB = store.addObject('sphere', [1, 1, 1])

    store.updateObjectLight(idA, pointLight)

    const objA = useEditorStore.getState().sceneObjects.get(idA)
    const objB = useEditorStore.getState().sceneObjects.get(idB)
    expect(objA?.light).toEqual(pointLight)
    expect(objB?.light).toBeUndefined()
    expect('light' in objB!).toBe(false)
  })

  it('is a no-op when the id is not in the store', () => {
    const store = useEditorStore.getState()
    const before = useEditorStore.getState().sceneObjects.size

    expect(() => store.updateObjectLight(ObjectId('missing_id'), pointLight)).not.toThrow()
    expect(useEditorStore.getState().sceneObjects.size).toBe(before)
  })
})

describe('T91b updateObjectAnimation', () => {
  beforeEach(resetStore)

  it('sets and removes the animation field', () => {
    const store = useEditorStore.getState()
    const id = store.addObject('cube', [0, 0, 0])

    store.updateObjectAnimation(id, playAnim)
    expect(useEditorStore.getState().sceneObjects.get(id)?.animation).toEqual(playAnim)

    store.updateObjectAnimation(id, undefined)
    expect('animation' in (useEditorStore.getState().sceneObjects.get(id) ?? {})).toBe(false)
  })
})

describe('T91b updateObjectAudio', () => {
  beforeEach(resetStore)

  it('sets and removes the audio field', () => {
    const store = useEditorStore.getState()
    const id = store.addObject('cube', [0, 0, 0])

    store.updateObjectAudio(id, ambientAudio)
    expect(useEditorStore.getState().sceneObjects.get(id)?.audio).toEqual(ambientAudio)

    store.updateObjectAudio(id, undefined)
    expect('audio' in (useEditorStore.getState().sceneObjects.get(id) ?? {})).toBe(false)
  })
})

describe('T91b updateObjectVfx', () => {
  beforeEach(resetStore)

  it('sets and removes the vfx field', () => {
    const store = useEditorStore.getState()
    const id = store.addObject('cube', [0, 0, 0])

    store.updateObjectVfx(id, particleVfx)
    expect(useEditorStore.getState().sceneObjects.get(id)?.vfx).toEqual(particleVfx)

    store.updateObjectVfx(id, undefined)
    expect('vfx' in (useEditorStore.getState().sceneObjects.get(id) ?? {})).toBe(false)
  })
})

describe('T91b structural sharing', () => {
  it('updating a marker on object A leaves object B referentially identical', () => {
    resetStore()
    const store = useEditorStore.getState()
    const idA = store.addObject('cube', [0, 0, 0])
    const idB = store.addObject('sphere', [1, 1, 1])

    const objBBefore = useEditorStore.getState().sceneObjects.get(idB)
    const refBefore = objBBefore

    store.updateObjectLight(idA, pointLight)

    const objBAfter = useEditorStore.getState().sceneObjects.get(idB)
    // Same reference — immer's structural sharing kept objB unchanged.
    expect(objBAfter).toBe(refBefore)
    expect(objBAfter?.light).toBeUndefined()
  })
})

describe('T91b persistence round-trip', () => {
  it('all four markers survive serializeMap → JSON → deserializeMap', () => {
    resetStore()
    const store = useEditorStore.getState()
    const id = store.addObject('cube', [0, 0, 0])
    store.updateObjectLight(id, pointLight)
    store.updateObjectAnimation(id, playAnim)
    store.updateObjectAudio(id, ambientAudio)
    store.updateObjectVfx(id, particleVfx)

    const state = useEditorStore.getState()
    const wire = JSON.stringify(serializeMap(state.sceneObjects))
    const parsed = JSON.parse(wire) as unknown
    const restored = deserializeMap<ObjectId, (typeof state.sceneObjects extends Map<ObjectId, infer V> ? V : never)>(
      parsed,
      (k): k is ObjectId => typeof k === 'string',
    )

    const obj = restored.get(id)
    expect(obj?.light).toEqual(pointLight)
    expect(obj?.animation).toEqual(playAnim)
    expect(obj?.audio).toEqual(ambientAudio)
    expect(obj?.vfx).toEqual(particleVfx)
  })

  it('an object with no markers produces JSON with no marker keys', () => {
    resetStore()
    const store = useEditorStore.getState()
    store.addObject('cube', [0, 0, 0])

    const state = useEditorStore.getState()
    const wire = JSON.stringify(serializeMap(state.sceneObjects))
    const objEntry = JSON.parse(wire) as Array<[string, Record<string, unknown>]>
    const obj = objEntry[0][1]

    expect('light' in obj).toBe(false)
    expect('animation' in obj).toBe(false)
    expect('audio' in obj).toBe(false)
    expect('vfx' in obj).toBe(false)
  })

  it('removing a marker is reflected in the JSON wire format (no key at all)', () => {
    resetStore()
    const store = useEditorStore.getState()
    const id = store.addObject('cube', [0, 0, 0])

    store.updateObjectLight(id, pointLight)
    store.updateObjectLight(id, undefined)

    const state = useEditorStore.getState()
    const wire = JSON.stringify(serializeMap(state.sceneObjects))
    const objEntry = JSON.parse(wire) as Array<[string, Record<string, unknown>]>
    const obj = objEntry[0][1]

    expect('light' in obj).toBe(false)
    // Crucially: not `"light": null`, which would break the Rust
    // skip_serializing_if contract.
    expect(obj.light).toBeUndefined()
  })
})
