import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Command } from '@/utils/commands'

export interface EditorState {
  // Selection
  selectedObjects: string[]
  hoveredObject: string | null
  
  // Transform
  transformMode: 'select' | 'translate' | 'rotate' | 'scale'
  coordinateSpace: 'local' | 'world'
  gridSnapEnabled: boolean
  snapToGrid: boolean
  gridSize: number
  
  // Camera
  cameraMode: 'orbit' | 'fly' | 'top-down'
  
  // Layers
  activeLayer: string
  layers: Array<{
    id: string
    name: string
    visible: boolean
    locked: boolean
    color: string
  }>
  
  // Scene objects
  sceneObjects: Record<string, {
    id: string
    name: string
    type: 'mesh' | 'light' | 'group'
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
    visible: boolean
    locked: boolean
    layerId: string
    parentId?: string
    children: string[]
    meshType?: 'cube' | 'sphere' | 'pyramid' // For primitive shapes
  }>
  
  // UI state
  showGrid: boolean
  showStats: boolean
  
  // Undo/Redo system
  undoHistory: Command[]
  redoHistory: Command[]
  maxHistorySize: number
  
  // Actions
  setSelectedObjects: (ids: string[]) => void
  addToSelection: (id: string) => void
  removeFromSelection: (id: string) => void
  clearSelection: () => void
  setHoveredObject: (id: string | null) => void
  setTransformMode: (mode: 'select' | 'translate' | 'rotate' | 'scale') => void
  toggleCoordinateSpace: () => void
  toggleGridSnap: () => void
  toggleSnapToGrid: () => void
  setGridSize: (size: number) => void
  setCameraMode: (mode: 'orbit' | 'fly' | 'top-down') => void
  toggleGrid: () => void
  toggleStats: () => void
  
  // Object management
  addObject: (type: 'cube' | 'sphere' | 'pyramid', position?: [number, number, number]) => string
  removeObject: (id: string) => void
  duplicateObjects: (ids: string[]) => string[]
  updateObjectTransform: (id: string, transform: Partial<{ position: [number, number, number], rotation: [number, number, number], scale: [number, number, number] }>) => void
  groupObjects: (ids: string[]) => string
  ungroupObject: (groupId: string) => void
  
  // Undo/Redo system
  executeCommand: (command: Command) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  clearHistory: () => void
}

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
      // Initial state  
      selectedObjects: [] as string[],
      hoveredObject: null as string | null,
    transformMode: 'select',
    coordinateSpace: 'world',
    gridSnapEnabled: true,
    snapToGrid: true,
    gridSize: 1.0,
    cameraMode: 'orbit',
    activeLayer: 'default',
    layers: [
      { id: 'default', name: 'Default', visible: true, locked: false, color: '#ffffff' },
      { id: 'walls', name: 'Walls', visible: true, locked: false, color: '#8b5cf6' },
      { id: 'floors', name: 'Floors', visible: true, locked: false, color: '#10b981' },
      { id: 'doors', name: 'Doors', visible: true, locked: false, color: '#f59e0b' },
      { id: 'lights', name: 'Lights', visible: true, locked: false, color: '#fbbf24' },
    ],
    sceneObjects: {} as Record<string, {
      id: string
      name: string
      type: 'mesh' | 'light' | 'group'
      position: [number, number, number]
      rotation: [number, number, number]
      scale: [number, number, number]
      visible: boolean
      locked: boolean
      layerId: string
      parentId?: string
      children: string[]
      meshType?: 'cube' | 'sphere' | 'pyramid'
    }>,
    showGrid: true,
    showStats: false,
    
    // Undo/Redo system
    undoHistory: [] as Command[],
    redoHistory: [] as Command[],
    maxHistorySize: 50,
    
    // Actions
    setSelectedObjects: (ids: string[]) =>
      set((state) => {
        state.selectedObjects = ids
      }),
      
    addToSelection: (id: string) =>
      set((state) => {
        if (!state.selectedObjects.includes(id)) {
          state.selectedObjects.push(id)
        }
      }),
      
    removeFromSelection: (id: string) =>
      set((state) => {
        state.selectedObjects = state.selectedObjects.filter(objId => objId !== id)
      }),
      
    clearSelection: () =>
      set((state) => {
        state.selectedObjects = []
      }),
      
    setHoveredObject: (id: string | null) =>
      set((state) => {
        state.hoveredObject = id
      }),
      
    setTransformMode: (mode: 'select' | 'translate' | 'rotate' | 'scale') =>
      set((state) => {
        state.transformMode = mode
      }),
      
    toggleCoordinateSpace: () =>
      set((state) => {
        state.coordinateSpace = state.coordinateSpace === 'world' ? 'local' : 'world'
      }),
      
    toggleGridSnap: () =>
      set((state) => {
        state.gridSnapEnabled = !state.gridSnapEnabled
      }),
      
    toggleSnapToGrid: () =>
      set((state) => {
        state.snapToGrid = !state.snapToGrid
      }),
      
    setGridSize: (size: number) =>
      set((state) => {
        state.gridSize = size
      }),
      
    setCameraMode: (mode: 'orbit' | 'fly' | 'top-down') =>
      set((state) => {
        state.cameraMode = mode
      }),
      
    toggleGrid: () =>
      set((state) => {
        state.showGrid = !state.showGrid
      }),
      
    toggleStats: () =>
      set((state) => {
        state.showStats = !state.showStats
      }),
    
    // Object management
    addObject: (type: 'cube' | 'sphere' | 'pyramid', position = [0, 0, 0] as [number, number, number]) => {
      const id = `${type}_${Date.now()}`
      set((state) => {
        state.sceneObjects[id] = {
          id,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)}_${Object.keys(state.sceneObjects).length + 1}`,
          type: 'mesh',
          position,
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          visible: true,
          locked: false,
          layerId: state.activeLayer,
          children: [],
          meshType: type
        }
      })
      return id
    },
    
    removeObject: (id: string) =>
      set((state) => {
        delete state.sceneObjects[id]
        state.selectedObjects = state.selectedObjects.filter(objId => objId !== id)
      }),
    
    duplicateObjects: (ids: string[]) => {
      const newIds: string[] = []
      set((state) => {
        ids.forEach(id => {
          const original = state.sceneObjects[id]
          if (original) {
            const newId = `${original.name}_copy_${Date.now()}`
            state.sceneObjects[newId] = {
              ...original,
              id: newId,
              name: `${original.name}_copy`,
              position: [
                original.position[0] + 2,
                original.position[1],
                original.position[2]
              ]
            }
            newIds.push(newId)
          }
        })
      })
      return newIds
    },
    
    updateObjectTransform: (id: string, transform: Partial<{ position: [number, number, number], rotation: [number, number, number], scale: [number, number, number] }>) =>
      set((state) => {
        if (state.sceneObjects[id]) {
          if (transform.position) {
            state.sceneObjects[id].position = transform.position
          }
          if (transform.rotation) {
            state.sceneObjects[id].rotation = transform.rotation
          }
          if (transform.scale) {
            state.sceneObjects[id].scale = transform.scale
          }
        }
      }),
    
    groupObjects: (ids: string[]) => {
      const groupId = `group_${Date.now()}`
      set((state) => {
        // Calculate center position of selected objects
        let centerX = 0, centerY = 0, centerZ = 0
        const validObjects = ids.map(id => state.sceneObjects[id]).filter(Boolean)
        
        if (validObjects.length === 0) return groupId
        
        validObjects.forEach(obj => {
          centerX += obj.position[0]
          centerY += obj.position[1]
          centerZ += obj.position[2]
        })
        centerX /= validObjects.length
        centerY /= validObjects.length
        centerZ /= validObjects.length

        // Create group object
        state.sceneObjects[groupId] = {
          id: groupId,
          name: `Group_${Object.keys(state.sceneObjects).length + 1}`,
          type: 'group',
          position: [centerX, centerY, centerZ],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          visible: true,
          locked: false,
          layerId: state.activeLayer,
          children: ids,
        }

        // Update child objects to be parented to this group
        ids.forEach(id => {
          if (state.sceneObjects[id]) {
            state.sceneObjects[id].parentId = groupId
          }
        })

        // Update selection to the new group
        state.selectedObjects = [groupId]
      })
      return groupId
    },

    ungroupObject: (groupId: string) =>
      set((state) => {
        const group = state.sceneObjects[groupId]
        if (group && group.type === 'group') {
          // Clear parent relationships for children
          group.children.forEach(childId => {
            if (state.sceneObjects[childId]) {
              state.sceneObjects[childId].parentId = undefined
            }
          })

          // Select the ungrouped objects
          state.selectedObjects = group.children

          // Remove the group object
          delete state.sceneObjects[groupId]
        }
      }),
    
    // Undo/Redo system implementation
    executeCommand: (command: Command) =>
      set((state) => {
        // Note: Command should already be executed by the caller
        // This just adds it to history
        
        // Add to undo history
        state.undoHistory.push(command)
        
        // Clear redo history when new command is executed
        state.redoHistory = []
        
        // Limit history size
        if (state.undoHistory.length > state.maxHistorySize) {
          state.undoHistory.shift()
        }
      }),
    
    undo: () =>
      set((state) => {
        if (state.undoHistory.length > 0) {
          const command = state.undoHistory.pop()!
          command.undo()
          state.redoHistory.push(command)
        }
      }),
    
    redo: () =>
      set((state) => {
        if (state.redoHistory.length > 0) {
          const command = state.redoHistory.pop()!
          command.execute()
          state.undoHistory.push(command)
        }
      }),
    
    canUndo: (): boolean => {
      const state = useEditorStore.getState()
      return state.undoHistory.length > 0
    },
    
    canRedo: (): boolean => {
      const state = useEditorStore.getState()
      return state.redoHistory.length > 0
    },
    
    clearHistory: () =>
      set((state) => {
        state.undoHistory = []
        state.redoHistory = []
      }),
  }))
)