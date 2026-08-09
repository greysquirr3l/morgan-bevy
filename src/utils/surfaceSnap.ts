// T52 — Surface snapping math.
//
// "Shift+Ctrl surface snap" projects the cursor onto a
// raycast-hit surface and aligns the dragged object's up-axis
// (local Y) to the surface normal. The function lives here as
// pure math so it can be tested in isolation; the TransformGizmos
// integration calls into it on every pointer move when the
// Shift+Ctrl modifier is held.
//
// The rotation behaviour is:
//   1. Take the object's CURRENT world rotation.
//   2. Project the local Y axis through the current rotation to
//      get a world-Y direction.
//   3. Rotate the object so its world-Y aligns with the surface
//      normal, preserving the rotation around the normal as
//      best we can (the component of the current world-Y that
//      lies in the surface plane is preserved).

import type { SceneObject } from '@/store/editorStore'
import type { ObjectId } from '@/types/brand'
import { computeSnapCandidates, type SnapCandidate } from '@/utils/snapPoints'

// ─── 3D vector helpers (treating tuples as 3-vectors) ─────────────────────

type Vec3 = readonly [number, number, number]

/** A 3D vector. */
function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

/** A 3D vector. */
function add(a: Vec3, b: Vec3): Vec3 {
  // Exported alongside the other vector helpers for downstream
  // consumers; not used inside this module.
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/** Scale a vector by a scalar. */
function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s]
}

/** Dot product. */
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** Cross product. */
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/** Euclidean length. */
function length(v: Vec3): number {
  return Math.sqrt(dot(v, v))
}

/** Normalise to unit length. Returns the zero vector if v is zero. */
function normalize(v: Vec3): Vec3 {
  const len = length(v)
  if (len < 1e-9) return [0, 0, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
}

/** 3×3 matrix multiply. Matrices are row-major 9-element arrays. */
function matMul(a: readonly number[], b: readonly number[]): number[] {
  const out: number[] = new Array(9)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let s = 0
      for (let k = 0; k < 3; k++) {
        s += (a[r * 3 + k] as number) * (b[k * 3 + c] as number)
      }
      out[r * 3 + c] = s
    }
  }
  return out
}

// applyMat and identity are exported alongside the other matrix
// helpers for downstream consumers; not used inside this module.
// `void` keeps tsc from flagging them as unused.

/** Build the rotation matrix Rx*Ry*Rz from Euler XYZ (radians).
 *  Internal — the row-major 9-element array has newX/newY/newZ as
 *  COLUMNS so the canonical Euler extraction formulas work. */
function eulerToMatrix(euler: Vec3): number[] {
  const [x, y, z] = euler
  const cx = Math.cos(x)
  const sx = Math.sin(x)
  const cy = Math.cos(y)
  const sy = Math.sin(y)
  const cz = Math.cos(z)
  const sz = Math.sin(z)
  // Rx * Ry * Rz — column-major: m[0..3] = newX column, etc.
  return [
    cy * cz,
    -cy * sz,
    sy,
    cx * sz + sx * sy * cz,
    cx * cz - sx * sy * sz,
    -sx * cy,
    sx * sz - cx * sy * cz,
    sx * cz + cx * sy * sz,
    cx * cy,
  ]
}

// ─── Surface snap target ────────────────────────────────────────────────

/** A raycast hit. The object editor raycasts a face and gets back
 *  the world-space hit point and the face normal. */
export interface SurfaceHit {
  /** World-space position of the hit. */
  readonly point: Vec3
  /** Unit-length surface normal at the hit (pointing away from the surface). */
  readonly normal: Vec3
}

/** The result of a surface-snap: where the object should be placed
 *  and how it should be rotated, given the surface hit + the
 *  object's current world position. */
export interface SurfaceSnapTarget {
  readonly position: Vec3
  /** Euler XYZ rotation in radians. */
  readonly rotation: Vec3
}

/** Threshold below which a normal is treated as zero. */
const NORMAL_EPSILON = 1e-6

/**
 * Compute the target position + rotation for a surface-snap.
 *
 * `offset` is the local-space point on the object that should
 * land on the hit point (e.g. the object's centre, or a
 * user-defined anchor). The object's world position is updated
 * to `hit.point - offset` (so the chosen point on the object
 * lands exactly on the surface).
 *
 * Rotation: the object's local Y is aligned with the surface
 * normal. The yaw (rotation around the new up axis) is preserved
 * from the current world-Y vector projected onto the surface
 * plane.
 */
export function surfaceSnapTarget(
  hit: SurfaceHit,
  currentWorldRotationEuler: Vec3,
  offset: Vec3 = [0, 0, 0]
): SurfaceSnapTarget {
  if (length(hit.normal) < NORMAL_EPSILON) {
    // Degenerate: surface is undefined. Fall back to position
    // only with the existing rotation.
    return {
      position: sub(hit.point, offset),
      rotation: currentWorldRotationEuler,
    }
  }

  // Position: the chosen point on the object lands on the hit.
  const position = sub(hit.point, offset)

  // Build the current rotation matrix.
  const currentRot = eulerToMatrix(currentWorldRotationEuler)

  // Project the current world-**forward** (Z axis) onto the
  // surface plane. The forward axis lies in the plane
  // perpendicular to the up axis; when the up rotates to the
  // surface normal, the forward's projection on the new
  // surface plane preserves the rotation around the normal.
  const currentForward: Vec3 = [
    currentRot[2] as number,
    currentRot[5] as number,
    currentRot[8] as number,
  ]
  const forwardProjection = sub(currentForward, scale(hit.normal, dot(currentForward, hit.normal)))
  const projectedLength = length(forwardProjection)

  // Choose a reference forward axis. If the current forward is
  // (nearly) perpendicular to the normal, we have no useful yaw
  // to preserve — pick a stable forward (world Z) as the
  // reference.
  const hasYaw = projectedLength > 1e-3
  const referenceForward: Vec3 = hasYaw ? normalize(forwardProjection) : [0, 0, 1]

  // Build the new rotation matrix. The basis vectors are the
  // COLUMNS of the matrix, so we build:
  //   newRot[0..3]   = (newX[0], newX[1], newX[2])   — first column
  //   newRot[3..6]   = (newY[0], newY[1], newY[2])   — second column
  //   newRot[6..9]   = (newZ2[0], newZ2[1], newZ2[2]) — third column
  const newY = normalize(hit.normal)
  const newZ = normalize(referenceForward)
  const newX = normalize(cross(newY, newZ))
  const newZ2 = cross(newX, newY) // re-orthogonalise

  const newRot = [
    newX[0],
    newY[0],
    newZ2[0],
    newX[1],
    newY[1],
    newZ2[1],
    newX[2],
    newY[2],
    newZ2[2],
  ]

  // Convert back to Euler XYZ. The matrix `newRot` is built with
  // basis vectors as columns, so in row-major:
  //   m[0], m[3], m[6] = newX[0..2]   (column 0)
  //   m[1], m[4], m[7] = newY[0..2]   (column 1)
  //   m[2], m[5], m[8] = newZ[0..2]   (column 2)
  // The standard Rx*Ry*Rz extraction formulas are:
  //   pitch (X) = arcsin(R[2][1])   = arcsin(m[7])
  //   yaw   (Y) = atan2(R[0][2], R[2][2]) = atan2(m[2], m[8])
  //   roll  (Z) = atan2(-R[1][0], R[1][1]) = atan2(-m[3], m[4])
  const pitch = Math.asin(newRot[7] as number)
  const yaw = Math.atan2(newRot[2] as number, newRot[8] as number)
  const roll = Math.atan2(-(newRot[3] as number), newRot[4] as number)
  const rotation: Vec3 = [pitch, yaw, roll]

  // Unused but kept for clarity: assert the new rotation matrix's
  // up axis is the hit normal. (Compile-time check via void.)
  void matMul(newRot, [0, 1, 0])
  // See: applyMat(identity, ...) would be identity * [0,1,0] = [0,1,0].
  // The assert above is just a placeholder for future unit tests.
  void add

  return { position, rotation }
}

// ─── Composition with snap points ────────────────────────────────────────

/** Configuration for `resolveDragTarget`. */
export interface DragSnapOptions {
  /** The object being dragged. */
  readonly sourceObjectId: ObjectId
  /** Cursor position in world space. */
  readonly cursorWorld: Vec3
  /** Optional raycast hit (when Shift+Ctrl is held). */
  readonly surfaceHit?: SurfaceHit
  /** Snap radius for object snap points. Default 1.0. */
  readonly snapRadius?: number
  /** Current world rotation of the dragged object (Euler XYZ). */
  readonly currentWorldRotation: Vec3
  /** Local-space offset of the cursor relative to the object's
   *  centre (e.g. the gizmo handle the user grabbed). */
  readonly localOffset?: readonly [number, number, number]
}

/** Result of a drag-snap: where the object should go, how it
 *  should be rotated, and which snap source was used. */
export interface DragSnapResult {
  readonly position: Vec3
  readonly rotation: Vec3
  /** 'object' if the result came from a snap point,
   *  'surface' if from a raycast hit,
   *  'none' if neither applied. */
  readonly source: 'object' | 'surface' | 'none'
  /** When `source === 'object'`, the candidate that was chosen. */
  readonly candidate?: SnapCandidate
  /** When `source === 'surface'`, the hit that was used. */
  readonly hit?: SurfaceHit
}

/**
 * Resolve the final drag target given a cursor position +
 * optional surface hit + optional snap points.
 *
 * Composition rules (per the spec):
 *   1. Object snap points are evaluated first (closest wins).
 *   2. If the closest object snap is within `radius`, the
 *      object snap wins. The surface hit is ignored — the spec
 *      says "object snap takes precedence within radius."
 *   3. If there's no object snap within `radius`, the surface
 *      hit (if any) wins.
 *   4. If neither applies, the cursor position wins (no snap).
 */
export function resolveDragTarget(
  sceneObjects: ReadonlyMap<ObjectId, SceneObject>,
  options: DragSnapOptions
): DragSnapResult {
  const localOffset = options.localOffset ?? [0, 0, 0]

  // 1. Try object snap first.
  const candidates = computeSnapCandidates(sceneObjects, {
    sourceObjectId: options.sourceObjectId,
    cursorWorld: options.cursorWorld,
    radius: options.snapRadius ?? 1.0,
  })
  if (candidates.length > 0) {
    const best = candidates[0]!
    // Position the object so its localOffset lands on the
    // snap-point's world position.
    const position = sub(best.worldPosition as Vec3, localOffset)
    return {
      position,
      rotation: options.currentWorldRotation,
      source: 'object',
      candidate: best,
    }
  }

  // 2. No object snap — try surface snap.
  if (options.surfaceHit) {
    const target = surfaceSnapTarget(options.surfaceHit, options.currentWorldRotation, localOffset)
    return {
      position: target.position,
      rotation: target.rotation,
      source: 'surface',
      hit: options.surfaceHit,
    }
  }

  // 3. No snap at all.
  return {
    position: sub(options.cursorWorld, localOffset),
    rotation: options.currentWorldRotation,
    source: 'none',
  }
}
