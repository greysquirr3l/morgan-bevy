// T53 — Measurement types + zod schema.
//
// The measurement tool supports three modes (per the spec):
//   - `distance`: 2 points → euclidean distance, displayed at the
//     midpoint.
//   - `area`: 3+ points → ear-clipping triangulation, summed.
//   - `ruler`: continuous distance reading from the origin to
//     the cursor; displayed as a faint grid overlay with axis
//     labels.
//
// All measurements live in world space. The unit setting
// (meters / feet / grid units) is a presentation concern — the
// math always operates in metres.

import { z } from 'zod'

/** Available unit settings. */
export const MEASUREMENT_UNITS = ['meters', 'feet', 'grid'] as const
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number]

/** Active mode of the measurement tool. */
export const MEASUREMENT_MODES = ['distance', 'area', 'ruler'] as const
export type MeasurementMode = (typeof MEASUREMENT_MODES)[number]

/** A 3D point. The tuples are mutable (not `readonly`) so the
 *  math utilities can take them by value without an extra `as
 *  unknown as` cast. */
export type Vec3 = [number, number, number]

const Vec3Schema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])

/** A single measurement (one or more points, depending on mode). */
export const MeasurementSchema = z.object({
  /** Stable id; minted by the tool on create. */
  id: z.string().min(1).max(64),
  /** Mode. */
  mode: z.enum(MEASUREMENT_MODES),
  /** World-space points in the order the user clicked. */
  points: z.array(Vec3Schema).min(2).max(64),
  /** When the measurement was created (Unix ms). */
  createdAt: z.number().int().nonnegative(),
  /** User-supplied label; empty string is allowed. */
  label: z.string().max(64),
})

export type Measurement = z.infer<typeof MeasurementSchema>

/** Configuration for the measurement tool. */
export const MeasurementConfigSchema = z.object({
  /** Active unit for HUD labels. */
  unit: z.enum(MEASUREMENT_UNITS).default('meters'),
  /** Whether the ruler overlay is currently visible. */
  rulerVisible: z.boolean().default(false),
  /** Grid unit size in metres. Used when `unit === 'grid'`. */
  gridSize: z.number().positive().default(1),
})

export type MeasurementConfig = z.infer<typeof MeasurementConfigSchema>

/** Default config. */
export const DEFAULT_MEASUREMENT_CONFIG: MeasurementConfig = {
  unit: 'meters',
  rulerVisible: false,
  gridSize: 1,
}

/** Generate a fresh measurement id. */
export function mintMeasurementId(): string {
  return `meas_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** Convert a metres value to the given unit. */
export function convertUnits(meters: number, unit: MeasurementUnit, gridSize: number): number {
  switch (unit) {
    case 'meters':
      return meters
    case 'feet':
      return meters * 3.28084
    case 'grid':
      return meters / gridSize
  }
}

/** Format a metres value with the unit's standard suffix. */
export function formatMeasurement(meters: number, unit: MeasurementUnit, gridSize: number): string {
  const value = convertUnits(meters, unit, gridSize)
  const fractionDigits = value < 0.1 ? 3 : value < 10 ? 2 : 1
  return `${value.toFixed(fractionDigits)} ${unit}`
}