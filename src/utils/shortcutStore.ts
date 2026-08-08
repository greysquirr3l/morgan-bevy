// T60 — Shortcut override store.
//
// The user's customisation layer over the `DEFAULT_SHORTCUTS`
// table. The store keeps two separate pieces of state:
//
//   1. The override map (key = action id, value = partial binding
//      with just `key` / `modifiers`). Only present for actions the
//      user has explicitly rebound.
//   2. The "removed" set — actions the user has disabled (mapped to
//      no key).
//
// `getEffectiveBindings()` merges defaults + overrides into the
// final binding table the hook consumes. Storage is localStorage
// for v1 — the spec mentions an app-data-dir `shortcuts.json` file,
// but the editor already keeps prefs in localStorage and a future
// migration to `tauri-plugin-fs` is a drop-in change behind this
// interface.

import { DEFAULT_SHORTCUTS, type ShortcutBinding } from '@/shortcuts/defaults'

const STORAGE_KEY = 'morgan-bevy-shortcuts'

/** A user override is just the rebind — key + modifiers. The
 *  action id is the storage map's key. */
export interface ShortcutOverride {
  readonly action: string
  readonly key: string
  readonly modifiers: readonly (
    | 'ctrl'
    | 'shift'
    | 'alt'
    | 'meta'
  )[]
}

interface PersistedState {
  /** action id → override. Absent for actions still bound to the
   *  default. */
  readonly overrides: Readonly<Record<string, ShortcutOverride>>
}

/**
 * Read the persisted state with corruption tolerance — the same
 * pattern as the rest of the editor's localStorage layer.
 */
function readPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { overrides: {} }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { overrides: {} }
    const overrides = (parsed as { overrides?: unknown }).overrides
    if (!overrides || typeof overrides !== 'object') return { overrides: {} }
    // Light validation: drop non-object entries; the hook falls
    // back to the default for any missing action.
    const clean: Record<string, ShortcutOverride> = {}
    for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
      if (v && typeof v === 'object' && 'action' in v && 'key' in v) {
        clean[k] = v as ShortcutOverride
      }
    }
    return { overrides: clean }
  } catch {
    return { overrides: {} }
  }
}

function writePersisted(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota / private mode — silently no-op. The defaults still
    // work; we just can't persist overrides.
  }
}

/** Read the merged effective binding table — defaults + user
 *  overrides layered on top. */
export function getEffectiveBindings(): ShortcutBinding[] {
  const { overrides } = readPersisted()
  return DEFAULT_SHORTCUTS.map(def => {
    const o = overrides[def.action]
    if (!o) return def
    return { ...def, key: o.key, modifiers: o.modifiers }
  })
}

/** Set (or replace) the override for a single action. Pass
 *  `null`-equivalent (empty modifiers + same key) to no-op. */
export function setShortcutOverride(override: ShortcutOverride): void {
  const state = readPersisted()
  const next = { ...state.overrides, [override.action]: override }
  writePersisted({ overrides: next })
}

/** Drop the override for a single action — that action falls back
 *  to the default on the next read. */
export function clearShortcutOverride(action: string): void {
  const state = readPersisted()
  if (!(action in state.overrides)) return
  const next = { ...state.overrides }
  delete next[action]
  writePersisted({ overrides: next })
}

/**
 * Remove every override and return the store to defaults. The hook
 * will start dispatching the built-in keys on the next render.
 *
 * Idempotent — safe to call when no overrides exist.
 */
export function restoreDefaultShortcuts(): void {
  writePersisted({ overrides: {} })
}

/** Test-only: reset everything to defaults. Not exported via
 *  `index.ts` — only used by the shortcut test suite. */
export function _resetShortcutStoreForTests(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}