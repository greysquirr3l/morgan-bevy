import { useEditorStore } from '@/store/editorStore'
import type { ObjectId } from '@/types/brand'
import type { ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, Object3D } from 'three'

// Interface for instanced object data
export interface InstancedObjectData {
  id: ObjectId
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color?: string
  visible?: boolean
}

/**
 * Inverted instance-index → ObjectId map, mirroring
 * `visibilityMap` but flipped so a click handler can resolve
 * `e.instanceId` back to the scene object that owns the slot.
 * Three.js' raycaster hands us `event.instanceId` on
 * `InstancedMesh` intersections; the mesh itself only carries one
 * `userData` field for the whole instanced group, not per
 * instance — so we have to maintain the mapping externally.
 *
 * Audit (Major #8) regression: the audit caught that
 * `InstancedCubes` / `InstancedSpheres` / `InstancedCones` had no
 * `userData.objectId` AND no `onClick` handler. Anything beyond
 * the 10-object threshold was untouchable — clicks passed
 * through to the ground, which then cleared the selection.
 */
function invertIndexToIdMap(forward: Map<string, number>): Map<number, string> {
  const inv = new Map<number, string>()
  for (const [id, idx] of forward) inv.set(idx, id)
  return inv
}

// Hook to manage instanced rendering for identical objects
export function useInstancedRendering<T extends InstancedObjectData>(
  objects: T[],
  maxInstances: number = 1000
) {
  const meshRef = useRef<InstancedMesh>(null)
  const tempObject = useMemo(() => new Object3D(), [])
  const tempColor = useMemo(() => new Color(), [])

  // Track which instances are visible
  const visibilityMap = useRef<Map<string, number>>(new Map())
  const instanceCount = useRef(0)

  useEffect(() => {
    if (!meshRef.current) return

    const mesh = meshRef.current
    instanceCount.current = 0
    visibilityMap.current.clear()

    // Update instances based on object data
    objects.forEach(obj => {
      if (obj.visible !== false && instanceCount.current < maxInstances) {
        // Set transform
        tempObject.position.set(...obj.position)
        tempObject.rotation.set(...obj.rotation)
        tempObject.scale.set(...obj.scale)
        tempObject.updateMatrix()

        mesh.setMatrixAt(instanceCount.current, tempObject.matrix)

        // Set color if available
        if (obj.color) {
          tempColor.set(obj.color)
          mesh.setColorAt(instanceCount.current, tempColor)
        }

        // Track instance mapping
        visibilityMap.current.set(obj.id, instanceCount.current)
        instanceCount.current++
      }
    })

    // Update instance count
    mesh.count = instanceCount.current

    // Mark matrices and colors as needing update
    if (mesh.instanceMatrix) {
      mesh.instanceMatrix.needsUpdate = true
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }
  }, [objects, maxInstances, tempObject, tempColor])

  return {
    meshRef,
    instanceCount: instanceCount.current,
    getInstanceIndex: (id: string) => visibilityMap.current.get(id),
    visibilityMap: visibilityMap.current,
  }
}

/**
 * Shared click-handler factory for instanced meshes. Resolves
 * `event.instanceId` (the slot in the per-mesh instance buffer
 * that was hit by the raycast) back to the owning `ObjectId` via
 * the index map, then routes through the editor store the same
 * way `OptimizedSceneObject`'s click handler does — additive
 * selection with Shift / Ctrl / Meta, single-select otherwise.
 *
 * Returning `void` on miss lets the event propagate to the
 * `Ground` `onClick` (which clears selection) when the user
 * clicks empty space.
 */
function useInstancedClickHandler(visibilityMap: Map<string, number>) {
  const setSelectedObjects = useEditorStore(s => s.setSelectedObjects)
  const addToSelection = useEditorStore(s => s.addToSelection)
  const selectedObjects = useEditorStore(s => s.selectedObjects)
  return useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      const idx = event.instanceId
      if (idx === undefined) return
      const objectId = invertIndexToIdMap(visibilityMap).get(idx)
      if (!objectId) return
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        if (selectedObjects.includes(objectId as ObjectId)) {
          setSelectedObjects(selectedObjects.filter(id => id !== objectId))
        } else {
          addToSelection(objectId as ObjectId)
        }
      } else {
        setSelectedObjects([objectId as ObjectId])
      }
    },
    [visibilityMap, selectedObjects, setSelectedObjects, addToSelection]
  )
}

// Component for instanced cubes
export function InstancedCubes({
  objects,
  maxInstances = 1000,
  material,
}: {
  objects: InstancedObjectData[]
  maxInstances?: number
  material?: React.ReactElement
}) {
  const { meshRef, visibilityMap } = useInstancedRendering(objects, maxInstances)
  const handleClick = useInstancedClickHandler(visibilityMap)

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, maxInstances]}
      castShadow
      receiveShadow
      userData={{ instanced: true, kind: 'cube' }}
      onClick={handleClick}
    >
      <boxGeometry args={[1, 1, 1]} />
      {material || <meshStandardMaterial />}
    </instancedMesh>
  )
}

// Component for instanced spheres
export function InstancedSpheres({
  objects,
  maxInstances = 1000,
  segments = 16,
  rings = 8,
  material,
}: {
  objects: InstancedObjectData[]
  maxInstances?: number
  segments?: number
  rings?: number
  material?: React.ReactElement
}) {
  const { meshRef, visibilityMap } = useInstancedRendering(objects, maxInstances)
  const handleClick = useInstancedClickHandler(visibilityMap)

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, maxInstances]}
      castShadow
      receiveShadow
      userData={{ instanced: true, kind: 'sphere' }}
      onClick={handleClick}
    >
      <sphereGeometry args={[0.5, segments, rings]} />
      {material || <meshStandardMaterial />}
    </instancedMesh>
  )
}

// Component for instanced pyramids/cones
export function InstancedCones({
  objects,
  maxInstances = 1000,
  segments = 8,
  material,
}: {
  objects: InstancedObjectData[]
  maxInstances?: number
  segments?: number
  material?: React.ReactElement
}) {
  const { meshRef, visibilityMap } = useInstancedRendering(objects, maxInstances)
  const handleClick = useInstancedClickHandler(visibilityMap)

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, maxInstances]}
      castShadow
      receiveShadow
      userData={{ instanced: true, kind: 'pyramid' }}
      onClick={handleClick}
    >
      <coneGeometry args={[0.5, 1, segments]} />
      {material || <meshStandardMaterial />}
    </instancedMesh>
  )
}

// Manager component that automatically groups objects by type for instanced rendering
export function InstancedObjectManager({
  objects,
  maxInstancesPerType = 1000,
}: {
  objects: Array<InstancedObjectData & { meshType: 'cube' | 'sphere' | 'pyramid' }>
  maxInstancesPerType?: number
}) {
  const groupedObjects = useMemo(() => {
    const groups = {
      cube: [] as typeof objects,
      sphere: [] as typeof objects,
      pyramid: [] as typeof objects,
    }

    objects.forEach(obj => {
      if (obj.meshType === 'cube') {
        groups.cube.push(obj)
      } else if (obj.meshType === 'sphere') {
        groups.sphere.push(obj)
      } else if (obj.meshType === 'pyramid') {
        groups.pyramid.push(obj)
      }
    })

    return groups
  }, [objects])

  return (
    <group>
      {groupedObjects.cube.length > 0 && (
        <InstancedCubes objects={groupedObjects.cube} maxInstances={maxInstancesPerType} />
      )}
      {groupedObjects.sphere.length > 0 && (
        <InstancedSpheres
          objects={groupedObjects.sphere}
          maxInstances={maxInstancesPerType}
          segments={16}
          rings={8}
        />
      )}
      {groupedObjects.pyramid.length > 0 && (
        <InstancedCones
          objects={groupedObjects.pyramid}
          maxInstances={maxInstancesPerType}
          segments={8}
        />
      )}
    </group>
  )
}
