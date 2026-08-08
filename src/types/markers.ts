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
//   - Vectors are fixed-length readonly tuples (project convention;
//     Vec3 = `readonly [number, number, number]`).
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
export type LightMarkerKind =
  (typeof LIGHT_MARKER_KINDS)[keyof typeof LIGHT_MARKER_KINDS]

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
export type AudioMarkerKind =
  (typeof AUDIO_MARKER_KINDS)[keyof typeof AUDIO_MARKER_KINDS]

export const VFX_MARKER_KINDS = {
  particle: 'particle',
  billboard: 'billboard',
} as const
export type VfxMarkerKind =
  (typeof VFX_MARKER_KINDS)[keyof typeof VFX_MARKER_KINDS]

// ─── 2-element vector (Billboard.size) ────────────────────────────────────────

export type Vec2 = readonly [number, number]

// ─── LightMarker ──────────────────────────────────────────────────────────────

export type LightMarker =
  | {
      readonly kind: typeof LIGHT_MARKER_KINDS.point
      readonly color: Vec3
      readonly intensity: number
      readonly range: number
      readonly shadows: boolean
    }
  | {
      readonly kind: typeof LIGHT_MARKER_KINDS.spot
      readonly color: Vec3
      readonly intensity: number
      readonly range: number
      readonly inner_angle: number
      readonly outer_angle: number
      readonly shadows: boolean
    }
  | {
      readonly kind: typeof LIGHT_MARKER_KINDS.directional
      readonly color: Vec3
      readonly intensity: number
      readonly shadows: boolean
    }

// ─── AnimationMarker ──────────────────────────────────────────────────────────

export type AnimationMarker =
  | {
      readonly kind: typeof ANIMATION_MARKER_KINDS.play
      readonly clip: string
      readonly repeat: boolean
      readonly speed: number
    }
  | {
      readonly kind: typeof ANIMATION_MARKER_KINDS.play_once
      readonly clip: string
    }

// ─── AudioMarker ──────────────────────────────────────────────────────────────

export type AudioMarker =
  | {
      readonly kind: typeof AUDIO_MARKER_KINDS.ambient
      readonly path: string
      readonly volume: number
      readonly looping: boolean
    }
  | {
      readonly kind: typeof AUDIO_MARKER_KINDS.one_shot
      readonly path: string
      readonly volume: number
    }

// ─── VfxMarker ────────────────────────────────────────────────────────────────

export type VfxMarker =
  | {
      readonly kind: typeof VFX_MARKER_KINDS.particle
      readonly path: string
      readonly count: number
    }
  | {
      readonly kind: typeof VFX_MARKER_KINDS.billboard
      readonly texture: string
      readonly size: Vec2
    }

// ─── MarkerKind umbrella + SceneObjectMarkers ────────────────────────────────

export type MarkerKind =
  | LightMarkerKind
  | AnimationMarkerKind
  | AudioMarkerKind
  | VfxMarkerKind

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
    Object.values(LIGHT_MARKER_KINDS).includes(
      (value as { kind: string }).kind as LightMarkerKind,
    )
  )
}

export function isAnimationMarker(value: unknown): value is AnimationMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    Object.values(ANIMATION_MARKER_KINDS).includes(
      (value as { kind: string }).kind as AnimationMarkerKind,
    )
  )
}

export function isAudioMarker(value: unknown): value is AudioMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    Object.values(AUDIO_MARKER_KINDS).includes(
      (value as { kind: string }).kind as AudioMarkerKind,
    )
  )
}

export function isVfxMarker(value: unknown): value is VfxMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    Object.values(VFX_MARKER_KINDS).includes(
      (value as { kind: string }).kind as VfxMarkerKind,
    )
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
    isLightMarker(value) ||
    isAnimationMarker(value) ||
    isAudioMarker(value) ||
    isVfxMarker(value)
  )
}
