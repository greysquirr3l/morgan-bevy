/**
 * Lighting theme presets (T55).
 *
 * Each theme defines the colour palette + intensity profile the
 * `autoLightPlacement` helper uses when seeding lights into a
 * freshly-generated level. The user can override per-light after
 * auto-placement (that's a separate UI flow in LightingTools).
 *
 * Themes are plain data — no I/O, no DOM — so they're trivial to
 * unit-test.
 */

export type ThemeId = 'office' | 'dungeon' | 'scifi'

export interface LightTheme {
  id: ThemeId
  name: string
  /** Ambient base colour (linear RGB). */
  ambientColor: [number, number, number]
  /** Ambient intensity multiplier. */
  ambientIntensity: number
  /** Directional "sun" colour. */
  sunColor: [number, number, number]
  /** Directional "sun" intensity. */
  sunIntensity: number
  /** Per-area point-light intensity (1.0 = standard bulb). */
  pointIntensity: number
  /** Point-light colour. */
  pointColor: [number, number, number]
  /** Whether the sun casts shadows. */
  sunCastShadow: boolean
}

export const LIGHT_THEMES: Record<ThemeId, LightTheme> = {
  office: {
    id: 'office',
    name: 'Office',
    ambientColor: [0.95, 0.92, 0.86],
    ambientIntensity: 0.55,
    sunColor: [1.0, 0.96, 0.88],
    sunIntensity: 0.9,
    pointIntensity: 0.6,
    pointColor: [1.0, 0.95, 0.85],
    sunCastShadow: true,
  },
  dungeon: {
    id: 'dungeon',
    name: 'Dungeon',
    ambientColor: [0.18, 0.22, 0.32],
    ambientIntensity: 0.18,
    sunColor: [0.7, 0.78, 1.0],
    sunIntensity: 0.35,
    pointIntensity: 1.1,
    pointColor: [1.0, 0.78, 0.45],
    sunCastShadow: true,
  },
  scifi: {
    id: 'scifi',
    name: 'Sci-Fi',
    ambientColor: [0.12, 0.18, 0.28],
    ambientIntensity: 0.22,
    sunColor: [0.85, 0.92, 1.0],
    sunIntensity: 0.6,
    pointIntensity: 0.8,
    pointColor: [0.4, 0.85, 1.0],
    sunCastShadow: true,
  },
}

export const THEME_LIST: LightTheme[] = Object.values(LIGHT_THEMES)

export function getTheme(id: ThemeId): LightTheme {
  return LIGHT_THEMES[id]
}
