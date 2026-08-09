// T56 — Navigation mesh: TS types, scene-object derivation, and the
// `generate_navmesh` Tauri command wrapper.
//
// Wire format mirrors `src-tauri/src/spatial/navmesh.rs` (see that
// module's doc comment for the algorithm). Runtime validation lives
// in `src/types/schemas/index.ts` per project convention (every
// Tauri invoke return / request payload is zod-validated at the IPC
// boundary) — this file re-exports the inferred types and adds the
// pure scene-derivation logic + the invoke wrapper.

import {
  NavMeshSchema,
  NavObstacleInputSchema,
  parseInvoke,
  type NavMesh,
  type NavObstacleInput,
  type NavObstacleKind,
  type NavWalkableSurface,
} from '@/types/schemas'
import type { SceneObject } from '@/store/editorStore'
import type { ObjectId } from '@/types/brand'
import { z } from 'zod'

export type {
  NavConnection,
  NavMesh,
  NavObstacle,
  NavObstacleInput,
  NavPolygon,
} from '@/types/schemas'

/**
 * Derive the `generate_navmesh` command's inputs from the editor's
 * scene objects.
 *
 * - An object with `walkable === true` becomes a `WalkableSurface`.
 * - An object with `collision === true` (and NOT walkable) becomes
 *   an `Obstacle`. Objects tagged `"wall"` are classified as
 *   `ObstacleKind::Wall` (partitions the region it crosses, with a
 *   doorway connection wherever a gap remains); everything else is
 *   `ObstacleKind::FreeStanding` (a hole, doesn't split the
 *   polygon).
 * - Every other object (no `walkable`, no `collision`) is ignored —
 *   it doesn't contribute to the navmesh.
 *
 * The XZ footprint is derived from `position` + `scale` (matching
 * how the editor places floor/wall primitives: `scale` is the
 * object's full width/depth, not half-extents). `height` for a
 * walkable surface is the object's top surface: `position.y +
 * scale.y / 2`.
 */
export function deriveNavMeshInputs(sceneObjects: ReadonlyMap<ObjectId, SceneObject>): {
  surfaces: NavWalkableSurface[]
  obstacles: NavObstacleInput[]
} {
  const surfaces: NavWalkableSurface[] = []
  const obstacles: NavObstacleInput[] = []

  // `sceneObjects` is a Map — always iterate with .values(), never
  // Object.values()/Object.keys() (those return [] silently on a
  // Map and have bitten prior tasks).
  for (const obj of sceneObjects.values()) {
    const [x, y, z] = obj.position
    const [sx, , sz] = obj.scale
    const halfX = Math.abs(sx) / 2
    const halfZ = Math.abs(sz) / 2
    const min: [number, number] = [x - halfX, z - halfZ]
    const max: [number, number] = [x + halfX, z + halfZ]

    if (obj.walkable === true) {
      const halfY = Math.abs(obj.scale[1]) / 2
      surfaces.push({ min, max, height: y + halfY })
      continue
    }

    if (obj.collision === true) {
      const kind: NavObstacleKind = obj.tags?.includes('wall') ? 'wall' : 'free_standing'
      obstacles.push({ min, max, kind })
    }
  }

  return { surfaces, obstacles }
}

const GenerateNavMeshArgsSchema = z.object({
  surfaces: z.array(
    z.object({
      min: z.tuple([z.number(), z.number()]),
      max: z.tuple([z.number(), z.number()]),
      height: z.number(),
    })
  ),
  obstacles: z.array(NavObstacleInputSchema),
})

/**
 * Invoke the `generate_navmesh` Tauri command and validate the
 * response. Returns `null` if `surfaces` is empty (mirrors the
 * Rust side's `NavMeshError::NoWalkableSurfaces`, surfaced here as
 * "nothing to show" rather than a thrown error — an empty scene / a
 * scene with no walkable objects is a normal, expected state, not a
 * bug).
 */
export async function generateNavMesh(
  surfaces: NavWalkableSurface[],
  obstacles: NavObstacleInput[]
): Promise<NavMesh | null> {
  if (surfaces.length === 0) return null
  GenerateNavMeshArgsSchema.parse({ surfaces, obstacles })
  const { invoke } = await import('@tauri-apps/api/core')
  const raw = await invoke('generate_navmesh', { surfaces, obstacles })
  return parseInvoke(NavMeshSchema, raw, 'generate_navmesh')
}
