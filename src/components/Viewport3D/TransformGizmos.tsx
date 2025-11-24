import { useRef, useEffect } from 'react'
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEditorStore } from '@/store/editorStore'
import * as THREE from 'three'

interface TransformGizmosProps {
  selectedObjects: string[]
}

export default function TransformGizmos({ selectedObjects }: TransformGizmosProps) {
  const { 
    transformMode, 
    snapToGrid, 
    gridSize, 
    sceneObjects, 
    updateObjectTransform 
  } = useEditorStore()
  const { scene, camera } = useThree()
  const transformRef = useRef<any>(null)
  const groupRef = useRef<THREE.Group>(new THREE.Group())

  // Track initial transforms for undo/redo
  const initialTransforms = useRef<Record<string, any>>({})

  useEffect(() => {
    if (!transformRef.current || selectedObjects.length === 0) return

    // Clear previous attachment
    transformRef.current.detach()

    if (selectedObjects.length === 1) {
      // Single object: find the mesh in the scene
      const objectId = selectedObjects[0]
      let targetMesh: THREE.Mesh | null = null
      
      scene.traverse((child) => {
        if (child.userData?.objectId === objectId) {
          targetMesh = child as THREE.Mesh
        }
      })
      
      if (targetMesh) {
        transformRef.current.attach(targetMesh)
      }
    } else if (selectedObjects.length > 1) {
      // Multiple objects: use a group positioned at the center
      const center = new THREE.Vector3()
      let validObjects = 0
      
      selectedObjects.forEach(objectId => {
        const obj = sceneObjects[objectId]
        if (obj) {
          center.add(new THREE.Vector3(...obj.position))
          validObjects++
        }
      })
      
      if (validObjects > 0) {
        center.divideScalar(validObjects)
        groupRef.current.position.copy(center)
        groupRef.current.rotation.set(0, 0, 0)
        groupRef.current.scale.set(1, 1, 1)
        
        if (!groupRef.current.parent) {
          scene.add(groupRef.current)
        }
        transformRef.current.attach(groupRef.current)
      }
    }
  }, [selectedObjects, sceneObjects, scene])

  // Handle transform mode changes
  useEffect(() => {
    if (transformRef.current) {
      switch (transformMode) {
        case 'translate':
          transformRef.current.setMode('translate')
          break
        case 'rotate':
          transformRef.current.setMode('rotate')
          break
        case 'scale':
          transformRef.current.setMode('scale')
          break
        case 'select':
        default:
          // No gizmo for select mode
          return
      }
    }
  }, [transformMode])

  // Handle snap settings
  useEffect(() => {
    if (transformRef.current) {
      transformRef.current.setTranslationSnap(snapToGrid ? gridSize : null)
      transformRef.current.setRotationSnap(snapToGrid ? THREE.MathUtils.degToRad(15) : null)
      transformRef.current.setScaleSnap(snapToGrid ? 0.1 : null)
    }
  }, [snapToGrid, gridSize])

  const handleMouseDown = () => {
    // Store initial transforms for undo/redo
    selectedObjects.forEach(objectId => {
      const obj = sceneObjects[objectId]
      if (obj) {
        initialTransforms.current[objectId] = {
          position: [...obj.position] as [number, number, number],
          rotation: [...obj.rotation] as [number, number, number],
          scale: [...obj.scale] as [number, number, number],
        }
      }
    })
  }

  const handleObjectChange = () => {
    if (selectedObjects.length === 1) {
      // Single object: get transform from the mesh
      const objectId = selectedObjects[0]
      let targetMesh: THREE.Mesh | undefined = undefined
      
      scene.traverse((child: THREE.Object3D) => {
        if (child.userData?.objectId === objectId && child instanceof THREE.Mesh) {
          targetMesh = child
        }
      })
      
      if (targetMesh) {
        const mesh = targetMesh as THREE.Mesh
        updateObjectTransform(objectId, {
          position: [mesh.position.x, mesh.position.y, mesh.position.z],
          rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
          scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z]
        })
      }
    } else if (selectedObjects.length > 1 && groupRef.current) {
      // Multiple objects: apply group transform relative to initial positions
      const groupTransform = groupRef.current
      
      // Calculate the original center position
      const originalCenter = new THREE.Vector3()
      selectedObjects.forEach(objectId => {
        const initial = initialTransforms.current[objectId]
        if (initial) {
          originalCenter.add(new THREE.Vector3(...initial.position))
        }
      })
      originalCenter.divideScalar(selectedObjects.length)
      
      // Update each object based on group transform
      selectedObjects.forEach(objectId => {
        const initial = initialTransforms.current[objectId]
        if (initial) {
          if (transformMode === 'translate') {
            // Calculate offset from original center
            const offset = new THREE.Vector3(...initial.position).sub(originalCenter)
            const newPosition = groupTransform.position.clone().add(offset)
            
            updateObjectTransform(objectId, {
              position: [newPosition.x, newPosition.y, newPosition.z]
            })
          } else if (transformMode === 'rotate') {
            updateObjectTransform(objectId, {
              rotation: [groupTransform.rotation.x, groupTransform.rotation.y, groupTransform.rotation.z]
            })
          } else if (transformMode === 'scale') {
            const newScale: [number, number, number] = [
              initial.scale[0] * groupTransform.scale.x,
              initial.scale[1] * groupTransform.scale.y,
              initial.scale[2] * groupTransform.scale.z
            ]
            updateObjectTransform(objectId, { scale: newScale })
          }
        }
      })
    }
  }

  const handleMouseUp = () => {
    // TODO: Add undo/redo command here
    console.log('Transform completed - add to undo stack')
    
    // Reset group transform for next operation
    if (selectedObjects.length > 1 && groupRef.current) {
      const center = new THREE.Vector3()
      let validObjects = 0
      
      selectedObjects.forEach(objectId => {
        const obj = sceneObjects[objectId]
        if (obj) {
          center.add(new THREE.Vector3(...obj.position))
          validObjects++
        }
      })
      
      if (validObjects > 0) {
        center.divideScalar(validObjects)
        groupRef.current.position.copy(center)
        groupRef.current.rotation.set(0, 0, 0)
        groupRef.current.scale.set(1, 1, 1)
      }
    }
  }

  // Don't show gizmos in select mode or when nothing is selected
  if (transformMode === 'select' || selectedObjects.length === 0) {
    return null
  }

  return (
    <TransformControls
      ref={transformRef}
      camera={camera}
      mode={transformMode}
      showX={true}
      showY={true}
      showZ={true}
      enabled={true}
      space="world"
      size={1}
      onObjectChange={handleObjectChange}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    />
  )
}