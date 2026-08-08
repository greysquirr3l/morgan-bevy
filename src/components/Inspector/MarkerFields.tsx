// T91c — shared form scaffolding for the four marker panels.
//
// Each of the four marker panels (Light / Animation / Audio / VFX) is
// a one-file-per-marker component. They share the same field shapes
// (number / boolean / string / Vec3 / Vec2) and the same visual
// language as the rest of the Inspector, so the inputs live here
// rather than being copied four times. Adding a new marker means
// reusing these; the marker-specific UI (the `kind` selector, the
// variant switch, the Add/Remove affordances) stays in each panel.
//
// Pure helpers (`parseFiniteNumber`, `parseFiniteInt`) live in
// `MarkerFieldUtils.ts` so this file only exports components (the
// project's `react-refresh/only-export-components` lint rule).

import type { ChangeEvent } from 'react'
import { parseFiniteNumber } from './MarkerFieldUtils'

// ─── Style aliases ────────────────────────────────────────────────────────────
//
// These mirror the Inspector's existing classes so the new panels
// blend in. Kept as constants so a future restyle updates one place.

const LABEL_CLASS = 'block text-xs text-editor-textMuted mb-1'
const INPUT_BASE = 'w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent'
const INPUT_NUMBER = `${INPUT_BASE} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`
const CHECKBOX_CLASS = 'w-3 h-3 rounded border-editor-border bg-editor-bg accent-editor-accent'

// ─── Field components ────────────────────────────────────────────────────────

export interface NumberFieldProps {
  label: string
  value: number
  onChange: (next: number) => void
  step?: number
  min?: number
  max?: number
}

/**
 * Labelled number input. NaN / Infinity / empty → `onChange(fallback)`
 * via `parseFiniteNumber`. The caller supplies the fallback so the
 * panel keeps the marker's existing value as the placeholder when
 * the user clears the field.
 */
export function NumberField({ label, value, onChange, step, min, max }: NumberFieldProps) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(parseFiniteNumber(e.target.value, value))}
        className={INPUT_NUMBER}
        step={step}
        min={min}
        max={max}
      />
    </div>
  )
}

export interface BooleanFieldProps {
  label: string
  value: boolean
  onChange: (next: boolean) => void
}

/**
 * Labelled checkbox. Label sits to the right of the box; the row
 * is left-aligned with the rest of the form.
 */
export function BooleanField({ label, value, onChange }: BooleanFieldProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-editor-textMuted">
      <input
        type="checkbox"
        checked={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        className={CHECKBOX_CLASS}
      />
      <span>{label}</span>
    </label>
  )
}

export interface StringFieldProps {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
}

/**
 * Labelled text input. Used for AnimationMarker.clip, AudioMarker.path,
 * VfxMarker.path / VfxMarker.texture.
 */
export function StringField({ label, value, onChange, placeholder }: StringFieldProps) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className={INPUT_BASE}
        placeholder={placeholder}
      />
    </div>
  )
}

export interface Vec3FieldProps {
  label: string
  /** 3-tuple `[x, y, z]`. Mutable on the caller side; the event
   *  handlers spread the next value back through the store. */
  value: [number, number, number]
  onChange: (next: [number, number, number]) => void
  step?: number
  min?: number
  max?: number
}

/**
 * Three labelled number inputs side-by-side, one per axis. Used for
 * LightMarker.color (RGB). The caller is responsible for clamping; we
 * pass-through whatever the user types unless the value is not finite.
 */
export function Vec3Field({ label, value, onChange, step, min, max }: Vec3FieldProps) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {(['R', 'G', 'B'] as const).map((axis, axisIndex) => (
          <div key={axis}>
            <label className="block text-xs text-editor-textMuted">{axis}</label>
            <input
              type="number"
              value={value[axisIndex]}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const next = parseFiniteNumber(e.target.value, value[axisIndex])
                const out: [number, number, number] = [...value]
                out[axisIndex] = next
                onChange(out)
              }}
              className={INPUT_NUMBER}
              step={step}
              min={min}
              max={max}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export interface Vec2FieldProps {
  label: string
  value: [number, number]
  onChange: (next: [number, number]) => void
  step?: number
  min?: number
  max?: number
}

/**
 * Two labelled number inputs side-by-side. Used for VfxMarker.billboard.size.
 */
export function Vec2Field({ label, value, onChange, step, min, max }: Vec2FieldProps) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <div className="grid grid-cols-2 gap-2">
        {(['W', 'H'] as const).map((axis, axisIndex) => (
          <div key={axis}>
            <label className="block text-xs text-editor-textMuted">{axis}</label>
            <input
              type="number"
              value={value[axisIndex]}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const next = parseFiniteNumber(e.target.value, value[axisIndex])
                const out: [number, number] = [value[0], value[1]]
                out[axisIndex] = next
                onChange(out)
              }}
              className={INPUT_NUMBER}
              step={step}
              min={min}
              max={max}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Common panel chrome ─────────────────────────────────────────────────────

export interface PanelSectionProps {
  title: string
  children: React.ReactNode
}

/**
 * Section header + content. Mirrors the Inspector's transform / Mesh
 * / Tile Properties sections. Heading style matches the project's
 * `text-sm font-medium border-b border-editor-border pb-1`.
 */
export function PanelSection({ title, children }: PanelSectionProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium border-b border-editor-border pb-1">{title}</h4>
      {children}
    </div>
  )
}

export interface PanelActionsProps {
  onRemove: () => void
  removeLabel: string
}

/**
 * "Remove marker" button. Lives at the bottom of every panel once a
 * marker is present. Uses the existing Tailwind error-tone palette
 * so users get the visual cue "this destroys the marker".
 */
export function PanelActions({ onRemove, removeLabel }: PanelActionsProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="w-full px-2 py-1 text-xs text-red-400 border border-editor-border rounded hover:border-red-400 hover:bg-red-400/10 transition-colors"
    >
      {removeLabel}
    </button>
  )
}
