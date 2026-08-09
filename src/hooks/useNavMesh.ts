// T56 — useNavMesh hook.
//
// Fetches the navmesh once from Rust via `generate_navmesh` (T56's
// Tauri command) and holds it in local hook state — per-frame
// geometry doesn't belong in Zustand (see MeasurementOverlay /
// useMeasurementTool for the sibling pattern). The viewport toggle
// is local boolean state; `regenerate()` re-derives the inputs from
// the current scene objects and re-fetches.

import { useCallback, useState } from 'react'

import type { SceneObject } from '@/store/editorStore'
import type { ObjectId } from '@/types/brand'
import { deriveNavMeshInputs, generateNavMesh } from '@/types/navmesh'
import type { NavMesh } from '@/types/schemas'

export interface UseNavMeshResult {
  /** The most recently generated navmesh, or `null` if none has
   *  been generated yet (or the scene has no walkable surfaces). */
  readonly navMesh: NavMesh | null
  /** True iff the navmesh overlay should render in the viewport. */
  readonly visible: boolean
  /** True while `regenerate()` is in flight. */
  readonly loading: boolean
  /** Set when the last `regenerate()` call failed. `null` otherwise. */
  readonly error: string | null
  /** Toggle the overlay's visibility without regenerating. */
  toggleVisible: () => void
  /** Re-derive surfaces/obstacles from `sceneObjects` and re-fetch
   *  the navmesh from the Rust backend. */
  regenerate: (sceneObjects: ReadonlyMap<ObjectId, SceneObject>) => Promise<void>
}

export function useNavMesh(): UseNavMeshResult {
  const [navMesh, setNavMesh] = useState<NavMesh | null>(null)
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleVisible = useCallback(() => {
    setVisible(prev => !prev)
  }, [])

  const regenerate = useCallback(async (sceneObjects: ReadonlyMap<ObjectId, SceneObject>) => {
    setLoading(true)
    setError(null)
    try {
      const { surfaces, obstacles } = deriveNavMeshInputs(sceneObjects)
      const mesh = await generateNavMesh(surfaces, obstacles)
      setNavMesh(mesh)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  return { navMesh, visible, loading, error, toggleVisible, regenerate }
}
