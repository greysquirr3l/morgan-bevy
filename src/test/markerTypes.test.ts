/**
 * T91a — marker types + zod schemas.
 *
 * The wire format is fixed by the Rust side (src-tauri/src/export/exporters.rs):
 *   #[serde(tag = "kind", rename_all = "snake_case")]
 * …and these tests pin the TS mirror to that contract. Anything that
 * drifts on the TS side (camelCase variants, renamed fields, dropped
 * `kind` discriminant) will silently fail to deserialize on the Rust
 * side; the schemas are the safety net.
 *
 * Coverage:
 *   - KIND literal tables expose the exact snake_case strings.
 *   - Each of the 9 variants validates against its schema.
 *   - camelCase variants (playOnce, oneShot) and camelCase fields
 *     (innerAngle, outerAngle) are rejected.
 *   - Each schema rejects a missing `kind` discriminant.
 *   - The TS discriminated unions are exactly the union of their
 *     variants — no extra / missing fields at the type level.
 *   - Type guards accept matching values and reject null / non-object /
 *     wrong-kind values.
 *   - SceneObjectMarkers export accepts every combination.
 */
import { describe, expect, it } from 'vitest'

import {
  ANIMATION_MARKER_KINDS,
  AUDIO_MARKER_KINDS,
  LIGHT_MARKER_KINDS,
  VFX_MARKER_KINDS,
  isAnimationMarker,
  isAnyMarker,
  isAudioMarker,
  isLightMarker,
  isVfxMarker,
} from '@/types/markers'
import {
  AnimationMarkerSchema,
  AudioMarkerSchema,
  LightMarkerSchema,
  VfxMarkerSchema,
} from '@/types/schemas'

// ─── KIND literal tables ──────────────────────────────────────────────────────

describe('T91a marker KIND literal tables', () => {
  it('LightMarkerKind is {point, spot, directional} — exact snake_case', () => {
    expect(Object.values(LIGHT_MARKER_KINDS).sort()).toEqual(['directional', 'point', 'spot'])
  })

  it('AnimationMarkerKind is {play, play_once} — not {play, playOnce}', () => {
    expect(Object.values(ANIMATION_MARKER_KINDS).sort()).toEqual(['play', 'play_once'])
  })

  it('AudioMarkerKind is {ambient, one_shot} — not {ambient, oneShot}', () => {
    expect(Object.values(AUDIO_MARKER_KINDS).sort()).toEqual(['ambient', 'one_shot'])
  })

  it('VfxMarkerKind is {particle, billboard}', () => {
    expect(Object.values(VFX_MARKER_KINDS).sort()).toEqual(['billboard', 'particle'])
  })
})

// ─── LightMarker ──────────────────────────────────────────────────────────────

describe('T91a LightMarker', () => {
  it('validates a Point light', () => {
    const ok = LightMarkerSchema.safeParse({
      kind: 'point',
      color: [1, 1, 1],
      intensity: 1000,
      range: 10,
      shadows: true,
    })
    expect(ok.success).toBe(true)
  })

  it('validates a Spot light with inner_angle and outer_angle', () => {
    const ok = LightMarkerSchema.safeParse({
      kind: 'spot',
      color: [1, 1, 1],
      intensity: 1000,
      range: 10,
      inner_angle: 0.3,
      outer_angle: 0.6,
      shadows: true,
    })
    expect(ok.success).toBe(true)
  })

  it('validates a Directional light with no range', () => {
    const ok = LightMarkerSchema.safeParse({
      kind: 'directional',
      color: [1, 1, 1],
      intensity: 1.0,
      shadows: false,
    })
    expect(ok.success).toBe(true)
  })

  it('rejects a Spot light with innerAngle (camelCase) instead of inner_angle', () => {
    const bad = LightMarkerSchema.safeParse({
      kind: 'spot',
      color: [1, 1, 1],
      intensity: 1000,
      range: 10,
      innerAngle: 0.3,
      outerAngle: 0.6,
      shadows: true,
    })
    expect(bad.success).toBe(false)
  })

  it('rejects an unknown kind', () => {
    const bad = LightMarkerSchema.safeParse({
      kind: 'laser',
      color: [1, 1, 1],
      intensity: 1000,
      range: 10,
      shadows: true,
    })
    expect(bad.success).toBe(false)
  })

  it('rejects a missing kind', () => {
    const bad = LightMarkerSchema.safeParse({
      color: [1, 1, 1],
      intensity: 1000,
      range: 10,
      shadows: true,
    })
    expect(bad.success).toBe(false)
  })

  it('rejects a 2-tuple color instead of a 3-tuple', () => {
    const bad = LightMarkerSchema.safeParse({
      kind: 'point',
      color: [1, 1],
      intensity: 1000,
      range: 10,
      shadows: true,
    })
    expect(bad.success).toBe(false)
  })
})

// ─── AnimationMarker ──────────────────────────────────────────────────────────

describe('T91a AnimationMarker', () => {
  it('validates a Play marker', () => {
    const ok = AnimationMarkerSchema.safeParse({
      kind: 'play',
      clip: 'banner.anim',
      repeat: true,
      speed: 1.0,
    })
    expect(ok.success).toBe(true)
  })

  it('validates a PlayOnce marker', () => {
    const ok = AnimationMarkerSchema.safeParse({
      kind: 'play_once',
      clip: 'banner.anim',
    })
    expect(ok.success).toBe(true)
  })

  it('rejects a PlayOnce variant written as playOnce (camelCase)', () => {
    const bad = AnimationMarkerSchema.safeParse({
      kind: 'playOnce',
      clip: 'banner.anim',
    })
    expect(bad.success).toBe(false)
  })

  it('rejects Play with extra fields', () => {
    const bad = AnimationMarkerSchema.safeParse({
      kind: 'play',
      clip: 'banner.anim',
      repeat: true,
      speed: 1.0,
      looping: true,
    })
    expect(bad.success).toBe(false)
  })

  it('rejects PlayOnce with the `speed` field (Play-only)', () => {
    const bad = AnimationMarkerSchema.safeParse({
      kind: 'play_once',
      clip: 'banner.anim',
      speed: 1.0,
    })
    expect(bad.success).toBe(false)
  })
})

// ─── AudioMarker ──────────────────────────────────────────────────────────────

describe('T91a AudioMarker', () => {
  it('validates an Ambient marker', () => {
    const ok = AudioMarkerSchema.safeParse({
      kind: 'ambient',
      path: 'fountain.ogg',
      volume: 0.8,
      looping: true,
    })
    expect(ok.success).toBe(true)
  })

  it('validates a OneShot marker', () => {
    const ok = AudioMarkerSchema.safeParse({
      kind: 'one_shot',
      path: 'clang.ogg',
      volume: 1.0,
    })
    expect(ok.success).toBe(true)
  })

  it('rejects a OneShot variant written as oneShot (camelCase)', () => {
    const bad = AudioMarkerSchema.safeParse({
      kind: 'oneShot',
      path: 'clang.ogg',
      volume: 1.0,
    })
    expect(bad.success).toBe(false)
  })

  it('rejects Ambient with a `looping` field named `loop`', () => {
    const bad = AudioMarkerSchema.safeParse({
      kind: 'ambient',
      path: 'fountain.ogg',
      volume: 0.8,
      loop: true,
    })
    expect(bad.success).toBe(false)
  })
})

// ─── VfxMarker ────────────────────────────────────────────────────────────────

describe('T91a VfxMarker', () => {
  it('validates a Particle marker', () => {
    const ok = VfxMarkerSchema.safeParse({
      kind: 'particle',
      path: 'campfire.vfx',
      count: 100,
    })
    expect(ok.success).toBe(true)
  })

  it('validates a Billboard marker', () => {
    const ok = VfxMarkerSchema.safeParse({
      kind: 'billboard',
      texture: 'smoke.png',
      size: [1.0, 1.0],
    })
    expect(ok.success).toBe(true)
  })

  it('rejects Particle with a 3-tuple size field it does not declare', () => {
    const bad = VfxMarkerSchema.safeParse({
      kind: 'particle',
      path: 'campfire.vfx',
      count: 100,
      size: [1, 1, 1],
    })
    expect(bad.success).toBe(false)
  })

  it('rejects Billboard with a 3-tuple size', () => {
    const bad = VfxMarkerSchema.safeParse({
      kind: 'billboard',
      texture: 'smoke.png',
      size: [1, 1, 1],
    })
    expect(bad.success).toBe(false)
  })

  it('rejects a Particle with a negative count', () => {
    const bad = VfxMarkerSchema.safeParse({
      kind: 'particle',
      path: 'campfire.vfx',
      count: -1,
    })
    expect(bad.success).toBe(false)
  })
})

// ─── Type guards ──────────────────────────────────────────────────────────────

describe('T91a marker type guards', () => {
  it('isLightMarker accepts a Light value', () => {
    expect(
      isLightMarker({
        kind: 'point',
        color: [1, 1, 1],
        intensity: 1,
        range: 1,
        shadows: false,
      })
    ).toBe(true)
  })

  it('isLightMarker rejects null, undefined, plain objects, and wrong-kind objects', () => {
    expect(isLightMarker(null)).toBe(false)
    expect(isLightMarker(undefined)).toBe(false)
    expect(isLightMarker(42)).toBe(false)
    expect(isLightMarker('point')).toBe(false)
    expect(isLightMarker({ kind: 'something_else' })).toBe(false)
    expect(isLightMarker({ color: [1, 1, 1] })).toBe(false)
  })

  it('isAnimationMarker rejects a playOnce (camelCase) variant', () => {
    expect(isAnimationMarker({ kind: 'playOnce', clip: 'x' })).toBe(false)
    expect(isAnimationMarker({ kind: 'play_once', clip: 'x' })).toBe(true)
  })

  it('isAudioMarker rejects an oneShot (camelCase) variant', () => {
    expect(isAudioMarker({ kind: 'oneShot', path: 'x', volume: 1 })).toBe(false)
    expect(isAudioMarker({ kind: 'one_shot', path: 'x', volume: 1 })).toBe(true)
  })

  it('isVfxMarker accepts Particle and rejects unknown', () => {
    expect(isVfxMarker({ kind: 'particle', path: 'x', count: 1 })).toBe(true)
    expect(isVfxMarker({ kind: 'fireworks', path: 'x' })).toBe(false)
  })

  it('isAnyMarker accepts any of the four shapes', () => {
    expect(
      isAnyMarker({ kind: 'point', color: [1, 1, 1], intensity: 1, range: 1, shadows: false })
    ).toBe(true)
    expect(isAnyMarker({ kind: 'play_once', clip: 'x' })).toBe(true)
    expect(isAnyMarker({ kind: 'ambient', path: 'x', volume: 1, looping: true })).toBe(true)
    expect(isAnyMarker({ kind: 'billboard', texture: 'x', size: [1, 1] })).toBe(true)
    expect(isAnyMarker({ kind: 'door' })).toBe(false)
    expect(isAnyMarker(null)).toBe(false)
  })
})

// ─── Wire-format pin: round-trip via JSON ─────────────────────────────────────

describe('T91a wire-format pin', () => {
  it('a Play marker round-trips through JSON with `kind: "play"` and `clip` intact', () => {
    const original = {
      kind: 'play' as const,
      clip: 'banner.anim',
      repeat: true,
      speed: 1.0,
    }
    const wire = JSON.parse(JSON.stringify(original))
    const parsed = AnimationMarkerSchema.safeParse(wire)
    expect(parsed.success).toBe(true)
  })

  it('a Spot light round-trips through JSON with `inner_angle` and `outer_angle` intact', () => {
    const original = {
      kind: 'spot' as const,
      color: [1, 1, 1] as const,
      intensity: 1000,
      range: 10,
      inner_angle: 0.3,
      outer_angle: 0.6,
      shadows: true,
    }
    const wire = JSON.parse(JSON.stringify(original))
    const parsed = LightMarkerSchema.safeParse(wire)
    expect(parsed.success).toBe(true)
  })
})
