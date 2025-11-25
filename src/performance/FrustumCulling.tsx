import { useThree, useFrame } from '@react-three/fiber'
import { useRef, useState, useMemo } from 'react'
import { Vector3, Frustum, Matrix4, Box3 } from 'three'

// Hook for frustum culling - determines if objects are visible to camera
export function useFrustumCulling(
  position: [number, number, number],
  boundingRadius: number = 1,
  updateFrequency: number = 5 // Update every N frames
): boolean {
  const { camera } = useThree()
  const frameCount = useRef(0)
  const [isVisible, setIsVisible] = useState(true)
  
  // Cache frustum and matrix computations
  const frustum = useMemo(() => new Frustum(), [])
  const cameraMatrix = useMemo(() => new Matrix4(), [])
  const positionVector = useMemo(() => new Vector3(...position), [position])

  useFrame(() => {
    frameCount.current++
    
    // Only update culling every N frames to reduce performance impact
    if (frameCount.current % updateFrequency !== 0) {
      return
    }

    // Update camera frustum
    cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(cameraMatrix)
    
    // Check if object's bounding sphere intersects with frustum
    const visible = frustum.intersectsSphere({ center: positionVector, radius: boundingRadius } as any)
    setIsVisible(visible)
  })

  return isVisible
}

// Advanced frustum culling with bounding box support
export function useBoundingBoxCulling(
  position: [number, number, number],
  size: [number, number, number] = [1, 1, 1],
  updateFrequency: number = 5
): boolean {
  const { camera } = useThree()
  const frameCount = useRef(0)
  const [isVisible, setIsVisible] = useState(true)
  
  // Cache computations
  const frustum = useMemo(() => new Frustum(), [])
  const cameraMatrix = useMemo(() => new Matrix4(), [])
  const boundingBox = useMemo(() => {
    const box = new Box3()
    const center = new Vector3(...position)
    const halfSize = new Vector3(...size).multiplyScalar(0.5)
    box.setFromCenterAndSize(center, halfSize.multiplyScalar(2))
    return box
  }, [position, size])

  useFrame(() => {
    frameCount.current++
    
    if (frameCount.current % updateFrequency !== 0) {
      return
    }

    // Update camera frustum
    cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(cameraMatrix)
    
    // Update bounding box position
    const center = new Vector3(...position)
    const halfSize = new Vector3(...size).multiplyScalar(0.5)
    boundingBox.setFromCenterAndSize(center, halfSize.multiplyScalar(2))
    
    // Check if bounding box intersects with frustum
    const visible = frustum.intersectsBox(boundingBox)
    setIsVisible(visible)
  })

  return isVisible
}

// Combined LOD + Frustum culling hook for maximum performance
export function usePerformanceCulling(
  position: [number, number, number],
  size: [number, number, number] = [1, 1, 1],
  maxDistance: number = 100,
  updateFrequency: number = 8
): { 
  isVisible: boolean
  lodLevel: number
  shouldRender: boolean
} {
  const { camera } = useThree()
  const frameCount = useRef(0)
  const [cullState, setCullState] = useState({
    isVisible: true,
    lodLevel: 0,
    shouldRender: true
  })
  
  // Cache computations
  const frustum = useMemo(() => new Frustum(), [])
  const cameraMatrix = useMemo(() => new Matrix4(), [])
  const positionVector = useMemo(() => new Vector3(...position), [position])
  const boundingBox = useMemo(() => {
    const box = new Box3()
    const center = new Vector3(...position)
    const halfSize = new Vector3(...size).multiplyScalar(0.5)
    box.setFromCenterAndSize(center, halfSize.multiplyScalar(2))
    return box
  }, [position, size])

  useFrame(() => {
    frameCount.current++
    
    if (frameCount.current % updateFrequency !== 0) {
      return
    }

    // Update camera frustum
    cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(cameraMatrix)
    
    // Update bounding box position
    const center = new Vector3(...position)
    const halfSize = new Vector3(...size).multiplyScalar(0.5)
    boundingBox.setFromCenterAndSize(center, halfSize.multiplyScalar(2))
    
    // Check frustum culling
    const isInFrustum = frustum.intersectsBox(boundingBox)
    
    // Calculate distance-based LOD
    const distance = camera.position.distanceTo(positionVector)
    let lodLevel = 0
    
    if (distance > 50) lodLevel = 3      // Very low detail
    else if (distance > 25) lodLevel = 2 // Low detail
    else if (distance > 10) lodLevel = 1 // Medium detail
    else lodLevel = 0                    // High detail
    
    // Determine if object should render at all
    const shouldRender = isInFrustum && distance <= maxDistance
    
    setCullState({
      isVisible: isInFrustum,
      lodLevel,
      shouldRender
    })
  })

  return cullState
}