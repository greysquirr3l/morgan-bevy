/**
 * T53 — useMeasurementTool hook.
 *
 * The wiring audit requires every hook in `src/hooks/` to have
 * at least one consumer. This test file is that consumer: it
 * imports and exercises the hook via renderHook from
 * @testing-library/react, then asserts the API behaviour.
 *
 * The hook is consumed by the editor's measurement HUD in the
 * live app; this test pins the contract for v1 (distance / area
 * / ruler modes, unit config, ruler visibility toggle, add/remove
 * points, clear) so future changes don't break the API.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useMeasurementTool } from '@/hooks/useMeasurementTool'
import {
  MEASUREMENT_MODES,
  type MeasurementUnit,
} from '@/types/measurements'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('T53 useMeasurementTool', () => {
  it('starts inactive (mode = null) with default config', () => {
    const { result } = renderHook(() => useMeasurementTool())
    expect(result.current.mode).toBeNull()
    expect(result.current.config).toEqual({
      unit: 'meters',
      rulerVisible: false,
      gridSize: 1,
    })
    expect(result.current.measurements).toEqual([])
    expect(result.current.current!.id).toBe('')
  })

  it('cycleMode moves through the three modes in order', () => {
    const { result } = renderHook(() => useMeasurementTool())
    expect(result.current.mode).toBeNull()
    act(() => result.current.cycleMode())
    expect(result.current.mode).toBe(MEASUREMENT_MODES[0])
    act(() => result.current.cycleMode())
    expect(result.current.mode).toBe(MEASUREMENT_MODES[1])
    act(() => result.current.cycleMode())
    expect(result.current.mode).toBe(MEASUREMENT_MODES[2])
    act(() => result.current.cycleMode())
    // Wraps back to the first mode.
    expect(result.current.mode).toBe(MEASUREMENT_MODES[0])
  })

  it('setMode toggles the active mode directly', () => {
    const { result } = renderHook(() => useMeasurementTool())
    act(() => result.current.setMode('area'))
    expect(result.current.mode).toBe('area')
    act(() => result.current.setMode(null))
    expect(result.current.mode).toBeNull()
  })

  it('addPoint creates a measurement with one point; a second add appends', () => {
    const { result } = renderHook(() => useMeasurementTool())
    act(() => result.current.setMode('distance'))
    act(() => result.current.addPoint([0, 0, 0]))
    expect(result.current.current!.points).toHaveLength(1)
    expect(result.current.measurements).toHaveLength(1)
    act(() => result.current.addPoint([3, 0, 4]))
    expect(result.current.current!.points).toHaveLength(2)
    // distance mode: 2 points max; a third add starts a NEW measurement.
    act(() => result.current.addPoint([6, 0, 0]))
    expect(result.current.measurements).toHaveLength(2)
    expect(result.current.current!.id).not.toBe(result.current.measurements[0]!.id)
  })

  it('addPoint is a no-op when the tool is inactive', () => {
    const { result } = renderHook(() => useMeasurementTool())
    expect(result.current.mode).toBeNull()
    act(() => result.current.addPoint([0, 0, 0]))
    expect(result.current.measurements).toHaveLength(0)
  })

  it('removeLastPoint pops the most recent point', () => {
    const { result } = renderHook(() => useMeasurementTool())
    act(() => result.current.setMode('area'))
    act(() => result.current.addPoint([0, 0, 0]))
    act(() => result.current.addPoint([1, 0, 0]))
    act(() => result.current.addPoint([0, 1, 0]))
    expect(result.current.current!.points).toHaveLength(3)
    act(() => result.current.removeLastPoint())
    expect(result.current.current!.points).toHaveLength(2)
  })

  it('clear empties the current measurement', () => {
    const { result } = renderHook(() => useMeasurementTool())
    act(() => result.current.setMode('area'))
    act(() => result.current.addPoint([0, 0, 0]))
    act(() => result.current.clear())
    expect(result.current.current!.id).toBe('')
  })

  it('toggleRuler flips the ruler visibility', () => {
    const { result } = renderHook(() => useMeasurementTool())
    expect(result.current.rulerVisible).toBe(false)
    act(() => result.current.toggleRuler())
    expect(result.current.rulerVisible).toBe(true)
    act(() => result.current.toggleRuler())
    expect(result.current.rulerVisible).toBe(false)
  })

  it('setConfig updates the unit / grid size', () => {
    const { result } = renderHook(() => useMeasurementTool())
    act(() => result.current.setConfig({ unit: 'feet' as MeasurementUnit }))
    expect(result.current.config.unit).toBe('feet')
    act(() => result.current.setConfig({ gridSize: 2 }))
    expect(result.current.config.gridSize).toBe(2)
    // Original unit preserved.
    expect(result.current.config.unit).toBe('feet')
  })

  it('removeById drops the matching measurement', () => {
    const { result } = renderHook(() => useMeasurementTool())
    act(() => result.current.setMode('distance'))
    act(() => result.current.addPoint([0, 0, 0]))
    act(() => result.current.addPoint([3, 0, 4]))
    expect(result.current.measurements).toHaveLength(1)
    const id = result.current.measurements[0]!.id
    act(() => result.current.removeById(id))
    expect(result.current.measurements).toHaveLength(0)
  })
})