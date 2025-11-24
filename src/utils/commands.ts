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