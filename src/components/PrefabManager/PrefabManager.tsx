import { useEditorStore } from '@/store/editorStore'
import type { PrefabId } from '@/types/brand'
import { CreateObjectCommand } from '@/utils/commands'
import {
  applyBreakPrefab,
  buildPrefabFromSelection,
  deletePrefabById as deletePrefabFromStorage,
  instantiatePrefabObjects,
  loadPrefabs,
  savePrefab as persistPrefab,
  type Prefab,
} from '@/utils/prefabs'
import { ChevronRight, Download, Package, Trash2, Unlink } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function PrefabManager() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [prefabs, setPrefabs] = useState<Prefab[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [prefabName, setPrefabName] = useState('')
  const [prefabDescription, setPrefabDescription] = useState('')

  const { selectedObjects, sceneObjects, executeCommand } = useEditorStore()

  // T19: replace inline localStorage reads / writes with the
  // typed helpers from src/utils/prefabs.ts. The helpers tolerate
  // corrupt JSON and schema drift (cf. the vitest coverage).
  const savePrefab = () => {
    if (!prefabName.trim()) return
    const built = buildPrefabFromSelection(
      selectedObjects,
      sceneObjects,
      prefabName,
      prefabDescription || undefined
    )
    if (!built) return
    const next = persistPrefab(built)
    setPrefabs(next)
    setShowSaveDialog(false)
    setPrefabName('')
    setPrefabDescription('')
  }

  const loadStoredPrefabs = () => {
    setPrefabs(loadPrefabs())
  }

  // T19: instantiate via the typed helper, which clears ids and
  // tags every spawned object with `prefabInstanceId` so future
  // edits to the source prefab can propagate.
  const instantiatePrefab = (prefab: Prefab) => {
    const spawnOffset: [number, number, number] = [2, 0, 0]
    const instantiated = instantiatePrefabObjects(prefab, spawnOffset)
    for (const objTemplate of instantiated) {
      if (objTemplate.meshType) {
        const command = new CreateObjectCommand(objTemplate.meshType, objTemplate.position)
        executeCommand(command)
      }
    }
  }

  const deletePrefab = (prefabId: PrefabId) => {
    const next = deletePrefabFromStorage(prefabId)
    setPrefabs(next)
  }

  // T19: sever the prefab link on every selected object so future
  // edits to the source prefab stop propagating. Falls through to
  // the typed helper to mutate the scene map.
  const breakPrefabOnSelection = () => {
    const scene = useEditorStore.getState().sceneObjects
    const ids = selectedObjects.filter(id => scene.get(id)?.prefabInstanceId !== undefined)
    if (ids.length === 0) return
    const next = applyBreakPrefab(scene, ids)
    useEditorStore.setState({ sceneObjects: next })
  }

  const exportPrefab = (prefab: Prefab) => {
    const exportData = {
      metadata: {
        version: '1.0.0',
        type: 'morgan-bevy-prefab',
        exportedAt: new Date().toISOString(),
      },
      prefab,
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
    loadStoredPrefabs()
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
        <div className="flex items-center gap-1">
          {/* T19: Break Prefab — sever the prefab link on every selected object. */}
          <button
            onClick={e => {
              e.stopPropagation()
              breakPrefabOnSelection()
            }}
            className="text-xs hover:text-editor-accent px-1"
            title="Break Prefab on selected objects (sever the link to the source prefab)"
            disabled={selectedObjects.length === 0}
          >
            <Unlink className="w-3 h-3" />
          </button>
          <button
            onClick={e => {
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
              onChange={e => setPrefabName(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-editor-panel border border-editor-border rounded focus:outline-none focus:border-editor-accent"
              autoFocus
            />
            <input
              type="text"
              placeholder="Description (optional)..."
              value={prefabDescription}
              onChange={e => setPrefabDescription(e.target.value)}
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
            No prefabs saved.
            <br />
            Select objects and click ＋ to create a prefab.
          </div>
        ) : (
          prefabs.map(prefab => (
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
                      <div className="text-xs text-editor-textMuted truncate">
                        {prefab.description}
                      </div>
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
