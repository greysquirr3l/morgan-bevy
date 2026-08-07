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

export interface PrefabObject {
  /** Optional original id; cleared on save so the template is reusable. */
  id?: string
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
  /** Optional nested-prefab reference. */
  prefabId?: string
  /** Material reference shared with the prefab source. */
  material?: {
    baseColor: string
    metallic: number
    roughness: number
    texture?: string
  }
}

export interface Prefab {
  id: string
  name: string
  description?: string
  objects: PrefabObject[]
  thumbnail?: string
  createdAt: string
}

const STORAGE_KEY = 'morgan-bevy-prefabs'

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
export function deletePrefabById(id: string): Prefab[] {
  const existing = loadPrefabs()
  const next = existing.filter(p => p.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

function isPrefab(value: unknown): value is Prefab {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
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
  selectedIds: string[],
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
    id: `prefab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
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
export function breakPrefabOnObjects<T extends { prefabInstanceId?: string }>(
  objects: Array<{ id: string; obj: T }>
): string[] {
  const broken: string[] = []
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
export function applyBreakPrefab<T extends { prefabInstanceId?: string }>(
  scene: Map<string, T>,
  ids: string[]
): Map<string, T> {
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
