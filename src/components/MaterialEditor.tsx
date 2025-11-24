// Material editor component for PBR material properties
import { useState } from 'react'
import { Palette, Folder, X, Copy, Save, ChevronRight } from 'lucide-react'

interface MaterialEditorProps {
  selectedObjects: string[]
  onMaterialChange?: (materialProps: any) => void
}

export default function MaterialEditor({ selectedObjects, onMaterialChange }: MaterialEditorProps) {
  const [material, setMaterial] = useState({
    baseColor: '#808080',
    metallic: 0.0,
    roughness: 0.8,
    emissive: '#000000',
    emissiveIntensity: 0.0,
    texture: null as string | null
  })

  const [isExpanded, setIsExpanded] = useState(false)

  const updateMaterial = (property: string, value: any) => {
    const newMaterial = { ...material, [property]: value }
    setMaterial(newMaterial)
    onMaterialChange?.(newMaterial)
  }

  if (selectedObjects.length === 0) {
    return (
      <div className="border-b border-editor-border">
        <div className="p-2 bg-editor-panel flex items-center text-editor-textMuted">
          <Palette className="w-3 h-3" />
          <span className="ml-2 text-sm">No objects selected</span>
        </div>
      </div>
    )
  }

  if (!isExpanded) {
    return (
      <div className="border-b border-editor-border">
        <div
          className="p-2 bg-editor-panel flex items-center cursor-pointer hover:bg-editor-border"
          onClick={() => setIsExpanded(true)}
        >
          <ChevronRight className="w-3 h-3" />
          <span className="ml-2 text-sm font-medium">Material</span>
          <span className="ml-auto text-xs text-editor-textMuted">
            {selectedObjects.length} object{selectedObjects.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-editor-border">
      {/* Header */}
      <div
        className="p-2 bg-editor-panel flex items-center cursor-pointer hover:bg-editor-border"
        onClick={() => setIsExpanded(false)}
      >
        <span className="text-xs">▼</span>
        <span className="ml-2 text-sm font-medium">Material</span>
        <span className="ml-auto text-xs text-editor-textMuted">
          {selectedObjects.length} object{selectedObjects.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Material Properties */}
      <div className="p-3 space-y-3">
        {/* Material Preset */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">Preset</label>
          <select 
            className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
            onChange={(e) => {
              const presets: Record<string, any> = {
                metal: { baseColor: '#b0b0b0', metallic: 1.0, roughness: 0.2 },
                concrete: { baseColor: '#808080', metallic: 0.0, roughness: 0.8 },
                plastic: { baseColor: '#ffffff', metallic: 0.0, roughness: 0.5 },
                wood: { baseColor: '#8b4513', metallic: 0.0, roughness: 0.7 },
                glass: { baseColor: '#ffffff', metallic: 0.0, roughness: 0.0 }
              }
              const preset = presets[e.target.value]
              if (preset) {
                setMaterial(prev => ({ ...prev, ...preset }))
                onMaterialChange?.(preset)
              }
            }}
          >
            <option value="">Custom</option>
            <option value="metal">Metal</option>
            <option value="concrete">Concrete</option>
            <option value="plastic">Plastic</option>
            <option value="wood">Wood</option>
            <option value="glass">Glass</option>
          </select>
        </div>

        {/* Base Color */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">Base Color</label>
          <div className="flex">
            <input
              type="color"
              value={material.baseColor}
              onChange={(e) => updateMaterial('baseColor', e.target.value)}
              className="w-8 h-6 border border-editor-border rounded-l cursor-pointer"
            />
            <input
              type="text"
              value={material.baseColor}
              onChange={(e) => updateMaterial('baseColor', e.target.value)}
              className="flex-1 px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded-r focus:outline-none focus:border-editor-accent"
            />
          </div>
        </div>

        {/* Metallic */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">
            Metallic ({material.metallic.toFixed(2)})
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={material.metallic}
            onChange={(e) => updateMaterial('metallic', parseFloat(e.target.value))}
            className="w-full accent-editor-accent"
          />
        </div>

        {/* Roughness */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">
            Roughness ({material.roughness.toFixed(2)})
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={material.roughness}
            onChange={(e) => updateMaterial('roughness', parseFloat(e.target.value))}
            className="w-full accent-editor-accent"
          />
        </div>

        {/* Emissive */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">Emissive Color</label>
          <div className="flex">
            <input
              type="color"
              value={material.emissive}
              onChange={(e) => updateMaterial('emissive', e.target.value)}
              className="w-8 h-6 border border-editor-border rounded-l cursor-pointer"
            />
            <input
              type="text"
              value={material.emissive}
              onChange={(e) => updateMaterial('emissive', e.target.value)}
              className="flex-1 px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded-r focus:outline-none focus:border-editor-accent"
            />
          </div>
        </div>

        {/* Emissive Intensity */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">
            Emissive Intensity ({material.emissiveIntensity.toFixed(2)})
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={material.emissiveIntensity}
            onChange={(e) => updateMaterial('emissiveIntensity', parseFloat(e.target.value))}
            className="w-full accent-editor-accent"
          />
        </div>

        {/* Texture */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">Texture</label>
          <div className="flex space-x-2">
            <div className="flex-1 px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded text-editor-textMuted">
              {material.texture || 'No texture'}
            </div>
            <button 
              className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border"
              title="Browse texture"
            >
              <Folder className="w-4 h-4" />
            </button>
            <button 
              className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border"
              onClick={() => updateMaterial('texture', null)}
              title="Clear texture"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Material Preview */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">Preview</label>
          <div 
            className="w-full h-16 border border-editor-border rounded"
            style={{
              background: `linear-gradient(45deg, ${material.baseColor}, ${material.emissive})`,
              filter: `brightness(${1 + material.emissiveIntensity}) saturate(${2 - material.roughness})`
            }}
          />
        </div>

        {/* Apply Button */}
        <div className="flex space-x-2">
          <button 
            className="flex-1 px-2 py-1 text-xs bg-editor-accent text-white rounded hover:bg-editor-accent/80"
            onClick={() => onMaterialChange?.(material)}
          >
            Apply to Selected
          </button>
          <button 
            className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border"
            title="Copy material"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button 
            className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border"
            title="Save as preset"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}