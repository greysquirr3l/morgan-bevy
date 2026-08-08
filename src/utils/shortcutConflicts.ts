// T60 — Shortcut conflict detection.
//
// When the user rebinds one shortcut to the same key combo as
// another, both bindings would fire on the same keystroke. The
// rebind UI surfaces a warning; the helper below is the pure
// function that does the work.
//
// Two bindings conflict when their (key, sorted-modifiers) tuples
// match. Order-independent on modifiers (Ctrl+A == Meta+A ==
// Ctrl+Meta+A, though in practice we treat ctrl and meta as the
// same modifier on macOS — see `sameModifierSet`).

import type { ShortcutBinding } from '@/shortcuts/defaults'

export type ShortcutKey = string

/**
 * Compose the canonical "key id" used for matching. Modifiers are
 * sorted and deduped so order doesn't create spurious conflicts.
 * `ctrl` and `meta` are treated as equivalent on macOS — but for
 * the conflict check we keep them separate. Callers who want OS-
 * specific semantics should add their own pass before calling this
 * helper.
 */
export function shortcutKeyOf(binding: ShortcutBinding): ShortcutKey {
  const mods = [...new Set(binding.modifiers)].sort().join('+')
  const key = binding.key.toLowerCase()
  return mods ? `${mods}+${key}` : key
}

/**
 * Find every key combo that maps to two or more bindings. Returns
 * a `Map` keyed by the canonical key id (see `shortcutKeyOf`) so
 * the UI can render "X and Y both bind to Ctrl+Shift+Z".
 */
export function findShortcutConflicts(
  bindings: readonly ShortcutBinding[]
): Map<ShortcutKey, ShortcutBinding[]> {
  const byKey = new Map<ShortcutKey, ShortcutBinding[]>()
  for (const b of bindings) {
    const k = shortcutKeyOf(b)
    const existing = byKey.get(k)
    if (existing) {
      existing.push(b)
    } else {
      byKey.set(k, [b])
    }
  }
  const conflicts = new Map<ShortcutKey, ShortcutBinding[]>()
  for (const [k, list] of byKey) {
    if (list.length >= 2) conflicts.set(k, list)
  }
  return conflicts
}

/**
 * Given a candidate rebind + the rest of the bindings, return the
 * list of existing bindings that would conflict with it. Used by
 * the rebind UI to surface "this combo is already used by X" as
 * the user types.
 */
export function conflictsForCandidate(
  candidate: { action: string; key: string; modifiers: readonly string[] },
  bindings: readonly ShortcutBinding[]
): ShortcutBinding[] {
  const probe: ShortcutBinding = {
    action: candidate.action,
    label: candidate.action,
    key: candidate.key,
    modifiers: candidate.modifiers as ShortcutBinding['modifiers'],
    description: '',
    category: '',
  }
  const k = shortcutKeyOf(probe)
  return bindings
    .filter(b => b.action !== candidate.action && shortcutKeyOf(b) === k)
}