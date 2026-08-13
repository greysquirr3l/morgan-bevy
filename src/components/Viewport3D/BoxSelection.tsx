import React, { useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { useEditorStore } from '@/store/editorStore'
import { useBoxSelection } from '@/hooks/useBoxSelection'
import type { ObjectId } from '@/types/brand'
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

    // T54: the paint tool (P) owns click-and-drag on the canvas while
    // active — don't compete with it for the same gesture.
    if (useEditorStore.getState().paintToolActive) return

    // In fly mode, a canvas click is exclusively "lock the pointer
    // and enter fly-look" (handled by CameraSystem's canvas click
    // listener). Without this guard, this same pointerdown also
    // starts a box-selection drag, which fights fly mode for the
    // click.
    if (useEditorStore.getState().cameraMode === 'fly') return

    // If a TransformControls gizmo handle grab already claimed this
    // drag (three-stdlib's TransformControls registers its own raw
    // pointerdown listener on this same canvas, independently of R3F,
    // and — because TransformGizmos renders before BoxSelection in
    // Viewport3D.tsx — runs first and synchronously fires 'mouseDown'
    // before this handler sees the event), don't also start a
    // box-selection drag. Without this guard, the resulting drag gets
    // interpreted as a selection-box on pointerup and stomps over the
    // object the gizmo just moved, leaving it deselected.
    if (useEditorStore.getState().isTransformDragging) return

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
        const newSelectedObjects: ObjectId[] = []

        // Build a per-meshType lookup of candidate scene objects so
        // InstancedMesh instances (see below) can be resolved back to
        // their real ObjectId by matching position. InstancedMesh
        // instances don't carry a per-instance userData.objectId — the
        // mesh itself only has one shared userData ({instanced: true,
        // kind: 'cube'|'sphere'|'pyramid'}, set by InstancedRendering.tsx)
        // — so unlike regular meshes we can't just read
        // object.userData.objectId off the intersected object.
        const sceneObjectsSnapshot = useEditorStore.getState().sceneObjects
        const candidatesByKind: Record<
          'cube' | 'sphere' | 'pyramid',
          Array<{ id: ObjectId; position: [number, number, number] }>
        > = { cube: [], sphere: [], pyramid: [] }
        sceneObjectsSnapshot.forEach(obj => {
          if (obj.type === 'mesh' && obj.meshType && obj.visible) {
            candidatesByKind[obj.meshType].push({ id: obj.id, position: obj.position })
          }
        })

        const EPS = 0.01
        const resolveInstanceObjectId = (
          kind: 'cube' | 'sphere' | 'pyramid',
          pos: THREE.Vector3
        ): ObjectId | null => {
          for (const candidate of candidatesByKind[kind]) {
            if (
              Math.abs(candidate.position[0] - pos.x) < EPS &&
              Math.abs(candidate.position[1] - pos.y) < EPS &&
              Math.abs(candidate.position[2] - pos.z) < EPS
            ) {
              return candidate.id
            }
          }
          return null
        }

        const tryAddToSelection = (screenPos: THREE.Vector3, id: ObjectId | null) => {
          if (!id) return
          const x = (screenPos.x * 0.5 + 0.5) * size.width
          const y = (screenPos.y * -0.5 + 0.5) * size.height
          if (x >= minX && x <= maxX && y >= minY && y <= maxY && screenPos.z < 1 && !newSelectedObjects.includes(id)) {
            newSelectedObjects.push(id)
          }
        }

        // Check all selectable objects in the scene
        scene.traverse((object) => {
          if (object instanceof THREE.InstancedMesh) {
            const kind = object.userData?.kind as 'cube' | 'sphere' | 'pyramid' | undefined
            if (!kind || !object.visible) return

            const instanceMatrix = new THREE.Matrix4()
            const worldMatrix = new THREE.Matrix4()
            const worldPos = new THREE.Vector3()

            for (let i = 0; i < object.count; i++) {
              object.getMatrixAt(i, instanceMatrix)
              worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix)
              worldPos.setFromMatrixPosition(worldMatrix)

              const screenPos = worldPos.clone().project(camera)
              const objectId = resolveInstanceObjectId(kind, worldPos)
              tryAddToSelection(screenPos, objectId)
            }
            return
          }

          if (object.userData?.objectId && object.visible) {
            // Project object to screen space
            const worldPos = new THREE.Vector3()
            object.getWorldPosition(worldPos)

            const screenPos = worldPos.clone().project(camera)
            tryAddToSelection(screenPos, object.userData.objectId as ObjectId)
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