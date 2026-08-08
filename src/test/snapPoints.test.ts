/**
 * T51 — Snap points.
 *
 * Contract pinned:
 *  - `computeSnapCandidates` returns every snap point on every
 *    scene object that's within `radius` of the cursor, sorted
 *    by distance.
 *  - The source object (the one being dragged) is excluded.
 *  - Categories filter: a candidate is only included if its
 *    category is in `enabledCategories`.
 *  - `applySnap` returns the first candidate (closest), or null
 *    if the list is empty.
 *  - `countByCategory` matches an actual `Map<ObjectId,
 *    SceneObject>` traversal.
 *  - World position is computed from the host object's
 *    `position` + `scale * localPosition`.
 */
import { describe, expect, it } from 'vitest'

import type { SceneObject } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'
import type { SnapPoint } from '@/types/snapPoints'
import {
  applySnap,
  computeSnapCandidates,
  countByCategory,
  filterByCategory,
  findBestSnap,
} from '@/utils/snapPoints'

function makeObject(
  id: string,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  points: SnapPoint[] = []
): [ObjectId, SceneObject] {
  const obj: SceneObject = {
    id: ObjectId(id),
    name: id,
    type: 'mesh',
    position,
    rotation: [0, 0, 0],
    scale,
    visible: true,
    locked: false,
    layerId: LayerId('default'),
    children: [],
    meshType: 'cube',
    ...(points.length > 0 ? { snapPoints: points } : {}),
  }
  return [ObjectId(id), obj]
}

function makePoint(
  objectId: string,
  localPosition: [number, number, number],
  category: SnapPoint['category'] = 'structural',
  id: string = 'sp'
): SnapPoint {
  return {
    id,
    objectId,
    localPosition,
    localRotation: [0, 0, 0, 1],
    label: id,
    category,
  }
}

describe('T51 computeSnapCandidates', () => {
  it('returns every point within radius of the cursor, sorted by distance', () => {
    const [id1, o1] = makeObject(
      'a',
      [0, 0, 0],
      [1, 1, 1],
      [
        makePoint('a', [0, 0, 0], 'structural', 'sp1'),
        makePoint('a', [1, 0, 0], 'decorative', 'sp2'),
      ]
    )
    const [id2, o2] = makeObject(
      'b',
      [5, 0, 0],
      [1, 1, 1],
      [makePoint('b', [0, 0, 0], 'logical', 'sp3')]
    )
    const map = new Map([
      [id1, o1],
      [id2, o2],
    ])

    const candidates = computeSnapCandidates(map, {
      sourceObjectId: ObjectId('c'),
      cursorWorld: [0, 0, 0],
      radius: 10,
    })
    expect(candidates).toHaveLength(3)
    expect(candidates.map(c => c.point.id)).toEqual(['sp1', 'sp2', 'sp3'])
    expect(candidates[0].distance).toBe(0)
    expect(candidates[1].distance).toBe(1)
    expect(candidates[2].distance).toBe(5)
  })

  it('excludes the source object (the one being dragged)', () => {
    const [id1, o1] = makeObject(
      'a',
      [0, 0, 0],
      [1, 1, 1],
      [makePoint('a', [0, 0, 0], 'structural', 'sp1')]
    )
    const map = new Map([[id1, o1]])

    const candidates = computeSnapCandidates(map, {
      sourceObjectId: ObjectId('a'),
      cursorWorld: [0, 0, 0],
      radius: 10,
    })
    expect(candidates).toEqual([])
  })

  it('excludes points outside the radius', () => {
    const [id1, o1] = makeObject(
      'a',
      [100, 0, 0],
      [1, 1, 1],
      [makePoint('a', [0, 0, 0], 'structural', 'sp1')]
    )
    const map = new Map([[id1, o1]])

    const candidates = computeSnapCandidates(map, {
      sourceObjectId: ObjectId('c'),
      cursorWorld: [0, 0, 0],
      radius: 1,
    })
    expect(candidates).toEqual([])
  })

  it('filters by category', () => {
    const [id1, o1] = makeObject(
      'a',
      [0, 0, 0],
      [1, 1, 1],
      [
        makePoint('a', [0, 0, 0], 'structural', 'sp1'),
        makePoint('a', [0.5, 0, 0], 'decorative', 'sp2'),
      ]
    )
    const map = new Map([[id1, o1]])

    const structuralOnly = computeSnapCandidates(map, {
      sourceObjectId: ObjectId('c'),
      cursorWorld: [0, 0, 0],
      radius: 10,
      enabledCategories: ['structural'],
    })
    expect(structuralOnly).toHaveLength(1)
    expect(structuralOnly[0].point.id).toBe('sp1')
  })

  it('applies host object scale to the local position', () => {
    const [id1, o1] = makeObject(
      'a',
      [10, 0, 0],
      [2, 1, 1],
      [makePoint('a', [1, 0, 0], 'structural', 'sp1')]
    )
    const map = new Map([[id1, o1]])

    const candidates = computeSnapCandidates(map, {
      sourceObjectId: ObjectId('c'),
      cursorWorld: [12, 0, 0],
      radius: 1,
    })
    expect(candidates).toHaveLength(1)
    // World position = object position + local * scale = (10, 0, 0) +
    // (1, 0, 0) * (2, 1, 1) = (12, 0, 0). Distance from cursor (12,0,0)
    // is 0.
    expect(candidates[0].distance).toBeCloseTo(0)
  })
})

describe('T51 applySnap', () => {
  it('returns the first candidate, or null if empty', () => {
    expect(applySnap([])).toBeNull()
    const c1 = {
      point: makePoint('a', [0, 0, 0], 'structural', 'sp1'),
      worldPosition: [0, 0, 0] as const,
      distance: 0,
    }
    const c2 = { ...c1, point: { ...c1.point, id: 'sp2' }, distance: 5 }
    expect(applySnap([c1, c2])?.point.id).toBe('sp1')
  })
})

describe('T51 findBestSnap', () => {
  it('combines compute + apply in one call', () => {
    const [id1, o1] = makeObject(
      'a',
      [0, 0, 0],
      [1, 1, 1],
      [makePoint('a', [0, 0, 0], 'structural', 'sp1')]
    )
    const map = new Map([[id1, o1]])

    const best = findBestSnap(map, {
      sourceObjectId: ObjectId('c'),
      cursorWorld: [0, 0, 0],
      radius: 1,
    })
    expect(best?.point.id).toBe('sp1')

    const noBest = findBestSnap(map, {
      sourceObjectId: ObjectId('c'),
      cursorWorld: [10, 10, 10],
      radius: 1,
    })
    expect(noBest).toBeNull()
  })
})

describe('T51 filterByCategory', () => {
  it('returns only candidates matching the enabled categories', () => {
    const structural = {
      point: makePoint('a', [0, 0, 0], 'structural'),
      worldPosition: [0, 0, 0] as const,
      distance: 0,
    }
    const decorative = {
      point: makePoint('a', [0, 0, 0], 'decorative'),
      worldPosition: [0, 0, 0] as const,
      distance: 0,
    }
    expect(filterByCategory([structural, decorative], ['structural'])).toEqual([structural])
  })
})

describe('T51 countByCategory', () => {
  it('returns a category-keyed object with the right counts', () => {
    const [, o1] = makeObject(
      'a',
      [0, 0, 0],
      [1, 1, 1],
      [
        makePoint('a', [0, 0, 0], 'structural', 'sp1'),
        makePoint('a', [1, 0, 0], 'structural', 'sp2'),
        makePoint('a', [2, 0, 0], 'decorative', 'sp3'),
      ]
    )
    const [, o2] = makeObject(
      'b',
      [5, 0, 0],
      [1, 1, 1],
      [makePoint('b', [0, 0, 0], 'logical', 'sp4')]
    )
    const counts = countByCategory(new Map([o1, o2].map(o => [o.id, o]) as never))
    expect(counts).toEqual({ structural: 2, decorative: 1, logical: 1 })
  })

  it('returns zero counts when no objects have snap points', () => {
    const counts = countByCategory(new Map())
    expect(counts).toEqual({ structural: 0, decorative: 0, logical: 0 })
  })
})
