import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/store/editorStore'

describe('EditorStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useEditorStore.setState({
      selectedObjects: [],
      sceneObjects: {},
      gridSnapEnabled: false,
      transformMode: 'translate',
      coordinateSpace: 'world',
      layers: [
        { id: 'default', name: 'Default', visible: true, locked: false, color: '#ffffff' }
      ],
      activeLayer: 'default',
      undoHistory: [],
      redoHistory: [],
      showGrid: true,
      showStats: false
    })
  })

  describe('Object Management', () => {
    it('should add objects to the scene', () => {
      const store = useEditorStore.getState()
      
      const objectId = store.addObject('cube', [0, 0, 0])
      
      const state = useEditorStore.getState()
      const obj = state.sceneObjects[objectId]
      
      expect(obj).toBeDefined()
      expect(obj.meshType).toBe('cube')
      expect(obj.position).toEqual([0, 0, 0])
      expect(obj.rotation).toEqual([0, 0, 0])
      expect(obj.scale).toEqual([1, 1, 1])
    })

    it('should remove objects from the scene', () => {
      const store = useEditorStore.getState()
      
      const objectId = store.addObject('cube', [0, 0, 0])
      // Get fresh state after adding
      let state = useEditorStore.getState()
      expect(Object.keys(state.sceneObjects)).toHaveLength(1)
      
      store.removeObject(objectId)
      
      // Get fresh state after removal
      state = useEditorStore.getState()
      expect(Object.keys(state.sceneObjects)).toHaveLength(0)
    })

    it('should update object transforms', () => {
      const store = useEditorStore.getState()
      
      const objectId = store.addObject('cube', [0, 0, 0])
      
      store.updateObjectTransform(objectId, {
        position: [5, 5, 5],
        rotation: [0, 1, 0],
        scale: [2, 2, 2]
      })
      
      const state = useEditorStore.getState()
      const obj = state.sceneObjects[objectId]
      
      expect(obj.position).toEqual([5, 5, 5])
      expect(obj.rotation).toEqual([0, 1, 0])
      expect(obj.scale).toEqual([2, 2, 2])
    })
  })

  describe('Selection Management', () => {
    it('should select objects', () => {
      const store = useEditorStore.getState()
      
      const objectId = store.addObject('cube', [0, 0, 0])
      
      store.setSelectedObjects([objectId])
      
      const state = useEditorStore.getState()
      expect(state.selectedObjects).toEqual([objectId])
    })

    it('should clear selection', () => {
      const store = useEditorStore.getState()
      
      const objectId = store.addObject('cube', [0, 0, 0])
      
      store.setSelectedObjects([objectId])
      store.clearSelection()
      
      const state = useEditorStore.getState()
      expect(state.selectedObjects).toHaveLength(0)
    })

    it('should add and remove from selection', () => {
      const store = useEditorStore.getState()
      
      const objectId1 = store.addObject('cube', [0, 0, 0])
      const objectId2 = store.addObject('sphere', [2, 0, 0])
      
      store.addToSelection(objectId1)
      store.addToSelection(objectId2)
      
      let state = useEditorStore.getState()
      expect(state.selectedObjects).toContain(objectId1)
      expect(state.selectedObjects).toContain(objectId2)
      
      store.removeFromSelection(objectId1)
      
      state = useEditorStore.getState()
      expect(state.selectedObjects).not.toContain(objectId1)
      expect(state.selectedObjects).toContain(objectId2)
    })
  })

  describe('Grid and Transform Settings', () => {
    it('should toggle grid visibility', () => {
      const store = useEditorStore.getState()
      
      expect(store.showGrid).toBe(true)
      
      store.toggleGrid()
      
      const state = useEditorStore.getState()
      expect(state.showGrid).toBe(false)
    })

    it('should toggle grid snapping', () => {
      const store = useEditorStore.getState()
      
      expect(store.gridSnapEnabled).toBe(false)
      
      store.toggleGridSnap()
      
      const state = useEditorStore.getState()
      expect(state.gridSnapEnabled).toBe(true)
    })

    it('should change transform mode', () => {
      const store = useEditorStore.getState()
      
      expect(store.transformMode).toBe('translate')
      
      store.setTransformMode('rotate')
      
      const state = useEditorStore.getState()
      expect(state.transformMode).toBe('rotate')
    })

    it('should toggle coordinate space', () => {
      const store = useEditorStore.getState()
      
      expect(store.coordinateSpace).toBe('world')
      
      store.toggleCoordinateSpace()
      
      const state = useEditorStore.getState()
      expect(state.coordinateSpace).toBe('local')
    })
  })

  describe('Scene Management', () => {
    it('should clear scene while preserving important data', () => {
      const store = useEditorStore.getState()
      
      // Add some objects and set up state
      store.addObject('cube', [0, 0, 0])
      store.addObject('sphere', [2, 0, 0])
      store.setSelectedObjects(Object.keys(store.sceneObjects))
      
      store.clearScene()
      
      const state = useEditorStore.getState()
      expect(Object.keys(state.sceneObjects)).toHaveLength(0)
      expect(state.selectedObjects).toHaveLength(0)
    })
  })

  describe('Material Management', () => {
    it('should update object materials', () => {
      const store = useEditorStore.getState()
      
      const objectId = store.addObject('cube', [0, 0, 0])
      
      const material = {
        baseColor: '#ff0000',
        metallic: 0.8,
        roughness: 0.2,
        texture: 'metal_texture.png'
      }
      
      store.updateObjectMaterial(objectId, material)
      
      const state = useEditorStore.getState()
      const obj = state.sceneObjects[objectId]
      
      expect(obj.material?.baseColor).toBe('#ff0000')
      expect(obj.material?.metallic).toBe(0.8)
      expect(obj.material?.roughness).toBe(0.2)
      expect(obj.material?.texture).toBe('metal_texture.png')
    })
  })
})