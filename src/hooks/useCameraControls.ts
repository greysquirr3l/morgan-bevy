import { useRef, RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { useEditorStore } from '@/store/editorStore'

export const useCameraControls = () => {
  const controlsRef: RefObject<OrbitControlsImpl> = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()
  const { selectedObjects, sceneObjects } = useEditorStore()

  const resetView = () => {
    if (!controlsRef.current) return

    // Reset camera to default position
    camera.position.set(10, 10, 10)
    camera.lookAt(0, 0, 0)
    controlsRef.current.target.set(0, 0, 0)
    controlsRef.current.update()
  }

  const focusSelection = () => {
    if (!controlsRef.current || selectedObjects.length === 0) return

    // Calculate bounding box of selected objects
    const box = new THREE.Box3()
    const sphere = new THREE.Sphere()

    selectedObjects.forEach((id: string) => {
      const obj = sceneObjects[id]
      if (obj) {
        const center = new THREE.Vector3(...obj.position)
        const size = new THREE.Vector3(...obj.scale)
        
        // Create a bounding box for this object
        const objBox = new THREE.Box3()
        objBox.setFromCenterAndSize(center, size)
        box.union(objBox)
      }
    })

    if (box.isEmpty()) return

    // Get bounding sphere and adjust camera
    box.getBoundingSphere(sphere)
    const center = sphere.center
    const radius = sphere.radius

    // Position camera to see the entire selection
    const distance = radius / Math.sin(Math.PI / 6) // Assuming 60 degree FOV
    const direction = camera.position.clone().sub(center).normalize()
    
    camera.position.copy(center).add(direction.multiplyScalar(Math.max(distance * 2, 5)))
    controlsRef.current.target.copy(center)
    controlsRef.current.update()
  }

  return {
    controlsRef,
    resetView,
    focusSelection
  }
}