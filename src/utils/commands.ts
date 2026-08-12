import { useEditorStore, type EditorState, type SceneObject } from '@/store/editorStore'
import { deserializeMap, serializeMap } from '@/store/mapSerialization'
import { isObjectId, LayerId, MaterialId, ObjectId } from '@/types/brand'

// Base command interface
export interface Command {
  execute(): void
  undo(): void
  description: string
}

// Transform command for object position, rotation, scale changes
export class TransformCommand implements Command {
  private objectId: ObjectId
  private oldTransform: {
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  }
  private newTransform: {
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  }
  public description: string

  constructor(
    objectId: ObjectId,
    oldTransform: {
      position: [number, number, number]
      rotation: [number, number, number]
      scale: [number, number, number]
    },
    newTransform: {
      position: [number, number, number]
      rotation: [number, number, number]
      scale: [number, number, number]
    }
  ) {
    this.objectId = objectId
    this.oldTransform = oldTransform
    this.newTransform = newTransform
    this.description = `Transform ${objectId}`
  }

  execute(): void {
    const { updateObjectTransform } = useEditorStore.getState()
    updateObjectTransform(this.objectId, this.newTransform)
  }

  undo(): void {
    const { updateObjectTransform } = useEditorStore.getState()
    updateObjectTransform(this.objectId, this.oldTransform)
  }
}

// T54 — Paint command: one command per brush stroke, not per hit.
// A stroke can touch many objects as the cursor drags across the
// scene; `usePaintTool` accumulates every distinct object touched
// during the pointer-down..pointer-up window (applying the material
// live for immediate feedback) and builds a single `PaintCommand`
// on pointer-up covering all of them. That keeps the undo stack at
// one entry per stroke, matching `TransformCommand`'s one-entry-
// per-drag shape rather than one entry per mousemove.
//
// Each target snapshots exactly enough of its PRE-stroke material
// state to restore it: either the preset it was linked to (+ its
// overrides), or its raw `material` field if it wasn't linked to a
// preset, or neither if the object had no material at all. This is
// a delta, not a full-object snapshot — consistent with
// `TransformCommand` capturing only old/new transforms rather than
// the whole `SceneObject`.
export interface PaintTargetSnapshot {
  objectId: ObjectId
  previousMaterialPresetId?: MaterialId
  previousMaterialOverrides?: SceneObject['materialOverrides']
  previousMaterial?: SceneObject['material']
}

export class PaintCommand implements Command {
  private targets: PaintTargetSnapshot[]
  private materialPresetId: MaterialId
  public description: string

  constructor(targets: PaintTargetSnapshot[], materialPresetId: MaterialId) {
    this.targets = targets
    this.materialPresetId = materialPresetId
    this.description = `Paint ${targets.length} object(s)`
  }

  execute(): void {
    const { linkObjectToPreset } = useEditorStore.getState()
    this.targets.forEach(target => {
      linkObjectToPreset(target.objectId, this.materialPresetId, {})
    })
  }

  undo(): void {
    const { linkObjectToPreset, unlinkObjectFromPreset, updateObjectMaterial } =
      useEditorStore.getState()
    this.targets.forEach(target => {
      if (target.previousMaterialPresetId) {
        linkObjectToPreset(
          target.objectId,
          target.previousMaterialPresetId,
          target.previousMaterialOverrides ?? {}
        )
      } else if (target.previousMaterial) {
        unlinkObjectFromPreset(target.objectId)
        updateObjectMaterial(target.objectId, target.previousMaterial)
      } else {
        unlinkObjectFromPreset(target.objectId)
      }
    })
  }
}

// Create object command
export class CreateObjectCommand implements Command {
  public objectId: ObjectId
  private objectType: 'cube' | 'sphere' | 'pyramid'
  private position: [number, number, number]
  public description: string

  constructor(objectType: 'cube' | 'sphere' | 'pyramid', position: [number, number, number]) {
    this.objectType = objectType
    this.position = position
    this.objectId = ObjectId('') // Will be set after execution
    this.description = `Create ${objectType}`
  }

  execute(): void {
    const { addObject } = useEditorStore.getState()
    this.objectId = addObject(this.objectType, this.position)
  }

  undo(): void {
    const { removeObject } = useEditorStore.getState()
    removeObject(this.objectId)
  }
}

/**
 * Audit (Major #3) regression: the previous `CreateObjectCommand`
 * only knew about `meshType` + `position`. Instantiating a prefab
 * via that command dropped every other field (rotation, scale,
 * material, tags, name, layerId, visibility) — the prefab system
 * looked like it worked in the library but produced untextured,
 * un-rotated, identically-scaled cubes in the scene. This command
 * takes a full `SceneObject` template (rotation, scale, material,
 * tags, etc.) and inserts it via `addObjectDirect`, preserving the
 * snapshot verbatim so undo restores exactly what was placed.
 */
export class CreateObjectFromTemplateCommand implements Command {
  public objectId: ObjectId
  private template: SceneObject
  public description: string

  constructor(template: SceneObject) {
    this.template = { ...template }
    // The id is minted here, not in `addObjectDirect`, because
    // `addObjectDirect` writes whatever id is on the input — the
    // canonical id-generation site for new objects is the store,
    // but it delegates id minting to callers when an external
    // template (e.g. a prefab object) is being inserted.
    this.objectId = ObjectId(`${template.meshType ?? 'mesh'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)
    this.template.id = this.objectId
    this.description = `Create ${template.name}`
  }

  execute(): void {
    const { addObjectDirect } = useEditorStore.getState()
    addObjectDirect(this.template)
  }

  undo(): void {
    const { removeObject } = useEditorStore.getState()
    removeObject(this.objectId)
  }
}

// Delete object command
export class DeleteObjectCommand implements Command {
  private objectData: SceneObject
  public description: string

  constructor(objectId: ObjectId) {
    const { sceneObjects, layers } = useEditorStore.getState()
    const data = sceneObjects.get(objectId)
    if (!data) {
      throw new Error(`DeleteObjectCommand: object ${objectId} not found`)
    }
    // Audit (Major #11) regression: the `locked` flag on objects
    // and layers was checked only for cosmetic display (Hierarchy
    // eye icon, layer name colour). Delete-on-keypress / Delete in
    // the ActionsPanel / Edit-menu > Delete all silently
    // overwrote it. Bail out of the command's construction so the
    // caller can no-op the action — `Delete` becomes a no-op
    // against locked targets rather than a "wait, where did that
    // go?" footgun.
    const layer = layers.find(l => l.id === data.layerId)
    if (data.locked) {
      throw new Error(`DeleteObjectCommand: object ${objectId} is locked`)
    }
    if (layer?.locked) {
      throw new Error(`DeleteObjectCommand: object ${objectId} is on a locked layer`)
    }
    this.objectData = data
    this.description = `Delete ${this.objectData.name}`
  }

  execute(): void {
    const { removeObject } = useEditorStore.getState()
    removeObject(this.objectData.id)
  }

  undo(): void {
    // Manually restore object to store using setState
    useEditorStore.setState(state => {
      // Use immer's draft to safely modify the state
      state.sceneObjects.set(this.objectData.id, this.objectData)
    })
  }
}

// Duplicate objects command
export class DuplicateCommand implements Command {
  private sourceIds: ObjectId[]
  private duplicatedIds: ObjectId[] = []
  public description: string

  constructor(sourceIds: ObjectId[]) {
    // Audit (Major #11) regression: `Duplicate` (Ctrl+D) used to
    // copy every selected object, including locked ones. Filter
    // locked objects + objects on locked layers out of the source
    // set so the resulting duplicate count matches what the user
    // can actually edit.
    const { sceneObjects, layers } = useEditorStore.getState()
    const filtered = sourceIds.filter(id => {
      const obj = sceneObjects.get(id)
      if (!obj) return false
      if (obj.locked) return false
      const layer = layers.find(l => l.id === obj.layerId)
      if (layer?.locked) return false
      return true
    })
    this.sourceIds = filtered
    this.description = `Duplicate ${filtered.length} object(s)`
  }

  execute(): void {
    const { duplicateObjects } = useEditorStore.getState()
    this.duplicatedIds = duplicateObjects(this.sourceIds)
  }

  undo(): void {
    const { removeObject } = useEditorStore.getState()
    this.duplicatedIds.forEach(id => removeObject(id))
  }
}

// T88 audit removed SelectionCommand + CompositeCommand: both were
// exported but never instantiated anywhere in src/. The selection
// store already exposes setSelectedObjects for direct (non-undoable)
// updates, and grouping multi-step operations can use a future
// CommandSequence abstraction rather than a parallel hierarchy.

// Group objects command
export class GroupCommand implements Command {
  private objectIds: ObjectId[]
  private groupId: ObjectId = ObjectId('')
  public description: string

  constructor(objectIds: ObjectId[]) {
    this.objectIds = objectIds
    this.description = `Group ${objectIds.length} object(s)`
  }

  execute(): void {
    const { groupObjects } = useEditorStore.getState()
    this.groupId = groupObjects(this.objectIds)
  }

  undo(): void {
    const { ungroupObject } = useEditorStore.getState()
    if (this.groupId) {
      ungroupObject(this.groupId)
    }
  }
}

// Ungroup objects command
export class UngroupCommand implements Command {
  private groupId: ObjectId
  private groupData: any = null
  private childIds: ObjectId[] = []
  public description: string

  constructor(groupId: ObjectId) {
    this.groupId = groupId
    const state = useEditorStore.getState()
    this.groupData = { ...state.sceneObjects.get(groupId) }
    this.childIds = this.groupData.children ?? []
    this.description = `Ungroup ${this.childIds.length} object(s)`
  }

  execute(): void {
    const { ungroupObject } = useEditorStore.getState()
    ungroupObject(this.groupId)
  }

  undo(): void {
    // Recreate the group
    useEditorStore.setState(state => {
      // Restore group object
      state.sceneObjects.set(this.groupId, { ...this.groupData })

      // Re-parent children
      this.childIds.forEach(childId => {
        const child = state.sceneObjects.get(childId)
        if (child) {
          child.parentId = this.groupId
        }
      })

      // Select the group
      state.selectedObjects = [this.groupId]
    })
  }
}

// PasteCommand removed in T60 (wiring audit caught it as dead code).
// The hook's paste shortcut calls `clipboard.paste()` directly;
// the clipboard manager writes straight into the store. A future
// T60b could add a `PasteCommand` if undoable paste becomes a need.

// Save command for persisting scene to localStorage
export class SaveCommand implements Command {
  private savedData: any
  public description: string

  constructor(fileName?: string) {
    this.description = `Save scene${fileName ? ` as ${fileName}` : ''}`
  }

  execute(): void {
    const state = useEditorStore.getState()

    // Create save data
    this.savedData = {
      metadata: {
        version: '1.0.0',
        editor: 'Morgan-Bevy',
        savedAt: new Date().toISOString(),
        objectCount: state.sceneObjects.size,
        layerCount: state.layers.length,
      },
      scene: {
        // A full snapshot is correct here, not a structural-sharing
        // concern: this is a one-shot export to JSON (localStorage +
        // file download), not a step in the undo stack. There's no
        // "N snapshots held in memory simultaneously" cost to avoid —
        // `undo()` below is a no-op, so this command never keeps more
        // than the one array alive.
        objects: serializeMap(state.sceneObjects),
        layers: state.layers,
        activeLayer: state.activeLayer,
        settings: {
          gridSize: state.gridSize,
          snapToGrid: state.snapToGrid,
          transformMode: state.transformMode,
          coordinateSpace: state.coordinateSpace,
        },
      },
    }

    // Save the canonical backup as a downloadable file. We do NOT
    // mirror to `localStorage` here — the `useAutoSave` hook already
    // persists the live editor state under the `morgan-bevy.autosave`
    // key. Writing the same data under `morgan-bevy.scene` was
    // orphaned (no code read it back) and just doubled the storage
    // cost on every save. File download + autosave are the two save
    // paths now.
    const blob = new Blob([JSON.stringify(this.savedData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `morgan-scene-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  undo(): void {
    // Cannot undo a save operation
  }
}

/**
 * Scene payload `LoadCommand` accepts. Two calling conventions exist
 * in the codebase: `FileMenu`/`useStartupFile` pass the zod-parsed
 * `ProjectData.scene` sub-object directly; the raw-file `handleLoad`
 * path and `useKeyboardShortcuts` pass the whole parsed file (which
 * nests the same shape under `.scene`). `execute()` resolves
 * `newData.scene ?? newData` so either convention loads correctly
 * instead of silently no-op'ing when the two don't line up.
 */
interface LoadableSceneData {
  objects?: unknown
  layers?: EditorState['layers']
  activeLayer?: string
  settings?: {
    gridSize?: number
    snapToGrid?: boolean
    transformMode?: EditorState['transformMode']
    coordinateSpace?: EditorState['coordinateSpace']
  }
}
type LoadCommandData = LoadableSceneData & { scene?: LoadableSceneData }

interface LoadSnapshot {
  sceneObjects: Map<ObjectId, SceneObject>
  layers: EditorState['layers']
  activeLayer: EditorState['activeLayer']
  selectedObjects: ObjectId[]
  settings: {
    gridSize: number
    snapToGrid: boolean
    transformMode: EditorState['transformMode']
    coordinateSpace: EditorState['coordinateSpace']
  }
}

// Load command for restoring scene from data
export class LoadCommand implements Command {
  private previousState: LoadSnapshot | null = null
  private newData: LoadCommandData
  public description: string

  constructor(sceneData: LoadCommandData) {
    this.newData = sceneData
    this.description = 'Load scene'
  }

  execute(): void {
    const state = useEditorStore.getState()

    // Snapshot the CURRENT scene before overwriting it, for undo.
    // `sceneObjects` is a `Map` (T78) — `new Map(...)` clones it.
    // The previous `{ ...state.sceneObjects }` object-spread produced
    // `{}` (a Map's entries aren't own enumerable properties), so
    // undoing a load silently wiped every object in the scene.
    this.previousState = {
      sceneObjects: new Map(state.sceneObjects),
      layers: [...state.layers],
      activeLayer: state.activeLayer,
      selectedObjects: [...state.selectedObjects],
      settings: {
        gridSize: state.gridSize,
        snapToGrid: state.snapToGrid,
        transformMode: state.transformMode,
        coordinateSpace: state.coordinateSpace,
      },
    }

    const scene = this.newData.scene ?? this.newData

    useEditorStore.setState(draft => {
      draft.sceneObjects = deserializeMap<ObjectId, SceneObject>(scene.objects, isObjectId)
      draft.layers = scene.layers ?? draft.layers
      draft.activeLayer = scene.activeLayer ? LayerId(scene.activeLayer) : LayerId('default')
      draft.selectedObjects = []

      if (scene.settings) {
        draft.gridSize = scene.settings.gridSize ?? draft.gridSize
        draft.snapToGrid = scene.settings.snapToGrid ?? false
        draft.transformMode = scene.settings.transformMode ?? 'select'
        draft.coordinateSpace = scene.settings.coordinateSpace ?? 'world'
      }
    })
  }

  undo(): void {
    const snapshot = this.previousState
    if (!snapshot) return
    useEditorStore.setState(draft => {
      draft.sceneObjects = snapshot.sceneObjects
      draft.layers = snapshot.layers
      draft.activeLayer = snapshot.activeLayer
      draft.selectedObjects = snapshot.selectedObjects
      draft.gridSize = snapshot.settings.gridSize
      draft.snapToGrid = snapshot.settings.snapToGrid
      draft.transformMode = snapshot.settings.transformMode
      draft.coordinateSpace = snapshot.settings.coordinateSpace
    })
  }
}
