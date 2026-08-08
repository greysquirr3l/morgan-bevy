import { describe, expect, it, vi } from 'vitest'
import { deserializeMap, serializeMap } from '@/store/mapSerialization'
import { isObjectId, ObjectId } from '@/types/brand'

describe('serializeMap / deserializeMap', () => {
  it('round-trips a Map through JSON, preserving every entry', () => {
    const source = new Map([
      [ObjectId('cube_1'), { name: 'Cube' }],
      [ObjectId('sphere_1'), { name: 'Sphere' }],
      [ObjectId('group_1'), { name: 'Group' }],
    ])

    const json = JSON.stringify(serializeMap(source))
    const restored = deserializeMap<ObjectId, { name: string }>(JSON.parse(json), isObjectId)

    expect(restored.size).toBe(source.size)
    for (const [id, value] of source) {
      expect(restored.get(id)).toEqual(value)
    }
  })

  it('preserves insertion order across the round trip', () => {
    const source = new Map([
      [ObjectId('third_id'), 3],
      [ObjectId('first_id'), 1],
      [ObjectId('second_id'), 2],
    ])
    const restored = deserializeMap<ObjectId, number>(serializeMap(source), isObjectId)
    expect(Array.from(restored.keys())).toEqual(['third_id', 'first_id', 'second_id'])
  })

  it('accepts a legacy Record<string, V> shape for backward compatibility', () => {
    const legacy = { cube_1: { name: 'Cube' }, sphere_1: { name: 'Sphere' } }
    const restored = deserializeMap<ObjectId, { name: string }>(legacy, isObjectId)
    expect(restored.size).toBe(2)
    expect(restored.get(ObjectId('cube_1'))).toEqual({ name: 'Cube' })
  })

  it('drops entries with an invalid key instead of discarding the whole payload', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const raw: Array<[unknown, unknown]> = [
      ['ok_id_1', { name: 'Kept' }],
      ['', { name: 'Dropped: empty string fails ID_PATTERN' }],
      [42, { name: 'Dropped: non-string key' }],
    ]
    const restored = deserializeMap<ObjectId, { name: string }>(raw, isObjectId)
    expect(restored.size).toBe(1)
    expect(restored.get(ObjectId('ok_id_1'))).toEqual({ name: 'Kept' })
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('returns an empty Map for null/undefined/non-object input', () => {
    expect(deserializeMap(null, isObjectId).size).toBe(0)
    expect(deserializeMap(undefined, isObjectId).size).toBe(0)
    expect(deserializeMap('not an object', isObjectId).size).toBe(0)
  })
})
