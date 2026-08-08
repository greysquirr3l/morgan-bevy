// T91c — pure helpers shared by the field components in
// `MarkerFields.tsx`. Splitting helpers out keeps the components
// file's exports component-only (the project's `react-refresh/
// only-export-components` lint rule), and these helpers are
// testable in isolation without rendering JSX.

/**
 * Parse a number-input value into a finite number. Returns
 * `fallback` when the input is empty, NaN, or Infinity — never
 * `null` and never `0`, because the caller may want to
 * distinguish "user cleared the field" from "user typed 0".
 * `Number.isNaN` (not the global `isNaN`) because the global
 * coerces.
 */
export function parseFiniteNumber(raw: string, fallback: number): number {
  const parsed = Number(raw)
  if (raw === '' || Number.isNaN(parsed) || !Number.isFinite(parsed)) return fallback
  return parsed
}

/**
 * Like `parseFiniteNumber`, but rounds to a non-negative integer.
 * Used for VfxMarker.particle.count which is `u32` on the Rust side.
 */
export function parseFiniteInt(raw: string, fallback: number): number {
  const parsed = parseFiniteNumber(raw, fallback)
  return Math.max(0, Math.round(parsed))
}
