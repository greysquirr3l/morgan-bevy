import React, { useState, useEffect } from 'react'
import { X, Search, Keyboard, Mouse, Camera, Move, Eye, Copy, FileText, Layers } from 'lucide-react'

interface ShortcutGroup {
  title: string
  icon: React.ReactNode
  shortcuts: {
    keys: string[]
    description: string
    category?: string
  }[]
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Transform & Selection',
      icon: <Move className="w-4 h-4" />,
      shortcuts: [
        { keys: ['W'], description: 'Translate mode - Move objects in 3D space' },
        { keys: ['E'], description: 'Rotate mode - Rotate objects around axes' },
        { keys: ['R'], description: 'Scale mode - Resize objects uniformly or per-axis' },
        { keys: ['T'], description: 'Toggle local/world coordinate space' },
        { keys: ['G'], description: 'Toggle grid snapping and visual overlay' },
        { keys: ['X'], description: 'Lock to X-axis during transform' },
        { keys: ['Y'], description: 'Lock to Y-axis during transform' },
        { keys: ['Z'], description: 'Lock to Z-axis during transform' },
        { keys: ['Esc'], description: 'Clear selection and exit transform mode' },
        { keys: ['Delete'], description: 'Delete selected objects' },
        { keys: ['Backspace'], description: 'Delete selected objects (alternative)' },
      ]
    },
    {
      title: 'Camera Controls',
      icon: <Camera className="w-4 h-4" />,
      shortcuts: [
        { keys: ['1'], description: 'Orbit camera mode - Standard 3D navigation' },
        { keys: ['2'], description: 'Fly camera mode - WASD + mouse look' },
        { keys: ['3'], description: 'Orthographic top-down view - 2D precision' },
        { keys: ['F'], description: 'Frame selected objects - Focus camera on selection' },
        { keys: ['Alt', 'F'], description: 'Frame all objects - Show entire scene' },
        { keys: ['Middle Mouse'], description: 'Pan camera (orbit mode)' },
        { keys: ['Right Mouse'], description: 'Rotate camera (orbit mode)' },
        { keys: ['Scroll Wheel'], description: 'Zoom camera in/out' },
      ]
    },
    {
      title: 'Fly Camera (Mode 2)',
      icon: <Mouse className="w-4 h-4" />,
      shortcuts: [
        { keys: ['W'], description: 'Move forward' },
        { keys: ['A'], description: 'Strafe left' },
        { keys: ['S'], description: 'Move backward' },
        { keys: ['D'], description: 'Strafe right' },
        { keys: ['Space'], description: 'Move up' },
        { keys: ['C'], description: 'Move down' },
        { keys: ['Shift'], description: 'Fast movement (hold while moving)' },
        { keys: ['Mouse'], description: 'Look around (pointer lock mode)' },
        { keys: ['Esc'], description: 'Exit fly mode back to orbit' },
      ]
    },
    {
      title: 'Selection & Editing',
      icon: <Eye className="w-4 h-4" />,
      shortcuts: [
        { keys: ['Click'], description: 'Select single object' },
        { keys: ['Ctrl', 'Click'], description: 'Add object to selection' },
        { keys: ['Drag'], description: 'Box selection - drag rectangle to select multiple' },
        { keys: ['Ctrl', 'A'], description: 'Select all objects' },
        { keys: ['Ctrl', 'G'], description: 'Group selected objects' },
        { keys: ['Ctrl', 'Shift', 'G'], description: 'Ungroup selected objects' },
        { keys: ['H'], description: 'Hide selected objects' },
        { keys: ['Shift', 'H'], description: 'Unhide all objects' },
      ]
    },
    {
      title: 'Copy & Paste',
      icon: <Copy className="w-4 h-4" />,
      shortcuts: [
        { keys: ['Ctrl', 'C'], description: 'Copy selected objects to clipboard' },
        { keys: ['Ctrl', 'V'], description: 'Paste objects from clipboard' },
        { keys: ['Ctrl', 'D'], description: 'Duplicate selected objects with offset' },
        { keys: ['Ctrl', 'Z'], description: 'Undo last operation' },
        { keys: ['Ctrl', 'Y'], description: 'Redo previously undone operation' },
        { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo (alternative shortcut)' },
      ]
    },
    {
      title: 'File Operations',
      icon: <FileText className="w-4 h-4" />,
      shortcuts: [
        { keys: ['Ctrl', 'N'], description: 'New project - Clear scene and start fresh' },
        { keys: ['Ctrl', 'O'], description: 'Open project file' },
        { keys: ['Ctrl', 'S'], description: 'Save current project' },
        { keys: ['Ctrl', 'Shift', 'S'], description: 'Save project as new file' },
        { keys: ['Ctrl', 'E'], description: 'Export level in multiple formats' },
        { keys: ['Ctrl', 'I'], description: 'Import assets or models' },
      ]
    },
    {
      title: 'View & Layout',
      icon: <Layers className="w-4 h-4" />,
      shortcuts: [
        { keys: ['Tab'], description: 'Toggle between 3D and 2D grid view' },
        { keys: ['Shift', 'Tab'], description: 'Toggle panel visibility' },
        { keys: ['F11'], description: 'Toggle fullscreen mode' },
        { keys: ['Ctrl', '1'], description: 'Reset panel layout to default' },
        { keys: ['Ctrl', '2'], description: 'Minimal layout - viewport focus' },
      ]
    },
    {
      title: 'Tools & Modes',
      icon: <Keyboard className="w-4 h-4" />,
      shortcuts: [
        { keys: ['V'], description: 'Select tool (default cursor)' },
        { keys: ['M'], description: 'Measure tool - Click two points for distance' },
        { keys: ['P'], description: 'Paint tool - Apply materials to surfaces' },
        { keys: ['L'], description: 'Light placement tool' },
        { keys: ['B'], description: 'Box creation tool' },
        { keys: ['Shift', 'A'], description: 'Add object menu' },
        { keys: ['?'], description: 'Show this keyboard shortcuts help' },
      ]
    }
  ]

  // Filter shortcuts based on search query and category
  const filteredGroups = shortcutGroups
    .map(group => ({
      ...group,
      shortcuts: group.shortcuts.filter(shortcut => {
        const matchesSearch = searchQuery === '' || 
          shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shortcut.keys.some(key => key.toLowerCase().includes(searchQuery.toLowerCase()))
        
        const matchesCategory = selectedCategory === 'all' || 
          group.title.toLowerCase().includes(selectedCategory.toLowerCase())
        
        return matchesSearch && matchesCategory
      })
    }))
    .filter(group => group.shortcuts.length > 0)

  // Handle keyboard shortcuts for closing the modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const categories = ['all', 'transform', 'camera', 'selection', 'file', 'view', 'tools']

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-editor-bg border border-editor-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-editor-border">
          <div className="flex items-center space-x-3">
            <Keyboard className="w-6 h-6 text-editor-accent" />
            <h2 className="text-xl font-bold text-editor-text">Keyboard Shortcuts</h2>
            <span className="text-sm text-editor-textMuted">
              {filteredGroups.reduce((acc, group) => acc + group.shortcuts.length, 0)} shortcuts
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-editor-border rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-editor-textMuted" />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b border-editor-border">
          <div className="flex space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-editor-textMuted" />
              <input
                type="text"
                placeholder="Search shortcuts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-editor-bg border border-editor-border rounded-lg text-editor-text placeholder-editor-textMuted focus:outline-none focus:border-editor-accent"
              />
            </div>
            
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-editor-bg border border-editor-border rounded-lg text-editor-text focus:outline-none focus:border-editor-accent"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Shortcuts Content */}
        <div className="flex-1 overflow-auto p-4">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-editor-textMuted">
              <Keyboard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No shortcuts found matching your search.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="bg-editor-bg border border-editor-border rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="text-editor-accent">{group.icon}</span>
                    <h3 className="text-lg font-semibold text-editor-text">{group.title}</h3>
                    <span className="text-xs text-editor-textMuted bg-editor-border px-2 py-1 rounded">
                      {group.shortcuts.length} shortcuts
                    </span>
                  </div>
                  
                  <div className="grid gap-2">
                    {group.shortcuts.map((shortcut, index) => (
                      <div key={index} className="flex items-center justify-between py-2 px-3 hover:bg-editor-border rounded-lg transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1">
                            {shortcut.keys.map((key, keyIndex) => (
                              <React.Fragment key={keyIndex}>
                                {keyIndex > 0 && (
                                  <span className="text-editor-textMuted text-sm">+</span>
                                )}
                                <kbd className="px-2 py-1 bg-editor-border text-editor-text text-xs rounded border border-gray-600 font-mono min-w-[32px] text-center">
                                  {key}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </div>
                          <span className="text-editor-text">{shortcut.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-editor-border bg-editor-bg">
          <div className="flex items-center justify-between text-sm text-editor-textMuted">
            <div className="flex items-center space-x-4">
              <span>💡 Tip: Press <kbd className="px-1 bg-editor-border rounded text-xs">?</kbd> anytime to open shortcuts</span>
              <span>Press <kbd className="px-1 bg-editor-border rounded text-xs">Esc</kbd> to close</span>
            </div>
            <div className="text-xs">
              Morgan-Bevy v0.3.5
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook for managing the shortcuts modal
export function useKeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false)

  const openModal = () => setIsOpen(true)
  const closeModal = () => setIsOpen(false)

  // Global keyboard shortcut to open the modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle the ? key if not in an input field
      if (
        event.key === '?' && 
        !event.ctrlKey && 
        !event.altKey && 
        !event.metaKey &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault()
        openModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    openModal,
    closeModal
  }
}