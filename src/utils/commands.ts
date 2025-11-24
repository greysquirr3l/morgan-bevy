import { useEditorStore } from '@/store/editorStore'

// Base command interface
export interface Command {
  execute(): void
  undo(): void
  description: string
}

// Transform command for object position, rotation, scale changes
export class TransformCommand implements Command {
  private objectId: string
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
    objectId: string,
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
  private objectId: string
  private objectType: 'cube' | 'sphere' | 'pyramid'
  private position: [number, number, number]
  public description: string

  constructor(objectType: 'cube' | 'sphere' | 'pyramid', position: [number, number, number]) {
    this.objectType = objectType
    this.position = position
    this.objectId = '' // Will be set after execution
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
  private objectData: {
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
  }
  public description: string

  constructor(objectId: string) {
    const { sceneObjects } = useEditorStore.getState()
    this.objectData = sceneObjects[objectId]
    this.description = `Delete ${this.objectData.name}`
  }

  execute(): void {
    const { removeObject } = useEditorStore.getState()
    removeObject(this.objectData.id)
  }

  undo(): void {
    // Manually restore object to store using setState
    useEditorStore.setState((state) => {
      // Use immer's draft to safely modify the state
      state.sceneObjects[this.objectData.id] = this.objectData
    })
  }
}

// Duplicate objects command
export class DuplicateCommand implements Command {
  private sourceIds: string[]
  private duplicatedIds: string[] = []
  public description: string

  constructor(sourceIds: string[]) {
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

// Selection command
export class SelectionCommand implements Command {
  private oldSelection: string[]
  private newSelection: string[]
  public description: string

  constructor(oldSelection: string[], newSelection: string[]) {
    this.oldSelection = oldSelection
    this.newSelection = newSelection
    this.description = `Select ${newSelection.length} object(s)`
  }

  execute(): void {
    const { setSelectedObjects } = useEditorStore.getState()
    setSelectedObjects(this.newSelection)
  }

  undo(): void {
    const { setSelectedObjects } = useEditorStore.getState()
    setSelectedObjects(this.oldSelection)
  }
}

// Composite command for multiple operations
export class CompositeCommand implements Command {
  private commands: Command[]
  public description: string

  constructor(commands: Command[], description: string) {
    this.commands = commands
    this.description = description
  }

  execute(): void {
    this.commands.forEach(command => command.execute())
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo()
    }
  }
}

// Group objects command
export class GroupCommand implements Command {
  private objectIds: string[]
  private groupId: string = ''
  public description: string

  constructor(objectIds: string[]) {
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
  private groupId: string
  private groupData: any = null
  private childIds: string[] = []
  public description: string

  constructor(groupId: string) {
    this.groupId = groupId
    const state = useEditorStore.getState()
    this.groupData = { ...state.sceneObjects[groupId] }
    this.childIds = this.groupData.children || []
    this.description = `Ungroup ${this.childIds.length} object(s)`
  }

  execute(): void {
    const { ungroupObject } = useEditorStore.getState()
    ungroupObject(this.groupId)
  }

  undo(): void {
    // Recreate the group
    useEditorStore.setState((state) => {
      // Restore group object
      state.sceneObjects[this.groupId] = { ...this.groupData }
      
      // Re-parent children
      this.childIds.forEach(childId => {
        if (state.sceneObjects[childId]) {
          state.sceneObjects[childId].parentId = this.groupId
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
    id: string
    objectData: any
  }> = []
  public description: string

  constructor(private clipboardData: any, private position?: [number, number, number]) {
    this.description = `Paste ${clipboardData?.objects?.length || 0} object(s)`
  }

  execute(): void {
    if (!this.clipboardData || !this.clipboardData.objects) {
      return
    }

    // Calculate offset for pasted objects
    const offset = this.position || [2, 0, 0]
    
    // Find center of copied objects to offset from
    let centerX = 0, centerY = 0, centerZ = 0
    this.clipboardData.objects.forEach((obj: any) => {
      centerX += obj.position[0]
      centerY += obj.position[1]
      centerZ += obj.position[2]
    })
    centerX /= this.clipboardData.objects.length
    centerY /= this.clipboardData.objects.length
    centerZ /= this.clipboardData.objects.length

    // Create new objects at offset positions
    useEditorStore.setState((state: any) => {
      for (const objData of this.clipboardData.objects) {
        const newId = `${objData.name}_paste_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        const newPosition: [number, number, number] = [
          objData.position[0] - centerX + offset[0],
          objData.position[1] - centerY + offset[1],
          objData.position[2] - centerZ + offset[2]
        ]

        const newObjectData = {
          ...objData,
          id: newId,
          name: `${objData.name}_paste`,
          position: newPosition,
          parentId: undefined,
          children: []
        }

        state.sceneObjects[newId] = newObjectData
        this.pastedObjects.push({ id: newId, objectData: newObjectData })
      }
    })
  }

  undo(): void {
    useEditorStore.setState((state: any) => {
      this.pastedObjects.forEach(({ id }) => {
        delete state.sceneObjects[id]
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
        objectCount: Object.keys(state.sceneObjects).length,
        layerCount: state.layers.length
      },
      scene: {
        objects: state.sceneObjects,
        layers: state.layers,
        activeLayer: state.activeLayer,
        settings: {
          gridSize: state.gridSize,
          snapToGrid: state.snapToGrid,
          transformMode: state.transformMode,
          coordinateSpace: state.coordinateSpace
        }
      }
    }

    // Save to localStorage
    localStorage.setItem('morgan-bevy-scene', JSON.stringify(this.savedData))
    
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

// Load command for restoring scene from data
export class LoadCommand implements Command {
  private previousState: any
  private newData: any
  public description: string

  constructor(sceneData: any) {
    this.newData = sceneData
    this.description = 'Load scene'
  }

  execute(): void {
    const state = useEditorStore.getState()
    
    // Store current state for undo
    this.previousState = {
      sceneObjects: { ...state.sceneObjects },
      layers: [...state.layers],
      activeLayer: state.activeLayer,
      selectedObjects: [...state.selectedObjects],
      settings: {
        gridSize: state.gridSize,
        snapToGrid: state.snapToGrid,
        transformMode: state.transformMode,
        coordinateSpace: state.coordinateSpace
      }
    }

    // Load new scene data
    useEditorStore.setState((state: any) => {
      if (this.newData.scene) {
        state.sceneObjects = this.newData.scene.objects || {}
        state.layers = this.newData.scene.layers || state.layers
        state.activeLayer = this.newData.scene.activeLayer || 'default'
        state.selectedObjects = []
        
        if (this.newData.scene.settings) {
          state.gridSize = this.newData.scene.settings.gridSize || state.gridSize
          state.snapToGrid = this.newData.scene.settings.snapToGrid || false
          state.transformMode = this.newData.scene.settings.transformMode || 'select'
          state.coordinateSpace = this.newData.scene.settings.coordinateSpace || 'world'
        }
      }
    })
  }

  undo(): void {
    if (this.previousState) {
      useEditorStore.setState((state: any) => {
        state.sceneObjects = this.previousState.sceneObjects
        state.layers = this.previousState.layers
        state.activeLayer = this.previousState.activeLayer
        state.selectedObjects = this.previousState.selectedObjects
        state.gridSize = this.previousState.settings.gridSize
        state.snapToGrid = this.previousState.settings.snapToGrid
        state.transformMode = this.previousState.settings.transformMode
        state.coordinateSpace = this.previousState.settings.coordinateSpace
      })
    }
  }
}