// T53 — Measurement tool: in-Canvas piece. Rendered inside `<Canvas>`
// in `Viewport3D.tsx`, alongside `TransformGizmos` / `BoxSelection` /
// `PaintToolViewport` — same "R3F component that owns `useThree()`"
// shape those already use.
//
// All the mode/point bookkeeping lives in `useMeasurementTool`
// (called by the parent, outside the Canvas — it's plain React state,
// not per-frame R3F data); this component's only job is turning a
// left-click into a world-space point via raycasting against the
// scene, exactly like `usePaintTool`'s `raycastScene` does for the
// paint brush.
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'

import type { Vec3 } from '@/types/measurements'

export interface MeasurementToolViewportProps {
  /** True while a measurement mode is active (tool is "on"). */
  active: boolean
  /** Called with the world-space hit point on every left-click while active. */
  onAddPoint: (point: Vec3) => void
}

export default function MeasurementToolViewport({
  active,
  onAddPoint,
}: MeasurementToolViewportProps) {
  const { camera, scene, gl } = useThree()
  const raycasterRef = useRef(new THREE.Raycaster())

  // Refs so the pointerdown listener (registered once) always sees
  // the latest active flag / callback without re-subscribing on
  // every render — same pattern `usePaintTool` uses via
  // `useEditorStore.getState()` for its own "read latest" needs.
  const activeRef = useRef(active)
  activeRef.current = active
  const onAddPointRef = useRef(onAddPoint)
  onAddPointRef.current = onAddPoint

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) return
      if (!activeRef.current) return

      const rect = gl.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycasterRef.current.setFromCamera(ndc, camera)
      const intersections = raycasterRef.current.intersectObjects(scene.children, true)
      const first = intersections.find(i => i.face)
      if (!first) return

      onAddPointRef.current([first.point.x, first.point.y, first.point.z])
    },
    [camera, scene, gl]
  )

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('pointerdown', handlePointerDown)
    return () => canvas.removeEventListener('pointerdown', handlePointerDown)
  }, [gl.domElement, handlePointerDown])

  // No visual geometry yet — the 3D rendering of measurement lines
  // is a documented follow-up (see MeasurementOverlay's header
  // comment); this component is purely the click -> point wiring.
  return null
}
