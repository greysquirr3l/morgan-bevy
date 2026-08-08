// T54 — Material paint tool: the interactive (R3F) half.
//
// Pairs with `src/utils/paintTool.ts` (pure brush math) and
// `src/utils/commands.ts`'s `PaintCommand` (undo). This hook must
// be called from a component rendered inside `<Canvas>` — it uses
// `useThree()` exactly like `TransformGizmos` / `BoxSelection` do —
// and is consumed by `PaintToolViewport`, which renders the brush
// indicator mesh this hook drives.
//
// Per-frame-ish data (the brush cursor's world position/normal) is
// NEVER written to the Zustand store — it's applied straight to the
// indicator `Object3D` via refs, imperatively, on pointer events.
// Only discrete, low-frequency state (is the tool active, what's
// the target material, brush radius/falloff) lives in the store, as
// `paintBrush*`/`paintTargetMaterialId` in `editorStore.ts`.
import { useEditorStore } from '@/store/editorStore'
import type { ObjectId } from '@/types/brand'
import { PaintCommand, type PaintTargetSnapshot } from '@/utils/commands'
import { selectPaintTargets } from '@/utils/paintTool'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'

interface BrushHit {
  point: THREE.Vector3
  normal: THREE.Vector3
}

/** Small offset along the hit normal so the brush ring doesn't
 *  z-fight with the surface it's drawn on. */
const INDICATOR_SURFACE_OFFSET = 0.01

export function usePaintTool() {
  const { camera, scene, gl } = useThree()
  const paintToolActive = useEditorStore(s => s.paintToolActive)

  const raycasterRef = useRef(new THREE.Raycaster())
  const isPaintingRef = useRef(false)
  const strokeTargetsRef = useRef<Map<ObjectId, PaintTargetSnapshot>>(new Map())
  const brushIndicatorRef = useRef<THREE.Mesh>(null)

  // Hide the indicator the instant the tool is toggled off, rather
  // than waiting for the next pointermove to notice.
  useEffect(() => {
    if (!paintToolActive && brushIndicatorRef.current) {
      brushIndicatorRef.current.visible = false
    }
  }, [paintToolActive])

  const raycastScene = useCallback(
    (clientX: number, clientY: number): BrushHit | null => {
      const rect = gl.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      )
      raycasterRef.current.setFromCamera(ndc, camera)
      const intersections = raycasterRef.current.intersectObjects(scene.children, true)
      const first = intersections.find(i => i.face)
      if (!first || !first.face) return null

      const normal = first.face.normal.clone()
      normal.transformDirection(first.object.matrixWorld).normalize()
      return { point: first.point.clone(), normal }
    },
    [camera, scene, gl]
  )

  const updateIndicator = useCallback((hit: BrushHit | null) => {
    const indicator = brushIndicatorRef.current
    if (!indicator) return
    const { paintToolActive: active, paintBrushRadius } = useEditorStore.getState()
    if (!hit || !active) {
      indicator.visible = false
      return
    }
    indicator.visible = true
    indicator.position.copy(hit.point).addScaledVector(hit.normal, INDICATOR_SURFACE_OFFSET)
    indicator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.normal)
    indicator.scale.setScalar(Math.max(paintBrushRadius, 0.001))
  }, [])

  /** Apply the current target material to every object under the
   *  brush at `hit`, recording each newly-touched object's PRE-
   *  stroke material once (first touch wins) so the eventual
   *  `PaintCommand` can undo the whole stroke. */
  const applyBrushAtHit = useCallback((hit: BrushHit) => {
    const state = useEditorStore.getState()
    if (!state.paintTargetMaterialId) return

    const targets = selectPaintTargets(
      state.sceneObjects,
      [hit.point.x, hit.point.y, hit.point.z],
      { radius: state.paintBrushRadius, falloff: state.paintBrushFalloff }
    )
    if (targets.length === 0) return

    for (const id of targets) {
      if (!strokeTargetsRef.current.has(id)) {
        const obj = state.sceneObjects.get(id)
        if (!obj) continue
        strokeTargetsRef.current.set(id, {
          objectId: id,
          previousMaterialPresetId: obj.materialPresetId,
          previousMaterialOverrides: obj.materialOverrides,
          previousMaterial: obj.material,
        })
      }
      state.linkObjectToPreset(id, state.paintTargetMaterialId, {})
    }
  }, [])

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) return
      const { paintToolActive: active } = useEditorStore.getState()
      if (!active) return
      const hit = raycastScene(event.clientX, event.clientY)
      updateIndicator(hit)
      if (!hit) return

      isPaintingRef.current = true
      strokeTargetsRef.current = new Map()
      applyBrushAtHit(hit)
    },
    [raycastScene, updateIndicator, applyBrushAtHit]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const { paintToolActive: active } = useEditorStore.getState()
      if (!active) return
      const hit = raycastScene(event.clientX, event.clientY)
      updateIndicator(hit)
      if (isPaintingRef.current && hit) {
        applyBrushAtHit(hit)
      }
    },
    [raycastScene, updateIndicator, applyBrushAtHit]
  )

  const handlePointerUp = useCallback(() => {
    if (!isPaintingRef.current) return
    isPaintingRef.current = false

    const targets = Array.from(strokeTargetsRef.current.values())
    strokeTargetsRef.current = new Map()
    if (targets.length === 0) return

    const { paintTargetMaterialId, executeCommand } = useEditorStore.getState()
    if (!paintTargetMaterialId) return

    // Targets were already applied live (above) for immediate
    // feedback; this only registers the stroke as one undo entry —
    // same shape as `TransformGizmos`' `handleMouseUp`, which calls
    // `executeCommand` without a redundant `command.execute()`.
    const command = new PaintCommand(targets, paintTargetMaterialId)
    executeCommand(command)
  }, [])

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [gl.domElement, handlePointerDown, handlePointerMove, handlePointerUp])

  return { brushIndicatorRef, paintToolActive }
}
