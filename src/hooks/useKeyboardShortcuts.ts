import { useEffect } from 'react'
import { useEditorStore } from '@/store/editorStore'

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
    duplicateObjects
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
          break
        case 'delete':
        case 'backspace':
          if (selectedObjects.length > 0) {
            event.preventDefault()
            selectedObjects.forEach(id => removeObject(id))
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
      }

      // Ctrl/Cmd combinations
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'a':
            event.preventDefault()
            // TODO: Select all objects
            console.log('Select all')
            break
          case 'd':
            event.preventDefault()
            if (selectedObjects.length > 0) {
              duplicateObjects(selectedObjects)
            }
            break
          case 'z':
            event.preventDefault()
            // TODO: Undo
            console.log('Undo')
            break
          case 'y':
            event.preventDefault()
            // TODO: Redo
            console.log('Redo')
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedObjects, setTransformMode, toggleGrid, toggleStats, setCameraMode, clearSelection])

  return { transformMode }
}