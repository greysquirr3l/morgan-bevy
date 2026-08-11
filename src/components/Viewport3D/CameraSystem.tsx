import { useEditorStore } from '@/store/editorStore'
import { CameraControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import CameraControlsImpl from 'camera-controls'
import { useCallback, useEffect, useRef, useState } from 'react'
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'

export type CameraMode = 'orbit' | 'fly' | 'orthographic'

// Fixed fly-camera move speed. Was a `useState` that nothing ever
// called the setter of — exported as a constant so the fly HUD
// (rendered outside <Canvas>, in Viewport3D.tsx, per the R3F-tree
// fix below) can display the same number without duplicating it.
export const FLY_SPEED = 10

interface CameraSystemProps {
  mode: CameraMode
}

export default function CameraSystem({ mode }: CameraSystemProps) {
  const { camera, gl, set } = useThree()
  const controlsRef = useRef<CameraControls>(null)
  const flySpeed = FLY_SPEED
  const [keys, setKeys] = useState<Set<string>>(new Set())
  // Lives in the store, not local state, so the fly HUD — which has
  // to render as a plain DOM sibling of <Canvas>, not inside it (see
  // the return statement below) — can read it without prop-drilling
  // through the Canvas boundary.
  const isMouseLocked = useEditorStore(state => state.isCameraPointerLocked)
  const setIsMouseLocked = useEditorStore(state => state.setCameraPointerLocked)

  // Camera position and rotation for fly mode
  const flyPosition = useRef(new Vector3(10, 10, 10))
  const flyRotation = useRef({ pitch: 0, yaw: 0 })
  // Raw per-frame mouse delta. This used to be `useState`, written on
  // every `mousemove` and reset to zero every render-loop frame while
  // the pointer was locked — a React re-render at mouse-move (and
  // frame) rate for a value nothing ever renders. It only feeds the
  // fly-camera integration below, so a ref is the right home for it.
  const mouseMovementRef = useRef({ x: 0, y: 0 })

  // Switch between camera types based on mode. Must call `set({
  // camera })` to actually install the new camera as R3F's active
  // render camera — constructing the THREE.Camera object alone does
  // nothing, R3F keeps rendering through whatever `state.camera`
  // already is. Guarded by `instanceof` (rather than just `[mode]`)
  // so setting the camera — which changes `camera` and re-triggers
  // this effect — doesn't loop: the second run sees the camera type
  // already matches and no-ops.
  useEffect(() => {
    if (mode === 'orthographic') {
      if (camera instanceof OrthographicCamera) return

      const orthoCamera = new OrthographicCamera(
        window.innerWidth / -2,
        window.innerWidth / 2,
        window.innerHeight / 2,
        window.innerHeight / -2,
        1,
        1000
      )
      orthoCamera.position.set(0, 50, 0)
      orthoCamera.lookAt(0, 0, 0)
      orthoCamera.updateProjectionMatrix()
      set({ camera: orthoCamera })
    } else if (!(camera instanceof PerspectiveCamera)) {
      // Ensure we have a perspective camera for orbit and fly modes
      const perspCamera = new PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      )
      perspCamera.position.set(10, 10, 10)
      perspCamera.lookAt(0, 0, 0)
      perspCamera.updateProjectionMatrix()
      set({ camera: perspCamera })
    }
  }, [mode, camera, set])

  // Keyboard event handlers for fly mode
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (mode !== 'fly') return
      setKeys(prev => new Set(prev).add(event.code))

      // Prevent default for WASD keys to avoid browser scroll
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'].includes(event.code)) {
        event.preventDefault()
      }
    },
    [mode]
  )

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (mode !== 'fly') return
      setKeys(prev => {
        const newKeys = new Set(prev)
        newKeys.delete(event.code)
        return newKeys
      })
    },
    [mode]
  )

  // Mouse movement for fly mode
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (mode !== 'fly' || !isMouseLocked) return

      const sensitivity = 0.002
      mouseMovementRef.current.x = event.movementX * sensitivity
      mouseMovementRef.current.y = event.movementY * sensitivity
    },
    [mode, isMouseLocked]
  )

  // Pointer lock for fly mode
  const handleCanvasClick = useCallback(() => {
    if (mode === 'fly') {
      gl.domElement.requestPointerLock()
      setIsMouseLocked(true)
    }
  }, [mode, gl.domElement, setIsMouseLocked])

  // Release the pointer lock when the user exits fly mode via
  // anything OTHER than the canvas click (which only ever sets the
  // lock, never releases it). Pressing ESC or switching to 1 / 3
  // from the keyboard dispatches `setCameraMode` through the
  // store, the `mode` prop on this component flips to
  // 'orbit' / 'orthographic', and we need to break the lock here
  // so the cursor reappears. Without this, the fly camera keeps
  // swallowing mouse-moves even after the user has "switched
  // cameras", because the lock is what enables the
  // `handleMouseMove` integration.
  useEffect(() => {
    if (mode !== 'fly' && isMouseLocked) {
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock()
      }
      setIsMouseLocked(false)
    }
  }, [mode, isMouseLocked, gl.domElement, setIsMouseLocked])

  const handlePointerLockChange = useCallback(() => {
    setIsMouseLocked(document.pointerLockElement === gl.domElement)
  }, [gl.domElement, setIsMouseLocked])

  // Set up event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    gl.domElement.addEventListener('click', handleCanvasClick)
    document.addEventListener('pointerlockchange', handlePointerLockChange)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      gl.domElement.removeEventListener('click', handleCanvasClick)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
    }
  }, [handleKeyDown, handleKeyUp, handleCanvasClick, handlePointerLockChange, gl.domElement])

  // Mouse movement listener for fly mode
  useEffect(() => {
    if (mode === 'fly') {
      window.addEventListener('mousemove', handleMouseMove)
      return () => window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [mode, handleMouseMove])

  // Frame-based updates for fly mode
  useFrame((_, delta) => {
    if (mode !== 'fly' || !(camera instanceof PerspectiveCamera)) return

    // Update rotation based on mouse movement
    if (isMouseLocked) {
      const movement = mouseMovementRef.current
      flyRotation.current.yaw -= movement.x
      flyRotation.current.pitch -= movement.y
      flyRotation.current.pitch = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, flyRotation.current.pitch)
      )
      movement.x = 0
      movement.y = 0
    }

    // Update position based on keyboard input
    const forward = new Vector3(
      Math.sin(flyRotation.current.yaw),
      0,
      Math.cos(flyRotation.current.yaw)
    )
    const right = new Vector3(
      Math.cos(flyRotation.current.yaw),
      0,
      -Math.sin(flyRotation.current.yaw)
    )
    const up = new Vector3(0, 1, 0)

    const moveSpeed = keys.has('ShiftLeft') ? flySpeed * 2 : flySpeed
    const frameSpeed = moveSpeed * delta

    if (keys.has('KeyW')) flyPosition.current.addScaledVector(forward, frameSpeed)
    if (keys.has('KeyS')) flyPosition.current.addScaledVector(forward, -frameSpeed)
    if (keys.has('KeyD')) flyPosition.current.addScaledVector(right, frameSpeed)
    if (keys.has('KeyA')) flyPosition.current.addScaledVector(right, -frameSpeed)
    if (keys.has('Space')) flyPosition.current.addScaledVector(up, frameSpeed)
    if (keys.has('KeyC')) flyPosition.current.addScaledVector(up, -frameSpeed)

    // Apply position and rotation to camera
    camera.position.copy(flyPosition.current)
    camera.rotation.set(flyRotation.current.pitch, flyRotation.current.yaw, 0, 'YXZ')
  })

  // Shift+left-drag pans the orbit camera instead of rotating it —
  // matches the "Shift+Mouse: Pan" hint in App.tsx and standard
  // Blender/Unity-style editor convention. `camera-controls`
  // defaults `mouseButtons.left` to ROTATE with no built-in modifier
  // support, so we swap it to TRUCK (pan) for as long as Shift is
  // held and restore ROTATE on release. Only wired up in orbit mode
  // — fly/ortho don't use `CameraControls` at all.
  useEffect(() => {
    if (mode !== 'orbit') return

    const setLeftAction = (
      action: typeof CameraControlsImpl.ACTION.ROTATE | typeof CameraControlsImpl.ACTION.TRUCK
    ) => {
      if (controlsRef.current) {
        controlsRef.current.mouseButtons.left = action
      }
    }

    const handleShiftKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setLeftAction(CameraControlsImpl.ACTION.TRUCK)
    }
    const handleShiftKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setLeftAction(CameraControlsImpl.ACTION.ROTATE)
    }
    // Alt-tabbing away while Shift is held never fires `keyup` — reset
    // on blur too so the controls don't get stuck permanently panning.
    const handleBlur = () => setLeftAction(CameraControlsImpl.ACTION.ROTATE)

    window.addEventListener('keydown', handleShiftKeyDown)
    window.addEventListener('keyup', handleShiftKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleShiftKeyDown)
      window.removeEventListener('keyup', handleShiftKeyUp)
      window.removeEventListener('blur', handleBlur)
      // Don't leak the swapped action if we unmount (or the mode
      // changes away from orbit) while Shift is still held.
      setLeftAction(CameraControlsImpl.ACTION.ROTATE)
    }
  }, [mode])

  // Camera mode switching (1 / 2 / 3) and ESC-to-exit-fly are
  // handled centrally by `useKeyboardShortcuts` so the binding
  // table stays the single source of truth. We previously also
  // listened here, which meant every mode-switch keypress
  // dispatched through two keydown handlers and called
  // `setCameraMode` twice. Removing the local listener also
  // removes the `onModeChange?.(...)` calls — those were
  // redundant because the store update is the only signal
  // subscribers care about.

  // Only Three.js-safe JSX below — this component is rendered
  // inside <Canvas>, so returning a raw DOM element (e.g. the old
  // fly/ortho HUD `<div>`s) makes R3F's reconciler try to
  // instantiate it as a THREE object and throw, unmounting the
  // whole Canvas subtree. The HUDs now live in Viewport3D.tsx as
  // DOM siblings of <Canvas>, driven by `cameraMode` and
  // `isCameraPointerLocked` from the store.
  return (
    <>
      {mode === 'orbit' && (
        <CameraControls ref={controlsRef} makeDefault minDistance={1} maxDistance={100} />
      )}
    </>
  )
}
