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

// The global lighting-rig entry type (T55, `EditorState.lights` /
// `setLights`) isn't exported from the store either — it's defined
// inline on `EditorState.lights` and the `setLights`/`addLight`
// params. Same "structural type is enough" approach as `LayerShape`
// above. This is the *scene-level* lighting rig (Lighting panel /
// Auto-Light), distinct from the per-object `SceneObject['light']`
// marker handled by `spreadIfPresent` below.
export interface LightRigEntry {
  id: string
  kind: 'ambient' | 'directional' | 'point' | 'spot'
  position: [number, number, number]
  color: [number, number, number]
  intensity: number
  angle?: number
  castShadow: boolean
  shadowQuality: 'off' | 'hard' | 'soft' | 'ultra'
  name?: string
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

// ─── T55/audit fix: global lighting-rig wire-format conversion ───────────────
//
// `state.lights` (the Lighting panel / Auto-Light rig) never made it
// into any export payload — only the unrelated per-object
// `SceneObject.light` marker did (via `spreadIfPresent` below). This
// converts a rig entry to snake_case, mirroring the
// `toWaypointExport` / `toPatrolRouteExport` convention used
// elsewhere in this file for level-level (not per-object) arrays.

export interface LightRigExport {
  id: string
  kind: 'ambient' | 'directional' | 'point' | 'spot'
  position: [number, number, number]
  color: [number, number, number]
  intensity: number
  angle?: number
  cast_shadow: boolean
  shadow_quality: 'off' | 'hard' | 'soft' | 'ultra'
  name?: string
}

function toLightRigExport(light: LightRigEntry): LightRigExport {
  return {
    id: light.id,
    kind: light.kind,
    position: light.position,
    color: light.color,
    intensity: light.intensity,
    ...(light.angle !== undefined ? { angle: light.angle } : {}),
    cast_shadow: light.castShadow,
    shadow_quality: light.shadowQuality,
    ...(light.name !== undefined ? { name: light.name } : {}),
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
  /**
   * The global lighting rig (T55 Lighting panel / Auto-Light),
   * distinct from the per-object `light` marker spread onto each
   * entry of `objects` below. Previously missing entirely — a
   * scene's lighting setup never round-tripped into any export.
   */
  lights: LightRigExport[]
}

/**
 * Build the `levelData` payload for the `export_level` Tauri command
 * (ExportPanel.tsx). The four marker fields are spread-conditionally
 * so absent markers omit the key entirely. `waypoints` / `routes`
 * (T57) are level-level, not per-object, so they ride along as
 * top-level arrays alongside `objects`. `lights` (T55 rig) rides
 * along the same way.
 */
export function buildLevelExportPayload(
  sceneObjects: Iterable<SceneObject>,
  options: {
    id?: string
    name?: string
    waypoints?: readonly Waypoint[]
    patrolRoutes?: readonly PatrolRoute[]
    lights?: readonly LightRigEntry[]
  } = {}
): LevelExportPayload {
  const id = options.id ?? `level-${Date.now()}`
  const name = options.name ?? 'Morgan-Bevy Level'
  return {
    id,
    name,
    waypoints: (options.waypoints ?? []).map(toWaypointExport),
    patrol_routes: (options.patrolRoutes ?? []).map(toPatrolRouteExport),
    lights: (options.lights ?? []).map(toLightRigExport),
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
  /** Global lighting rig (T55) — see `LevelExportPayload.lights`. */
  lights: LightRigExport[]
}

/**
 * Build the `levelData` payload for the `export_level_simple` Tauri
 * command (FileMenu.tsx handleLevelExport). Slightly different shape
 * than `export_level` — material is a full object, not a string id,
 * and metadata is per-object visibility / lock / collision / walkable.
 * Markers ride along here too; `waypoints` / `patrol_routes` (T57)
 * and `lights` (T55 rig) ride along as level-level top-level arrays,
 * same as above.
 */
export function buildFileMenuLevelExportPayload(
  sceneObjects: Iterable<SceneObject>,
  options: {
    id?: string
    name?: string
    waypoints?: readonly Waypoint[]
    patrolRoutes?: readonly PatrolRoute[]
    lights?: readonly LightRigEntry[]
  } = {}
): FileMenuLevelExportPayload {
  const id = options.id ?? `level_${Date.now()}`
  const name = options.name ?? 'Morgan-Bevy Level'
  return {
    id,
    name,
    waypoints: (options.waypoints ?? []).map(toWaypointExport),
    patrol_routes: (options.patrolRoutes ?? []).map(toPatrolRouteExport),
    lights: (options.lights ?? []).map(toLightRigExport),
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

// ─── Audit fix: ExportPanel "Include Metadata" / "Include Generation
// Data" / "Optimize for Size" checkboxes ─────────────────────────────
//
// These checkboxes have real UI state (`ExportPanel.tsx`) but the
// Rust `export_level` command signature is
// `(level_data, formats, output_path)` — the three flags, passed
// alongside as extra `invoke()` args, are silently ignored by serde
// on the Rust side (not authorized to change the Rust command here).
// So the only way to make them do anything is to filter/transform
// the payload itself on the frontend, before it's handed to
// `invoke`.
//
// What's safe to strip is constrained by the Rust `GameObject` /
// `LevelData` structs (`src-tauri/src/main.rs`):
//   - `metadata: HashMap<String, serde_json::Value>` and
//     `tags: Vec<String>` have NO `#[serde(default)]` — the key
//     must stay present (contents can be emptied, the key can't be
//     omitted) or Deserialize on `level_data` fails with
//     "missing field".
//   - `generation_seed` / `generation_params` are `Option<T>` but
//     also lack `#[serde(default)]` on this struct — `null` is
//     fine, omitting the key is not.
//   - `waypoints` / `patrol_routes` DO carry
//     `#[serde(default, skip_serializing_if = ...)]` — omitting an
//     empty array is safe and is exactly what that attribute is
//     for. `lights` (this file's new field, not yet a matching Rust
//     field at all) is treated the same way for consistency.
//
// Given those constraints, the three flags are defined as:
//   - `includeMetadata=false` -> every object's `metadata` becomes
//     `{}` (key stays, contents cleared).
//   - `includeGenerationData=false` -> the provenance-ish
//     `metadata.created_at` timestamp is dropped from every object,
//     and the top-level `generation_seed` / `generation_params`
//     are forced to `null` (already `null` in the current builders,
//     but this keeps the flag meaningful once real generation
//     provenance is threaded through).
//   - `optimizeForSize=true` -> the redundant `metadata.mesh_type`
//     key is dropped (it duplicates the top-level `mesh` field),
//     and `waypoints` / `patrol_routes` / `lights` are omitted
//     entirely when they're empty arrays, instead of sending `[]`.

export interface ExportOptionFlags {
  includeMetadata: boolean
  includeGenerationData: boolean
  optimizeForSize: boolean
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Apply the ExportPanel's three checkboxes to an already-built
 * `LevelExportPayload` (or the structurally-similar
 * `FileMenuLevelExportPayload`), entirely on the frontend — see the
 * module comment above for why this can't be done on the Rust side.
 * Returns a new object; does not mutate `payload`.
 */
export function applyExportOptions<T extends { objects: Array<Record<string, unknown>> }>(
  payload: T,
  options: ExportOptionFlags
): T {
  const objects = payload.objects.map(obj => {
    const metadata: Record<string, unknown> = isPlainObject(obj.metadata)
      ? { ...obj.metadata }
      : {}

    if (!options.includeMetadata) {
      // Clear entirely — the key itself must stay (Rust requires
      // `metadata` present, just not any particular contents).
      for (const key of Object.keys(metadata)) delete metadata[key]
    } else if (!options.includeGenerationData) {
      delete metadata.created_at
    }

    if (options.optimizeForSize) {
      delete metadata.mesh_type
    }

    return { ...obj, metadata }
  })

  const result: Record<string, unknown> = { ...payload, objects }

  if (!options.includeGenerationData) {
    if ('generation_seed' in result) result.generation_seed = null
    if ('generation_params' in result) result.generation_params = null
  }

  if (options.optimizeForSize) {
    for (const key of ['waypoints', 'patrol_routes', 'lights'] as const) {
      const value = result[key]
      if (Array.isArray(value) && value.length === 0) delete result[key]
    }
  }

  return result as T
}
