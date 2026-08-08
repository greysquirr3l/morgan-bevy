/**
 * T78 regression — same bug class as Scene.test.tsx, but for the
 * default render path: `Viewport3D` renders `OptimizedScene` unless
 * the user toggles "Standard" rendering. `OptimizedScene` built its
 * render list with `Object.values(sceneObjects)` — `[]` for a Map —
 * so the default viewport rendered nothing regardless of scene
 * content.
 *
 * `usePerformanceCulling`/`usePerformanceManager`/`useLOD` (imported
 * transitively through `@/performance`) call `@react-three/fiber`'s
 * `useFrame`/`useThree`, which throw outside a `<Canvas>`. They're
 * mocked here to no-ops — the initial (pre-frame) state of every one
 * of those hooks defaults to "visible," so the render list itself
 * (the thing under test) is unaffected.
 */
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: () => ({ camera: { position: { distanceTo: () => 0 } } }),
}))

import OptimizedScene from '@/components/Viewport3D/OptimizedScene'
import { useEditorStore, type SceneObject } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'

function makeObject(id: ObjectId): SceneObject {
  return {
    id,
    name: id,
    type: 'mesh',
    meshType: 'cube',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    layerId: LayerId('default'),
    children: [],
    material: { baseColor: '#9ca3af', metallic: 0, roughness: 0.5 },
  }
}

describe('OptimizedScene renders one mesh per store object', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sceneObjects: new Map(),
      selectedObjects: [],
      hoveredObject: null,
      showStats: false,
      layers: [
        { id: LayerId('default'), name: 'Default', visible: true, locked: false, color: '#fff' },
      ],
    })
  })

  it('renders zero object meshes for an empty scene', () => {
    const { container } = render(<OptimizedScene />)
    expect(container.querySelectorAll('mesh[name]').length).toBe(0)
  })

  it('renders one mesh per object in the store (individual render path)', () => {
    const ids = [ObjectId('opt_one'), ObjectId('opt_two'), ObjectId('opt_three')]
    useEditorStore.setState(state => {
      for (const id of ids) state.sceneObjects.set(id, makeObject(id))
    })

    const { container } = render(<OptimizedScene />)
    const rendered = container.querySelectorAll('mesh[name]')
    expect(rendered.length).toBe(ids.length)
    expect(new Set(Array.from(rendered).map(el => el.getAttribute('name')))).toEqual(new Set(ids))
  })
})
