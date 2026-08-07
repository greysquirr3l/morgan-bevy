/**
 * Tests for the material-preset helpers (T18).
 *
 * Covers:
 *  - DEFAULT_PRESETS is non-empty and well-formed
 *  - listMaterialPresets combines defaults + custom + tolerates
 *    corrupt localStorage payloads
 *  - saveMaterialPreset / deleteMaterialPreset round-trip via the
 *    real localStorage mock
 *  - effectiveMaterial resolves preset + overrides correctly,
 *    including the case where overrides introduce a texture the
 *    base doesn't have
 *  - newPresetId produces stable, slugged ids
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PRESETS,
  deleteMaterialPreset,
  effectiveMaterial,
  listMaterialPresets,
  newPresetId,
  saveMaterialPreset,
  type MaterialPreset,
} from '../utils/materialPresets'

const STORAGE_KEY = 'morgan-bevy-material-presets'

const samplePreset: MaterialPreset = {
  id: 'unit-test-preset',
  name: 'Test Preset',
  baseColor: '#abcdef',
  metallic: 0.25,
  roughness: 0.75,
  emissive: '#112233',
  emissiveIntensity: 0.5,
  texture: '/tmp/wall.png',
}

describe('DEFAULT_PRESETS', () => {
  it('contains at least one entry', () => {
    expect(DEFAULT_PRESETS.length).toBeGreaterThan(0)
  })

  it('has unique ids across the shipped set', () => {
    const ids = new Set(DEFAULT_PRESETS.map(p => p.id))
    expect(ids.size).toBe(DEFAULT_PRESETS.length)
  })

  it('every entry has non-empty name and id', () => {
    for (const p of DEFAULT_PRESETS) {
      expect(p.id.length).toBeGreaterThan(0)
      expect(p.name.length).toBeGreaterThan(0)
    }
  })
})

describe('listMaterialPresets', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  it('returns just the defaults when nothing is in localStorage', () => {
    const list = listMaterialPresets()
    expect(list).toEqual([...DEFAULT_PRESETS])
  })

  it('appends custom presets from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([samplePreset]))
    const list = listMaterialPresets()
    // `toContain` compares by reference; after JSON.parse the
    // stored preset is a different object. Assert on the id and
    // field-level equality instead.
    expect(list.find(p => p.id === samplePreset.id)).toEqual(samplePreset)
    // Defaults still present.
    expect(list.length).toBe(DEFAULT_PRESETS.length + 1)
  })

  it('drops malformed entries (schema-drift tolerance)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        samplePreset,
        { id: 'broken' /* missing required fields */ },
        'not-an-object',
      ])
    )
    const list = listMaterialPresets()
    // Only samplePreset is valid from the custom set.
    expect(list.filter(p => p.id === samplePreset.id)).toHaveLength(1)
    expect(list.length).toBe(DEFAULT_PRESETS.length + 1)
  })

  it('falls back to defaults on a corrupt JSON payload', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(listMaterialPresets()).toEqual([...DEFAULT_PRESETS])
  })
})

describe('saveMaterialPreset + deleteMaterialPreset', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  it('persists a custom preset and survives a list refresh', () => {
    saveMaterialPreset(samplePreset)
    expect(listMaterialPresets().find(p => p.id === samplePreset.id)).toEqual(samplePreset)
  })

  it('overwrites an existing preset with the same id', () => {
    saveMaterialPreset(samplePreset)
    const updated: MaterialPreset = { ...samplePreset, baseColor: '#000000' }
    saveMaterialPreset(updated)
    const stored = listMaterialPresets().filter(p => p.id === samplePreset.id)
    expect(stored).toHaveLength(1)
    expect(stored[0].baseColor).toBe('#000000')
  })

  it('deleteMaterialPreset removes a custom preset and returns the rest', () => {
    saveMaterialPreset(samplePreset)
    const remaining = deleteMaterialPreset(samplePreset.id)
    expect(remaining.find(p => p.id === samplePreset.id)).toBeUndefined()
    expect(listMaterialPresets().find(p => p.id === samplePreset.id)).toBeUndefined()
  })
})

describe('effectiveMaterial', () => {
  const base: MaterialPreset = {
    id: 'base-preset',
    name: 'Base',
    baseColor: '#111111',
    metallic: 0.1,
    roughness: 0.9,
    emissive: '#222222',
    emissiveIntensity: 0.0,
  }

  it('returns base values when there is no instance', () => {
    expect(effectiveMaterial(base, undefined)).toEqual({
      baseColor: '#111111',
      metallic: 0.1,
      roughness: 0.9,
      emissive: '#222222',
      emissiveIntensity: 0.0,
    })
  })

  it('returns a sensible fallback when there is no preset and no instance', () => {
    const eff = effectiveMaterial(undefined, undefined)
    expect(eff.baseColor).toMatch(/^#/)
    expect(typeof eff.metallic).toBe('number')
  })

  it('overrides win over the base', () => {
    const eff = effectiveMaterial(base, {
      presetId: base.id,
      overrides: { baseColor: '#ff0000', metallic: 0.5 },
    })
    expect(eff.baseColor).toBe('#ff0000')
    expect(eff.metallic).toBe(0.5)
    // Untouched fields fall through to the base.
    expect(eff.roughness).toBe(0.9)
    expect(eff.emissive).toBe('#222222')
  })

  it('a texture override is applied when the base has none', () => {
    const eff = effectiveMaterial(base, {
      presetId: base.id,
      overrides: { texture: '/tmp/overridden.png' },
    })
    expect(eff.texture).toBe('/tmp/overridden.png')
  })

  it('a base texture survives when no override is supplied', () => {
    const withTexture: MaterialPreset = { ...base, texture: '/tmp/base.png' }
    const eff = effectiveMaterial(withTexture, {
      presetId: withTexture.id,
      overrides: { metallic: 0.7 },
    })
    expect(eff.texture).toBe('/tmp/base.png')
    expect(eff.metallic).toBe(0.7)
  })
})

describe('newPresetId', () => {
  it('produces non-empty, lowercase, hyphenated ids', () => {
    const id = newPresetId('Brick Wall')
    expect(id).toMatch(/^[a-z0-9-]+$/)
    expect(id.length).toBeGreaterThan(0)
  })

  it('handles empty / whitespace names with a fallback', () => {
    const id = newPresetId('   ')
    expect(id.startsWith('preset-')).toBe(true)
  })

  it('successive ids differ (random suffix)', () => {
    const a = newPresetId('Same Name')
    const b = newPresetId('Same Name')
    expect(a).not.toBe(b)
  })
})
