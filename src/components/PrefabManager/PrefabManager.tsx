import { useState, useEffect } from 'react'
import { Package, Trash2, Download, ChevronRight } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { CreateObjectCommand } from '@/utils/commands'

interface Prefab {
  id: string
  name: string
  description?: string
  objects: any[]
  thumbnail?: string
  createdAt: string
}

export default function PrefabManager() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [prefabs, setPrefabs] = useState<Prefab[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [prefabName, setPrefabName] = useState('')
  const [prefabDescription, setPrefabDescription] = useState('')
  
  const { selectedObjects, sceneObjects, executeCommand } = useEditorStore()

  const getSelectedObjectsData = () => {
    return selectedObjects.map(id => sceneObjects[id]).filter(Boolean)
  }

  const savePrefab = () => {
    const selectedObjectsData = getSelectedObjectsData()
    if (selectedObjectsData.length === 0 || !prefabName.trim()) return

    const newPrefab: Prefab = {
      id: `prefab_${Date.now()}`,
      name: prefabName.trim(),
      description: prefabDescription.trim(),
      objects: selectedObjectsData.map(obj => ({
        ...obj,
        // Remove object-specific IDs to make it reusable
        id: undefined,
        parentId: undefined
      })),
      createdAt: new Date().toISOString()
    }

    // Save to localStorage
    const existingPrefabs = JSON.parse(localStorage.getItem('morgan-bevy-prefabs') || '[]')
    const updatedPrefabs = [...existingPrefabs, newPrefab]
    localStorage.setItem('morgan-bevy-prefabs', JSON.stringify(updatedPrefabs))
    
    setPrefabs(updatedPrefabs)
    setShowSaveDialog(false)
    setPrefabName('')
    setPrefabDescription('')
  }

  const loadPrefabs = () => {
    const saved = JSON.parse(localStorage.getItem('morgan-bevy-prefabs') || '[]')
    setPrefabs(saved)
  }

  const instantiatePrefab = (prefab: Prefab) => {
    const spawnOffset = [2, 0, 0] // Offset from origin
    
    prefab.objects.forEach((objTemplate) => {
      const offsetPosition: [number, number, number] = [
        objTemplate.position[0] + spawnOffset[0],
        objTemplate.position[1] + spawnOffset[1],
        objTemplate.position[2] + spawnOffset[2]
      ]

      // Use the store's addObject method which handles command creation internally
      if (objTemplate.meshType) {
        const command = new CreateObjectCommand(objTemplate.meshType, offsetPosition)
        executeCommand(command)
      }
    })
  }

  const deletePrefab = (prefabId: string) => {
    const updatedPrefabs = prefabs.filter(p => p.id !== prefabId)
    localStorage.setItem('morgan-bevy-prefabs', JSON.stringify(updatedPrefabs))
    setPrefabs(updatedPrefabs)
  }

  const exportPrefab = (prefab: Prefab) => {
    const exportData = {
      metadata: {
        version: '1.0.0',
        type: 'morgan-bevy-prefab',
        exportedAt: new Date().toISOString()
      },
      prefab
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${prefab.name}.prefab.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Load prefabs on component mount
  useEffect(() => {
    loadPrefabs()
  }, [])

  if (!isExpanded) {
    return (
      <div className="border-b border-editor-border">
        <div
          className="p-2 bg-editor-panel flex items-center cursor-pointer hover:bg-editor-border"
          onClick={() => setIsExpanded(true)}
        >
          <ChevronRight className="w-3 h-3" />
          <span className="ml-2 text-sm font-medium">Prefabs ({prefabs.length})</span>
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-editor-border">
      {/* Header */}
      <div
        className="p-2 bg-editor-panel flex items-center justify-between cursor-pointer hover:bg-editor-border"
        onClick={() => setIsExpanded(false)}
      >
        <div className="flex items-center">
          <span className="text-xs">▼</span>
          <span className="ml-2 text-sm font-medium">Prefabs ({prefabs.length})</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (selectedObjects.length > 0) {
              setShowSaveDialog(true)
            } else {
              alert('Select objects to create a prefab')
            }
          }}
          className="text-xs hover:text-editor-accent"
          title="Save Selected as Prefab"
          disabled={selectedObjects.length === 0}
        >
          ＋
        </button>
      </div>

      {/* Save Prefab Dialog */}
      {showSaveDialog && (
        <div className="bg-editor-bg p-3 border-b border-editor-border">
          <h3 className="text-sm font-medium mb-2">Save Prefab</h3>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Prefab name..."
              value={prefabName}
              onChange={(e) => setPrefabName(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-editor-panel border border-editor-border rounded focus:outline-none focus:border-editor-accent"
              autoFocus
            />
            <input
              type="text"
              placeholder="Description (optional)..."
              value={prefabDescription}
              onChange={(e) => setPrefabDescription(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-editor-panel border border-editor-border rounded focus:outline-none focus:border-editor-accent"
            />
            <div className="flex space-x-2">
              <button
                onClick={savePrefab}
                className="flex-1 px-2 py-1 text-xs bg-editor-accent text-white rounded hover:bg-blue-600"
                disabled={!prefabName.trim()}
              >
                Save
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 px-2 py-1 text-xs bg-editor-border text-editor-text rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="text-xs text-editor-textMuted mt-1">
            {selectedObjects.length} object{selectedObjects.length !== 1 ? 's' : ''} selected
          </div>
        </div>
      )}

      {/* Prefabs List */}
      <div className="max-h-40 overflow-y-auto custom-scrollbar">
        {prefabs.length === 0 ? (
          <div className="p-3 text-xs text-editor-textMuted text-center">
            No prefabs saved.<br/>
            Select objects and click ＋ to create a prefab.
          </div>
        ) : (
          prefabs.map((prefab) => (
            <div
              key={prefab.id}
              className="p-2 hover:bg-editor-border border-b border-editor-border/50 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 flex-1">
                  <Package className="w-4 h-4 text-editor-accent" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">{prefab.name}</div>
                    {prefab.description && (
                      <div className="text-xs text-editor-textMuted truncate">{prefab.description}</div>
                    )}
                    <div className="text-xs text-editor-textMuted">
                      {prefab.objects.length} object{prefab.objects.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-1">
                  <button
                    onClick={() => instantiatePrefab(prefab)}
                    className="p-1 text-xs hover:text-editor-accent"
                    title="Add to Scene"
                  >
                    📦
                  </button>
                  <button
                    onClick={() => exportPrefab(prefab)}
                    className="p-1 text-xs hover:text-editor-accent"
                    title="Export Prefab"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deletePrefab(prefab.id)}
                    className="p-1 text-xs hover:text-red-400"
                    title="Delete Prefab"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}