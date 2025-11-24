// Layer management component for scene organization
import React, { useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { Eye, EyeOff, Lock, Unlock, X, ChevronRight, ChevronDown } from 'lucide-react'

export default function Layers() {
  const { layers, activeLayer, sceneObjects, setSelectedObjects } = useEditorStore()
  const [isExpanded, setIsExpanded] = useState(true)
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)

  const toggleLayerVisibility = (layerId: string) => {
    useEditorStore.setState((state) => {
      const layer = state.layers.find(l => l.id === layerId)
      if (layer) {
        layer.visible = !layer.visible
      }
    })
  }

  const toggleLayerLock = (layerId: string) => {
    useEditorStore.setState((state) => {
      const layer = state.layers.find(l => l.id === layerId)
      if (layer) {
        layer.locked = !layer.locked
      }
    })
  }

  const selectLayerObjects = (layerId: string) => {
    const layerObjectIds = Object.values(sceneObjects)
      .filter(obj => obj.layerId === layerId)
      .map(obj => obj.id)
    setSelectedObjects(layerObjectIds)
  }

  const setActiveLayer = (layerId: string) => {
    useEditorStore.setState((state) => {
      state.activeLayer = layerId
    })
  }

  const renameLayer = (layerId: string, newName: string) => {
    useEditorStore.setState((state) => {
      const layer = state.layers.find(l => l.id === layerId)
      if (layer) {
        layer.name = newName
      }
    })
    setEditingLayerId(null)
  }

  const addLayer = () => {
    const newLayerId = `layer_${Date.now()}`
    useEditorStore.setState((state) => {
      state.layers.push({
        id: newLayerId,
        name: 'New Layer',
        visible: true,
        locked: false,
        color: '#ffffff'
      })
    })
    setEditingLayerId(newLayerId)
  }

  const deleteLayer = (layerId: string) => {
    // Can't delete if it's the only layer or default layer
    if (layers.length <= 1 || layerId === 'default') return

    // Move objects to default layer
    useEditorStore.setState((state) => {
      Object.values(state.sceneObjects).forEach(obj => {
        if (obj.layerId === layerId) {
          obj.layerId = 'default'
        }
      })
      // Remove the layer
      state.layers = state.layers.filter(l => l.id !== layerId)
      // Set active layer to default if we deleted the active layer
      if (state.activeLayer === layerId) {
        state.activeLayer = 'default'
      }
    })
  }

  const getLayerObjectCount = (layerId: string): number => {
    return Object.values(sceneObjects).filter(obj => obj.layerId === layerId).length
  }

  if (!isExpanded) {
    return (
      <div className="border-b border-editor-border">
        <div
          className="p-2 bg-editor-panel flex items-center cursor-pointer hover:bg-editor-border"
          onClick={() => setIsExpanded(true)}
        >
          <ChevronRight className="w-3 h-3" />
          <span className="ml-2 text-sm font-medium">Layers ({layers.length})</span>
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
          <span className="ml-2 text-sm font-medium">Layers ({layers.length})</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            addLayer()
          }}
          className="text-xs hover:text-editor-accent"
          title="Add Layer"
        >
          ＋
        </button>
      </div>

      {/* Layers List */}
      <div className="max-h-32 overflow-y-auto custom-scrollbar">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`flex items-center px-2 py-1 text-xs hover:bg-editor-border ${
              activeLayer === layer.id ? 'bg-editor-accent/20 border-l-2 border-editor-accent' : ''
            }`}
          >
            {/* Color indicator */}
            <div
              className="w-2 h-2 rounded-full mr-2 border border-editor-border"
              style={{ backgroundColor: layer.color }}
            />

            {/* Visibility toggle */}
            <button
              onClick={() => toggleLayerVisibility(layer.id)}
              className={`text-xs w-4 text-center ${
                layer.visible ? 'text-white' : 'text-editor-textMuted'
              }`}
              title={layer.visible ? 'Hide layer' : 'Show layer'}
            >
              {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>

            {/* Lock toggle */}
            <button
              onClick={() => toggleLayerLock(layer.id)}
              className={`text-xs w-4 text-center ml-1 ${
                layer.locked ? 'text-yellow-400' : 'text-editor-textMuted'
              }`}
              title={layer.locked ? 'Unlock layer' : 'Lock layer'}
            >
              {layer.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>

            {/* Layer name */}
            <div className="flex-1 ml-2">
              {editingLayerId === layer.id ? (
                <input
                  type="text"
                  defaultValue={layer.name}
                  className="w-full bg-editor-bg border border-editor-border rounded px-1 py-0 text-xs"
                  autoFocus
                  onBlur={(e) => renameLayer(layer.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameLayer(layer.id, e.currentTarget.value)
                    } else if (e.key === 'Escape') {
                      setEditingLayerId(null)
                    }
                  }}
                />
              ) : (
                <div
                  className="cursor-pointer truncate"
                  onClick={() => setActiveLayer(layer.id)}
                  onDoubleClick={() => setEditingLayerId(layer.id)}
                  title={`${layer.name} (${getLayerObjectCount(layer.id)} objects)`}
                >
                  {layer.name}
                </div>
              )}
            </div>

            {/* Object count */}
            <span
              className="text-editor-textMuted text-xs ml-2 cursor-pointer"
              onClick={() => selectLayerObjects(layer.id)}
              title="Select all objects in layer"
            >
              {getLayerObjectCount(layer.id)}
            </span>

            {/* Delete button (only for non-default layers) */}
            {layer.id !== 'default' && (
              <button
                onClick={() => deleteLayer(layer.id)}
                className="text-editor-textMuted hover:text-red-400 text-xs ml-1"
                title="Delete layer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}