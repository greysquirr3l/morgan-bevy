/**
 * Tests for the lighting helpers (T55).
 *
 * Covers:
 *  - defaultLight gives sane defaults for every kind.
 *  - shadowMapSize follows the documented enum.
 *  - normalisedDirection is unit-length and handles the zero vector.
 *  - directionalContribution implements Lambert's cosine law and
 *    matches the spec example: surface at (1,1,0) brighter than (0,1,-1).
 *  - LIGHT_THEMES exposes every ThemeId and is internally consistent.
 *  - autoLightPlacement returns ambient + sun + point grid in the
 *    expected counts; computePointLightGrid scales with density.
 *  - roundedLights normalises floating-point for stable test
 *    assertions.
 */
import { describe, expect, it } from 'vitest'
import {
  autoLightPlacement,
  computePointLightGrid,
  roundedLights,
  type SceneBounds,
} from '../utils/autoLightPlacement'
import { LIGHT_THEMES, THEME_LIST, getTheme } from '../utils/lightThemes'
import {
  defaultLight,
  directionalContribution,
  normalisedDirection,
  shadowMapSize,
} from '../utils/lighting'

describe('defaultLight', () => {
  it('returns an ambient with low intensity', () => {
    const l = defaultLight('ambient', 'a1')
    expect(l.kind).toBe('ambient')
    expect(l.intensity).toBeLessThan(0.5)
    expect(l.castShadow).toBe(false)
  })

  it('returns a directional with a non-zero position', () => {
    const l = defaultLight('directional', 'd1')
    expect(l.position.some(c => c !== 0)).toBe(true)
  })

  it('returns a spot with a defined angle', () => {
    const l = defaultLight('spot', 's1')
    expect(typeof l.angle).toBe('number')
    expect(l.angle).toBeGreaterThan(0)
  })
})

describe('shadowMapSize', () => {
  it('returns 0 for off, increasing values for hard/soft/ultra', () => {
    expect(shadowMapSize('off')).toBe(0)
    expect(shadowMapSize('hard')).toBe(1024)
    expect(shadowMapSize('soft')).toBe(2048)
    expect(shadowMapSize('ultra')).toBe(4096)
  })
})

describe('normalisedDirection', () => {
  it('returns a unit-length vector for non-zero inputs', () => {
    const n = normalisedDirection([3, 4, 0])
    const len = Math.hypot(n[0], n[1], n[2])
    expect(len).toBeCloseTo(1, 6)
    expect(n[0]).toBeCloseTo(0.6, 6)
    expect(n[1]).toBeCloseTo(0.8, 6)
  })

  it('falls back to (0,-1,0) for the zero vector', () => {
    expect(normalisedDirection([0, 0, 0])).toEqual([0, -1, 0])
  })
})

describe('directionalContribution', () => {
  // T55 spec: "a directional light at (1,1,0) lights surfaces with
  // positive normal dot product brighter than (0,1,-1)".
  it('matches the spec example', () => {
    const light: [number, number, number] = [1, 1, 0]
    expect(directionalContribution(light, [1, 1, 0])).toBeGreaterThan(
      directionalContribution(light, [0, 1, -1])
    )
  })

  it('returns 0 for surfaces facing away from the light', () => {
    expect(directionalContribution([0, 1, 0], [0, -1, 0])).toBe(0)
  })

  it('clamps the dot product to [0, 1]', () => {
    // Light pointing in -Y, surface facing +Y → dot is -1, clamped to 0.
    expect(directionalContribution([0, -1, 0], [0, 1, 0])).toBe(0)
    // Light pointing exactly along the surface normal → dot is 1.
    expect(directionalContribution([0, 1, 0], [0, 1, 0])).toBeCloseTo(1, 6)
  })
})

describe('LIGHT_THEMES', () => {
  it('contains every ThemeId', () => {
    expect(Object.keys(LIGHT_THEMES).sort()).toEqual(['dungeon', 'office', 'scifi'])
  })

  it('THEME_LIST has three entries', () => {
    expect(THEME_LIST).toHaveLength(3)
  })

  it('getTheme returns the matching theme', () => {
    expect(getTheme('dungeon').name).toBe('Dungeon')
    expect(getTheme('office').name).toBe('Office')
    expect(getTheme('scifi').name).toBe('Sci-Fi')
  })

  it('every theme has sane RGB / intensity values', () => {
    for (const theme of Object.values(LIGHT_THEMES)) {
      for (const channel of theme.ambientColor) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(1)
      }
      expect(theme.ambientIntensity).toBeGreaterThanOrEqual(0)
      expect(theme.ambientIntensity).toBeLessThanOrEqual(2)
      expect(theme.sunIntensity).toBeGreaterThan(0)
      expect(theme.pointIntensity).toBeGreaterThan(0)
    }
  })
})

describe('computePointLightGrid', () => {
  const bounds: SceneBounds = { min: [0, 0, 0], max: [10, 3, 10] }

  it('returns one position per (col × row) cell of the floor', () => {
    // density = 1 → ceil(sqrt(1) * 10) = 10 rows × 10 cols = 100
    // (the helper is dense by default — caller is expected to pass
    //  a fractional density for a real-world rig).
    expect(computePointLightGrid(bounds, 1)).toHaveLength(100)
  })

  it('returns a sparser grid at lower density', () => {
    // density = 1/100 → ceil(sqrt(1/100) * 10) = 1 row × 1 col = 1
    expect(computePointLightGrid(bounds, 1 / 100)).toHaveLength(1)
  })

  it('every position lies inside (or on) the floor footprint', () => {
    const grid = computePointLightGrid(bounds, 1 / 25)
    for (const [x, _y, z] of grid) {
      expect(x).toBeGreaterThanOrEqual(bounds.min[0])
      expect(x).toBeLessThanOrEqual(bounds.max[0])
      expect(z).toBeGreaterThanOrEqual(bounds.min[2])
      expect(z).toBeLessThanOrEqual(bounds.max[2])
    }
  })

  it('returns an empty array when density is non-positive', () => {
    expect(computePointLightGrid(bounds, 0)).toEqual([])
    expect(computePointLightGrid(bounds, -1)).toEqual([])
  })

  it('returns at least one row and column even for tiny floors', () => {
    const tiny: SceneBounds = { min: [0, 0, 0], max: [1, 1, 1] }
    const grid = computePointLightGrid(tiny, 1 / 1000)
    expect(grid.length).toBeGreaterThanOrEqual(1)
  })
})

describe('autoLightPlacement', () => {
  const bounds: SceneBounds = { min: [0, 0, 0], max: [8, 3, 8] }

  it('returns exactly one ambient + one sun, plus the point grid', () => {
    const theme = getTheme('office')
    const rig = roundedLights(autoLightPlacement(bounds, theme, 'test'))
    const ambient = rig.filter(l => l.kind === 'ambient')
    const sun = rig.filter(l => l.kind === 'directional')
    const points = rig.filter(l => l.kind === 'point')
    expect(ambient).toHaveLength(1)
    expect(sun).toHaveLength(1)
    expect(points.length).toBeGreaterThan(0)
    // Total = 1 + 1 + grid count
    expect(rig.length).toBe(2 + points.length)
  })

  it('copies the theme colours onto each light', () => {
    const theme = getTheme('dungeon')
    const rig = autoLightPlacement(bounds, theme, 't')
    const ambient = rig.find(l => l.kind === 'ambient')!
    expect(ambient.color).toEqual(theme.ambientColor)
    expect(ambient.intensity).toBeCloseTo(theme.ambientIntensity, 5)
    const sun = rig.find(l => l.kind === 'directional')!
    expect(sun.color).toEqual(theme.sunColor)
    expect(sun.castShadow).toBe(theme.sunCastShadow)
  })

  it('prefixes light ids with the caller-supplied prefix', () => {
    const theme = getTheme('scifi')
    const rig = autoLightPlacement(bounds, theme, 'my-prefix')
    expect(rig.every(l => l.id.startsWith('my-prefix-'))).toBe(true)
  })

  it('roundedLights strips floating-point fuzz', () => {
    const rig = autoLightPlacement(
      bounds,
      getTheme('office'),
      'round',
      // Force non-integer positions
      1 / 3
    )
    const r = roundedLights(rig)
    for (const light of r) {
      for (const c of light.position) {
        // Each component should be representable to 2 decimals.
        expect(c).toBe(Math.round(c * 100) / 100)
      }
    }
  })
})
