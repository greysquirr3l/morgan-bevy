/**
 * T52 — Surface snapping math.
 *
 * Contract pinned:
 *  - `surfaceSnapTarget` aligns local Y with the surface normal.
 *  - Yaw is preserved from the current world-Y projected onto
 *    the surface plane.
 *  - The `offset` parameter moves the chosen local point of the
 *    object to the hit point (so e.g. the object's bottom lands
 *    on the surface).
 *  - Degenerate normal (zero) falls back to position-only.
 *  - `resolveDragTarget` composes object snap (preferred) with
 *    surface snap (fallback) per the spec.
 */
import { describe, expect, it } from 'vitest'

import type { SceneObject } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'
import {
  resolveDragTarget,
  surfaceSnapTarget,
  type SurfaceHit,
} from '@/utils/surfaceSnap'
import { mintSnapPointId, type SnapPoint } from '@/types/snapPoints'

type Vec3 = readonly [number, number, number]

const EPSILON = 1e-6
const ZERO_ROT: Vec3 = [0, 0, 0]

/** Two vectors are equal up to a small epsilon. */
function expectClose(a: Vec3, b: Vec3, eps = 1e-4): void {
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(eps)
  }
}

describe('T52 surfaceSnapTarget', () => {
  it('aligns the object so its Y axis points along the surface normal', () => {
    // Hit on a flat ground (normal = +Y). Default object rotation
    // is identity (Y up), so the new rotation should also be near
    // identity.
    const hit: SurfaceHit = { point: [0, 0, 0], normal: [0, 1, 0] }
    const target = surfaceSnapTarget(hit, ZERO_ROT)
    expectClose(target.position, [0, 0, 0])
    // Yaw is near zero, pitch is near zero, roll is near zero.
    expect(Math.abs(target.rotation[0])).toBeLessThan(EPSILON)
    expect(Math.abs(target.rotation[1])).toBeLessThan(EPSILON)
    expect(Math.abs(target.rotation[2])).toBeLessThan(EPSILON)
  })

  it('aligns Y with a tilted surface (45° wall)', () => {
    // Surface normal: (sin(45), 0, cos(45)). The object's local Y
    // should end up along this direction.
    const hit: SurfaceHit = {
      point: [5, 0, 5],
      normal: [Math.SQRT1_2, 0, Math.SQRT1_2],
    }
    const target = surfaceSnapTarget(hit, ZERO_ROT, [0, 0, 0])
    expectClose(target.position, [5, 0, 5])
    // By right-hand rule, rotating the object so +Y goes to
    // (sin 45, 0, cos 45) means rotating +π/4 around the X axis.
    // (Tilting +Y toward +Z is a positive-X rotation.)
    expect(Math.abs(target.rotation[0] - Math.PI / 4)).toBeLessThan(1e-3)
  })

  it('respects the localOffset parameter', () => {
    // Convention: `offset` is the local point on the object that
    // should land on the hit. Hit at (0, 0, 0); offset = (0, 0.5, 0)
    // (the point 0.5 above the object's centre). The object
    // position should be (0, -0.5, 0) so the offset point lands at
    // the hit.
    const hit: SurfaceHit = { point: [0, 0, 0], normal: [0, 1, 0] }
    const target = surfaceSnapTarget(hit, ZERO_ROT, [0, 0.5, 0])
    expectClose(target.position, [0, -0.5, 0])
  })

  it('preserves yaw from the current world-Y projection', () => {
    // Object is currently rotated 90° around Y. Hit on the ground
    // — yaw should be preserved (≈ 90°). Pitch + roll near zero.
    const hit: SurfaceHit = { point: [0, 0, 0], normal: [0, 1, 0] }
    const target = surfaceSnapTarget(hit, [0, Math.PI / 2, 0])
    expect(Math.abs(target.rotation[0])).toBeLessThan(EPSILON)
    expect(Math.abs(target.rotation[1] - Math.PI / 2)).toBeLessThan(1e-3)
    expect(Math.abs(target.rotation[2])).toBeLessThan(EPSILON)
  })

  it('falls back to position-only on a degenerate (zero) normal', () => {
    const hit: SurfaceHit = { point: [3, 4, 5], normal: [0, 0, 0] }
    const target = surfaceSnapTarget(hit, ZERO_ROT)
    expectClose(target.position, [3, 4, 5])
    expectClose(target.rotation, ZERO_ROT)
  })

  it('rotates local Y to the new normal even when the current up is already aligned', () => {
    // If the current up is already the normal, we have no useful
    // yaw to preserve — pick a stable up (world Y) as the reference.
    // The new rotation's world-Y should still be the hit normal.
    const hit: SurfaceHit = { point: [0, 0, 0], normal: [0, 1, 0] }
    const target = surfaceSnapTarget(hit, ZERO_ROT)
    // The local Y axis (after rotation) should equal the normal.
    // Easiest check: the new matrix's Y column should be (0, 1, 0).
    // We don't have direct access to the matrix, but the rotation
    // Euler should be near zero (identity) and the rotation should
    // place Y at the normal — which we can test by checking that
    // a +Y local vector (rotated) ends up at the world normal.
    // For this simple test, just assert rotation is near zero.
    expect(Math.abs(target.rotation[0])).toBeLessThan(EPSILON)
    expect(Math.abs(target.rotation[1])).toBeLessThan(EPSILON)
    expect(Math.abs(target.rotation[2])).toBeLessThan(EPSILON)
  })
})

describe('T52 resolveDragTarget', () => {
  function makeObject(
    id: string,
    position: [number, number, number],
    points: SnapPoint[] = []
  ): [ObjectId, SceneObject] {
    const obj: SceneObject = {
      id: ObjectId(id),
      name: id,
      type: 'mesh',
      position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      layerId: LayerId('default'),
      children: [],
      meshType: 'cube',
      ...(points.length > 0 ? { snapPoints: points } : {}),
    }
    return [ObjectId(id), obj]
  }

  it('uses an object snap point when one is within radius', () => {
    // Host object with a snap point at world (5, 0, 0). Cursor
    // is at (4.9, 0, 0) — well within 1m.
    const [id1, o1] = makeObject('a', [5, 0, 0], [
      {
        id: mintSnapPointId(),
        objectId: 'a',
        localPosition: [0, 0, 0],
        localRotation: [0, 0, 0, 1],
        label: 'frame',
        category: 'structural',
      },
    ])
    const [id2, o2] = makeObject('b', [10, 0, 0])
    const map = new Map([
      [id1, o1],
      [id2, o2],
    ])

    const hit: SurfaceHit = { point: [100, 0, 0], normal: [0, 1, 0] }
    const result = resolveDragTarget(map, {
      sourceObjectId: ObjectId('b'),
      cursorWorld: [4.9, 0, 0],
      surfaceHit: hit,
      currentWorldRotation: ZERO_ROT,
    })
    expect(result.source).toBe('object')
    expect(result.candidate).toBeDefined()
    // Object B's local offset is (0,0,0) by default, so the
    // position should equal the snap point's world position.
    expectClose(result.position, [5, 0, 0])
  })

  it('falls back to surface snap when no object snap is within radius', () => {
    // No snap points at all. Surface hit at (3, 0, 0) with
    // normal +Y.
    const [id1, o1] = makeObject('a', [0, 0, 0])
    const map = new Map([[id1, o1]])

    const hit: SurfaceHit = { point: [3, 0, 0], normal: [0, 1, 0] }
    const result = resolveDragTarget(map, {
      sourceObjectId: ObjectId('b'),
      cursorWorld: [3, 0, 0],
      surfaceHit: hit,
      currentWorldRotation: ZERO_ROT,
    })
    expect(result.source).toBe('surface')
    expectClose(result.position, [3, 0, 0])
  })

  it('returns "none" when neither an object snap nor a surface hit applies', () => {
    const [id1, o1] = makeObject('a', [0, 0, 0])
    const map = new Map([[id1, o1]])

    const result = resolveDragTarget(map, {
      sourceObjectId: ObjectId('b'),
      cursorWorld: [7, 0, 0],
      currentWorldRotation: ZERO_ROT,
    })
    expect(result.source).toBe('none')
    expectClose(result.position, [7, 0, 0])
  })

  it('object snap takes precedence over surface snap within radius', () => {
    // Object snap at (5, 0, 0) — within 1m of cursor. Surface
    // hit at (3, 0, 0). Object snap should win.
    const [id1, o1] = makeObject('a', [5, 0, 0], [
      {
        id: mintSnapPointId(),
        objectId: 'a',
        localPosition: [0, 0, 0],
        localRotation: [0, 0, 0, 1],
        label: 'frame',
        category: 'structural',
      },
    ])
    const [id2, o2] = makeObject('b', [10, 0, 0])
    const map = new Map([
      [id1, o1],
      [id2, o2],
    ])

    const hit: SurfaceHit = { point: [3, 0, 0], normal: [0, 1, 0] }
    const result = resolveDragTarget(map, {
      sourceObjectId: ObjectId('b'),
      cursorWorld: [5, 0, 0], // exactly on the object snap
      surfaceHit: hit,
      currentWorldRotation: ZERO_ROT,
    })
    expect(result.source).toBe('object')
    // Position is the object snap's world position — NOT the
    // surface hit's position.
    expectClose(result.position, [5, 0, 0])
  })
})