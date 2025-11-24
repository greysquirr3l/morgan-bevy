// Clipboard operations for 3D objects
import { useEditorStore } from '@/store/editorStore'

export interface ClipboardData {
  version: string
  timestamp: number
  objects: Array<{
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
  }>
}

class ClipboardManager {
  private data: ClipboardData | null = null
  private static instance: ClipboardManager
  
  static getInstance(): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager()
    }
    return ClipboardManager.instance
  }

  // Copy selected objects to clipboard
  copy(objectIds: string[]): boolean {
    try {
      const { sceneObjects } = useEditorStore.getState()
      const objectsToSerialize = objectIds.map(id => sceneObjects[id]).filter(Boolean)
      
      if (objectsToSerialize.length === 0) {
        return false
      }

      this.data = {
        version: '1.0.0',
        timestamp: Date.now(),
        objects: objectsToSerialize.map(obj => ({...obj})) // Deep copy
      }

      // Also try to put data in system clipboard as JSON (for cross-session copy/paste)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(JSON.stringify(this.data))
          .catch(err => console.warn('Could not write to system clipboard:', err))
      }

      console.log(`Copied ${objectsToSerialize.length} object(s) to clipboard`)
      return true
    } catch (error) {
      console.error('Failed to copy objects:', error)
      return false
    }
  }

  // Paste objects from clipboard
  async paste(position?: [number, number, number]): Promise<string[]> {
    try {
      let clipboardData = this.data

      // If no internal clipboard data, try to read from system clipboard
      if (!clipboardData && navigator.clipboard && navigator.clipboard.readText) {
        try {
          const text = await navigator.clipboard.readText()
          clipboardData = JSON.parse(text)
          
          // Validate clipboard data format
          if (!clipboardData || !clipboardData.objects || !Array.isArray(clipboardData.objects)) {
            throw new Error('Invalid clipboard data format')
          }
        } catch (err) {
          console.warn('Could not read from system clipboard:', err)
          return []
        }
      }

      if (!clipboardData) {
        console.warn('No clipboard data available')
        return []
      }

      const { addObject, sceneObjects } = useEditorStore.getState()
      const pastedIds: string[] = []

      // Calculate offset for pasted objects
      const offset = position || [2, 0, 0] // Default offset if no position specified
      
      // Find center of copied objects to offset from
      let centerX = 0, centerY = 0, centerZ = 0
      clipboardData.objects.forEach(obj => {
        centerX += obj.position[0]
        centerY += obj.position[1]
        centerZ += obj.position[2]
      })
      centerX /= clipboardData.objects.length
      centerY /= clipboardData.objects.length
      centerZ /= clipboardData.objects.length

      // Create new objects at offset positions
      for (const objData of clipboardData.objects) {
        const newId = `${objData.name}_paste_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        const newPosition: [number, number, number] = [
          objData.position[0] - centerX + offset[0],
          objData.position[1] - centerY + offset[1],
          objData.position[2] - centerZ + offset[2]
        ]

        // Use store's setState to directly add the object
        useEditorStore.setState((state) => {
          state.sceneObjects[newId] = {
            ...objData,
            id: newId,
            name: `${objData.name}_paste`,
            position: newPosition,
            parentId: undefined, // Clear parent relationships for now
            children: [] // Clear children relationships for now
          }
        })

        pastedIds.push(newId)
      }

      console.log(`Pasted ${pastedIds.length} object(s) from clipboard`)
      return pastedIds
    } catch (error) {
      console.error('Failed to paste objects:', error)
      return []
    }
  }

  // Check if clipboard has data
  hasData(): boolean {
    return this.data !== null
  }

  // Get clipboard data info
  getClipboardInfo(): { count: number; timestamp: number } | null {
    if (!this.data) return null
    return {
      count: this.data.objects.length,
      timestamp: this.data.timestamp
    }
  }

  // Clear clipboard
  clear(): void {
    this.data = null
  }
}

export const clipboard = ClipboardManager.getInstance()

// Convenience functions
export function copySelectedObjects(): boolean {
  const { selectedObjects } = useEditorStore.getState()
  return clipboard.copy(selectedObjects)
}

export async function pasteFromClipboard(position?: [number, number, number]): Promise<string[]> {
  return await clipboard.paste(position)
}

export function hasClipboardData(): boolean {
  return clipboard.hasData()
}