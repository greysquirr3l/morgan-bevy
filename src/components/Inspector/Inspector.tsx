import { useState } from 'react'
import { useEditorStore } from '@/store/editorStore'

export default function Inspector() {
  const { selectedObjects } = useEditorStore()
  const [transform, setTransform] = useState({
    position: { x: 2.0, y: 0.0, z: 5.0 },
    rotation: { x: 0, y: 90, z: 0 },
    scale: { x: 1.0, y: 3.5, z: 0.2 }
  })

  if (selectedObjects.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-editor-border">
          <h3 className="text-sm font-semibold">Inspector</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-editor-textMuted">
          <div className="text-center">
            <div className="text-4xl mb-2">🔍</div>
            <div className="text-sm">No object selected</div>
          </div>
        </div>
      </div>
    )
  }

  const selectedCount = selectedObjects.length
  const objectName = selectedCount === 1 ? 'Wall_001' : `${selectedCount} objects`

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-editor-border">
        <h3 className="text-sm font-semibold">Inspector</h3>
        {selectedCount > 1 && (
          <div className="text-xs text-editor-textMuted mt-1">
            {selectedCount} objects selected
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar p-3 space-y-4">
        {/* Object Name */}
        <div>
          <input
            type="text"
            value={objectName}
            className="w-full px-2 py-1 text-sm font-semibold bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
            readOnly={selectedCount > 1}
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
                  value={transform.position.x}
                  onChange={(e) => setTransform(prev => ({
                    ...prev,
                    position: { ...prev.position, x: parseFloat(e.target.value) }
                  }))}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Y</label>
                <input
                  type="number"
                  value={transform.position.y}
                  onChange={(e) => setTransform(prev => ({
                    ...prev,
                    position: { ...prev.position, y: parseFloat(e.target.value) }
                  }))}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Z</label>
                <input
                  type="number"
                  value={transform.position.z}
                  onChange={(e) => setTransform(prev => ({
                    ...prev,
                    position: { ...prev.position, z: parseFloat(e.target.value) }
                  }))}
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
                  value={transform.rotation.x}
                  onChange={(e) => setTransform(prev => ({
                    ...prev,
                    rotation: { ...prev.rotation, x: parseFloat(e.target.value) }
                  }))}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Y</label>
                <input
                  type="number"
                  value={transform.rotation.y}
                  onChange={(e) => setTransform(prev => ({
                    ...prev,
                    rotation: { ...prev.rotation, y: parseFloat(e.target.value) }
                  }))}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Z</label>
                <input
                  type="number"
                  value={transform.rotation.z}
                  onChange={(e) => setTransform(prev => ({
                    ...prev,
                    rotation: { ...prev.rotation, z: parseFloat(e.target.value) }
                  }))}
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
                  value={transform.scale.x}
                  onChange={(e) => setTransform(prev => ({
                    ...prev,
                    scale: { ...prev.scale, x: parseFloat(e.target.value) }
                  }))}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Y</label>
                <input
                  type="number"
                  value={transform.scale.y}
                  onChange={(e) => setTransform(prev => ({
                    ...prev,
                    scale: { ...prev.scale, y: parseFloat(e.target.value) }
                  }))}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-editor-textMuted">Z</label>
                <input
                  type="number"
                  value={transform.scale.z}
                  onChange={(e) => setTransform(prev => ({
                    ...prev,
                    scale: { ...prev.scale, z: parseFloat(e.target.value) }
                  }))}
                  className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                  step="0.1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mesh */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium border-b border-editor-border pb-1">Mesh</h4>
          <select className="w-full px-2 py-1 text-sm bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent">
            <option value="wall_standard">Wall_Standard</option>
            <option value="wall_corner">Wall_Corner</option>
            <option value="wall_door">Wall_Door</option>
          </select>
        </div>

        {/* Material */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium border-b border-editor-border pb-1">Material</h4>
          <select className="w-full px-2 py-1 text-sm bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent">
            <option value="concrete_gray">Concrete_Gray</option>
            <option value="brick_red">Brick_Red</option>
            <option value="metal_steel">Metal_Steel</option>
          </select>
          
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="block text-xs text-editor-textMuted">Base Color</label>
              <div className="flex">
                <div className="w-6 h-6 bg-gray-500 border border-editor-border rounded-l"></div>
                <input
                  type="text"
                  value="#808080"
                  className="flex-1 px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded-r focus:outline-none focus:border-editor-accent"
                />
              </div>
            </div>
            <button className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border self-end">
              📁 Load
            </button>
          </div>

          <div>
            <label className="block text-xs text-editor-textMuted mb-1">Metallic</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              defaultValue="0"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-editor-textMuted mb-1">Roughness</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              defaultValue="0.8"
              className="w-full"
            />
          </div>
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