import { useRef, useEffect } from 'react'
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEditorStore } from '@/store/editorStore'
import { TransformCommand } from '@/utils/commands'

export default function TransformGizmos() {
  const { scene } = useThree()
  const { selectedObjects, transformMode, updateObjectTransform, executeCommand, sceneObjects } = useEditorStore()
  const transformControlsRef = useRef<any>(null)
  const initialTransformRef = useRef<{
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  } | null>(null)

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
    const handleTransformStart = () => {
      if (!selectedObjectId || !selectedMesh) return
      
      // Store initial transform state for undo
      const currentObject = sceneObjects[selectedObjectId]
      if (currentObject) {
        initialTransformRef.current = {
          position: [...currentObject.position] as [number, number, number],
          rotation: [...currentObject.rotation] as [number, number, number],
          scale: [...currentObject.scale] as [number, number, number]
        }
      }
    }
    
    const handleChange = () => {
      if (!selectedObjectId || !selectedMesh) return
      
      const newTransform = {
        position: [selectedMesh.position.x, selectedMesh.position.y, selectedMesh.position.z] as [number, number, number],
        rotation: [selectedMesh.rotation.x, selectedMesh.rotation.y, selectedMesh.rotation.z] as [number, number, number],
        scale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z] as [number, number, number]
      }
      
      // Update store directly for real-time feedback
      updateObjectTransform(selectedObjectId, newTransform)
    }
    
    const handleTransformEnd = () => {
      if (!selectedObjectId || !selectedMesh || !initialTransformRef.current) return
      
      const finalTransform = {
        position: [selectedMesh.position.x, selectedMesh.position.y, selectedMesh.position.z] as [number, number, number],
        rotation: [selectedMesh.rotation.x, selectedMesh.rotation.y, selectedMesh.rotation.z] as [number, number, number],
        scale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z] as [number, number, number]
      }
      
      // Create command for undo/redo
      const command = new TransformCommand(
        selectedObjectId,
        initialTransformRef.current,
        finalTransform
      )
      
      // Add command to history (transform was already applied during real-time updates)
      executeCommand(command)
      
      // Clear initial transform reference
      initialTransformRef.current = null
    }

    controls.addEventListener('change', handleChange)
    controls.addEventListener('objectChange', handleChange)
    controls.addEventListener('mouseDown', handleTransformStart)
    controls.addEventListener('mouseUp', handleTransformEnd)

    return () => {
      controls.removeEventListener('change', handleChange)
      controls.removeEventListener('objectChange', handleChange)
      controls.removeEventListener('mouseDown', handleTransformStart)
      controls.removeEventListener('mouseUp', handleTransformEnd)
      controls.detach()
    }
  }, [selectedMesh, selectedObjectId, transformMode, updateObjectTransform, executeCommand, sceneObjects])

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