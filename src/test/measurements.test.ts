/**
 * T53 — Measurement math.
 *
 * Contract pinned:
 *  - distance between (0,0,0) and (3,0,4) is 5 (the spec test).
 *  - midpoint is the arithmetic mean of two points.
 *  - polylineLength sums segment distances.
 *  - polygonArea: shoelace formula for planar 3D polygons.
 *  - Unit conversion: meters, feet, grid. Feet = meters * 3.28084.
 *  - formatMeasurement: appropriate decimal places for the value.
 *  - Edge cases: collinear points → 0 area; <3 points → 0 area.
 */
import { describe, expect, it } from 'vitest'

import {
  distance,
  midpoint,
  polygonArea,
  polygonCentroid,
  polylineLength,
} from '@/utils/measurements'
import {
  convertUnits,
  formatMeasurement,
  MEASUREMENT_UNITS,
} from '@/types/measurements'

describe('T53 distance + midpoint + polylineLength', () => {
  it('distance between (0,0,0) and (3,0,4) is 5 (the spec test)', () => {
    expect(distance([0, 0, 0], [3, 0, 4])).toBeCloseTo(5)
  })

  it('distance is symmetric', () => {
    expect(distance([1, 2, 3], [4, 5, 6])).toBeCloseTo(distance([4, 5, 6], [1, 2, 3]))
  })

  it('midpoint is the arithmetic mean of two points', () => {
    const m = midpoint([0, 0, 0], [2, 4, 6])
    expect(m).toEqual([1, 2, 3])
  })

  it('polylineLength sums segment distances', () => {
    // 0-0-0 → 3-0-0 → 3-0-4 → 0-0-4 → back to 0-0-0. Wait —
    // polyline (not closed). Just sum open path.
    const points: Array<[number, number, number]> = [
      [0, 0, 0],
      [3, 0, 0],
      [3, 0, 4],
    ]
    expect(polylineLength(points)).toBeCloseTo(7) // 3 + 4
  })

  it('polylineLength of <2 points is 0', () => {
    expect(polylineLength([])).toBe(0)
    expect(polylineLength([[0, 0, 0]])).toBe(0)
  })
})

describe('T53 polygonArea', () => {
  it('unit square on the XZ plane: 1m²', () => {
    // (0,0,0) → (1,0,0) → (1,0,1) → (0,0,1) → close
    expect(
      polygonArea([
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ])
    ).toBeCloseTo(1)
  })

  it('3-4-5 right triangle in the XY plane: 6m²', () => {
    expect(
      polygonArea([
        [0, 0, 0],
        [3, 0, 0],
        [0, 4, 0],
      ])
    ).toBeCloseTo(6)
  })

  it('a planar polygon in 3D projects correctly', () => {
    // Same triangle but on the plane Y = 5 (normal is +Y).
    expect(
      polygonArea([
        [0, 5, 0],
        [3, 5, 0],
        [0, 5, 4],
      ])
    ).toBeCloseTo(6)
  })

  it('fewer than 3 points returns 0', () => {
    expect(polygonArea([])).toBe(0)
    expect(polygonArea([[0, 0, 0]])).toBe(0)
    expect(polygonArea([[0, 0, 0], [1, 0, 0]])).toBe(0)
  })

  it('collinear points (degenerate polygon) returns 0', () => {
    expect(
      polygonArea([
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ])
    ).toBe(0)
  })

  it('a larger 5m×5m square is 25m²', () => {
    expect(
      polygonArea([
        [0, 0, 0],
        [5, 0, 0],
        [5, 0, 5],
        [0, 0, 5],
      ])
    ).toBeCloseTo(25)
  })
})

describe('T53 polygonCentroid', () => {
  it('arithmetic mean of vertices', () => {
    const c = polygonCentroid([
      [0, 0, 0],
      [2, 0, 0],
      [0, 4, 0],
      [0, 0, 6],
    ])
    expect(c[0]).toBeCloseTo(0.5)
    expect(c[1]).toBeCloseTo(1)
    expect(c[2]).toBeCloseTo(1.5)
  })

  it('empty polygon is origin', () => {
    expect(polygonCentroid([])).toEqual([0, 0, 0])
  })
})

describe('T53 unit conversion + formatting', () => {
  it('convertUnits(meters, "meters") is identity', () => {
    expect(convertUnits(5, 'meters', 1)).toBe(5)
  })

  it('convertUnits(meters, "feet") is meters * 3.28084', () => {
    expect(convertUnits(1, 'feet', 1)).toBeCloseTo(3.28084)
  })

  it('convertUnits(meters, "grid", 1) is meters / 1', () => {
    expect(convertUnits(5, 'grid', 1)).toBe(5)
  })

  it('convertUnits(meters, "grid", 2) is meters / 2', () => {
    expect(convertUnits(4, 'grid', 2)).toBe(2)
  })

  it('formatMeasurement uses the right suffix', () => {
    for (const unit of MEASUREMENT_UNITS) {
      const formatted = formatMeasurement(5, unit, 1)
      expect(formatted).toMatch(new RegExp(`\\b${unit}\\b`))
    }
  })

  it('formatMeasurement with meters shows 2 decimal places for small values', () => {
    const formatted = formatMeasurement(0.5, 'meters', 1)
    // 0.5 → "0.50 meters"
    expect(formatted).toBe('0.50 meters')
  })

  it('formatMeasurement with feet rounds appropriately', () => {
    const formatted = formatMeasurement(1, 'feet', 1)
    expect(formatted).toBe('3.28 feet')
  })
})