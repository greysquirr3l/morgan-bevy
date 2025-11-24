import { useState, useEffect, useRef } from 'react'
import Viewport3D, { CameraControlsRef } from '@/components/Viewport3D/Viewport3D'
import GridView, { GridViewRef } from '@/components/GridView/GridView'
import Hierarchy from '@/components/Hierarchy/Hierarchy'
import Inspector from './components/Inspector/Inspector'
import Layers from '@/components/Layers'
import FileMenu from '@/components/FileMenu/FileMenu'
import PrefabManager from '@/components/PrefabManager/PrefabManager'
import GenerationPanel from '@/components/GenerationPanel/GenerationPanel'
import { ActionsPanel } from '@/components/ActionsPanel'
import { AssetsPanel } from '@/components/AssetsPanel'
import CollapsiblePanel from '@/components/CollapsiblePanel'
import { useEditorStore } from '@/store/editorStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useResizablePanels } from '@/hooks/useResizablePanels'

function App() {
  const [isReady, setIsReady] = useState(false)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [fileMenuPosition, setFileMenuPosition] = useState({ x: 0, y: 0 })
  const { 
    transformMode, 
    setTransformMode, 
    snapToGrid, 
    toggleSnapToGrid,
    gridSize,
    setGridSize,
    viewportMode,
    setViewportMode,
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
  const { panels, handleMouseDown, toggleLeftPanel, toggleRightPanel, getCenterWidth } = useResizablePanels()
  
  // Camera controls and grid view refs
  const cameraControlsRef = useRef<CameraControlsRef>(null)
  const gridViewRef = useRef<GridViewRef>(null)

  const handleFileMenuClick = (event: React.MouseEvent) => {
    setFileMenuPosition({ x: event.clientX, y: event.clientY + 10 })
    setFileMenuOpen(true)
  }

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
          <span 
            className="hover:text-editor-accent cursor-pointer" 
            onClick={handleFileMenuClick}
          >
            File
          </span>
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
        <div className="flex space-x-2">
          <button
            className={`px-2 py-1 text-sm rounded transition-colors ${
              viewportMode === '3d'
                ? 'bg-editor-accent text-white'
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={() => setViewportMode('3d')}
            title="3D Viewport"
          >
            3D
          </button>
          <button
            className={`px-2 py-1 text-sm rounded transition-colors ${
              viewportMode === '2d'
                ? 'bg-editor-accent text-white'
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={() => setViewportMode('2d')}
            title="2D Grid View"
          >
            2D
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
        <div className="text-editor-border">|</div>
        <div className="flex space-x-2">
          <button
            className={`px-2 py-1 text-sm rounded transition-colors ${
              panels.leftVisible
                ? 'bg-editor-accent text-white'
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={toggleLeftPanel}
            title="Toggle Left Panel"
          >
            Left
          </button>
          <button
            className={`px-2 py-1 text-sm rounded transition-colors ${
              panels.rightVisible
                ? 'bg-editor-accent text-white'
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={toggleRightPanel}
            title="Toggle Right Panel"
          >
            Right
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Panel - Actions, Assets and Hierarchy */}
        {panels.leftVisible && (
          <>
            <div className="bg-editor-panel border-r border-editor-border flex flex-col overflow-hidden" style={{ width: `${panels.leftWidth}px` }}>
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <CollapsiblePanel title="Actions" enableScrollbarlessScrolling={true}>
                  <ActionsPanel />
                </CollapsiblePanel>
                <CollapsiblePanel title="Assets" enableScrollbarlessScrolling={true}>
                  <AssetsPanel />
                </CollapsiblePanel>
                <CollapsiblePanel title="Prefabs" enableScrollbarlessScrolling={true}>
                  <PrefabManager />
                </CollapsiblePanel>
                <CollapsiblePanel title="" enableScrollbarlessScrolling={true}>
                  <Layers hideHeader={true} />
                </CollapsiblePanel>
                <CollapsiblePanel title="Hierarchy" enableScrollbarlessScrolling={true}>
                  <Hierarchy />
                </CollapsiblePanel>
              </div>
            </div>
            
            {/* Left Resize Handle */}
            <div 
              className="w-1 bg-editor-accent/30 hover:bg-editor-accent cursor-col-resize group relative transition-colors z-10"
              onMouseDown={handleMouseDown('left')}
              style={{ minWidth: '1px' }}
            >
              <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-editor-accent/70 transition-all"></div>
            </div>
          </>
        )}

        {/* Center - Viewport (3D or 2D Grid) */}
        <div 
          className="relative overflow-hidden bg-gray-900" 
          style={{ width: `${getCenterWidth()}px` }}
        >
          {viewportMode === '3d' ? (
            <>
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
            </>
          ) : (
            <>
              <GridView ref={gridViewRef} />
              
              {/* Grid View Controls */}
              <div className="absolute top-4 left-4 bg-editor-panel/90 border border-editor-border rounded p-2 space-y-1">
                <div className="text-xs font-medium text-editor-text mb-2">Grid Tools</div>
                <button 
                  className="w-full text-xs px-2 py-1 bg-editor-bg hover:bg-editor-border rounded text-left" 
                  title="Clear entire grid"
                  onClick={() => gridViewRef.current?.clearGrid()}
                >
                  Clear Grid
                </button>
                <button 
                  className="w-full text-xs px-2 py-1 bg-editor-bg hover:bg-editor-border rounded text-left" 
                  title="Export grid as text"
                  onClick={() => {
                    const gridString = gridViewRef.current?.exportGrid()
                    if (gridString) {
                      navigator.clipboard.writeText(gridString)
                    }
                  }}
                >
                  Copy Grid
                </button>
                <div className="text-xs text-editor-textMuted mt-2">
                  Paint: Draw tiles<br/>
                  Select: Box select<br/>
                  Fill: Flood fill<br/>
                  Ctrl+C/V: Copy/Paste
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Right Panel - Inspector and Generation */}
        {panels.rightVisible && (
          <>
            {/* Right Resize Handle */}
            <div 
              className="w-1 bg-editor-accent/30 hover:bg-editor-accent cursor-col-resize group relative transition-colors z-10"
              onMouseDown={handleMouseDown('right')}
              style={{ minWidth: '1px' }}
            >
              <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-editor-accent/70 transition-all"></div>
            </div>

            <div className="bg-editor-panel border-l border-editor-border flex flex-col" style={{ width: `${panels.rightWidth}px` }}>
              <div className="flex-1 overflow-hidden">
                <CollapsiblePanel title="Inspector" enableScrollbarlessScrolling={true}>
                  <Inspector />
                </CollapsiblePanel>
                <CollapsiblePanel title="Procedural Generation" enableScrollbarlessScrolling={true} maxHeight="250px">
                  <GenerationPanel />
                </CollapsiblePanel>
              </div>
            </div>
          </>
        )}
      </div>


      
      {/* File Menu */}
      <FileMenu
        isOpen={fileMenuOpen}
        onClose={() => setFileMenuOpen(false)}
        position={fileMenuPosition}
      />
    </div>
  )
}

export default App