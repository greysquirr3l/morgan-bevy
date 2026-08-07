/**
 * Tests for the smart-folder filter mirror (T32).
 *
 * The Rust side owns the canonical evaluation; this test covers the
 * in-memory mirror used by the asset browser for instant previews.
 */
import { describe, expect, it } from 'vitest'
import { type AssetSmartFolderFilter, matchesFilter } from '../types/assetDatabase'

describe('matchesFilter', () => {
  const baseAsset = { asset_type: 'texture', name: 'wall.png' }

  it('returns true for an empty filter', () => {
    expect(matchesFilter(baseAsset, {}, new Set())).toBe(true)
  })

  it('matches the asset_type exactly', () => {
    expect(matchesFilter(baseAsset, { asset_type: 'texture' }, new Set())).toBe(true)
    expect(matchesFilter(baseAsset, { asset_type: 'model' }, new Set())).toBe(false)
  })

  it('requires every listed tag to be in the asset-tag set (AND)', () => {
    const tags = new Set(['wall', 'stone'])
    const filter: AssetSmartFolderFilter = { tags: ['wall', 'stone'] }
    expect(matchesFilter(baseAsset, filter, tags)).toBe(true)

    const partialTags = new Set(['wall'])
    expect(matchesFilter(baseAsset, filter, partialTags)).toBe(false)
  })

  it('skips the tag constraint when filter.tags is empty', () => {
    expect(matchesFilter(baseAsset, { tags: [] }, new Set(['unused']))).toBe(true)
  })

  it('respects favorite_only when the asset exposes the flag', () => {
    const filter: AssetSmartFolderFilter = { favorite_only: true }
    expect(matchesFilter({ ...baseAsset, is_favorite: true }, filter, new Set())).toBe(true)
    expect(matchesFilter({ ...baseAsset, is_favorite: false }, filter, new Set())).toBe(false)
    // Missing flag is treated as not favourited.
    expect(matchesFilter(baseAsset, filter, new Set())).toBe(false)
  })

  it('combines all three constraints with AND', () => {
    const tags = new Set(['wall'])
    const filter: AssetSmartFolderFilter = {
      asset_type: 'texture',
      tags: ['wall'],
      favorite_only: true,
    }
    expect(matchesFilter({ ...baseAsset, is_favorite: true }, filter, tags)).toBe(true)
    // Wrong type → no.
    expect(
      matchesFilter({ ...baseAsset, asset_type: 'model', is_favorite: true }, filter, tags)
    ).toBe(false)
    // Missing tag → no.
    expect(matchesFilter({ ...baseAsset, is_favorite: true }, filter, new Set([]))).toBe(false)
    // Not favourite → no.
    expect(matchesFilter({ ...baseAsset, is_favorite: false }, filter, tags)).toBe(false)
  })
})
