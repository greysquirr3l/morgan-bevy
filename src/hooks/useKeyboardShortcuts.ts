import { useEffect } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { copySelectedObjects, clipboard } from '@/utils/clipboard'
import { transformConstraints } from '@/utils/transformConstraints'
import { DeleteObjectCommand, DuplicateCommand, PasteCommand, GroupCommand, UngroupCommand, SaveCommand, LoadCommand } from '@/utils/commands'

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
          case 'n':
            event.preventDefault()
            // Ctrl+N: New Scene
            if (Object.keys(sceneObjects).length > 0) {
              const confirmClear = window.confirm('Are you sure? This will clear the current scene.')
              if (confirmClear) {
                useEditorStore.setState({
                  sceneObjects: {},
                  selectedObjects: [],
                  undoHistory: [],
                  redoHistory: [],
                  activeLayer: 'default'
                })
                console.log('New scene created')
              }
            } else {
              useEditorStore.setState({
                sceneObjects: {},
                selectedObjects: [],
                undoHistory: [],
                redoHistory: [],
                activeLayer: 'default'
              })
              console.log('New scene created')
            }
            break
          case 's':
            event.preventDefault()
            // Ctrl+S: Save Scene
            const saveCommand = new SaveCommand()
            saveCommand.execute()
            console.log('Scene saved')
            break
          case 'o':
            event.preventDefault()
            // Ctrl+O: Open/Load Scene
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json,.morgan'
            input.onchange = (fileEvent) => {
              const file = (fileEvent.target as HTMLInputElement).files?.[0]
              if (file) {
                const reader = new FileReader()
                reader.onload = (e) => {
                  try {
                    const content = e.target?.result as string
                    const data = JSON.parse(content)
                    const loadCommand = new LoadCommand(data)
                    loadCommand.execute()
                    executeCommand(loadCommand)
                    console.log('Scene loaded successfully')
                  } catch (error) {
                    alert('Error loading file: Invalid format')
                    console.error('Load error:', error)
                  }
                }
                reader.readAsText(file)
              }
            }
            input.click()
            break
          case 'e':
            if (event.shiftKey) {
              // Ctrl+Shift+E: Export Scene
              event.preventDefault()
              const state = useEditorStore.getState()
              const exportData = {
                metadata: {
                  version: '1.0.0',
                  editor: 'Morgan-Bevy',
                  exportedAt: new Date().toISOString(),
                  objectCount: Object.keys(state.sceneObjects).length,
                  layerCount: state.layers.length
                },
                scene: {
                  objects: state.sceneObjects,
                  layers: state.layers,
                  settings: {
                    gridSize: state.gridSize,
                    snapToGrid: state.snapToGrid
                  }
                }
              }
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `morgan-scene-${Date.now()}.json`
              a.click()
              URL.revokeObjectURL(url)
              console.log('Scene exported')
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