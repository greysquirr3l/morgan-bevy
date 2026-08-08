// Clipboard operations for 3D objects
import { useEditorStore } from '@/store/editorStore'
import { isLayerId, LayerId, ObjectId } from '@/types/brand'

export interface ClipboardData {
  version: string
  timestamp: number
  objects: Array<{
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
  copy(objectIds: ObjectId[]): boolean {
    try {
      const { sceneObjects } = useEditorStore.getState()
      const objectsToSerialize = objectIds
        .map(id => sceneObjects.get(id))
        .filter((obj): obj is NonNullable<typeof obj> => obj !== undefined)

      if (objectsToSerialize.length === 0) {
        return false
      }

      this.data = {
        version: '1.0.0',
        timestamp: Date.now(),
        objects: objectsToSerialize.map(obj => ({ ...obj })), // Deep copy
      }

      // Also try to put data in system clipboard as JSON (for
      // cross-session copy/paste). `writeText` may return either a
      // Promise (real browsers) or `undefined` (some jsdom
      // environments), so guard the `.catch` so a non-promise
      // return value doesn't fail the whole copy.
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          const result = navigator.clipboard.writeText(JSON.stringify(this.data))
          if (result && typeof result.catch === 'function') {
            result.catch(err => console.warn('Could not write to system clipboard:', err))
          }
        } catch (err) {
          console.warn('System clipboard write failed:', err)
        }
      }

      console.log(`Copied ${objectsToSerialize.length} object(s) to clipboard`)
      return true
    } catch (error) {
      console.error('Failed to copy objects:', error)
      return false
    }
  }

  // Paste objects from clipboard
  async paste(position?: [number, number, number]): Promise<ObjectId[]> {
    try {
      let clipboardData = this.data

      // If no internal clipboard data, try to read from system clipboard.
      // This is an untrusted boundary — the text comes from the OS
      // clipboard and may have been written by anything.
      if (!clipboardData && navigator.clipboard && navigator.clipboard.readText) {
        try {
          const text = await navigator.clipboard.readText()
          const parsed: unknown = JSON.parse(text)

          // Validate clipboard data format
          if (
            !parsed ||
            typeof parsed !== 'object' ||
            !Array.isArray((parsed as { objects?: unknown }).objects)
          ) {
            throw new Error('Invalid clipboard data format')
          }
          clipboardData = parsed as ClipboardData
        } catch (err) {
          console.warn('Could not read from system clipboard:', err)
          return []
        }
      }

      if (!clipboardData) {
        console.warn('No clipboard data available')
        return []
      }

      // Bulk restore: one malformed entry must not abort the whole
      // paste. Drop objects whose `layerId` doesn't look like a valid
      // branded id, logging a warning for each skipped entry.
      const validObjects = clipboardData.objects.filter(obj => {
        if (!isLayerId(obj.layerId)) {
          console.warn('clipboard paste: skipping object with malformed layerId', obj)
          return false
        }
        return true
      })
      if (validObjects.length === 0) {
        console.warn('No valid objects to paste')
        return []
      }

      // Note: Using useEditorStore.setState directly instead of destructured addObject
      const pastedIds: ObjectId[] = []

      // T70: offset semantics — `offset` is the *target* position of the
      // cluster centre after paste. So every object shifts by
      // `offset - original_centre`. The previous implementation
      // cancelled the offset out against the centre for any
      // multi-object paste, effectively making paste() a no-op.
      const offset = position || [2, 0, 0] // Default target if no position specified

      // Find center of copied objects so we can compute the shift.
      let centerX = 0,
        centerY = 0,
        centerZ = 0
      validObjects.forEach(obj => {
        centerX += obj.position[0]
        centerY += obj.position[1]
        centerZ += obj.position[2]
      })
      centerX /= validObjects.length
      centerY /= validObjects.length
      centerZ /= validObjects.length
      const shiftX = offset[0] - centerX
      const shiftY = offset[1] - centerY
      const shiftZ = offset[2] - centerZ

      // Create new objects at offset positions
      for (const objData of validObjects) {
        // Generation site (not a boundary): the id is minted here from
        // the copied object's (possibly space-containing) name. Use the
        // plain constructor rather than `parseObjectId`, which would
        // throw on a name like "My Cube".
        const newId = ObjectId(
          `${objData.name}_paste_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        )
        const newPosition: [number, number, number] = [
          objData.position[0] + shiftX,
          objData.position[1] + shiftY,
          objData.position[2] + shiftZ,
        ]

        // Use store's setState to directly add the object
        useEditorStore.setState(state => {
          state.sceneObjects.set(newId, {
            ...objData,
            id: newId,
            name: `${objData.name}_paste`,
            position: newPosition,
            parentId: undefined, // Clear parent relationships for now
            children: [], // Clear children relationships for now
          })
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

  // Get clipboard data for commands
  getData(): ClipboardData | null {
    return this.data
  }
  hasData(): boolean {
    return this.data !== null
  }

  // Get clipboard data info
  getClipboardInfo(): { count: number; timestamp: number } | null {
    if (!this.data) return null
    return {
      count: this.data.objects.length,
      timestamp: this.data.timestamp,
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

// T88 audit removed pasteFromClipboard + hasClipboardData: callers
// (useKeyboardShortcuts, FileMenu) already use the singleton's
// `clipboard.paste(...)` / `clipboard.hasData()` directly. The
// thin wrappers were dead surface.
