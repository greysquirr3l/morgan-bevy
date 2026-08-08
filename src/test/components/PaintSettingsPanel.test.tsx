/**
 * T54 — `PaintSettingsPanel`: brush radius / falloff / target
 * material controls. Pure DOM component (no R3F), rendered outside
 * `<Canvas>` in `Viewport3D.tsx`.
 */
import PaintSettingsPanel from '@/components/PaintTool/PaintSettingsPanel'
import { useEditorStore } from '@/store/editorStore'
import { MaterialId, ObjectId } from '@/types/brand'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

describe('PaintSettingsPanel', () => {
  beforeEach(() => {
    useEditorStore.setState({
      paintToolActive: false,
      paintBrushRadius: 2,
      paintBrushFalloff: 'smooth',
      paintTargetMaterialId: null,
      selectedObjects: [],
    })
  })

  it('renders nothing when the paint tool is inactive', () => {
    const { container } = render(<PaintSettingsPanel />)
    expect(container.querySelector('[data-testid="paint-settings-panel"]')).toBeNull()
  })

  it('renders the panel and reflects store values once active', () => {
    useEditorStore.setState({ paintToolActive: true })
    render(<PaintSettingsPanel />)
    expect(screen.getByTestId('paint-settings-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'smooth' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('changing the radius slider updates the store', () => {
    useEditorStore.setState({ paintToolActive: true })
    render(<PaintSettingsPanel />)
    const slider = screen.getByLabelText('Brush radius')
    fireEvent.change(slider, { target: { value: '4.5' } })
    expect(useEditorStore.getState().paintBrushRadius).toBeCloseTo(4.5)
  })

  it('clicking a falloff button switches the active falloff', () => {
    useEditorStore.setState({ paintToolActive: true })
    render(<PaintSettingsPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'flat' }))
    expect(useEditorStore.getState().paintBrushFalloff).toBe('flat')
  })

  it('selecting a material sets the paint target material id', () => {
    useEditorStore.setState({ paintToolActive: true })
    render(<PaintSettingsPanel />)
    const select = screen.getByLabelText('Target material')
    fireEvent.change(select, { target: { value: 'default-gold' } })
    expect(useEditorStore.getState().paintTargetMaterialId).toBe(MaterialId('default-gold'))
  })

  it('the "Done" button deactivates the paint tool', () => {
    useEditorStore.setState({ paintToolActive: true })
    render(<PaintSettingsPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Done/i }))
    expect(useEditorStore.getState().paintToolActive).toBe(false)
  })

  it('the UV Editor button is disabled with no selection and enabled once an object is selected', () => {
    useEditorStore.setState({ paintToolActive: true, selectedObjects: [] })
    const { rerender } = render(<PaintSettingsPanel />)
    expect(screen.getByRole('button', { name: 'UV Editor' })).toBeDisabled()

    useEditorStore.setState({ selectedObjects: [ObjectId('obj-1')] })
    rerender(<PaintSettingsPanel />)
    expect(screen.getByRole('button', { name: 'UV Editor' })).not.toBeDisabled()
  })
})
