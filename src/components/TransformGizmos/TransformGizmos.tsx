import { useRef, useEffect } from 'react'
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEditorStore } from '@/store/editorStore'
import * as THREE from 'three'

export default function TransformGizmos() {
  const { scene } = useThree()
  const { selectedObjects, transformMode, updateObjectTransform } = useEditorStore()
  const transformControlsRef = useRef<any>(null)

  // Get the first selected object's Three.js mesh from the scene
  const selectedObjectId = selectedObjects.length > 0 ? selectedObjects[0] : null
  const selectedMesh = selectedObjectId ? scene.getObjectByName(selectedObjectId) : null

  useEffect(() => {
    if (!transformControlsRef.current || !selectedMesh) return

    const controls = transformControlsRef.current
    
    // Set the transform mode
    controls.setMode(transformMode === 'select' ? 'translate' : transformMode)
    
    // Attach controls to the selected mesh
    controls.attach(selectedMesh)
    
    // Handle transform events
    const handleChange = () => {
      if (!selectedObjectId || !selectedMesh) return
      
      const newTransform = {
        position: [selectedMesh.position.x, selectedMesh.position.y, selectedMesh.position.z] as [number, number, number],
        rotation: [selectedMesh.rotation.x, selectedMesh.rotation.y, selectedMesh.rotation.z] as [number, number, number],
        scale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z] as [number, number, number]
      }
      
      updateObjectTransform(selectedObjectId, newTransform)
    }

    controls.addEventListener('change', handleChange)
    controls.addEventListener('objectChange', handleChange)

    return () => {
      controls.removeEventListener('change', handleChange)
      controls.removeEventListener('objectChange', handleChange)
      controls.detach()
    }
  }, [selectedMesh, selectedObjectId, transformMode, updateObjectTransform])

  // Don't render if no object is selected or in select mode
  if (!selectedMesh || selectedObjects.length === 0 || transformMode === 'select') {
    return null
  }

  return (
    <TransformControls
      ref={transformControlsRef}
      mode={transformMode}
      size={0.75}
      showX={true}
      showY={true}
      showZ={true}
      space="world"
      enabled={true}
    />
  )
}