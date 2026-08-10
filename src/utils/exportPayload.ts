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
import type { PatrolRoute, Waypoint } from '@/types/waypoints'

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

// ─── T57: waypoints / patrol routes wire-format conversion ───────────────────
//
// The Rust `Waypoint` / `PatrolRoute` structs
// (`src-tauri/src/spatial/waypoints.rs`) use snake_case field names
// (no `#[serde(rename_all)]` on `LevelData` itself, matching
// `generation_seed` / `collision_shape` elsewhere in this file) — so
// the TS -> wire conversion here just renames `dwellTime` ->
// `dwell_time`, `nextWaypointId` -> `next_waypoint_id`, `waypointIds`
// -> `waypoint_ids`. `PatrolMode` values (`'loop' | 'ping-pong' |
// 'random'`) are sent verbatim; the Rust enum mirrors those exact
// strings (see that module's doc comment).

export interface WaypointExport {
  id: string
  position: [number, number, number]
  dwell_time?: number
  next_waypoint_id?: string
}

export interface PatrolRouteExport {
  id: string
  waypoint_ids: string[]
  mode: string
}

function toWaypointExport(wp: Waypoint): WaypointExport {
  return {
    id: wp.id,
    position: wp.position,
    ...(wp.dwellTime !== undefined ? { dwell_time: wp.dwellTime } : {}),
    ...(wp.nextWaypointId !== undefined ? { next_waypoint_id: wp.nextWaypointId } : {}),
  }
}

function toPatrolRouteExport(route: PatrolRoute): PatrolRouteExport {
  return {
    id: route.id,
    waypoint_ids: route.waypointIds,
    mode: route.mode,
  }
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
  waypoints: WaypointExport[]
  patrol_routes: PatrolRouteExport[]
}

/**
 * Build the `levelData` payload for the `export_level` Tauri command
 * (ExportPanel.tsx). The four marker fields are spread-conditionally
 * so absent markers omit the key entirely. `waypoints` / `routes`
 * (T57) are level-level, not per-object, so they ride along as
 * top-level arrays alongside `objects`.
 */
export function buildLevelExportPayload(
  sceneObjects: Iterable<SceneObject>,
  options: {
    id?: string
    name?: string
    waypoints?: readonly Waypoint[]
    patrolRoutes?: readonly PatrolRoute[]
  } = {}
): LevelExportPayload {
  const id = options.id ?? `level-${Date.now()}`
  const name = options.name ?? 'Morgan-Bevy Level'
  return {
    id,
    name,
    waypoints: (options.waypoints ?? []).map(toWaypointExport),
    patrol_routes: (options.patrolRoutes ?? []).map(toPatrolRouteExport),
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
  waypoints: WaypointExport[]
  patrol_routes: PatrolRouteExport[]
}

/**
 * Build the `levelData` payload for the `export_level_simple` Tauri
 * command (FileMenu.tsx handleLevelExport). Slightly different shape
 * than `export_level` — material is a full object, not a string id,
 * and metadata is per-object visibility / lock / collision / walkable.
 * Markers ride along here too; `waypoints` / `patrol_routes` (T57)
 * ride along as level-level top-level arrays, same as above.
 */
export function buildFileMenuLevelExportPayload(
  sceneObjects: Iterable<SceneObject>,
  options: {
    id?: string
    name?: string
    waypoints?: readonly Waypoint[]
    patrolRoutes?: readonly PatrolRoute[]
  } = {}
): FileMenuLevelExportPayload {
  const id = options.id ?? `level_${Date.now()}`
  const name = options.name ?? 'Morgan-Bevy Level'
  return {
    id,
    name,
    waypoints: (options.waypoints ?? []).map(toWaypointExport),
    patrol_routes: (options.patrolRoutes ?? []).map(toPatrolRouteExport),
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

// ─── T57: waypoints / patrol routes for the JSON scene export ────────────────
//
// FileMenu.tsx's `handleExport` builds its `exportData.scene` object
// inline rather than through a `buildXExportPayload` function (that
// export is a direct-download JSON blob, not a Tauri `LevelData`
// round trip) — these two exported wrappers give it the same
// snake_case wire shape as `buildLevelExportPayload` /
// `buildFileMenuLevelExportPayload` for `exportData.scene.waypoints`
// / `exportData.scene.patrolRoutes`.

export function buildWaypointsExport(waypoints: Iterable<Waypoint>): WaypointExport[] {
  return Array.from(waypoints).map(toWaypointExport)
}

export function buildPatrolRoutesExport(routes: Iterable<PatrolRoute>): PatrolRouteExport[] {
  return Array.from(routes).map(toPatrolRouteExport)
}

/**
 * Convert the editor's LevelExportPayload into the Bevy-runtime
 * LevelData shape that `save_level_to_file` expects on the Rust
 * side. The shapes differ:
 *
 *   LevelExportPayload (editor) — flat object array with
 *     per-object markers; the export pipeline uses this directly.
 *   LevelData (Bevy runtime)    — nested metadata / dimensions /
 *     entities with a different field naming convention.
 *
 * Used by the "Save Level…" button in ExportPanel.
 */
export function levelExportPayloadToLevelData(
  payload: LevelExportPayload
): {
  metadata: {
    generator: string
    seed: number
    algorithm: string
    theme: string
    [key: string]: unknown
  }
  dimensions: {
    width: number
    height: number
    floors: number
    [key: string]: unknown
  }
  entities: Record<string, unknown>[]
} {
  // Best-effort field extraction. The Bevy-side metadata block
  // has generator/seed/algorithm/theme; LevelExportPayload doesn't
  // carry seed/algorithm explicitly (those live on the editor's
  // store) so we fall back to safe defaults when absent. The
  // caller can pass `seed` / `algorithm` via `options` if they
  // have richer data.
  return {
    metadata: {
      generator: 'morgan-bevy',
      seed: 0,
      algorithm: 'manual',
      theme: 'office',
    },
    dimensions: {
      width: 48,
      height: 36,
      floors: 3,
    },
    entities: payload.objects.map(obj => ({
      id: obj.id,
      name: obj.name,
      transform: obj.transform,
      ...(obj.marker ? { marker: obj.marker } : {}),
    })),
  }
}
