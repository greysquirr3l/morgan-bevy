import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

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
}

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    // Initial state
    selectedObjects: [],
    hoveredObject: null,
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
    sceneObjects: {
      // Demo objects for testing
      'demo_cube_1': {
        id: 'demo_cube_1',
        name: 'Demo Cube',
        type: 'mesh' as const,
        position: [2, 1, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        visible: true,
        locked: false,
        layerId: 'default',
        children: [],
        meshType: 'cube' as const
      },
      'demo_sphere_1': {
        id: 'demo_sphere_1',
        name: 'Demo Sphere',
        type: 'mesh' as const,
        position: [-2, 1, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        visible: true,
        locked: false,
        layerId: 'default',
        children: [],
        meshType: 'sphere' as const
      },
      'demo_pyramid_1': {
        id: 'demo_pyramid_1',
        name: 'Demo Pyramid',
        type: 'mesh' as const,
        position: [0, 1, 2] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        visible: true,
        locked: false,
        layerId: 'default',
        children: [],
        meshType: 'pyramid' as const
      }
    },
    showGrid: true,
    showStats: false,
    
    // Actions
    setSelectedObjects: (ids) =>
      set((state) => {
        state.selectedObjects = ids
      }),
      
    addToSelection: (id) =>
      set((state) => {
        if (!state.selectedObjects.includes(id)) {
          state.selectedObjects.push(id)
        }
      }),
      
    removeFromSelection: (id) =>
      set((state) => {
        state.selectedObjects = state.selectedObjects.filter(objId => objId !== id)
      }),
      
    clearSelection: () =>
      set((state) => {
        state.selectedObjects = []
      }),
      
    setHoveredObject: (id) =>
      set((state) => {
        state.hoveredObject = id
      }),
      
    setTransformMode: (mode) =>
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
      
    setGridSize: (size) =>
      set((state) => {
        state.gridSize = size
      }),
      
    setCameraMode: (mode) =>
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
    addObject: (type, position = [0, 0, 0]) => {
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
    
    removeObject: (id) =>
      set((state) => {
        delete state.sceneObjects[id]
        state.selectedObjects = state.selectedObjects.filter(objId => objId !== id)
      }),
    
    duplicateObjects: (ids) => {
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
    
    updateObjectTransform: (id, transform) =>
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
  }))
)