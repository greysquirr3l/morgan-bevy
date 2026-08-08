/**
 * T54 — UV editor pure math.
 *
 * Contract pinned:
 *  - `panUV` converts a pixel drag delta into UV-space offset and
 *    wraps into [0, 1).
 *  - `zoomUV` scales symmetrically in X/Y and clamps to
 *    [MIN_UV_SCALE, MAX_UV_SCALE]; positive deltaY (scroll down)
 *    zooms OUT (shrinks scale), matching the DOM wheel convention.
 */
import {
  IDENTITY_UV_TRANSFORM,
  MAX_UV_SCALE,
  MIN_UV_SCALE,
  panUV,
  zoomUV,
} from '@/utils/uvTransform'
import { describe, expect, it } from 'vitest'

describe('panUV', () => {
  it('converts a pixel delta into a UV-space offset', () => {
    const result = panUV(IDENTITY_UV_TRANSFORM, 64, 32, 256)
    expect(result.offsetX).toBeCloseTo(0.25)
    expect(result.offsetY).toBeCloseTo(0.125)
  })

  it('accumulates on top of an existing offset', () => {
    const start = { ...IDENTITY_UV_TRANSFORM, offsetX: 0.1, offsetY: 0.2 }
    const result = panUV(start, 25.6, 0, 256)
    expect(result.offsetX).toBeCloseTo(0.2)
    expect(result.offsetY).toBeCloseTo(0.2)
  })

  it('wraps the offset into [0, 1)', () => {
    const start = { ...IDENTITY_UV_TRANSFORM, offsetX: 0.9 }
    const result = panUV(start, 256, 0, 256) // +1.0 in UV space
    expect(result.offsetX).toBeCloseTo(0.9)
  })

  it('wraps a negative offset back into [0, 1)', () => {
    const result = panUV(IDENTITY_UV_TRANSFORM, -128, 0, 256) // -0.5
    expect(result.offsetX).toBeCloseTo(0.5)
    expect(result.offsetX).toBeGreaterThanOrEqual(0)
  })

  it('leaves the transform unchanged for a non-positive view size', () => {
    const result = panUV(IDENTITY_UV_TRANSFORM, 100, 100, 0)
    expect(result).toEqual(IDENTITY_UV_TRANSFORM)
  })

  it('is pure — the input transform is not mutated', () => {
    const start = { ...IDENTITY_UV_TRANSFORM }
    panUV(start, 50, 50, 256)
    expect(start).toEqual(IDENTITY_UV_TRANSFORM)
  })
})

describe('zoomUV', () => {
  it('scrolling down (positive deltaY) zooms out (shrinks scale)', () => {
    const result = zoomUV(IDENTITY_UV_TRANSFORM, 100)
    expect(result.scaleX).toBeLessThan(1)
    expect(result.scaleY).toBeLessThan(1)
  })

  it('scrolling up (negative deltaY) zooms in (grows scale)', () => {
    const result = zoomUV(IDENTITY_UV_TRANSFORM, -100)
    expect(result.scaleX).toBeGreaterThan(1)
    expect(result.scaleY).toBeGreaterThan(1)
  })

  it('clamps scale to MIN_UV_SCALE on extreme zoom-out', () => {
    const result = zoomUV(IDENTITY_UV_TRANSFORM, 1_000_000)
    expect(result.scaleX).toBeCloseTo(MIN_UV_SCALE)
    expect(result.scaleY).toBeCloseTo(MIN_UV_SCALE)
  })

  it('clamps scale to MAX_UV_SCALE on extreme zoom-in', () => {
    const result = zoomUV(IDENTITY_UV_TRANSFORM, -1_000_000)
    expect(result.scaleX).toBeCloseTo(MAX_UV_SCALE)
    expect(result.scaleY).toBeCloseTo(MAX_UV_SCALE)
  })

  it('zero delta leaves scale unchanged', () => {
    const result = zoomUV(IDENTITY_UV_TRANSFORM, 0)
    expect(result.scaleX).toBeCloseTo(1)
    expect(result.scaleY).toBeCloseTo(1)
  })
})
