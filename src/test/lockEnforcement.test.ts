/**
 * Regression for audit Major #11: `obj.locked` and
 * `layers.find(...).locked` were checked only for cosmetic
 * display (Hierarchy eye icon, layer name colour). Pin the
 * enforcement in the command classes so every caller
 * (ActionsPanel, keyboard shortcuts, Edit menu, ...) gets the
 * guard for free.
 */
import { useEditorStore } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'
import { DeleteObjectCommand, DuplicateCommand } from '@/utils/commands'
import { describe, expect, it, beforeEach } from 'vitest'

function seedObject(id: ObjectId, opts: Partial<{ locked: boolean; layerId: ReturnType<typeof LayerId> }> = {}) {
  useEditorStore.setState(state => {
    state.sceneObjects.set(id, {
      id,
      name: id,
      type: 'mesh',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: opts.locked ?? false,
      layerId: opts.layerId ?? LayerId('default'),
      children: [],
      meshType: 'cube',
    })
  })
}

describe('Lock enforcement (regression for Major #11)', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sceneObjects: new Map(),
      selectedObjects: [],
      undoHistory: [],
      redoHistory: [],
      layers: [
        { id: LayerId('default'), name: 'Default', visible: true, locked: false, color: '#fff' },
        { id: LayerId('walls'), name: 'Walls', visible: true, locked: false, color: '#888' },
      ],
    })
  })

  it('DeleteObjectCommand throws on a locked object', () => {
    seedObject(ObjectId('locked_target'), { locked: true })
    expect(() => new DeleteObjectCommand(ObjectId('locked_target'))).toThrow(/is locked/)
  })

  it('DeleteObjectCommand throws on an object whose layer is locked', () => {
    useEditorStore.setState(state => {
      state.layers = state.layers.map(l =>
        l.id === LayerId('walls') ? { ...l, locked: true } : l,
      )
    })
    seedObject(ObjectId('locked_layer_obj'), { layerId: LayerId('walls') })
    expect(() => new DeleteObjectCommand(ObjectId('locked_layer_obj'))).toThrow(/locked layer/)
  })

  it('DeleteObjectCommand allows deletion of an unlocked object on an unlocked layer', () => {
    seedObject(ObjectId('free_target'))
    expect(() => new DeleteObjectCommand(ObjectId('free_target'))).not.toThrow()
  })

  it('DuplicateCommand silently filters out locked sources', () => {
    seedObject(ObjectId('keep_me'))
    seedObject(ObjectId('skip_me_locked'), { locked: true })
    const cmd = new DuplicateCommand([ObjectId('keep_me'), ObjectId('skip_me_locked')])
    // The command's filtered source list drives `duplicateObjects`;
    // verify by inspecting its description length, which the
    // constructor formats as `Duplicate N object(s)`.
    expect(cmd.description).toBe('Duplicate 1 object(s)')
  })

  it('DuplicateCommand silently filters out objects on a locked layer', () => {
    useEditorStore.setState(state => {
      state.layers = state.layers.map(l =>
        l.id === LayerId('walls') ? { ...l, locked: true } : l,
      )
    })
    seedObject(ObjectId('walls_obj'), { layerId: LayerId('walls') })
    seedObject(ObjectId('default_obj'))
    const cmd = new DuplicateCommand([ObjectId('walls_obj'), ObjectId('default_obj')])
    expect(cmd.description).toBe('Duplicate 1 object(s)')
  })
})