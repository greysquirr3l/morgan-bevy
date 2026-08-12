// T53 — Measurement HUD overlay.
//
// Renders the most-recent measurement in the upper-right of the
// viewport, with a short hint for the current mode + the unit
// label. The 3D rendering of the measurement lines in the
// viewport is a follow-up; this overlay is the user-facing
// feedback for v1.

import { X } from 'lucide-react'

import { formatMeasurement, type Measurement, type MeasurementConfig } from '@/types/measurements'
import {
  distance,
  midpoint,
  polygonArea,
  polygonCentroid,
  polylineLength,
} from '@/utils/measurements'

export interface MeasurementOverlayProps {
  /** The most-recent measurement to display. */
  measurement: Measurement | null
  /** Tool config (unit, ruler visibility, grid size). */
  config: MeasurementConfig
  /** Remove a measurement by id. */
  onRemove?: (id: string) => void
  /** Audit (Major #18): turn the tool off entirely. Bound to
   *  `setMode(null)` from the parent so the × button has a
   *  visible on-canvas escape, not just per-measurement
   *  deletion. */
  onTurnOff?: () => void
}

export default function MeasurementOverlay(props: MeasurementOverlayProps) {
  const { measurement, config, onRemove, onTurnOff } = props
  if (!measurement || measurement.points.length === 0) return null

  // Compute the displayed value depending on the mode.
  let primaryValue: string
  let anchorPoint: [number, number, number]
  switch (measurement.mode) {
    case 'distance': {
      if (measurement.points.length < 2) {
        return null
      }
      const d = distance(measurement.points[0]!, measurement.points[1]!)
      primaryValue = formatMeasurement(d, config.unit, config.gridSize)
      anchorPoint = midpoint(measurement.points[0]!, measurement.points[1]!)
      break
    }
    case 'area': {
      const a = polygonArea(measurement.points)
      primaryValue = formatMeasurement(a, config.unit, config.gridSize)
      anchorPoint = polygonCentroid(measurement.points)
      break
    }
    case 'ruler': {
      const len = polylineLength(measurement.points)
      primaryValue = formatMeasurement(len, config.unit, config.gridSize)
      anchorPoint = measurement.points[measurement.points.length - 1]!
      break
    }
  }

  return (
    <div
      data-testid="measurement-overlay"
      className="absolute top-12 right-4 z-40 bg-editor-panel/95 border border-editor-border rounded-md p-3 text-xs shadow-lg max-w-xs"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-editor-textMuted">
          {measurement.mode.toUpperCase()} ({measurement.points.length} pt
          {measurement.points.length === 1 ? '' : 's'})
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(measurement.id)}
            className="text-editor-textMuted hover:text-red-400"
            aria-label="Remove measurement"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="font-mono text-sm text-editor-text" data-testid="measurement-value">
        {primaryValue}
      </div>
      <div className="mt-2 text-[10px] text-editor-textMuted font-mono">
        anchor: ({anchorPoint[0].toFixed(2)}, {anchorPoint[1].toFixed(2)},{' '}
        {anchorPoint[2].toFixed(2)})
      </div>
      {onTurnOff && (
        <button
          type="button"
          onClick={onTurnOff}
          className="mt-2 w-full text-[10px] text-editor-textMuted hover:text-red-400 border border-editor-border rounded px-1 py-0.5"
          data-testid="measurement-turn-off"
        >
          Turn off tool
        </button>
      )}
    </div>
  )
}
