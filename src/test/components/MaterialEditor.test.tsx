/**
 * @fileoverview Tests for the Material Editor component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('/path/to/texture.png')
}))

// Mock Lucide React icons with simple test elements
vi.mock('lucide-react', () => ({
  Palette: () => <span data-testid="palette-icon">��</span>,
  Folder: () => <span data-testid="folder-icon">📁</span>,
  X: () => <span data-testid="x-icon">✕</span>,
  Copy: () => <span data-testid="copy-icon">📋</span>,
  Save: () => <span data-testid="save-icon">💾</span>,
  ChevronRight: () => <span data-testid="chevron-right">▶</span>,
  ChevronDown: () => <span data-testid="chevron-down">⌄</span>,
  Star: () => <span data-testid="star-icon">⭐</span>,
  Upload: () => <span data-testid="upload-icon">📤</span>,
  Download: () => <span data-testid="download-icon">📥</span>,
  Eye: () => <span data-testid="eye-icon">👁</span>,
}))

import MaterialEditor from '../../components/MaterialEditor'

describe('MaterialEditor', () => {
  const mockOnMaterialChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should show "No objects selected" when no objects are selected', () => {
      render(<MaterialEditor selectedObjects={[]} onMaterialChange={mockOnMaterialChange} />)
      expect(screen.getByText('No objects selected')).toBeInTheDocument()
    })

    it('should show collapsed state when objects are selected', () => {
      render(<MaterialEditor selectedObjects={['obj1']} onMaterialChange={mockOnMaterialChange} />)
      expect(screen.getByText('Material')).toBeInTheDocument()
      expect(screen.getByText('1 object')).toBeInTheDocument()
    })

    it('should expand when header is clicked', () => {
      render(<MaterialEditor selectedObjects={['obj1']} onMaterialChange={mockOnMaterialChange} />)
      
      const header = screen.getByText('Material').closest('div')
      fireEvent.click(header!)
      
      expect(screen.getByText('Quick Presets')).toBeInTheDocument()
    })
  })

  describe('Material Properties', () => {
    beforeEach(() => {
      render(<MaterialEditor selectedObjects={['obj1']} onMaterialChange={mockOnMaterialChange} />)
      const header = screen.getByText('Material').closest('div')
      fireEvent.click(header!)
    })

    it('should display material property controls', () => {
      expect(screen.getByText('Quick Presets')).toBeInTheDocument()
      expect(screen.getByText('Base Color')).toBeInTheDocument()
      expect(screen.getByText('Metallic (0.00)')).toBeInTheDocument()
      expect(screen.getByText('Roughness (0.80)')).toBeInTheDocument()
      expect(screen.getByText('Preview')).toBeInTheDocument()
    })

    it('should update material when base color changes', () => {
      // Find the text input (not color input) for base color
      const inputs = screen.getAllByDisplayValue('#808080')
      const textInput = inputs.find(input => input.getAttribute('type') === 'text')
      
      fireEvent.change(textInput!, { target: { value: '#ff0000' } })
      
      expect(mockOnMaterialChange).toHaveBeenCalledWith(
        expect.objectContaining({
          baseColor: '#ff0000'
        })
      )
    })

    it('should update material when metallic slider changes', () => {
      // Use more specific selector for metallic slider (value 0)
      const sliders = screen.getAllByDisplayValue('0')
      const metallicSlider = sliders.find(el => 
        el.getAttribute('max') === '1' && el.getAttribute('type') === 'range'
      )
      
      fireEvent.change(metallicSlider!, { target: { value: '0.5' } })
      
      expect(mockOnMaterialChange).toHaveBeenCalledWith(
        expect.objectContaining({
          metallic: 0.5
        })
      )
    })

    it('should update material when roughness slider changes', () => {
      const roughnessSlider = screen.getByDisplayValue('0.8')
      fireEvent.change(roughnessSlider, { target: { value: '0.3' } })
      
      expect(mockOnMaterialChange).toHaveBeenCalledWith(
        expect.objectContaining({
          roughness: 0.3
        })
      )
    })
  })

  describe('Material Presets', () => {
    beforeEach(() => {
      render(<MaterialEditor selectedObjects={['obj1']} onMaterialChange={mockOnMaterialChange} />)
      const header = screen.getByText('Material').closest('div')
      fireEvent.click(header!)
    })

    it('should apply metal preset', () => {
      const presetSelect = screen.getByDisplayValue('Select preset...')
      fireEvent.change(presetSelect, { target: { value: 'Metal' } })
      
      expect(mockOnMaterialChange).toHaveBeenCalledWith(
        expect.objectContaining({
          baseColor: '#b0b0b0',
          metallic: 1.0,
          roughness: 0.2
        })
      )
    })

    it('should apply wood preset', () => {
      const presetSelect = screen.getByDisplayValue('Select preset...')
      fireEvent.change(presetSelect, { target: { value: 'Wood' } })
      
      expect(mockOnMaterialChange).toHaveBeenCalledWith(
        expect.objectContaining({
          baseColor: '#8b4513',
          metallic: 0.0,
          roughness: 0.7
        })
      )
    })
  })

  describe('Multiple Objects', () => {
    it('should show correct count for multiple objects', () => {
      render(<MaterialEditor selectedObjects={['obj1', 'obj2', 'obj3']} onMaterialChange={mockOnMaterialChange} />)
      expect(screen.getByText('3 objects')).toBeInTheDocument()
    })
  })

  describe('Apply Button', () => {
    it('should call onMaterialChange when apply button is clicked', () => {
      render(<MaterialEditor selectedObjects={['obj1']} onMaterialChange={mockOnMaterialChange} />)
      const header = screen.getByText('Material').closest('div')
      fireEvent.click(header!)
      
      const applyButton = screen.getByText('Apply to Selected')
      fireEvent.click(applyButton)
      
      expect(mockOnMaterialChange).toHaveBeenCalled()
    })
  })
})
