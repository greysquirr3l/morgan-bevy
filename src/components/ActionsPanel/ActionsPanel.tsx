import React from 'react'
import { useEditorStore } from '@/store/editorStore'
import { Plus, Save, FolderOpen, Download, Triangle } from 'lucide-react'

export default function ActionsPanel() {
  const { 
    selectedObjects, 
    addObject, 
    removeObject, 
    duplicateObjects 
  } = useEditorStore()

  const createPrimitive = (type: 'cube' | 'sphere' | 'pyramid') => {
    addObject(type, [0, 0, 0]) // Create at origin
  }

  const duplicateSelected = () => {
    if (selectedObjects.length > 0) {
      duplicateObjects(selectedObjects)
    }
  }

  const deleteSelected = () => {
    if (selectedObjects.length > 0) {
      selectedObjects.forEach(id => removeObject(id))
    }
  }

  const exportLevel = () => {
    console.log('Export level dialog')
    // TODO: Open export dialog
  }

  const saveProject = () => {
    console.log('Save project')
    // TODO: Save current project
  }

  const openProject = () => {
    console.log('Open project dialog')
    // TODO: Open file dialog
  }

  return (
    <div className="actions-panel bg-editor-panel border-b border-editor-border p-3">
      <div className="space-y-4">
        {/* Primitive Creation */}
        <div>
          <h3 className="text-sm font-medium text-editor-text mb-2">Create Objects</h3>
          <div className="grid grid-cols-3 gap-2">
            <button 
              className="flex flex-col items-center p-2 bg-editor-bg hover:bg-editor-hover rounded text-xs"
              onClick={() => createPrimitive('cube')}
              title="Create Cube"
            >
              <span className="text-2xl mb-1">⬜</span>
              <span>Cube</span>
            </button>
            <button 
              className="flex flex-col items-center p-2 bg-editor-bg hover:bg-editor-hover rounded text-xs"
              onClick={() => createPrimitive('sphere')}
              title="Create Sphere"
            >
              <span className="text-2xl mb-1">⭕</span>
              <span>Sphere</span>
            </button>
            <button 
              className="flex flex-col items-center p-2 bg-editor-bg hover:bg-editor-hover rounded text-xs"
              onClick={() => createPrimitive('pyramid')}
              title="Create Pyramid"
            >
              <Triangle className="w-8 h-8 mb-1 text-editor-accent" />
              <span>Pyramid</span>
            </button>
          </div>
        </div>

        {/* Object Actions */}
        <div>
          <h3 className="text-sm font-medium text-editor-text mb-2">
            Object Actions 
            {selectedObjects.length > 0 && (
              <span className="text-editor-accent">({selectedObjects.length} selected)</span>
            )}
          </h3>
          <div className="space-y-2">
            <button 
              className="w-full flex items-center justify-center p-2 bg-editor-accent hover:bg-blue-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={duplicateSelected}
              disabled={selectedObjects.length === 0}
              title="Duplicate Selected (Ctrl+D)"
            >
              <Plus className="w-4 h-4 mr-2" />
              Duplicate
            </button>
            <button 
              className="w-full flex items-center justify-center p-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={deleteSelected}
              disabled={selectedObjects.length === 0}
              title="Delete Selected (Del)"
            >
              Delete
            </button>
          </div>
        </div>

        {/* File Operations */}
        <div>
          <h3 className="text-sm font-medium text-editor-text mb-2">Project</h3>
          <div className="space-y-2">
            <button 
              className="w-full flex items-center justify-center p-2 bg-editor-bg hover:bg-editor-hover text-editor-text rounded text-sm"
              onClick={saveProject}
              title="Save Project (Ctrl+S)"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </button>
            <button 
              className="w-full flex items-center justify-center p-2 bg-editor-bg hover:bg-editor-hover text-editor-text rounded text-sm"
              onClick={openProject}
              title="Open Project (Ctrl+O)"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Open
            </button>
            <button 
              className="w-full flex items-center justify-center p-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
              onClick={exportLevel}
              title="Export Level"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}