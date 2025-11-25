import { useState, useEffect, useRef, useCallback } from 'react'
import { PanelLeft, PanelRight } from 'lucide-react'
import Viewport3D from '@/components/Viewport3D/Viewport3D'
import GridView, { GridViewRef } from '@/components/GridView/GridView'
import Hierarchy from '@/components/Hierarchy/Hierarchy'
import Inspector from './components/Inspector/Inspector'
import Layers from '@/components/Layers'
import FileMenu from '@/components/FileMenu/FileMenu'
import PrefabManager from '@/components/PrefabManager/PrefabManager'
import GenerationPanel from '@/components/GenerationPanel/GenerationPanel'
import ExportPanel from '@/components/ExportPanel/ExportPanel'
import PerformanceTestPanel from '@/components/PerformanceTestPanel'
import { ActionsPanel } from '@/components/ActionsPanel'
import AssetBrowser from '@/components/AssetBrowser'
import CollapsiblePanel from '@/components/CollapsiblePanel'
import KeyboardShortcutsModal, { useKeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal'
import { CameraProvider, useCameraContext } from '@/contexts/CameraContext'
import { useEditorStore } from '@/store/editorStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useResizablePanels } from '@/hooks/useResizablePanels'

// Robust debug logging system
class DebugLogger {
  private logs: string[] = []
  private startTime = Date.now()
  
  log(category: string, message: string, data?: any) {
    const timestamp = Date.now() - this.startTime
    const logEntry = `[${timestamp}ms] [${category}] ${message}`
    const fullEntry = data ? `${logEntry} | Data: ${JSON.stringify(data, null, 2)}` : logEntry
    
    console.log(`🔍 ${logEntry}`, data || '')
    this.logs.push(fullEntry)
    
    // Save to localStorage for persistence
    this.saveLogs()
  }
  
  logError(category: string, error: string, stack?: any) {
    const timestamp = Date.now() - this.startTime
    const logEntry = `[${timestamp}ms] [${category}] ERROR: ${error}`
    const fullEntry = stack ? `${logEntry} | Stack: ${JSON.stringify(stack, null, 2)}` : logEntry
    
    console.error(`🚨 ${logEntry}`, stack || '')
    this.logs.push(fullEntry)
    
    this.saveLogs()
  }
  
  saveLogs() {
    try {
      localStorage.setItem('morgan-bevy-debug-logs', JSON.stringify({
        timestamp: new Date().toISOString(),
        logs: this.logs
      }))
    } catch (e) {
      console.error('Failed to save debug logs:', e)
    }
  }
  
  exportLogs() {
    const logData = {
      timestamp: new Date().toISOString(),
      sessionStart: new Date(Date.now() - (Date.now() - this.startTime)).toISOString(),
      logs: this.logs
    }
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `morgan-bevy-debug-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  clearLogs() {
    this.logs = []
    localStorage.removeItem('morgan-bevy-debug-logs')
  }
}

const debugLogger = new DebugLogger()

// Custom hook to manage 2D/3D synchronization
function useViewportSync() {
  // CRITICAL FIX: Only subscribe to viewportMode to prevent infinite loops
  // when sync operations modify gridData/selectedTheme
  const { viewportMode } = useEditorStore()
  const prevViewportModeRef = useRef<string | null>(null)
  const isInitializedRef = useRef(false)
  
  // Only log initialization once to prevent spam
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      // debugLogger.log('VIEWPORT_SYNC_INIT', 'useViewportSync hook initialized', {
      //   initialViewportMode: viewportMode
      // })
    }
  }, [])  // Empty dependency array to run only once

  // Sync grid to 3D scene (when switching from 2D to 3D)
  const syncGridToScene = useCallback(() => {
    // debugLogger.log('SYNC_GRID_TO_SCENE', 'Starting grid to scene sync')
    
    // Get fresh data from store to avoid stale closure issues
    const { selectedTheme, gridData, removeObject, addObjectDirect, sceneObjects } = useEditorStore.getState()
    
    if (!selectedTheme || !gridData || gridData.length === 0) {
      // debugLogger.log('SYNC_GRID_TO_SCENE', 'Sync aborted - missing data', {
      //   hasSelectedTheme: !!selectedTheme,
      //   hasGridData: !!gridData,
      //   gridDataLength: gridData?.length || 0
      // })
      return
    }
    
    // debugLogger.log('SYNC_GRID_TO_SCENE', 'Got editor store state', {
    //   sceneObjectsCount: Object.keys(sceneObjects).length
    // })
    
    // Remove all grid-generated objects
    const objectsToRemove = Object.entries(sceneObjects).filter(([objectId, obj]: [string, any]) => 
      obj.metadata?.fromGrid || objectId.startsWith('tile_')
    )
    
    // debugLogger.log('SYNC_GRID_TO_SCENE', 'Found objects to remove', {
    //   objectsToRemoveCount: objectsToRemove.length,
    //   objectIds: objectsToRemove.map(([id]) => id)
    // })
    
    objectsToRemove.forEach(([objectId]) => {
      removeObject(objectId)
    })

    // Add objects for all non-empty tiles
    let objectsCreated = 0
    const gridSize = { width: 48, height: 36 }
    
    gridData.forEach((row, y) => {
      row.forEach((tileType, x) => {
        if (tileType !== 'empty' && selectedTheme.tiles[tileType]) {
          const gridObjectId = `tile_${x}_${y}`
          const tileDefinition = selectedTheme.tiles[tileType]
          
          const position: [number, number, number] = [x - gridSize.width/2, 0, y - gridSize.height/2]
          
          let meshType: 'cube' | 'sphere' | 'pyramid' = 'cube'
          if (tileDefinition.mesh.mesh_type === 'sphere') {
            meshType = 'sphere'
          } else if (tileDefinition.mesh.mesh_type === 'pyramid' || tileDefinition.mesh.mesh_type === 'cone') {
            meshType = 'pyramid'
          }
          
          const materialData = {
            baseColor: tileDefinition.visual.color,
            metallic: tileDefinition.tile_type === 'Floor' ? 0.0 : 0.3,
            roughness: tileDefinition.tile_type === 'Floor' ? 0.8 : 0.5
          }
          
          addObjectDirect({
            id: gridObjectId,
            name: `${tileDefinition.name}_${x}_${y}`,
            type: 'mesh',
            position,
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            visible: true,
            locked: false,
            layerId: 'default',
            children: [],
            meshType,
            material: materialData,
            collision: tileDefinition.collision,
            walkable: tileDefinition.walkable,
            tags: tileDefinition.tags,
            metadata: {
              gridPosition: { x, y },
              tileType: tileType,
              fromGrid: true,
              originalTileDefinition: tileDefinition
            }
          })
          
          objectsCreated++
        }
      })
    })
    
    debugLogger.log('SYNC_GRID_TO_SCENE', 'Sync completed', {
      objectsCreated,
      removedObjects: objectsToRemove.length
    })
  }, [])  // CRITICAL FIX: Remove dependencies to prevent re-creation during sync operations

  // Sync 3D scene objects back to 2D grid (when switching from 3D to 2D)
  const sync3DToGrid = useCallback(() => {
    // debugLogger.log('SYNC_3D_TO_GRID', 'Starting 3D to grid sync')
    
    const { sceneObjects, setGridData } = useEditorStore.getState()
    // debugLogger.log('SYNC_3D_TO_GRID', 'Got editor store state', {
    //   sceneObjectsCount: Object.keys(sceneObjects || {}).length
    // })
    
    // Only sync if we have valid scene data
    if (!sceneObjects || Object.keys(sceneObjects).length === 0) {
      // debugLogger.log('SYNC_3D_TO_GRID', 'No scene objects, creating empty grid')
      // If no scene objects, create empty grid (don't load backup if user chose fresh start)
      const emptyGrid = Array(36).fill(null).map(() => Array(48).fill('empty'))
      setGridData(emptyGrid)
      return
    }
    
    // Create empty grid
    const newGrid = Array(36).fill(null).map(() => Array(48).fill('empty'))
    
    // Convert 3D objects back to grid tiles
    let tilesConverted = 0
    const gridObjects = Object.entries(sceneObjects).filter(([, obj]: [string, any]) => 
      obj.metadata?.gridPosition && obj.metadata?.tileType
    )
    
    // debugLogger.log('SYNC_3D_TO_GRID', 'Found grid objects to convert', {
    //   totalSceneObjects: Object.keys(sceneObjects).length,
    //   gridObjectsCount: gridObjects.length
    // })
    
    gridObjects.forEach(([, obj]: [string, any]) => {
      const { x, y } = obj.metadata.gridPosition
      const tileType = obj.metadata.tileType
      
      if (x >= 0 && x < 48 && y >= 0 && y < 36) {
        newGrid[y][x] = tileType
        tilesConverted++
      } else {
        // debugLogger.logError('SYNC_3D_TO_GRID', `Invalid grid position for object ${objectId}`, {
        //   gridPosition: { x, y },
        //   tileType
        // })
      }
    })
    
    debugLogger.log('SYNC_3D_TO_GRID', 'Sync completed', {
      tilesConverted,
      gridObjectsProcessed: gridObjects.length
    })
    
    setGridData(newGrid)
  }, []) // No dependencies needed, [])  // No dependencies needed as it uses getState()

  // Track if we're currently syncing to prevent infinite loops
  const isSyncingRef = useRef(false)
  const lastEffectTimeRef = useRef(0)

  // Detect viewport mode changes
  useEffect(() => {
    const prevMode = prevViewportModeRef.current
    const effectId = Math.random().toString(36).substr(2, 9)
    const now = Date.now()
    
    // debugLogger.log('VIEWPORT_EFFECT', `Effect ${effectId} triggered`, {
    //   prevMode,
    //   currentMode: viewportMode,
    //   syncing: isSyncingRef.current,
    //   timeSinceLastEffect: now - lastEffectTimeRef.current
    // })
    
    // CRITICAL: Prevent React StrictMode double effects and rapid triggers
    if (now - lastEffectTimeRef.current < 100) {
      // debugLogger.log('VIEWPORT_EFFECT', `Effect ${effectId} skipped - too soon after last effect (StrictMode protection)`)
      return
    }
    
    // Prevent infinite loops during sync operations
    if (isSyncingRef.current) {
      // debugLogger.log('VIEWPORT_EFFECT', `Effect ${effectId} skipped - already syncing`)
      prevViewportModeRef.current = viewportMode
      return
    }
    
    if (prevMode !== null && prevMode !== viewportMode) {
      // debugLogger.log('VIEWPORT_EFFECT', `Effect ${effectId} mode change: ${prevMode} -> ${viewportMode}`)
      
      // Set syncing flag to prevent loops
      isSyncingRef.current = true
      lastEffectTimeRef.current = now
      
      try {
        // Save current state to localStorage before switching
        useEditorStore.getState().saveToLocalStorage()
        
        if (prevMode === '2d' && viewportMode === '3d') {
          // debugLogger.log('VIEWPORT_EFFECT', `Effect ${effectId} performing 2D -> 3D sync`)
          syncGridToScene()
          isSyncingRef.current = false
          // debugLogger.log('VIEWPORT_EFFECT', `Effect ${effectId} 2D -> 3D sync complete`)
        } else if (prevMode === '3d' && viewportMode === '2d') {
          // debugLogger.log('VIEWPORT_EFFECT', `Effect ${effectId} performing 3D -> 2D sync`)
          sync3DToGrid()
          // Save synced grid data
          useEditorStore.getState().debouncedAutoSave()
          isSyncingRef.current = false
          // debugLogger.log('VIEWPORT_EFFECT', `Effect ${effectId} 3D -> 2D sync complete`)
        } else {
          isSyncingRef.current = false
          // debugLogger.log('VIEWPORT_EFFECT', `Effect ${effectId} no sync needed`)
        }
      } catch (error) {
        isSyncingRef.current = false
        debugLogger.logError('VIEWPORT_EFFECT', `Effect ${effectId} sync failed`, error)
      }
    } else {
      debugLogger.log('VIEWPORT_EFFECT', `Effect ${effectId} no mode change, updating ref`)
    }
    
    prevViewportModeRef.current = viewportMode
  }, [viewportMode]) // Only depend on viewportMode to prevent infinite loops

  return { syncGridToScene, sync3DToGrid }
}

function AppContent() {
  const [isReady, setIsReady] = useState(false)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [fileMenuPosition, setFileMenuPosition] = useState({ x: 0, y: 0 })
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [showSaveIndicator, setShowSaveIndicator] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const lastViewportChangeRef = useRef(0)
  
  // Keyboard shortcuts modal
  const { isOpen: keyboardShortcutsOpen, openModal: openKeyboardShortcuts, closeModal: closeKeyboardShortcuts } = useKeyboardShortcutsModal()

  const { 
    transformMode, 
    setTransformMode, 
    snapToGrid, 
    toggleSnapToGrid,
    gridSize,
    setGridSize,
    coordinateSpace,
    toggleCoordinateSpace,
    viewportMode,
    setViewportMode,
    undo,
    redo,
    canUndo,
    canRedo,
    undoHistory,
    redoHistory,
    loadFromLocalStorage,
    clearLocalStorage,
    clearScene,
    saveToLocalStorage,
    sceneObjects,
    selectedObjects,
    setSelectedObjects,
    clearSelection,
    removeObject,
    duplicateObjects
  } = useEditorStore()

  // Get camera controls ref from context
  const { cameraControlsRef } = useCameraContext()

  // Debounced viewport mode setter
  const debouncedSetViewportMode = useCallback((mode: '2d' | '3d') => {
    const now = Date.now()
    const timeSinceLastChange = now - lastViewportChangeRef.current
    
    debugLogger.log('BUTTON_CLICK', `${mode.toUpperCase()} button clicked`, {
      mode,
      timeSinceLastChange,
      isWithinDebounce: timeSinceLastChange < 500
    })
    
    if (timeSinceLastChange < 500) {
      debugLogger.log('BUTTON_CLICK', 'Ignoring rapid click - within debounce period')
      return
    }
    
    lastViewportChangeRef.current = now
    debugLogger.log('BUTTON_CLICK', `Calling setViewportMode with: ${mode}`)
    setViewportMode(mode)
  }, [setViewportMode])
  
  // Grid view ref
  const gridViewRef = useRef<GridViewRef>(null)
  
  // Initialize viewport synchronization
  useViewportSync()
  
  // Initialize keyboard shortcuts
  useKeyboardShortcuts()
  
  // Initialize resizable panels
  const { panels, handleMouseDown, toggleLeftPanel, toggleRightPanel, getCenterWidth } = useResizablePanels()

  const handleFileMenuClick = (event: React.MouseEvent) => {
    setFileMenuPosition({ x: event.clientX, y: event.clientY + 10 })
    setFileMenuOpen(true)
  }
  
  const handleManualSave = () => {
    saveToLocalStorage()
    setShowSaveIndicator(true)
    setTimeout(() => setShowSaveIndicator(false), 2000)
    setFileMenuOpen(false)
  }

  const handleMenuClick = (menu: string, event: React.MouseEvent) => {
    if (menu === 'File') {
      handleFileMenuClick(event)
      return
    }
    
    setMenuPosition({ x: event.clientX, y: event.clientY + 10 })
    setActiveMenu(menu)
  }

  const closeMenus = () => {
    setActiveMenu(null)
    setFileMenuOpen(false)
  }

  // Menu action handlers
  const handleEditAction = (action: string) => {
    switch (action) {
      case 'undo':
        undo()
        break
      case 'redo':
        redo()
        break
      case 'select-all':
        const allObjectIds = Object.keys(sceneObjects)
        setSelectedObjects(allObjectIds)
        break
      case 'deselect-all':
        clearSelection()
        break
      case 'delete':
        selectedObjects.forEach(id => removeObject(id))
        break
      case 'duplicate':
        duplicateObjects(selectedObjects)
        break
    }
    closeMenus()
  }

  const handleViewAction = (action: string) => {
    switch (action) {
      case 'show-left-panel':
        if (!panels.leftVisible) toggleLeftPanel()
        break
      case 'show-right-panel':
        if (!panels.rightVisible) toggleRightPanel()
        break
      case 'hide-left-panel':
        if (panels.leftVisible) toggleLeftPanel()
        break
      case 'hide-right-panel':
        if (panels.rightVisible) toggleRightPanel()
        break
      case 'toggle-grid':
        // Focus the viewport and toggle grid
        (document.querySelector('.viewport-container') as HTMLElement)?.focus()
        break
      case 'reset-camera':
        cameraControlsRef.current?.resetView()
        break
      case 'focus-selection':
        cameraControlsRef.current?.focusSelection()
        break
      case 'switch-3d':
        debouncedSetViewportMode('3d')
        break
      case 'switch-2d':
        debouncedSetViewportMode('2d')
        break
    }
    closeMenus()
  }

  const handleGenerateAction = (_action: string) => {
    // Focus the Generation Panel
    const generationPanel = document.querySelector('[data-panel="generation"]')
    if (generationPanel) {
      generationPanel.scrollIntoView({ behavior: 'smooth' })
    }
    closeMenus()
  }

  const handleToolsAction = (action: string) => {
    switch (action) {
      case 'transform-select':
        setTransformMode('select')
        break
      case 'transform-move':
        setTransformMode('translate')
        break
      case 'transform-rotate':
        setTransformMode('rotate')
        break
      case 'transform-scale':
        setTransformMode('scale')
        break
      case 'toggle-snap':
        toggleSnapToGrid()
        break
      case 'grid-size':
        // Focus grid size selector in toolbar
        const gridSelect = document.querySelector('select[title="Grid Size"]') as HTMLSelectElement
        gridSelect?.focus()
        break
    }
    closeMenus()
  }

  const handleHelpAction = (action: string) => {
    switch (action) {
      case 'keyboard-shortcuts':
        openKeyboardShortcuts()
        break
      case 'about':
        alert('Morgan-Bevy 3D Level Editor\n\nA hybrid Rust/TypeScript 3D level editor for Bevy game development that combines procedural generation with professional manual editing capabilities.')
        break
    }
    closeMenus()
  }

  useEffect(() => {
    // Check for auto-saved data on startup
    try {
      const saved = localStorage.getItem('morgan-bevy-autosave')
      if (saved) {
        const saveData = JSON.parse(saved)
        const saveDate = new Date(saveData.timestamp)
        const now = new Date()
        const hoursSinceLastSave = (now.getTime() - saveDate.getTime()) / (1000 * 60 * 60)
        
        // Show recovery dialog if there's recent auto-saved data (within 24 hours)
        if (hoursSinceLastSave < 24 && (saveData.gridData?.length > 0 || Object.keys(saveData.sceneObjects || {}).length > 0)) {
          setShowRecoveryDialog(true)
        }
      }
    } catch (error) {
      console.error('Error checking for auto-saved data:', error)
    }
    
    // Auto-save before window closes
    const handleBeforeUnload = () => {
      try {
        saveToLocalStorage()
      } catch (error) {
        console.error('Failed to auto-save before close:', error)
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    // Initialize the editor store and mark as ready
    setIsReady(true)
    
    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [saveToLocalStorage])

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
            className={`hover:text-editor-accent cursor-pointer px-2 py-1 rounded ${activeMenu === 'File' || fileMenuOpen ? 'bg-editor-accent text-white' : ''}`}
            onClick={(e) => handleMenuClick('File', e)}
          >
            File
          </span>
          <span 
            className={`hover:text-editor-accent cursor-pointer px-2 py-1 rounded ${activeMenu === 'Edit' ? 'bg-editor-accent text-white' : ''}`}
            onClick={(e) => handleMenuClick('Edit', e)}
          >
            Edit
          </span>
          <span 
            className={`hover:text-editor-accent cursor-pointer px-2 py-1 rounded ${activeMenu === 'View' ? 'bg-editor-accent text-white' : ''}`}
            onClick={(e) => handleMenuClick('View', e)}
          >
            View
          </span>
          <span 
            className={`hover:text-editor-accent cursor-pointer px-2 py-1 rounded ${activeMenu === 'Generate' ? 'bg-editor-accent text-white' : ''}`}
            onClick={(e) => handleMenuClick('Generate', e)}
          >
            Generate
          </span>
          <span 
            className={`hover:text-editor-accent cursor-pointer px-2 py-1 rounded ${activeMenu === 'Tools' ? 'bg-editor-accent text-white' : ''}`}
            onClick={(e) => handleMenuClick('Tools', e)}
          >
            Tools
          </span>
          <span 
            className={`hover:text-editor-accent cursor-pointer px-2 py-1 rounded ${activeMenu === 'Help' ? 'bg-editor-accent text-white' : ''}`}
            onClick={(e) => handleMenuClick('Help', e)}
          >
            Help
          </span>
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
        <div className="flex space-x-2 items-center">
          {/* Virtual Tab Indicator */}
          <span className="text-xs text-editor-textMuted px-1">Views:</span>
          <button
            className={`px-2 py-1 text-sm rounded transition-colors relative ${
              viewportMode === '3d'
                ? 'bg-editor-accent text-white'
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              debugLogger.log('BUTTON_CLICK', '3D button clicked', {
                currentMode: viewportMode,
                timestamp: Date.now()
              })
              debouncedSetViewportMode('3d')
            }}
            title="3D Viewport (always active)"
          >
            3D
            {/* Always active indicator */}
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full opacity-60"></span>
          </button>
          <button
            className={`px-2 py-1 text-sm rounded transition-colors relative ${
              viewportMode === '2d'
                ? 'bg-editor-accent text-white'
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              debugLogger.log('BUTTON_CLICK', '2D button clicked', {
                currentMode: viewportMode,
                timestamp: Date.now()
              })
              debouncedSetViewportMode('2d')
            }}
            title="2D Grid View (always active)"
          >
            2D
            {/* Always active indicator */}
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full opacity-60"></span>
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
          <button
            className={`px-2 py-1 text-sm rounded transition-colors ${
              coordinateSpace === 'local' 
                ? 'bg-editor-accent text-white' 
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={toggleCoordinateSpace}
            title="Transform Coordinate Space (T)"
          >
            {coordinateSpace === 'world' ? 'World' : 'Local'}
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
        <div className="flex-1"></div>
        
        {/* Save Indicator */}
        {showSaveIndicator && (
          <div className="text-sm text-green-400 mr-4">
            ✓ Work saved locally
          </div>
        )}
        
        <div className="flex space-x-2">
          <button
            className="px-2 py-1 text-sm rounded transition-colors bg-editor-bg text-editor-text hover:bg-gray-600"
            onClick={openKeyboardShortcuts}
            title="Keyboard Shortcuts (?)"
          >
            ?
          </button>
          <button
            className={`px-2 py-1 text-sm rounded transition-colors ${
              panels.leftVisible
                ? 'bg-editor-accent text-white'
                : 'bg-editor-bg text-editor-text hover:bg-gray-600'
            }`}
            onClick={toggleLeftPanel}
            title="Toggle Left Panel"
          >
            <PanelLeft className="w-4 h-4" />
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
            <PanelRight className="w-4 h-4" />
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
                  <AssetBrowser hideHeader={true} />
                </CollapsiblePanel>
                <CollapsiblePanel title="Prefabs" enableScrollbarlessScrolling={true}>
                  <PrefabManager />
                </CollapsiblePanel>
                <CollapsiblePanel title="Layers" enableScrollbarlessScrolling={true}>
                  <Layers hideHeader={true} />
                </CollapsiblePanel>
                <CollapsiblePanel title="Hierarchy" enableScrollbarlessScrolling={true}>
                  <Hierarchy hideHeader={true} />
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

        {/* Center - Virtual Tabbed Viewport (3D and 2D always rendered) */}
        <div 
          className="relative overflow-hidden bg-gray-900" 
          style={{ width: `${getCenterWidth()}px` }}
        >
          {/* 3D Viewport - Always rendered but hidden when in 2D mode */}
          <div 
            className="absolute inset-0 w-full h-full"
            style={{ 
              display: viewportMode === '3d' ? 'block' : 'none',
              zIndex: viewportMode === '3d' ? 1 : 0
            }}
          >
            <Viewport3D ref={cameraControlsRef} />
            
            {/* Camera Controls */}
            <div className="absolute top-4 left-4 bg-editor-panel/90 border border-editor-border rounded p-2 space-y-1">
              <div className="text-xs font-semibold text-editor-accent mb-2 border-b border-editor-border/30 pb-1">Camera</div>
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

          {/* 2D Grid View - Always rendered but hidden when in 3D mode */}
          <div 
            className="absolute inset-0 w-full h-full"
            style={{ 
              display: viewportMode === '2d' ? 'block' : 'none',
              zIndex: viewportMode === '2d' ? 1 : 0
            }}
          >
            <GridView ref={gridViewRef} />
            
            {/* Grid View Controls */}
            <div className="absolute bottom-4 right-4 bg-editor-panel/90 border border-editor-border rounded p-2 space-y-1">
              <div className="text-xs font-semibold text-editor-accent mb-2 border-b border-editor-border/30 pb-1">Grid Tools</div>
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
          </div>
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
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <CollapsiblePanel title="Inspector" enableScrollbarlessScrolling={true}>
                  <Inspector />
                </CollapsiblePanel>
                <CollapsiblePanel title="Export System" maxHeight="350px" enableScrollbarlessScrolling={true}>
                  <ExportPanel />
                </CollapsiblePanel>
                <CollapsiblePanel title="Performance Test" maxHeight="400px" enableScrollbarlessScrolling={true}>
                  <PerformanceTestPanel />
                </CollapsiblePanel>
                <CollapsiblePanel title="Procedural Generation" maxHeight="250px" enableScrollbarlessScrolling={true}>
                  <div data-panel="generation">
                    <GenerationPanel />
                  </div>
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
        onManualSave={handleManualSave}
      />

      {/* Other Menu Dropdowns */}
      {activeMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={closeMenus}
        >
          <div 
            className="absolute bg-editor-panel border border-editor-border rounded shadow-lg min-w-48 z-50"
            style={{ left: menuPosition.x, top: menuPosition.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {activeMenu === 'Edit' && (
              <div className="py-1">
                <button className={`w-full text-left px-4 py-2 text-sm hover:bg-editor-hover ${!canUndo() ? 'text-gray-500' : ''}`} 
                  disabled={!canUndo()} onClick={() => handleEditAction('undo')}>Undo</button>
                <button className={`w-full text-left px-4 py-2 text-sm hover:bg-editor-hover ${!canRedo() ? 'text-gray-500' : ''}`}
                  disabled={!canRedo()} onClick={() => handleEditAction('redo')}>Redo</button>
                <div className="border-t border-editor-border my-1"></div>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" onClick={() => handleEditAction('select-all')}>Select All</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" onClick={() => handleEditAction('deselect-all')}>Deselect All</button>
                <div className="border-t border-editor-border my-1"></div>
                <button className={`w-full text-left px-4 py-2 text-sm hover:bg-editor-hover ${selectedObjects.length === 0 ? 'text-gray-500' : ''}`}
                  disabled={selectedObjects.length === 0} onClick={() => handleEditAction('delete')}>Delete</button>
                <button className={`w-full text-left px-4 py-2 text-sm hover:bg-editor-hover ${selectedObjects.length === 0 ? 'text-gray-500' : ''}`}
                  disabled={selectedObjects.length === 0} onClick={() => handleEditAction('duplicate')}>Duplicate</button>
              </div>
            )}
            
            {activeMenu === 'View' && (
              <div className="py-1">
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" onClick={() => handleViewAction('switch-3d')}>3D Viewport</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" onClick={() => handleViewAction('switch-2d')}>2D Grid View</button>
                <div className="border-t border-editor-border my-1"></div>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" onClick={() => handleViewAction('reset-camera')}>Reset Camera</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" onClick={() => handleViewAction('focus-selection')}>Focus Selection</button>
                <div className="border-t border-editor-border my-1"></div>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" 
                  onClick={() => handleViewAction(panels.leftVisible ? 'hide-left-panel' : 'show-left-panel')}>
                  {panels.leftVisible ? 'Hide' : 'Show'} Left Panel
                </button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" 
                  onClick={() => handleViewAction(panels.rightVisible ? 'hide-right-panel' : 'show-right-panel')}>
                  {panels.rightVisible ? 'Hide' : 'Show'} Right Panel
                </button>
              </div>
            )}
            
            {activeMenu === 'Generate' && (
              <div className="py-1">
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" onClick={() => handleGenerateAction('focus-generation')}>Open Generation Panel</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover text-gray-500" disabled>BSP Algorithm (Coming Soon)</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover text-gray-500" disabled>WFC Algorithm (Coming Soon)</button>
              </div>
            )}
            
            {activeMenu === 'Tools' && (
              <div className="py-1">
                <button className={`w-full text-left px-4 py-2 text-sm hover:bg-editor-hover ${transformMode === 'select' ? 'bg-editor-accent/30' : ''}`} onClick={() => handleToolsAction('transform-select')}>Select Tool</button>
                <button className={`w-full text-left px-4 py-2 text-sm hover:bg-editor-hover ${transformMode === 'translate' ? 'bg-editor-accent/30' : ''}`} onClick={() => handleToolsAction('transform-move')}>Move Tool</button>
                <button className={`w-full text-left px-4 py-2 text-sm hover:bg-editor-hover ${transformMode === 'rotate' ? 'bg-editor-accent/30' : ''}`} onClick={() => handleToolsAction('transform-rotate')}>Rotate Tool</button>
                <button className={`w-full text-left px-4 py-2 text-sm hover:bg-editor-hover ${transformMode === 'scale' ? 'bg-editor-accent/30' : ''}`} onClick={() => handleToolsAction('transform-scale')}>Scale Tool</button>
                <div className="border-t border-editor-border my-1"></div>
                <button className={`w-full text-left px-4 py-2 text-sm hover:bg-editor-hover ${snapToGrid ? 'bg-editor-accent/30' : ''}`} onClick={() => handleToolsAction('toggle-snap')}>Toggle Grid Snap</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" onClick={() => handleToolsAction('grid-size')}>Grid Size Settings</button>
              </div>
            )}
            
            {activeMenu === 'Help' && (
              <div className="py-1">
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" onClick={() => handleHelpAction('keyboard-shortcuts')}>Keyboard Shortcuts</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-editor-hover" onClick={() => handleHelpAction('about')}>About Morgan-Bevy</button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Recovery Dialog */}
      {showRecoveryDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-editor-panel border border-editor-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-editor-text mb-4">Recover Work?</h3>
            <p className="text-editor-textMuted mb-6">
              We found auto-saved work from a previous session. Would you like to recover it?
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => {
                  // Add small delay to prevent accidental clearing during viewport switches
                  setTimeout(() => {
                    clearScene()
                    clearLocalStorage()
                    // Also clear the 2D grid view
                    gridViewRef.current?.clearGrid()
                    setShowRecoveryDialog(false)
                  }, 100)
                }}
                className="px-4 py-2 text-sm bg-editor-bg hover:bg-gray-600 border border-editor-border rounded text-editor-text"
              >
                Start Fresh
              </button>
              <button
                onClick={() => {
                  loadFromLocalStorage()
                  setShowRecoveryDialog(false)
                }}
                className="px-4 py-2 text-sm bg-editor-accent hover:bg-blue-600 text-white rounded"
              >
                Recover Work
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal 
        isOpen={keyboardShortcutsOpen} 
        onClose={closeKeyboardShortcuts}
      />
    </div>
  )
}

function App() {
  return (
    <CameraProvider>
      <AppContent />
    </CameraProvider>
  )
}

export default App