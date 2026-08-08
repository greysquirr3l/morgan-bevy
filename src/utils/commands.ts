import { useEditorStore, type EditorState, type SceneObject } from '@/store/editorStore'
import { deserializeMap, serializeMap } from '@/store/mapSerialization'
import { isObjectId, LayerId, ObjectId } from '@/types/brand'

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

// Delete object command
export class DeleteObjectCommand implements Command {
  private objectData: SceneObject
  public description: string

  constructor(objectId: ObjectId) {
    const { sceneObjects } = useEditorStore.getState()
    const data = sceneObjects.get(objectId)
    if (!data) {
      throw new Error(`DeleteObjectCommand: object ${objectId} not found`)
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
    this.sourceIds = sourceIds
    this.description = `Duplicate ${sourceIds.length} object(s)`
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

// Paste objects command
export class PasteCommand implements Command {
  private pastedObjects: Array<{
    id: ObjectId
    objectData: SceneObject
  }> = []
  public description: string

  constructor(
    private clipboardData: any,
    private position?: [number, number, number]
  ) {
    this.description = `Paste ${clipboardData?.objects?.length || 0} object(s)`
  }

  execute(): void {
    if (!this.clipboardData || !this.clipboardData.objects) {
      return
    }

    // Calculate offset for pasted objects
    const offset = this.position || [2, 0, 0]

    // Find center of copied objects to offset from
    let centerX = 0,
      centerY = 0,
      centerZ = 0
    this.clipboardData.objects.forEach((obj: any) => {
      centerX += obj.position[0]
      centerY += obj.position[1]
      centerZ += obj.position[2]
    })
    centerX /= this.clipboardData.objects.length
    centerY /= this.clipboardData.objects.length
    centerZ /= this.clipboardData.objects.length

    // Create new objects at offset positions
    useEditorStore.setState(state => {
      for (const objData of this.clipboardData.objects) {
        // Generation site (not a boundary): the id is minted here from
        // the pasted object's (user-controlled, possibly space-containing)
        // name. Use the plain constructor rather than `parseObjectId`,
        // which would throw on a name like "My Cube".
        const newId = ObjectId(
          `${objData.name}_paste_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        )
        const newPosition: [number, number, number] = [
          objData.position[0] - centerX + offset[0],
          objData.position[1] - centerY + offset[1],
          objData.position[2] - centerZ + offset[2],
        ]

        const newObjectData: SceneObject = {
          ...objData,
          id: newId,
          name: `${objData.name}_paste`,
          position: newPosition,
          parentId: undefined,
          children: [],
        }

        state.sceneObjects.set(newId, newObjectData)
        this.pastedObjects.push({ id: newId, objectData: newObjectData })
      }
    })
  }

  undo(): void {
    useEditorStore.setState(state => {
      this.pastedObjects.forEach(({ id }) => {
        state.sceneObjects.delete(id)
      })
    })
  }
}

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

    // Save to localStorage
    localStorage.setItem('morgan-bevy.scene', JSON.stringify(this.savedData))

    // Also create downloadable backup
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
