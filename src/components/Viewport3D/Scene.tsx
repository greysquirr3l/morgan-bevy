import { Mesh, BoxGeometry, MeshStandardMaterial } from 'three'
import { useRef } from 'react'
import TransformGizmos from './TransformGizmos'
import { useEditorStore } from '@/store/editorStore'

// Ground plane
function Ground() {
  const { clearSelection } = useEditorStore()
  
  const handleClick = () => {
    // Clear selection when clicking on ground
    clearSelection()
  }

  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -1, 0]} 
      receiveShadow
      onClick={handleClick}
    >
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#2d3748" />
    </mesh>
  )
}

// Selectable 3D Object
function SceneObject({ 
  id, 
  meshType, 
  position, 
  rotation, 
  scale, 
  visible 
}: { 
  id: string
  meshType: 'cube' | 'sphere' | 'pyramid'
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  visible: boolean
}) {
  const meshRef = useRef<Mesh>(null)
  const { selectedObjects, setSelectedObjects, addToSelection, hoveredObject, setHoveredObject } = useEditorStore()
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
  
  // Choose geometry based on mesh type
  const renderGeometry = () => {
    switch (meshType) {
      case 'cube':
        return <boxGeometry args={[1, 1, 1]} />
      case 'sphere':
        return <sphereGeometry args={[0.5, 32, 16]} />
      case 'pyramid':
        return <coneGeometry args={[0.5, 1, 4]} />
      default:
        return <boxGeometry args={[1, 1, 1]} />
    }
  }
  
  // Material color based on state
  const getColor = () => {
    if (isSelected) return '#60a5fa' // Blue when selected
    if (isHovered) return '#fbbf24' // Yellow when hovered
    return '#9ca3af' // Default gray
  }
  
  if (!visible) return null
  
  return (
    <mesh
      ref={meshRef}
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
      <meshStandardMaterial 
        color={getColor()}
        transparent={isHovered}
        opacity={isHovered ? 0.8 : 1.0}
      />
    </mesh>
  )
}

export default function Scene() {
  const { selectedObjects, sceneObjects } = useEditorStore()
  
  return (
    <>
      {/* Ground plane */}
      <Ground />
      
      {/* Scene objects from store */}
      {Object.values(sceneObjects).map(obj => (
        obj.type === 'mesh' && obj.meshType ? (
          <SceneObject
            key={obj.id}
            id={obj.id}
            meshType={obj.meshType}
            position={obj.position}
            rotation={obj.rotation}
            scale={obj.scale}
            visible={obj.visible}
          />
        ) : null
      ))}
      
      {/* Reference axes for debugging */}
      <primitive object={new Mesh(
        new BoxGeometry(0.1, 5, 0.1),
        new MeshStandardMaterial({ color: 'red', transparent: true, opacity: 0.3 })
      )} position={[0, 2.5, 0]} />
      <primitive object={new Mesh(
        new BoxGeometry(5, 0.1, 0.1),
        new MeshStandardMaterial({ color: 'green', transparent: true, opacity: 0.3 })
      )} position={[2.5, 0, 0]} />
      <primitive object={new Mesh(
        new BoxGeometry(0.1, 0.1, 5),
        new MeshStandardMaterial({ color: 'blue', transparent: true, opacity: 0.3 })
      )} position={[0, 0, 2.5]} />
      
      {/* Transform Gizmos */}
      <TransformGizmos selectedObjects={selectedObjects} />
    </>
  )
}