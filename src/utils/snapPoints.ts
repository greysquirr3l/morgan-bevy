// T51 — Snap point utilities.
//
// Pure functions over arrays of `SnapPoint` (or the candidate
// shape used by `applySnap`). The transform / drag-snap integration
// lives in `useTransformGizmos` — this module is the "find the
// nearest snap candidate" math the gizmo calls into on every
// pointer move.

import type { SceneObject } from '@/store/editorStore'
import type { ObjectId } from '@/types/brand'
import type { SnapPoint, SnapPointCategory } from '@/types/snapPoints'
import { SNAP_POINT_CATEGORIES } from '@/types/snapPoints'

// ─── Candidates ──────────────────────────────────────────────────────────

/** A snap candidate: a point in world space, plus metadata for
 *  filtering + visualisation. The transform system passes one of
 *  these to the gizmo on every move. */
export interface SnapCandidate {
  readonly point: SnapPoint
  /** World-space position computed from the host object's transform. */
  readonly worldPosition: readonly [number, number, number]
  /** Distance from the cursor to the candidate (metres). */
  readonly distance: number
}

/** A 3D vector in a position tuple shape. */
type Vec3 = readonly [number, number, number]

/**
 * Compute the world-space position of a local-space point on an
 * object. The host object's transform is applied to the local
 * position; rotation is ignored for v1 (snap points translate
 * with the object, not rotate). Add a quaternion multiply if
 * rotation-aware snapping is needed in a later iteration.
 */
function worldPositionOf(sceneObject: SceneObject, local: Vec3): Vec3 {
  const [lx, ly, lz] = local
  const [px, py, pz] = sceneObject.position
  return [
    px + lx * sceneObject.scale[0],
    py + ly * sceneObject.scale[1],
    pz + lz * sceneObject.scale[2],
  ]
}

/** Distance between two 3D positions. */
function distance(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// ─── Public API ──────────────────────────────────────────────────────────

/** Configuration for `computeSnapCandidates`. */
export interface SnapOptions {
  /** Maximum search radius in metres. Defaults to 1.0. */
  readonly radius?: number
  /** Enabled categories. Default: all. */
  readonly enabledCategories?: readonly SnapPointCategory[]
  /** The object being dragged; its own points are excluded. */
  readonly sourceObjectId: ObjectId
  /** Cursor position in world space (metres). */
  readonly cursorWorld: Vec3
}

/** Build a list of snap candidates within `radius` of the cursor. */
export function computeSnapCandidates(
  sceneObjects: ReadonlyMap<ObjectId, SceneObject>,
  options: SnapOptions
): SnapCandidate[] {
  const radius = options.radius ?? 1.0
  const enabled = new Set(options.enabledCategories ?? SNAP_POINT_CATEGORIES)

  const out: SnapCandidate[] = []
  for (const [, sceneObject] of sceneObjects) {
    const points = (sceneObject as { snapPoints?: readonly SnapPoint[] }).snapPoints
    if (!points) continue
    for (const point of points) {
      if (!enabled.has(point.category)) continue
      if (point.objectId === options.sourceObjectId) continue
      const world = worldPositionOf(sceneObject, point.localPosition)
      const d = distance(world, options.cursorWorld)
      if (d > radius) continue
      out.push({ point, worldPosition: world, distance: d })
    }
  }
  // Sort by distance ascending so the closest is first.
  out.sort((a, b) => a.distance - b.distance)
  return out
}

/** Pick the best candidate from a list, or `null` if none qualifies. */
export function applySnap(candidates: readonly SnapCandidate[]): SnapCandidate | null {
  return candidates.length > 0 ? candidates[0] : null
}

/** Convenience: combine compute + apply into one call. */
export function findBestSnap(
  sceneObjects: ReadonlyMap<ObjectId, SceneObject>,
  options: SnapOptions
): SnapCandidate | null {
  return applySnap(computeSnapCandidates(sceneObjects, options))
}

/** Return only the candidates matching the enabled categories. */
export function filterByCategory(
  candidates: readonly SnapCandidate[],
  enabledCategories: readonly SnapPointCategory[]
): SnapCandidate[] {
  const enabled = new Set(enabledCategories)
  return candidates.filter(c => enabled.has(c.point.category))
}

/** Count snap points by category — used in the Inspector for a
 *  quick overview. */
export function countByCategory(
  sceneObjects: ReadonlyMap<ObjectId, SceneObject>
): Record<SnapPointCategory, number> {
  const counts: Record<SnapPointCategory, number> = {
    structural: 0,
    decorative: 0,
    logical: 0,
  }
  for (const [, sceneObject] of sceneObjects) {
    const points = (sceneObject as { snapPoints?: readonly SnapPoint[] }).snapPoints
    if (!points) continue
    for (const p of points) {
      counts[p.category] = (counts[p.category] ?? 0) + 1
    }
  }
  return counts
}

// ─── ObjectId re-export ──────────────────────────────────────────────────
// The store re-exports the type but the import path is wider here;
// re-exporting is the path of least friction for downstream
// consumers (the Inspector + the future transform integration).
export type { ObjectId }
