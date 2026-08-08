// T53 — useMeasurementTool hook.
//
// Per the spec, the M key activates the measurement tool. R
// toggles the ruler overlay. Click two points to display the
// distance; multi-click to compute polygon area.
//
// This hook is the data + dispatch + mode toggling. The 3D
// rendering (drawing lines / polygon fills in the viewport) is a
// follow-up; the HTML overlay (MeasurementOverlay) is what the
// user sees in v1.

import { useCallback, useState } from 'react'

import {
  DEFAULT_MEASUREMENT_CONFIG,
  MEASUREMENT_MODES,
  mintMeasurementId,
  type Measurement,
  type MeasurementConfig,
  type MeasurementMode,
  type Vec3,
} from '@/types/measurements'

export interface UseMeasurementToolOptions {
  /** The map of scene objects (for ruler-mode projections). */
  sceneObjects?: ReadonlyMap<unknown, { position: Vec3 }>
  /** Default config. Overrides the module default. */
  configOverride?: Partial<MeasurementConfig>
}

export interface UseMeasurementToolResult {
  /** Currently-active mode (null = tool is off). */
  readonly mode: MeasurementMode | null
  /** The full list of measurements (across all modes). */
  readonly measurements: readonly Measurement[]
  /** The most-recent measurement (for the overlay). Never `null` —
   *  an inactive/empty tool reports `EMPTY_MEASUREMENT` (`id: ''`),
   *  not the absence of a value; callers check `current.id === ''`
   *  rather than null-checking. (Fixed from `Measurement | null`,
   *  which didn't match the hook's actual behaviour — `current` is
   *  never set to `null` anywhere in the implementation below — and
   *  forced every consumer to redundantly null-check a value that
   *  can't be null.) */
  readonly current: Measurement
  /** Current config (unit, ruler visibility, grid size). */
  readonly config: MeasurementConfig
  /** True iff the ruler overlay should be visible. */
  readonly rulerVisible: boolean
  /** Set the active mode. Pass `null` to turn the tool off. */
  setMode: (mode: MeasurementMode | null) => void
  /** Cycle the active mode through the three options. */
  cycleMode: () => void
  /** Add a point to the current measurement. Creates a new one
   *  if the active mode has fewer than 2 points (distance) or
   *  there is no current measurement. */
  addPoint: (point: Vec3) => void
  /** Remove the most recent point (undo). */
  removeLastPoint: () => void
  /** Clear the current measurement. */
  clear: () => void
  /** Toggle the ruler overlay. */
  toggleRuler: () => void
  /** Update the config (unit, grid size). */
  setConfig: (patch: Partial<MeasurementConfig>) => void
  /** Remove a specific measurement by id. */
  removeById: (id: string) => void
}

const EMPTY_MEASUREMENT: Measurement = Object.freeze({
  id: '',
  mode: 'distance',
  points: [],
  createdAt: 0,
  label: '',
}) as Measurement

export function useMeasurementTool(
  options: UseMeasurementToolOptions = {}
): UseMeasurementToolResult {
  const [config, setConfigState] = useState<MeasurementConfig>(() => ({
    ...DEFAULT_MEASUREMENT_CONFIG,
    ...options.configOverride,
  }))
  const [mode, setMode] = useState<MeasurementMode | null>(null)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [current, setCurrent] = useState<Measurement>(EMPTY_MEASUREMENT)

  const setConfig = useCallback((patch: Partial<MeasurementConfig>) => {
    setConfigState(prev => ({ ...prev, ...patch }))
  }, [])

  const cycleMode = useCallback(() => {
    setMode(prev => {
      if (prev === null) return MEASUREMENT_MODES[0]
      const i = MEASUREMENT_MODES.indexOf(prev)
      return MEASUREMENT_MODES[(i + 1) % MEASUREMENT_MODES.length] as MeasurementMode
    })
  }, [])

  const addPoint = useCallback(
    (point: Vec3) => {
      if (mode === null) return
      setCurrent(prev => {
        // distance mode: 2 points; area mode: 3+; ruler: any.
        // When the previous measurement is at its target size,
        // start a new measurement.
        const isFull =
          (prev.mode === 'distance' && prev.points.length >= 2) ||
          (prev.mode === 'area' && prev.points.length >= 64)
        if (isFull || prev.mode !== mode) {
          const newMeasurement: Measurement = {
            id: mintMeasurementId(),
            mode,
            points: [point],
            createdAt: Date.now(),
            label: '',
          }
          setMeasurements(list => [...list, newMeasurement])
          return newMeasurement
        }
        const next: Measurement = {
          ...prev,
          points: [...prev.points, point],
        }
        setMeasurements(list => {
          // Replace the last entry (the one we were building)
          // if it's the same id; otherwise append.
          const idx = list.findIndex(m => m.id === prev.id)
          if (idx === -1) return [...list, next]
          const copy = list.slice()
          copy[idx] = next
          return copy
        })
        return next
      })
    },
    [mode]
  )

  const removeLastPoint = useCallback(() => {
    setCurrent(prev => {
      if (prev.points.length === 0) return prev
      return { ...prev, points: prev.points.slice(0, -1) }
    })
  }, [])

  const clear = useCallback(() => {
    setCurrent(EMPTY_MEASUREMENT)
  }, [])

  const toggleRuler = useCallback(() => {
    setConfigState(prev => ({ ...prev, rulerVisible: !prev.rulerVisible }))
  }, [])

  const removeById = useCallback((id: string) => {
    setMeasurements(list => list.filter(m => m.id !== id))
  }, [])

  return {
    mode,
    measurements,
    current,
    config,
    rulerVisible: config.rulerVisible,
    setMode,
    cycleMode,
    addPoint,
    removeLastPoint,
    clear,
    toggleRuler,
    setConfig,
    removeById,
  }
}