import { useEditorStore } from '@/store/editorStore'
import { Plus, Triangle } from 'lucide-react'
import { DeleteObjectCommand, DuplicateCommand } from '@/utils/commands'

export default function ActionsPanel() {
  const { 
    selectedObjects, 
    addObject, 
    executeCommand
  } = useEditorStore()

  const createPrimitive = (type: 'cube' | 'sphere' | 'pyramid') => {
    addObject(type, [0, 0, 0]) // Create at origin
  }

  const duplicateSelected = () => {
    if (selectedObjects.length > 0) {
      const command = new DuplicateCommand(selectedObjects)
      command.execute()
      executeCommand(command)
    }
  }

  const deleteSelected = () => {
    if (selectedObjects.length > 0) {
      selectedObjects.forEach((id: string) => {
        const command = new DeleteObjectCommand(id)
        command.execute()
        executeCommand(command)
      })
    }
  }

  return (
    <div className="actions-panel bg-editor-panel border-b border-editor-border p-3">
      <div className="space-y-4">
        {/* Primitive Creation */}
        <div>
          <h3 className="text-sm font-semibold text-editor-accent mb-2 border-b border-editor-border/30 pb-1">Create Objects</h3>
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
          <h3 className="text-sm font-semibold text-editor-accent mb-2 border-b border-editor-border/30 pb-1">
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

      </div>
    </div>
  )
}