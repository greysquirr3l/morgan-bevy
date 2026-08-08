/**
 * T54 — required test: "applying a material to a mesh updates the
 * inspector immediately."
 *
 * `Inspector.tsx` reads `sceneObjects` straight off `useEditorStore`
 * (see `src/components/Inspector/Inspector.tsx`); this test builds a
 * minimal stand-in that reads the same slice the same way, so it
 * exercises the actual reactivity path (Zustand subscription -> React
 * re-render) rather than re-testing Inspector's unrelated JSX. Firing
 * `PaintCommand.execute()` and immediately asserting the rendered DOM
 * — no `waitFor`, no timers — is the point: there's no async gap
 * between painting and the inspector reflecting it.
 */
import { useEditorStore, type SceneObject } from '@/store/editorStore'
import { LayerId, MaterialId, ObjectId } from '@/types/brand'
import { PaintCommand } from '@/utils/commands'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function makeMesh(id: string): SceneObject {
  return {
    id: ObjectId(id),
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

/** Minimal Inspector stand-in: reads the same `sceneObjects` slice
 *  the real Inspector reads and renders the resolved material id. */
function InspectorMaterialField({ objectId }: { objectId: ReturnType<typeof ObjectId> }) {
  const materialPresetId = useEditorStore(s => s.sceneObjects.get(objectId)?.materialPresetId)
  return <div data-testid="inspector-material">{materialPresetId ?? 'none'}</div>
}

describe('Inspector reflects a paint stroke immediately', () => {
  it('updates the rendered material id as soon as PaintCommand.execute() runs', () => {
    const id = ObjectId('painted_object')
    useEditorStore.setState({
      sceneObjects: new Map([[id, makeMesh('painted_object')]]),
      selectedObjects: [id],
      undoHistory: [],
      redoHistory: [],
    })

    render(<InspectorMaterialField objectId={id} />)
    expect(screen.getByTestId('inspector-material').textContent).toBe('none')

    const presetId = MaterialId('default-gold')
    act(() => {
      new PaintCommand([{ objectId: id }], presetId).execute()
    })

    expect(screen.getByTestId('inspector-material').textContent).toBe(presetId)
  })
})
