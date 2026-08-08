/**
 * Prefab system (T19).
 *
 * A *prefab* is a serialised subgraph (parent + children + transforms
 * + materials) keyed by name. The library is stored as JSON in
 * localStorage; instantiating a prefab spawns a deep-cloned copy of
 * every object in the subgraph at a target origin.
 *
 * `prefabInstanceId` on each scene object marks the object as a
 * prefab instance — the field links the object back to the
 * `Prefab` it was instantiated from. `breakPrefab` clears that
 * field on a list of objects, severing the link so future edits
 * to the source prefab no longer propagate.
 */
import type { EditorState } from '@/store/editorStore'
import { isValidIdString, PrefabId, type LayerId, type ObjectId } from '@/types/brand'

export interface PrefabObject {
  /** Optional original id; cleared on save so the template is reusable. */
  id?: ObjectId
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
  /** Optional nested-prefab reference. */
  prefabId?: PrefabId
  /** Material reference shared with the prefab source. */
  material?: {
    baseColor: string
    metallic: number
    roughness: number
    texture?: string
  }
}

export interface Prefab {
  id: PrefabId
  name: string
  description?: string
  objects: PrefabObject[]
  thumbnail?: string
  createdAt: string
}

const STORAGE_KEY = 'morgan-bevy-prefabs'
const STARTER_BOOTSTRAP_KEY = 'morgan-bevy-prefab-starters-bootstrapped'

// ─── Starter library (Vite-bundled) ──────────────────────────────────────
//
// Vite's `import.meta.glob` with `eager: true` and `import: 'default'`
// inlines every `.prefab.json` file under `src/data/prefabs/` at
// build time. The result is a plain object map of path -> parsed
// JSON value, ready to validate and ship to the PrefabManager.
// The library is bundled into the frontend's JS, so there's no
// runtime fetch / no `tauri.conf.json` `resources` entry needed.

const STARTER_PREFAB_MODULES = import.meta.glob<{ default: Prefab }>(
  '../data/prefabs/*.prefab.json',
  { eager: true }
)

/**
 * T62: load the bundled starter prefab library. Each entry has
 * already been parsed by Vite's JSON importer, but the boundary
 * is still untrusted (a hand-edited `.prefab.json` could be
 * malformed) so `isPrefab` re-validates each one before returning.
 * Drops anything that fails validation with a `console.warn` —
 * one bad file must not sink the whole library.
 */
export function loadStarterPrefabs(): Prefab[] {
  const out: Prefab[] = []
  for (const [path, mod] of Object.entries(STARTER_PREFAB_MODULES)) {
    const candidate = mod.default
    if (!isPrefab(candidate)) {
      console.warn(`loadStarterPrefabs: dropping invalid prefab at ${path}`)
      continue
    }
    out.push(candidate)
  }
  return out
}

/**
 * T62: bootstrap the user's library with the starter prefabs on
 * first run. Idempotent — if every starter id is already present
 * in the user's library, or the user has marked the bootstrap
 * done via `STARTER_BOOTSTRAP_KEY`, the function returns
 * `false` (no changes). Returns `true` if the user now has the
 * starter prefabs.
 */
export function bootstrapStarterPrefabsIfNeeded(): boolean {
  const flag = localStorage.getItem(STARTER_BOOTSTRAP_KEY)
  if (flag === '1') return false

  const existing = loadPrefabs()
  const starters = loadStarterPrefabs()
  if (starters.length === 0) {
    // No starters bundled; still mark as done so we don't keep
    // trying on every load.
    localStorage.setItem(STARTER_BOOTSTRAP_KEY, '1')
    return false
  }

  const existingIds = new Set(existing.map(p => p.id))
  const missing = starters.filter(p => !existingIds.has(p.id))
  if (missing.length === 0) {
    localStorage.setItem(STARTER_BOOTSTRAP_KEY, '1')
    return false
  }

  const next = [...existing, ...missing]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  localStorage.setItem(STARTER_BOOTSTRAP_KEY, '1')
  return true
}

/** Reset the bootstrap flag so the next call re-installs the starters. */
export function resetStarterBootstrap(): void {
  localStorage.removeItem(STARTER_BOOTSTRAP_KEY)
}

// ─── localStorage layer ──────────────────────────────────────────────────

/** T19: read every prefab from localStorage with corruption tolerance. */
export function loadPrefabs(): Prefab[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPrefab)
  } catch {
    return []
  }
}

/** T19: persist a new prefab (or overwrite one with the same id). */
export function savePrefab(prefab: Prefab): Prefab[] {
  const existing = loadPrefabs()
  const filtered = existing.filter(p => p.id !== prefab.id)
  const next = [...filtered, prefab]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

/** T19: remove a prefab by id; returns the remaining prefabs. */
export function deletePrefabById(id: PrefabId): Prefab[] {
  const existing = loadPrefabs()
  const next = existing.filter(p => p.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

// Boundary: `loadPrefabs` reads untrusted JSON out of localStorage.
// `isValidIdString` (rather than a bare `typeof === 'string'` check)
// ensures a corrupted/malformed `id` is rejected here rather than
// silently flowing into the app as an ill-shaped `PrefabId`.
function isPrefab(value: unknown): value is Prefab {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    isValidIdString(v.id) &&
    typeof v.name === 'string' &&
    Array.isArray(v.objects) &&
    typeof v.createdAt === 'string'
  )
}

// ─── Prefab construction ────────────────────────────────────────────────

/**
 * Build a `Prefab` from the currently-selected scene objects.
 * Each object's id / parentId is cleared so the template can be
 * reused on instantiate.
 */
export function buildPrefabFromSelection(
  selectedIds: ObjectId[],
  sceneObjects: EditorState['sceneObjects'],
  name: string,
  description?: string
): Prefab | null {
  const objects: PrefabObject[] = []
  for (const id of selectedIds) {
    const obj = sceneObjects.get(id)
    if (!obj) continue
    const template: PrefabObject = {
      id: undefined,
      name: obj.name,
      type: obj.type,
      position: [...obj.position] as [number, number, number],
      rotation: [...obj.rotation] as [number, number, number],
      scale: [...obj.scale] as [number, number, number],
      visible: obj.visible,
      locked: obj.locked,
      layerId: obj.layerId,
      children: [],
      ...(obj.meshType !== undefined ? { meshType: obj.meshType } : {}),
      ...(obj.material !== undefined ? { material: { ...obj.material } } : {}),
    }
    objects.push(template)
  }
  if (objects.length === 0) return null
  return {
    // Generation site (not a boundary): minted here, not parsed from
    // untrusted input — use the plain constructor.
    id: PrefabId(`prefab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`),
    name: name.trim(),
    ...(description ? { description: description.trim() } : {}),
    objects,
    createdAt: new Date().toISOString(),
  }
}

// ─── Instantiate / break ───────────────────────────────────────────────

/**
 * Compute the new object templates produced by instantiating a
 * prefab at `originOffset`. Every object in the prefab gets a fresh
 * id and `prefabInstanceId` so it can be unlinked later.
 */
export function instantiatePrefabObjects(
  prefab: Prefab,
  originOffset: [number, number, number] = [2, 0, 0]
): PrefabObject[] {
  return prefab.objects.map(obj => ({
    ...obj,
    id: undefined,
    position: [
      obj.position[0] + originOffset[0],
      obj.position[1] + originOffset[1],
      obj.position[2] + originOffset[2],
    ],
    prefabId: prefab.id,
  }))
}

/**
 * Break the prefab link on a list of objects. Returns the
 * object ids that had a `prefabInstanceId` field set; callers use
 * this to clear the field via the store.
 *
 * Pure function: does not mutate any input. The caller is
 * responsible for writing the result back into the scene.
 */
export function breakPrefabOnObjects<K extends string, T extends { prefabInstanceId?: unknown }>(
  objects: Array<{ id: K; obj: T }>
): K[] {
  const broken: K[] = []
  for (const { id, obj } of objects) {
    if (obj.prefabInstanceId !== undefined) {
      broken.push(id)
    }
  }
  return broken
}

/**
 * Convenience wrapper: given a scene's object map and a list of
 * ids to break, return a new map with the `prefabInstanceId`
 * field cleared on each entry.
 */
export function applyBreakPrefab<K extends string, T extends { prefabInstanceId?: unknown }>(
  scene: Map<K, T>,
  ids: K[]
): Map<K, T> {
  const next = new Map(scene)
  for (const id of ids) {
    const obj = next.get(id)
    if (!obj) continue
    const { prefabInstanceId, ...rest } = obj
    void prefabInstanceId
    next.set(id, rest as T)
  }
  return next
}
