/**
 * Lighting data model (T55).
 *
 * `LightSource` is the typed shape the editor stores in its
 * scene. The discriminant `kind` maps onto a Three.js light:
 *
 *  - `ambient`     -> THREE.AmbientLight
 *  - `directional` -> THREE.DirectionalLight (sun-style)
 *  - `point`       -> THREE.PointLight (bulb-style)
 *  - `spot`        -> THREE.SpotLight (cone)
 *
 * The shadow-quality enum is a UI-level knob: 'off' means no
 * shadow, 'hard' / 'soft' / 'ultra' map onto `PCFShadowMap` /
 * `PCFSoftShadowMap` / `PCFSoftShadowMap` + larger map.
 *
 * Mirrors the Bevy 0.19 lighting components in the Bevy-side
 * contract (`DirectionalLightBundle`, `PointLightBundle`,
 * `SpotLightBundle`, `AmbientLight`).
 */

export type LightKind = 'ambient' | 'directional' | 'point' | 'spot'

/** T55: shadow-quality knob mapped onto Three.js shadow maps. */
export type ShadowQuality = 'off' | 'hard' | 'soft' | 'ultra'

export interface LightSource {
  /** Stable id used for selection and store lookups. */
  id: string
  /** Light kind — drives which Three.js light class is rendered. */
  kind: LightKind
  /** World position. Ignored by `ambient`. */
  position: [number, number, number]
  /** Linear RGB colour in [0, 1]. */
  color: [number, number, number]
  /** Light intensity in candela (point / spot) or lux-ish
   *  (directional). Ambient uses an additive multiplier. */
  intensity: number
  /** Spot-light cone half-angle, in radians. Ignored for other kinds. */
  angle?: number
  /** Whether the light contributes to the shadow pass. */
  castShadow: boolean
  /** Shadow-quality preset. */
  shadowQuality: ShadowQuality
  /** Optional human-readable label shown in the hierarchy. */
  name?: string
}

/** Default `LightSource` factory for each kind. */
export function defaultLight(kind: LightKind, id: string): LightSource {
  const base: LightSource = {
    id,
    kind,
    position: [0, 0, 0],
    color: [1, 1, 1],
    intensity: 1,
    castShadow: false,
    shadowQuality: 'off',
  }
  switch (kind) {
    case 'ambient':
      // Ambient lights are usually subtle and apply globally.
      return { ...base, intensity: 0.4 }
    case 'directional':
      // Sun-style: position is just the *direction* vector.
      return { ...base, position: [10, 10, 5], intensity: 1.2 }
    case 'point':
      return { ...base, intensity: 1, position: [0, 5, 0] }
    case 'spot':
      return { ...base, intensity: 1, position: [0, 5, 0], angle: Math.PI / 6 }
  }
}

/** Type-narrowing helper for the shader / shadow map table. */
export function shadowMapSize(quality: ShadowQuality): number {
  switch (quality) {
    case 'off':
      return 0
    case 'hard':
      return 1024
    case 'soft':
      return 2048
    case 'ultra':
      return 4096
  }
}

/**
 * T55: place a directional light is *direction*, not position.
 * The Three.js convention is `position - target`, but our
 * `LightSource.position` field stores the direction vector
 * itself (origin-shifted). Use this helper to normalise it.
 */
export function normalisedDirection(position: [number, number, number]): [number, number, number] {
  const [x, y, z] = position
  const len = Math.hypot(x, y, z)
  if (len === 0) return [0, -1, 0]
  return [x / len, y / len, z / len]
}

/** Brightness contribution of a directional light to a surface
 *  with the given world-space normal. Pure function used by the
 *  T55 unit test "directional at (1,1,0) brighter than (0,1,-1)".
 *
 *  Returns the dot product clamped to [0, 1] so back-facing
 *  surfaces never receive negative light. */
export function directionalContribution(
  lightPosition: [number, number, number],
  surfaceNormal: [number, number, number]
): number {
  const dir = normalisedDirection(lightPosition)
  const dot = dir[0] * surfaceNormal[0] + dir[1] * surfaceNormal[1] + dir[2] * surfaceNormal[2]
  return Math.max(0, dot)
}
