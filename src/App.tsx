import { useState, useEffect } from 'react'
import Viewport3D from '@/components/Viewport3D/Viewport3D'
import Hierarchy from '@/components/Hierarchy/Hierarchy'
import Inspector from '@/components/Inspector/Inspector'
import { ActionsPanel } from '@/components/ActionsPanel'
import { AssetsPanel } from '@/components/AssetsPanel'
import { useEditorStore } from '@/store/editorStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

function App() {
  const [isReady, setIsReady] = useState(false)
  const { 
    transformMode, 
    setTransformMode, 
    snapToGrid, 
    toggleSnapToGrid,
    gridSize,
    setGridSize 
  } = useEditorStore()
  
  // Initialize keyboard shortcuts
  useKeyboardShortcuts()

  useEffect(() => {
    // Initialize the editor store and mark as ready
    setIsReady(true)
  }, [])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-editor-bg">
        <div className="text-editor-text">Loading Morgan-Bevy...</div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-editor-bg text-editor-text flex flex-col overflow-hidden">
      {/* Top Menu Bar */}
      <div className="bg-editor-panel border-b border-editor-border px-4 py-2 flex items-center space-x-4 no-select">
        <div className="text-sm font-semibold">Morgan-Bevy</div>
        <div className="flex space-x-4 text-sm">
          <span className="hover:text-editor-accent cursor-pointer">File</span>
          <span className="hover:text-editor-accent cursor-pointer">Edit</span>
          <span className="hover:text-editor-accent cursor-pointer">View</span>
          <span className="hover:text-editor-accent cursor-pointer">Generate</span>
          <span className="hover:text-editor-accent cursor-pointer">Tools</span>
          <span className="hover:text-editor-accent cursor-pointer">Help</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-editor-panel border-b border-editor-border px-4 py-2 flex items-center space-x-4 no-select">
        <div className="flex space-x-2">
          <button 
            className={`px-3 py-1 text-sm rounded transition-colors ${
              transformMode === 'select' 
                ? 'bg-editor-accent text-white' 
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={() => setTransformMode('select')}
            title="Select Mode"
          >
            Select
          </button>
          <button 
            className={`px-3 py-1 text-sm rounded transition-colors ${
              transformMode === 'translate' 
                ? 'bg-editor-accent text-white' 
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={() => setTransformMode('translate')}
            title="Move Tool (W)"
          >
            Move
          </button>
          <button 
            className={`px-3 py-1 text-sm rounded transition-colors ${
              transformMode === 'rotate' 
                ? 'bg-editor-accent text-white' 
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={() => setTransformMode('rotate')}
            title="Rotate Tool (E)"
          >
            Rotate
          </button>
          <button 
            className={`px-3 py-1 text-sm rounded transition-colors ${
              transformMode === 'scale' 
                ? 'bg-editor-accent text-white' 
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={() => setTransformMode('scale')}
            title="Scale Tool (R)"
          >
            Scale
          </button>
        </div>
        <div className="text-editor-border">|</div>
        <div className="flex items-center space-x-2">
          <button
            className={`px-2 py-1 text-sm rounded transition-colors ${
              snapToGrid 
                ? 'bg-editor-accent text-white' 
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={toggleSnapToGrid}
            title="Snap to Grid"
          >
            Snap: {snapToGrid ? 'On' : 'Off'}
          </button>
          <select 
            className="bg-editor-bg text-editor-text text-sm px-2 py-1 rounded border border-editor-border"
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value))}
            title="Grid Size"
          >
            <option value="0.1">0.1</option>
            <option value="0.5">0.5</option>
            <option value="1.0">1.0</option>
            <option value="2.0">2.0</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Actions, Assets and Hierarchy */}
        <div className="w-64 bg-editor-panel border-r border-editor-border flex flex-col">
          <ActionsPanel />
          <AssetsPanel />
          <Hierarchy />
        </div>

        {/* Center - 3D Viewport */}
        <div className="flex-1 relative">
          <Viewport3D />
        </div>

        {/* Right Panel - Inspector */}
        <div className="w-80 bg-editor-panel border-l border-editor-border flex flex-col">
          <Inspector />
        </div>
      </div>

      {/* Bottom Panel - Generation Controls */}
      <div className="h-32 bg-editor-panel border-t border-editor-border px-4 py-2">
        <div className="text-sm font-semibold mb-2">Procedural Generation</div>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <label className="flex items-center space-x-1">
              <input type="radio" name="algorithm" value="bsp" defaultChecked />
              <span className="text-generation-bsp">BSP</span>
            </label>
            <label className="flex items-center space-x-1">
              <input type="radio" name="algorithm" value="wfc" />
              <span className="text-generation-wfc">WFC</span>
            </label>
            <label className="flex items-center space-x-1">
              <input type="radio" name="algorithm" value="manual" />
              <span className="text-generation-manual">Manual</span>
            </label>
          </div>
          <select className="bg-editor-bg text-editor-text text-sm px-2 py-1 rounded border border-editor-border">
            <option value="office">Office Building</option>
            <option value="dungeon">Fantasy Dungeon</option>
            <option value="scifi">Sci-Fi Facility</option>
          </select>
          <button className="px-4 py-1 bg-generation-bsp text-black text-sm rounded hover:bg-green-500">
            Generate
          </button>
        </div>
      </div>
    </div>
  )
}

export default App