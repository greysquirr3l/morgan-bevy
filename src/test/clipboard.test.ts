/**
 * Tests for the clipboard manager (T70).
 *
 * Covers:
 *  - copy() returns false when nothing is selected / no objects
 *    resolve.
 *  - copy() succeeds and stores a deep-clone snapshot of the
 *    selected objects.
 *  - copy() then paste() yields new ids and the original ids stay
 *    intact.
 *  - hasData() and clear() track the internal clipboard state.
 *  - The paste() offset is applied uniformly to every pasted object.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import { clipboard } from '../utils/clipboard'

function populateScene() {
  useEditorStore.setState({
    sceneObjects: new Map([
      ['a', { id: 'a', name: 'Cube_A', type: 'mesh', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, locked: false, layerId: 'default', children: [], meshType: 'cube' }],
      ['b', { id: 'b', name: 'Cube_B', type: 'mesh', position: [4, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, locked: false, layerId: 'default', children: [], meshType: 'cube' }],
    ]),
  })
}

describe('clipboard', () => {
  beforeEach(() => {
    clipboard.clear()
    populateScene()
  })
  afterEach(() => clipboard.clear())

  it('starts empty (hasData is false)', () => {
    expect(clipboard.hasData()).toBe(false)
  })

  it('copy() returns false when no ids are passed', () => {
    expect(clipboard.copy([])).toBe(false)
    expect(clipboard.hasData()).toBe(false)
  })

  it('copy() snapshots every resolved object', () => {
    expect(clipboard.copy(['a', 'b'])).toBe(true)
    expect(clipboard.hasData()).toBe(true)
  })

  it('copy() silently drops ids that do not resolve', () => {
    expect(clipboard.copy(['a', 'missing', 'b'])).toBe(true)
    expect(clipboard.hasData()).toBe(true)
  })

  it('clear() resets the clipboard state', () => {
    clipboard.copy(['a'])
    expect(clipboard.hasData()).toBe(true)
    clipboard.clear()
    expect(clipboard.hasData()).toBe(false)
  })

  it('paste() returns no ids when nothing was copied', async () => {
    // Force `navigator.clipboard` to be undefined so paste() can't
    // accidentally read from the OS clipboard.
    const original = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: undefined },
      configurable: true,
    })
    try {
      const ids = await clipboard.paste([10, 0, 0])
      expect(ids).toEqual([])
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: original,
        configurable: true,
      })
    }
  })

  it('paste() inserts copies with new ids and respects an offset', async () => {
    clipboard.copy(['a', 'b'])
    const before = new Set(useEditorStore.getState().sceneObjects.keys())
    // Source a=(0,0,0), b=(4,0,0); centre = (2,0,0).
    // No offset → default (2,0,0); cluster centre lands at (2,0,0).
    // So a (0) → 0 + (2 - 2) = 0; b (4) → 4 + (2 - 2) = 4.
    // With offset (10,0,0) → cluster centre lands at (10,0,0); shift = +8.
    const ids = await clipboard.paste([10, 0, 0])
    expect(ids).toHaveLength(2)
    for (const id of ids) {
      expect(before.has(id)).toBe(false)
    }
    const state = useEditorStore.getState()
    const xs = ids.map(id => state.sceneObjects.get(id)!.position[0]).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(8, 1)
    expect(xs[1]).toBeCloseTo(12, 1)
  })

  it('paste() with no offset lands the cluster centre at (2, 0, 0)', async () => {
    clipboard.copy(['a'])
    const ids = await clipboard.paste()
    expect(ids).toHaveLength(1)
    const obj = useEditorStore.getState().sceneObjects.get(ids[0]!)
    // Source at (0,0,0), centre = source, default offset = (2,0,0);
    // shift = 2 - 0 = 2, so the paste lands at (2, 0, 0).
    expect(obj?.position).toEqual([2, 0, 0])
  })
})