import React, { useRef, useEffect, useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '@/store/editorStore'

interface GridViewProps {
  className?: string
}

interface TileDefinition {
  tile_type: string
  name: string
  description: string
  visual: {
    icon: string
    color: string
    background_color: string | null
  }
  mesh: any
  collision: boolean
  walkable: boolean
  tags: string[]
}

interface Theme {
  id: string
  name: string
  description: string
  tiles: Record<string, TileDefinition>
  [key: string]: any
}

export interface GridViewRef {
  exportGrid: () => string
  importGrid: (gridString: string) => void
  clearGrid: () => void
  getGridData: () => string[][]  // Add method to get current grid data
}

const GridView = React.forwardRef<GridViewRef, GridViewProps>(({ className = '' }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gridData, setGridData] = useState<string[][]>([])
  const [availableThemes, setAvailableThemes] = useState<Theme[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedTile, setSelectedTile] = useState<string>('floor')
  const [gridSize, setGridSize] = useState({ width: 48, height: 36 })
  const [cellSize, setCellSize] = useState(16)
  const [showGrid, setShowGrid] = useState(true)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = useState<{
    start: { x: number; y: number }
    end: { x: number; y: number }
  } | null>(null)
  const [editMode, setEditMode] = useState<'paint' | 'select' | 'fill'>('paint')
  const [copiedData, setCopiedData] = useState<string[][] | null>(null)
  const [dragMode, setDragMode] = useState<'paint' | 'erase' | null>(null)
  const [lastPaintedPos, setLastPaintedPos] = useState<{ x: number; y: number } | null>(null)

  // Access editor state for view mode and theme
  const { selectedTheme, setSelectedTheme, setGridData: setStoreGridData } = useEditorStore()

  // Sync grid data to store whenever it changes
  useEffect(() => {
    setStoreGridData(gridData)
  }, [gridData, setStoreGridData])

  // Initialize grid and load themes
  useEffect(() => {
    console.log('=== GridView useEffect START ===')
    console.log('GridView useEffect running - initializing grid and loading themes')
    initializeGrid()
    loadThemes()
    console.log('=== GridView useEffect END ===')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Remove gridSize dependency to prevent re-initialization

  // Handle grid size changes
  useEffect(() => {
    setGridData(prev => {
      // If grid is empty or size changed, reinitialize
      if (prev.length !== gridSize.height || (prev[0] && prev[0].length !== gridSize.width)) {
        return Array(gridSize.height)
          .fill(null)
          .map(() => Array(gridSize.width).fill('empty'))
      }
      return prev
    })
  }, [gridSize.width, gridSize.height])

  // Initialize grid and sync with existing 3D scene objects when mounting in 2D mode
  const initializeGrid = useCallback(() => {
    // Try to load from localStorage first (for view switches), then store data, then create empty
    const { gridData: storeGridData, loadFromLocalStorage } = useEditorStore.getState()
    
    // Try loading from localStorage in case we're switching from 3D view
    const wasLoaded = loadFromLocalStorage()
    
    let newGrid: string[][];
    const currentStoreData = useEditorStore.getState().gridData
    
    // Check if we have meaningful data to restore
    if (wasLoaded && currentStoreData && currentStoreData.length > 0) {
      const nonEmptyCount = currentStoreData.flat().filter(t => t && t !== 'empty').length
      if (nonEmptyCount > 0) {
        newGrid = currentStoreData.map(row => [...row]) // Deep copy
      } else {
        newGrid = Array(gridSize.height)
          .fill(null)
          .map(() => Array(gridSize.width).fill('empty'))
      }
    } else if (storeGridData && storeGridData.length > 0 && storeGridData.some(row => row.some(cell => cell && cell !== 'empty'))) {
      newGrid = storeGridData.map(row => [...row]) // Deep copy
    } else {
      newGrid = Array(gridSize.height)
        .fill(null)
        .map(() => Array(gridSize.width).fill('empty'))
    }
    
    setGridData(newGrid)
  }, [gridSize.width, gridSize.height])

  // Load available themes from backend
  const loadThemes = useCallback(async () => {
    console.log('=== loadThemes START ===')
    console.log('loadThemes called, selectedTheme from store:', selectedTheme)
    try {
      console.log('Attempting to invoke get_available_themes')
      const themes: Theme[] = await invoke('get_available_themes')
      console.log('Successfully loaded themes:', themes)
      setAvailableThemes(themes)
      if (themes.length > 0 && !selectedTheme) {
        console.log('Setting first theme as selected:', themes[0])
        setSelectedTheme(themes[0])
      }
    } catch (error) {
      console.log('=== FALLBACK THEME CREATION ===')
      console.error('Failed to load themes, using fallback:', error)
      // Fallback to a basic theme for development
      const fallbackTheme: Theme = {
        id: 'office',
        name: 'Office',
        description: 'Basic office theme',
        tiles: {
          floor: {
            tile_type: 'floor',
            name: 'Floor',
            description: 'Basic floor tile',
            visual: { icon: '.', color: '#888888', background_color: null },
            mesh: null,
            collision: false,
            walkable: true,
            tags: []
          },
          wall: {
            tile_type: 'wall',
            name: 'Wall', 
            description: 'Basic wall tile',
            visual: { icon: '#', color: '#444444', background_color: null },
            mesh: null,
            collision: true,
            walkable: false,
            tags: []
          },
          door: {
            tile_type: 'door',
            name: 'Door',
            description: 'Basic door tile', 
            visual: { icon: 'D', color: '#8B4513', background_color: null },
            mesh: null,
            collision: false,
            walkable: true,
            tags: []
          }
        }
      }
      console.log('Created fallback theme:', fallbackTheme)
      setAvailableThemes([fallbackTheme])
      console.log('Setting fallback theme as selected')
      setSelectedTheme(fallbackTheme)
      
      // Force a re-render by logging the theme state
      setTimeout(() => {
        console.log('After fallback - selectedTheme:', selectedTheme)
        console.log('After fallback - availableThemes:', availableThemes)
      }, 100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Convert mouse position to grid coordinates
  const getGridPosition = (event: MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / cellSize)
    const y = Math.floor((event.clientY - rect.top) / cellSize)
    return { x: Math.max(0, Math.min(x, gridSize.width - 1)), y: Math.max(0, Math.min(y, gridSize.height - 1)) }
  }

  // Paint tile at position (2D grid only - sync happens on view switch)
  const paintTile = (x: number, y: number, tileType: string) => {
    if (x < 0 || x >= gridSize.width || y < 0 || y >= gridSize.height) return
    
    setGridData(prev => {
      const newGrid = [...prev]
      // Ensure the row exists
      if (!newGrid[y]) {
        newGrid[y] = Array(gridSize.width).fill('empty')
      }
      newGrid[y] = [...newGrid[y]]
      newGrid[y][x] = tileType
      return newGrid
    })
  }

  // Fill connected area with same tile type
  const floodFill = (startX: number, startY: number, targetTile: string, replaceTile: string) => {
    if (targetTile === replaceTile) return
    
    const stack = [{ x: startX, y: startY }]
    const visited = new Set<string>()
    
    setGridData(prev => {
      const newGrid = prev.map(row => [...row])
      
      while (stack.length > 0) {
        const { x, y } = stack.pop()!
        const key = `${x},${y}`
        
        if (visited.has(key) || x < 0 || x >= gridSize.width || y < 0 || y >= gridSize.height) continue
        if (newGrid[y][x] !== targetTile) continue
        
        visited.add(key)
        newGrid[y][x] = replaceTile
        
        // Add adjacent cells
        stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 })
      }
      
      return newGrid
    })
  }

  // Mouse event handlers
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pos = getGridPosition(event.nativeEvent, canvas)
    setDragStart(pos)
    setLastPaintedPos(pos) // Track this position to prevent repeated painting

    if (editMode === 'paint') {
      setIsDrawing(true)
      
      // Check if clicking on an existing tile (not empty) - remove it
      const currentTile = gridData[pos.y]?.[pos.x]
      if (currentTile && currentTile !== 'empty') {
        setDragMode('erase')
        paintTile(pos.x, pos.y, 'empty')
      } else {
        setDragMode('paint')
        // Empty tile or null/undefined - paint with selected tile
        paintTile(pos.x, pos.y, selectedTile)
      }
    } else if (editMode === 'select') {
      setSelection({ start: pos, end: pos })
    } else if (editMode === 'fill') {
      if (gridData[pos.y] && gridData[pos.y][pos.x] !== undefined) {
        const targetTile = gridData[pos.y][pos.x] || 'empty'
        floodFill(pos.x, pos.y, targetTile, selectedTile)
      }
    }
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !dragStart) return

    const pos = getGridPosition(event.nativeEvent, canvas)

    if (editMode === 'paint' && isDrawing && dragMode) {
      // Only paint if we've moved to a different position
      if (!lastPaintedPos || pos.x !== lastPaintedPos.x || pos.y !== lastPaintedPos.y) {
        setLastPaintedPos(pos)
        
        // Use consistent drag mode throughout the drag operation
        if (dragMode === 'erase') {
          paintTile(pos.x, pos.y, 'empty')
        } else {
          paintTile(pos.x, pos.y, selectedTile)
        }
      }
    } else if (editMode === 'select') {
      setSelection({ start: dragStart, end: pos })
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
    setDragStart(null)
    setDragMode(null)
    setLastPaintedPos(null) // Reset to prevent interference with next paint operation
  }

  // Keyboard handlers for copy/paste
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!selection) return

    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'c') {
        // Copy selection
        const { start, end } = selection
        const minX = Math.min(start.x, end.x)
        const maxX = Math.max(start.x, end.x)
        const minY = Math.min(start.y, end.y)
        const maxY = Math.max(start.y, end.y)
        
        const copied = []
        for (let y = minY; y <= maxY; y++) {
          const row = []
          for (let x = minX; x <= maxX; x++) {
            row.push(gridData[y]?.[x] || 'empty')
          }
          copied.push(row)
        }
        setCopiedData(copied)
        event.preventDefault()
      } else if (event.key === 'v' && copiedData) {
        // Paste at selection start
        const { start } = selection
        setGridData(prev => {
          const newGrid = prev.map(row => [...row])
          
          copiedData.forEach((row, dy) => {
            row.forEach((tile, dx) => {
              const x = start.x + dx
              const y = start.y + dy
              if (x >= 0 && x < gridSize.width && y >= 0 && y < gridSize.height) {
                newGrid[y][x] = tile
              }
            })
          })
          
          return newGrid
        })
        event.preventDefault()
      }
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      // Delete selection
      const { start, end } = selection
      const minX = Math.min(start.x, end.x)
      const maxX = Math.max(start.x, end.x)
      const minY = Math.min(start.y, end.y)
      const maxY = Math.max(start.y, end.y)
      
      setGridData(prev => {
        const newGrid = prev.map(row => [...row])
        
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            if (newGrid[y]) {
              newGrid[y][x] = 'empty'
            }
          }
        }
        
        return newGrid
      })
      event.preventDefault()
    }
  }, [selection, gridData, copiedData, gridSize])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Render the grid
  const renderGrid = useCallback(() => {
    console.log('=== RENDER GRID CALLED ===')
    console.log('renderGrid - selectedTheme:', selectedTheme)
    console.log('renderGrid - availableThemes length:', availableThemes.length)
    
    const canvas = canvasRef.current
    if (!canvas || !selectedTheme) {
      console.log('renderGrid - Early return: canvas exists?', !!canvas, 'selectedTheme exists?', !!selectedTheme)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = gridSize.width * cellSize
    canvas.height = gridSize.height * cellSize

    // Clear canvas
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw tiles
    for (let y = 0; y < gridSize.height; y++) {
      for (let x = 0; x < gridSize.width; x++) {
        const tileType = gridData[y]?.[x] || 'empty'
        const tileDef = selectedTheme.tiles[tileType]
        
        if (tileDef && tileType !== 'empty') {
          // Background color
          if (tileDef.visual.background_color) {
            ctx.fillStyle = tileDef.visual.background_color
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
          }
          
          // Draw tile icon
          ctx.fillStyle = tileDef.visual.color
          ctx.font = `${Math.floor(cellSize * 0.8)}px monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(
            tileDef.visual.icon,
            x * cellSize + cellSize / 2,
            y * cellSize + cellSize / 2
          )
        }
      }
    }

    // Draw grid lines
    if (showGrid) {
      ctx.strokeStyle = '#404040'
      ctx.lineWidth = 1
      
      for (let x = 0; x <= gridSize.width; x++) {
        ctx.beginPath()
        ctx.moveTo(x * cellSize, 0)
        ctx.lineTo(x * cellSize, canvas.height)
        ctx.stroke()
      }
      
      for (let y = 0; y <= gridSize.height; y++) {
        ctx.beginPath()
        ctx.moveTo(0, y * cellSize)
        ctx.lineTo(canvas.width, y * cellSize)
        ctx.stroke()
      }
    }

    // Draw selection
    if (selection) {
      const { start, end } = selection
      const minX = Math.min(start.x, end.x) * cellSize
      const maxX = (Math.max(start.x, end.x) + 1) * cellSize
      const minY = Math.min(start.y, end.y) * cellSize
      const maxY = (Math.max(start.y, end.y) + 1) * cellSize
      
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)
      ctx.setLineDash([])
    }
  }, [gridData, selectedTheme, gridSize, cellSize, showGrid, selection])

  useEffect(() => {
    renderGrid()
  }, [renderGrid])

  // Expose methods via ref
  React.useImperativeHandle(ref, () => ({
    exportGrid: () => {
      if (!selectedTheme) return ''
      return gridData.map(row => 
        row.map(tileType => selectedTheme.tiles[tileType]?.visual.icon || ' ').join('')
      ).join('\n')
    },
    importGrid: async (gridString: string) => {
      if (!selectedTheme) return
      try {
        const tileMap: string[][] = await invoke('parse_grid_to_tiles', {
          themeId: selectedTheme.id,
          gridString
        })
        setGridData(tileMap)
      } catch (error) {
        console.error('Failed to import grid:', error)
      }
    },
    clearGrid: () => {
      console.log('=== CLEAR GRID CALLED ===')
      console.log('Before clear - selectedTheme:', selectedTheme)
      console.log('Before clear - availableThemes:', availableThemes)
      
      // Create a completely fresh empty grid
      const newGrid = Array(gridSize.height)
        .fill(null)
        .map(() => Array(gridSize.width).fill('empty'))
      setGridData(newGrid)
      setSelection(null)
      // Also clear the store
      setStoreGridData(newGrid)
      
      console.log('After clear - selectedTheme:', selectedTheme)
      console.log('After clear - availableThemes:', availableThemes)
      console.log('=== CLEAR GRID COMPLETE ===')
    },
    getGridData: () => gridData  // Expose current grid data
  }))

  const getTileList = () => {
    if (!selectedTheme) return []
    return Object.entries(selectedTheme.tiles).filter(([key]) => key !== 'empty')
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="bg-editor-panel border-b border-editor-border p-2 flex items-center space-x-4 text-sm">
        {/* Theme Selection */}
        <div className="flex items-center space-x-2">
          <label className="text-editor-textMuted">Theme:</label>
          <select
            value={selectedTheme?.id || ''}
            onChange={(e) => {
              const theme = availableThemes.find(t => t.id === e.target.value)
              setSelectedTheme(theme || null)
            }}
            className="bg-editor-bg text-editor-text border border-editor-border rounded px-2 py-1"
          >
            {availableThemes.map(theme => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>

        {/* Edit Mode */}
        <div className="flex items-center space-x-2">
          <label className="text-editor-textMuted">Mode:</label>
          {['paint', 'select', 'fill'].map(mode => (
            <button
              key={mode}
              onClick={() => setEditMode(mode as any)}
              className={`px-2 py-1 rounded text-xs ${
                editMode === mode
                  ? 'bg-editor-accent text-white'
                  : 'bg-editor-bg text-editor-text hover:bg-gray-600'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Grid Settings */}
        <div className="flex items-center space-x-2">
          <label className="text-editor-textMuted">Cell Size:</label>
          <input
            type="range"
            min="12"
            max="32"
            value={cellSize}
            onChange={(e) => setCellSize(Number(e.target.value))}
            className="w-16"
          />
          <span className="text-editor-textMuted w-8">{cellSize}</span>
        </div>

        {/* Grid Toggle */}
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`px-2 py-1 rounded text-xs ${
            showGrid
              ? 'bg-editor-accent text-white'
              : 'bg-editor-bg text-editor-text hover:bg-gray-600'
          }`}
        >
          Grid
        </button>

        {/* Size Settings */}
        <div className="flex items-center space-x-2">
          <label className="text-editor-textMuted">Size:</label>
          <input
            type="number"
            value={gridSize.width}
            onChange={(e) => setGridSize(prev => ({ ...prev, width: Number(e.target.value) }))}
            className="bg-editor-bg text-editor-text border border-editor-border rounded px-2 py-1 w-16 text-xs"
            min="10"
            max="100"
          />
          <span className="text-editor-textMuted">×</span>
          <input
            type="number"
            value={gridSize.height}
            onChange={(e) => setGridSize(prev => ({ ...prev, height: Number(e.target.value) }))}
            className="bg-editor-bg text-editor-text border border-editor-border rounded px-2 py-1 w-16 text-xs"
            min="10"
            max="100"
          />
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tile Palette */}
        <div className="w-48 bg-editor-panel border-r border-editor-border p-2 overflow-y-auto">
          <div className="text-sm font-semibold text-editor-accent mb-2 border-b border-editor-border/30 pb-1">Tile Palette</div>
          <div className="space-y-1">
            {!selectedTheme ? (
              <div className="text-xs text-editor-textMuted">Loading themes... (selectedTheme is null)</div>
            ) : getTileList().length === 0 ? (
              <div className="text-xs text-editor-textMuted">No tiles available</div>
            ) : (
              getTileList().map(([tileKey, tileDef]) => {
                const tile = tileDef as TileDefinition
                console.log('Rendering tile button:', tileKey, tile)
                return (
                <button
                  key={tileKey}
                  onClick={() => setSelectedTile(tileKey)}
                  className={`w-full text-left px-2 py-1 rounded text-xs flex items-center space-x-2 ${
                    selectedTile === tileKey
                      ? 'bg-editor-accent text-white'
                      : 'bg-editor-bg text-editor-text hover:bg-gray-600'
                  }`}
                  title={tile.description}
                >
                  <span 
                    className="w-4 h-4 flex items-center justify-center font-mono text-xs"
                    style={{ color: tile.visual.color, backgroundColor: tile.visual.background_color || 'transparent' }}
                  >
                    {tile.visual.icon}
                  </span>
                  <span className="truncate">{tile.name}</span>
                </button>
                )
              })
            )}
          </div>
        </div>

        {/* Grid Canvas */}
        <div className="flex-1 overflow-auto bg-gray-900 relative">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="border border-editor-border cursor-crosshair"
            style={{ imageRendering: 'pixelated' }}
          />
          
          {/* Instructions Overlay */}
          {selection && (
            <div className="absolute top-2 left-2 bg-editor-panel/90 border border-editor-border rounded p-2 text-xs text-editor-text">
              <div>Selection: {Math.abs(selection.end.x - selection.start.x) + 1}×{Math.abs(selection.end.y - selection.start.y) + 1}</div>
              <div>Ctrl+C: Copy | Ctrl+V: Paste | Del: Clear</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

GridView.displayName = 'GridView'

export default GridView