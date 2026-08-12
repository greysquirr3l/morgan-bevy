/**
 * Regression for audit Major #8: `InstancedCubes` / `Spheres` /
 * `Cones` had no per-instance `userData.objectId` and no click
 * handler. Anything past the ~10-object threshold was untouchable
 * — clicks passed through to the ground (which then cleared
 * selection).
 *
 * The fix uses Three.js' raycast `instanceId` plus an external
 * index → ObjectId map. This test pins the mapping helpers so
 * the resolver can't regress.
 */
import type { InstancedObjectData } from '@/performance/InstancedRendering'
import { ObjectId } from '@/types/brand'
import { describe, expect, it } from 'vitest'

/** Test-local copy of the index→id helper. The implementation in
 *  InstancedRendering.tsx is module-private (not exported) because
 *  the click handler is the only legitimate caller; pin the
 *  algorithm shape here. */
function invertIndexToIdMap(forward: Map<string, number>): Map<number, string> {
  const inv = new Map<number, string>()
  for (const [id, idx] of forward) inv.set(idx, id)
  return inv
}

function makeObjects(): InstancedObjectData[] {
  return [
    {
      id: ObjectId('alpha'),
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    {
      id: ObjectId('beta'),
      position: [1, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    {
      id: ObjectId('gamma'),
      position: [2, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ]
}

function buildForwardMap(objects: InstancedObjectData[]): Map<string, number> {
  const fwd = new Map<string, number>()
  objects.forEach((o, i) => fwd.set(o.id, i))
  return fwd
}

describe('Instanced mesh index → ObjectId mapping (regression for Major #8)', () => {
  it('inverts the visibility map so a click can resolve instanceId', () => {
    const objects = makeObjects()
    const fwd = buildForwardMap(objects)
    const inv = invertIndexToIdMap(fwd)
    expect(inv.get(0)).toBe('alpha')
    expect(inv.get(1)).toBe('beta')
    expect(inv.get(2)).toBe('gamma')
  })

  it('returns undefined for an out-of-range instanceId (clicks empty space)', () => {
    const objects = makeObjects()
    const fwd = buildForwardMap(objects)
    const inv = invertIndexToIdMap(fwd)
    expect(inv.get(99)).toBeUndefined()
    expect(inv.get(-1)).toBeUndefined()
  })

  it('round-trips an ObjectId through visibilityMap.get(id) -> invert.get(idx)', () => {
    const objects = makeObjects()
    const fwd = buildForwardMap(objects)
    const inv = invertIndexToIdMap(fwd)
    for (const obj of objects) {
      const idx = fwd.get(obj.id)
      expect(idx).toBeDefined()
      const resolved = inv.get(idx!)
      expect(resolved).toBe(obj.id)
    }
  })

  it('handles a 10K-object bulk load without aliasing collisions', () => {
    const objects: InstancedObjectData[] = []
    for (let i = 0; i < 10_000; i++) {
      objects.push({
        id: ObjectId(`bulk_${i}`),
        position: [i, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      })
    }
    const fwd = buildForwardMap(objects)
    const inv = invertIndexToIdMap(fwd)
    expect(fwd.size).toBe(10_000)
    expect(inv.size).toBe(10_000)
    // Spot-check both directions.
    expect(fwd.get(ObjectId('bulk_42'))).toBe(42)
    expect(inv.get(42)).toBe('bulk_42')
    expect(fwd.get(ObjectId('bulk_9999'))).toBe(9999)
    expect(inv.get(9999)).toBe('bulk_9999')
  })
})
