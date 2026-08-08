// T54 — Material paint tool: pure brush math.
//
// `selectPaintTargets` near the bottom of this file is the one
// function here that isn't Three.js-free by accident — it imports
// `SceneObject`/`ObjectId` *types* (erased at compile time, no
// runtime coupling) so the "which objects does this brush stroke
// touch, given the scene + a hit point + lock state" decision lives
// next to the falloff math it depends on, instead of being
// re-derived inline inside the R3F hook where it'd be untestable.
//
// The paint tool assigns a target material to whichever scene
// objects fall under a circular brush centred on the current
// raycast hit. This module is the pure, Three.js-free half of the
// feature: given a brush (radius + falloff curve) and a set of
// candidate distances from the brush centre, it decides which
// candidates are "under the brush" and with what weight.
//
// It deliberately knows nothing about Three.js, the Zustand store,
// or React — `usePaintTool` (the interactive hook) and
// `PaintToolViewport` (the R3F component that raycasts the scene)
// are the only callers. Keeping the math here means it's testable
// without a WebGL canvas, exactly like `src/utils/surfaceSnap.ts`
// (T52) and `src/utils/measurements.ts` (T53).

/** The three falloff curves the brush supports. `as const` so the
 *  array doubles as the canonical list (UI dropdowns iterate it)
 *  and the source of the `BrushFalloff` union. */
import type { SceneObject } from '@/store/editorStore'
import type { ObjectId } from '@/types/brand'

export const BRUSH_FALLOFFS = ['linear', 'smooth', 'flat'] as const

export type BrushFalloff = (typeof BRUSH_FALLOFFS)[number]

/** A brush's shape: how far it reaches and how it weights distance. */
export interface BrushSettings {
  /** World-space radius. Must be > 0 for the brush to affect anything. */
  readonly radius: number
  readonly falloff: BrushFalloff
}

export const DEFAULT_BRUSH_RADIUS = 2
export const DEFAULT_BRUSH_FALLOFF: BrushFalloff = 'smooth'

/** Hits below this weight are dropped even though they're
 *  technically inside the radius. Exists so `smooth`'s fast falloff
 *  near the edge of the brush can meaningfully differ from `flat`'s
 *  "everything inside the radius counts fully" behaviour — without
 *  a threshold, both curves would include every point strictly
 *  inside `radius` and the falloff choice would only matter for a
 *  (currently unimplemented) per-pixel blend. */
export const DEFAULT_MIN_BRUSH_WEIGHT = 0.05

/**
 * Weight in `[0, 1]` for a point at `distance` from the brush
 * centre. `0` outside the radius (or for a non-positive radius).
 * `1` at the centre for every curve.
 *
 *  - `flat`:   constant `1` anywhere inside the radius (a hard
 *              circular mask — matches "flat" brushes in 2D paint
 *              tools).
 *  - `linear`: straight ramp from `1` at the centre to `0` at the
 *              edge.
 *  - `smooth`: smoothstep ramp (`3t² - 2t³`) — flatter near the
 *              centre, steeper near the edge, so it "feels" softer
 *              than `linear` at the same radius.
 */
export function brushFalloffWeight(
  distance: number,
  radius: number,
  falloff: BrushFalloff
): number {
  if (radius <= 0) return 0
  const d = Math.abs(distance)
  if (d > radius) return 0

  const x = 1 - d / radius // 1 at centre, 0 at edge
  switch (falloff) {
    case 'flat':
      return 1
    case 'linear':
      return x
    case 'smooth':
      return x * x * (3 - 2 * x)
    default: {
      const exhaustive: never = falloff
      throw new Error(`Unhandled brush falloff: ${String(exhaustive)}`)
    }
  }
}

/** One candidate under consideration for a brush stroke: an object
 *  id and its distance (world units) from the brush centre. The
 *  caller computes `distance` however it likes (object origin,
 *  closest point on a bounding sphere, etc.) — this module only
 *  turns distances into weights and filters. */
export interface BrushCandidate {
  readonly id: string
  readonly distance: number
}

/** A candidate that made it under the brush, with its falloff weight. */
export interface BrushHit {
  readonly id: string
  readonly weight: number
}

/**
 * Filter + weight a set of candidates against a brush.
 *
 * A candidate is a "hit" when its falloff weight is `>= minWeight`
 * (default `DEFAULT_MIN_BRUSH_WEIGHT`). This is a pure function —
 * calling it twice with different `settings.radius` never mutates
 * anything, so "already-painted" objects are unaffected by a later
 * radius change; the new radius only takes effect on the *next*
 * call (i.e. the next paint stroke).
 */
export function computeBrushHits(
  candidates: readonly BrushCandidate[],
  settings: BrushSettings,
  minWeight: number = DEFAULT_MIN_BRUSH_WEIGHT
): BrushHit[] {
  const hits: BrushHit[] = []
  for (const candidate of candidates) {
    const weight = brushFalloffWeight(candidate.distance, settings.radius, settings.falloff)
    if (weight >= minWeight) {
      hits.push({ id: candidate.id, weight })
    }
  }
  return hits
}

/** 3D Euclidean distance between two `[x, y, z]` tuples. Small
 *  helper so callers (the interactive hook, tests) don't each
 *  re-derive it. */
export function distance3D(
  a: readonly [number, number, number],
  b: readonly [number, number, number]
): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Given the full scene + a brush centred at `hitPoint`, return the
 * ids of every object the brush stroke should paint.
 *
 * Two filters apply before distance/falloff is even considered:
 *  - Only `mesh` objects are paintable (lights/groups have no
 *    material slot).
 *  - Locked objects are never targets — this is the one place lock
 *    state is enforced, so both the primary raycast hit AND any
 *    object caught in the brush's splash radius respect it
 *    identically. A stroke that only ever finds locked objects
 *    under the brush yields an empty array (a no-op stroke; the
 *    caller should not push an undo command for it).
 *
 * Distance is measured from `hitPoint` to each candidate's stored
 * `position` — the same "flat position, no parent-transform
 * composition" fidelity `TransformGizmos` already uses for its
 * multi-select centre calculation, not a new approximation.
 */
export function selectPaintTargets(
  sceneObjects: ReadonlyMap<ObjectId, SceneObject>,
  hitPoint: readonly [number, number, number],
  settings: BrushSettings
): ObjectId[] {
  const candidates: BrushCandidate[] = []
  for (const obj of sceneObjects.values()) {
    if (obj.type !== 'mesh' || obj.locked) continue
    candidates.push({ id: obj.id, distance: distance3D(hitPoint, obj.position) })
  }
  return computeBrushHits(candidates, settings).map(hit => hit.id as ObjectId)
}
