/**
 * useAutoSave — periodic localStorage snapshot of the editor state.
 *
 * The store is the source of truth. The auto-save hook observes the
 * scene + layer slice via `useShallow` so the timer does not re-arm
 * on every keystroke. A debounce window coalesces burst updates
 * (e.g. dragging a slider) into a single save; after the debounce
 * settles, the next `AUTOSAVE_INTERVAL_MS` cycle writes a snapshot
 * to `localStorage` under the `morgan-bevy.autosave` key.
 *
 * Errors are silently swallowed — the autosave is a UX nicety, not a
 * correctness requirement, and the user has manual Save (Ctrl+S)
 * for definitive persistence.
 */
import { useEditorStore } from '@/store/editorStore'
import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'

/** Snapshot key in `localStorage`. */
export const AUTOSAVE_KEY = 'morgan-bevy.autosave'

/** Auto-save interval (60s per the T20 spec). */
export const AUTOSAVE_INTERVAL_MS = 60_000

/** Debounce window after a mutation before the next save may run. */
const AUTOSAVE_DEBOUNCE_MS = 5_000

/**
 * Schema for the localStorage snapshot. Mirrors `ProjectDataSchema` but
 * uses `as const` literal unions (no zod dependency in the localStorage
 * path — we keep that surface narrow on purpose).
 */
export const AUTOSAVE_SCHEMA_VERSION = 1 as const

/** Best-effort write of a snapshot of the editor state. */
function writeSnapshot(state: {
  sceneObjects: unknown
  layers: unknown
  activeLayer: string
  selectedObjects: string[]
}): void {
  try {
    const payload = JSON.stringify({
      schemaVersion: AUTOSAVE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      scene: {
        objects: state.sceneObjects,
        layers: state.layers,
        activeLayer: state.activeLayer,
        selectedObjects: state.selectedObjects,
      },
    })
    localStorage.setItem(AUTOSAVE_KEY, payload)
  } catch {
    // Quota / private-mode / disabled storage — silent.
  }
}

/** Read the most recent autosave snapshot (or `null` if none). */
export function readAutosave(): {
  schemaVersion: number
  savedAt: string
  scene: {
    objects: unknown
    layers: unknown
    activeLayer: string
    selectedObjects: string[]
  }
} | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as never
  } catch {
    return null
  }
}

/** Clear the autosave snapshot (used after a successful manual save). */
export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    // Ignore — same reason as `writeSnapshot`.
  }
}

interface AutoSaveSlice {
  sceneObjects: unknown
  layers: unknown
  activeLayer: string
  selectedObjects: string[]
}

/**
 * Start the auto-save timer. Returns a `stop` callback that the caller
 * can invoke (e.g. on app teardown) to cancel the interval and the
 * debounce timer.
 *
 * The hook is intentionally not idempotent: calling it twice starts
 * two timers. The caller (e.g. `App.tsx`) should call it exactly once
 * per mount.
 */
export function useAutoSave(): void {
  const slice: AutoSaveSlice = useEditorStore(
    useShallow(s => ({
      sceneObjects: s.sceneObjects,
      layers: s.layers,
      activeLayer: s.activeLayer,
      selectedObjects: s.selectedObjects,
    }))
  )

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastWriteRef = useRef<number>(0)

  useEffect(() => {
    // Coalesce mutations into a debounced write.
    if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      writeSnapshot(slice)
      lastWriteRef.current = Date.now()
    }, AUTOSAVE_DEBOUNCE_MS)

    // Cleanup the debounce on unmount or when the slice identity changes.
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [slice])

  useEffect(() => {
    // Periodic re-save: even when the slice is stable, a snapshot at
    // the interval boundary captures the wall-clock timestamp. This
    // also covers the case where the debounce window expired and the
    // user kept the same state.
    intervalRef.current = setInterval(() => {
      // Throttle: do not write more than once per interval, even if
      // the debounce timer is still pending.
      const sinceLast = Date.now() - lastWriteRef.current
      if (sinceLast < AUTOSAVE_INTERVAL_MS - 1_000) return
      writeSnapshot(slice)
      lastWriteRef.current = Date.now()
    }, AUTOSAVE_INTERVAL_MS)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [slice])
}
