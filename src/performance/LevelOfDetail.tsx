import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'

// LOD levels configuration
export interface LODLevel {
  distance: number
  sphereSegments?: number
  sphereRings?: number
  visible?: boolean
}

// Default LOD configuration optimized for 10K+ objects
export const DEFAULT_LOD_LEVELS: LODLevel[] = [
  { distance: 0, sphereSegments: 32, sphereRings: 16, visible: true }, // High detail (0-10 units)
  { distance: 10, sphereSegments: 16, sphereRings: 8, visible: true }, // Medium detail (10-25 units)
  { distance: 25, sphereSegments: 8, sphereRings: 4, visible: true }, // Low detail (25-50 units)
  { distance: 50, sphereSegments: 4, sphereRings: 2, visible: true }, // Very low detail (50-100 units)
  { distance: 100, visible: false }, // Culled (100+ units)
]

// Hook to calculate LOD level based on distance to camera
export function useLOD(
  position: [number, number, number],
  lodLevels: LODLevel[] = DEFAULT_LOD_LEVELS,
  updateFrequency: number = 10 // Update every N frames to reduce performance impact
): LODLevel {
  const { camera } = useThree()
  const frameCount = useRef(0)
  const [currentLOD, setCurrentLOD] = useState(lodLevels[0])
  // Shadows `currentLOD` so the frame loop can skip `setCurrentLOD`
  // when the distance bucket hasn't changed — an object sitting still
  // at a fixed distance would otherwise re-render every
  // `updateFrequency` frames for an identical LOD level.
  const currentLODRef = useRef(lodLevels[0])
  const positionVector = useMemo(() => new Vector3(...position), [position])

  useFrame(() => {
    frameCount.current++

    // Only update LOD every N frames to reduce performance impact
    if (frameCount.current % updateFrequency !== 0) {
      return
    }

    const distance = camera.position.distanceTo(positionVector)

    // Find appropriate LOD level
    let selectedLOD = lodLevels[0]
    for (let i = lodLevels.length - 1; i >= 0; i--) {
      if (distance >= lodLevels[i].distance) {
        selectedLOD = lodLevels[i]
        break
      }
    }

    if (selectedLOD !== currentLODRef.current) {
      currentLODRef.current = selectedLOD
      setCurrentLOD(selectedLOD)
    }
  })

  return currentLOD
}

// LOD-aware geometry component for spheres
export function LODSphereGeometry({
  position,
  radius = 0.5,
  lodLevels = DEFAULT_LOD_LEVELS,
}: {
  position: [number, number, number]
  radius?: number
  lodLevels?: LODLevel[]
}) {
  const lod = useLOD(position, lodLevels)

  if (!lod.visible) {
    return null
  }

  return <sphereGeometry args={[radius, lod.sphereSegments || 8, lod.sphereRings || 4]} />
}

// LOD-aware geometry component for cubes (simple but consistent API)
export function LODBoxGeometry({
  position,
  size = [1, 1, 1],
  lodLevels = DEFAULT_LOD_LEVELS,
}: {
  position: [number, number, number]
  size?: [number, number, number]
  lodLevels?: LODLevel[]
}) {
  const lod = useLOD(position, lodLevels)

  if (!lod.visible) {
    return null
  }

  return <boxGeometry args={size} />
}

// LOD-aware geometry component for pyramids/cones. The default radius
// is `1/√2 ≈ 0.7071` so the inscribed-square base side equals the
// height — a unit "Egyptian pyramid" aspect ratio. Using the
// previous `radius = 0.5` (base side ≈ 0.707) made the pyramid
// visibly taller than wide ("oblong") at the default scale.
export function LODConeGeometry({
  position,
  radius = 1 / Math.sqrt(2),
  height = 1,
  lodLevels = DEFAULT_LOD_LEVELS,
}: {
  position: [number, number, number]
  radius?: number
  height?: number
  lodLevels?: LODLevel[]
}) {
  const lod = useLOD(position, lodLevels)

  if (!lod.visible) {
    return null
  }

  // Reduce radial segments based on LOD level
  const radialSegments = Math.max(3, lod.sphereSegments || 8)

  return <coneGeometry args={[radius, height, radialSegments]} />
}
