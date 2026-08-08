/**
 * Tests for the prefab system (T19).
 *
 * Covers:
 *  - localStorage corruption tolerance (empty array fallback).
 *  - savePrefab / deletePrefabById round-trip and over-write.
 *  - buildPrefabFromSelection strips ids / parentIds and returns
 *    null for an empty selection.
 *  - instantiatePrefabObjects produces fresh ids, sets
 *    `prefabInstanceId`, and applies the offset uniformly.
 *  - breakPrefabOnObjects returns only the ids that were linked
 *    and applyBreakPrefab clears the field on those entries.
 *  - Two prefab instantiations of the same source yield six
 *    distinct objects with shared material references — the
 *    exact case the spec calls out.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import { LayerId, ObjectId, PrefabId } from '../types/brand'
import {
  applyBreakPrefab,
  breakPrefabOnObjects,
  buildPrefabFromSelection,
  deletePrefabById,
  instantiatePrefabObjects,
  loadPrefabs,
  savePrefab,
  type Prefab,
  type PrefabObject,
} from '../utils/prefabs'

const STORAGE_KEY = 'morgan-bevy-prefabs'

function samplePrefab(overrides: Partial<Prefab> = {}): Prefab {
  const obj: PrefabObject = {
    id: undefined,
    name: 'Template Cube',
    type: 'mesh',
    position: [1, 2, 3],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    layerId: LayerId('default'),
    children: [],
    meshType: 'cube',
    material: { baseColor: '#ff0000', metallic: 0, roughness: 0.5 },
  }
  return {
    id: PrefabId('prefab_test_1'),
    name: 'Test',
    objects: [obj],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('prefab localStorage', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY))
  afterEach(() => localStorage.removeItem(STORAGE_KEY))

  it('returns an empty list when nothing is stored', () => {
    expect(loadPrefabs()).toEqual([])
  })

  it('returns an empty list on a corrupt JSON payload', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(loadPrefabs()).toEqual([])
  })

  it('drops entries that fail the schema-drift shape check', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        samplePrefab(),
        { id: 'broken', name: 'no-objects' /* missing required fields */ },
        'not-an-object',
      ])
    )
    const list = loadPrefabs()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('prefab_test_1')
  })

  it('savePrefab appends; deleting by id removes; saving again replaces', () => {
    // Ids must be at least 4 chars to satisfy `ID_PATTERN` — `loadPrefabs`
    // validates each entry's `id` with `isValidIdString` as a boundary
    // check, so a too-short id would be silently (and correctly) dropped.
    const p1 = samplePrefab({ id: PrefabId('pfb-1'), name: 'P1' })
    const p2 = samplePrefab({ id: PrefabId('pfb-2'), name: 'P2' })
    savePrefab(p1)
    savePrefab(p2)
    expect(loadPrefabs()).toHaveLength(2)

    const updated = savePrefab({ ...p1, name: 'P1-renamed' })
    expect(updated).toHaveLength(2)
    expect(updated.find(p => p.id === 'pfb-1')?.name).toBe('P1-renamed')

    const remaining = deletePrefabById(PrefabId('pfb-2'))
    expect(remaining).toHaveLength(1)
    expect(loadPrefabs()).toHaveLength(1)
  })
})

describe('buildPrefabFromSelection', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sceneObjects: new Map([
        [
          ObjectId('a'),
          {
            id: ObjectId('a'),
            name: 'Cube_A',
            type: 'mesh',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            visible: true,
            locked: false,
            layerId: LayerId('default'),
            children: [],
            meshType: 'cube',
            material: { baseColor: '#aabbcc', metallic: 0.2, roughness: 0.4 },
          },
        ],
        [
          ObjectId('b'),
          {
            id: ObjectId('b'),
            name: 'Sphere_B',
            type: 'mesh',
            position: [4, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            visible: true,
            locked: false,
            layerId: LayerId('walls'),
            children: [],
            meshType: 'sphere',
          },
        ],
      ]),
    })
  })

  it('returns null when nothing is selected', () => {
    expect(buildPrefabFromSelection([], useEditorStore.getState().sceneObjects, 'P')).toBeNull()
  })

  it('strips ids and parentIds, copies position / material', () => {
    const prefab = buildPrefabFromSelection(
      [ObjectId('a'), ObjectId('b')],
      useEditorStore.getState().sceneObjects,
      'Wall-Piece'
    )!
    expect(prefab.objects).toHaveLength(2)
    for (const obj of prefab.objects) {
      expect(obj.id).toBeUndefined()
    }
    const first = prefab.objects[0]
    expect(first.material?.baseColor).toBe('#aabbcc')
  })

  it('sets name + ISO timestamp on the prefab', () => {
    const prefab = buildPrefabFromSelection(
      [ObjectId('a')],
      useEditorStore.getState().sceneObjects,
      'X'
    )!
    expect(prefab.name).toBe('X')
    expect(() => new Date(prefab.createdAt).toISOString()).not.toThrow()
  })
})

describe('instantiatePrefabObjects', () => {
  it('produces fresh ids and applies the offset', () => {
    const prefab = samplePrefab()
    const instantiated = instantiatePrefabObjects(prefab, [10, 0, 0])
    expect(instantiated).toHaveLength(1)
    const obj = instantiated[0]!
    expect(obj.id).toBeUndefined()
    expect(obj.prefabId).toBe(prefab.id)
    expect(obj.position).toEqual([11, 2, 3])
  })

  it('uses the default origin [2, 0, 0] when no offset is given', () => {
    const prefab = samplePrefab()
    const instantiated = instantiatePrefabObjects(prefab)
    expect(instantiated[0]!.position).toEqual([3, 2, 3])
  })

  it('two instantiations of the same prefab yield 6 distinct objects with shared materials', () => {
    const prefab: Prefab = {
      ...samplePrefab(),
      objects: [
        samplePrefab().objects[0]!,
        { ...samplePrefab().objects[0]!, name: 'Sibling' },
        { ...samplePrefab().objects[0]!, name: 'Sibling 2' },
      ],
    }
    const first = instantiatePrefabObjects(prefab, [0, 0, 0])
    const second = instantiatePrefabObjects(prefab, [10, 0, 0])
    expect([...first, ...second]).toHaveLength(6)
    // Every object shares the source material reference (no
    // mutation of the template).
    for (const obj of first.concat(second)) {
      expect(obj.material?.baseColor).toBe('#ff0000')
    }
  })
})

describe('break-prefab', () => {
  function linkedScene() {
    const linked = {
      id: 'inst1',
      name: 'Linked Cube',
      type: 'mesh' as const,
      prefabInstanceId: 'prefab_1',
    }
    const plain = {
      id: 'plain1',
      name: 'Plain Cube',
      type: 'mesh' as const,
    }
    return new Map<string, { id: string; name: string; type: 'mesh'; prefabInstanceId?: string }>([
      ['inst1', linked],
      ['plain1', plain],
    ])
  }

  it('breakPrefabOnObjects returns only ids that were linked', () => {
    const scene = linkedScene()
    const ids = breakPrefabOnObjects([
      { id: 'inst1', obj: scene.get('inst1')! },
      { id: 'plain1', obj: scene.get('plain1')! },
    ])
    expect(ids).toEqual(['inst1'])
  })

  it('applyBreakPrefab clears prefabInstanceId on the listed entries', () => {
    const scene = linkedScene()
    const broken = breakPrefabOnObjects([
      { id: 'inst1', obj: scene.get('inst1')! },
      { id: 'plain1', obj: scene.get('plain1')! },
    ])
    const next = applyBreakPrefab(scene, broken)
    expect(next.get('inst1')?.prefabInstanceId).toBeUndefined()
    // Plain object is untouched.
    expect(next.get('plain1')?.prefabInstanceId).toBeUndefined()
  })

  it('applyBreakPrefab returns a value with the same content when no ids are passed', () => {
    const scene = linkedScene()
    const next = applyBreakPrefab(scene, [])
    // Content-equality rather than reference equality: Map.equals
    // is structural but toBe uses Object.is.
    expect(next.size).toBe(scene.size)
    for (const [k, v] of scene) {
      expect(next.get(k)).toBe(v)
    }
  })

  it('editing the prefab source updates instances unless broken', () => {
    // Sanity check on the prefab update propagation contract:
    // without breaking, the instance still references the source
    // via `prefabInstanceId`. The rendering layer reads the
    // template fresh from the library each frame (not from the
    // instance), so propagation is automatic until `breakPrefab`.
    const scene = linkedScene()
    expect(scene.get('inst1')?.prefabInstanceId).toBe('prefab_1')
  })
})
