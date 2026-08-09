// T57 — Waypoint viewport overlay: in-Canvas piece. Rendered inside
// `<Canvas>` in `Viewport3D.tsx`, alongside `PaintToolViewport` /
// `NavMeshOverlay` / `TransformGizmos` / `BoxSelection` — same "R3F
// component driven by a hook + pure geometry builders" shape those
// use.
//
// Waypoints render as small spheres (one `<mesh>` per waypoint —
// the expected waypoint count per level is small, so this is simpler
// than an InstancedMesh and matches the project's existing
// "map over a small array of markers" style). Patrol route paths
// render as a single `<lineSegments>` built from every route's
// navmesh-routed path via `allPatrolRoutePathPositions`
// (`src/utils/waypointGeometry.ts`), mirroring how `NavMeshOverlay`
// (T56) builds its line geometry in `navmeshGeometry.ts`.

import { useWaypointTool } from '@/hooks/useWaypointTool'
import { useEditorStore } from '@/store/editorStore'
import type { NavMesh } from '@/types/schemas'
import { allPatrolRoutePathPositions } from '@/utils/waypointGeometry'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'

const WAYPOINT_SPHERE_RADIUS = 0.25

export interface WaypointViewportProps {
  /** The navmesh routes are drawn against, or `null` to fall back to
   *  straight lines between consecutive waypoints. */
  navMesh: NavMesh | null
}

function usePathLineGeometry(positions: Float32Array): THREE.BufferGeometry {
  return useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [positions])
}

export default function WaypointViewport({ navMesh }: WaypointViewportProps) {
  // Mounting this hook is what wires up click-to-place pointer
  // handling; the returned flag isn't otherwise needed here since
  // the spheres/paths always render regardless of placement mode.
  useWaypointTool()

  const { waypoints, patrolRoutes } = useEditorStore(
    useShallow(s => ({ waypoints: s.waypoints, patrolRoutes: s.patrolRoutes }))
  )

  const pathPositions = useMemo(
    () => allPatrolRoutePathPositions(waypoints, patrolRoutes, navMesh),
    [waypoints, patrolRoutes, navMesh]
  )
  const pathGeometry = usePathLineGeometry(pathPositions)

  return (
    <group name="waypoint-overlay" renderOrder={11} data-testid="waypoint-overlay">
      {waypoints.map(wp => (
        <mesh
          key={wp.id}
          position={wp.position}
          renderOrder={12}
          data-testid={`waypoint-sphere-${wp.id}`}
        >
          <sphereGeometry args={[WAYPOINT_SPHERE_RADIUS, 12, 12]} />
          <meshBasicMaterial color="#34d399" depthTest={false} transparent opacity={0.9} />
        </mesh>
      ))}

      {pathPositions.length > 0 && (
        <lineSegments geometry={pathGeometry} data-testid="waypoint-path-lines">
          <lineBasicMaterial color="#38bdf8" depthTest={false} transparent opacity={0.9} />
        </lineSegments>
      )}
    </group>
  )
}
