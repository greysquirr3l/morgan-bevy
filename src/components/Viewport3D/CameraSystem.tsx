import { useRef, useEffect, useState, useCallback } from 'react'
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'
import { CameraControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEditorStore } from '@/store/editorStore'

export type CameraMode = 'orbit' | 'fly' | 'orthographic'

interface CameraSystemProps {
  mode: CameraMode
  onModeChange?: (mode: CameraMode) => void
}

export default function CameraSystem({ mode, onModeChange }: CameraSystemProps) {
  const { camera, gl } = useThree()
  const controlsRef = useRef<CameraControls>(null)
  const [flySpeed] = useState(10)
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [mouseMovement, setMouseMovement] = useState({ x: 0, y: 0 })
  const [isMouseLocked, setIsMouseLocked] = useState(false)
  
  // Camera position and rotation for fly mode
  const flyPosition = useRef(new Vector3(10, 10, 10))
  const flyRotation = useRef({ pitch: 0, yaw: 0 })

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
        const perspCamera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        perspCamera.position.set(10, 10, 10)
      }
    }
  }, [mode, camera])

  // Keyboard event handlers for fly mode
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (mode !== 'fly') return
    setKeys(prev => new Set(prev).add(event.code))
    
    // Prevent default for WASD keys to avoid browser scroll
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'].includes(event.code)) {
      event.preventDefault()
    }
  }, [mode])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (mode !== 'fly') return
    setKeys(prev => {
      const newKeys = new Set(prev)
      newKeys.delete(event.code)
      return newKeys
    })
  }, [mode])

  // Mouse movement for fly mode
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (mode !== 'fly' || !isMouseLocked) return
    
    const sensitivity = 0.002
    setMouseMovement({
      x: event.movementX * sensitivity,
      y: event.movementY * sensitivity,
    })
  }, [mode, isMouseLocked])

  // Pointer lock for fly mode
  const handleCanvasClick = useCallback(() => {
    if (mode === 'fly') {
      gl.domElement.requestPointerLock()
      setIsMouseLocked(true)
    }
  }, [mode, gl.domElement])

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
  }, [handleKeyDown, handleKeyUp, handleCanvasClick, handlePointerLockChange])

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
      flyRotation.current.yaw -= mouseMovement.x
      flyRotation.current.pitch -= mouseMovement.y
      flyRotation.current.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, flyRotation.current.pitch))
      setMouseMovement({ x: 0, y: 0 })
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

  // Camera mode switch handlers
  const { setCameraMode } = useEditorStore()

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle camera switching if not in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (event.key) {
        case '1':
          setCameraMode('orbit')
          onModeChange?.('orbit')
          setIsMouseLocked(false)
          break
        case '2':
          setCameraMode('fly')
          onModeChange?.('fly')
          break
        case '3':
          setCameraMode('orthographic')
          onModeChange?.('orthographic')
          setIsMouseLocked(false)
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [setCameraMode, onModeChange])

  return (
    <>
      {mode === 'orbit' && (
        <CameraControls
          ref={controlsRef}
          makeDefault
          minDistance={1}
          maxDistance={100}
        />
      )}
      
      {mode === 'fly' && isMouseLocked && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded text-sm z-50">
          <div className="text-center">
            <div className="font-semibold">Fly Camera Mode</div>
            <div className="text-xs mt-1">
              WASD: Move • Mouse: Look • Space/C: Up/Down • Shift: Fast • ESC: Exit
            </div>
            <div className="text-xs text-gray-300 mt-1">
              Speed: {flySpeed.toFixed(1)} units/sec
            </div>
          </div>
        </div>
      )}

      {mode === 'orthographic' && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded text-sm z-50">
          <div className="text-center">
            <div className="font-semibold">Orthographic Top-Down View</div>
            <div className="text-xs mt-1">
              Mouse: Pan • Scroll: Zoom • 1: Orbit • 2: Fly
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Hook for camera controls
export function useCameraControls() {
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit')
  
  const frameSelected = useCallback(() => {
    const { selectedObjects, sceneObjects } = useEditorStore.getState()
    if (selectedObjects.length === 0) return

    // Calculate bounding box of selected objects
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    selectedObjects.forEach(id => {
      const obj = sceneObjects[id]
      if (obj && obj.position) {
        const [x, y, z] = obj.position
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        minZ = Math.min(minZ, z)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
        maxZ = Math.max(maxZ, z)
      }
    })

    // Center camera on selection
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const centerZ = (minZ + maxZ) / 2

    const distance = Math.max(maxX - minX, maxY - minY, maxZ - minZ) * 2

    // Set camera position based on mode
    // Implementation would depend on specific camera mode
    console.log(`Framing selection at (${centerX}, ${centerY}, ${centerZ}) with distance ${distance}`)
  }, [])

  const frameAll = useCallback(() => {
    const { sceneObjects } = useEditorStore.getState()
    const objectIds = Object.keys(sceneObjects)
    
    if (objectIds.length === 0) return

    // Similar logic to frameSelected but for all objects
    console.log('Framing all objects')
  }, [])

  return {
    cameraMode,
    setCameraMode,
    frameSelected,
    frameAll,
  }
}