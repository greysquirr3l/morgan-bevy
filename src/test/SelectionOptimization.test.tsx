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
import { act, renderHook } from '@testing-library/react'
import TestRenderer, { act as rendererAct } from 'react-test-renderer'
import type { ReactTestInstance } from 'react-test-renderer'
import { Color } from 'three'
import { describe, expect, it } from 'vitest'
import { SelectionHighlight, useSelectionManager } from '../performance/SelectionOptimization'

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

/**
 * Regression coverage for the "selected objects don't turn blue in the
 * Optimized viewport" bug.
 *
 * The bug: `SelectionHighlight` used to assume its `children` were bare
 * geometry and wrapped them in its own `<mesh>` — but its only caller
 * (`OptimizedSceneObject`) actually passed a complete, already-mesh'd
 * subtree. That nested a geometry-bearing `<mesh>` inside a geometry-less
 * `<mesh>`, so the outer mesh's `material` never reached the visible
 * inner mesh, which fell back to Three's default (grey, non-reactive)
 * material. `Scene.tsx`'s non-optimized path never had this bug because
 * it always applied `<meshStandardMaterial>` directly as a sibling of the
 * geometry inside a single `<mesh>`.
 *
 * These tests render the actual component tree (via react-test-renderer,
 * which — unlike jsdom — treats R3F's custom element strings like "mesh"
 * as plain host nodes without trying to interpret them as DOM) and assert
 * on its shape, so any future regression that re-introduces mesh-in-mesh
 * nesting, or drops the material from the geometry-bearing mesh, fails
 * the suite instead of only being visible by eye in the viewport.
 */
describe('SelectionHighlight', () => {
  function renderHighlight(props: {
    isSelected: boolean
    isHovered: boolean
    onClick?: () => void
    userData?: Record<string, unknown>
  }) {
    let renderer: TestRenderer.ReactTestRenderer
    rendererAct(() => {
      renderer = TestRenderer.create(
        <SelectionHighlight
          isSelected={props.isSelected}
          isHovered={props.isHovered}
          baseColor="#9ca3af"
          position={[1, 2, 3]}
          onClick={props.onClick}
          userData={props.userData}
        >
          <boxGeometry args={[1, 1, 1]} />
        </SelectionHighlight>
      )
    })
    return renderer!
  }

  function findGeometryMesh(meshes: ReactTestInstance[]): ReactTestInstance {
    const geometryMesh = meshes.find(mesh =>
      mesh.children.some(
        child => typeof child !== 'string' && child.type === 'boxGeometry'
      )
    )
    if (!geometryMesh) throw new Error('No mesh contains the boxGeometry children')
    return geometryMesh
  }

  it('puts the selected blue material directly on the geometry-bearing mesh', () => {
    const onClick = () => {}
    const renderer = renderHighlight({
      isSelected: true,
      isHovered: false,
      onClick,
      userData: { objectId: 'obj-1', meshType: 'cube' },
    })

    const meshes = renderer.root.findAllByType('mesh')
    const geometryMesh = findGeometryMesh(meshes)

    // The material must be a direct sibling of the geometry, not stranded
    // on some other (outer) mesh.
    const materials = geometryMesh.findAllByType('meshStandardMaterial')
    expect(materials).toHaveLength(1)
    const color = materials[0].props.color as Color
    expect(color.getHexString()).toBe(new Color('#60a5fa').getHexString())

    // The interaction/transform props must land on this same mesh.
    expect(geometryMesh.props.onClick).toBe(onClick)
    expect(geometryMesh.props.position).toEqual([1, 2, 3])
    expect(geometryMesh.props.userData).toEqual({ objectId: 'obj-1', meshType: 'cube' })
  })

  it('never nests a mesh inside another mesh (the original bug)', () => {
    const renderer = renderHighlight({ isSelected: true, isHovered: false })
    const meshes = renderer.root.findAllByType('mesh')

    for (const mesh of meshes) {
      const nestedMeshes = mesh.children.filter(
        child => typeof child !== 'string' && child.type === 'mesh'
      )
      expect(nestedMeshes).toHaveLength(0)
    }
  })

  it('gives the outline mesh the same transform but no click handler, userData, or raycasting', () => {
    const onClick = () => {}
    const renderer = renderHighlight({
      isSelected: true,
      isHovered: false,
      onClick,
      userData: { objectId: 'obj-1', meshType: 'cube' },
    })

    const meshes = renderer.root.findAllByType('mesh')
    const outlineMesh = meshes.find(
      mesh => mesh.props.material && mesh.props.material.type === 'ShaderMaterial'
    )
    expect(outlineMesh).toBeDefined()
    expect(outlineMesh!.props.position).toEqual([1, 2, 3])
    expect(outlineMesh!.props.onClick).toBeUndefined()
    expect(outlineMesh!.props.userData).toBeUndefined()
    expect(typeof outlineMesh!.props.raycast).toBe('function')
    expect(outlineMesh!.props.raycast()).toBeNull()
  })

  it('falls back to the base (unselected) color and skips the outline when not selected or hovered', () => {
    const renderer = renderHighlight({ isSelected: false, isHovered: false })
    const meshes = renderer.root.findAllByType('mesh')

    // No outline mesh (ShaderMaterial) should exist.
    const outlineMesh = meshes.find(
      mesh => mesh.props.material && mesh.props.material.type === 'ShaderMaterial'
    )
    expect(outlineMesh).toBeUndefined()

    const geometryMesh = findGeometryMesh(meshes)
    const materials = geometryMesh.findAllByType('meshStandardMaterial')
    expect(materials).toHaveLength(1)
    const color = materials[0].props.color as Color
    expect(color.getHexString()).toBe(new Color('#9ca3af').getHexString())
  })
})
