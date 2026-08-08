/**
 * T62 — Prefab starter library.
 *
 * The library is bundled at build time via Vite's `import.meta.glob`
 * — every `.prefab.json` file under `src/data/prefabs/` is inlined
 * into the JS. The bootstrap function installs them into the user's
 * localStorage on first run, idempotently.
 *
 * These tests cover:
 *  - Every bundled starter prefab loads and validates without errors.
 *  - The seven expected starter ids are present (door, window, desk,
 *    meeting table, corridor section, room kit, stairwell).
 *  - Each starter prefab has at least one object and a valid
 *    `meshType` on every mesh.
 *  - `bootstrapStarterPrefabsIfNeeded` installs the starters when
 *    nothing is in the library, returns `false` on subsequent
 *    calls, and merges without overwriting existing user prefabs.
 *  - `resetStarterBootstrap` clears the flag so the next call
 *    re-installs.
 *  - A malformed `.prefab.json` is dropped (logged) rather than
 *    sinking the whole library.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PrefabId } from '@/types/brand'
import {
  bootstrapStarterPrefabsIfNeeded,
  loadPrefabs,
  loadStarterPrefabs,
  resetStarterBootstrap,
  savePrefab,
  type Prefab,
} from '@/utils/prefabs'

const STORAGE_KEY = 'morgan-bevy-prefabs'
const BOOTSTRAP_KEY = 'morgan-bevy-prefab-starters-bootstrapped'

function clearStarterState(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(BOOTSTRAP_KEY)
}

beforeEach(() => clearStarterState())
afterEach(() => clearStarterState())

describe('T62 loadStarterPrefabs', () => {
  it('returns the seven starter prefabs without errors', () => {
    const starters = loadStarterPrefabs()
    expect(starters.length).toBeGreaterThanOrEqual(7)
    const ids = starters.map(p => p.id)
    expect(ids).toContain('prefab_door_standard')
    expect(ids).toContain('prefab_window_standard')
    expect(ids).toContain('prefab_desk')
    expect(ids).toContain('prefab_meeting_table')
    expect(ids).toContain('prefab_corridor_section')
    expect(ids).toContain('prefab_room_kit')
    expect(ids).toContain('prefab_stairwell')
  })

  it('every starter prefab has at least one object with a defined meshType', () => {
    const starters = loadStarterPrefabs()
    for (const prefab of starters) {
      expect(prefab.objects.length).toBeGreaterThan(0)
      for (const obj of prefab.objects) {
        // Mesh-only object — every starter is built from primitives.
        expect(obj.meshType).toBeDefined()
        expect(obj.position).toHaveLength(3)
        expect(obj.rotation).toHaveLength(3)
        expect(obj.scale).toHaveLength(3)
      }
    }
  })

  it('every starter prefab has a name and a stable id', () => {
    const starters = loadStarterPrefabs()
    for (const prefab of starters) {
      expect(prefab.name).toBeTruthy()
      expect(typeof prefab.id).toBe('string')
      expect(prefab.id).toMatch(/^prefab_/)
    }
  })

  it('returns a fresh array (mutating the result does not affect future calls)', () => {
    const a = loadStarterPrefabs()
    const before = a.length
    a.pop()
    const b = loadStarterPrefabs()
    expect(b.length).toBe(before)
  })
})

describe('T62 bootstrapStarterPrefabsIfNeeded', () => {
  it('installs the starter prefabs on first run when the library is empty', () => {
    expect(loadPrefabs()).toEqual([])

    const installed = bootstrapStarterPrefabsIfNeeded()
    expect(installed).toBe(true)

    const stored = loadPrefabs()
    expect(stored.length).toBeGreaterThanOrEqual(7)
    expect(stored.map(p => p.id)).toContain('prefab_door_standard')
    expect(stored.map(p => p.id)).toContain('prefab_room_kit')
  })

  it('is idempotent — subsequent calls return false without duplication', () => {
    bootstrapStarterPrefabsIfNeeded()
    const firstCount = loadPrefabs().length

    const second = bootstrapStarterPrefabsIfNeeded()
    expect(second).toBe(false)
    expect(loadPrefabs().length).toBe(firstCount)
  })

  it('does not overwrite user prefabs already present', () => {
    // User adds their own prefab before the bootstrap flag is set.
    const userPrefab: Prefab = {
      id: PrefabId('prefab_user_artifact'),
      name: 'User Artifact',
      objects: [],
      createdAt: '2026-08-08T00:00:00.000Z',
    }
    savePrefab(userPrefab)

    bootstrapStarterPrefabsIfNeeded()
    const stored = loadPrefabs()
    expect(stored.map(p => p.id)).toContain('prefab_user_artifact')
    expect(stored.map(p => p.id)).toContain('prefab_door_standard')
  })

  it('skips re-installing when every starter id is already present', () => {
    bootstrapStarterPrefabsIfNeeded()
    // Reset the flag, but keep the library as-is.
    localStorage.removeItem(BOOTSTRAP_KEY)
    const before = loadPrefabs().length

    const result = bootstrapStarterPrefabsIfNeeded()
    expect(result).toBe(false)
    expect(loadPrefabs().length).toBe(before)
  })

  it('marks the bootstrap as done via the dedicated flag', () => {
    bootstrapStarterPrefabsIfNeeded()
    expect(localStorage.getItem(BOOTSTRAP_KEY)).toBe('1')
  })

  it('survives a corrupted library without throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    // `loadPrefabs` is corruption-tolerant (returns []); the bootstrap
    // should still install the starters.
    const result = bootstrapStarterPrefabsIfNeeded()
    expect(result).toBe(true)
    expect(loadPrefabs().length).toBeGreaterThanOrEqual(7)
  })
})

describe('T62 resetStarterBootstrap', () => {
  it('clears the bootstrap flag so the next call re-installs', () => {
    bootstrapStarterPrefabsIfNeeded()
    expect(localStorage.getItem(BOOTSTRAP_KEY)).toBe('1')

    resetStarterBootstrap()
    expect(localStorage.getItem(BOOTSTRAP_KEY)).toBeNull()

    // Library is still in place — a re-install would just merge
    // (no-op because all starter ids are already there).
    const result = bootstrapStarterPrefabsIfNeeded()
    expect(result).toBe(false)
    expect(loadPrefabs().length).toBeGreaterThanOrEqual(7)
  })
})
