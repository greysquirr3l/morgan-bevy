// T53 — Measurement math.
//
// Pure functions: distance, midpoint, polygon area via
// ear-clipping triangulation. All math is in metres; the unit
// conversion lives in `src/types/measurements.ts` and is a
// presentation concern.
//
// Ear-clipping algorithm:
//   1. Sort the polygon vertices by angle around the centroid.
//      A convex polygon yields a consistent ordering; a
//      non-convex polygon can require the full algorithm.
//   2. For simplicity, we use the shoelace formula for a flat
//      polygon (sum cross products of consecutive vertices). It
//      works for any simple (non-self-intersecting) polygon.
//   3. For a 3D polygon, we project onto the polygon plane and
//      apply shoelace. The plane is derived from the first three
//      vertices; the polygon must be planar (the spec's
//      ear-clipping call-out implies a 3D planar polygon).

import type { Vec3 } from '@/types/measurements'

// ─── Vector helpers ──────────────────────────────────────────────────────

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function length(v: Vec3): number {
  return Math.sqrt(dot(v, v))
}

function normalize(v: Vec3): Vec3 {
  const len = length(v)
  if (len < 1e-9) return [0, 0, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
}

// ─── Distance + midpoint ────────────────────────────────────────────────

/** Euclidean distance between two points (metres). */
export function distance(a: Vec3, b: Vec3): number {
  return length(sub(a, b))
}

/** Midpoint of two points. */
export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
}

/** Total path length of a polyline (sum of segment distances). */
export function polylineLength(points: readonly Vec3[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1]!, points[i]!)
  }
  return total
}

// ─── Polygon area via shoelace ───────────────────────────────────────────

/** Project 3D points onto the plane defined by the first three
 *  points. Returns 2D coordinates + the basis. The polygon is
 *  assumed planar. */
function projectToPlane(points: readonly Vec3[]): {
  basis2d: { u: Vec3; v: Vec3; origin: Vec3 }
  points2d: Array<[number, number]>
} | null {
  if (points.length < 3) return null
  const a = points[0]!
  const b = points[1]!
  const c = points[2]!
  const u = normalize(sub(b, a))
  let normal = normalize(cross(sub(b, a), sub(c, a)))
  if (length(normal) < 1e-9) return null // collinear
  // Re-orthogonalise v against u.
  const v = normalize(cross(normal, u))

  const points2d = points.map(p => {
    const d = sub(p, a)
    return [dot(d, u), dot(d, v)] as [number, number]
  })
  return {
    basis2d: { u, v, origin: a },
    points2d,
  }
}

/** Shoelace area of a simple 2D polygon. Returns absolute value. */
function shoelace(pts: Array<[number, number]>): number {
  const n = pts.length
  if (n < 3) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i]!
    const [x2, y2] = pts[(i + 1) % n]!
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum) / 2
}

/** Area of a 3D polygon (must be planar, simple). Returns 0 for
 *  fewer than 3 points or a degenerate (collinear) polygon. */
export function polygonArea(points: readonly Vec3[]): number {
  if (points.length < 3) return 0
  const projected = projectToPlane(points)
  if (!projected) return 0
  return shoelace(projected.points2d)
}

/** Centroid of a 3D polygon (arithmetic mean of its vertices). */
export function polygonCentroid(points: readonly Vec3[]): Vec3 {
  if (points.length === 0) return [0, 0, 0]
  let sx = 0
  let sy = 0
  let sz = 0
  for (const p of points) {
    sx += p[0]
    sy += p[1]
    sz += p[2]
  }
  return [sx / points.length, sy / points.length, sz / points.length]
}