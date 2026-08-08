// T51 — Snap points.
//
// A SnapPoint is a named anchor attached to a scene object. The
// snap system (T51 v2) will use these to align drags against
// nearby objects — for now, this is the data layer: type, schema,
// and the pure functions that operate on lists of points.
//
// Categories split points by intent:
//   - `structural`: door frames, wall corners, floor edges. Used
//     when placing other structural elements.
//   - `decorative`: window centers, shelf midpoints. Used when
//     placing decorative content.
//   - `logical`: prefab anchors, custom user-defined points.
//     Free-form — the prefab system uses them to know "where to
//     place the door" when dragging a prefab.

import { z } from 'zod'

/** The three snap-point categories. */
export const SNAP_POINT_CATEGORIES = ['structural', 'decorative', 'logical'] as const

export type SnapPointCategory = (typeof SNAP_POINT_CATEGORIES)[number]

/**
 * A single snap point on a scene object. `localPosition` and
 * `localRotation` are in the object's local space; the world
 * transform is computed at query time by the snap utility.
 */
export interface SnapPoint {
  /** Stable id; minted by the editor on add. */
  readonly id: string
  /** ObjectId of the host scene object. */
  readonly objectId: string
  /** Local position relative to the host object (metres). */
  localPosition: [number, number, number]
  /** Local rotation as a quaternion (xyzw). */
  localRotation: [number, number, number, number]
  /** Human-readable label. Empty string is allowed. */
  readonly label: string
  /** Category. */
  readonly category: SnapPointCategory
}

export const SnapPointSchema = z.object({
  id: z.string().min(1).max(64),
  objectId: z.string().min(1).max(64),
  localPosition: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  localRotation: z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ]),
  label: z.string().max(64),
  category: z.enum(SNAP_POINT_CATEGORIES),
})

/** Generate a fresh snap-point id. Generation site, not a boundary parse. */
export function mintSnapPointId(): string {
  // Short, no UUID dashes — the snap point is editor-internal, not
  // round-tripped to Bevy.
  return `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** Default category for a new snap point. */
export const DEFAULT_SNAP_POINT_CATEGORY: SnapPointCategory = 'structural'
