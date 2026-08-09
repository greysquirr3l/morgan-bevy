// T56 — Navigation mesh viewport overlay.
//
// Renders the generated navmesh as debug wireframe/line geometry:
// cyan for walkable polygon boundaries, amber for doorway
// connections (portals), and a dim red wireframe box per obstacle.
// Must live inside <Canvas> (R3F context) — mounted from
// Viewport3D.tsx alongside TransformGizmos / BoxSelection.
//
// The geometry-building math is pure and lives in
// `src/utils/navmeshGeometry.ts` so it's unit-testable without a
// WebGL context; this component only wires that data into
// `<lineSegments>` and recomputes on navmesh change via `useMemo`.

import { useMemo } from 'react'
import * as THREE from 'three'

import type { NavMesh } from '@/types/schemas'
import {
  navMeshConnectionPositions,
  navMeshObstaclePositions,
  navMeshPolygonEdgePositions,
} from '@/utils/navmeshGeometry'

export interface NavMeshOverlayProps {
  /** The navmesh to render. `null` renders nothing. */
  navMesh: NavMesh | null
  /** Whether the overlay is visible at all. */
  visible: boolean
}

function useLineGeometry(positions: Float32Array): THREE.BufferGeometry {
  return useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [positions])
}

export default function NavMeshOverlay({ navMesh, visible }: NavMeshOverlayProps) {
  const polygonPositions = useMemo(
    () => (navMesh ? navMeshPolygonEdgePositions(navMesh) : new Float32Array(0)),
    [navMesh]
  )
  const connectionPositions = useMemo(
    () => (navMesh ? navMeshConnectionPositions(navMesh) : new Float32Array(0)),
    [navMesh]
  )
  const obstaclePositions = useMemo(
    () => (navMesh ? navMeshObstaclePositions(navMesh) : new Float32Array(0)),
    [navMesh]
  )

  const polygonGeometry = useLineGeometry(polygonPositions)
  const connectionGeometry = useLineGeometry(connectionPositions)
  const obstacleGeometry = useLineGeometry(obstaclePositions)

  if (!visible || !navMesh) return null

  return (
    <group name="navmesh-overlay" renderOrder={10}>
      {polygonPositions.length > 0 && (
        <lineSegments geometry={polygonGeometry}>
          <lineBasicMaterial color="#22d3ee" depthTest={false} transparent opacity={0.9} />
        </lineSegments>
      )}
      {connectionPositions.length > 0 && (
        <lineSegments geometry={connectionGeometry}>
          <lineBasicMaterial
            color="#fbbf24"
            depthTest={false}
            transparent
            opacity={0.95}
            linewidth={2}
          />
        </lineSegments>
      )}
      {obstaclePositions.length > 0 && (
        <lineSegments geometry={obstacleGeometry}>
          <lineBasicMaterial color="#f87171" depthTest={false} transparent opacity={0.6} />
        </lineSegments>
      )}
    </group>
  )
}
