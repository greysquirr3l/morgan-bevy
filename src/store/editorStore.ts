import type { Command } from '@/utils/commands'
import { enableMapSet } from 'immer'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// Required for `state.sceneObjects.set(...)` / `.delete(...)` to work
// inside immer producers. Maps and Sets are not native to immer drafts.
enableMapSet()

// Simple debug logger for store operations
class StoreDebugLogger {
  static log(message: string, data?: any) {
    const timestamp = Date.now()
    const logEntry = `[STORE] ${message}`
    console.log(`🔄 ${logEntry}`, data || '')

    // Also save to localStorage for persistence
    try {
      const existing = JSON.parse(localStorage.getItem('morgan-bevy-store-debug') || '[]')
      existing.push({
        timestamp,
        message: logEntry,
        data,
      })
      // Keep only last 50 entries
      if (existing.length > 50) existing.shift()
      localStorage.setItem('morgan-bevy-store-debug', JSON.stringify(existing))
    } catch (e) {
      console.error('Failed to save store debug logs:', e)
    }
  }
}

export interface EditorState {
  // Selection
  selectedObjects: string[]
  hoveredObject: string | null

  // Grid data for 2D/3D sync
  gridData: string[][]
  selectedTheme: any | null

  // Transform
  transformMode: 'select' | 'translate' | 'rotate' | 'scale'
  coordinateSpace: 'local' | 'world'
  gridSnapEnabled: boolean
  snapToGrid: boolean
  gridSize: number

  // Viewport
  viewportMode: '3d' | '2d'

  // Camera
  cameraMode: 'orbit' | 'fly' | 'orthographic'

  // Layers
  activeLayer: string
  layers: Array<{
    id: string
    name: string
    visible: boolean
    locked: boolean
    color: string
  }>

  // Scene objects. T78: stored as a `Map` for O(1) insert/delete/lookup
  // (vs `Record`, where `delete` deoptimises V8's hidden class). Components
  // that need a plain `Record` view should use the `useSceneObjectsRecord`
  // selector below.
  sceneObjects: Map<
    string,
    {
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
      material?: {
        baseColor: string
        metallic: number
        roughness: number
        emissive?: string
        emissiveIntensity?: number
        texture?: string
      }
      // T18: link to a named MaterialPreset. When set, the
      // object's resolved material is `preset + overrides`. When
      // null, the `material` field is the source of truth.
      materialPresetId?: string
      materialOverrides?: {
        baseColor?: string
        metallic?: number
        roughness?: number
        emissive?: string
        emissiveIntensity?: number
        texture?: string
      }
      collision?: boolean
      walkable?: boolean
      tags?: string[]
      metadata?: any // Allow for flexible metadata including gridPosition, tileType, etc.
    }
  >

  // UI state
  showGrid: boolean
  showStats: boolean

  // Project file state (T20). `currentProjectPath` is the on-disk
  // path of the currently-loaded project file, or `null` if the
  // scene is unsaved / freshly created. `missingAssetRefs` is the
  // list of asset IDs the most-recent project file referenced that
  // the asset database could not resolve; rendered as a banner / badge.
  currentProjectPath: string | null
  missingAssetRefs: string[]

  // T55: lighting rig. `setLights` writes the entire array in one
  // call (used by the auto-placement helper); per-light edits go
  // through `addLight` / `removeLight` / `updateLight`.
  lights: Array<{
    id: string
    kind: 'ambient' | 'directional' | 'point' | 'spot'
    position: [number, number, number]
    color: [number, number, number]
    intensity: number
    angle?: number
    castShadow: boolean
    shadowQuality: 'off' | 'hard' | 'soft' | 'ultra'
    name?: string
  }>

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
  setViewportMode: (mode: '3d' | '2d') => void
  setCameraMode: (mode: 'orbit' | 'fly' | 'orthographic') => void
  setGridData: (data: string[][]) => void
  setSelectedTheme: (theme: any) => void
  toggleGrid: () => void
  toggleStats: () => void

  // Project file (T20)
  setCurrentProjectPath: (path: string | null) => void
  setMissingAssetRefs: (ids: string[]) => void

  // Lighting (T55)
  setLights: (
    lights: Array<{
      id: string
      kind: 'ambient' | 'directional' | 'point' | 'spot'
      position: [number, number, number]
      color: [number, number, number]
      intensity: number
      angle?: number
      castShadow: boolean
      shadowQuality: 'off' | 'hard' | 'soft' | 'ultra'
      name?: string
    }>,
  ) => void
  addLight: (light: {
    id: string
    kind: 'ambient' | 'directional' | 'point' | 'spot'
    position: [number, number, number]
    color: [number, number, number]
    intensity: number
    angle?: number
    castShadow: boolean
    shadowQuality: 'off' | 'hard' | 'soft' | 'ultra'
    name?: string
  }) => void
  removeLight: (id: string) => void
  updateLight: (
    id: string,
    patch: Partial<{
      kind: 'ambient' | 'directional' | 'point' | 'spot'
      position: [number, number, number]
      color: [number, number, number]
      intensity: number
      angle: number
      castShadow: boolean
      shadowQuality: 'off' | 'hard' | 'soft' | 'ultra'
      name: string
    }>,
  ) => void

  // Object management
  addObject: (type: 'cube' | 'sphere' | 'pyramid', position?: [number, number, number]) => string
  addObjectDirect: (objectData: any) => void
  removeObject: (id: string) => void
  duplicateObjects: (ids: string[]) => string[]
  updateObjectTransform: (
    id: string,
    transform: Partial<{
      position: [number, number, number]
      rotation: [number, number, number]
      scale: [number, number, number]
    }>
  ) => void
  updateObjectName: (id: string, name: string) => void
  updateObjectVisibility: (id: string, visible: boolean) => void
  updateObjectLock: (id: string, locked: boolean) => void
  updateObjectMaterial: (
    id: string,
    material: { baseColor: string; metallic: number; roughness: number; texture?: string }
  ) => void
  // T18: bind a scene object to a material preset. The object's
  // resolved material = preset + overrides. Pass an empty
  // overrides object to start fresh.
  linkObjectToPreset: (id: string, presetId: string, overrides: Record<string, unknown>) => void
  // T18: unlink an object from its preset, copying the currently
  // effective material into the object's `material` field.
  unlinkObjectFromPreset: (id: string) => void
  updateObjectMesh: (id: string, meshType: 'cube' | 'sphere' | 'pyramid') => void
  updateObjectProperties: (
    id: string,
    properties: { collision?: boolean; walkable?: boolean; tags?: string[]; metadata?: any }
  ) => void
  groupObjects: (ids: string[]) => string
  ungroupObject: (groupId: string) => void
  clearScene: () => void

  // Undo/Redo system
  executeCommand: (command: Command) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  clearHistory: () => void

  // Auto-save functionality
  saveToLocalStorage: () => void
  debouncedAutoSave: () => void
  loadFromLocalStorage: () => boolean
  clearLocalStorage: () => void
}

export const useEditorStore = create<EditorState>()(
  immer(set => ({
    // Initial state
    selectedObjects: [] as string[],
    hoveredObject: null as string | null,
    gridData: [] as string[][],
    selectedTheme: null as any | null,
    transformMode: 'select',
    coordinateSpace: 'world',
    gridSnapEnabled: true,
    snapToGrid: true,
    gridSize: 1.0,
    viewportMode: '3d' as '3d' | '2d',
    cameraMode: 'orbit',
    activeLayer: 'default',
    layers: [
      { id: 'default', name: 'Default', visible: true, locked: false, color: '#ffffff' },
      { id: 'walls', name: 'Walls', visible: true, locked: false, color: '#8b5cf6' },
      { id: 'floors', name: 'Floors', visible: true, locked: false, color: '#10b981' },
      { id: 'doors', name: 'Doors', visible: true, locked: false, color: '#f59e0b' },
      { id: 'lights', name: 'Lights', visible: true, locked: false, color: '#fbbf24' },
    ],
    sceneObjects: new Map<
      string,
      {
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
        material?: {
          baseColor: string
          metallic: number
          roughness: number
          emissive?: string
          emissiveIntensity?: number
          texture?: string
        }
        // T18: link to a named MaterialPreset. When set, the
        // object's resolved material is `preset + overrides`. When
        // null, the `material` field is the source of truth.
        materialPresetId?: string
        materialOverrides?: {
          baseColor?: string
          metallic?: number
          roughness?: number
          emissive?: string
          emissiveIntensity?: number
          texture?: string
        }
        collision?: boolean
        walkable?: boolean
        tags?: string[]
      }
    >(),
    showGrid: true,
    showStats: false,

    // Project file state (T20). When `currentProjectPath` is `null`,
    // the editor considers the scene unsaved (the File menu shows
    // "Save As" instead of "Save"). When non-null, the File menu can
    // overwrite the file in place via `save_project` with a path.
    currentProjectPath: null as string | null,

    // Missing-asset warnings (T20). After `load_project_from_path`
    // we cross-check the project's `metadata.assetRefs` against the
    // asset database and populate this list with the missing IDs.
    // Consumers can render a banner / badge off this state.
    missingAssetRefs: [] as string[],

    // T55: lighting. Stored as a `LightSource[]` so the auto-
    // placement helper can write the entire rig in one
    // `setLights` call. Per-light edits still go through the
    // store; the array shape keeps the schema simple.
    lights: [] as Array<{
      id: string
      kind: 'ambient' | 'directional' | 'point' | 'spot'
      position: [number, number, number]
      color: [number, number, number]
      intensity: number
      angle?: number
      castShadow: boolean
      shadowQuality: 'off' | 'hard' | 'soft' | 'ultra'
      name?: string
    }>,

    // Undo/Redo system
    undoHistory: [] as Command[],
    redoHistory: [] as Command[],
    maxHistorySize: 50,

    // Actions
    setSelectedObjects: (ids: string[]) =>
      set(state => {
        state.selectedObjects = ids
      }),

    addToSelection: (id: string) =>
      set(state => {
        if (!state.selectedObjects.includes(id)) {
          state.selectedObjects.push(id)
        }
      }),

    removeFromSelection: (id: string) =>
      set(state => {
        state.selectedObjects = state.selectedObjects.filter(objId => objId !== id)
      }),

    clearSelection: () =>
      set(state => {
        state.selectedObjects = []
      }),

    setHoveredObject: (id: string | null) =>
      set(state => {
        state.hoveredObject = id
      }),

    setTransformMode: (mode: 'select' | 'translate' | 'rotate' | 'scale') =>
      set(state => {
        state.transformMode = mode
      }),

    toggleCoordinateSpace: () =>
      set(state => {
        state.coordinateSpace = state.coordinateSpace === 'world' ? 'local' : 'world'
      }),

    toggleGridSnap: () =>
      set(state => {
        state.gridSnapEnabled = !state.gridSnapEnabled
      }),

    toggleSnapToGrid: () =>
      set(state => {
        state.snapToGrid = !state.snapToGrid
      }),

    setGridSize: (size: number) =>
      set(state => {
        state.gridSize = size
      }),

    setViewportMode: (mode: '3d' | '2d') =>
      set(state => {
        // Add comprehensive logging with call stack
        StoreDebugLogger.log(`setViewportMode called: ${state.viewportMode} -> ${mode}`, {
          currentMode: state.viewportMode,
          targetMode: mode,
          timestamp: Date.now(),
          callStack: new Error().stack?.split('\n').slice(0, 5).join('\n'),
        })

        // Save to localStorage for debugging
        try {
          const debugEntry = {
            timestamp: Date.now(),
            from: state.viewportMode,
            to: mode,
            stack: new Error().stack,
          }
          const existing = JSON.parse(
            localStorage.getItem('morgan-bevy-setViewportMode-calls') || '[]'
          )
          existing.push(debugEntry)
          // Keep only last 20 calls
          if (existing.length > 20) existing.shift()
          localStorage.setItem('morgan-bevy-setViewportMode-calls', JSON.stringify(existing))
        } catch (e) {
          console.error('Failed to save setViewportMode debug info:', e)
        }

        if (state.viewportMode === mode) {
          StoreDebugLogger.log(`Already in ${mode} mode, ignoring`)
          return
        }

        state.viewportMode = mode
        StoreDebugLogger.log(`Viewport mode changed to: ${mode}`)
      }),

    setCameraMode: (mode: 'orbit' | 'fly' | 'orthographic') =>
      set(state => {
        state.cameraMode = mode
      }),

    setGridData: (data: string[][]) =>
      set(state => {
        state.gridData = data
      }),

    setSelectedTheme: (theme: any) =>
      set(state => {
        state.selectedTheme = theme
      }),

    toggleGrid: () =>
      set(state => {
        state.showGrid = !state.showGrid
      }),

    toggleStats: () =>
      set(state => {
        state.showStats = !state.showStats
      }),

    // Project file (T20): set the in-memory pointer to the project
    // file on disk. The File menu's "Save" command uses this to
    // overwrite in place; "Save As" clears it before prompting so
    // subsequent saves go through the dialog flow.
    setCurrentProjectPath: (path: string | null) =>
      set(state => {
        state.currentProjectPath = path
        // Saving / loading a project invalidates any previous
        // missing-asset warning set — they were computed against
        // the old asset library state.
        state.missingAssetRefs = []
      }),

    setMissingAssetRefs: (ids: string[]) =>
      set(state => {
        state.missingAssetRefs = ids
      }),

    // T55: lighting actions. `setLights` is the bulk-write path
    // used by `autoLightPlacement`; `addLight` / `removeLight` /
    // `updateLight` cover per-light user edits from the toolbar.
    setLights: lights =>
      set(state => {
        state.lights = lights
      }),

    addLight: light =>
      set(state => {
        state.lights.push(light)
      }),

    removeLight: id =>
      set(state => {
        state.lights = state.lights.filter(l => l.id !== id)
      }),

    updateLight: (id, patch) =>
      set(state => {
        const idx = state.lights.findIndex(l => l.id === id)
        if (idx === -1) return
        state.lights[idx] = { ...state.lights[idx], ...patch }
      }),

    // Object management
    addObject: (
      type: 'cube' | 'sphere' | 'pyramid',
      position = [0, 0, 0] as [number, number, number]
    ) => {
      const id = `${type}_${Date.now()}`
      set(state => {
        state.sceneObjects.set(id, {
          id,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)}_${state.sceneObjects.size + 1}`,
          type: 'mesh',
          position,
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          visible: true,
          locked: false,
          layerId: state.activeLayer,
          children: [],
          meshType: type,
          material: {
            baseColor: '#ffffff',
            metallic: 0.0,
            roughness: 0.5,
          },
          collision: false,
          walkable: true,
          tags: [],
        })
      })
      // Trigger debounced auto-save
      useEditorStore.getState().debouncedAutoSave()
      return id
    },

    addObjectDirect: (objectData: any) =>
      set(state => {
        state.sceneObjects.set(objectData.id, {
          id: objectData.id,
          name: objectData.name,
          type: 'mesh',
          position: objectData.position,
          rotation: objectData.rotation,
          scale: objectData.scale,
          visible: objectData.visible,
          locked: objectData.locked,
          layerId: objectData.layerId,
          children: [],
          meshType: objectData.meshType,
          material: objectData.material
            ? {
                baseColor: objectData.material.baseColor || '#ffffff',
                metallic: objectData.material.metallic || 0.0,
                roughness: objectData.material.roughness || 0.5,
                texture: objectData.material.texture,
              }
            : {
                baseColor: '#ffffff',
                metallic: 0.0,
                roughness: 0.5,
              },
          collision: objectData.collision,
          walkable: objectData.walkable,
          tags: objectData.tags,
          metadata: objectData.metadata || {},
        })
        // Scene updated - trigger debounced auto-save
        useEditorStore.getState().debouncedAutoSave()
      }),

    clearScene: () => {
      set(state => {
        // Clear scene objects and selections
        state.sceneObjects = new Map()
        state.selectedObjects = []
        state.hoveredObject = null

        // Reset grid data but PRESERVE selectedTheme
        state.gridData = []
        // DON'T reset selectedTheme - keep it so tile palette works
        // state.selectedTheme = null

        // Reset viewport to 3D
        state.viewportMode = '3d'

        // Reset to default layer
        state.activeLayer = 'default'

        // Reset layers to default set
        state.layers = [
          { id: 'default', name: 'Default', visible: true, locked: false, color: '#ffffff' },
          { id: 'walls', name: 'Walls', visible: true, locked: false, color: '#8b5cf6' },
          { id: 'floors', name: 'Floors', visible: true, locked: false, color: '#10b981' },
          { id: 'doors', name: 'Doors', visible: true, locked: false, color: '#f59e0b' },
          { id: 'lights', name: 'Lights', visible: true, locked: false, color: '#fbbf24' },
        ]

        // Clear undo/redo history
        state.undoHistory = []
        state.redoHistory = []
      })
      // Trigger debounced auto-save after clearing scene
      useEditorStore.getState().debouncedAutoSave()
    },

    removeObject: (id: string) => {
      set(state => {
        state.sceneObjects.delete(id)
        state.selectedObjects = state.selectedObjects.filter(objId => objId !== id)
      })
      // Trigger debounced auto-save after removing object
      useEditorStore.getState().debouncedAutoSave()
    },

    duplicateObjects: (ids: string[]) => {
      const newIds: string[] = []
      set(state => {
        ids.forEach(id => {
          const original = state.sceneObjects.get(id)
          if (original) {
            const newId = `${original.name}_copy_${Date.now()}`
            state.sceneObjects.set(newId, {
              ...original,
              id: newId,
              name: `${original.name}_copy`,
              position: [original.position[0] + 2, original.position[1], original.position[2]],
            })
            newIds.push(newId)
          }
        })
      })
      return newIds
    },

    updateObjectTransform: (
      id: string,
      transform: Partial<{
        position: [number, number, number]
        rotation: [number, number, number]
        scale: [number, number, number]
      }>
    ) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          if (transform.position) {
            const o = state.sceneObjects.get(id)
            if (o) o.position = transform.position

            // Update grid position metadata for tile objects
            if (state.sceneObjects.get(id)?.metadata?.fromGrid && transform.position) {
              const [x3d, , z3d] = transform.position
              const newGridX = Math.round(x3d + 24) // 48/2 = 24 for grid centering
              const newGridY = Math.round(z3d + 18) // 36/2 = 18 for grid centering

              // Update the grid position metadata
              if (state.sceneObjects.get(id)?.metadata) {
                const o = state.sceneObjects.get(id)
                if (o?.metadata) o.metadata.gridPosition = { x: newGridX, y: newGridY }
              }
            }
          }
          if (transform.rotation) {
            const o = state.sceneObjects.get(id)
            if (o) o.rotation = transform.rotation
          }
          if (transform.scale) {
            const o = state.sceneObjects.get(id)
            if (o) o.scale = transform.scale
          }
        }
      }),

    updateObjectName: (id: string, name: string) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          const o = state.sceneObjects.get(id)
          if (o) o.name = name
        }
      }),

    updateObjectVisibility: (id: string, visible: boolean) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          const o = state.sceneObjects.get(id)
          if (o) o.visible = visible
        }
      }),

    updateObjectLock: (id: string, locked: boolean) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          const o = state.sceneObjects.get(id)
          if (o) o.locked = locked
        }
      }),

    updateObjectMaterial: (
      id: string,
      material: { baseColor: string; metallic: number; roughness: number; texture?: string }
    ) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          const o = state.sceneObjects.get(id)
          if (o) o.material = material
        }
      }),

    // T18: link an object to a named preset. The object's resolved
    // material becomes preset + overrides; any prior material field
    // is retained for backward compatibility until the user unlinks.
    linkObjectToPreset: (id: string, presetId: string, overrides: Record<string, unknown>) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          const o = state.sceneObjects.get(id)
          if (o) {
            o.materialPresetId = presetId
            o.materialOverrides = overrides as {
              baseColor?: string
              metallic?: number
              roughness?: number
              emissive?: string
              emissiveIntensity?: number
              texture?: string
            }
          }
        }
      }),

    unlinkObjectFromPreset: (id: string) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          const o = state.sceneObjects.get(id)
          if (o) {
            delete o.materialPresetId
            delete o.materialOverrides
          }
        }
      }),

    updateObjectMesh: (id: string, meshType: 'cube' | 'sphere' | 'pyramid') =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          const o = state.sceneObjects.get(id)
          if (o) {
            o.meshType = meshType
            o.name = `${meshType.charAt(0).toUpperCase() + meshType.slice(1)}_${o.id.split('_')[1] || ''}`
          }
        }
      }),

    updateObjectProperties: (
      id: string,
      properties: { collision?: boolean; walkable?: boolean; tags?: string[]; metadata?: any }
    ) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          if (properties.collision !== undefined) {
            const o = state.sceneObjects.get(id)
            if (o) o.collision = properties.collision
          }
          if (properties.walkable !== undefined) {
            const o = state.sceneObjects.get(id)
            if (o) o.walkable = properties.walkable
          }
          if (properties.tags !== undefined) {
            const o = state.sceneObjects.get(id)
            if (o) o.tags = properties.tags
          }
          if (properties.metadata !== undefined) {
            const o = state.sceneObjects.get(id)
            if (o)
              o.metadata = {
                ...o.metadata,
                ...properties.metadata,
              }
          }
        }
      }),

    groupObjects: (ids: string[]) => {
      const groupId = `group_${Date.now()}`
      set(state => {
        // Calculate center position of selected objects
        let centerX = 0,
          centerY = 0,
          centerZ = 0
        const validObjects = ids
          .map(id => state.sceneObjects.get(id))
          .filter((obj): obj is NonNullable<typeof obj> => obj !== undefined)

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
        state.sceneObjects.set(groupId, {
          id: groupId,
          name: `Group_${state.sceneObjects.size + 1}`,
          type: 'group',
          position: [centerX, centerY, centerZ],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          visible: true,
          locked: false,
          layerId: state.activeLayer,
          children: ids,
        })

        // Update child objects to be parented to this group
        ids.forEach(id => {
          if (state.sceneObjects.has(id)) {
            const o = state.sceneObjects.get(id)
            if (o) o.parentId = groupId
          }
        })

        // Update selection to the new group
        state.selectedObjects = [groupId]
      })
      return groupId
    },

    ungroupObject: (groupId: string) =>
      set(state => {
        const group = state.sceneObjects.get(groupId)
        if (group && group.type === 'group') {
          // Clear parent relationships for children
          group.children.forEach(childId => {
            if (state.sceneObjects.has(childId)) {
              const o = state.sceneObjects.get(childId)
              if (o) o.parentId = undefined
            }
          })

          // Select the ungrouped objects
          state.selectedObjects = group.children

          // Remove the group object
          state.sceneObjects.delete(groupId)
        }
      }),

    // Undo/Redo system implementation
    executeCommand: (command: Command) =>
      set(state => {
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
      set(state => {
        if (state.undoHistory.length > 0) {
          const command = state.undoHistory.pop()!
          command.undo()
          state.redoHistory.push(command)
        }
      }),

    redo: () =>
      set(state => {
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
      set(state => {
        state.undoHistory = []
        state.redoHistory = []
      }),

    // Auto-save functionality
    saveToLocalStorage: () => {
      const state = useEditorStore.getState()
      // Map → Array of [id, obj] pairs for JSON serialization. JSON.stringify
      // doesn't natively serialize Map (it serializes as `{}`).
      const saveData = {
        gridData: state.gridData,
        selectedTheme: state.selectedTheme,
        sceneObjects: Array.from(state.sceneObjects.entries()),
        viewportMode: state.viewportMode,
        timestamp: new Date().toISOString(),
      }
      try {
        localStorage.setItem('morgan-bevy-autosave', JSON.stringify(saveData))
      } catch (error) {
        console.error('Failed to auto-save to localStorage:', error)
      }
    },

    // Debounced auto-save to prevent excessive saves
    debouncedAutoSave: (() => {
      let timeoutId: NodeJS.Timeout | null = null
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        timeoutId = setTimeout(() => {
          useEditorStore.getState().saveToLocalStorage()
        }, 2000) // 2 second debounce
      }
    })(),

    loadFromLocalStorage: () => {
      try {
        const saved = localStorage.getItem('morgan-bevy-autosave')
        if (saved) {
          const saveData = JSON.parse(saved)

          set(state => {
            if (saveData.gridData) {
              state.gridData = saveData.gridData
            }
            if (saveData.selectedTheme) {
              state.selectedTheme = saveData.selectedTheme
            }
            if (saveData.sceneObjects) {
              // Backwards-compat: a previous version may have stored
              // sceneObjects as a Record<string, T>. New versions store
              // it as an Array<[id, T]> (Map entries). Detect by shape.
              if (Array.isArray(saveData.sceneObjects)) {
                state.sceneObjects = new Map(saveData.sceneObjects)
              } else if (typeof saveData.sceneObjects === 'object') {
                state.sceneObjects = new Map(Object.entries(saveData.sceneObjects))
              } else {
                state.sceneObjects = new Map()
              }
            }
            if (saveData.viewportMode) {
              state.viewportMode = saveData.viewportMode
            }
          })

          return true
        }
      } catch (error) {
        console.error('Failed to load from localStorage:', error)
      }
      return false
    },

    clearLocalStorage: () => {
      try {
        localStorage.removeItem('morgan-bevy-autosave')
        console.log('Cleared auto-save data from localStorage')
      } catch (error) {
        console.error('Failed to clear localStorage:', error)
      }
    },
  }))
)

/**
 * Select a plain `Record` snapshot of `sceneObjects`. Useful for components
 * that iterate with `Object.entries` / `Object.keys` / `Object.values`. The
 * snapshot is recomputed on every store change — components that re-render
 * frequently should memoise with `useShallow` or read individual entries
 * via the Map.
 *
 * Prefer reading directly from the Map (`useEditorStore(s => s.sceneObjects.get(id))`)
 * when you need a single object.
 */
/**
 * Subscribes to `sceneObjects` and returns it as a Map. Prefer this over
 * destructuring the Map directly from the store — the selector here gives
 * zustand a stable identity so only components that actually use a key
 * rerender when that key changes.
 *
 * Migration note: the store now uses `Map<ObjectId, SceneObject>` internally
 * (T78). Existing components that iterated with `Object.entries(sceneObjects)`
 * or `Object.keys(sceneObjects)` need to switch to `map.entries()` /
 * `Array.from(map.keys())`.
 */
export function useSceneObjects(): Map<string, unknown> {
  return useEditorStore(s => s.sceneObjects)
}
