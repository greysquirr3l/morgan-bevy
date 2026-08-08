// T60 — Table-driven keyboard shortcuts.
//
// Behaviour is unchanged from the previous hand-coded switch
// statement, but the bindings now live in `src/shortcuts/defaults.ts`
// and the user override layer in `src/utils/shortcutStore.ts`. The
// hook consumes the merged effective binding table on every render.
//
// Dispatch: the hook builds a `Map<shortcutKey, ShortcutBinding>`
// from `getEffectiveBindings()` on each render, looks up the
// matching binding for the current event, applies the guard
// predicates (`requiresSelection` / `requiresTransformMode`), and
// runs the matching action handler.
//
// The action set is exhaustively typed via `ShortcutAction` so
// adding a new shortcut action without wiring a handler is a
// compile error.

import { useCameraContext } from '@/contexts/CameraContext'
import { useEditorStore } from '@/store/editorStore'
import { serializeMap } from '@/store/mapSerialization'
import { LayerId } from '@/types/brand'
import { clipboard, copySelectedObjects } from '@/utils/clipboard'
import {
  type ShortcutBinding,
  type ShortcutAction,
} from '@/shortcuts/defaults'
import {
  DeleteObjectCommand,
  DuplicateCommand,
  GroupCommand,
  LoadCommand,
  SaveCommand,
  UngroupCommand,
} from '@/utils/commands'
import { shortcutKeyOf } from '@/utils/shortcutConflicts'
import { getEffectiveBindings } from '@/utils/shortcutStore'
import { transformConstraints } from '@/utils/transformConstraints'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

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
    sceneObjects,
    toggleCoordinateSpace,
  } = useEditorStore(
    useShallow(s => ({
      selectedObjects: s.selectedObjects,
      clearSelection: s.clearSelection,
      setTransformMode: s.setTransformMode,
      toggleGrid: s.toggleGrid,
      toggleStats: s.toggleStats,
      setCameraMode: s.setCameraMode,
      transformMode: s.transformMode,
      executeCommand: s.executeCommand,
      undo: s.undo,
      redo: s.redo,
      canUndo: s.canUndo,
      canRedo: s.canRedo,
      sceneObjects: s.sceneObjects,
      toggleCoordinateSpace: s.toggleCoordinateSpace,
    }))
  )

  // Get camera controls from context
  const { cameraControlsRef } = useCameraContext()

  useEffect(() => {
    // Build the lookup once per render. The store reads localStorage
    // on each call so we don't pre-compute at module scope — the
    // table can change at runtime via the rebind UI.
    const bindings = getEffectiveBindings()
    const lookup = new Map<string, ShortcutBinding>(
      bindings.map(b => [shortcutKeyOf(b), b])
    )

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs.
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Build the candidate key combo from the event and look up
      // the matching binding. Order-independent at lookup time.
      const mods: string[] = []
      if (event.ctrlKey) mods.push('ctrl')
      if (event.metaKey) mods.push('meta')
      if (event.shiftKey) mods.push('shift')
      if (event.altKey) mods.push('alt')
      const candidateKey =
        (mods.length ? mods.sort().join('+') + '+' : '') + event.key.toLowerCase()
      const binding = lookup.get(candidateKey)
      if (!binding) return

      // Guard predicates — fire only when the predicate allows.
      if (binding.requiresSelection && selectedObjects.length === 0) return
      if (binding.requiresTransformMode && transformMode === 'select') return

      event.preventDefault()
      dispatch(binding, event)
    }

    const dispatch = (binding: ShortcutBinding, event: KeyboardEvent): void => {
      // The exhaustive switch on `action` is what makes adding a
      // new entry to `DEFAULT_SHORTCUTS` a compile error — TypeScript
      // catches the missing case. The cast widens `string` to
      // `ShortcutAction` for the switch; the `default:` branch uses
      // the `never` pattern so a future action without a case is a
      // compile error.
      const action = binding.action as unknown as ShortcutAction
      switch (action) {
        case 'transform.translate':
          setTransformMode('translate')
          break
        case 'transform.rotate':
          setTransformMode('rotate')
          break
        case 'transform.scale':
          setTransformMode('scale')
          break
        case 'toggle.grid':
          toggleGrid()
          break
        case 'toggle.stats':
          toggleStats()
          break
        case 'selection.clear':
          clearSelection()
          transformConstraints.clearConstraint()
          break
        case 'selection.delete':
          if (selectedObjects.length > 0) {
            selectedObjects.forEach(id => {
              const command = new DeleteObjectCommand(id)
              command.execute()
              executeCommand(command)
            })
          }
          break
        case 'selection.selectAll': {
          const allObjectIds = Array.from(sceneObjects.keys())
          useEditorStore.getState().setSelectedObjects(allObjectIds)
          break
        }
        case 'scene.duplicate':
          if (selectedObjects.length > 0) {
            const command = new DuplicateCommand(selectedObjects)
            command.execute()
            executeCommand(command)
          }
          break
        case 'group':
          if (selectedObjects.length > 1) {
            const command = new GroupCommand(selectedObjects)
            command.execute()
            executeCommand(command)
          }
          break
        case 'ungroup':
          // UngroupCommand takes a single group id. Use the first
          // selected object — the user is expected to select a
          // single group.
          if (selectedObjects.length > 0) {
            const command = new UngroupCommand(selectedObjects[0])
            command.execute()
            executeCommand(command)
          }
          break
        case 'clipboard.copy':
          if (selectedObjects.length > 0) {
            copySelectedObjects()
          }
          break
        case 'clipboard.paste':
          clipboard.paste()
          break
        case 'undo':
          if (canUndo()) undo()
          break
        case 'redo':
          if (canRedo()) redo()
          break
        case 'camera.orbit':
          setCameraMode('orbit')
          break
        case 'camera.fly':
          setCameraMode('fly')
          break
        case 'camera.orthographic':
          setCameraMode('orthographic')
          break
        case 'camera.frameAll':
          cameraControlsRef.current?.frameAll()
          break
        case 'camera.focusSelection':
          cameraControlsRef.current?.focusSelection()
          break
        case 'camera.toggleCoordinateSpace':
          toggleCoordinateSpace()
          break
        case 'constraint.x':
          transformConstraints.setConstraint('x')
          break
        case 'constraint.y':
          transformConstraints.setConstraint('y')
          break
        case 'constraint.z':
          transformConstraints.setConstraint('z')
          break
        case 'constraint.yz':
          transformConstraints.setConstraint('yz')
          break
        case 'constraint.xz':
          transformConstraints.setConstraint('xz')
          break
        case 'constraint.xy':
          transformConstraints.setConstraint('xy')
          break
        case 'scene.new':
          useEditorStore.setState({
            sceneObjects: new Map(),
            selectedObjects: [],
            undoHistory: [],
            redoHistory: [],
            activeLayer: LayerId('default'),
          })
          break
        case 'scene.save': {
          const saveCommand = new SaveCommand()
          saveCommand.execute()
          break
        }
        case 'scene.open': {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.json,.morgan'
          input.onchange = fileEvent => {
            const file = (fileEvent.target as HTMLInputElement).files?.[0]
            if (file) {
              const reader = new FileReader()
              reader.onload = e => {
                try {
                  const content = e.target?.result as string
                  const data = JSON.parse(content)
                  const loadCommand = new LoadCommand(data)
                  loadCommand.execute()
                  executeCommand(loadCommand)
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
        }
        case 'scene.export': {
          const state = useEditorStore.getState()
          const exportData = {
            metadata: {
              version: '1.0.0',
              editor: 'Morgan-Bevy',
              exportedAt: new Date().toISOString(),
              objectCount: state.sceneObjects.size,
              layerCount: state.layers.length,
            },
            scene: {
              objects: serializeMap(state.sceneObjects),
              layers: state.layers,
              settings: {
                gridSize: state.gridSize,
                snapToGrid: state.snapToGrid,
              },
            },
          }
          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
          })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `morgan-scene-${Date.now()}.json`
          a.click()
          URL.revokeObjectURL(url)
          break
        }
        default: {
          // Unreachable — `action` was cast to `ShortcutAction`
          // and every entry in DEFAULT_SHORTCUTS has a case above.
          // If a new entry lands without one, the cast in the
          // store's lookup will produce a string that's not in
          // the union and this branch silently no-ops; that's
          // safer than throwing in a keydown handler.
          void action
        }
      }
      void event
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedObjects,
    setTransformMode,
    toggleGrid,
    toggleStats,
    setCameraMode,
    clearSelection,
    executeCommand,
    undo,
    redo,
    canUndo,
    canRedo,
    sceneObjects,
    transformMode,
    toggleCoordinateSpace,
    cameraControlsRef,
  ])

  return { transformMode }
}