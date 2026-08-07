/**
 * Auto-lighting placement (T55).
 *
 * Given a level's bounding box and a theme, derive a sensible
 * default light rig: an ambient base, a directional "sun", and a
 * grid of point lights sized so the floor gets ~one bulb per
 * `pointDensity` square units.
 *
 * This is a pure function — no DOM, no Three.js, no Zustand. The
 * caller (LightingTools) writes the resulting `LightSource[]`
 * into the editor store via `setLights`.
 */
import type { LightSource } from './lighting'
import { defaultLight } from './lighting'
import type { LightTheme } from './lightThemes'

export interface SceneBounds {
  /** World-space minimum corner. */
  min: [number, number, number]
  /** World-space maximum corner. */
  max: [number, number, number]
}

/** Density of point lights: one bulb per `1 / pointDensity` square
 *  units of floor. */
export const DEFAULT_POINT_DENSITY = 1 / 16

/**
 * Compute the floor area + a grid of point-light positions that
 * tile that area. Returns the suggested lights *without* the
 * ambient / sun — those are returned separately as `baseLights`
 * so the caller can render them above the floor grid.
 */
export function computePointLightGrid(
  bounds: SceneBounds,
  density: number = DEFAULT_POINT_DENSITY,
  ceiling: number = 3
): Array<[number, number, number]> {
  if (density <= 0) return []
  const width = bounds.max[0] - bounds.min[0]
  const depth = bounds.max[2] - bounds.min[2]
  if (width <= 0 || depth <= 0) return []
  const cols = Math.max(1, Math.ceil(width * Math.sqrt(density)))
  const rows = Math.max(1, Math.ceil(depth * Math.sqrt(density)))
  const stepX = width / cols
  const stepZ = depth / rows
  const out: Array<[number, number, number]> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = bounds.min[0] + stepX * (c + 0.5)
      const z = bounds.min[2] + stepZ * (r + 0.5)
      out.push([x, ceiling, z])
    }
  }
  return out
}

/**
 * Build the full default lighting rig for a scene: an ambient
 * base, a directional sun (centred above the bounds), and a grid
 * of point lights tiled across the floor. The id prefix is
 * required so the caller can namespace multiple rigs in the same
 * store without collision.
 */
export function autoLightPlacement(
  bounds: SceneBounds,
  theme: LightTheme,
  idPrefix: string,
  density: number = DEFAULT_POINT_DENSITY
): LightSource[] {
  const out: LightSource[] = []
  let counter = 0
  const nextId = (): string => {
    counter += 1
    return `${idPrefix}-${counter.toString(36)}`
  }

  // Ambient — every scene gets a base wash.
  const ambient = defaultLight('ambient', nextId())
  ambient.color = [...theme.ambientColor] as [number, number, number]
  ambient.intensity = theme.ambientIntensity
  ambient.name = `${theme.name} Ambient`
  out.push(ambient)

  // Sun — directional light positioned above the bounds centre,
  // angled to throw long shadows toward the front edge.
  const sun = defaultLight('directional', nextId())
  sun.color = [...theme.sunColor] as [number, number, number]
  sun.intensity = theme.sunIntensity
  sun.castShadow = theme.sunCastShadow
  sun.shadowQuality = theme.sunCastShadow ? 'soft' : 'off'
  const cx = (bounds.min[0] + bounds.max[0]) / 2
  const cz = (bounds.min[2] + bounds.max[2]) / 2
  sun.position = [cx, Math.max(bounds.max[1] - bounds.min[1], 5) * 2, cz + 4]
  sun.name = `${theme.name} Sun`
  out.push(sun)

  // Point lights tiled across the floor.
  const grid = computePointLightGrid(bounds, density)
  for (const position of grid) {
    const p = defaultLight('point', nextId())
    p.color = [...theme.pointColor] as [number, number, number]
    p.intensity = theme.pointIntensity
    p.position = position
    p.name = `${theme.name} Light ${out.length}`
    out.push(p)
  }

  return out
}

/** Convenience: round a placement result so it round-trips
 *  through `JSON.stringify` without floating-point fuzz. Used by
 *  the tests to compare against fixture values. */
export function roundedLights(lights: LightSource[]): LightSource[] {
  return lights.map(l => ({
    ...l,
    position: [
      Math.round(l.position[0] * 100) / 100,
      Math.round(l.position[1] * 100) / 100,
      Math.round(l.position[2] * 100) / 100,
    ],
    color: [
      Math.round(l.color[0] * 100) / 100,
      Math.round(l.color[1] * 100) / 100,
      Math.round(l.color[2] * 100) / 100,
    ],
    intensity: Math.round(l.intensity * 100) / 100,
  }))
}
