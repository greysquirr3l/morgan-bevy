import { useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { 
  Box, 
  Circle, 
  Triangle, 
  Package, 
  Lightbulb, 
  Folder, 
  HelpCircle, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock 
} from 'lucide-react'

interface HierarchyProps {
  hideHeader?: boolean
}

export default function Hierarchy({ hideHeader = false }: HierarchyProps) {
  const { 
    selectedObjects, 
    sceneObjects, 
    setSelectedObjects, 
    addToSelection, 
    removeFromSelection,
    updateObjectVisibility,
    updateObjectLock,
    updateObjectName
  } = useEditorStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const handleObjectClick = (id: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Add to selection
      if (selectedObjects.includes(id)) {
        removeFromSelection(id)
      } else {
        addToSelection(id)
      }
    } else {
      // Set as only selection
      setSelectedObjects([id])
    }
  }

  const handleObjectDoubleClick = (id: string) => {
    // Start rename mode
    setRenamingId(id)
    setRenameValue(sceneObjects[id]?.name || '')
  }

  const handleRenameComplete = (id: string) => {
    if (renameValue.trim()) {
      updateObjectName(id, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleRenameCancel = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const toggleObjectVisibility = (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const obj = sceneObjects[id]
    if (obj) {
      updateObjectVisibility(id, !obj.visible)
    }
  }

  const toggleObjectLock = (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const obj = sceneObjects[id]
    if (obj) {
      updateObjectLock(id, !obj.locked)
    }
  }

  const getObjectIcon = (type: string, meshType?: string) => {
    if (type === 'mesh' && meshType) {
      switch (meshType) {
        case 'cube': return <Box className="w-4 h-4 text-green-500" />
        case 'sphere': return <Circle className="w-4 h-4 text-blue-500" />
        case 'pyramid': return <Triangle className="w-4 h-4 text-red-500" />
        default: return <Package className="w-4 h-4" />
      }
    } else if (type === 'light') {
      return <Lightbulb className="w-4 h-4 text-yellow-500" />
    } else if (type === 'group') {
      return <Folder className="w-4 h-4" />
    }
    return <HelpCircle className="w-4 h-4" />
  }

  const renderTreeItem = (obj: any, level: number = 0) => {
    const isSelected = selectedObjects.includes(obj.id)

    return (
      <div key={obj.id}>
        <div
          className={`flex items-center py-1 px-2 text-sm cursor-pointer hover:bg-editor-border ${
            isSelected ? 'bg-editor-accent text-white' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={(e) => handleObjectClick(obj.id, e)}
          onDoubleClick={() => handleObjectDoubleClick(obj.id)}
        >
          <span className="w-5 text-center mr-2">
            {getObjectIcon(obj.type, obj.meshType)}
          </span>
          
          {renamingId === obj.id ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRenameComplete(obj.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenameComplete(obj.id)
                } else if (e.key === 'Escape') {
                  handleRenameCancel()
                }
              }}
              className="flex-1 px-1 text-sm bg-editor-bg border border-editor-accent rounded focus:outline-none"
              autoFocus
            />
          ) : (
            <span className="flex-1 truncate">{obj.name}</span>
          )}
          
          {/* Visibility and lock buttons */}
          <div className="flex items-center space-x-1 ml-2">
            <button
              className={`w-4 h-4 flex items-center justify-center hover:bg-editor-bg rounded transition-opacity ${
                obj.visible ? 'opacity-60 hover:opacity-100' : 'opacity-100 text-red-500'
              }`}
              onClick={(e) => toggleObjectVisibility(obj.id, e)}
              title={obj.visible ? 'Hide' : 'Show'}
            >
              {obj.visible ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
            </button>
            <button
              className={`w-4 h-4 flex items-center justify-center hover:bg-editor-bg rounded transition-opacity ${
                obj.locked ? 'opacity-100 text-yellow-500' : 'opacity-60 hover:opacity-100'
              }`}
              onClick={(e) => toggleObjectLock(obj.id, e)}
              title={obj.locked ? 'Unlock' : 'Lock'}
            >
              {obj.locked ? (
                <Lock className="w-3 h-3" />
              ) : (
                <Unlock className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Filter objects based on search term
  const filteredObjects = Object.values(sceneObjects).filter((obj: any) =>
    obj.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header - only show if not hiding header */}
      {!hideHeader && (
        <div className="p-3 border-b border-editor-border">
          <h3 className="text-lg font-medium">Hierarchy</h3>
        </div>
      )}
      
      {/* Search and info */}
      <div className="p-3 border-b border-editor-border">
        <input
          type="text"
          placeholder="Search objects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
        />
        <div className="flex justify-between items-center mt-2 text-sm text-editor-textMuted">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <Package className="w-4 h-4" />
              <span>{Object.keys(sceneObjects).length}</span>
            </div>
            {selectedObjects.length > 0 && (
              <div className="flex items-center space-x-1">
                <Box className="w-4 h-4" />
                <span>{selectedObjects.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {filteredObjects.length === 0 ? (
          <div className="p-4 text-center text-editor-textMuted text-sm">
            {searchTerm ? 'No objects match your search' : 'No objects in scene'}
          </div>
        ) : (
          filteredObjects.map(obj => renderTreeItem(obj))
        )}
      </div>
    </div>
  )
}