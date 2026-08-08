/**
 * Tests for the menu-action discriminated unions (T82).
 * Verifies:
 *  - Every *_ACTIONS tuple exposes its literal type correctly.
 *  - assertNeverAction throws on a bogus value.
 *  - The tuple order matches the documented intent (a sanity check
 *    that someone didn't accidentally re-order literals).
 */
import { describe, expect, it } from 'vitest'
import {
  assertNeverAction,
  EDIT_ACTIONS,
  GENERATE_ACTIONS,
  HELP_ACTIONS,
  TOOLS_ACTIONS,
  VIEW_ACTIONS,
} from '../types/menuActions'

describe('menu-action unions', () => {
  it('EDIT_ACTIONS lists the expected literals in order', () => {
    expect([...EDIT_ACTIONS]).toEqual([
      'undo',
      'redo',
      'select-all',
      'deselect-all',
      'delete',
      'duplicate',
    ])
  })

  it('VIEW_ACTIONS lists the expected literals in order', () => {
    expect([...VIEW_ACTIONS]).toEqual([
      'show-left-panel',
      'show-right-panel',
      'hide-left-panel',
      'hide-right-panel',
      'toggle-grid',
      'reset-camera',
      'focus-selection',
      'switch-3d',
      'switch-2d',
    ])
  })

  it('GENERATE_ACTIONS lists the expected literals in order', () => {
    expect([...GENERATE_ACTIONS]).toEqual(['run-bsp', 'run-wfc', 'reroll-seed', 'focus-generation'])
  })

  it('TOOLS_ACTIONS lists the expected literals in order', () => {
    expect([...TOOLS_ACTIONS]).toEqual([
      'transform-select',
      'transform-move',
      'transform-rotate',
      'transform-scale',
      'toggle-snap',
      'grid-size',
    ])
  })

  it('HELP_ACTIONS lists the expected literals in order', () => {
    expect([...HELP_ACTIONS]).toEqual([
      'keyboard-shortcuts',
      'help',
      'about',
      'tutorial-getting-started',
      'tutorial-procedural-generation',
    ])
  })

  it('the tuples are disjoint (no overlap between namespaces)', () => {
    const all = new Set<string>([
      ...EDIT_ACTIONS,
      ...VIEW_ACTIONS,
      ...GENERATE_ACTIONS,
      ...TOOLS_ACTIONS,
      ...HELP_ACTIONS,
    ])
    expect(all.size).toBe(
      EDIT_ACTIONS.length +
        VIEW_ACTIONS.length +
        GENERATE_ACTIONS.length +
        TOOLS_ACTIONS.length +
        HELP_ACTIONS.length
    )
  })
})

describe('assertNeverAction', () => {
  it('throws when called with a bogus action value', () => {
    // @ts-expect-error - intentionally bogus value to exercise the runtime guard
    expect(() => assertNeverAction('not-a-real-action', EDIT_ACTIONS)).toThrow(
      /Unhandled menu action/
    )
  })

  it('error message references the namespace tuple', () => {
    // @ts-expect-error - same as above
    expect(() => assertNeverAction('mystery', VIEW_ACTIONS)).toThrow(/menuActions\.ts/)
  })
})
