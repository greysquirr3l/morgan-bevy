
import { useEditorStore } from '@/store/editorStore'
import MaterialEditor from '../MaterialEditor'
import { Search } from 'lucide-react'
import { TransformCommand } from '@/utils/commands'

// Helper function to get default tile character for tile types
const getTileChar = (tileType: string): string => {
  const tileChars: Record<string, string> = {
    '1': '.',  // FLOOR
    '2': '+',  // DOOR
    '3': '=',  // WINDOW
    '4': '#',  // WALL
    '5': 'F',  // FURNITURE
    '6': 'S',  // SPAWN
    '7': 'O',  // OBJECTIVE
    '8': 'X',  // HAZARD
  }
  return tileChars[tileType] || '#'
}

export default function Inspector() {
  const { selectedObjects, sceneObjects, executeCommand, updateObjectMaterial, updateObjectMesh, updateObjectProperties } = useEditorStore()

  // Get data for the first selected object (for single selection)
  const primaryObject = selectedObjects.length > 0 ? sceneObjects[selectedObjects[0]] : null
  
  const handleTransformChange = (
    field: 'position' | 'rotation' | 'scale',
    axis: 'x' | 'y' | 'z',
    value: number
  ) => {
    if (!primaryObject) return

    // For multi-selection, apply to all selected objects
    selectedObjects.forEach((objectId: string) => {
      const obj = sceneObjects[objectId]
      if (obj) {
        // Capture old transform for undo
        const oldTransform = {
          position: [...obj.position] as [number, number, number],
          rotation: [...obj.rotation] as [number, number, number],
          scale: [...obj.scale] as [number, number, number]
        }

        let newTransform = { ...oldTransform }

        if (field === 'position') {
          const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
          newTransform.position[axisIndex] = value
        } else if (field === 'rotation') {
          const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
          newTransform.rotation[axisIndex] = value * (Math.PI / 180) // Convert degrees to radians
        } else if (field === 'scale') {
          const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
          newTransform.scale[axisIndex] = value
        }

        // Create and execute command for undo/redo support
        const command = new TransformCommand(objectId, oldTransform, newTransform)
        command.execute()
        executeCommand(command)
      }
    })
  }

  if (selectedObjects.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-editor-textMuted">
          <div className="text-center">
            <Search className="w-8 h-8 mb-2 mx-auto" />
            <div className="text-sm">No object selected</div>
          </div>
        </div>
      </div>
    )
  }

  const selectedCount = selectedObjects.length
  const objectName = selectedCount === 1 && primaryObject ? primaryObject.name : `${selectedCount} objects`

  // Transform values - use primary object values or show mixed for multi-selection
  const getTransformValue = (field: 'position' | 'rotation' | 'scale', axis: 'x' | 'y' | 'z'): number => {
    if (!primaryObject) return 0
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
    if (field === 'rotation') {
      return primaryObject[field][axisIndex] * (180 / Math.PI) // Convert radians to degrees
    }
    return primaryObject[field][axisIndex]
  }

  return (
    <div className="flex flex-col h-full">
      {/* Object count info */}
      {selectedCount > 1 && (
        <div className="p-3 border-b border-editor-border">
          <div className="text-xs text-editor-textMuted">
            {selectedCount} objects selected
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar p-3 space-y-4">
        {/* Object Name */}
        <div>
          <input
            type="text"
            value={objectName}
            onChange={(e) => {
              if (selectedCount === 1 && primaryObject) {
                // Update object name directly in store
                useEditorStore.setState((state: any) => {
                  state.sceneObjects[primaryObject.id].name = e.target.value
                })
              }
            }}
            className="w-full px-2 py-1 text-sm font-semibold bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
            readOnly={selectedCount > 1}
            placeholder={selectedCount > 1 ? 'Multiple objects selected' : 'Object name'}
          />
        </div>

        {/* Transform */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium border-b border-editor-border pb-1">Transform</h4>
          
          {/* Position */}
          <div>
            <label className="block text-xs text-editor-textMuted mb-1">Position</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-editor-textMuted">X</label>
                <input
                  type="number"
                  value={getTransformValue('position', 'x')}
                  onChange={(e) => handleTransformChange('position', 'x', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Y</label>
                <input
                  type="number"
                  value={getTransformValue('position', 'y')}
                  onChange={(e) => handleTransformChange('position', 'y', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Z</label>
                <input
                  type="number"
                  value={getTransformValue('position', 'z')}
                  onChange={(e) => handleTransformChange('position', 'z', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div>
            <label className="block text-xs text-editor-textMuted mb-1">Rotation</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-editor-textMuted">X</label>
                <input
                  type="number"
                  value={getTransformValue('rotation', 'x')}
                  onChange={(e) => handleTransformChange('rotation', 'x', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Y</label>
                <input
                  type="number"
                  value={getTransformValue('rotation', 'y')}
                  onChange={(e) => handleTransformChange('rotation', 'y', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Z</label>
                <input
                  type="number"
                  value={getTransformValue('rotation', 'z')}
                  onChange={(e) => handleTransformChange('rotation', 'z', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="1"
                />
              </div>
            </div>
          </div>

          {/* Scale */}
          <div>
            <label className="block text-xs text-editor-textMuted mb-1">Scale</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-editor-textMuted">X</label>
                <input
                  type="number"
                  value={getTransformValue('scale', 'x')}
                  onChange={(e) => handleTransformChange('scale', 'x', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Y</label>
                <input
                  type="number"
                  value={getTransformValue('scale', 'y')}
                  onChange={(e) => handleTransformChange('scale', 'y', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Z</label>
                <input
                  type="number"
                  value={getTransformValue('scale', 'z')}
                  onChange={(e) => handleTransformChange('scale', 'z', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="0.1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Material Editor */}
        <MaterialEditor 
          selectedObjects={selectedObjects}
          onMaterialChange={(materialProps) => {
            console.log('Material changed:', materialProps)
            // Apply material to selected objects in the store/scene
            selectedObjects.forEach((objectId: string) => {
              updateObjectMaterial(objectId, materialProps)
            })
          }}
        />

        {/* Mesh */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium border-b border-editor-border pb-1">Mesh</h4>
          <select 
            className="w-full px-2 py-1 text-sm bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
            value={primaryObject?.meshType || 'cube'}
            onChange={(e) => {
              if (selectedCount === 1 && primaryObject) {
                updateObjectMesh(primaryObject.id, e.target.value as 'cube' | 'sphere' | 'pyramid')
              }
            }}
            disabled={selectedCount > 1}
          >
            <option value="cube">Cube</option>
            <option value="sphere">Sphere</option>
            <option value="pyramid">Pyramid</option>
          </select>
        </div>

        {/* Tile Properties */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-editor-accent border-b border-editor-border/30 pb-1">Tile Properties</h4>
          
          {/* Tile Type Selection */}
          <div>
            <label className="block text-xs text-editor-textMuted mb-1">Tile Type</label>
            <select 
              className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
              value={primaryObject?.metadata?.tileType || '1'}
              onChange={(e) => {
                const tileType = e.target.value
                selectedObjects.forEach((objectId: string) => {
                  const obj = sceneObjects[objectId]
                  if (obj) {
                    updateObjectProperties(objectId, { 
                      metadata: { 
                        ...obj.metadata, 
                        tileType,
                        tileChar: getTileChar(tileType)
                      } 
                    })
                  }
                })
              }}
              disabled={selectedCount > 1}
            >
              <option value="1">🟫 FLOOR (1) - Walkable surface</option>
              <option value="2">🚪 DOOR (2) - Passage between rooms</option>
              <option value="3">🪟 WINDOW (3) - Light source, partial vision</option>
              <option value="4">🧱 WALL (4) - Solid barrier</option>
              <option value="5">📦 FURNITURE (5) - Decorative object</option>
              <option value="6">🌟 SPAWN (6) - Player/entity spawn point</option>
              <option value="7">🎯 OBJECTIVE (7) - Mission objective</option>
              <option value="8">⚡ HAZARD (8) - Dangerous area</option>
            </select>
          </div>

          {/* Tile Character Representation */}
          <div>
            <label className="block text-xs text-editor-textMuted mb-1">ASCII Character</label>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-editor-bg border border-editor-border rounded flex items-center justify-center font-mono text-sm">
                {getTileChar(primaryObject?.metadata?.tileType || '1')}
              </div>
              <input
                type="text"
                maxLength={1}
                value={primaryObject?.metadata?.tileChar || getTileChar(primaryObject?.metadata?.tileType || '1')}
                onChange={(e) => {
                  const char = e.target.value.slice(0, 1)
                  selectedObjects.forEach((objectId: string) => {
                    const obj = sceneObjects[objectId]
                    if (obj) {
                      updateObjectProperties(objectId, { 
                        metadata: { 
                          ...obj.metadata, 
                          tileChar: char 
                        } 
                      })
                    }
                  })
                }}
                className="flex-1 px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent font-mono text-center"
                placeholder="#"
              />
            </div>
            <div className="text-xs text-editor-textMuted mt-1">
              Character used in 2D grid view
            </div>
          </div>

          {/* Movement and Vision Properties */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-editor-textMuted">Movement & Vision</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center space-x-2 p-2 bg-editor-panel rounded border border-editor-border/50">
                <input 
                  type="checkbox" 
                  checked={primaryObject?.collision || false}
                  onChange={(e) => {
                    selectedObjects.forEach((objectId: string) => {
                      updateObjectProperties(objectId, { collision: e.target.checked })
                    })
                  }}
                  className="rounded accent-editor-accent" 
                />
                <span className="text-xs">🚫 Blocks Movement</span>
              </label>
              
              <label className="flex items-center space-x-2 p-2 bg-editor-panel rounded border border-editor-border/50">
                <input 
                  type="checkbox" 
                  checked={primaryObject?.metadata?.blocksVision || false}
                  onChange={(e) => {
                    selectedObjects.forEach((objectId: string) => {
                      const obj = sceneObjects[objectId]
                      if (obj) {
                        updateObjectProperties(objectId, { 
                          metadata: { 
                            ...obj.metadata, 
                            blocksVision: e.target.checked 
                          } 
                        })
                      }
                    })
                  }}
                  className="rounded accent-editor-accent" 
                />
                <span className="text-xs">👁️ Blocks Vision</span>
              </label>

              <label className="flex items-center space-x-2 p-2 bg-editor-panel rounded border border-editor-border/50">
                <input 
                  type="checkbox" 
                  checked={!(primaryObject?.walkable ?? true)}
                  onChange={(e) => {
                    selectedObjects.forEach((objectId: string) => {
                      updateObjectProperties(objectId, { walkable: !e.target.checked })
                    })
                  }}
                  className="rounded accent-editor-accent" 
                />
                <span className="text-xs">💥 Destructible</span>
              </label>

              <label className="flex items-center space-x-2 p-2 bg-editor-panel rounded border border-editor-border/50">
                <input 
                  type="checkbox" 
                  checked={primaryObject?.metadata?.interactive || false}
                  onChange={(e) => {
                    selectedObjects.forEach((objectId: string) => {
                      const obj = sceneObjects[objectId]
                      if (obj) {
                        updateObjectProperties(objectId, { 
                          metadata: { 
                            ...obj.metadata, 
                            interactive: e.target.checked 
                          } 
                        })
                      }
                    })
                  }}
                  className="rounded accent-editor-accent" 
                />
                <span className="text-xs">🖱️ Interactive</span>
              </label>
            </div>
          </div>

          {/* Tags with Better UI */}
          <div>
            <label className="block text-xs text-editor-textMuted mb-1">Tags</label>
            <div className="space-y-2">
              <input
                type="text"
                value={primaryObject?.tags?.join(', ') || ''}
                onChange={(e) => {
                  const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                  selectedObjects.forEach((objectId: string) => {
                    updateObjectProperties(objectId, { tags })
                  })
                }}
                className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                placeholder="structure, exterior, decorative"
              />
              
              {/* Tag Presets */}
              <div className="flex flex-wrap gap-1">
                {['structure', 'exterior', 'interior', 'decorative', 'functional', 'temporary'].map(preset => (
                  <button
                    key={preset}
                    onClick={() => {
                      const currentTags = primaryObject?.tags || []
                      const newTags = currentTags.includes(preset) 
                        ? currentTags.filter(tag => tag !== preset)
                        : [...currentTags, preset]
                      
                      selectedObjects.forEach((objectId: string) => {
                        updateObjectProperties(objectId, { tags: newTags })
                      })
                    }}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      (primaryObject?.tags || []).includes(preset)
                        ? 'bg-editor-accent text-white border-editor-accent'
                        : 'bg-editor-panel border-editor-border text-editor-textMuted hover:border-editor-accent'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid Position (if applicable) */}
          {primaryObject?.metadata?.gridPosition && (
            <div>
              <label className="block text-xs text-editor-textMuted mb-1">Grid Position</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-editor-textMuted">X</label>
                  <input
                    type="number"
                    value={primaryObject.metadata.gridPosition.x || 0}
                    onChange={(e) => {
                      const newX = parseInt(e.target.value) || 0
                      selectedObjects.forEach((objectId: string) => {
                        const obj = sceneObjects[objectId]
                        if (obj && obj.metadata?.gridPosition) {
                          updateObjectProperties(objectId, { 
                            metadata: { 
                              ...obj.metadata, 
                              gridPosition: { ...obj.metadata.gridPosition, x: newX } 
                            } 
                          })
                        }
                      })
                    }}
                    className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-xs text-editor-textMuted">Y</label>
                  <input
                    type="number"
                    value={primaryObject.metadata.gridPosition.y || 0}
                    onChange={(e) => {
                      const newY = parseInt(e.target.value) || 0
                      selectedObjects.forEach((objectId: string) => {
                        const obj = sceneObjects[objectId]
                        if (obj && obj.metadata?.gridPosition) {
                          updateObjectProperties(objectId, { 
                            metadata: { 
                              ...obj.metadata, 
                              gridPosition: { ...obj.metadata.gridPosition, y: newY } 
                            } 
                          })
                        }
                      })
                    }}
                    className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                    step="1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}