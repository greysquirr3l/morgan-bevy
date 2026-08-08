// T91d — pure builders for the editor-to-Rust export payloads.
//
// Three call sites in the codebase hand-build a payload from
// `sceneObjects` before invoking a Tauri command (or before
// downloading a JSON file). Before T91 those payloads didn't carry
// the marker fields, so the Rust side had `GameObject.light /
// animation / audio / vfx` defined but never received anything.
//
// The contract:
//   - Each payload carries the four marker fields ONLY when the
//     source object has them. `"light": null` is forbidden — Rust
//     uses `#[serde(default, skip_serializing_if = "Option::is_none")]`
//     and `null` is not the same as "key absent".
//   - Build the payload as a plain object so the resulting JSON
//     emits the keys conditionally. Use the spread-when-present
//     pattern: `...(obj.light ? { light: obj.light } : {})`.
//   - The existing payload shape is preserved (the Rust side already
//     parses today's shape and must keep doing so).
//
// These are pure functions: they take `SceneObject`s and return
// the wire-format object. They are easy to test in isolation and
// never reach for the store / Tauri themselves.

import type { SceneObject } from '@/store/editorStore'

// The `Layer` type isn't exported from the store (it's defined
// inline on the `EditorState.layers` field). The shape used by
// the Bevy export payload is just `id` + `name`, so a structural
// type is enough here.
export interface LayerShape {
  id: string
  name: string
}

// ─── Marker carry-over helper ────────────────────────────────────────────────

/**
 * Spread a marker field iff the source object carries it. Returns
 * an empty contribution (`{}`) when the field is absent, so the
 * outer object becomes `{...other, ...spreadIfPresent(obj, 'light')}`
 * — a key-omitted object when the marker is absent.
 *
 * The conditional spread is the wire-format contract: a missing
 * marker === key absent === Rust `skip_serializing_if` activates.
 */
function spreadIfPresent<T extends SceneObject, K extends 'light' | 'animation' | 'audio' | 'vfx'>(
  obj: T,
  field: K
): NonNullable<T[K]> extends infer V ? (V extends undefined ? {} : Partial<Record<K, V>>) : never {
  const value = obj[field]
  if (value === undefined) return {} as never
  // The cast is safe: `value` is non-undefined here, and the
  // conditional-spread idiom is the only way to type this in TS
  // without a runtime helper.
  return { [field]: value } as never
}

// ─── Tauri export_level payload (ExportPanel.tsx) ────────────────────────────

export interface LevelExportPayload {
  id: string
  name: string
  objects: Array<Record<string, unknown>>
  layers: string[]
  generation_seed: number | null
  generation_params: unknown | null
  bounds: { min: [number, number, number]; max: [number, number, number] }
}

/**
 * Build the `levelData` payload for the `export_level` Tauri command
 * (ExportPanel.tsx). The four marker fields are spread-conditionally
 * so absent markers omit the key entirely.
 */
export function buildLevelExportPayload(
  sceneObjects: Iterable<SceneObject>,
  options: { id?: string; name?: string } = {}
): LevelExportPayload {
  const id = options.id ?? `level-${Date.now()}`
  const name = options.name ?? 'Morgan-Bevy Level'
  return {
    id,
    name,
    objects: Array.from(sceneObjects).map(obj => ({
      id: obj.id,
      name: obj.name,
      transform: {
        position: obj.position,
        rotation: [0, 0, 0, 1],
        scale: obj.scale,
      },
      material: `material_${obj.meshType}`,
      mesh: obj.meshType,
      layer: obj.layerId || 'Default',
      tags: ['exported'],
      metadata: {
        created_at: new Date().toISOString(),
        mesh_type: obj.meshType,
      },
      ...spreadIfPresent(obj, 'light'),
      ...spreadIfPresent(obj, 'animation'),
      ...spreadIfPresent(obj, 'audio'),
      ...spreadIfPresent(obj, 'vfx'),
    })),
    layers: ['Default', 'Generated'],
    generation_seed: null,
    generation_params: null,
    bounds: {
      min: [-50.0, -5.0, -50.0],
      max: [50.0, 5.0, 50.0],
    },
  }
}

// ─── Tauri export_level_simple payload (FileMenu.tsx handleLevelExport) ─────

export interface FileMenuLevelExportPayload {
  id: string
  name: string
  objects: Array<Record<string, unknown>>
  layers: string[]
  bounds: { min: [number, number, number]; max: [number, number, number] }
}

/**
 * Build the `levelData` payload for the `export_level_simple` Tauri
 * command (FileMenu.tsx handleLevelExport). Slightly different shape
 * than `export_level` — material is a full object, not a string id,
 * and metadata is per-object visibility / lock / collision / walkable.
 * Markers ride along here too.
 */
export function buildFileMenuLevelExportPayload(
  sceneObjects: Iterable<SceneObject>,
  options: { id?: string; name?: string } = {}
): FileMenuLevelExportPayload {
  const id = options.id ?? `level_${Date.now()}`
  const name = options.name ?? 'Morgan-Bevy Level'
  return {
    id,
    name,
    objects: Array.from(sceneObjects).map(obj => ({
      id: obj.id,
      name: obj.name,
      transform: {
        position: obj.position,
        rotation: obj.rotation,
        scale: obj.scale,
      },
      material: obj.material || {
        baseColor: '#ffffff',
        metallic: 0.0,
        roughness: 0.5,
      },
      mesh: obj.meshType || 'cube',
      layer: obj.layerId,
      tags: obj.tags || [],
      metadata: {
        visible: obj.visible,
        locked: obj.locked,
        collision: obj.collision,
        walkable: obj.walkable,
      },
      ...spreadIfPresent(obj, 'light'),
      ...spreadIfPresent(obj, 'animation'),
      ...spreadIfPresent(obj, 'audio'),
      ...spreadIfPresent(obj, 'vfx'),
    })),
    layers: ['default', 'walls', 'floors', 'doors'],
    bounds: {
      min: [-50, -50, -50],
      max: [50, 50, 50],
    },
  }
}

// ─── Bevy JSON scene export payload (FileMenu.tsx handleExport) ──────────────

export interface BevyEntityExport {
  name: string
  components: {
    Transform: {
      translation: [number, number, number]
      rotation: [number, number, number]
      scale: [number, number, number]
    }
    Visibility: { is_visible: boolean }
    MeshType: string
  }
  layer: string
  /** Spread conditionally by the optional marker fields. */
  light?: SceneObject['light']
  animation?: SceneObject['animation']
  audio?: SceneObject['audio']
  vfx?: SceneObject['vfx']
}

/**
 * Build the `bevy.entities` array for the JSON scene export
 * (FileMenu.tsx handleExport). Markers are spread as top-level
 * keys on the entity — they cross into the Rust export pipeline
 * alongside the existing components.
 */
export function buildBevyEntitiesExport(
  sceneObjects: Iterable<SceneObject>,
  layers: ReadonlyArray<LayerShape>
): BevyEntityExport[] {
  return Array.from(sceneObjects).map(obj => ({
    name: obj.name,
    components: {
      Transform: {
        translation: obj.position,
        rotation: obj.rotation,
        scale: obj.scale,
      },
      Visibility: {
        is_visible: obj.visible,
      },
      MeshType: obj.meshType || 'cube',
    },
    layer: layers.find(l => l.id === obj.layerId)?.name || 'Default',
    ...(obj.light ? { light: obj.light } : {}),
    ...(obj.animation ? { animation: obj.animation } : {}),
    ...(obj.audio ? { audio: obj.audio } : {}),
    ...(obj.vfx ? { vfx: obj.vfx } : {}),
  }))
}
