import { AUTOSAVE_KEY } from '@/hooks/useAutoSave'
import { deserializeMap, serializeMap } from '@/store/mapSerialization'
import { AssetId, isObjectId, LayerId, MaterialId, ObjectId, PrefabId } from '@/types/brand'
import type { AnimationMarker, AudioMarker, LightMarker, VfxMarker } from '@/types/markers'
import type { PatrolRoute, Waypoint } from '@/types/waypoints'
import type { Command } from '@/utils/commands'
import { DEFAULT_BRUSH_FALLOFF, DEFAULT_BRUSH_RADIUS, type BrushFalloff } from '@/utils/paintTool'
import type { UVTransform } from '@/utils/uvTransform'
import { enableMapSet, setAutoFreeze } from 'immer'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// Required for `state.sceneObjects.set(...)` / `.delete(...)` to work
// inside immer producers. Maps and Sets are not native to immer drafts.
enableMapSet()

// T79: explicit, rather than relying on immer's default. Every
// `set(state => ...)` producer's output (and everything reachable
// from it — individual `SceneObject`s, `Map` entries) is frozen, so
// a stale reference held by an undo command (or a component that
// forgot to reselect) throws on mutation instead of silently
// corrupting state that other subscribers still see as "current."
setAutoFreeze(true)

// Simple debug logger for store operations
class StoreDebugLogger {
  static log(message: string, data?: any) {
    const timestamp = Date.now()
    const logEntry = `[STORE] ${message}`
    console.log(`🔄 ${logEntry}`, data || '')

    // Also save to localStorage for persistence
    try {
      const existing = JSON.parse(localStorage.getItem('morgan-bevy.store-debug') || '[]')
      existing.push({
        timestamp,
        message: logEntry,
        data,
      })
      // Keep only last 50 entries
      if (existing.length > 50) existing.shift()
      localStorage.setItem('morgan-bevy.store-debug', JSON.stringify(existing))
    } catch (e) {
      console.error('Failed to save store debug logs:', e)
    }
  }
}

/**
 * A single object in the editor's scene graph. Extracted from the
 * store's `sceneObjects` map value type (T77b) so consumers can name
 * the shape directly instead of relying on structural inference.
 */
export interface SceneObject {
  id: ObjectId
  name: string
  type: 'mesh' | 'light' | 'group'
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  visible: boolean
  locked: boolean
  layerId: LayerId
  parentId?: ObjectId
  children: ObjectId[]
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
  materialPresetId?: MaterialId
  materialOverrides?: {
    baseColor?: string
    metallic?: number
    roughness?: number
    emissive?: string
    emissiveIntensity?: number
    texture?: string
  }
  // T19: when set, this object is a prefab instance. The id is the
  // source `Prefab.id`; clearing it (via `breakPrefab` in
  // src/utils/prefabs.ts) severs the link so future edits to the
  // source prefab don't propagate.
  prefabInstanceId?: PrefabId
  collision?: boolean
  walkable?: boolean
  tags?: string[]
  metadata?: any // Allow for flexible metadata including gridPosition, tileType, etc.
  // T91b: lighting / animation / audio / VFX markers. Each is
  // optional — an object with no markers must serialize with the
  // fields ABSENT (not `null`), matching the Rust
  // `#[serde(default, skip_serializing_if = "Option::is_none")]`
  // contract. Update actions use `delete o.light` to remove, not
  // `o.light = undefined`; the latter JSON-encodes as `"light": null`
  // and breaks the Rust skip rule. The shapes are owned by
  // `src/types/markers.ts` — never redeclare them here.
  light?: LightMarker
  animation?: AnimationMarker
  audio?: AudioMarker
  vfx?: VfxMarker
  // T51: optional snap points attached to this object. Empty
  // arrays are normalised to "absent" by the JSON round-trip
  // helpers (see `src/store/mapSerialization.ts`); the field is
  // present only when at least one snap point exists. The
  // shapes are owned by `src/types/snapPoints.ts` — never
  // redeclare them here.
  snapPoints?: import('@/types/snapPoints').SnapPoint[]
  // T54: per-mesh UV offset/scale set by the UV editor. Absent means
  // identity (the mesh's authored UVs, unmodified) — mirrors the
  // `snapPoints` convention above of "field present only when it
  // differs from the default," so untouched objects don't carry
  // dead weight through save/load.
  uvTransform?: UVTransform
}

/**
 * A single tile's rendering + gameplay data within a grid theme
 * (T24/T26). Mirrors the Rust-side tile definition surfaced by the
 * `list_themes` / `get_theme` Tauri commands. The index signatures
 * accept fields this store doesn't interpret itself (GridView and
 * App's grid-to-scene sync read them) without falling back to `any`.
 */
export interface TileMeshDefinition {
  tile_type?: string
  name?: string
  description?: string
  visual: {
    icon: string
    color: string
    background_color?: string | null
  }
  mesh: {
    mesh_type?: string
  }
  collision?: boolean
  walkable?: boolean
  tags?: string[]
}

/** A grid theme: the palette of tiles GridView paints with (T24). */
export interface SelectedTheme {
  id: string
  name?: string
  description?: string
  tiles: Record<string, TileMeshDefinition>
  [key: string]: unknown
}

export interface EditorState {
  // Selection
  selectedObjects: ObjectId[]
  hoveredObject: ObjectId | null

  // Grid data for 2D/3D sync
  gridData: string[][]
  selectedTheme: SelectedTheme | null
  // Audit (Major #20): the 48×36 grid size was hardcoded in both
  // `App.tsx#syncGridToScene` and `GridView`'s local state, so a
  // configurable grid (Tools > Grid Size, or a future Settings
  // panel entry) couldn't actually change the 3D-side conversion
  // or the canvas resize. Centralise here as the single source of
  // truth — both components read this slice.
  gridDimensions: { width: number; height: number }

  // Transform
  transformMode: 'select' | 'translate' | 'rotate' | 'scale'
  coordinateSpace: 'local' | 'world'
  snapToGrid: boolean
  gridSize: number

  // T54: material paint tool. Distinct from `transformMode` — the
  // paint tool is a separate interaction mode (P key) that doesn't
  // interfere with the transform gizmo. Brush settings persist
  // across toggles so re-activating keeps the last radius/falloff/
  // material.
  paintToolActive: boolean
  paintBrushRadius: number
  paintBrushFalloff: BrushFalloff
  paintTargetMaterialId: MaterialId | null

  // Viewport
  viewportMode: '3d' | '2d'

  // Camera
  cameraMode: 'orbit' | 'fly' | 'orthographic'
  // Whether the fly-camera pointer lock is currently engaged. Lives
  // in the store (not component state) because the fly-mode HUD is
  // rendered as a DOM sibling of <Canvas> in Viewport3D.tsx, outside
  // the R3F tree where CameraSystem actually tracks the lock.
  isCameraPointerLocked: boolean

  // Whether a TransformControls gizmo handle (move/rotate/scale) is
  // currently being dragged. Lives in the store (not component state)
  // because BoxSelection.tsx — a sibling of TransformGizmos.tsx, both
  // children of Viewport3D — needs to know a gizmo grab already
  // claimed the current pointer drag, so it doesn't also start a
  // box-selection drag on the same gesture (which would stomp the
  // selection on pointerup). See TransformGizmos.tsx's mouseDown/mouseUp
  // listeners on the underlying three-stdlib TransformControls instance.
  isTransformDragging: boolean

  // Layers
  activeLayer: LayerId
  layers: Array<{
    id: LayerId
    name: string
    visible: boolean
    locked: boolean
    color: string
  }>

  // Scene objects. T78: stored as a `Map` for O(1) insert/delete/lookup
  // (vs `Record`, where `delete` deoptimises V8's hidden class). Components
  // that need a plain `Record` view should use the `useSceneObjectsRecord`
  // selector below.
  sceneObjects: Map<ObjectId, SceneObject>

  // UI state
  showGrid: boolean
  showStats: boolean

  // Project file state (T20). `currentProjectPath` is the on-disk
  // path of the currently-loaded project file, or `null` if the
  // scene is unsaved / freshly created. `missingAssetRefs` is the
  // list of asset IDs the most-recent project file referenced that
  // the asset database could not resolve; rendered as a banner / badge.
  currentProjectPath: string | null
  missingAssetRefs: AssetId[]

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

  // T57: AI waypoints + patrol routes. Editor-authored, independent
  // of any particular navmesh generation — same "array of records +
  // add/remove/update actions" shape as `lights` above. Per-frame
  // interaction state (is the placement tool active) lives alongside
  // as a plain boolean, mirroring `paintToolActive`.
  waypoints: Waypoint[]
  patrolRoutes: PatrolRoute[]
  waypointPlacementActive: boolean
  waypointDefaultDwellTime: number

  // Undo/Redo system
  undoHistory: Command[]
  redoHistory: Command[]
  maxHistorySize: number

  // Actions
  setSelectedObjects: (ids: ObjectId[]) => void
  addToSelection: (id: ObjectId) => void
  removeFromSelection: (id: ObjectId) => void
  clearSelection: () => void
  setHoveredObject: (id: ObjectId | null) => void
  setTransformMode: (mode: 'select' | 'translate' | 'rotate' | 'scale') => void
  toggleCoordinateSpace: () => void

  // T54: material paint tool.
  setPaintToolActive: (active: boolean) => void
  setPaintBrushRadius: (radius: number) => void
  setPaintBrushFalloff: (falloff: BrushFalloff) => void
  setPaintTargetMaterialId: (id: MaterialId | null) => void
  updateObjectUVTransform: (id: ObjectId, transform: UVTransform) => void
  toggleSnapToGrid: () => void
  setGridSize: (size: number) => void
  setViewportMode: (mode: '3d' | '2d') => void
  setCameraMode: (mode: 'orbit' | 'fly' | 'orthographic') => void
  setCameraPointerLocked: (locked: boolean) => void
  setTransformDragging: (dragging: boolean) => void
  setGridData: (data: string[][]) => void
  setGridDimensions: (dims: { width: number; height: number }) => void
  setSelectedTheme: (theme: SelectedTheme | null) => void
  toggleGrid: () => void
  toggleStats: () => void

  // Project file (T20)
  setCurrentProjectPath: (path: string | null) => void
  setMissingAssetRefs: (ids: AssetId[]) => void

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
    }>
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
    }>
  ) => void

  // T57: waypoints. Mirrors the lighting actions above exactly.
  addWaypoint: (waypoint: Waypoint) => void
  removeWaypoint: (id: Waypoint['id']) => void
  updateWaypoint: (id: Waypoint['id'], patch: Partial<Omit<Waypoint, 'id'>>) => void
  setWaypointPlacementActive: (active: boolean) => void
  setWaypointDefaultDwellTime: (seconds: number) => void

  // T57: patrol routes.
  addPatrolRoute: (route: PatrolRoute) => void
  removePatrolRoute: (id: PatrolRoute['id']) => void
  updatePatrolRoute: (id: PatrolRoute['id'], patch: Partial<Omit<PatrolRoute, 'id'>>) => void

  // Object management
  addObject: (type: 'cube' | 'sphere' | 'pyramid', position?: [number, number, number]) => ObjectId
  addObjectDirect: (objectData: any) => void
  removeObject: (id: ObjectId) => void
  duplicateObjects: (ids: ObjectId[]) => ObjectId[]
  updateObjectTransform: (
    id: ObjectId,
    transform: Partial<{
      position: [number, number, number]
      rotation: [number, number, number]
      scale: [number, number, number]
    }>
  ) => void
  updateObjectName: (id: ObjectId, name: string) => void
  updateObjectVisibility: (id: ObjectId, visible: boolean) => void
  // T-hide: bulk visibility actions backing the H / Shift+H shortcuts.
  // Per-object toggling already goes through `updateObjectVisibility`
  // (the Hierarchy eye icon); these cover "hide everything I've got
  // selected" / "unhide everything in the scene" in one shot.
  hideSelection: () => void
  unhideAll: () => void
  updateObjectLock: (id: ObjectId, locked: boolean) => void
  updateObjectMaterial: (
    id: ObjectId,
    material: { baseColor: string; metallic: number; roughness: number; texture?: string }
  ) => void
  // T18: bind a scene object to a material preset. The object's
  // resolved material = preset + overrides. Pass an empty
  // overrides object to start fresh.
  linkObjectToPreset: (
    id: ObjectId,
    presetId: MaterialId,
    overrides: Record<string, unknown>
  ) => void
  // T18: unlink an object from its preset, copying the currently
  // effective material into the object's `material` field.
  unlinkObjectFromPreset: (id: ObjectId) => void
  updateObjectMesh: (id: ObjectId, meshType: 'cube' | 'sphere' | 'pyramid') => void
  updateObjectProperties: (
    id: ObjectId,
    properties: { collision?: boolean; walkable?: boolean; tags?: string[]; metadata?: any }
  ) => void
  // T91b: per-marker update actions. Pass `undefined` to REMOVE the
  // marker (the Inspector needs a "remove this marker" affordance).
  // Removal is implemented as `delete o.light` rather than
  // `o.light = undefined` — the latter serializes as `"light": null`
  // and breaks the Rust `skip_serializing_if = "Option::is_none"`
  // contract.
  updateObjectLight: (id: ObjectId, light: LightMarker | undefined) => void
  updateObjectAnimation: (id: ObjectId, animation: AnimationMarker | undefined) => void
  updateObjectAudio: (id: ObjectId, audio: AudioMarker | undefined) => void
  updateObjectVfx: (id: ObjectId, vfx: VfxMarker | undefined) => void
  groupObjects: (ids: ObjectId[]) => ObjectId
  ungroupObject: (groupId: ObjectId) => void
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
    selectedObjects: [] as ObjectId[],
    hoveredObject: null as ObjectId | null,
    gridData: [] as string[][],
    gridDimensions: { width: 48, height: 36 } as { width: number; height: number },
    selectedTheme: null as SelectedTheme | null,
    transformMode: 'select',
    coordinateSpace: 'world',
    snapToGrid: true,
    gridSize: 1.0,
    paintToolActive: false,
    paintBrushRadius: DEFAULT_BRUSH_RADIUS,
    paintBrushFalloff: DEFAULT_BRUSH_FALLOFF,
    paintTargetMaterialId: null as MaterialId | null,
    viewportMode: '3d' as '3d' | '2d',
    cameraMode: 'orbit',
    isCameraPointerLocked: false,
    isTransformDragging: false,
    activeLayer: LayerId('default'),
    layers: [
      { id: LayerId('default'), name: 'Default', visible: true, locked: false, color: '#ffffff' },
      { id: LayerId('walls'), name: 'Walls', visible: true, locked: false, color: '#8b5cf6' },
      { id: LayerId('floors'), name: 'Floors', visible: true, locked: false, color: '#10b981' },
      { id: LayerId('doors'), name: 'Doors', visible: true, locked: false, color: '#f59e0b' },
      { id: LayerId('lights'), name: 'Lights', visible: true, locked: false, color: '#fbbf24' },
    ],
    sceneObjects: new Map<ObjectId, SceneObject>(),
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
    missingAssetRefs: [] as AssetId[],

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

    // T57: waypoints + patrol routes. Empty until the user places
    // waypoints via the click-to-place tool or the settings panel.
    waypoints: [] as Waypoint[],
    patrolRoutes: [] as PatrolRoute[],
    waypointPlacementActive: false,
    waypointDefaultDwellTime: 0,

    // Undo/Redo system
    undoHistory: [] as Command[],
    redoHistory: [] as Command[],
    maxHistorySize: 50,

    // Actions
    setSelectedObjects: (ids: ObjectId[]) =>
      set(state => {
        state.selectedObjects = ids
      }),

    addToSelection: (id: ObjectId) =>
      set(state => {
        if (!state.selectedObjects.includes(id)) {
          state.selectedObjects.push(id)
        }
      }),

    removeFromSelection: (id: ObjectId) =>
      set(state => {
        state.selectedObjects = state.selectedObjects.filter(objId => objId !== id)
      }),

    clearSelection: () =>
      set(state => {
        state.selectedObjects = []
      }),

    setHoveredObject: (id: ObjectId | null) =>
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

    setPaintToolActive: (active: boolean) =>
      set(state => {
        state.paintToolActive = active
      }),

    setPaintBrushRadius: (radius: number) =>
      set(state => {
        // Guard against 0/negative radii reaching the brush math —
        // a non-positive radius would make `computeBrushHits` reject
        // every candidate silently, which reads as "the tool broke."
        state.paintBrushRadius = radius > 0 ? radius : state.paintBrushRadius
      }),

    setPaintBrushFalloff: (falloff: BrushFalloff) =>
      set(state => {
        state.paintBrushFalloff = falloff
      }),

    setPaintTargetMaterialId: (id: MaterialId | null) =>
      set(state => {
        state.paintTargetMaterialId = id
      }),

    updateObjectUVTransform: (id: ObjectId, transform: UVTransform) =>
      set(state => {
        const o = state.sceneObjects.get(id)
        if (o) o.uvTransform = transform
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
            localStorage.getItem('morgan-bevy.setViewportMode-calls') || '[]'
          )
          existing.push(debugEntry)
          // Keep only last 20 calls
          if (existing.length > 20) existing.shift()
          localStorage.setItem('morgan-bevy.setViewportMode-calls', JSON.stringify(existing))
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

    setCameraPointerLocked: (locked: boolean) =>
      set(state => {
        state.isCameraPointerLocked = locked
      }),

    setTransformDragging: (dragging: boolean) =>
      set(state => {
        state.isTransformDragging = dragging
      }),

    setGridData: (data: string[][]) =>
      set(state => {
        state.gridData = data
      }),

    setGridDimensions: (dims: { width: number; height: number }) =>
      set(state => {
        state.gridDimensions = dims
      }),

    setSelectedTheme: (theme: SelectedTheme | null) =>
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

    setMissingAssetRefs: (ids: AssetId[]) =>
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

    // T57: waypoint actions — mirrors the lighting actions above.
    addWaypoint: waypoint =>
      set(state => {
        state.waypoints.push(waypoint)
      }),

    removeWaypoint: id =>
      set(state => {
        state.waypoints = state.waypoints.filter(w => w.id !== id)
        // Drop the waypoint from every patrol route that referenced
        // it, and from any `nextWaypointId` link — a dangling
        // reference to a deleted waypoint would break traversal and
        // path rendering silently.
        for (const route of state.patrolRoutes) {
          route.waypointIds = route.waypointIds.filter(wid => wid !== id)
        }
        for (const w of state.waypoints) {
          if (w.nextWaypointId === id) delete w.nextWaypointId
        }
      }),

    updateWaypoint: (id, patch) =>
      set(state => {
        const idx = state.waypoints.findIndex(w => w.id === id)
        const current = state.waypoints[idx]
        if (idx === -1 || !current) return
        const merged: Waypoint = { ...current, ...patch }
        // A patch field explicitly set to `undefined` (the settings
        // panel's "clear dwell time" affordance) means "remove this
        // optional field", not "set it to the literal value
        // undefined" — mirrors `updateObjectLight`'s `delete o.light`
        // convention above: an absent key, not an `undefined`-valued
        // one, is what keeps a round-trip through JSON clean.
        if ('dwellTime' in patch && patch.dwellTime === undefined) delete merged.dwellTime
        if ('nextWaypointId' in patch && patch.nextWaypointId === undefined) {
          delete merged.nextWaypointId
        }
        state.waypoints[idx] = merged
      }),

    setWaypointPlacementActive: active =>
      set(state => {
        state.waypointPlacementActive = active
      }),

    setWaypointDefaultDwellTime: seconds =>
      set(state => {
        state.waypointDefaultDwellTime = seconds >= 0 ? seconds : state.waypointDefaultDwellTime
      }),

    // T57: patrol route actions.
    addPatrolRoute: route =>
      set(state => {
        state.patrolRoutes.push(route)
      }),

    removePatrolRoute: id =>
      set(state => {
        state.patrolRoutes = state.patrolRoutes.filter(r => r.id !== id)
      }),

    updatePatrolRoute: (id, patch) =>
      set(state => {
        const idx = state.patrolRoutes.findIndex(r => r.id === id)
        if (idx === -1) return
        state.patrolRoutes[idx] = { ...state.patrolRoutes[idx], ...patch }
      }),

    // Object management
    addObject: (
      type: 'cube' | 'sphere' | 'pyramid',
      position = [0, 0, 0] as [number, number, number]
    ) => {
      // Generation site (not a boundary): the id is minted here, not
      // parsed from untrusted input, so we use the plain constructor
      // rather than `parseObjectId` (which would throw needlessly).
      const id = ObjectId(`${type}_${Date.now()}`)
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
        // Fix (needed by PrefabManager's "Break Prefab" flow): use
        // the caller-supplied `type` instead of hardcoding 'mesh' —
        // non-mesh prefab members (light/group) were being silently
        // miscategorized as meshes. Default to 'mesh' only when the
        // caller doesn't pass one (e.g. App.tsx's grid-tile sync,
        // which only ever creates mesh tiles).
        const obj: SceneObject = {
          id: objectData.id,
          name: objectData.name,
          type: objectData.type ?? 'mesh',
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
        }
        // Fix (needed by PrefabManager's "Break Prefab" flow):
        // persist `prefabInstanceId` when provided so the broken
        // object retains its link back to the source prefab.
        // Convention (see the T91b comment above): an absent key,
        // not an `undefined`-valued one, is what keeps the JSON
        // round-trip clean — only set it when actually provided.
        if (objectData.prefabInstanceId !== undefined) {
          obj.prefabInstanceId = objectData.prefabInstanceId
        }
        state.sceneObjects.set(objectData.id, obj)
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
        state.activeLayer = LayerId('default')

        // Reset layers to default set
        state.layers = [
          {
            id: LayerId('default'),
            name: 'Default',
            visible: true,
            locked: false,
            color: '#ffffff',
          },
          { id: LayerId('walls'), name: 'Walls', visible: true, locked: false, color: '#8b5cf6' },
          { id: LayerId('floors'), name: 'Floors', visible: true, locked: false, color: '#10b981' },
          { id: LayerId('doors'), name: 'Doors', visible: true, locked: false, color: '#f59e0b' },
          { id: LayerId('lights'), name: 'Lights', visible: true, locked: false, color: '#fbbf24' },
        ]

        // Clear undo/redo history
        state.undoHistory = []
        state.redoHistory = []
      })
      // Trigger debounced auto-save after clearing scene
      useEditorStore.getState().debouncedAutoSave()
    },

    removeObject: (id: ObjectId) => {
      set(state => {
        // Defense in depth (item 3): `DeleteObjectCommand` and the
        // UI already gate on `locked` / layer-locked before calling
        // this action, but that's enforcement at the CALLER, not
        // here. Re-check at the store boundary so any future caller
        // that bypasses the command layer can't delete a locked
        // object — no-op rather than throw, matching the command
        // layer's "skip locked targets" behavior.
        const obj = state.sceneObjects.get(id)
        if (!obj) return
        const layer = state.layers.find(l => l.id === obj.layerId)
        if (obj.locked || layer?.locked) return
        state.sceneObjects.delete(id)
        state.selectedObjects = state.selectedObjects.filter(objId => objId !== id)
      })
      // Trigger debounced auto-save after removing object
      useEditorStore.getState().debouncedAutoSave()
    },

    duplicateObjects: (ids: ObjectId[]) => {
      const newIds: ObjectId[] = []
      set(state => {
        ids.forEach(id => {
          const original = state.sceneObjects.get(id)
          if (!original) return
          // Defense in depth (item 3): same lock re-check as
          // `removeObject` above — `DuplicateCommand` already
          // filters locked sources, but a future direct caller of
          // this action shouldn't be able to duplicate a locked
          // object or one on a locked layer. Skip it, don't throw.
          if (original.locked) return
          const layer = state.layers.find(l => l.id === original.layerId)
          if (layer?.locked) return
          // Generation site: minted here, not parsed from
          // untrusted input — use the plain constructor.
          const newId = ObjectId(`${original.name}_copy_${Date.now()}`)
          state.sceneObjects.set(newId, {
            ...original,
            id: newId,
            name: `${original.name}_copy`,
            position: [original.position[0] + 2, original.position[1], original.position[2]],
          })
          newIds.push(newId)
        })
      })
      return newIds
    },

    updateObjectTransform: (
      id: ObjectId,
      transform: Partial<{
        position: [number, number, number]
        rotation: [number, number, number]
        scale: [number, number, number]
      }>
    ) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          // Defense in depth (item 3): `TransformCommand` and the
          // gizmo/Inspector callers already gate on `locked` /
          // layer-locked, but that's enforcement at the CALLER, not
          // here. Re-check at the store boundary so any future
          // caller that bypasses those checks can't move a locked
          // object — no-op rather than throw.
          const target = state.sceneObjects.get(id)
          const targetLayer = target && state.layers.find(l => l.id === target.layerId)
          if (target?.locked || targetLayer?.locked) return

          if (transform.position) {
            const o = state.sceneObjects.get(id)
            // Clone rather than alias the incoming array: storing
            // the caller's own array reference means any later
            // mutation of that reference (e.g. a caller that
            // shallow-copies a transform object elsewhere) would
            // silently corrupt the committed scene state too.
            if (o) o.position = [...transform.position]

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
            if (o) o.rotation = [...transform.rotation]
          }
          if (transform.scale) {
            const o = state.sceneObjects.get(id)
            if (o) o.scale = [...transform.scale]
          }
        }
      }),

    updateObjectName: (id: ObjectId, name: string) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          const o = state.sceneObjects.get(id)
          if (o) o.name = name
        }
      }),

    updateObjectVisibility: (id: ObjectId, visible: boolean) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          const o = state.sceneObjects.get(id)
          if (o) o.visible = visible
        }
      }),

    hideSelection: () =>
      set(state => {
        state.selectedObjects.forEach(id => {
          const o = state.sceneObjects.get(id)
          if (o) o.visible = false
        })
      }),

    unhideAll: () =>
      set(state => {
        state.sceneObjects.forEach(o => {
          o.visible = true
        })
      }),

    updateObjectLock: (id: ObjectId, locked: boolean) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          const o = state.sceneObjects.get(id)
          if (o) o.locked = locked
        }
      }),

    updateObjectMaterial: (
      id: ObjectId,
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
    linkObjectToPreset: (id: ObjectId, presetId: MaterialId, overrides: Record<string, unknown>) =>
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

    unlinkObjectFromPreset: (id: ObjectId) =>
      set(state => {
        if (state.sceneObjects.has(id)) {
          const o = state.sceneObjects.get(id)
          if (o) {
            delete o.materialPresetId
            delete o.materialOverrides
          }
        }
      }),

    updateObjectMesh: (id: ObjectId, meshType: 'cube' | 'sphere' | 'pyramid') =>
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
      id: ObjectId,
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

    // T91b: per-marker update. Pass `undefined` to REMOVE the marker
    // (the Inspector's "remove" affordance). Removal is `delete`,
    // never assignment of `undefined` — `undefined` would JSON-encode
    // as `"light": null` and trip the Rust `skip_serializing_if` rule.
    // Untrusted callers should validate the marker shape with the
    // zod schemas in `@/types/schemas` before passing it in.
    updateObjectLight: (id: ObjectId, light: LightMarker | undefined) =>
      set(state => {
        if (!state.sceneObjects.has(id)) return
        const o = state.sceneObjects.get(id)
        if (!o) return
        if (light === undefined) {
          delete o.light
        } else {
          o.light = light
        }
      }),

    updateObjectAnimation: (id: ObjectId, animation: AnimationMarker | undefined) =>
      set(state => {
        if (!state.sceneObjects.has(id)) return
        const o = state.sceneObjects.get(id)
        if (!o) return
        if (animation === undefined) {
          delete o.animation
        } else {
          o.animation = animation
        }
      }),

    updateObjectAudio: (id: ObjectId, audio: AudioMarker | undefined) =>
      set(state => {
        if (!state.sceneObjects.has(id)) return
        const o = state.sceneObjects.get(id)
        if (!o) return
        if (audio === undefined) {
          delete o.audio
        } else {
          o.audio = audio
        }
      }),

    updateObjectVfx: (id: ObjectId, vfx: VfxMarker | undefined) =>
      set(state => {
        if (!state.sceneObjects.has(id)) return
        const o = state.sceneObjects.get(id)
        if (!o) return
        if (vfx === undefined) {
          delete o.vfx
        } else {
          o.vfx = vfx
        }
      }),

    groupObjects: (ids: ObjectId[]) => {
      // Generation site: minted here, not parsed from untrusted
      // input — use the plain constructor.
      const groupId = ObjectId(`group_${Date.now()}`)
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

    ungroupObject: (groupId: ObjectId) =>
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

    // Undo / redo MUST execute the command OUTSIDE the outer `set()`
    // producer: every `Command.undo()` / `Command.execute()` reaches
    // back into the store via its own `set()` (e.g. `TransformCommand`
    // calls `updateObjectTransform`). With zustand + immer, a nested
    // `set()` commits first to a fresh draft and then the outer
    // producer's draft commits last, silently overwriting the inner
    // commit's `sceneObjects` / material / etc. The previous
    // implementation had exactly this bug — Ctrl+Z would pop the
    // command and disable the button, but the object never
    // reappeared.
    undo: () => {
      const snapshot = useEditorStore.getState()
      if (snapshot.undoHistory.length === 0) return
      const last = snapshot.undoHistory[snapshot.undoHistory.length - 1]
      // Execute FIRST (commits via its own set()), THEN update history.
      last.undo()
      set(state => {
        state.undoHistory.pop()
        state.redoHistory.push(last)
      })
    },

    redo: () => {
      const snapshot = useEditorStore.getState()
      if (snapshot.redoHistory.length === 0) return
      const next = snapshot.redoHistory[snapshot.redoHistory.length - 1]
      next.execute()
      set(state => {
        state.redoHistory.pop()
        state.undoHistory.push(next)
      })
    },

    canUndo: (): boolean => {
      const state = useEditorStore.getState()
      return state.undoHistory.length > 0
    },

    canRedo: (): boolean => {
      const state = useEditorStore.getState()
      return state.redoHistory.length > 0
    },

    // Audit (Minor #24): `clearHistory` used to be a thin subset
    // of `clearScene` (just undo/redo + scene map + selection +
    // active layer) and the two could drift apart. Collapse them
    // — `clearHistory` now calls `clearScene` so there's one
    // reset path. The undo/redo reset that the name implies is
    // still performed by `clearScene` (which clears both
    // `undoHistory` and `redoHistory` as part of its reset).
    clearHistory: () => {
      useEditorStore.getState().clearScene()
    },

    // Auto-save functionality
    saveToLocalStorage: () => {
      const state = useEditorStore.getState()
      // Audit (Critical #5) regression: this used to write the
      // legacy schema `{ gridData, selectedTheme, sceneObjects,
      // viewportMode, timestamp }` while `useAutoSave.ts` was
      // already writing the new schema `{ schemaVersion, savedAt,
      // scene: { objects, layers, activeLayer, selectedObjects } }`
      // to the SAME `morgan-bevy.autosave` key. The two writers
      // raced: depending on which one ran last, the startup recovery
      // dialog either saw the new shape (and silently bailed because
      // it only checked the old keys) or the old shape (which
      // couldn't include layers / activeLayer / selectedObjects).
      //
      // Write the new schema here so both writers are compatible.
      // `loadFromLocalStorage` and the recovery dialog in App.tsx
      // learn to read either schema.
      const saveData = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        scene: {
          objects: serializeMap(state.sceneObjects),
          layers: state.layers,
          activeLayer: state.activeLayer,
          selectedObjects: state.selectedObjects,
        },
        // Preserve the legacy top-level fields so older readers
        // (and the manual File > Save indicator) still see them.
        // The recovery dialog prefers the new `scene.objects`
        // shape and only falls back to these when absent.
        gridData: state.gridData,
        selectedTheme: state.selectedTheme,
        viewportMode: state.viewportMode,
      }
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(saveData))
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
        const saved = localStorage.getItem(AUTOSAVE_KEY)
        if (saved) {
          const saveData = JSON.parse(saved)

          set(state => {
            // New schema (audit Critical #5): everything lives under
            // `scene`. Object entries are `Array<[id, T]>` because the
            // store keeps sceneObjects as a `Map`.
            if (saveData.scene && typeof saveData.scene === 'object') {
              if (Array.isArray(saveData.scene.objects)) {
                state.sceneObjects = deserializeMap<ObjectId, SceneObject>(
                  saveData.scene.objects,
                  isObjectId
                )
              }
              if (Array.isArray(saveData.scene.layers)) {
                state.layers = saveData.scene.layers
              }
              if (saveData.scene.activeLayer !== undefined) {
                state.activeLayer = LayerId(saveData.scene.activeLayer)
              }
              if (Array.isArray(saveData.scene.selectedObjects)) {
                state.selectedObjects = saveData.scene.selectedObjects
              }
            }
            // Legacy schema fields (still emitted by `saveToLocalStorage`
            // for back-compat with the recovery dialog):
            if (saveData.gridData) {
              state.gridData = saveData.gridData
            }
            if (saveData.selectedTheme) {
              state.selectedTheme = saveData.selectedTheme
            }
            if (saveData.sceneObjects && !saveData.scene) {
              // Pre-fix payloads: sceneObjects lived at the top
              // level. Backwards-compat: a previous version may have
              // stored sceneObjects as a Record<string, T>; new
              // versions store Array<[id, T]> (Map entries).
              // `deserializeMap` normalizes both shapes and drops
              // (rather than throws on) any entry whose id fails
              // validation.
              state.sceneObjects = deserializeMap<ObjectId, SceneObject>(
                saveData.sceneObjects,
                isObjectId
              )
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
        localStorage.removeItem('morgan-bevy.autosave')
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
export function useSceneObjects(): Map<ObjectId, SceneObject> {
  return useEditorStore(s => s.sceneObjects)
}
