import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import {
  Target,
  Image,
  Palette,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  FolderOpen,
  AlertTriangle,
  Loader,
  Folder
} from 'lucide-react'

interface AssetFile {
  id: string
  name: string
  path: string
  asset_type: 'model' | 'texture' | 'material' | 'audio' | 'other'
  size: number
  last_modified: number
}

export default function AssetsPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [currentFolder, setCurrentFolder] = useState<string>('Assets')
  const [assets, setAssets] = useState<AssetFile[]>([])
  const [draggedAsset, setDraggedAsset] = useState<AssetFile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // addObject will be used when implementing scene integration

  const loadLocalAssets = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Check if we're running in Tauri context
      if (typeof window === 'undefined' || !window.__TAURI__) {
        throw new Error('Not running in Tauri context')
      }
      
      // Use Tauri command to scan the local Assets folder
      const scannedAssets: AssetFile[] = await invoke('scan_assets')
      setAssets(scannedAssets)
      setCurrentFolder('Assets')
      console.log(`Found ${scannedAssets.length} assets in local Assets folder`)
      
    } catch (error) {
      console.error('Failed to scan local assets:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setError(`Failed to scan assets: ${errorMessage}`)
      
      // Fallback to mock data for development
      const mockAssets: AssetFile[] = [
        {
          id: 'mock_cube',
          name: 'cube.obj',
          path: 'Assets/Models/cube.obj',
          asset_type: 'model',
          size: 1024,
          last_modified: Date.now()
        },
        {
          id: 'mock_sphere',
          name: 'sphere.obj',
          path: 'Assets/Models/sphere.obj',
          asset_type: 'model',
          size: 2048,
          last_modified: Date.now()
        }
      ]
      setAssets(mockAssets)
      setCurrentFolder('Assets (Mock Data)')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const browseForFolder = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Check if we're running in Tauri context
      if (typeof window === 'undefined' || !window.__TAURI__) {
        throw new Error('Folder browsing only available in Tauri desktop app')
      }
      
      // Use Tauri command to browse for folder
      const folderPath: string = await invoke('browse_assets_folder')
      setCurrentFolder(folderPath)
      
      // Scan the selected folder for assets
      const scannedAssets: AssetFile[] = await invoke('scan_assets_folder', { 
        folderPath 
      })
      
      setAssets(scannedAssets)
      console.log(`Found ${scannedAssets.length} assets in ${folderPath}`)
      
    } catch (error) {
      console.error('Failed to browse folder:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setError(`Browse failed: ${errorMessage}`)
      // Don't change the current state on error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load local assets when component mounts
  useEffect(() => {
    loadLocalAssets()
  }, [])

  const handleDragStart = useCallback((asset: AssetFile, event: React.DragEvent) => {
    setDraggedAsset(asset)
    
    // Store comprehensive asset data for the drop target
    const dragData = {
      id: asset.id,
      name: asset.name,
      path: asset.path,
      type: asset.asset_type,
      size: asset.size,
      // Additional metadata for 3D object creation
      isAsset: true,
      meshPath: asset.path,
      defaultMaterial: 'default'
    }
    
    event.dataTransfer.setData('application/json', JSON.stringify(dragData))
    event.dataTransfer.effectAllowed = 'copy'
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedAsset(null)
  }, [])

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'model': return <Target className="w-4 h-4" />
      case 'texture': return <Image className="w-4 h-4" />
      case 'material': return <Palette className="w-4 h-4" />
      case 'audio': return <Folder className="w-4 h-4" />
      default: return <Folder className="w-4 h-4" />
    }
  }

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  return (
    <div className="flex flex-col bg-editor-panel border-b border-editor-border">
      {/* Header */}
      <div className="px-4 py-2 bg-editor-panel border-b border-editor-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-editor-text hover:text-editor-accent transition-colors"
            title={isCollapsed ? 'Expand Assets' : 'Collapse Assets'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <h3 className="text-sm font-medium text-editor-text">Assets</h3>
        </div>
        <div className="flex space-x-1">
          <button
            onClick={loadLocalAssets}
            className="text-xs px-2 py-1 bg-editor-bg hover:bg-editor-hover rounded text-editor-text flex items-center gap-1"
            title="Reload Local Assets"
            disabled={isLoading}
          >
            <RotateCcw className="w-3 h-3" />
            Local
          </button>
          <button
            onClick={browseForFolder}
            className="text-xs px-2 py-1 bg-editor-bg hover:bg-editor-hover rounded text-editor-text flex items-center gap-1"
            title="Browse for Assets Folder"
            disabled={isLoading}
          >
            <FolderOpen className="w-3 h-3" />
            Browse
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 flex flex-col max-h-64 min-h-32">
          {/* Current Folder Path */}
          <div className="px-4 py-2 bg-editor-bg border-b border-editor-border">
            <div className="text-xs text-editor-textMuted truncate" title={currentFolder}>
              <Folder className="w-4 h-4 inline mr-2" /> {currentFolder}
            </div>
            {error && (
              <div className="text-xs text-red-400 mt-1">
                <AlertTriangle className="w-4 h-4 inline mr-2" /> {error}
              </div>
            )}
            {isLoading && (
              <div className="text-xs text-editor-accent mt-1">
                <Loader className="w-4 h-4 inline mr-2 animate-spin" /> Loading assets...
              </div>
            )}
          </div>

          {/* Assets Grid */}
          <div className="flex-1 p-2 overflow-y-auto custom-scrollbar">
            {assets.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Folder className="w-8 h-8 mb-2" />
                <div className="text-sm text-editor-textMuted mb-3">No assets found</div>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={loadLocalAssets}
                    className="text-xs px-3 py-1 bg-editor-accent hover:bg-blue-600 rounded text-white"
                  >
                    Scan Local Assets
                  </button>
                  <button
                    onClick={browseForFolder}
                    className="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-white"
                  >
                    Browse Other Folder
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={(e) => handleDragStart(asset, e)}
                    onDragEnd={handleDragEnd}
                    className={`
                      p-2 rounded border border-editor-border bg-editor-bg 
                      hover:bg-editor-hover cursor-grab active:cursor-grabbing
                      transition-all duration-150 flex flex-col items-center text-center
                      ${draggedAsset?.id === asset.id ? 'opacity-50 scale-95 border-editor-accent' : 'hover:scale-105'}
                      hover:shadow-lg hover:border-editor-accent/50
                    `}
                    title={`${asset.name}\nSize: ${formatFileSize(asset.size)}\nType: ${asset.asset_type}`}
                  >
                    {/* File Icon */}
                    <div className="text-2xl mb-1">
                      {getFileIcon(asset.asset_type)}
                    </div>
                    
                    {/* File Name */}
                    <div className="text-xs text-editor-text truncate w-full">
                      {asset.name}
                    </div>
                    
                    {/* File Size */}
                    <div className="text-xs text-editor-textMuted">
                      {formatFileSize(asset.size)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Stats */}
          {assets.length > 0 && (
            <div className="px-4 py-2 bg-editor-bg border-t border-editor-border">
              <div className="text-xs text-editor-textMuted">
                {assets.length} asset{assets.length !== 1 ? 's' : ''} • 
                Drag into viewport to add
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}