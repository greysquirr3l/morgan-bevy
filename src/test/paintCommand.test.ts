/**
 * T54 — `PaintCommand` (undo/redo for the material paint tool).
 *
 * Required tests (per the task spec):
 *  1. Applying a material to a mesh updates the inspector
 *     immediately — proven here at the store layer: `execute()`
 *     writes `materialPresetId` synchronously, so any subscriber
 *     (the real Inspector reads `sceneObjects` the same way) sees
 *     the new value on the very next read, no debounce/async hop.
 *     A companion React-rendering test lives in
 *     `src/test/components/paintInspectorSync.test.tsx` for an
 *     end-to-end version of the same claim.
 *  2. Brush radius changes do not affect already-painted objects
 *     until the brush is re-applied — proven here by driving the
 *     exact sequence a real stroke would: paint at radius R1 (one
 *     PaintCommand), change the radius store value alone (no
 *     command), assert nothing new was painted, then paint again at
 *     the larger radius (a second PaintCommand) and assert only
 *     *that* stroke picks up the newly-in-range object.
 *
 * Plus one PaintCommand-level edge case: undo restores the exact
 * pre-stroke material shape (preset-linked / raw-material / none).
 */
import { useEditorStore, type SceneObject } from '@/store/editorStore'
import { LayerId, MaterialId, ObjectId } from '@/types/brand'
import { PaintCommand, type PaintTargetSnapshot } from '@/utils/commands'
import { selectPaintTargets } from '@/utils/paintTool'
import { beforeEach, describe, expect, it } from 'vitest'

function makeMesh(id: string, position: [number, number, number] = [0, 0, 0]): SceneObject {
  return {
    id: ObjectId(id),
    name: id,
    type: 'mesh',
    meshType: 'cube',
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    layerId: LayerId('default'),
    children: [],
  }
}

const METAL = MaterialId('default-metal')
const GOLD = MaterialId('default-gold')

describe('PaintCommand', () => {
  beforeEach(() => {
    useEditorStore.setState({
      sceneObjects: new Map(),
      selectedObjects: [],
      undoHistory: [],
      redoHistory: [],
    })
  })

  it('required: applying a material to a mesh updates the store (Inspector-visible state) immediately', () => {
    const id = ObjectId('target_1')
    useEditorStore.setState(state => {
      state.sceneObjects.set(id, makeMesh('target_1'))
    })
    expect(useEditorStore.getState().sceneObjects.get(id)?.materialPresetId).toBeUndefined()

    const targets: PaintTargetSnapshot[] = [{ objectId: id }]
    const command = new PaintCommand(targets, METAL)
    command.execute()

    // No await, no act(), no tick — the very next synchronous read
    // of the store already reflects the new material. This is what
    // "updates the inspector immediately" means for a Zustand-backed
    // panel: the Inspector re-renders off the same store mutation.
    expect(useEditorStore.getState().sceneObjects.get(id)?.materialPresetId).toBe(METAL)
  })

  it('undo restores a preset-linked object to its previous preset + overrides', () => {
    const id = ObjectId('was_linked')
    useEditorStore.setState(state => {
      const obj = makeMesh('was_linked')
      obj.materialPresetId = GOLD
      obj.materialOverrides = { roughness: 0.3 }
      state.sceneObjects.set(id, obj)
    })

    const command = new PaintCommand(
      [
        {
          objectId: id,
          previousMaterialPresetId: GOLD,
          previousMaterialOverrides: { roughness: 0.3 },
        },
      ],
      METAL
    )
    command.execute()
    expect(useEditorStore.getState().sceneObjects.get(id)?.materialPresetId).toBe(METAL)

    command.undo()
    const restored = useEditorStore.getState().sceneObjects.get(id)
    expect(restored?.materialPresetId).toBe(GOLD)
    expect(restored?.materialOverrides).toEqual({ roughness: 0.3 })
  })

  it('undo restores an unlinked object to its previous raw material', () => {
    const id = ObjectId('was_raw')
    const rawMaterial = { baseColor: '#ff0000', metallic: 0, roughness: 0.9 }
    useEditorStore.setState(state => {
      const obj = makeMesh('was_raw')
      obj.material = rawMaterial
      state.sceneObjects.set(id, obj)
    })

    const command = new PaintCommand(
      [{ objectId: id, previousMaterial: rawMaterial }],
      METAL
    )
    command.execute()
    expect(useEditorStore.getState().sceneObjects.get(id)?.materialPresetId).toBe(METAL)

    command.undo()
    const restored = useEditorStore.getState().sceneObjects.get(id)
    expect(restored?.materialPresetId).toBeUndefined()
    expect(restored?.material).toEqual(rawMaterial)
  })

  it('undo unlinks an object that had neither a preset nor a raw material before the stroke', () => {
    const id = ObjectId('was_bare')
    useEditorStore.setState(state => {
      state.sceneObjects.set(id, makeMesh('was_bare'))
    })

    const command = new PaintCommand([{ objectId: id }], METAL)
    command.execute()
    expect(useEditorStore.getState().sceneObjects.get(id)?.materialPresetId).toBe(METAL)

    command.undo()
    expect(useEditorStore.getState().sceneObjects.get(id)?.materialPresetId).toBeUndefined()
  })

  it('required: a brush radius change alone does not repaint already-painted or newly-in-range objects until the brush is re-applied', () => {
    const near = ObjectId('near_obj')
    const far = ObjectId('far_obj') // 3 units from the brush centre
    useEditorStore.setState(state => {
      state.sceneObjects.set(near, makeMesh('near_obj', [0, 0, 0]))
      state.sceneObjects.set(far, makeMesh('far_obj', [3, 0, 0]))
      state.paintBrushRadius = 1.5
      state.paintBrushFalloff = 'flat'
    })

    // Stroke 1: small radius. Only `near` is under the brush.
    const state1 = useEditorStore.getState()
    const stroke1Targets = selectPaintTargets(state1.sceneObjects, [0, 0, 0], {
      radius: state1.paintBrushRadius,
      falloff: state1.paintBrushFalloff,
    })
    expect(stroke1Targets).toEqual([near])
    new PaintCommand(
      stroke1Targets.map(id => ({ objectId: id })),
      METAL
    ).execute()

    expect(useEditorStore.getState().sceneObjects.get(near)?.materialPresetId).toBe(METAL)
    expect(useEditorStore.getState().sceneObjects.get(far)?.materialPresetId).toBeUndefined()

    // The user drags the radius slider up. This is a plain store
    // write — it must not, by itself, touch any scene object.
    useEditorStore.getState().setPaintBrushRadius(5)
    expect(useEditorStore.getState().sceneObjects.get(far)?.materialPresetId).toBeUndefined()
    expect(useEditorStore.getState().sceneObjects.get(near)?.materialPresetId).toBe(METAL)

    // Only a NEW stroke (re-applying the brush) at the larger radius
    // picks up `far`.
    const state2 = useEditorStore.getState()
    const stroke2Targets = selectPaintTargets(state2.sceneObjects, [0, 0, 0], {
      radius: state2.paintBrushRadius,
      falloff: state2.paintBrushFalloff,
    })
    expect(stroke2Targets.sort()).toEqual([far, near].sort())
    new PaintCommand(
      stroke2Targets.filter(id => id === far).map(id => ({ objectId: id })),
      GOLD
    ).execute()
    expect(useEditorStore.getState().sceneObjects.get(far)?.materialPresetId).toBe(GOLD)
  })
})
