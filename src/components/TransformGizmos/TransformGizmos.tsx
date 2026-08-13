import { useEditorStore } from '@/store/editorStore'
import { TransformCommand } from '@/utils/commands'
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

export default function TransformGizmos() {
  const { scene } = useThree()
  const {
    selectedObjects,
    transformMode,
    coordinateSpace,
    updateObjectTransform,
    executeCommand,
    sceneObjects,
    setTransformDragging,
    snapToGrid,
    gridSize,
  } = useEditorStore()
  const transformControlsRef = useRef<any>(null)
  const initialTransformRef = useRef<{
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  } | null>(null)

  // Get the first selected object's Three.js mesh from the scene
  const selectedObjectId = selectedObjects.length > 0 ? selectedObjects[0] : null
  // Audit (Major #11) regression: a locked object (or one on a
  // locked layer) shouldn't accept transforms from the gizmo.
  // Previously the lock flag only coloured the Hierarchy eye
  // icon — moving a locked object via the gizmo would still
  // write through. Pick the next unlocked object as the gizmo
  // target so the user sees feedback rather than a stale handle
  // on a frozen mesh.
  const layers = useEditorStore(s => s.layers)
  const targetIsLocked = (() => {
    if (!selectedObjectId) return false
    const obj = sceneObjects.get(selectedObjectId)
    if (!obj) return false
    if (obj.locked) return true
    const layer = layers.find(l => l.id === obj.layerId)
    return Boolean(layer?.locked)
  })()
  const activeObjectId = targetIsLocked ? null : selectedObjectId
  const activeMesh = activeObjectId ? scene.getObjectByName(activeObjectId) : null

  useEffect(() => {
    if (!transformControlsRef.current || !activeMesh) return

    const controls = transformControlsRef.current

    // Set the transform mode
    controls.setMode(transformMode === 'select' ? 'translate' : transformMode)

    // Attach controls to the selected mesh
    controls.attach(activeMesh)

    // Handle transform events
    const handleTransformStart = () => {
      // Flag the drag as gizmo-owned regardless of whether we have a
      // valid selection below, so BoxSelection.tsx's pointerdown guard
      // (which fires from the very same synchronous DOM dispatch, since
      // three-stdlib's TransformControls registers its pointerdown
      // listener on the canvas before BoxSelection does) reliably sees
      // it and doesn't start a competing box-selection drag.
      setTransformDragging(true)

      if (!activeObjectId || !activeMesh) return

      // Store initial transform state for undo. Read fresh from the
      // store via getState() rather than closing over the `sceneObjects`
      // destructured above — that map gets a new reference on every
      // updateObjectTransform call during a drag (immer's Map plugin),
      // and including it in this effect's deps below would tear down
      // and reattach TransformControls (all its listeners) on every
      // single drag frame instead of only at attach/mode-change time.
      const currentObject = useEditorStore.getState().sceneObjects.get(activeObjectId)
      if (currentObject) {
        initialTransformRef.current = {
          position: [...currentObject.position] as [number, number, number],
          rotation: [...currentObject.rotation] as [number, number, number],
          scale: [...currentObject.scale] as [number, number, number],
        }
      }
    }

    const handleChange = () => {
      if (!activeObjectId || !activeMesh) return

      const newTransform = {
        position: [activeMesh.position.x, activeMesh.position.y, activeMesh.position.z] as [
          number,
          number,
          number,
        ],
        rotation: [activeMesh.rotation.x, activeMesh.rotation.y, activeMesh.rotation.z] as [
          number,
          number,
          number,
        ],
        scale: [activeMesh.scale.x, activeMesh.scale.y, activeMesh.scale.z] as [
          number,
          number,
          number,
        ],
      }

      // Update store directly for real-time feedback
      updateObjectTransform(activeObjectId, newTransform)
    }

    const handleTransformEnd = () => {
      setTransformDragging(false)

      if (!activeObjectId || !activeMesh || !initialTransformRef.current) return

      const finalTransform = {
        position: [activeMesh.position.x, activeMesh.position.y, activeMesh.position.z] as [
          number,
          number,
          number,
        ],
        rotation: [activeMesh.rotation.x, activeMesh.rotation.y, activeMesh.rotation.z] as [
          number,
          number,
          number,
        ],
        scale: [activeMesh.scale.x, activeMesh.scale.y, activeMesh.scale.z] as [
          number,
          number,
          number,
        ],
      }

      // Create command for undo/redo
      const command = new TransformCommand(
        activeObjectId,
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
  }, [
    activeMesh,
    activeObjectId,
    transformMode,
    updateObjectTransform,
    executeCommand,
    setTransformDragging,
  ])

  // Don't render if no object is selected or in select mode.
  // `activeMesh` (not `selectedMesh`) is the gate so a locked
  // selection doesn't even render the gizmo — see audit Major #11.
  if (!activeMesh || selectedObjects.length === 0 || transformMode === 'select') {
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
      space={coordinateSpace}
      enabled={true}
      // Audit (Major #9) regression: snap-to-grid toggle had zero
      // effect on the gizmo because the `*Snap` props were never
      // threaded through. drei's TransformControls passes these
      // straight to three-stdlib's `TransformControls`, which
      // rounds translations / rotations / scales to the nearest
      // multiple when the matching snap value is set. With snap
      // off, pass `null` so the gizmo doesn't quantize to a
      // previous value.
      translationSnap={snapToGrid ? gridSize : null}
      rotationSnap={snapToGrid ? Math.PI / 12 : null}
      scaleSnap={snapToGrid ? gridSize : null}
    />
  )
}
