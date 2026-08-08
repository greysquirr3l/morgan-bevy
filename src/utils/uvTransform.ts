// T54 — UV editor: pure offset/scale math.
//
// The UV editor doesn't re-unwrap a mesh's UVs; it applies a single
// affine transform (offset + scale) to the mesh's existing UV
// coordinates, exposed as `SceneObject.uvTransform`. Dragging in the
// editor pans the offset; scrolling scales it. This module is the
// pure half (no DOM, no Three.js) so it's unit-testable directly;
// `UVEditor.tsx` wires pointer/wheel events to these functions.

export interface UVTransform {
  readonly offsetX: number
  readonly offsetY: number
  readonly scaleX: number
  readonly scaleY: number
}

/** No visual change from the mesh's authored UVs. */
export const IDENTITY_UV_TRANSFORM: UVTransform = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
}

/** Scale is clamped to this range so a runaway scroll can't zero it
 *  out (undoable but pointless) or blow it up to an unusable size. */
export const MIN_UV_SCALE = 0.05
export const MAX_UV_SCALE = 20

/**
 * Pan the UV offset by a drag delta expressed in editor pixels.
 * `viewSize` is the editor canvas's pixel size (assumed square UV
 * viewport) — dividing by it converts a pixel delta into UV-space
 * units (UV space is `[0, 1]`) so panning feels consistent
 * regardless of canvas size. Offset wraps into `[0, 1)` (UVs tile),
 * matching how texture coordinates outside `[0, 1]` behave under
 * the default `RepeatWrapping`.
 */
export function panUV(
  transform: UVTransform,
  dxPixels: number,
  dyPixels: number,
  viewSize: number
): UVTransform {
  if (viewSize <= 0) return transform
  const du = dxPixels / viewSize
  const dv = dyPixels / viewSize
  return {
    ...transform,
    offsetX: wrapUnit(transform.offsetX + du),
    offsetY: wrapUnit(transform.offsetY + dv),
  }
}

/**
 * Scale the UV transform in response to a scroll/wheel delta.
 * Positive `deltaY` (scrolling down, the DOM convention) zooms out;
 * negative zooms in. `sensitivity` controls how much one wheel
 * "tick" changes scale — the default matches a typical 100/-100
 * `deltaY` per notch producing a ~10% zoom step.
 */
export function zoomUV(transform: UVTransform, deltaY: number, sensitivity = 0.001): UVTransform {
  const factor = Math.exp(-deltaY * sensitivity)
  const scaleX = clamp(transform.scaleX * factor, MIN_UV_SCALE, MAX_UV_SCALE)
  const scaleY = clamp(transform.scaleY * factor, MIN_UV_SCALE, MAX_UV_SCALE)
  return { ...transform, scaleX, scaleY }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Wrap a value into `[0, 1)`. */
function wrapUnit(value: number): number {
  const wrapped = value % 1
  return wrapped < 0 ? wrapped + 1 : wrapped
}
