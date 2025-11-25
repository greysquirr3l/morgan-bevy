import { useRef, useMemo, useEffect } from 'react'
import { InstancedMesh, Color, Object3D } from 'three'

// Interface for instanced object data
export interface InstancedObjectData {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color?: string
  visible?: boolean
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
    objects.forEach((obj) => {
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
    visibilityMap: visibilityMap.current
  }
}

// Component for instanced cubes
export function InstancedCubes({ 
  objects, 
  maxInstances = 1000,
  material 
}: {
  objects: InstancedObjectData[]
  maxInstances?: number
  material?: React.ReactElement
}) {
  const { meshRef } = useInstancedRendering(objects, maxInstances)

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[undefined, undefined, maxInstances]}
      castShadow
      receiveShadow
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
  material 
}: {
  objects: InstancedObjectData[]
  maxInstances?: number
  segments?: number
  rings?: number
  material?: React.ReactElement
}) {
  const { meshRef } = useInstancedRendering(objects, maxInstances)

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[undefined, undefined, maxInstances]}
      castShadow
      receiveShadow
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
  material 
}: {
  objects: InstancedObjectData[]
  maxInstances?: number
  segments?: number
  material?: React.ReactElement
}) {
  const { meshRef } = useInstancedRendering(objects, maxInstances)

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[undefined, undefined, maxInstances]}
      castShadow
      receiveShadow
    >
      <coneGeometry args={[0.5, 1, segments]} />
      {material || <meshStandardMaterial />}
    </instancedMesh>
  )
}

// Manager component that automatically groups objects by type for instanced rendering
export function InstancedObjectManager({ 
  objects, 
  maxInstancesPerType = 1000 
}: {
  objects: Array<InstancedObjectData & { meshType: 'cube' | 'sphere' | 'pyramid' }>
  maxInstancesPerType?: number
}) {
  const groupedObjects = useMemo(() => {
    const groups = {
      cube: [] as typeof objects,
      sphere: [] as typeof objects,
      pyramid: [] as typeof objects
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
        <InstancedCubes 
          objects={groupedObjects.cube}
          maxInstances={maxInstancesPerType}
        />
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