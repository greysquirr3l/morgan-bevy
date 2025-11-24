import React, { useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { useEditorStore } from '@/store/editorStore'
import { useBoxSelection } from '@/hooks/useBoxSelection'
import * as THREE from 'three'

interface BoxSelectionOverlayProps {
  isSelecting: boolean
  startPoint: THREE.Vector2
  currentPoint: THREE.Vector2
}

function BoxSelectionOverlay({ isSelecting, startPoint, currentPoint }: BoxSelectionOverlayProps) {
  if (!isSelecting) {
    return null
  }

  const left = Math.min(startPoint.x, currentPoint.x)
  const top = Math.min(startPoint.y, currentPoint.y)
  const width = Math.abs(currentPoint.x - startPoint.x)
  const height = Math.abs(currentPoint.y - startPoint.y)

  return (
    <div
      className="absolute pointer-events-none z-20"
      style={{
        left,
        top,
        width,
        height,
        border: '1px dashed #60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.1)',
        backdropFilter: 'blur(1px)'
      }}
    />
  )
}

export default function BoxSelection() {
  const { gl, camera, scene, size } = useThree()
  const { setSelectedObjects, selectedObjects } = useEditorStore()
  const { boxState, startSelection, updateSelection, endSelection } = useBoxSelection()

  const handlePointerDown = useCallback((event: PointerEvent) => {
    // Only start box selection on left mouse button with no modifiers (except shift for additive)
    if (event.button !== 0 || event.target !== gl.domElement) return
    
    // Don't start box selection if clicking on a specific object (let object selection handle it)
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const rect = gl.domElement.getBoundingClientRect()
    
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(scene.children, true)
    
    // If we hit an object with userData.objectId, let normal selection handle it
    if (intersects.length > 0 && intersects[0].object.userData?.objectId) {
      return
    }
    
    const startX = event.clientX - rect.left
    const startY = event.clientY - rect.top
    
    startSelection(startX, startY)

    // Prevent default to avoid any other interactions
    event.preventDefault()
  }, [gl.domElement, camera, scene, startSelection])

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (boxState.isSelecting) {
      const rect = gl.domElement.getBoundingClientRect()
      updateSelection(event.clientX - rect.left, event.clientY - rect.top)
    }
  }, [boxState.isSelecting, gl.domElement, updateSelection])

  const handlePointerUp = useCallback((event: PointerEvent) => {
    if (boxState.isSelecting) {
      const { startPoint, currentPoint } = boxState
      
      // Calculate selection rectangle
      const minX = Math.min(startPoint.x, currentPoint.x)
      const maxX = Math.max(startPoint.x, currentPoint.x)
      const minY = Math.min(startPoint.y, currentPoint.y)
      const maxY = Math.max(startPoint.y, currentPoint.y)
      
      // Only perform selection if drag was significant (minimum 5 pixels)
      if (Math.abs(maxX - minX) > 5 || Math.abs(maxY - minY) > 5) {
        const newSelectedObjects: string[] = []
        
        // Check all selectable objects in the scene
        scene.traverse((object) => {
          if (object.userData?.objectId && object.visible) {
            // Project object to screen space
            const worldPos = new THREE.Vector3()
            object.getWorldPosition(worldPos)
            
            const screenPos = worldPos.clone().project(camera)
            const x = (screenPos.x * 0.5 + 0.5) * size.width
            const y = (screenPos.y * -0.5 + 0.5) * size.height
            
            // Check if object is within selection box
            if (x >= minX && x <= maxX && y >= minY && y <= maxY && screenPos.z < 1) {
              newSelectedObjects.push(object.userData.objectId)
            }
          }
        })
        
        // Apply selection based on modifier keys
        if (event.ctrlKey || event.metaKey) {
          // Additive selection - add new objects to existing selection
          const combinedSelection = [...selectedObjects]
          newSelectedObjects.forEach(id => {
            if (!combinedSelection.includes(id)) {
              combinedSelection.push(id)
            }
          })
          setSelectedObjects(combinedSelection)
        } else if (event.shiftKey) {
          // Toggle selection - toggle each object in the box
          const toggledSelection = [...selectedObjects]
          newSelectedObjects.forEach(id => {
            const index = toggledSelection.indexOf(id)
            if (index >= 0) {
              toggledSelection.splice(index, 1)
            } else {
              toggledSelection.push(id)
            }
          })
          setSelectedObjects(toggledSelection)
        } else {
          // Replace selection
          setSelectedObjects(newSelectedObjects)
        }
      } else {
        // Small drag or click - clear selection if no modifiers
        if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
          setSelectedObjects([])
        }
      }
      
      // Reset box selection state
      endSelection()
    }
  }, [boxState, camera, scene, setSelectedObjects, selectedObjects, size, endSelection])

  // Register event listeners
  React.useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerDown, handlePointerMove, handlePointerUp, gl.domElement])

  // Return null - the actual overlay is rendered by the parent component
  return null
}

// Export both the component and overlay for use in Viewport3D
export { BoxSelectionOverlay }