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

export default function Hierarchy() {
  const { 
    selectedObjects, 
    sceneObjects, 
    setSelectedObjects, 
    addToSelection, 
    removeFromSelection 
  } = useEditorStore()
  const [searchTerm, setSearchTerm] = useState('')

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
    // TODO: Rename functionality
    console.log('Rename:', id)
  }

  const toggleObjectVisibility = (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    console.log('Toggle visibility for:', id)
    // TODO: Implement visibility toggle in store
  }

  const toggleObjectLock = (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    console.log('Toggle lock for:', id)
    // TODO: Implement lock toggle in store
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
          
          <span className="flex-1 truncate">{obj.name}</span>
          
          {/* Visibility and lock buttons */}
          <div className="flex items-center space-x-1 ml-2">
            <button
              className="w-4 h-4 flex items-center justify-center hover:bg-editor-bg rounded opacity-60 hover:opacity-100"
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
              className="w-4 h-4 flex items-center justify-center hover:bg-editor-bg rounded opacity-60 hover:opacity-100"
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
  const filteredObjects = Object.values(sceneObjects).filter(obj =>
    obj.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-editor-border">
        <h3 className="text-sm font-semibold mb-2">Hierarchy</h3>
        
        {/* Search */}
        <input
          type="text"
          placeholder="Search objects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
        />
        
        {/* Filter buttons */}
        <div className="flex space-x-1 mt-2">
          <button className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border">
            All
          </button>
          <button className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border">
            Visible
          </button>
          <button className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:bg-editor-border">
            Selected
          </button>
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

      {/* Footer */}
      <div className="p-2 border-t border-editor-border">
        <div className="text-xs text-editor-textMuted">
          {selectedObjects.length} selected • {Object.keys(sceneObjects).length} total objects
        </div>
      </div>
    </div>
  )
}