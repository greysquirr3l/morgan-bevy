/**
 * T54 — `UVEditor`: drag to offset UVs, scroll to scale.
 */
import UVEditor from '@/components/PaintTool/UVEditor'
import { useEditorStore, type SceneObject } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('UVEditor', () => {
  const id = ObjectId('uv_target')

  beforeEach(() => {
    useEditorStore.setState({ sceneObjects: new Map([[id, makeMesh('uv_target')]]) })
  })

  it('renders identity transform (0.00, 0.00 · Scale 1.00x) for an object with no uvTransform yet', () => {
    render(<UVEditor objectId={id} onClose={() => {}} />)
    expect(screen.getByText(/Offset 0\.00, 0\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Scale 1\.00x/)).toBeInTheDocument()
  })

  it('dragging across the canvas offsets the stored uvTransform', () => {
    render(<UVEditor objectId={id} onClose={() => {}} />)
    const canvas = screen.getByTestId('uv-editor-canvas')

    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(canvas, { clientX: 64, clientY: 0, pointerId: 1 })
    fireEvent.pointerUp(canvas, { clientX: 64, clientY: 0, pointerId: 1 })

    const transform = useEditorStore.getState().sceneObjects.get(id)?.uvTransform
    expect(transform?.offsetX).toBeCloseTo(0.25)
  })

  it('scrolling over the canvas scales the stored uvTransform', () => {
    render(<UVEditor objectId={id} onClose={() => {}} />)
    const canvas = screen.getByTestId('uv-editor-canvas')

    fireEvent.wheel(canvas, { deltaY: -100 })

    const transform = useEditorStore.getState().sceneObjects.get(id)?.uvTransform
    expect(transform?.scaleX).toBeGreaterThan(1)
  })

  it('the Reset button restores the identity transform', () => {
    useEditorStore.setState(state => {
      const obj = state.sceneObjects.get(id)
      if (obj) obj.uvTransform = { offsetX: 0.4, offsetY: 0.1, scaleX: 2, scaleY: 2 }
    })
    render(<UVEditor objectId={id} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    const transform = useEditorStore.getState().sceneObjects.get(id)?.uvTransform
    expect(transform).toEqual({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 })
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<UVEditor objectId={id} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close UV editor' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing if the object no longer exists in the scene', () => {
    const { container } = render(
      <UVEditor objectId={ObjectId('does_not_exist')} onClose={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })
})
