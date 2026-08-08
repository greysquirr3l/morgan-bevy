/**
 * T54 — material paint tool: pure brush math.
 *
 * Contract pinned:
 *  - `brushFalloffWeight` is 1 at the centre, 0 outside the radius,
 *    for all three curves; `flat` is a hard mask (always 1 inside).
 *  - `computeBrushHits` is pure: calling it twice with a different
 *    `radius` never mutates the first call's result — "brush radius
 *    changes do not affect already-painted pixels until re-applied"
 *    (required test).
 *  - `selectPaintTargets` never returns locked objects, even when
 *    they're the closest thing to the brush centre (lock-state
 *    exit criterion).
 *  - `flat` vs `smooth` falloff can select different object sets at
 *    the same brush centre/radius (edge case).
 */
import type { SceneObject } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'
import {
  BRUSH_FALLOFFS,
  brushFalloffWeight,
  computeBrushHits,
  DEFAULT_MIN_BRUSH_WEIGHT,
  distance3D,
  selectPaintTargets,
  type BrushCandidate,
} from '@/utils/paintTool'
import { describe, expect, it } from 'vitest'

function makeMesh(id: string, position: [number, number, number], locked = false): SceneObject {
  return {
    id: ObjectId(id),
    name: id,
    type: 'mesh',
    meshType: 'cube',
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked,
    layerId: LayerId('default'),
    children: [],
  }
}

describe('brushFalloffWeight', () => {
  it('is 1 at the brush centre for every falloff', () => {
    for (const falloff of BRUSH_FALLOFFS) {
      expect(brushFalloffWeight(0, 5, falloff)).toBeCloseTo(1)
    }
  })

  it('is 0 outside the radius for every falloff', () => {
    for (const falloff of BRUSH_FALLOFFS) {
      expect(brushFalloffWeight(5.01, 5, falloff)).toBe(0)
    }
  })

  it('is 0 for a non-positive radius', () => {
    expect(brushFalloffWeight(0, 0, 'flat')).toBe(0)
    expect(brushFalloffWeight(0, -1, 'linear')).toBe(0)
  })

  it('flat is a hard mask: full weight anywhere inside the radius', () => {
    expect(brushFalloffWeight(4.99, 5, 'flat')).toBe(1)
    expect(brushFalloffWeight(0.5, 5, 'flat')).toBe(1)
  })

  it('linear ramps proportionally to distance', () => {
    expect(brushFalloffWeight(2.5, 5, 'linear')).toBeCloseTo(0.5)
  })

  it('smooth is flatter near the centre and steeper near the edge than linear', () => {
    // Near the centre (small distance / large x = 1 - t): smooth >= linear.
    const nearCentreLinear = brushFalloffWeight(0.5, 5, 'linear')
    const nearCentreSmooth = brushFalloffWeight(0.5, 5, 'smooth')
    expect(nearCentreSmooth).toBeGreaterThan(nearCentreLinear)

    // Near the edge (large distance / small x): smooth <= linear.
    const nearEdgeLinear = brushFalloffWeight(4.5, 5, 'linear')
    const nearEdgeSmooth = brushFalloffWeight(4.5, 5, 'smooth')
    expect(nearEdgeSmooth).toBeLessThan(nearEdgeLinear)
  })
})

describe('computeBrushHits', () => {
  it('includes candidates within radius and excludes those outside', () => {
    const candidates: BrushCandidate[] = [
      { id: 'near', distance: 1 },
      { id: 'edge', distance: 4.9 },
      { id: 'far', distance: 10 },
    ]
    const hits = computeBrushHits(candidates, { radius: 5, falloff: 'flat' })
    expect(hits.map(h => h.id).sort()).toEqual(['edge', 'near'])
  })

  it('is pure — a later call with a larger radius does not retroactively change an earlier result (required test)', () => {
    const candidates: BrushCandidate[] = [
      { id: 'inner', distance: 1 },
      { id: 'outer', distance: 3 },
    ]

    // First stroke: small radius, only "inner" is under the brush.
    const firstStrokeHits = computeBrushHits(candidates, { radius: 1.5, falloff: 'flat' })
    expect(firstStrokeHits.map(h => h.id)).toEqual(['inner'])

    // The caller now increases the brush radius (e.g. the user drags
    // the radius slider) — this alone must not change what the
    // FIRST stroke touched. `firstStrokeHits` is a plain array
    // snapshot; nothing about calling `computeBrushHits` again can
    // reach back and mutate it.
    const secondStrokeHits = computeBrushHits(candidates, { radius: 5, falloff: 'flat' })
    expect(firstStrokeHits.map(h => h.id)).toEqual(['inner']) // unchanged
    // Only a NEW, explicit call (simulating "re-applying" the brush
    // at the larger radius) picks up the previously-out-of-range object.
    expect(secondStrokeHits.map(h => h.id).sort()).toEqual(['inner', 'outer'])
  })

  it('drops hits below the minimum weight threshold', () => {
    const candidates: BrushCandidate[] = [{ id: 'barely-in', distance: 4.99 }]
    const hits = computeBrushHits(candidates, { radius: 5, falloff: 'smooth' }, 0.5)
    expect(hits).toEqual([])
  })

  it('flat vs smooth can select different object sets at the same radius (edge case)', () => {
    // A point close to the edge of the brush: `flat` always weights
    // it 1 (in-range = fully in); `smooth`'s falloff drops fast near
    // the edge and lands below the default minimum weight.
    const nearEdgeDistance = 4.9
    const radius = 5
    const candidates: BrushCandidate[] = [{ id: 'edge-object', distance: nearEdgeDistance }]

    const flatHits = computeBrushHits(candidates, { radius, falloff: 'flat' })
    const smoothHits = computeBrushHits(candidates, { radius, falloff: 'smooth' })

    expect(flatHits.map(h => h.id)).toEqual(['edge-object'])
    expect(smoothHits.map(h => h.id)).toEqual([])
    expect(brushFalloffWeight(nearEdgeDistance, radius, 'smooth')).toBeLessThan(
      DEFAULT_MIN_BRUSH_WEIGHT
    )
  })
})

describe('distance3D', () => {
  it('computes Euclidean distance', () => {
    expect(distance3D([0, 0, 0], [3, 4, 0])).toBeCloseTo(5)
  })
})

describe('selectPaintTargets', () => {
  it('selects mesh objects within the brush radius of the hit point', () => {
    const scene = new Map<ObjectId, SceneObject>([
      [ObjectId('a'), makeMesh('a', [0, 0, 0])],
      [ObjectId('b'), makeMesh('b', [1, 0, 0])],
      [ObjectId('c'), makeMesh('c', [10, 0, 0])],
    ])
    const targets = selectPaintTargets(scene, [0, 0, 0], { radius: 2, falloff: 'flat' })
    expect(targets.sort()).toEqual([ObjectId('a'), ObjectId('b')].sort())
  })

  it('never selects a locked object, even when it is closest to the brush centre (lock-state exit criterion)', () => {
    const scene = new Map<ObjectId, SceneObject>([
      [ObjectId('locked-target'), makeMesh('locked-target', [0, 0, 0], true)],
      [ObjectId('unlocked-neighbour'), makeMesh('unlocked-neighbour', [0.5, 0, 0], false)],
    ])
    const targets = selectPaintTargets(scene, [0, 0, 0], { radius: 2, falloff: 'flat' })
    expect(targets).toEqual([ObjectId('unlocked-neighbour')])
  })

  it('returns an empty array (a no-op stroke) when every candidate under the brush is locked', () => {
    const scene = new Map<ObjectId, SceneObject>([
      [ObjectId('only-locked'), makeMesh('only-locked', [0, 0, 0], true)],
    ])
    const targets = selectPaintTargets(scene, [0, 0, 0], { radius: 2, falloff: 'flat' })
    expect(targets).toEqual([])
  })

  it('ignores non-mesh objects (e.g. lights/groups have no material slot)', () => {
    const light: SceneObject = { ...makeMesh('light-1', [0, 0, 0]), type: 'light', meshType: undefined }
    const scene = new Map<ObjectId, SceneObject>([[ObjectId('light-1'), light]])
    const targets = selectPaintTargets(scene, [0, 0, 0], { radius: 2, falloff: 'flat' })
    expect(targets).toEqual([])
  })
})
