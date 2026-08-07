/**
 * Tests for the transform-constraints module (T70).
 *
 * Covers:
 *  - applyConstraint zeros the non-constrained axes for every kind.
 *  - applyRotationConstraint does the same for Euler rotations.
 *  - handleKeyInput maps X/Y/Z + Shift-modifier to the right constraint,
 *    escape clears, and 'select' transformMode opts out.
 *  - getVisualIndicator returns null when no constraint is active.
 *  - subscribers receive state updates and unsubscribers stop receiving.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

// The constraints module imports the editor store lazily, so the
// `handleKeyInput` path needs a real-or-mocked store. We mock the
// store here and only set the `transformMode` field that
// handleKeyInput actually reads.
vi.mock('@/store/editorStore', () => ({
  useEditorStore: {
    getState: () => ({ transformMode: 'translate' }),
  },
}))

import {
  transformConstraints,
  type AxisConstraint,
} from '../utils/transformConstraints'

describe('transformConstraints.applyConstraint', () => {
  beforeEach(() => transformConstraints.clearConstraint())

  const cases: Array<[AxisConstraint, [number, number, number], [number, number, number]]> = [
    ['x', [1, 2, 3], [1, 0, 0]],
    ['y', [1, 2, 3], [0, 2, 0]],
    ['z', [1, 2, 3], [0, 0, 3]],
    ['xy', [1, 2, 3], [1, 2, 0]],
    ['xz', [1, 2, 3], [1, 0, 3]],
    ['yz', [1, 2, 3], [0, 2, 3]],
  ]

  for (const [constraint, input, expected] of cases) {
    it(`zero-out pattern for ${constraint}`, () => {
      transformConstraints.setConstraint(constraint)
      const out = transformConstraints.applyConstraint(
        new THREE.Vector3(...input),
      )
      expect([out.x, out.y, out.z]).toEqual(expected)
    })
  }

  it('returns the input unchanged when constraint is none', () => {
    transformConstraints.clearConstraint()
    const v = new THREE.Vector3(1, 2, 3)
    const out = transformConstraints.applyConstraint(v)
    expect([out.x, out.y, out.z]).toEqual([1, 2, 3])
  })

  it('does not mutate the input vector', () => {
    transformConstraints.setConstraint('y')
    const v = new THREE.Vector3(1, 2, 3)
    transformConstraints.applyConstraint(v)
    expect([v.x, v.y, v.z]).toEqual([1, 2, 3])
  })

  it('accepts an explicit override constraint', () => {
    transformConstraints.setConstraint('x')
    const out = transformConstraints.applyConstraint(
      new THREE.Vector3(1, 2, 3),
      'z',
    )
    // Override 'z' should win over the active 'x'.
    expect([out.x, out.y, out.z]).toEqual([0, 0, 3])
  })
})

describe('transformConstraints.applyRotationConstraint', () => {
  beforeEach(() => transformConstraints.clearConstraint())

  it('zero-out pattern matches translation for axis constraints', () => {
    transformConstraints.setConstraint('y')
    const e = new THREE.Euler(1, 2, 3)
    const out = transformConstraints.applyRotationConstraint(e)
    expect([out.x, out.y, out.z]).toEqual([0, 2, 0])
  })

  it('plane constraints zero the perpendicular axis', () => {
    transformConstraints.setConstraint('xy')
    const e = new THREE.Euler(1, 2, 3)
    const out = transformConstraints.applyRotationConstraint(e)
    // xy plane: no Z rotation
    expect(out.z).toBe(0)
    expect([out.x, out.y]).toEqual([1, 2])
  })
})

describe('transformConstraints.handleKeyInput', () => {
  // The mock above keeps transformMode='translate' so the handler
  // is willing to apply constraints. We exercise every documented
  // key binding.
  beforeEach(() => transformConstraints.clearConstraint())

  it('x sets an x-axis constraint', () => {
    expect(transformConstraints.handleKeyInput('x', true)).toBe(true)
    expect(transformConstraints.getState().activeConstraint).toBe('x')
  })

  it('shift+x sets the yz-plane constraint', () => {
    transformConstraints.handleKeyInput('shift+x', true)
    expect(transformConstraints.getState().activeConstraint).toBe('yz')
  })

  it('shift+y sets the xz-plane constraint', () => {
    transformConstraints.handleKeyInput('shift+y', true)
    expect(transformConstraints.getState().activeConstraint).toBe('xz')
  })

  it('shift+z sets the xy-plane constraint', () => {
    transformConstraints.handleKeyInput('shift+z', true)
    expect(transformConstraints.getState().activeConstraint).toBe('xy')
  })

  it('escape clears the active constraint', () => {
    transformConstraints.setConstraint('x')
    transformConstraints.handleKeyInput('escape', true)
    expect(transformConstraints.getState().activeConstraint).toBe('none')
  })

  it('returns false for an unhandled key', () => {
    expect(transformConstraints.handleKeyInput('q', true)).toBe(false)
  })
})

describe('transformConstraints.getVisualIndicator', () => {
  beforeEach(() => transformConstraints.clearConstraint())

  it('returns null when no constraint is active', () => {
    expect(transformConstraints.getVisualIndicator()).toBeNull()
  })

  it('returns a coloured label for every axis constraint', () => {
    for (const axis of ['x', 'y', 'z', 'xy', 'xz', 'yz'] as const) {
      transformConstraints.setConstraint(axis)
      const ind = transformConstraints.getVisualIndicator()
      expect(ind).not.toBeNull()
      expect(ind?.text.length).toBeGreaterThan(0)
      expect(ind?.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('transformConstraints subscription lifecycle', () => {
  let received: Array<{ active: AxisConstraint; isActive: boolean }>

  beforeEach(() => {
    received = []
    transformConstraints.clearConstraint()
  })
  afterEach(() => {
    transformConstraints.clearConstraint()
  })

  it('notifies subscribers on setConstraint / clearConstraint', () => {
    const unsub = transformConstraints.subscribe(s => {
      received.push({ active: s.activeConstraint, isActive: s.isConstraintActive })
    })
    transformConstraints.setConstraint('x')
    transformConstraints.setConstraint('yz')
    transformConstraints.clearConstraint()
    unsub()

    expect(received.map(r => r.active)).toEqual(['x', 'yz', 'none'])
    expect(received.map(r => r.isActive)).toEqual([true, true, false])
  })

  it('stops notifying once unsubscribed', () => {
    const unsub = transformConstraints.subscribe(() => received.push('x'))
    transformConstraints.setConstraint('x')
    unsub()
    transformConstraints.setConstraint('y')
    expect(received).toEqual(['x'])
  })
})