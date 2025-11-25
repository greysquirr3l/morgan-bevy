// Material editor component for PBR material properties
import { useState, useEffect } from 'react'
import { Palette, Folder, X, Copy, Save, ChevronRight, Upload, Download, Eye, Star } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

interface MaterialEditorProps {
  selectedObjects: string[]
  onMaterialChange?: (materialProps: any) => void
}

interface MaterialPreset {
  name: string
  baseColor: string
  metallic: number
  roughness: number
  emissive: string
  emissiveIntensity: number
  texture?: string
  category: string
}

const DEFAULT_PRESETS: MaterialPreset[] = [
  { name: 'Metal', baseColor: '#b0b0b0', metallic: 1.0, roughness: 0.2, emissive: '#000000', emissiveIntensity: 0.0, category: 'Basic' },
  { name: 'Concrete', baseColor: '#808080', metallic: 0.0, roughness: 0.8, emissive: '#000000', emissiveIntensity: 0.0, category: 'Basic' },
  { name: 'Plastic', baseColor: '#ffffff', metallic: 0.0, roughness: 0.5, emissive: '#000000', emissiveIntensity: 0.0, category: 'Basic' },
  { name: 'Wood', baseColor: '#8b4513', metallic: 0.0, roughness: 0.7, emissive: '#000000', emissiveIntensity: 0.0, category: 'Basic' },
  { name: 'Glass', baseColor: '#ffffff', metallic: 0.0, roughness: 0.0, emissive: '#000000', emissiveIntensity: 0.0, category: 'Basic' },
  { name: 'Gold', baseColor: '#ffd700', metallic: 1.0, roughness: 0.1, emissive: '#000000', emissiveIntensity: 0.0, category: 'Metal' },
  { name: 'Copper', baseColor: '#b87333', metallic: 1.0, roughness: 0.3, emissive: '#000000', emissiveIntensity: 0.0, category: 'Metal' },
  { name: 'Chrome', baseColor: '#c0c0c0', metallic: 1.0, roughness: 0.05, emissive: '#000000', emissiveIntensity: 0.0, category: 'Metal' },
  { name: 'Neon', baseColor: '#ff00ff', metallic: 0.0, roughness: 0.9, emissive: '#ff00ff', emissiveIntensity: 1.0, category: 'Emissive' },
  { name: 'LED', baseColor: '#ffffff', metallic: 0.0, roughness: 0.8, emissive: '#00ffff', emissiveIntensity: 0.5, category: 'Emissive' }
]

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
  const [showPresetLibrary, setShowPresetLibrary] = useState(false)
  const [customPresets, setCustomPresets] = useState<MaterialPreset[]>([])
  const [selectedCategory, setSelectedCategory] = useState('Basic')
  const [presetName, setPresetName] = useState('')

  // Load custom presets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('morgan-bevy-material-presets')
      if (saved) {
        setCustomPresets(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load material presets:', e)
    }
  }, [])

  // Save custom presets to localStorage
  const saveCustomPresets = (presets: MaterialPreset[]) => {
    try {
      localStorage.setItem('morgan-bevy-material-presets', JSON.stringify(presets))
      setCustomPresets(presets)
    } catch (e) {
      console.error('Failed to save material presets:', e)
    }
  }

  const updateMaterial = (property: string, value: any) => {
    const newMaterial = { ...material, [property]: value }
    setMaterial(newMaterial)
    onMaterialChange?.(newMaterial)
  }

  const applyPreset = (preset: Partial<MaterialPreset>) => {
    const newMaterial = {
      baseColor: preset.baseColor || material.baseColor,
      metallic: preset.metallic ?? material.metallic,
      roughness: preset.roughness ?? material.roughness,
      emissive: preset.emissive || material.emissive,
      emissiveIntensity: preset.emissiveIntensity ?? material.emissiveIntensity,
      texture: preset.texture || material.texture
    }
    setMaterial(newMaterial)
    onMaterialChange?.(newMaterial)
  }

  const saveCurrentAsPreset = () => {
    if (!presetName.trim()) return
    
    const newPreset: MaterialPreset = {
      name: presetName.trim(),
      baseColor: material.baseColor,
      metallic: material.metallic,
      roughness: material.roughness,
      emissive: material.emissive,
      emissiveIntensity: material.emissiveIntensity,
      texture: material.texture || undefined,
      category: 'Custom'
    }
    
    saveCustomPresets([...customPresets, newPreset])
    setPresetName('')
  }

  const deletePreset = (index: number) => {
    const newPresets = customPresets.filter((_, i) => i !== index)
    saveCustomPresets(newPresets)
  }

  const browseForTexture = async () => {
    try {
      const selected = await invoke('browse_for_texture') as string[]
      if (selected && selected.length > 0) {
        updateMaterial('texture', selected[0])
      }
    } catch (error) {
      console.error('Failed to browse for texture:', error)
    }
  }

  const allPresets = [...DEFAULT_PRESETS, ...customPresets]
  const filteredPresets = allPresets.filter(preset => 
    selectedCategory === 'All' || preset.category === selectedCategory
  )
  const categories = ['All', ...Array.from(new Set(allPresets.map(p => p.category)))]

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
        <div className="ml-auto flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowPresetLibrary(!showPresetLibrary)
            }}
            className="p-1 rounded hover:bg-editor-border"
            title="Material Library"
          >
            <Star className="w-3 h-3" />
          </button>
          <span className="text-xs text-editor-textMuted">
            {selectedObjects.length} object{selectedObjects.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Preset Library Modal */}
      {showPresetLibrary && (
        <div className="p-3 bg-editor-bg border-t border-editor-border">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium">Material Library</h5>
              <button
                onClick={() => setShowPresetLibrary(false)}
                className="p-1 rounded hover:bg-editor-border"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            
            {/* Category Filter */}
            <div className="flex flex-wrap gap-1">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedCategory === category
                      ? 'bg-editor-accent text-white'
                      : 'bg-editor-panel border border-editor-border hover:border-editor-accent'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            
            {/* Preset Grid */}
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {filteredPresets.map((preset, index) => (
                <div
                  key={`${preset.category}-${preset.name}-${index}`}
                  className="relative group"
                >
                  <button
                    onClick={() => applyPreset(preset)}
                    className="w-full p-2 bg-editor-panel border border-editor-border rounded hover:border-editor-accent text-left"
                  >
                    <div
                      className="w-full h-8 rounded mb-1"
                      style={{
                        background: `linear-gradient(45deg, ${preset.baseColor}, ${preset.emissive})`,
                        filter: `brightness(${1 + preset.emissiveIntensity}) saturate(${2 - preset.roughness})`
                      }}
                    />
                    <div className="text-xs font-medium truncate">{preset.name}</div>
                    <div className="text-xs text-editor-textMuted">M:{preset.metallic.toFixed(1)} R:{preset.roughness.toFixed(1)}</div>
                  </button>
                  
                  {preset.category === 'Custom' && (
                    <button
                      onClick={() => deletePreset(customPresets.findIndex(p => p.name === preset.name))}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {/* Save Current as Preset */}
            <div className="border-t border-editor-border pt-2">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                />
                <button
                  onClick={saveCurrentAsPreset}
                  disabled={!presetName.trim()}
                  className="px-2 py-1 text-xs bg-editor-accent text-white rounded hover:bg-editor-accent/80 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Material Properties */}
      <div className="p-3 space-y-3">
        {/* Quick Preset Selector */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">Quick Presets</label>
          <select 
            className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
            value=""
            onChange={(e) => {
              const preset = DEFAULT_PRESETS.find(p => p.name === e.target.value)
              if (preset) applyPreset(preset)
            }}
          >
            <option value="">Select preset...</option>
            {DEFAULT_PRESETS.filter(p => p.category === 'Basic').map(preset => (
              <option key={preset.name} value={preset.name}>{preset.name}</option>
            ))}
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

        {/* Enhanced Texture Section */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">Texture</label>
          <div className="space-y-2">
            <div className="flex space-x-2">
              <div className="flex-1 px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded text-editor-textMuted">
                {material.texture ? material.texture.split('/').pop() : 'No texture'}
              </div>
              <button 
                onClick={browseForTexture}
                className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border"
                title="Browse texture"
              >
                <Folder className="w-4 h-4" />
              </button>
              <button 
                onClick={() => updateMaterial('texture', null)}
                className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border"
                title="Clear texture"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Texture Preview */}
            {material.texture && (
              <div className="relative">
                <img
                  src={material.texture}
                  alt="Texture Preview"
                  className="w-full h-16 object-cover border border-editor-border rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Material Preview */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">Preview</label>
          <div className="space-y-2">
            <div 
              className="w-full h-16 border border-editor-border rounded relative overflow-hidden"
              style={{
                background: `linear-gradient(45deg, ${material.baseColor}, ${material.emissive})`,
                filter: `brightness(${1 + material.emissiveIntensity}) saturate(${2 - material.roughness})`
              }}
            >
              {material.texture && (
                <div 
                  className="absolute inset-0 opacity-50 bg-repeat"
                  style={{
                    backgroundImage: `url(${material.texture})`,
                    backgroundSize: '32px 32px'
                  }}
                />
              )}
            </div>
            <div className="text-xs text-editor-textMuted">
              Metallic: {material.metallic.toFixed(2)} | Roughness: {material.roughness.toFixed(2)} | Emissive: {material.emissiveIntensity.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Enhanced Apply Section */}
        <div className="flex space-x-2">
          <button 
            className="flex-1 px-2 py-1 text-xs bg-editor-accent text-white rounded hover:bg-editor-accent/80"
            onClick={() => onMaterialChange?.(material)}
          >
            Apply to Selected
          </button>
          <button 
            className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border"
            onClick={() => navigator.clipboard?.writeText(JSON.stringify(material))}
            title="Copy material to clipboard"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button 
            className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border"
            onClick={() => setShowPresetLibrary(true)}
            title="Open material library"
          >
            <Star className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}