import { useState, useEffect, useRef } from 'react'
import Viewport3D, { CameraControlsRef } from '@/components/Viewport3D/Viewport3D'
import Hierarchy from '@/components/Hierarchy/Hierarchy'
import Inspector from './components/Inspector/Inspector'
import Layers from '@/components/Layers'
import { ActionsPanel } from '@/components/ActionsPanel'
import { AssetsPanel } from '@/components/AssetsPanel'
import { useEditorStore } from '@/store/editorStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useResizablePanels } from '@/hooks/useResizablePanels'

function App() {
  const [isReady, setIsReady] = useState(false)
  const { 
    transformMode, 
    setTransformMode, 
    snapToGrid, 
    toggleSnapToGrid,
    gridSize,
    setGridSize,
    undo,
    redo,
    canUndo,
    canRedo,
    undoHistory,
    redoHistory
  } = useEditorStore()
  
  // Initialize keyboard shortcuts
  useKeyboardShortcuts()
  
  // Initialize resizable panels
  const { panels, handleMouseDown, toggleBottomPanel } = useResizablePanels()
  
  // Camera controls ref
  const cameraControlsRef = useRef<CameraControlsRef>(null)

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
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1 text-sm rounded transition-colors ${
              canUndo() 
                ? 'bg-editor-bg text-editor-text hover:bg-gray-600' 
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            onClick={undo}
            disabled={!canUndo()}
            title={`Undo ${undoHistory.length > 0 ? undoHistory[undoHistory.length - 1]?.description || '' : ''} (Ctrl+Z)`}
          >
            Undo
          </button>
          <button
            className={`px-3 py-1 text-sm rounded transition-colors ${  
              canRedo()
                ? 'bg-editor-bg text-editor-text hover:bg-gray-600'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            onClick={redo}
            disabled={!canRedo()}
            title={`Redo ${redoHistory.length > 0 ? redoHistory[redoHistory.length - 1]?.description || '' : ''} (Ctrl+Y)`}
          >
            Redo
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
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Panel - Actions, Assets and Hierarchy */}
        <div className="bg-editor-panel border-r border-editor-border flex flex-col overflow-hidden" style={{ width: `${panels.leftWidth}px` }}>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <ActionsPanel />
            <AssetsPanel />
            <Layers />
            <Hierarchy />
          </div>
        </div>
        
        {/* Left Resize Handle */}
        <div 
          className="w-1 bg-editor-border hover:bg-editor-accent cursor-col-resize group relative"
          onMouseDown={handleMouseDown('left')}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-editor-accent/20"></div>
        </div>

        {/* Center - 3D Viewport */}
        <div className="flex-1 relative overflow-hidden bg-gray-900">
          <Viewport3D ref={cameraControlsRef} />
          
          {/* Camera Controls */}
          <div className="absolute top-4 left-4 bg-editor-panel/90 border border-editor-border rounded p-2 space-y-1">
            <div className="text-xs font-medium text-editor-text mb-2">Camera</div>
            <button 
              className="w-full text-xs px-2 py-1 bg-editor-bg hover:bg-editor-border rounded text-left" 
              title="Reset camera to default position"
              onClick={() => cameraControlsRef.current?.resetView()}
            >
              Reset View
            </button>
            <button 
              className="w-full text-xs px-2 py-1 bg-editor-bg hover:bg-editor-border rounded text-left" 
              title="Focus on selected objects"
              onClick={() => cameraControlsRef.current?.focusSelection()}
            >
              Focus Selection
            </button>
            <div className="text-xs text-editor-textMuted mt-2">
              Mouse: Orbit<br/>
              Wheel: Zoom<br/>
              Shift+Mouse: Pan
            </div>
          </div>
        </div>
        
        {/* Right Resize Handle */}
        <div 
          className="w-1 bg-editor-border hover:bg-editor-accent cursor-col-resize group relative"
          onMouseDown={handleMouseDown('right')}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-editor-accent/20"></div>
        </div>

        {/* Right Panel - Inspector */}
        <div className="bg-editor-panel border-l border-editor-border flex flex-col" style={{ width: `${panels.rightWidth}px` }}>
          <Inspector />
        </div>
      </div>

      {/* Bottom Panel - Generation Controls */}
      {!panels.isBottomCollapsed && (
        <div className="relative">
          {/* Bottom Resize Handle */}
          <div 
            className="h-1 bg-editor-border hover:bg-editor-accent cursor-row-resize group relative"
            onMouseDown={handleMouseDown('bottom')}
          >
            <div className="absolute -top-1 -bottom-1 left-0 right-0 group-hover:bg-editor-accent/20"></div>
          </div>
          
          <div className="bg-editor-panel border-t border-editor-border px-4 py-2" style={{ height: `${panels.bottomHeight}px` }}>
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-semibold">Procedural Generation</div>
              <div className="flex items-center space-x-2">
                <div className="text-xs text-gray-400">
                  History: {undoHistory.length} undo, {redoHistory.length} redo
                </div>
                <button 
                  className="text-xs text-editor-textMuted hover:text-editor-text" 
                  title="Collapse panel"
                  onClick={toggleBottomPanel}
                >
                  ▼
                </button>
              </div>
            </div>
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
      )}
      
      {/* Collapsed Bottom Panel Indicator */}
      {panels.isBottomCollapsed && (
        <div className="bg-editor-panel border-t border-editor-border px-4 py-1 flex justify-between items-center">
          <div className="text-xs text-editor-textMuted">Procedural Generation</div>
          <button 
            className="text-xs text-editor-textMuted hover:text-editor-text" 
            title="Expand panel"
            onClick={toggleBottomPanel}
          >
            ▲
          </button>
        </div>
      )}
    </div>
  )
}

export default App