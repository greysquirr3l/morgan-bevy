import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Box3, Frustum, Matrix4, Sphere, Vector3 } from 'three'

// Hook for frustum culling - determines if objects are visible to camera
export function useFrustumCulling(
  position: [number, number, number],
  boundingRadius: number = 1,
  updateFrequency: number = 5 // Update every N frames
): boolean {
  const { camera } = useThree()
  const frameCount = useRef(0)
  const [isVisible, setIsVisible] = useState(true)
  // Shadows `isVisible` so the frame loop can compare against the
  // last-committed value without depending on the state closure —
  // `setIsVisible` only fires when the answer actually flips, so a
  // steady-state object (in or out of frustum for hundreds of
  // frames) doesn't force a re-render every `updateFrequency` frames.
  const isVisibleRef = useRef(true)

  // Cache frustum and matrix computations
  const frustum = useMemo(() => new Frustum(), [])
  const cameraMatrix = useMemo(() => new Matrix4(), [])
  const positionVector = useMemo(() => new Vector3(...position), [position])
  const boundingSphere = useMemo(
    () => new Sphere(positionVector, boundingRadius),
    [positionVector, boundingRadius]
  )

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
    const visible = frustum.intersectsSphere(boundingSphere)
    if (visible !== isVisibleRef.current) {
      isVisibleRef.current = visible
      setIsVisible(visible)
    }
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
  const isVisibleRef = useRef(true)

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
    if (visible !== isVisibleRef.current) {
      isVisibleRef.current = visible
      setIsVisible(visible)
    }
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
    shouldRender: true,
  })
  // Mirrors `cullState` for cheap equality checks in the frame loop —
  // see `useFrustumCulling` above for why this matters.
  const cullStateRef = useRef(cullState)

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

    if (distance > 50)
      lodLevel = 3 // Very low detail
    else if (distance > 25)
      lodLevel = 2 // Low detail
    else if (distance > 10)
      lodLevel = 1 // Medium detail
    else lodLevel = 0 // High detail

    // Determine if object should render at all
    const shouldRender = isInFrustum && distance <= maxDistance

    const prev = cullStateRef.current
    if (
      prev.isVisible !== isInFrustum ||
      prev.lodLevel !== lodLevel ||
      prev.shouldRender !== shouldRender
    ) {
      const next = { isVisible: isInFrustum, lodLevel, shouldRender }
      cullStateRef.current = next
      setCullState(next)
    }
  })

  return cullState
}

/**
 * T97 — Server-side spatial-index query hook.
 *
 * Asks the Rust side `query_objects_in_bounds` which objects are
 * inside the given AABB and returns the IDs. The Rust spatial
 * index is the authoritative source of truth (R-tree over the
 * scene's transforms) so this is faster than walking the
 * Zustand store on the JS side for large scenes.
 *
 * `bounds` is the AABB to query. Returns `null` while the query
 * is in flight; consumers should treat null as "no data yet, use
 * local fallback".
 */
import type { BoundingBox } from '@/types/schemas'

export function useSpatialIndexQuery(bounds: BoundingBox | null): readonly string[] | null {
  const [result, setResult] = useState<readonly string[] | null>(null)
  const lastBoundsRef = useRef<BoundingBox | null>(null)

  useEffect(() => {
    if (!bounds) {
      setResult(null)
      lastBoundsRef.current = null
      return
    }
    // Skip the round-trip if the bounds haven't changed since the
    // last query — common case when the camera is idle.
    if (
      lastBoundsRef.current &&
      boundsArrayEquals(lastBoundsRef.current.min, bounds.min) &&
      boundsArrayEquals(lastBoundsRef.current.max, bounds.max)
    ) {
      return
    }
    lastBoundsRef.current = bounds
    let cancelled = false
    void (async () => {
      try {
        const { queryObjectsInBounds } = await import('@/types/levelBridge')
        const ids = await queryObjectsInBounds(bounds)
        if (!cancelled) setResult(ids)
      } catch (e) {
        if (!cancelled) {
          console.warn('useSpatialIndexQuery: Rust query failed', e)
          setResult(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // Audit (Minor #27): the previous dep array was six inline
    // `bounds?.min[N]` / `bounds?.max[N]` expressions, which
    // eslint flagged as "complex expression in the dependency
    // array." Compute the bounds string once so the array is
    // trivial and statically checkable. ESLint's
    // exhaustive-deps rule still wants `bounds` here — adding
    // it would re-fire the effect whenever the object identity
    // changes even if the numeric values are identical, which
    // would defeat the early-out above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds ? `${bounds.min.join(',')}|${bounds.max.join(',')}` : ''])

  return result
}

function boundsArrayEquals(a: readonly number[], b: readonly number[]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}
