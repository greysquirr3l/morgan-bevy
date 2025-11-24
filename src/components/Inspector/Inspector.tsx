
import { useEditorStore } from '@/store/editorStore'
import MaterialEditor from '../MaterialEditor'
import { Search } from 'lucide-react'
import { TransformCommand } from '@/utils/commands'

export default function Inspector() {
  const { selectedObjects, sceneObjects, executeCommand } = useEditorStore()

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
            // TODO: Apply material to selected objects in the store/scene
          }}
        />

        {/* Mesh */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium border-b border-editor-border pb-1">Mesh</h4>
          <select className="w-full px-2 py-1 text-sm bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent">
            <option value="cube">Cube</option>
            <option value="sphere">Sphere</option>
            <option value="pyramid">Pyramid</option>
          </select>
        </div>

        {/* Tile Properties */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium border-b border-editor-border pb-1">Tile Properties</h4>
          
          <div>
            <label className="block text-xs text-editor-textMuted mb-1">Type</label>
            <select className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent">
              <option value="4">WALL (4)</option>
              <option value="1">FLOOR (1)</option>
              <option value="2">DOOR (2)</option>
              <option value="3">WINDOW (3)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input type="checkbox" defaultChecked className="rounded" />
              <span className="text-xs">Blocks Movement</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" defaultChecked className="rounded" />
              <span className="text-xs">Blocks Vision</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" className="rounded" />
              <span className="text-xs">Destructible</span>
            </label>
          </div>

          <div>
            <label className="block text-xs text-editor-textMuted mb-1">Tags</label>
            <input
              type="text"
              value="structure, exterior"
              className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
            />
          </div>
        </div>
      </div>
    </div>
  )
}