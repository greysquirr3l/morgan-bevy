import { useEditorStore, type SceneObject } from '@/store/editorStore'
import type { ObjectId } from '@/types/brand'
import { useRef } from 'react'
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three'

// Ground plane
function Ground() {
  const { clearSelection } = useEditorStore()

  const handleClick = () => {
    // Clear selection when clicking on ground
    clearSelection()
  }

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow onClick={handleClick}>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#2d3748" />
    </mesh>
  )
}

// Selectable 3D Object
function SceneObject3D({
  id,
  meshType,
  position,
  rotation,
  scale,
  visible,
  material,
}: {
  id: ObjectId
  meshType: 'cube' | 'sphere' | 'pyramid'
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  visible: boolean
  material?: {
    baseColor: string
    metallic: number
    roughness: number
    texture?: string
  }
}) {
  const meshRef = useRef<Mesh>(null)
  const { selectedObjects, setSelectedObjects, addToSelection, hoveredObject, setHoveredObject } =
    useEditorStore()
  // const { camera, raycaster } = useThree() // Commented out - will be used for raycasting

  const isSelected = selectedObjects.includes(id)
  const isHovered = hoveredObject === id

  const handleClick = (e: any) => {
    e.stopPropagation()

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      // Additive selection
      if (isSelected) {
        setSelectedObjects(selectedObjects.filter(objId => objId !== id))
      } else {
        addToSelection(id)
      }
    } else {
      // Single selection
      setSelectedObjects([id])
    }
  }

  const handlePointerOver = (e: any) => {
    e.stopPropagation()
    setHoveredObject(id)
  }

  const handlePointerOut = (e: any) => {
    e.stopPropagation()
    setHoveredObject(null)
  }

  // Choose geometry based on mesh type.
  // All three primitives share a 1×1×1 bounding box at scale=[1,1,1]:
  //   - cube:    1×1×1 box
  //   - sphere:  diameter 1.0 (radius 0.5)
  //   - pyramid: square base side 1.0, height 1.0 — radius = 1/√2 ≈ 0.7071
  //     so the inscribed square's side equals its height (was radius
  //     0.5 which gave side ≈ 0.707, making the pyramid visibly taller
  //     than wide / "oblong" in the viewport).
  const renderGeometry = () => {
    switch (meshType) {
      case 'cube':
        return <boxGeometry args={[1, 1, 1]} />
      case 'sphere':
        return <sphereGeometry args={[0.5, 32, 16]} />
      case 'pyramid':
        return <coneGeometry args={[1 / Math.sqrt(2), 1, 4]} />
      default:
        return <boxGeometry args={[1, 1, 1]} />
    }
  }

  // Material color based on state and tile type
  const getColor = () => {
    if (isSelected) return '#60a5fa' // Blue when selected
    if (isHovered) return '#fbbf24' // Yellow when hovered
    const color = material?.baseColor || '#9ca3af'
    return color // Use tile color or default gray
  }

  // Get material properties
  const getMaterialProps = () => {
    return {
      color: getColor(),
      metalness: material?.metallic || 0.0,
      roughness: material?.roughness || 0.5,
      transparent: isHovered,
      opacity: isHovered ? 0.8 : 1.0,
    }
  }

  if (!visible) return null

  return (
    <mesh
      ref={meshRef}
      name={id} // Set the name so TransformGizmos can find it
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      userData={{ objectId: id, meshType }}
    >
      {renderGeometry()}
      <meshStandardMaterial {...getMaterialProps()} />
    </mesh>
  )
}

export default function Scene() {
  const { sceneObjects, layers } = useEditorStore()

  // Helper function to check if object should be visible (combines object and layer visibility)
  const isObjectVisible = (obj: SceneObject) => {
    const layer = layers.find(l => l.id === obj.layerId)
    return obj.visible && (layer?.visible ?? true)
  }

  return (
    <>
      {/* Ground plane */}
      <Ground />

      {/* Scene objects from store */}
      {Array.from(sceneObjects.values()).map(obj =>
        obj.type === 'mesh' && obj.meshType ? (
          <SceneObject3D
            key={obj.id}
            id={obj.id}
            meshType={obj.meshType}
            position={obj.position}
            rotation={obj.rotation}
            scale={obj.scale}
            visible={isObjectVisible(obj)}
            material={obj.material}
          />
        ) : null
      )}

      {/* Reference axes for debugging */}
      <primitive
        object={
          new Mesh(
            new BoxGeometry(0.1, 5, 0.1),
            new MeshStandardMaterial({ color: 'red', transparent: true, opacity: 0.3 })
          )
        }
        position={[0, 2.5, 0]}
      />
      <primitive
        object={
          new Mesh(
            new BoxGeometry(5, 0.1, 0.1),
            new MeshStandardMaterial({ color: 'green', transparent: true, opacity: 0.3 })
          )
        }
        position={[2.5, 0, 0]}
      />
      <primitive
        object={
          new Mesh(
            new BoxGeometry(0.1, 0.1, 5),
            new MeshStandardMaterial({ color: 'blue', transparent: true, opacity: 0.3 })
          )
        }
        position={[0, 0, 2.5]}
      />
    </>
  )
}
