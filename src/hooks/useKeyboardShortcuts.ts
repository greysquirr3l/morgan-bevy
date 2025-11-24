import { useEffect } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { copySelectedObjects, clipboard } from '@/utils/clipboard'
import { transformConstraints } from '@/utils/transformConstraints'
import { DeleteObjectCommand, DuplicateCommand, PasteCommand, GroupCommand, UngroupCommand } from '@/utils/commands'

export function useKeyboardShortcuts() {
  const { 
    selectedObjects,
    clearSelection,
    setTransformMode,
    toggleGrid,
    toggleStats,
    setCameraMode,
    transformMode,
    executeCommand,
    undo,
    redo,
    canUndo,
    canRedo,
    sceneObjects
  } = useEditorStore()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      // Transform modes
      switch (event.key.toLowerCase()) {
        case 'w':
          event.preventDefault()
          setTransformMode('translate')
          break
        case 'e':
          event.preventDefault()
          setTransformMode('rotate')
          break
        case 'r':
          event.preventDefault()
          setTransformMode('scale')
          break
        case 'g':
          event.preventDefault()
          toggleGrid()
          break
        case 'escape':
          event.preventDefault()
          clearSelection()
          // Also clear transform constraints
          transformConstraints.clearConstraint()
          break
        case 'delete':
        case 'backspace':
          if (selectedObjects.length > 0) {
            event.preventDefault()
            // Use command system for undoable delete operations
            selectedObjects.forEach((id: string) => {
              const command = new DeleteObjectCommand(id)
              command.execute()
              executeCommand(command)
            })
          }
          break
        case '1':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault()
            setCameraMode('orbit')
          }
          break
        case '2':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault()
            setCameraMode('fly')
          }
          break
        case '3':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault()
            setCameraMode('top-down')
          }
          break
        case 'x':
          if (!event.ctrlKey && !event.metaKey && transformMode !== 'select') {
            event.preventDefault()
            if (event.shiftKey) {
              transformConstraints.setConstraint('yz') // Constrain to YZ plane
            } else {
              transformConstraints.setConstraint('x') // X-axis only
            }
          }
          break
        case 'y':
          if (!event.ctrlKey && !event.metaKey && transformMode !== 'select') {
            event.preventDefault()
            if (event.shiftKey) {
              transformConstraints.setConstraint('xz') // Constrain to XZ plane
            } else {
              transformConstraints.setConstraint('y') // Y-axis only
            }
          }
          break
        case 'z':
          if (!event.ctrlKey && !event.metaKey && transformMode !== 'select') {
            event.preventDefault()
            if (event.shiftKey) {
              transformConstraints.setConstraint('xy') // Constrain to XY plane
            } else {
              transformConstraints.setConstraint('z') // Z-axis only
            }
          }
          break
      }

      // Ctrl/Cmd combinations
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'a':
            event.preventDefault()
            // Select all objects
            const { setSelectedObjects } = useEditorStore.getState()
            const allObjectIds = Object.keys(sceneObjects)
            setSelectedObjects(allObjectIds)
            console.log('Select all objects:', allObjectIds.length)
            break
          case 'd':
            event.preventDefault()
            if (selectedObjects.length > 0) {
              // Use command system for undoable duplicate operation
              const command = new DuplicateCommand(selectedObjects)
              command.execute()
              executeCommand(command)
            }
            break
          case 'c':
            event.preventDefault()
            if (selectedObjects.length > 0) {
              copySelectedObjects()
              console.log('Copied objects to clipboard:', selectedObjects.length)
            }
            break
          case 'v':
            event.preventDefault()
            // Use command system for undoable paste operation
            if (clipboard.hasData()) {
              const clipboardData = clipboard.getData()
              if (clipboardData) {
                const command = new PasteCommand(clipboardData, [0, 0, 0])
                command.execute()
                executeCommand(command)
              }
            }
            break
          case 'g':
            event.preventDefault()
            if (event.shiftKey) {
              // Ctrl+Shift+G: Ungroup
              if (selectedObjects.length === 1) {
                const obj = sceneObjects[selectedObjects[0]]
                if (obj && obj.type === 'group') {
                  const command = new UngroupCommand(obj.id)
                  command.execute()
                  executeCommand(command)
                  console.log('Ungrouped objects')
                }
              }
            } else {
              // Ctrl+G: Group
              if (selectedObjects.length > 1) {
                const command = new GroupCommand(selectedObjects)
                command.execute()
                executeCommand(command)
                console.log('Grouped objects')
              }
            }
            break
          case 'z':
            event.preventDefault()
            if (event.shiftKey) {
              // Ctrl+Shift+Z or Cmd+Shift+Z for redo
              if (canRedo()) {
                redo()
                console.log('Redo')
              }
            } else {
              // Ctrl+Z or Cmd+Z for undo
              if (canUndo()) {
                undo()
                console.log('Undo')
              }
            }
            break
          case 'y':
            event.preventDefault()
            // Ctrl+Y or Cmd+Y for redo (alternative)
            if (canRedo()) {
              redo()
              console.log('Redo')
            }
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedObjects, setTransformMode, toggleGrid, toggleStats, setCameraMode, clearSelection, executeCommand, undo, redo, canUndo, canRedo, sceneObjects, transformMode])

  return { transformMode }
}