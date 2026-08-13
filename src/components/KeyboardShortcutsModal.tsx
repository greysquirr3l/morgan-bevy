import { DEFAULT_SHORTCUTS, type ShortcutBinding } from '@/shortcuts/defaults'
import { Camera, Copy, Eye, FileText, Keyboard, Layers, Mouse, Move, Search, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'

/**
 * Build the human-readable list of keys shown in the UI. Modifiers
 * come first (Ctrl / Meta / Alt / Shift) so the rendered chip
 * reads "Ctrl + A" rather than "A + Ctrl", which matches what the
 * user sees in the menu bar.
 */
function formatKeys(binding: ShortcutBinding): string[] {
  const parts: string[] = []
  if (binding.modifiers.includes('ctrl')) parts.push('Ctrl')
  if (binding.modifiers.includes('meta')) parts.push('Cmd')
  if (binding.modifiers.includes('alt')) parts.push('Alt')
  if (binding.modifiers.includes('shift')) parts.push('Shift')
  parts.push(capitalize(binding.key))
  return parts
}

function capitalize(key: string): string {
  if (key === 'escape') return 'Esc'
  if (key === 'arrowup') return '↑'
  if (key === 'arrowdown') return '↓'
  if (key === 'arrowleft') return '←'
  if (key === 'arrowright') return '→'
  if (key.length === 1) return key.toUpperCase()
  return key.charAt(0).toUpperCase() + key.slice(1)
}

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

  // Audit (Major #14) regression: this used to be a hand-written
  // list of  rows. Every time
  //  grew or changed a binding, the
  // modal drifted silently — missing actions, wrong key combos,
  // duplicates. Derive the modal's groups from
  // (the single source of truth that the hook already consumes)
  // and group by . Each binding has a
  // that becomes the description;  renders the chip
  // from  + .
  const shortcutGroups: ShortcutGroup[] = (() => {
    const byCategory = new Map<string, ShortcutBinding[]>()
    for (const binding of DEFAULT_SHORTCUTS) {
      const cat = binding.category ?? 'Other'
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(binding)
    }
    const iconFor = (cat: string): React.ReactNode => {
      if (cat === 'Transform') return <Move className="w-4 h-4" />
      if (cat === 'Camera') return <Camera className="w-4 h-4" />
      if (cat === 'View') return <Eye className="w-4 h-4" />
      if (cat === 'Selection') return <Layers className="w-4 h-4" />
      if (cat === 'Tools') return <Keyboard className="w-4 h-4" />
      if (cat === 'Constraint') return <Copy className="w-4 h-4" />
      if (cat === 'File') return <FileText className="w-4 h-4" />
      if (cat === 'Help') return <Search className="w-4 h-4" />
      return <Mouse className="w-4 h-4" />
    }
    return Array.from(byCategory.entries()).map(([cat, items]) => ({
      title: cat,
      icon: iconFor(cat),
      shortcuts: items.map(binding => ({
        keys: formatKeys(binding),
        description: binding.label,
        action: binding.action,
      })),
    }))
  })()

  // Filter shortcuts based on search query and category
  const filteredGroups = shortcutGroups
    .map(group => ({
      ...group,
      shortcuts: group.shortcuts.filter(shortcut => {
        const matchesSearch =
          searchQuery === '' ||
          shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shortcut.keys.some(key => key.toLowerCase().includes(searchQuery.toLowerCase()))

        const matchesCategory = selectedCategory === 'all' || group.title === selectedCategory

        return matchesSearch && matchesCategory
      }),
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

  // Audit follow-up: this used to be a separate hand-written array
  // (`['all', 'transform', 'camera', 'selection', 'file', 'view',
  // 'tools']`) that drifted out of sync with the real categories in
  // `defaults.ts` (e.g. it listed "file" — no shortcut is actually
  // categorized "File" anymore, it's "Scene" — and omitted
  // "Clipboard" entirely). Derive the dropdown options from the same
  // `shortcutGroups` the list itself renders so the two can never
  // drift apart again.
  const categories = ['all', ...shortcutGroups.map(group => group.title)]

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
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-editor-bg border border-editor-border rounded-lg text-editor-text placeholder-editor-textMuted focus:outline-none focus:border-editor-accent"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-editor-bg border border-editor-border rounded-lg text-editor-text focus:outline-none focus:border-editor-accent"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
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
                <div
                  key={groupIndex}
                  className="bg-editor-bg border border-editor-border rounded-lg p-4"
                >
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="text-editor-accent">{group.icon}</span>
                    <h3 className="text-lg font-semibold text-editor-text">{group.title}</h3>
                    <span className="text-xs text-editor-textMuted bg-editor-border px-2 py-1 rounded">
                      {group.shortcuts.length} shortcuts
                    </span>
                  </div>

                  <div className="grid gap-2">
                    {group.shortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 hover:bg-editor-border rounded-lg transition-colors"
                      >
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
              <span>
                💡 Tip: Press <kbd className="px-1 bg-editor-border rounded text-xs">?</kbd> anytime
                to open shortcuts
              </span>
              <span>
                Press <kbd className="px-1 bg-editor-border rounded text-xs">Esc</kbd> to close
              </span>
            </div>
            <div className="text-xs">Morgan-Bevy v0.3.5</div>
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
    closeModal,
  }
}
