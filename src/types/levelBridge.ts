/**
 * T97 — Level / spatial command wrappers
 *
 * Five Tauri commands existed on the Rust side but had no front-end
 * callers. This module wraps them with the standard zod-validated
 * boundary:
 *
 *   - `queryObjectsInBounds` — frustum-culling query: returns the
 *     scene-object IDs whose bounding box intersects `bounds`.
 *     Used by the viewport to drive the LOD / occlusion system.
 *
 *   - `updateObjectTransform` — authoritative backend write of an
 *     object's `Transform3D`. The Zustand store still mirrors the
 *     value locally for instant UI feedback; this command is
 *     flushed at the end of every drag (debounced).
 *
 *   - `getCurrentLevel` — returns the Rust-side `current_level`
 *     cache (the level currently loaded into the spatial index).
 *     Used to re-hydrate the front-end after the Rust side swaps
 *     levels (e.g. via the file dialog's `Open`).
 *
 *   - `saveLevelToFile` / `loadLevelFromFile` — round-trip a
 *     `LevelData` through a path on disk. Distinct from the
 *     `save_project` Tauri command which goes through Tauri's
 *     dialog API; these are the "save to a specific path" path
 *     used by the headless tests and the export menu's "save
 *     copy" option.
 */
import type { BoundingBox, LevelData, Transform3D } from './schemas'

/**
 * Run a frustum / bounding-box query against the spatial index.
 * Returns the IDs of objects whose AABB intersects `bounds`.
 * Used by the culling pass (`src/performance/FrustumCulling.tsx`)
 * to skip rendering objects outside the viewport.
 */
export async function queryObjectsInBounds(bounds: BoundingBox): Promise<string[]> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string[]>('query_objects_in_bounds', { bounds })
}

/**
 * Authoritative backend write of `transform` for `objectId`. The
 * Rust side updates both the `current_level.objects[i].transform`
 * and the spatial index entry in one transaction. The front-end
 * Zustand store is updated separately by the caller for instant
 * UI feedback — the two writes are reconciled by the next
 * `get_current_level` snapshot.
 */
export async function updateObjectTransform(
  objectId: string,
  transform: Transform3D
): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke<void>('update_object_transform', { objectId, transform })
}

/**
 * Returns the Rust-side `current_level` cache — the level
 * currently loaded into the spatial index. The result is
 * `Option<LevelData>` (nullable on the wire). Callers should fall
 * back to the front-end Zustand store when the Rust side has no
 * level loaded.
 */
export async function getCurrentLevel(): Promise<LevelData | null> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<LevelData | null>('get_current_level')
}

/**
 * Persist `levelData` to a specific `file_path`. Distinct from
 * `save_project` (Tauri dialog) and from the autosave hook
 * (localStorage) — this is the explicit "save to a path" path
 * used by export-menu actions and headless tests.
 */
export async function saveLevelToFile(levelData: LevelData, filePath: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke<void>('save_level_to_file', { levelData, filePath })
}

/**
 * Load `levelData` from `filePath` and update the Rust-side
 * `current_level` cache (including the spatial index). Returns
 * the parsed level so the caller can apply it to the front-end
 * store in one round-trip.
 */
export async function loadLevelFromFile(filePath: string): Promise<LevelData> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<LevelData>('load_level_from_file', { filePath })
}
