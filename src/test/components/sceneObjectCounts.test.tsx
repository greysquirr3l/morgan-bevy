/**
 * T78 regression — panels that count or list scene objects via
 * `Object.values`/`Object.keys(sceneObjects)` silently showed "0
 * objects" / an empty list for any non-empty scene, since a `Map`
 * has no own enumerable properties. Covers the three panels the
 * fallout swept up: Hierarchy, Layers, and PerformanceTestPanel.
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import Hierarchy from '@/components/Hierarchy/Hierarchy'
import Layers from '@/components/Layers'
import PerformanceTestPanel from '@/components/PerformanceTestPanel'
import { useEditorStore, type SceneObject } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'

function makeObject(id: ObjectId, layerId: LayerId = LayerId('default')): SceneObject {
  return {
    id,
    name: `Object ${id}`,
    type: 'mesh',
    meshType: 'cube',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    layerId,
    children: [],
  }
}

const defaultLayers = [
  { id: LayerId('default'), name: 'Default', visible: true, locked: false, color: '#fff' },
  { id: LayerId('walls'), name: 'Walls', visible: true, locked: false, color: '#8b5cf6' },
]

describe('Hierarchy object list', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sceneObjects: new Map(),
      selectedObjects: [],
      layers: defaultLayers,
      activeLayer: LayerId('default'),
    })
  })

  it('shows "No objects in scene" when the store is empty', () => {
    render(<Hierarchy />)
    expect(screen.getByText('No objects in scene')).toBeInTheDocument()
  })

  it('lists every object in the store and shows the real count', () => {
    useEditorStore.setState(state => {
      state.sceneObjects.set(ObjectId('h_one'), makeObject(ObjectId('h_one')))
      state.sceneObjects.set(ObjectId('h_two'), makeObject(ObjectId('h_two')))
    })
    render(<Hierarchy />)
    expect(screen.queryByText('No objects in scene')).not.toBeInTheDocument()
    expect(screen.getByText('Object h_one')).toBeInTheDocument()
    expect(screen.getByText('Object h_two')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

describe('Layers per-layer object count', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sceneObjects: new Map(),
      selectedObjects: [],
      layers: defaultLayers,
      activeLayer: LayerId('default'),
    })
  })

  it('counts objects per layer instead of always reading zero', () => {
    useEditorStore.setState(state => {
      state.sceneObjects.set(
        ObjectId('l_default_1'),
        makeObject(ObjectId('l_default_1'), LayerId('default'))
      )
      state.sceneObjects.set(
        ObjectId('l_walls_1'),
        makeObject(ObjectId('l_walls_1'), LayerId('walls'))
      )
      state.sceneObjects.set(
        ObjectId('l_walls_2'),
        makeObject(ObjectId('l_walls_2'), LayerId('walls'))
      )
    })
    render(<Layers />)
    expect(screen.getByTitle('Default (1 objects)')).toBeInTheDocument()
    expect(screen.getByTitle('Walls (2 objects)')).toBeInTheDocument()
  })
})

describe('PerformanceTestPanel object count', () => {
  beforeEach(() => {
    useEditorStore.setState({ sceneObjects: new Map() })
  })

  it('reflects the store size instead of always reading zero', () => {
    useEditorStore.setState(state => {
      state.sceneObjects.set(ObjectId('perf_one'), makeObject(ObjectId('perf_one')))
      state.sceneObjects.set(ObjectId('perf_two'), makeObject(ObjectId('perf_two')))
      state.sceneObjects.set(ObjectId('perf_three'), makeObject(ObjectId('perf_three')))
    })
    render(<PerformanceTestPanel />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
