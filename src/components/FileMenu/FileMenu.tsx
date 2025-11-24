import { useState } from 'react'
import { Save, FolderOpen, FileText, Download } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { SaveCommand, LoadCommand } from '@/utils/commands'

interface FileMenuProps {
  isOpen: boolean
  onClose: () => void
  position: { x: number; y: number }
}

export default function FileMenu({ isOpen, onClose, position }: FileMenuProps) {
  const { executeCommand, sceneObjects, layers } = useEditorStore()
  const [isExporting, setIsExporting] = useState(false)

  if (!isOpen) return null

  const handleNewScene = () => {
    if (Object.keys(sceneObjects).length > 0) {
      const confirmClear = window.confirm('Are you sure? This will clear the current scene.')
      if (!confirmClear) return
    }
    
    // Clear scene and reset to default
    useEditorStore.setState({
      sceneObjects: {},
      selectedObjects: [],
      undoHistory: [],
      redoHistory: [],
      activeLayer: 'default'
    })
    onClose()
  }

  const handleSave = () => {
    const command = new SaveCommand()
    executeCommand(command)
    onClose()
  }

  const handleLoad = () => {
    // Create file input element
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.morgan'
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string
            const data = JSON.parse(content)
            const command = new LoadCommand(data)
            executeCommand(command)
          } catch (error) {
            alert('Error loading file: Invalid format')
            console.error('Load error:', error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
    onClose()
  }

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      // Create comprehensive export data
      const exportData = {
        metadata: {
          version: '1.0.0',
          editor: 'Morgan-Bevy',
          exportedAt: new Date().toISOString(),
          objectCount: Object.keys(sceneObjects).length,
          layerCount: layers.length
        },
        scene: {
          objects: sceneObjects,
          layers: layers,
          settings: {
            gridSize: useEditorStore.getState().gridSize,
            snapToGrid: useEditorStore.getState().snapToGrid
          }
        },
        // Bevy-compatible format
        bevy: {
          entities: Object.values(sceneObjects).map(obj => ({
            name: obj.name,
            components: {
              Transform: {
                translation: obj.position,
                rotation: obj.rotation,
                scale: obj.scale
              },
              Visibility: {
                is_visible: obj.visible
              },
              MeshType: obj.meshType || 'cube'
            },
            layer: layers.find(l => l.id === obj.layerId)?.name || 'Default'
          }))
        }
      }

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `morgan-scene-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      
    } catch (error) {
      alert('Error exporting scene')
      console.error('Export error:', error)
    } finally {
      setIsExporting(false)
    }
    
    onClose()
  }

  return (
    <>
      {/* Backdrop to close menu */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* File Menu */}
      <div 
        className="fixed bg-editor-panel border border-editor-border rounded-md shadow-lg py-1 z-50 min-w-48"
        style={{ 
          left: position.x, 
          top: position.y,
          maxHeight: '400px',
          overflowY: 'auto'
        }}
      >
        {/* New Scene */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={handleNewScene}
        >
          <FileText className="w-4 h-4" />
          <span>New Scene</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+N</span>
        </button>
        
        {/* Separator */}
        <div className="border-t border-editor-border my-1" />
        
        {/* Load Scene */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={handleLoad}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Open Scene...</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+O</span>
        </button>
        
        {/* Save Scene */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={handleSave}
        >
          <Save className="w-4 h-4" />
          <span>Save Scene</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+S</span>
        </button>
        
        {/* Separator */}
        <div className="border-t border-editor-border my-1" />
        
        {/* Export Scene */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
          <span>{isExporting ? 'Exporting...' : 'Export Scene...'}</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+E</span>
        </button>
        
        {/* Scene Info */}
        <div className="border-t border-editor-border my-1" />
        <div className="px-3 py-2 text-xs text-editor-textMuted">
          <div>Objects: {Object.keys(sceneObjects).length}</div>
          <div>Layers: {layers.length}</div>
        </div>
      </div>
    </>
  )
}