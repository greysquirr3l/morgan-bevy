import { useEffect } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { copySelectedObjects, pasteFromClipboard } from '@/utils/clipboard'
import { transformConstraints } from '@/utils/transformConstraints'

export function useKeyboardShortcuts() {
  const { 
    selectedObjects,
    clearSelection,
    setTransformMode,
    toggleGrid,
    toggleStats,
    setCameraMode,
    transformMode,
    removeObject,
    duplicateObjects,
    undo,
    redo,
    canUndo,
    canRedo,
    groupObjects,
    ungroupObject,
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
            selectedObjects.forEach((id: string) => removeObject(id))
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
              duplicateObjects(selectedObjects)
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
            // Paste at origin by default, could be enhanced to paste at cursor/camera position
            pasteFromClipboard([0, 0, 0]).then(pastedIds => {
              if (pastedIds.length > 0) {
                const { setSelectedObjects } = useEditorStore.getState()
                setSelectedObjects(pastedIds)
                console.log('Pasted objects from clipboard:', pastedIds.length)
              }
            })
            break
          case 'g':
            event.preventDefault()
            if (event.shiftKey) {
              // Ctrl+Shift+G: Ungroup
              if (selectedObjects.length === 1) {
                const obj = sceneObjects[selectedObjects[0]]
                if (obj && obj.type === 'group') {
                  ungroupObject(obj.id)
                  console.log('Ungrouped objects')
                }
              }
            } else {
              // Ctrl+G: Group
              if (selectedObjects.length > 1) {
                const groupId = groupObjects(selectedObjects)
                console.log('Grouped objects into:', groupId)
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
  }, [selectedObjects, setTransformMode, toggleGrid, toggleStats, setCameraMode, clearSelection, removeObject, duplicateObjects, undo, redo, canUndo, canRedo, groupObjects, ungroupObject, sceneObjects, transformMode])

  return { transformMode }
}