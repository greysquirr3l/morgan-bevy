import { useState } from 'react'
import { Save, FolderOpen, FileText, Download } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { SaveCommand, LoadCommand } from '@/utils/commands'
import { invoke } from '@tauri-apps/api/tauri'

interface FileMenuProps {
  isOpen: boolean
  onClose: () => void
  position: { x: number; y: number }
  onManualSave?: () => void
}

export default function FileMenu({ isOpen, onClose, position, onManualSave }: FileMenuProps) {
  const { executeCommand, sceneObjects, layers } = useEditorStore()
  const [isExporting, setIsExporting] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

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

  const saveProject = async () => {
    try {
      const projectData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        scene: {
          objects: sceneObjects,
          camera: { position: [10, 10, 10], target: [0, 0, 0] },
          lighting: { ambient: 0.4, directional: 0.6 }
        }
      }
      
      await invoke('save_project', { projectData })
      console.log('Project saved successfully')
      onClose()
    } catch (error) {
      console.error('Save failed:', error)
      alert(`Save failed: ${error}`)
    }
  }

  const openProject = async () => {
    try {
      const projectData = await invoke('load_project')
      console.log('Project loaded successfully:', projectData)
      // TODO: Apply loaded project data to store
      onClose()
    } catch (error) {
      console.error('Load failed:', error)
      alert(`Load failed: ${error}`)
    }
  }

  const exportLevel = () => {
    setShowExportModal(true)
  }

  const handleLevelExport = async (format: 'json' | 'ron' | 'rust') => {
    try {
      // Create level data structure
      const levelData = {
        id: `level_${Date.now()}`,
        name: 'Morgan-Bevy Level',
        objects: Object.values(sceneObjects).map(obj => ({
          id: obj.id,
          name: obj.name,
          transform: {
            position: obj.position,
            rotation: obj.rotation,
            scale: obj.scale
          },
          material: obj.material || {
            baseColor: '#ffffff',
            metallic: 0.0,
            roughness: 0.5
          },
          mesh: obj.meshType || 'cube',
          layer: obj.layerId,
          tags: obj.tags || [],
          metadata: {
            visible: obj.visible,
            locked: obj.locked,
            collision: obj.collision,
            walkable: obj.walkable
          }
        })),
        layers: ['default', 'walls', 'floors', 'doors'],
        bounds: {
          min: [-50, -50, -50],
          max: [50, 50, 50]
        }
      }
      
      // Export via Tauri command
      await invoke('export_level_simple', {
        levelData,
        format,
        outputPath: null // Let user choose
      })
      
      setShowExportModal(false)
      onClose()
      console.log(`Exported level as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export failed:', error)
      alert(`Export failed: ${error}`)
    }
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
        
        {/* Auto-Save to Local Storage */}
        {onManualSave && (
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
            onClick={onManualSave}
          >
            <Save className="w-4 h-4 text-blue-400" />
            <span>Save Work Locally</span>
            <span className="ml-auto text-xs text-editor-textMuted">Auto-restore</span>
          </button>
        )}
        
        {/* Separator */}
        <div className="border-t border-editor-border my-1" />
        
        {/* Project Operations */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={saveProject}
        >
          <Save className="w-4 h-4" />
          <span>Save Project</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+Shift+S</span>
        </button>
        
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={openProject}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Open Project...</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+Shift+O</span>
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
        
        {/* Export Level */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={exportLevel}
        >
          <Download className="w-4 h-4" />
          <span>Export Level...</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+Shift+E</span>
        </button>
        
        {/* Scene Info */}
        <div className="border-t border-editor-border my-1" />
        <div className="px-3 py-2 text-xs text-editor-textMuted">
          <div>Objects: {Object.keys(sceneObjects).length}</div>
          <div>Layers: {layers.length}</div>
        </div>
      </div>
      
      {/* Export Level Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-editor-panel border border-editor-border rounded-lg p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">Export Level</h2>
            
            <div className="space-y-3 mb-6">
              <button
                className="w-full flex items-center justify-between p-3 bg-editor-bg hover:bg-editor-hover rounded text-left"
                onClick={() => handleLevelExport('json')}
              >
                <div>
                  <div className="font-medium">JSON Export</div>
                  <div className="text-sm text-editor-textMuted">Universal format for web and tools</div>
                </div>
                <Download className="w-5 h-5" />
              </button>
              
              <button
                className="w-full flex items-center justify-between p-3 bg-editor-bg hover:bg-editor-hover rounded text-left"
                onClick={() => handleLevelExport('ron')}
              >
                <div>
                  <div className="font-medium">RON Export</div>
                  <div className="text-sm text-editor-textMuted">Native Bevy format</div>
                </div>
                <Download className="w-5 h-5" />
              </button>
              
              <button
                className="w-full flex items-center justify-between p-3 bg-editor-bg hover:bg-editor-hover rounded text-left"
                onClick={() => handleLevelExport('rust')}
              >
                <div>
                  <div className="font-medium">Rust Code</div>
                  <div className="text-sm text-editor-textMuted">Direct import code generation</div>
                </div>
                <Download className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex space-x-2">
              <button
                className="flex-1 px-4 py-2 bg-editor-bg hover:bg-editor-hover rounded"
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}