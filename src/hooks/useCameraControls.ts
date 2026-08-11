import { useEditorStore } from '@/store/editorStore'
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'

// Minimal shape covering both `OrbitControls` (three-stdlib) and
// drei's `CameraControls`. The CameraSystem uses drei's
// `CameraControls` (with `makeDefault` so it's the R3F default),
// but the local helpers below only need a small subset of
// surface area — `target` and `update` for OrbitControls,
// `setTarget` / `setLookAt` for drei's `CameraControls`. We
// dispatch at runtime via duck-typing rather than a hard import
// so the editor keeps working if the controls implementation is
// swapped.
interface CameraControlsLike {
  target?: THREE.Vector3
  setTarget?: (x: number, y: number, z: number, enableTransition?: boolean) => void
  setLookAt?: (
    px: number,
    py: number,
    pz: number,
    tx: number,
    ty: number,
    tz: number,
    enableTransition?: boolean
  ) => void
  update?: (delta?: number) => void
}

export const useCameraControls = () => {
  // `makeDefault` on drei's CameraControls registers the
  // instance as the R3F-default controls; reading it back here
  // is the only reliable way to reach the live controls object
  // because the OrbitControls / CameraControls ref lives inside
  // the `<Canvas>` tree and we don't want to thread it through
  // props/context for every consumer. Earlier revisions of this
  // hook used a local `useRef` that was never assigned, so
  // `resetView` / `focusSelection` / `frameAll` were silent
  // no-ops and the corresponding shortcuts did nothing.
  const controls = useThree(state => state.controls) as CameraControlsLike | null
  const camera = useThree(state => state.camera)
  // T83: useShallow — re-render only when selectedObjects/Map identity
  // actually changes, not on every store mutation.
  const { selectedObjects, sceneObjects } = useEditorStore(
    useShallow(s => ({
      selectedObjects: s.selectedObjects,
      sceneObjects: s.sceneObjects,
    }))
  )

  // Stable refs to the three operations. Memoised so the
  // forwarded imperative handle (and the keyboard-shortcut
  // dispatcher) doesn't see a new function reference on every
  // render of the Viewport3D component.
  const ops = useMemo(
    () => ({
      resetView: () => {
        // Set the camera position first, then the orbit target
        // so the next user-orbit happens around the new origin.
        // The drei path uses `setLookAt` (single atomic call);
        // the OrbitControls path sets `target` + `update`.
        if (controls?.setLookAt) {
          controls.setLookAt(10, 10, 10, 0, 0, 0, false)
          return
        }
        camera.position.set(10, 10, 10)
        camera.lookAt(0, 0, 0)
        if (controls?.target) {
          controls.target.set(0, 0, 0)
        }
        controls?.update?.()
      },
      focusSelection: () => {
        if (selectedObjects.length === 0) return

        // Build a tight bounding sphere from the selected
        // objects' positions + scales. The scale is treated as
        // the full extent (worst-case cube) so very thin
        // objects (planes, tall narrow meshes) still keep a
        // sensible amount of headroom in frame.
        const box = new THREE.Box3()
        selectedObjects.forEach(id => {
          const obj = sceneObjects.get(id)
          if (obj) {
            const center = new THREE.Vector3(...obj.position)
            const size = new THREE.Vector3(...obj.scale)
            const objBox = new THREE.Box3()
            objBox.setFromCenterAndSize(center, size)
            box.union(objBox)
          }
        })

        if (box.isEmpty()) return

        const sphere = new THREE.Sphere()
        box.getBoundingSphere(sphere)
        const center = sphere.center
        const radius = sphere.radius

        // Position camera to see the entire selection. Keep the
        // user's current viewing direction so a focus doesn't
        // also reset their orbit angle — fall back to a 45°
        // isometric if the camera is too close to the centre
        // to extract a meaningful direction.
        const direction = camera.position.clone().sub(center)
        if (direction.length() < 0.1) {
          direction.set(1, 1, 1).normalize()
        } else {
          direction.normalize()
        }
        const distance = Math.max(radius / Math.sin(Math.PI / 6), 5)

        if (controls?.setLookAt) {
          controls.setLookAt(
            center.x + direction.x * distance,
            center.y + direction.y * distance,
            center.z + direction.z * distance,
            center.x,
            center.y,
            center.z,
            false
          )
          return
        }
        camera.position.copy(center).add(direction.multiplyScalar(distance))
        if (controls?.target) {
          controls.target.copy(center)
        }
        controls?.update?.()
      },
      frameAll: () => {
        const box = new THREE.Box3()
        let hasObjects = false
        sceneObjects.forEach(obj => {
          if (obj.type === 'mesh' && obj.visible) {
            const center = new THREE.Vector3(...obj.position)
            const size = new THREE.Vector3(...obj.scale)
            const objBox = new THREE.Box3()
            objBox.setFromCenterAndSize(center, size)
            box.union(objBox)
            hasObjects = true
          }
        })

        // No objects → fall back to the default reset position
        // so the user doesn't end up looking at the origin
        // from a zero distance.
        if (!hasObjects) {
          ops.resetView()
          return
        }

        // Add a small padding so objects at the edge of the
        // bounding box don't kiss the viewport edge.
        box.expandByScalar(2)

        const sphere = new THREE.Sphere()
        box.getBoundingSphere(sphere)
        const center = sphere.center
        const radius = sphere.radius

        const direction = camera.position.clone().sub(center)
        if (direction.length() < 0.1) {
          direction.set(1, 1, 1).normalize()
        } else {
          direction.normalize()
        }
        const distance = Math.max(radius / Math.sin(Math.PI / 6), 10)

        if (controls?.setLookAt) {
          controls.setLookAt(
            center.x + direction.x * distance,
            center.y + direction.y * distance,
            center.z + direction.z * distance,
            center.x,
            center.y,
            center.z,
            false
          )
          return
        }
        camera.position.copy(center).add(direction.multiplyScalar(distance))
        if (controls?.target) {
          controls.target.copy(center)
        }
        controls?.update?.()
      },
    }),
    [camera, controls, selectedObjects, sceneObjects]
  )

  return ops
}
