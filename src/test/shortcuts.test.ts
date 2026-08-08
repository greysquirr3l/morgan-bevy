/**
 * T60 — User-configurable keyboard shortcuts.
 *
 * Contract pinned:
 *  - The default table covers every action the original hardcoded
 *    switch statement dispatched (the spec test "user override
 *    beats built-in" plus "restoring defaults removes all overrides").
 *  - `setShortcutOverride` + `getEffectiveBindings` round-trip —
 *    user override for a single action swaps in just that action's
 *    key, leaving every other binding untouched.
 *  - `restoreDefaultShortcuts` clears all overrides so the next
 *    read returns pure defaults.
 *  - `findShortcutConflicts` flags every key combo shared by two
 *    or more bindings.
 *  - `conflictsForCandidate` flags existing bindings that share a
 *    candidate's key combo (excluding the candidate itself).
 *  - `shortcutKeyOf` normalises modifier order so Ctrl+Shift+Z and
 *    Shift+Ctrl+Z map to the same key id.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_SHORTCUTS } from '@/shortcuts/defaults'
import {
  conflictsForCandidate,
  findShortcutConflicts,
  shortcutKeyOf,
} from '@/utils/shortcutConflicts'
import {
  _resetShortcutStoreForTests,
  clearShortcutOverride,
  getEffectiveBindings,
  restoreDefaultShortcuts,
  setShortcutOverride,
} from '@/utils/shortcutStore'

const STORAGE_KEY = 'morgan-bevy-shortcuts'

function resetStore(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

beforeEach(resetStore)
afterEach(resetStore)

describe('T60 default table', () => {
  it('covers the original hard-coded actions', () => {
    const actions = new Set(DEFAULT_SHORTCUTS.map(b => b.action))
    expect(actions.has('transform.translate')).toBe(true)
    expect(actions.has('transform.rotate')).toBe(true)
    expect(actions.has('transform.scale')).toBe(true)
    expect(actions.has('toggle.grid')).toBe(true)
    expect(actions.has('selection.clear')).toBe(true)
    expect(actions.has('selection.delete')).toBe(true)
    expect(actions.has('selection.selectAll')).toBe(true)
    expect(actions.has('clipboard.copy')).toBe(true)
    expect(actions.has('clipboard.paste')).toBe(true)
    expect(actions.has('undo')).toBe(true)
    expect(actions.has('redo')).toBe(true)
    expect(actions.has('scene.duplicate')).toBe(true)
    expect(actions.has('scene.save')).toBe(true)
    expect(actions.has('scene.open')).toBe(true)
    expect(actions.has('scene.export')).toBe(true)
    expect(actions.has('camera.orbit')).toBe(true)
    expect(actions.has('camera.frameAll')).toBe(true)
    expect(actions.has('camera.focusSelection')).toBe(true)
    expect(actions.has('camera.toggleCoordinateSpace')).toBe(true)
    expect(actions.has('constraint.x')).toBe(true)
    expect(actions.has('constraint.yz')).toBe(true)
  })

  it('has unique action ids', () => {
    const ids = DEFAULT_SHORTCUTS.map(b => b.action)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('T60 shortcutKeyOf', () => {
  it('sorts modifiers so Ctrl+Shift+Z == Shift+Ctrl+Z', () => {
    const a = shortcutKeyOf({ ...DEFAULT_SHORTCUTS[0], key: 'z', modifiers: ['ctrl', 'shift'] })
    const b = shortcutKeyOf({ ...DEFAULT_SHORTCUTS[0], key: 'z', modifiers: ['shift', 'ctrl'] })
    expect(a).toBe(b)
  })

  it('lowercases the key', () => {
    const k = shortcutKeyOf({ ...DEFAULT_SHORTCUTS[0], key: 'Z', modifiers: ['ctrl'] })
    expect(k).toBe('ctrl+z')
  })
})

describe('T60 shortcut store', () => {
  it('returns the defaults when nothing is persisted', () => {
    const bindings = getEffectiveBindings()
    expect(bindings.length).toBe(DEFAULT_SHORTCUTS.length)
    expect(bindings.find(b => b.action === 'transform.translate')?.key).toBe('w')
  })

  it('user override beats built-in (spec test)', () => {
    setShortcutOverride({ action: 'transform.translate', key: 't', modifiers: [] })
    const after = getEffectiveBindings().find(b => b.action === 'transform.translate')
    expect(after?.key).toBe('t')
    // Every other binding stays at its default.
    expect(after?.modifiers).toEqual([])
    const rotate = getEffectiveBindings().find(b => b.action === 'transform.rotate')
    expect(rotate?.key).toBe('e')
  })

  it('clearing an override returns the action to its default', () => {
    setShortcutOverride({ action: 'transform.translate', key: 't', modifiers: [] })
    clearShortcutOverride('transform.translate')
    const after = getEffectiveBindings().find(b => b.action === 'transform.translate')
    expect(after?.key).toBe('w')
  })

  it('restoreDefaultShortcuts removes all overrides (spec test)', () => {
    setShortcutOverride({ action: 'transform.translate', key: 't', modifiers: [] })
    setShortcutOverride({ action: 'scene.save', key: 'p', modifiers: [] })
    restoreDefaultShortcuts()
    const bindings = getEffectiveBindings()
    expect(bindings.find(b => b.action === 'transform.translate')?.key).toBe('w')
    expect(bindings.find(b => b.action === 'scene.save')?.key).toBe('s')
  })

  it('tolerates a corrupted localStorage blob', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    const bindings = getEffectiveBindings()
    expect(bindings.length).toBe(DEFAULT_SHORTCUTS.length)
  })

  it('drops non-object override entries but keeps the rest', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        overrides: {
          'transform.translate': { action: 'transform.translate', key: 'q', modifiers: [] },
          'broken': 'not an object',
          'also-broken': { action: 'x' }, // missing `key`
          'transform.rotate': null,
        },
      })
    )
    const bindings = getEffectiveBindings()
    expect(bindings.find(b => b.action === 'transform.translate')?.key).toBe('q')
    // The broken entries were dropped, so the rest fall back to defaults.
    expect(bindings.find(b => b.action === 'transform.rotate')?.key).toBe('e')
  })

  it('the test helper clears state between tests', () => {
    setShortcutOverride({ action: 'transform.translate', key: 't', modifiers: [] })
    _resetShortcutStoreForTests()
    expect(getEffectiveBindings().find(b => b.action === 'transform.translate')?.key).toBe('w')
  })
})

describe('T60 conflict detection', () => {
  it('flags a key combo shared by two bindings', () => {
    const bindings: typeof DEFAULT_SHORTCUTS[number][] = [
      ...DEFAULT_SHORTCUTS,
      {
        action: 'duplicate.test',
        label: 'Duplicate Test',
        key: 'k',
        modifiers: ['ctrl'],
        description: '',
        category: 'Test',
      },
      // Default has 'clipboard.copy' on Ctrl+C. Force a conflict.
      {
        action: 'extra.copy',
        label: 'Extra Copy',
        key: 'c',
        modifiers: ['ctrl'],
        description: '',
        category: 'Test',
      },
    ]
    const conflicts = findShortcutConflicts(bindings)
    const conflictEntries = [...conflicts.entries()].filter(([, list]) => list.length >= 2)
    expect(conflictEntries.some(([, list]) => list.some(b => b.action === 'clipboard.copy'))).toBe(
      true
    )
  })

  it('returns an empty map when every combo is unique', () => {
    expect(findShortcutConflicts(DEFAULT_SHORTCUTS).size).toBe(0)
  })

  it('conflictsForCandidate excludes the candidate action itself', () => {
    const bindings = [...DEFAULT_SHORTCUTS]
    const conflicts = conflictsForCandidate(
      { action: 'transform.translate', key: 'z', modifiers: [] as Array<'ctrl' | 'shift' | 'alt' | 'meta'> },
      bindings
    )
    // Default `constraint.z` is on bare `z`, so this collides.
    expect(conflicts.some(b => b.action === 'constraint.z')).toBe(true)
    // The candidate action itself is excluded.
    expect(conflicts.some(b => b.action === 'transform.translate')).toBe(false)
  })

  it('conflictsForCandidate returns empty for a free combo', () => {
    const conflicts = conflictsForCandidate(
      { action: 'unused.action', key: 'q', modifiers: [] as Array<'ctrl' | 'shift' | 'alt' | 'meta'> },
      DEFAULT_SHORTCUTS
    )
    expect(conflicts).toEqual([])
  })
})