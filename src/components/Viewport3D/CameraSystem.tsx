import { CameraControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'

export type CameraMode = 'orbit' | 'fly' | 'orthographic'

interface CameraSystemProps {
  mode: CameraMode
}

export default function CameraSystem({ mode }: CameraSystemProps) {
  const { camera, gl } = useThree()
  const controlsRef = useRef<CameraControls>(null)
  const [flySpeed] = useState(10)
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [isMouseLocked, setIsMouseLocked] = useState(false)

  // Camera position and rotation for fly mode
  const flyPosition = useRef(new Vector3(10, 10, 10))
  const flyRotation = useRef({ pitch: 0, yaw: 0 })
  // Raw per-frame mouse delta. This used to be `useState`, written on
  // every `mousemove` and reset to zero every render-loop frame while
  // the pointer was locked — a React re-render at mouse-move (and
  // frame) rate for a value nothing ever renders. It only feeds the
  // fly-camera integration below, so a ref is the right home for it.
  const mouseMovementRef = useRef({ x: 0, y: 0 })

  // Switch between camera types based on mode
  useEffect(() => {
    if (mode === 'orthographic') {
      // Switch to orthographic camera
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
    } else {
      // Ensure we have a perspective camera for orbit and fly modes
      if (!(camera instanceof PerspectiveCamera)) {
        const perspCamera = new PerspectiveCamera(
          75,
          window.innerWidth / window.innerHeight,
          0.1,
          1000
        )
        perspCamera.position.set(10, 10, 10)
      }
    }
  }, [mode, camera])

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
  }, [mode, gl.domElement])

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
  }, [mode, isMouseLocked, gl.domElement])

  const handlePointerLockChange = useCallback(() => {
    setIsMouseLocked(document.pointerLockElement === gl.domElement)
  }, [gl.domElement])

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

  // Camera mode switching (1 / 2 / 3) and ESC-to-exit-fly are
  // handled centrally by `useKeyboardShortcuts` so the binding
  // table stays the single source of truth. We previously also
  // listened here, which meant every mode-switch keypress
  // dispatched through two keydown handlers and called
  // `setCameraMode` twice. Removing the local listener also
  // removes the `onModeChange?.(...)` calls — those were
  // redundant because the store update is the only signal
  // subscribers care about.

  return (
    <>
      {mode === 'orbit' && (
        <CameraControls ref={controlsRef} makeDefault minDistance={1} maxDistance={100} />
      )}

      {mode === 'fly' && isMouseLocked && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded text-sm z-50">
          <div className="text-center">
            <div className="font-semibold">Fly Camera Mode</div>
            <div className="text-xs mt-1">
              WASD: Move • Mouse: Look • Space/C: Up/Down • Shift: Fast • ESC: Exit
            </div>
            <div className="text-xs text-gray-300 mt-1">Speed: {flySpeed.toFixed(1)} units/sec</div>
          </div>
        </div>
      )}

      {mode === 'orthographic' && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded text-sm z-50">
          <div className="text-center">
            <div className="font-semibold">Orthographic Top-Down View</div>
            <div className="text-xs mt-1">Mouse: Pan • Scroll: Zoom • 1: Orbit • 2: Fly</div>
          </div>
        </div>
      )}
    </>
  )
}
