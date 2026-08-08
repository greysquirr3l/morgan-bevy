/**
 * T78 regression — the viewport's render list must be built from the
 * `sceneObjects` Map with `Array.from(map.values())`, not
 * `Object.values(map)` (which returns `[]` for a Map, since a Map's
 * entries are not its own enumerable properties). The bug shipped a
 * 3D viewport that silently rendered zero objects no matter how many
 * were in the scene.
 */
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import Scene from '@/components/Viewport3D/Scene'
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
  }
}

describe('Scene renders one mesh per store object', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sceneObjects: new Map(),
      selectedObjects: [],
      hoveredObject: null,
      layers: [
        { id: LayerId('default'), name: 'Default', visible: true, locked: false, color: '#fff' },
      ],
    })
  })

  it('renders zero object meshes for an empty scene', () => {
    const { container } = render(<Scene />)
    expect(container.querySelectorAll('mesh[name]').length).toBe(0)
  })

  it('renders exactly one mesh per object in the store', () => {
    const ids = [ObjectId('obj_one'), ObjectId('obj_two'), ObjectId('obj_three')]
    useEditorStore.setState(state => {
      for (const id of ids) state.sceneObjects.set(id, makeObject(id))
    })

    const { container } = render(<Scene />)
    // `name` is only set on per-object meshes (not the ground plane or
    // the debug reference axes), so this selector counts exactly the
    // objects the viewport actually rendered from the store.
    const rendered = container.querySelectorAll('mesh[name]')
    expect(rendered.length).toBe(ids.length)
    expect(new Set(Array.from(rendered).map(el => el.getAttribute('name')))).toEqual(new Set(ids))
  })

  it('skips objects marked invisible', () => {
    const visibleId = ObjectId('visible_obj')
    const hiddenId = ObjectId('hidden_obj')
    useEditorStore.setState(state => {
      state.sceneObjects.set(visibleId, makeObject(visibleId))
      state.sceneObjects.set(hiddenId, { ...makeObject(hiddenId), visible: false })
    })

    const { container } = render(<Scene />)
    const rendered = container.querySelectorAll('mesh[name]')
    expect(rendered.length).toBe(1)
    expect(rendered[0]?.getAttribute('name')).toBe(visibleId)
  })
})
