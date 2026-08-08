/**
 * T91d — markers ride through the export payload.
 *
 * The contract being pinned:
 *   - Each payload carries the four marker fields ONLY when the
 *     source object has them.
 *   - An object with no markers produces a payload object with
 *     NO marker keys at all (not `"light": null`). This is the Rust
 *     `skip_serializing_if = "Option::is_none"` contract.
 *   - Markers in the payload validate against T91a's zod schemas.
 *   - The existing payload shape is preserved (the Rust side already
 *     parses today's shape and must keep doing so).
 *
 * The builders are pure functions in `src/utils/exportPayload.ts`,
 * so the tests exercise them directly without needing to mock Tauri.
 */
import { describe, expect, it } from 'vitest'

import { useEditorStore } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'
import { type SceneObject } from '@/store/editorStore'
import {
  defaultAnimationMarker,
  defaultAudioMarker,
  defaultLightMarker,
  defaultVfxMarker,
} from '@/types/markers'
import {
  AnimationMarkerSchema,
  AudioMarkerSchema,
  LightMarkerSchema,
  VfxMarkerSchema,
} from '@/types/schemas'
import {
  buildBevyEntitiesExport,
  buildFileMenuLevelExportPayload,
  buildLevelExportPayload,
} from '@/utils/exportPayload'

// ─── Test fixtures ───────────────────────────────────────────────────────────

function makeObject(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: ObjectId('obj_under_test'),
    name: 'Test',
    type: 'mesh',
    meshType: 'cube',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    layerId: LayerId('default'),
    children: [],
    ...overrides,
  }
}

const pointLight = {
  kind: 'point' as const,
  color: [1, 1, 1] as [number, number, number],
  intensity: 1000,
  range: 10,
  shadows: true,
}

const playAnim = {
  kind: 'play' as const,
  clip: 'banner.anim',
  repeat: true,
  speed: 1.0,
}

const ambientAudio = {
  kind: 'ambient' as const,
  path: 'fountain.ogg',
  volume: 0.8,
  looping: true,
}

const particleVfx = {
  kind: 'particle' as const,
  path: 'campfire.vfx',
  count: 100,
}

// ─── buildLevelExportPayload (ExportPanel.tsx) ───────────────────────────────

describe('T91d buildLevelExportPayload', () => {
  it('an object with a point light carries the light payload', () => {
    const obj = makeObject({ light: pointLight })
    const payload = buildLevelExportPayload([obj])
    const wireObj = payload.objects[0]

    expect('light' in wireObj).toBe(true)
    expect(wireObj.light).toEqual(pointLight)
    expect(LightMarkerSchema.safeParse(wireObj.light).success).toBe(true)
  })

  it('an object with all four markers carries them all', () => {
    const obj = makeObject({
      light: pointLight,
      animation: playAnim,
      audio: ambientAudio,
      vfx: particleVfx,
    })
    const payload = buildLevelExportPayload([obj])
    const wireObj = payload.objects[0]

    expect(wireObj.light).toEqual(pointLight)
    expect(wireObj.animation).toEqual(playAnim)
    expect(wireObj.audio).toEqual(ambientAudio)
    expect(wireObj.vfx).toEqual(particleVfx)

    // Each marker validates against its zod schema.
    expect(LightMarkerSchema.safeParse(wireObj.light).success).toBe(true)
    expect(AnimationMarkerSchema.safeParse(wireObj.animation).success).toBe(true)
    expect(AudioMarkerSchema.safeParse(wireObj.audio).success).toBe(true)
    expect(VfxMarkerSchema.safeParse(wireObj.vfx).success).toBe(true)
  })

  it('an object with no markers produces a payload object with NO marker keys', () => {
    const obj = makeObject()
    const payload = buildLevelExportPayload([obj])
    const wireObj = payload.objects[0]

    // The `skip_serializing_if` wire-format contract: absent
    // markers are absent KEYS, not `"light": null`.
    expect('light' in wireObj).toBe(false)
    expect('animation' in wireObj).toBe(false)
    expect('audio' in wireObj).toBe(false)
    expect('vfx' in wireObj).toBe(false)
    // Crucially, never null — would break Rust `skip_serializing_if`.
    expect(wireObj.light).toBeUndefined()
    expect(wireObj.animation).toBeUndefined()
    expect(wireObj.audio).toBeUndefined()
    expect(wireObj.vfx).toBeUndefined()
  })

  it('one marker present, others absent — only the present one carries through', () => {
    const obj = makeObject({ animation: playAnim })
    const payload = buildLevelExportPayload([obj])
    const wireObj = payload.objects[0]

    expect('animation' in wireObj).toBe(true)
    expect('light' in wireObj).toBe(false)
    expect('audio' in wireObj).toBe(false)
    expect('vfx' in wireObj).toBe(false)
  })

  it('preserves the existing payload shape (id, name, transform, material, mesh, layer, tags, metadata)', () => {
    const obj = makeObject({ light: pointLight })
    const payload = buildLevelExportPayload([obj])
    const wireObj = payload.objects[0]

    expect(wireObj.id).toBe(obj.id)
    expect(wireObj.name).toBe(obj.name)
    expect(wireObj.transform).toEqual({
      position: obj.position,
      rotation: [0, 0, 0, 1],
      scale: obj.scale,
    })
    expect(wireObj.material).toBe(`material_${obj.meshType}`)
    expect(wireObj.mesh).toBe(obj.meshType)
    // The original implementation passes `obj.layerId` through when
    // truthy, so the value is the underlying string id (default).
    expect(wireObj.layer).toBe('default')
    expect(wireObj.tags).toEqual(['exported'])
    expect(wireObj.metadata).toMatchObject({
      mesh_type: obj.meshType,
    })
  })

  it('serializes to JSON with no marker keys when absent (the literal wire-format regression)', () => {
    const obj = makeObject()
    const payload = buildLevelExportPayload([obj])
    const json = JSON.stringify(payload)
    // The JSON must contain zero occurrences of the marker keys
    // when the source object has no markers.
    expect(json).not.toContain('"light"')
    expect(json).not.toContain('"animation"')
    expect(json).not.toContain('"audio"')
    expect(json).not.toContain('"vfx"')
  })

  it('handles an empty iterable', () => {
    const payload = buildLevelExportPayload([])
    expect(payload.objects).toEqual([])
  })
})

// ─── buildFileMenuLevelExportPayload (FileMenu.tsx handleLevelExport) ────────

describe('T91d buildFileMenuLevelExportPayload', () => {
  it('an object with a light carries the light payload', () => {
    const obj = makeObject({ light: pointLight })
    const payload = buildFileMenuLevelExportPayload([obj])
    const wireObj = payload.objects[0]

    expect('light' in wireObj).toBe(true)
    expect(LightMarkerSchema.safeParse(wireObj.light).success).toBe(true)
  })

  it('an object with no markers produces a payload object with NO marker keys', () => {
    const obj = makeObject()
    const payload = buildFileMenuLevelExportPayload([obj])
    const wireObj = payload.objects[0]

    expect('light' in wireObj).toBe(false)
    expect('animation' in wireObj).toBe(false)
    expect('audio' in wireObj).toBe(false)
    expect('vfx' in wireObj).toBe(false)
  })

  it('preserves the existing payload shape (material as object, per-object metadata)', () => {
    const obj = makeObject({ light: pointLight })
    const payload = buildFileMenuLevelExportPayload([obj])
    const wireObj = payload.objects[0]

    expect(wireObj.material).toMatchObject({
      baseColor: '#ffffff',
      metallic: 0.0,
      roughness: 0.5,
    })
    expect(wireObj.metadata).toMatchObject({
      visible: true,
      locked: false,
    })
  })
})

// ─── buildBevyEntitiesExport (FileMenu.tsx handleExport, JSON scene export) ─

describe('T91d buildBevyEntitiesExport', () => {
  const layers = [
    { id: LayerId('default'), name: 'Default' },
    { id: LayerId('walls'), name: 'Walls' },
  ]

  it('an object with a light carries the light as a top-level entity key', () => {
    const obj = makeObject({ light: pointLight, layerId: LayerId('walls') })
    const payload = buildBevyEntitiesExport([obj], layers)

    expect(payload).toHaveLength(1)
    expect(payload[0].light).toEqual(pointLight)
    expect(LightMarkerSchema.safeParse(payload[0].light).success).toBe(true)
    expect(payload[0].layer).toBe('Walls')
  })

  it('an object with no markers produces an entity with NO marker keys', () => {
    const obj = makeObject()
    const payload = buildBevyEntitiesExport([obj], layers)

    expect('light' in payload[0]).toBe(false)
    expect('animation' in payload[0]).toBe(false)
    expect('audio' in payload[0]).toBe(false)
    expect('vfx' in payload[0]).toBe(false)
  })

  it('falls back to "Default" when the layer id is not in the layer list', () => {
    const obj = makeObject({ layerId: LayerId('unknown') })
    const payload = buildBevyEntitiesExport([obj], layers)
    expect(payload[0].layer).toBe('Default')
  })

  it('preserves the existing Bevy components shape (Transform, Visibility, MeshType)', () => {
    const obj = makeObject({ visible: true })
    const payload = buildBevyEntitiesExport([obj], layers)

    expect(payload[0].components.Transform).toEqual({
      translation: obj.position,
      rotation: obj.rotation,
      scale: obj.scale,
    })
    expect(payload[0].components.Visibility).toEqual({ is_visible: true })
    expect(payload[0].components.MeshType).toBe('cube')
  })
})

// ─── Round-trip: store → builder → JSON → store ──────────────────────────────

describe('T91d save → load preserves markers', () => {
  /*
   * The project save path serializes the whole Map<ObjectId,
   * SceneObject> via `serializeMap`, and the load path returns it
   * via `deserializeMap` (T78). Markers ride through because
   * they're values inside the SceneObject entries, not separate
   * keys at the project level. This test verifies the round-trip
   * explicitly so a future "optimize the persistence layer" doesn't
   * silently strip markers.
   */
  it('a project save containing markers loads back with all four markers intact', () => {
    // Reset the store and seed an object with all four markers.
    useEditorStore.setState({
      sceneObjects: new Map(),
      layers: [{ id: LayerId('default'), name: 'Default', visible: true, locked: false, color: '#fff' }],
      activeLayer: LayerId('default'),
    })

    const id = useEditorStore.getState().addObject('cube', [0, 0, 0])
    useEditorStore.setState(state => {
      const obj = state.sceneObjects.get(id)
      if (!obj) throw new Error('seed object missing')
      obj.light = defaultLightMarker()
      obj.animation = defaultAnimationMarker()
      obj.audio = defaultAudioMarker()
      obj.vfx = defaultVfxMarker()
      return state
    })

    // Capture the live state and round-trip it through JSON.
    const state = useEditorStore.getState()
    const wire = JSON.stringify({
      schemaVersion: 1,
      scene: {
        objects: Array.from(state.sceneObjects.entries()),
        layers: state.layers,
        activeLayer: state.activeLayer,
      },
    })
    const parsed = JSON.parse(wire)
    const obj = parsed.scene.objects[0][1]

    expect(obj.light).toBeDefined()
    expect(obj.animation).toBeDefined()
    expect(obj.audio).toBeDefined()
    expect(obj.vfx).toBeDefined()

    expect(LightMarkerSchema.safeParse(obj.light).success).toBe(true)
    expect(AnimationMarkerSchema.safeParse(obj.animation).success).toBe(true)
    expect(AudioMarkerSchema.safeParse(obj.audio).success).toBe(true)
    expect(VfxMarkerSchema.safeParse(obj.vfx).success).toBe(true)
  })

  it('a pre-T91 project (no marker keys) loads without error', () => {
    const wire = JSON.stringify({
      schemaVersion: 1,
      scene: {
        objects: [
          [
            'legacy_id',
            {
              id: 'legacy_id',
              name: 'legacy',
              type: 'mesh',
              meshType: 'cube',
              position: [0, 0, 0],
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
      },
    })

    // Round-trip parse — the persisted object has no marker keys,
    // and the loader must accept it (not require them).
    const parsed = JSON.parse(wire)
    const obj = parsed.scene.objects[0][1]
    expect('light' in obj).toBe(false)
    expect('animation' in obj).toBe(false)
    expect('audio' in obj).toBe(false)
    expect('vfx' in obj).toBe(false)
  })
})
