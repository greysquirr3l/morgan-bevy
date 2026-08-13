// Material editor component for PBR material properties
import { useEditorStore } from '@/store/editorStore'
import { MaterialId, type ObjectId } from '@/types/brand'
import {
  DEFAULT_PRESETS,
  deleteMaterialPreset,
  listMaterialPresets,
  newPresetId,
  saveMaterialPreset,
  type MaterialPreset,
} from '@/utils/materialPresets'
import { invoke } from '@tauri-apps/api/core'
import { ChevronRight, Copy, Folder, Link2, Palette, Star, Unlink, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface MaterialEditorProps {
  selectedObjects: ObjectId[]
  onMaterialChange?: (materialProps: any) => void
  // T18: parent supplies a callback that links selected objects
  // to a named material preset, with the editor's current
  // effective values used as the instance overrides.
  onLinkPreset?: (presetId: MaterialPreset['id'], overrides: Record<string, unknown>) => void
  // T18: parent supplies a callback that unlinks selected objects
  // from their preset. Inspector wires to `unlinkObjectFromPreset`.
  onUnlinkPreset?: () => void
}

interface LegacyPreset {
  name: string
  baseColor: string
  metallic: number
  roughness: number
  emissive: string
  emissiveIntensity: number
  texture?: string
  category: string
}

// Kept for backwards-compatibility with the dropdown UI that filters
// by `category`. The new `materialPresets.ts` helpers expose the
// canonical preset list; this local tuple is only used to drive
// the *display* category dropdown.
const LEGACY_CATEGORISED_PRESETS: LegacyPreset[] = [
  {
    name: 'Metal',
    baseColor: '#b0b0b0',
    metallic: 1.0,
    roughness: 0.2,
    emissive: '#000000',
    emissiveIntensity: 0.0,
    category: 'Basic',
  },
  {
    name: 'Concrete',
    baseColor: '#808080',
    metallic: 0.0,
    roughness: 0.8,
    emissive: '#000000',
    emissiveIntensity: 0.0,
    category: 'Basic',
  },
  {
    name: 'Plastic',
    baseColor: '#ffffff',
    metallic: 0.0,
    roughness: 0.5,
    emissive: '#000000',
    emissiveIntensity: 0.0,
    category: 'Basic',
  },
  {
    name: 'Wood',
    baseColor: '#8b4513',
    metallic: 0.0,
    roughness: 0.7,
    emissive: '#000000',
    emissiveIntensity: 0.0,
    category: 'Basic',
  },
  {
    name: 'Glass',
    baseColor: '#ffffff',
    metallic: 0.0,
    roughness: 0.0,
    emissive: '#000000',
    emissiveIntensity: 0.0,
    category: 'Basic',
  },
  {
    name: 'Gold',
    baseColor: '#ffd700',
    metallic: 1.0,
    roughness: 0.1,
    emissive: '#000000',
    emissiveIntensity: 0.0,
    category: 'Metal',
  },
  {
    name: 'Copper',
    baseColor: '#b87333',
    metallic: 1.0,
    roughness: 0.3,
    emissive: '#000000',
    emissiveIntensity: 0.0,
    category: 'Metal',
  },
  {
    name: 'Chrome',
    baseColor: '#c0c0c0',
    metallic: 1.0,
    roughness: 0.05,
    emissive: '#000000',
    emissiveIntensity: 0.0,
    category: 'Metal',
  },
  {
    name: 'Neon',
    baseColor: '#ff00ff',
    metallic: 0.0,
    roughness: 0.9,
    emissive: '#ff00ff',
    emissiveIntensity: 1.0,
    category: 'Emissive',
  },
  {
    name: 'LED',
    baseColor: '#ffffff',
    metallic: 0.0,
    roughness: 0.8,
    emissive: '#00ffff',
    emissiveIntensity: 0.5,
    category: 'Emissive',
  },
]

export default function MaterialEditor({
  selectedObjects,
  onMaterialChange,
  onLinkPreset,
  onUnlinkPreset,
}: MaterialEditorProps) {
  const sceneObjects = useEditorStore(s => s.sceneObjects)
  const primaryObject = selectedObjects.length > 0 ? sceneObjects.get(selectedObjects[0]!) : null

  // Audit (Major #10) regression: the initial `useState` used
  // hardcoded defaults (grey, 0% metal, 80% rough) regardless of
  // what the user had selected. Crank the roughness to 0.1 and
  // "Apply to Selected" would silently overwrite the real material
  // with those defaults. Initialize from the primary selected
  // object's material when one exists; otherwise fall back to the
  // grey defaults so the panel still renders for an empty
  // selection.
  const [material, setMaterial] = useState(() => {
    const m = primaryObject?.material
    if (!m) {
      return {
        baseColor: '#808080',
        metallic: 0.0,
        roughness: 0.8,
        emissive: '#000000',
        emissiveIntensity: 0.0,
        texture: null as string | null,
      }
    }
    return {
      baseColor: m.baseColor,
      metallic: m.metallic,
      roughness: m.roughness,
      emissive: m.emissive ?? '#000000',
      emissiveIntensity: m.emissiveIntensity ?? 0.0,
      texture: m.texture ?? null,
    }
  })

  // Sync the editor's local state whenever the selection (or its
  // material) changes from outside — e.g. user picks a different
  // object, or paints a preset onto the current one. Without this
  // the editor keeps showing the first selection's values forever
  // even after the user clicks a different object.
  useEffect(() => {
    const m = primaryObject?.material
    if (!m) return
    setMaterial({
      baseColor: m.baseColor,
      metallic: m.metallic,
      roughness: m.roughness,
      emissive: m.emissive ?? '#000000',
      emissiveIntensity: m.emissiveIntensity ?? 0.0,
      texture: m.texture ?? null,
    })
  }, [primaryObject?.id, primaryObject?.material])

  const [isExpanded, setIsExpanded] = useState(false)
  const [showPresetLibrary, setShowPresetLibrary] = useState(false)
  const [customPresets, setCustomPresets] = useState<MaterialPreset[]>([])
  const [selectedCategory, setSelectedCategory] = useState('Basic')
  const [presetName, setPresetName] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  // T18: ref to the root div so the drop-target lives on the
  // whole panel, not just the texture field.
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Load presets (defaults + custom) on mount.
  useEffect(() => {
    setCustomPresets(listMaterialPresets())
  }, [])

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
      texture: preset.texture || material.texture,
    }
    setMaterial(newMaterial)
    onMaterialChange?.(newMaterial)
  }

  const saveCurrentAsPreset = (linkToSelection = false) => {
    if (!presetName.trim()) return

    const newPreset: MaterialPreset = {
      id: newPresetId(presetName.trim()),
      name: presetName.trim(),
      baseColor: material.baseColor,
      metallic: material.metallic,
      roughness: material.roughness,
      emissive: material.emissive,
      emissiveIntensity: material.emissiveIntensity,
      texture: material.texture || undefined,
    }

    saveMaterialPreset(newPreset)
    setCustomPresets([...customPresets, newPreset])

    // T18: optional "save-and-link" — creates a material *instance*
    // on every selected object by recording the current effective
    // values as the instance overrides. The caller (Inspector)
    // wires `linkObjectToPreset` into the store; here we just emit
    // the event so the parent can apply it.
    if (linkToSelection && onLinkPreset && selectedObjects.length > 0) {
      onLinkPreset(newPreset.id, currentOverrides())
    }
    setPresetName('')
  }

  const deletePreset = (index: number) => {
    // Only custom presets are deletable; the shipped defaults are
    // pinned. Filter by `id` rather than index so the index handed
    // in by the dropdown matches the actual position in the
    // combined defaults + custom list.
    const target = customPresets[index]
    if (!target) return
    if (DEFAULT_PRESETS.some(p => p.id === target.id)) return
    const remaining = deleteMaterialPreset(target.id)
    setCustomPresets(remaining)
  }

  // T18: snapshot the current effective material as the instance
  // overrides. Used by both the "save & link" flow and the
  // header's Link button.
  const currentOverrides = (): Record<string, unknown> => ({
    baseColor: material.baseColor,
    metallic: material.metallic,
    roughness: material.roughness,
    emissive: material.emissive,
    emissiveIntensity: material.emissiveIntensity,
    texture: material.texture ?? undefined,
  })

  const browseForTexture = async () => {
    try {
      const selected = (await invoke('browse_for_texture')) as string[]
      if (selected && selected.length > 0) {
        updateMaterial('texture', selected[0])
      }
    } catch (error) {
      console.error('Failed to browse for texture:', error)
    }
  }

  const allPresets = [...DEFAULT_PRESETS, ...customPresets]
  // T18: the new MaterialPreset type does not carry a `category`
  // field. Map the legacy categorised presets into a derived list
  // for the dropdown filter; custom presets live in the "Custom"
  // bucket.
  const filteredPresets =
    selectedCategory === 'All'
      ? allPresets
      : selectedCategory === 'Custom'
        ? customPresets
        : allPresets.filter(p => {
            const legacy = LEGACY_CATEGORISED_PRESETS.find(l => l.name === p.name)
            return legacy?.category === selectedCategory
          })
  const categories = [
    'All',
    ...Array.from(new Set(LEGACY_CATEGORISED_PRESETS.map(p => p.category))),
    'Custom',
  ]

  // T18: drag-and-drop a texture path onto the panel. Accepts both
  // external file drops (File.path) and asset-browser drops whose
  // payload is a string path. No-op when the payload doesn't look
  // like a path.
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear the highlight when leaving the panel itself, not
    // when crossing into a child element.
    if (e.currentTarget === e.target) setIsDragOver(false)
  }
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const candidate =
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('text/uri-list') ||
      (Array.from(e.dataTransfer.files)[0] as File & { path?: string })?.path ||
      ''
    if (!candidate) return
    updateMaterial('texture', candidate)
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
    <div
      ref={rootRef}
      className={`border-b border-editor-border ${isDragOver ? 'ring-2 ring-editor-accent' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div
        className="p-2 bg-editor-panel flex items-center cursor-pointer hover:bg-editor-border"
        onClick={() => setIsExpanded(false)}
      >
        <span className="text-xs">▼</span>
        <span className="ml-2 text-sm font-medium">Material</span>
        <div className="ml-auto flex items-center space-x-1">
          <button
            onClick={e => {
              e.stopPropagation()
              setShowPresetLibrary(!showPresetLibrary)
            }}
            className="p-1 rounded hover:bg-editor-border"
            title="Material Library"
          >
            <Star className="w-3 h-3" />
          </button>
          {/* T18: link / unlink selected objects to a named preset. */}
          {onLinkPreset && (
            <button
              onClick={e => {
                e.stopPropagation()
                onLinkPreset(MaterialId('default-metal'), currentOverrides())
              }}
              className="p-1 rounded hover:bg-editor-border"
              title="Link selected objects to a preset"
            >
              <Link2 className="w-3 h-3" />
            </button>
          )}
          {onUnlinkPreset && (
            <button
              onClick={e => {
                e.stopPropagation()
                onUnlinkPreset()
              }}
              className="p-1 rounded hover:bg-editor-border"
              title="Unlink selected objects from their preset"
            >
              <Unlink className="w-3 h-3" />
            </button>
          )}
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
              {filteredPresets.map((preset, index) => {
                const isCustom = customPresets.some(p => p.id === preset.id)
                return (
                  <div key={`${preset.id}-${index}`} className="relative group">
                    <button
                      onClick={() => applyPreset(preset)}
                      className="w-full p-2 bg-editor-panel border border-editor-border rounded hover:border-editor-accent text-left"
                    >
                      <div
                        className="w-full h-8 rounded mb-1"
                        style={{
                          background: `linear-gradient(45deg, ${preset.baseColor}, ${preset.emissive})`,
                          filter: `brightness(${1 + preset.emissiveIntensity}) saturate(${2 - preset.roughness})`,
                        }}
                      />
                      <div className="text-xs font-medium truncate">{preset.name}</div>
                      <div className="text-xs text-editor-textMuted">
                        M:{preset.metallic.toFixed(1)} R:{preset.roughness.toFixed(1)}
                      </div>
                    </button>

                    {isCustom && (
                      <button
                        onClick={() =>
                          deletePreset(customPresets.findIndex(p => p.id === preset.id))
                        }
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Save Current as Preset */}
            <div className="border-t border-editor-border pt-2">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                />
                <button
                  onClick={() => saveCurrentAsPreset(false)}
                  disabled={!presetName.trim()}
                  className="px-2 py-1 text-xs bg-editor-accent text-white rounded hover:bg-editor-accent/80 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => saveCurrentAsPreset(true)}
                  disabled={!presetName.trim() || selectedObjects.length === 0}
                  title="Save the preset and link the selected objects to it as a material instance"
                  className="px-2 py-1 text-xs bg-editor-accent text-white rounded hover:bg-editor-accent/80 disabled:opacity-50"
                >
                  Save &amp; Link
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
            onChange={e => {
              const preset = DEFAULT_PRESETS.find(p => p.name === e.target.value)
              if (preset) applyPreset(preset)
            }}
          >
            <option value="">Select preset...</option>
            {DEFAULT_PRESETS.filter(p =>
              LEGACY_CATEGORISED_PRESETS.some(l => l.name === p.name && l.category === 'Basic')
            ).map(preset => (
              <option key={preset.name} value={preset.name}>
                {preset.name}
              </option>
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
              onChange={e => updateMaterial('baseColor', e.target.value)}
              className="w-8 h-6 border border-editor-border rounded-l cursor-pointer"
            />
            <input
              type="text"
              value={material.baseColor}
              onChange={e => updateMaterial('baseColor', e.target.value)}
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
            onChange={e => updateMaterial('metallic', parseFloat(e.target.value))}
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
            onChange={e => updateMaterial('roughness', parseFloat(e.target.value))}
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
              onChange={e => updateMaterial('emissive', e.target.value)}
              className="w-8 h-6 border border-editor-border rounded-l cursor-pointer"
            />
            <input
              type="text"
              value={material.emissive}
              onChange={e => updateMaterial('emissive', e.target.value)}
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
            onChange={e => updateMaterial('emissiveIntensity', parseFloat(e.target.value))}
            className="w-full accent-editor-accent"
          />
        </div>

        {/* Enhanced Texture Section */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">Texture</label>
          <div className="space-y-2">
            <div className="flex space-x-2">
              <div className="flex-1 px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded text-editor-textMuted">
                {material.texture ? material.texture.split(/[\\/]/).pop() : 'No texture'}
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
                  onError={e => {
                    void ((e.target as HTMLImageElement).style.display = 'none')
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
                filter: `brightness(${1 + material.emissiveIntensity}) saturate(${2 - material.roughness})`,
              }}
            >
              {material.texture && (
                <div
                  className="absolute inset-0 opacity-50 bg-repeat"
                  style={{
                    backgroundImage: `url(${material.texture})`,
                    backgroundSize: '32px 32px',
                  }}
                />
              )}
            </div>
            <div className="text-xs text-editor-textMuted">
              Metallic: {material.metallic.toFixed(2)} | Roughness: {material.roughness.toFixed(2)}{' '}
              | Emissive: {material.emissiveIntensity.toFixed(2)}
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
