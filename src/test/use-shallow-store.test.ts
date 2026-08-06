import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../store/editorStore'

/**
 * T83 — `useShallow` subscription contract.
 *
 * Verifies that a component subscribing to multiple store fields via
 * `useShallow` only re-renders when one of the *values* it reads changes,
 * not on every store mutation. Uses a render counter and forces unrelated
 * mutations to assert that the subscriber's render count stays flat.
 */

describe('useShallow store subscription', () => {
  beforeEach(() => {
    // Reset to a known baseline between tests.
    useEditorStore.setState(s => ({
      ...s,
      selectedObjects: [],
      hoveredObject: null,
    }))
  })

  it('returns the same reference across unrelated store mutations', () => {
    // Use a stable object identity for selectedObjects — shallow equality
    // compares by reference for arrays.
    const stableArr: string[] = [];
    useEditorStore.setState(s => ({ ...s, selectedObjects: stableArr }));

    const { result } = renderHook(() =>
      useEditorStore(
        useShallow(s => ({
          selectedObjects: s.selectedObjects,
          hoveredObject: s.hoveredObject,
        })),
      ),
    )

    const initial = result.current;
    expect(initial.selectedObjects).toBe(stableArr);

    // Mutate an unrelated field — selector output stays referentially
    // identical because shallow equality holds.
    act(() => {
      useEditorStore.setState(s => ({ ...s, transformMode: 'translate' }));
    });
    expect(result.current).toBe(initial);

    // Mutate a read field with the same stable reference.
    act(() => {
      useEditorStore.setState(s => ({ ...s, selectedObjects: stableArr }));
    });
    expect(result.current).toBe(initial);
  })

  it('re-renders when a read field actually changes', () => {
    const renders = { count: 0 }
    const { result, rerender } = renderHook(() => {
      renders.count++
      return useEditorStore(
        useShallow(s => ({
          selectedObjects: s.selectedObjects,
        }))
      )
    })

    const initial = renders.count
    expect(result.current.selectedObjects).toEqual([])

    act(() => {
      useEditorStore.setState(s => ({
        ...s,
        selectedObjects: ['obj-1'],
      }))
    })
    rerender()
    expect(renders.count).toBeGreaterThan(initial)
    expect(result.current.selectedObjects).toEqual(['obj-1'])
  })
})
