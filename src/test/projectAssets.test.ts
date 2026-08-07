/**
 * Tests for the project-asset utilities (T20).
 *
 * Covers:
 *  - collectAssetRefs gathers distinct `material.texture` values
 *  - withAssetRefs injects an array under metadata.assetRefs without
 *    losing other fields
 *  - readAssetRefs reads back what withAssetRefs wrote
 *  - missingRefs computes the set difference correctly (including the
 *    empty / unknown-shape cases)
 */
import { describe, expect, it } from 'vitest'
import type { EditorState } from '../store/editorStore'
import type { ProjectData } from '../types/schemas'
import { collectAssetRefs, missingRefs, readAssetRefs, withAssetRefs } from '../utils/projectAssets'

function makeObj(
  id: string,
  texture?: string
): {
  id: string
  name: string
  type: 'mesh'
  material?: { baseColor: string; metallic: number; roughness: number; texture?: string }
} {
  return {
    id,
    name: id,
    type: 'mesh',
    material: texture ? { baseColor: '#fff', metallic: 0, roughness: 1, texture } : undefined,
  }
}

describe('collectAssetRefs', () => {
  it('returns an empty list when there are no textures', () => {
    const state = {
      sceneObjects: new Map([['a', makeObj('a')]]),
    } as unknown as Pick<EditorState, 'sceneObjects'>
    expect(collectAssetRefs(state)).toEqual([])
  })

  it('deduplicates identical texture paths', () => {
    const state = {
      sceneObjects: new Map([
        ['a', makeObj('a', 'wall.png')],
        ['b', makeObj('b', 'wall.png')],
        ['c', makeObj('c', 'floor.png')],
      ]),
    } as unknown as Pick<EditorState, 'sceneObjects'>
    expect(collectAssetRefs(state).sort()).toEqual(['floor.png', 'wall.png'])
  })

  it('skips objects with no material', () => {
    const state = {
      sceneObjects: new Map([
        ['a', makeObj('a')],
        ['b', makeObj('b', 'wall.png')],
      ]),
    } as unknown as Pick<EditorState, 'sceneObjects'>
    expect(collectAssetRefs(state)).toEqual(['wall.png'])
  })
})

describe('withAssetRefs', () => {
  const base: ProjectData = {
    schemaVersion: 1,
    scene: {},
    metadata: { name: 'office', savedAt: '2026-01-01T00:00:00Z' },
  }

  it('injects assetRefs under metadata without dropping fields', () => {
    const out = withAssetRefs(base, ['wall.png'])
    expect(out.metadata).toMatchObject({
      name: 'office',
      savedAt: '2026-01-01T00:00:00Z',
      assetRefs: ['wall.png'],
    })
  })

  it('handles project payloads with no metadata at all', () => {
    const noMeta: ProjectData = { schemaVersion: 1, scene: {} }
    const out = withAssetRefs(noMeta, ['wall.png'])
    expect(out.metadata).toEqual({ assetRefs: ['wall.png'] })
  })

  it('preserves the original metadata reference (does not mutate)', () => {
    const original = { ...base }
    withAssetRefs(base, ['wall.png'])
    expect(base).toEqual(original)
  })
})

describe('readAssetRefs', () => {
  it('returns an empty array when metadata has no assetRefs field', () => {
    const pd: ProjectData = { schemaVersion: 1, scene: {}, metadata: {} }
    expect(readAssetRefs(pd)).toEqual([])
  })

  it('filters out non-string entries (defensive against schema drift)', () => {
    const pd: ProjectData = {
      schemaVersion: 1,
      scene: {},
      metadata: { assetRefs: ['ok.png', 42, null, 'also-ok.png'] } as never,
    }
    expect(readAssetRefs(pd)).toEqual(['ok.png', 'also-ok.png'])
  })

  it('round-trips through withAssetRefs / readAssetRefs', () => {
    const original = ['wall.png', 'floor.png', 'ceiling.png']
    const pd = withAssetRefs({ schemaVersion: 1, scene: {}, metadata: { name: 'x' } }, original)
    expect(readAssetRefs(pd).sort()).toEqual([...original].sort())
  })
})

describe('missingRefs', () => {
  it('returns the set difference (candidates minus known)', () => {
    const known = new Set(['a.png', 'b.png'])
    const candidates = ['a.png', 'b.png', 'c.png', 'd.png']
    expect(missingRefs(known, candidates).sort()).toEqual(['c.png', 'd.png'])
  })

  it('returns all candidates when known is empty', () => {
    expect(missingRefs(new Set(), ['x', 'y'])).toEqual(['x', 'y'])
  })

  it('returns an empty list when every candidate is known', () => {
    expect(missingRefs(new Set(['x', 'y']), ['x', 'y'])).toEqual([])
  })

  it('accepts any iterable on both sides', () => {
    const known = new Set(['a'])
    function* gen() {
      yield 'a'
      yield 'b'
    }
    expect(missingRefs(known, gen())).toEqual(['b'])
  })
})
