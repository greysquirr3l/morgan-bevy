import React, { useRef, useState, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { useEditorStore } from '@/store/editorStore'
import * as THREE from 'three'

interface BoxSelectionState {
  isSelecting: boolean
  startPoint: THREE.Vector2
  currentPoint: THREE.Vector2
}

export default function BoxSelection() {
  const { gl, camera, scene } = useThree()
  const { setSelectedObjects } = useEditorStore()
  const [boxState, setBoxState] = useState<BoxSelectionState>({
    isSelecting: false,
    startPoint: new THREE.Vector2(),
    currentPoint: new THREE.Vector2(),
  })
  
  const overlayRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = useCallback((event: PointerEvent) => {
    // Only start box selection on empty space (not on objects)
    if (event.target === gl.domElement && !event.ctrlKey && !event.metaKey) {
      const rect = gl.domElement.getBoundingClientRect()
      // const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      // const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      // TODO: Implement raycasting for starting point
      
      setBoxState({
        isSelecting: true,
        startPoint: new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top),
        currentPoint: new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top),
      })
    }
  }, [gl.domElement])

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (boxState.isSelecting) {
      const rect = gl.domElement.getBoundingClientRect()
      setBoxState(prev => ({
        ...prev,
        currentPoint: new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top),
      }))
    }
  }, [boxState.isSelecting, gl.domElement])

  const handlePointerUp = useCallback((_event: PointerEvent) => {
    if (boxState.isSelecting) {
      // Perform box selection
      const rect = gl.domElement.getBoundingClientRect()
      const { startPoint, currentPoint } = boxState
      
      // Calculate selection rectangle
      const minX = Math.min(startPoint.x, currentPoint.x)
      const maxX = Math.max(startPoint.x, currentPoint.x)
      const minY = Math.min(startPoint.y, currentPoint.y)
      const maxY = Math.max(startPoint.y, currentPoint.y)
      
      // Only perform selection if drag was significant
      if (Math.abs(maxX - minX) > 10 || Math.abs(maxY - minY) > 10) {
        const selectedObjects: string[] = []
        
        // Check all selectable objects in the scene
        scene.traverse((object) => {
          if (object.userData?.id && object.userData?.type === 'cube') {
            // Project object to screen space
            const worldPos = new THREE.Vector3()
            object.getWorldPosition(worldPos)
            
            const screenPos = worldPos.clone().project(camera)
            const x = (screenPos.x * 0.5 + 0.5) * rect.width
            const y = (screenPos.y * -0.5 + 0.5) * rect.height
            
            // Check if object is within selection box
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
              selectedObjects.push(object.userData.id)
            }
          }
        })
        
        setSelectedObjects(selectedObjects)
      }
      
      setBoxState({
        isSelecting: false,
        startPoint: new THREE.Vector2(),
        currentPoint: new THREE.Vector2(),
      })
    }
  }, [boxState, camera, scene, setSelectedObjects, gl.domElement])

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

  // Render selection box overlay
  if (!boxState.isSelecting) {
    return null
  }

  const { startPoint, currentPoint } = boxState
  const left = Math.min(startPoint.x, currentPoint.x)
  const top = Math.min(startPoint.y, currentPoint.y)
  const width = Math.abs(currentPoint.x - startPoint.x)
  const height = Math.abs(currentPoint.y - startPoint.y)

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        border: '1px dashed #00aaff',
        backgroundColor: 'rgba(0, 170, 255, 0.1)',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    />
  )
}