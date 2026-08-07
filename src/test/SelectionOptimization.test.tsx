/**
 * Tests for the selection manager hook (T48).
 *
 * Covers:
 *  - Single-select replaces the selection by default.
 *  - Additive select toggles membership without dropping the rest.
 *  - selectMultiple unions or replaces depending on the additive flag.
 *  - The selection buffer reflects the canonical state for every
 *    tracked object id, including the `hovered` flag.
 *  - clearSelection empties both the set and the buffer.
 *  - hoverObject updates the buffer without touching the selection.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSelectionManager } from '../performance/SelectionOptimization'

describe('useSelectionManager', () => {
  it('starts with an empty selection', () => {
    const { result } = renderHook(() => useSelectionManager(['a', 'b', 'c']))
    expect(result.current.selectedObjects.size).toBe(0)
    expect(result.current.hoveredObject).toBeNull()
    expect(result.current.isSelected('a')).toBe(false)
    expect(result.current.isHovered('a')).toBe(false)
  })

  it('replaces the selection on non-additive selectObject', () => {
    const { result } = renderHook(() => useSelectionManager(['a', 'b', 'c']))
    act(() => result.current.selectObject('a'))
    act(() => result.current.selectObject('b'))
    expect([...result.current.selectedObjects]).toEqual(['b'])
    expect(result.current.isSelected('a')).toBe(false)
    expect(result.current.isSelected('b')).toBe(true)
  })

  it('toggles membership on additive selectObject', () => {
    const { result } = renderHook(() => useSelectionManager(['a', 'b', 'c']))
    act(() => result.current.selectObject('a', true))
    act(() => result.current.selectObject('b', true))
    act(() => result.current.selectObject('a', true))
    expect(result.current.isSelected('a')).toBe(false)
    expect(result.current.isSelected('b')).toBe(true)
  })

  it('selectMultiple replaces by default, unions additively', () => {
    const { result } = renderHook(() => useSelectionManager(['a', 'b', 'c']))
    act(() => result.current.selectObject('a'))
    act(() => result.current.selectMultiple(['b', 'c'], true))
    expect([...result.current.selectedObjects].sort()).toEqual(['a', 'b', 'c'])
    act(() => result.current.selectMultiple(['b']))
    expect([...result.current.selectedObjects]).toEqual(['b'])
  })

  it('clearSelection empties the set and the buffer', () => {
    const { result } = renderHook(() => useSelectionManager(['a', 'b']))
    act(() => result.current.selectObject('a'))
    act(() => result.current.hoverObject('b'))
    act(() => result.current.clearSelection())
    expect(result.current.selectedObjects.size).toBe(0)
    expect(result.current.isSelected('a')).toBe(false)
    // hover persists until explicitly cleared
    expect(result.current.isHovered('b')).toBe(true)
  })

  it('hoverObject only mutates the hovered flag', () => {
    const { result } = renderHook(() => useSelectionManager(['a', 'b']))
    act(() => result.current.selectObject('a'))
    act(() => result.current.hoverObject('b'))
    expect(result.current.selectedObjects.has('a')).toBe(true)
    expect(result.current.hoveredObject).toBe('b')
    expect(result.current.isHovered('a')).toBe(false)
    expect(result.current.isHovered('b')).toBe(true)
  })

  it('selectionBuffer mirrors the canonical state for every tracked id', () => {
    const { result } = renderHook(() => useSelectionManager(['a', 'b', 'c']))
    act(() => result.current.selectObject('a', true))
    act(() => result.current.hoverObject('b'))

    // The buffer is recomputed during render (T48: `useMemo` body
    // mutates the ref) so `result.current.selectionBuffer` reflects
    // the latest state immediately after the act() flush.
    const buffer = result.current.selectionBuffer
    expect(buffer.has('a')).toBe(true)
    expect(buffer.has('b')).toBe(true)
    expect(buffer.has('c')).toBe(true)
    expect(buffer.get('a')?.selected).toBe(true)
    expect(buffer.get('a')?.hovered).toBe(false)
    expect(buffer.get('b')?.selected).toBe(false)
    expect(buffer.get('b')?.hovered).toBe(true)
    expect(buffer.get('c')?.selected).toBe(false)
    expect(buffer.get('c')?.hovered).toBe(false)
  })

  it('dropping an id from objectIds removes it from the buffer', () => {
    let ids = ['a', 'b', 'c']
    const { result, rerender } = renderHook(({ next }) => useSelectionManager(next), {
      initialProps: { next: ids },
    })
    act(() => result.current.selectObject('a', true))
    expect(result.current.selectionBuffer.size).toBe(3)
    ids = ['a', 'c']
    rerender({ next: ids })
    expect(result.current.selectionBuffer.has('b')).toBe(false)
    expect(result.current.selectionBuffer.size).toBe(2)
  })
})
