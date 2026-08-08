// T91a — TypeScript mirror of the four Rust marker enums.
//
// Wire format is locked by the Rust side (src-tauri/src/export/exporters.rs):
//
//     #[derive(..., Serialize, Deserialize)]
//     #[serde(tag = "kind", rename_all = "snake_case")]
//     pub enum LightMarker { Point { ... }, Spot { ... }, Directional { ... } }
//
// …and the same for AnimationMarker, AudioMarker, VfxMarker. That means
// every marker serializes as an internally-tagged object whose
// discriminant is `kind` and whose variant names are snake_case —
// `play_once`, `one_shot`, not `playOnce` / `oneShot`. Field names
// stay snake_case too. The shapes cross the IPC boundary verbatim,
// so any field-name or variant-name drift on the TS side is a silent
// deserialization failure on the Rust side.
//
// Conventions per project rules:
//   - `as const` objects + `typeof X[keyof typeof X]`-derived literal
//     unions instead of `enum`. (AGENTS.md / orchestrator prompt.)
//   - `satisfies` for shape validation — never `as` for shape validation.
//   - Vectors are fixed-length 3/2-tuples (project convention;
//     Vec3 = `[number, number, number]`). NOT marked `readonly` — see
//     the long note above.
//
// The zod mirror of these types lives in `src/types/schemas/index.ts`
// behind the same `kind` discriminant; both are exercised by
// `src/test/markerTypes.test.ts`.

import type { Vec3 } from '@/types/schemas'

// ─── Kind literal tables ──────────────────────────────────────────────────────
//
// `as const` plus a derived union is the project-blessed alternative to
// `enum`. Reading the table is the source of truth for the variant
// strings — the union below is purely a type-level alias.

export const LIGHT_MARKER_KINDS = {
  point: 'point',
  spot: 'spot',
  directional: 'directional',
} as const
export type LightMarkerKind = (typeof LIGHT_MARKER_KINDS)[keyof typeof LIGHT_MARKER_KINDS]

export const ANIMATION_MARKER_KINDS = {
  play: 'play',
  play_once: 'play_once',
} as const
export type AnimationMarkerKind =
  (typeof ANIMATION_MARKER_KINDS)[keyof typeof ANIMATION_MARKER_KINDS]

export const AUDIO_MARKER_KINDS = {
  ambient: 'ambient',
  one_shot: 'one_shot',
} as const
export type AudioMarkerKind = (typeof AUDIO_MARKER_KINDS)[keyof typeof AUDIO_MARKER_KINDS]

export const VFX_MARKER_KINDS = {
  particle: 'particle',
  billboard: 'billboard',
} as const
export type VfxMarkerKind = (typeof VFX_MARKER_KINDS)[keyof typeof VFX_MARKER_KINDS]

// ─── 2-element vector (Billboard.size) ────────────────────────────────────────

export type Vec2 = [number, number]

// ─── LightMarker ──────────────────────────────────────────────────────────────

export type LightMarker =
  | {
      kind: typeof LIGHT_MARKER_KINDS.point
      color: Vec3
      intensity: number
      range: number
      shadows: boolean
    }
  | {
      kind: typeof LIGHT_MARKER_KINDS.spot
      color: Vec3
      intensity: number
      range: number
      inner_angle: number
      outer_angle: number
      shadows: boolean
    }
  | {
      kind: typeof LIGHT_MARKER_KINDS.directional
      color: Vec3
      intensity: number
      shadows: boolean
    }

// ─── AnimationMarker ──────────────────────────────────────────────────────────

export type AnimationMarker =
  | {
      kind: typeof ANIMATION_MARKER_KINDS.play
      clip: string
      repeat: boolean
      speed: number
    }
  | {
      kind: typeof ANIMATION_MARKER_KINDS.play_once
      clip: string
    }

// ─── AudioMarker ──────────────────────────────────────────────────────────────

export type AudioMarker =
  | {
      kind: typeof AUDIO_MARKER_KINDS.ambient
      path: string
      volume: number
      looping: boolean
    }
  | {
      kind: typeof AUDIO_MARKER_KINDS.one_shot
      path: string
      volume: number
    }

// ─── VfxMarker ────────────────────────────────────────────────────────────────

export type VfxMarker =
  | {
      kind: typeof VFX_MARKER_KINDS.particle
      path: string
      count: number
    }
  | {
      kind: typeof VFX_MARKER_KINDS.billboard
      texture: string
      size: Vec2
    }

// ─── MarkerKind umbrella + SceneObjectMarkers ────────────────────────────────

export type MarkerKind = LightMarkerKind | AnimationMarkerKind | AudioMarkerKind | VfxMarkerKind

/**
 * The four optional marker fields a `SceneObject` may carry. T91b
 * extends `SceneObject` with this interface; T91d threads every
 * present field through the export payload (omitting, never nulling,
 * absent markers — that's how Rust `skip_serializing_if` reads them).
 */
export interface SceneObjectMarkers {
  light?: LightMarker
  animation?: AnimationMarker
  audio?: AudioMarker
  vfx?: VfxMarker
}

// ─── Discriminated type guards ────────────────────────────────────────────────

/**
 * Type guard: `obj` is a `LightMarker`. Use at the boundary if the
 * discriminant is `unknown` rather than a known `kind` literal.
 */
export function isLightMarker(value: unknown): value is LightMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    Object.values(LIGHT_MARKER_KINDS).includes((value as { kind: string }).kind as LightMarkerKind)
  )
}

export function isAnimationMarker(value: unknown): value is AnimationMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    Object.values(ANIMATION_MARKER_KINDS).includes(
      (value as { kind: string }).kind as AnimationMarkerKind
    )
  )
}

export function isAudioMarker(value: unknown): value is AudioMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    Object.values(AUDIO_MARKER_KINDS).includes((value as { kind: string }).kind as AudioMarkerKind)
  )
}

export function isVfxMarker(value: unknown): value is VfxMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    Object.values(VFX_MARKER_KINDS).includes((value as { kind: string }).kind as VfxMarkerKind)
  )
}

/**
 * Returns `true` if `value` is any of the four marker shapes
 * (without distinguishing which one). Useful when a caller has
 * `SceneObjectMarkers` and wants to know "is this object carrying
 * any marker at all?"
 */
export function isAnyMarker(value: unknown): boolean {
  return (
    isLightMarker(value) || isAnimationMarker(value) || isAudioMarker(value) || isVfxMarker(value)
  )
}

// ─── Default marker factories ─────────────────────────────────────────────────
//
// Used by T91c's Inspector panels to seed an "Add <marker>" affordance
// and to backfill the variant-specific fields when a user switches the
// `kind` of an existing marker. Every default passes its corresponding
// zod schema (T91a) — these are the canonical "fresh" marker values.
//
// IMPORTANT: when switching `kind`, the new variant is built from a
// default and selectively carries over fields the two variants share
// (e.g. LightMarker.Point → Spot carries `color`, `intensity`, `range`,
// `shadows`; Point → Directional carries `color`, `intensity`, `shadows`).
// A half-populated variant (e.g. `spot` missing `outer_angle`) would
// fail the schema and the Rust deserialize — the panel tests pin this
// by parsing the resulting store value with the zod schema.

export function defaultLightMarker(kind: LightMarkerKind = LIGHT_MARKER_KINDS.point): LightMarker {
  switch (kind) {
    case LIGHT_MARKER_KINDS.point:
      return {
        kind: LIGHT_MARKER_KINDS.point,
        color: [1, 1, 1],
        intensity: 1000,
        range: 10,
        shadows: true,
      }
    case LIGHT_MARKER_KINDS.spot:
      return {
        kind: LIGHT_MARKER_KINDS.spot,
        color: [1, 1, 1],
        intensity: 1000,
        range: 10,
        inner_angle: 0.3,
        outer_angle: 0.6,
        shadows: true,
      }
    case LIGHT_MARKER_KINDS.directional:
      return {
        kind: LIGHT_MARKER_KINDS.directional,
        color: [1, 1, 1],
        intensity: 1.0,
        shadows: false,
      }
    default: {
      // Exhaustiveness — a new variant in LIGHT_MARKER_KINDS that
      // doesn't get a case here becomes a compile error rather than
      // a silently-broken default.
      const _exhaustive: never = kind
      throw new Error(`defaultLightMarker: unknown kind ${String(_exhaustive)}`)
    }
  }
}

export function defaultAnimationMarker(
  kind: AnimationMarkerKind = ANIMATION_MARKER_KINDS.play,
): AnimationMarker {
  switch (kind) {
    case ANIMATION_MARKER_KINDS.play:
      return {
        kind: ANIMATION_MARKER_KINDS.play,
        clip: '',
        repeat: true,
        speed: 1.0,
      }
    case ANIMATION_MARKER_KINDS.play_once:
      return {
        kind: ANIMATION_MARKER_KINDS.play_once,
        clip: '',
      }
    default: {
      const _exhaustive: never = kind
      throw new Error(`defaultAnimationMarker: unknown kind ${String(_exhaustive)}`)
    }
  }
}

export function defaultAudioMarker(
  kind: AudioMarkerKind = AUDIO_MARKER_KINDS.ambient,
): AudioMarker {
  switch (kind) {
    case AUDIO_MARKER_KINDS.ambient:
      return {
        kind: AUDIO_MARKER_KINDS.ambient,
        path: '',
        volume: 1.0,
        looping: true,
      }
    case AUDIO_MARKER_KINDS.one_shot:
      return {
        kind: AUDIO_MARKER_KINDS.one_shot,
        path: '',
        volume: 1.0,
      }
    default: {
      const _exhaustive: never = kind
      throw new Error(`defaultAudioMarker: unknown kind ${String(_exhaustive)}`)
    }
  }
}

export function defaultVfxMarker(kind: VfxMarkerKind = VFX_MARKER_KINDS.particle): VfxMarker {
  switch (kind) {
    case VFX_MARKER_KINDS.particle:
      return {
        kind: VFX_MARKER_KINDS.particle,
        path: '',
        count: 100,
      }
    case VFX_MARKER_KINDS.billboard:
      return {
        kind: VFX_MARKER_KINDS.billboard,
        texture: '',
        size: [1, 1],
      }
    default: {
      const _exhaustive: never = kind
      throw new Error(`defaultVfxMarker: unknown kind ${String(_exhaustive)}`)
    }
  }
}
