// T57 — Waypoint placement: the interactive (R3F) half.
//
// Pairs with `src/components/Waypoints/WaypointViewport.tsx`, which
// renders the spheres/paths this hook's state drives. Must be called
// from a component rendered inside `<Canvas>` — same `useThree()`
// dependency as `usePaintTool` (T54) / `TransformGizmos` /
// `BoxSelection`, which this hook's raycast setup mirrors directly.
//
// Click-to-place: a single pointerdown while `waypointPlacementActive`
// is true raycasts the scene and drops a waypoint at the hit point
// (or a point on the y=0 ground plane if nothing is hit, so placement
// still works over an empty floor with no meshes yet). No drag
// behaviour — unlike the paint tool's brush stroke, one click = one
// waypoint.

import { useEditorStore } from '@/store/editorStore'
import { WaypointId } from '@/types/brand'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

export function useWaypointTool() {
  const { camera, scene, gl } = useThree()
  const waypointPlacementActive = useEditorStore(s => s.waypointPlacementActive)

  const raycasterRef = useRef(new THREE.Raycaster())

  const raycastPlacementPoint = useCallback(
    (clientX: number, clientY: number): [number, number, number] | null => {
      const rect = gl.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      )
      raycasterRef.current.setFromCamera(ndc, camera)

      const intersections = raycasterRef.current.intersectObjects(scene.children, true)
      const first = intersections.find(i => i.face)
      if (first) {
        return [first.point.x, first.point.y, first.point.z]
      }

      // Nothing under the cursor — fall back to the y=0 ground
      // plane so waypoints can still be placed before any floor
      // geometry exists.
      const groundHit = new THREE.Vector3()
      const hit = raycasterRef.current.ray.intersectPlane(GROUND_PLANE, groundHit)
      if (!hit) return null
      return [groundHit.x, groundHit.y, groundHit.z]
    },
    [camera, scene, gl]
  )

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) return
      const {
        waypointPlacementActive: active,
        waypointDefaultDwellTime,
        addWaypoint,
      } = useEditorStore.getState()
      if (!active) return

      const position = raycastPlacementPoint(event.clientX, event.clientY)
      if (!position) return

      // Generation site (not a boundary): the id is minted here, not
      // parsed from untrusted input, so we use the plain constructor
      // rather than `parseWaypointId`.
      const id = WaypointId(`waypoint_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`)
      addWaypoint({
        id,
        position,
        ...(waypointDefaultDwellTime > 0 ? { dwellTime: waypointDefaultDwellTime } : {}),
      })
    },
    [raycastPlacementPoint]
  )

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('pointerdown', handlePointerDown)
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [gl.domElement, handlePointerDown])

  return { waypointPlacementActive }
}
