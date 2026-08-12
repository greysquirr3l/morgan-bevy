import { useEditorStore } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('EditorStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useEditorStore.setState({
      selectedObjects: [],
      sceneObjects: new Map(),
      transformMode: 'translate',
      coordinateSpace: 'world',
      layers: [
        { id: LayerId('default'), name: 'Default', visible: true, locked: false, color: '#ffffff' },
      ],
      activeLayer: LayerId('default'),
      undoHistory: [],
      redoHistory: [],
      showGrid: true,
      showStats: false,
    })
  })

  describe('Object Management', () => {
    it('should add objects to the scene', () => {
      const store = useEditorStore.getState()

      const objectId = store.addObject('cube', [0, 0, 0])

      const state = useEditorStore.getState()
      const obj = state.sceneObjects.get(objectId)

      expect(obj).toBeDefined()
      expect(obj?.meshType).toBe('cube')
      expect(obj?.position).toEqual([0, 0, 0])
      expect(obj?.rotation).toEqual([0, 0, 0])
      expect(obj?.scale).toEqual([1, 1, 1])
    })

    it('should remove objects from the scene', () => {
      const store = useEditorStore.getState()

      const objectId = store.addObject('cube', [0, 0, 0])
      // Get fresh state after adding
      let state = useEditorStore.getState()
      expect(state.sceneObjects.size).toBe(1)

      store.removeObject(objectId)

      // Get fresh state after removal
      state = useEditorStore.getState()
      expect(state.sceneObjects.size).toBe(0)
    })

    it('should update object transforms', () => {
      const store = useEditorStore.getState()

      const objectId = store.addObject('cube', [0, 0, 0])

      store.updateObjectTransform(objectId, {
        position: [5, 5, 5],
        rotation: [0, 1, 0],
        scale: [2, 2, 2],
      })

      const state = useEditorStore.getState()
      const obj = state.sceneObjects.get(objectId)

      expect(obj?.position).toEqual([5, 5, 5])
      expect(obj?.rotation).toEqual([0, 1, 0])
      expect(obj?.scale).toEqual([2, 2, 2])
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

  describe('Visibility', () => {
    it('hideSelection hides only the selected objects', () => {
      const store = useEditorStore.getState()

      const objectId1 = store.addObject('cube', [0, 0, 0])
      const objectId2 = store.addObject('sphere', [2, 0, 0])
      store.setSelectedObjects([objectId1])

      store.hideSelection()

      const state = useEditorStore.getState()
      expect(state.sceneObjects.get(objectId1)?.visible).toBe(false)
      expect(state.sceneObjects.get(objectId2)?.visible).toBe(true)
    })

    it('unhideAll unhides every object regardless of selection', () => {
      const store = useEditorStore.getState()

      const objectId1 = store.addObject('cube', [0, 0, 0])
      const objectId2 = store.addObject('sphere', [2, 0, 0])
      store.updateObjectVisibility(objectId1, false)
      store.updateObjectVisibility(objectId2, false)
      store.clearSelection()

      store.unhideAll()

      const state = useEditorStore.getState()
      expect(state.sceneObjects.get(objectId1)?.visible).toBe(true)
      expect(state.sceneObjects.get(objectId2)?.visible).toBe(true)
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
      store.setSelectedObjects(Array.from(store.sceneObjects.keys()))

      store.clearScene()

      const state = useEditorStore.getState()
      expect(state.sceneObjects.size).toBe(0)
      expect(state.selectedObjects).toHaveLength(0)
    })

    it('clearHistory resets the scene AND the undo/redo history (single source of truth for "New Scene")', () => {
      const store = useEditorStore.getState()

      const objectId = store.addObject('cube', [0, 0, 0])
      store.setSelectedObjects([objectId])
      // Populate history so we can assert it's actually cleared, not
      // just coincidentally empty.
      useEditorStore.setState({
        undoHistory: [{ execute: () => {}, undo: () => {}, description: 'test' }],
        redoHistory: [{ execute: () => {}, undo: () => {}, description: 'test' }],
      })

      store.clearHistory()

      const state = useEditorStore.getState()
      expect(state.sceneObjects.size).toBe(0)
      expect(state.selectedObjects).toHaveLength(0)
      expect(state.undoHistory).toHaveLength(0)
      expect(state.redoHistory).toHaveLength(0)
      expect(state.activeLayer).toBe(LayerId('default'))
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
        texture: 'metal_texture.png',
      }

      store.updateObjectMaterial(objectId, material)

      const state = useEditorStore.getState()
      const obj = state.sceneObjects.get(objectId)

      expect(obj?.material?.baseColor).toBe('#ff0000')
      expect(obj?.material?.metallic).toBe(0.8)
      expect(obj?.material?.roughness).toBe(0.2)
      expect(obj?.material?.texture).toBe('metal_texture.png')
    })
  })

  // T77b: bulk-restore boundary robustness. `loadFromLocalStorage`
  // rebuilds `sceneObjects` from a raw JSON snapshot; a single
  // malformed id must not destroy the whole restore — it should be
  // filtered out (with a warning) while every valid entry round-trips.
  describe('Autosave boundary robustness (T77b)', () => {
    afterEach(() => localStorage.removeItem('morgan-bevy.autosave'))

    it('skips a malformed object id in a restored autosave and keeps the valid one', () => {
      const validId = 'valid-obj-1'
      const malformedId = 'bad id with space'
      const validEntry = {
        id: validId,
        name: 'Good Object',
        type: 'mesh',
        position: [1, 2, 3],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        visible: true,
        locked: false,
        layerId: 'default',
        children: [],
        meshType: 'cube',
      }
      const malformedEntry = { ...validEntry, id: malformedId, name: 'Bad Object' }

      localStorage.setItem(
        'morgan-bevy.autosave',
        JSON.stringify({
          gridData: [],
          selectedTheme: null,
          sceneObjects: [
            [validId, validEntry],
            [malformedId, malformedEntry],
          ],
          viewportMode: '3d',
          timestamp: new Date().toISOString(),
        })
      )

      const loaded = useEditorStore.getState().loadFromLocalStorage()
      expect(loaded).toBe(true)

      const state = useEditorStore.getState()
      // The malformed id (contains spaces) is dropped; the valid one
      // round-trips intact.
      expect(state.sceneObjects.size).toBe(1)
      const restored = state.sceneObjects.get(ObjectId(validId))
      expect(restored?.name).toBe('Good Object')
      expect(state.sceneObjects.has(ObjectId(malformedId))).toBe(false)
    })
  })

  // Regression for audit Critical #5: two writers raced on the same
  // `morgan-bevy.autosave` key with incompatible shapes. Whichever
  // ran last decided whether the startup recovery dialog could see
  // the snapshot. The fix unifies the schema (`{ schemaVersion,
  // savedAt, scene: { objects, layers, activeLayer, selectedObjects } }`)
  // and keeps the legacy top-level fields as a fallback so older
  // payloads still load.
  describe('Autosave schema unification (regression for Critical #5)', () => {
    afterEach(() => localStorage.removeItem('morgan-bevy.autosave'))

    it('saveToLocalStorage writes the new-schema payload (scene.objects)', () => {
      useEditorStore.setState({
        sceneObjects: new Map([
          [
            ObjectId('round_trip_a'),
            {
              id: ObjectId('round_trip_a'),
              name: 'Round Trip',
              type: 'mesh',
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              visible: true,
              locked: false,
              layerId: LayerId('default'),
              children: [],
            },
          ],
        ]),
      })
      useEditorStore.getState().saveToLocalStorage()
      const raw = localStorage.getItem('morgan-bevy.autosave')
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      // New-schema keys present (so useAutoSave.ts's writeSnapshot
      // and saveToLocalStorage are shape-compatible).
      expect(parsed.schemaVersion).toBe(1)
      expect(typeof parsed.savedAt).toBe('string')
      expect(Array.isArray(parsed.scene.objects)).toBe(true)
      expect(parsed.scene.objects[0][0]).toBe('round_trip_a')
    })

    it('loadFromLocalStorage reads new-schema payloads written by useAutoSave', () => {
      // Simulate what useAutoSave.ts#writeSnapshot writes.
      const payload = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        scene: {
          objects: [
            [
              'rt_b',
              {
                id: 'rt_b',
                name: 'From New Schema',
                type: 'mesh',
                position: [5, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                visible: true,
                locked: false,
                layerId: 'default',
                children: [],
              },
            ],
          ],
          layers: [],
          activeLayer: 'default',
          selectedObjects: ['rt_b'],
        },
      }
      localStorage.setItem('morgan-bevy.autosave', JSON.stringify(payload))

      useEditorStore.setState({
        sceneObjects: new Map(),
        selectedObjects: [],
      })
      const loaded = useEditorStore.getState().loadFromLocalStorage()
      expect(loaded).toBe(true)
      expect(useEditorStore.getState().sceneObjects.has(ObjectId('rt_b'))).toBe(true)
      expect(useEditorStore.getState().selectedObjects).toEqual([ObjectId('rt_b')])
    })

    it('loadFromLocalStorage still accepts the legacy top-level schema', () => {
      // Pre-fix payload (the kind useAutoSave.ts no longer writes,
      // but may still exist in users' localStorage from a previous
      // version of the app).
      const legacy = {
        timestamp: new Date().toISOString(),
        gridData: [],
        sceneObjects: [
          [
            'legacy_obj',
            {
              id: 'legacy_obj',
              name: 'Legacy Object',
              type: 'mesh',
              position: [1, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              visible: true,
              locked: false,
              layerId: 'default',
              children: [],
            },
          ],
        ],
        viewportMode: '3d',
      }
      localStorage.setItem('morgan-bevy.autosave', JSON.stringify(legacy))

      useEditorStore.setState({ sceneObjects: new Map() })
      const loaded = useEditorStore.getState().loadFromLocalStorage()
      expect(loaded).toBe(true)
      expect(useEditorStore.getState().sceneObjects.has(ObjectId('legacy_obj'))).toBe(true)
      expect(useEditorStore.getState().viewportMode).toBe('3d')
    })
  })
})
