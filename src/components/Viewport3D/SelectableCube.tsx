import { useRef } from 'react'
import { Mesh, BoxGeometry, MeshStandardMaterial } from 'three'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { useEditorStore } from '@/store/editorStore'

interface SelectableCubeProps {
  position: [number, number, number]
  color: string
  id: string
}

export default function SelectableCube({ position, color, id }: SelectableCubeProps) {
  const meshRef = useRef<Mesh>(null!)
  
  const { 
    selectedObjects, 
    hoveredObject, 
    setHoveredObject, 
    setSelectedObjects, 
    addToSelection, 
    removeFromSelection 
  } = useEditorStore()
  
  const isSelected = selectedObjects.includes(id)
  const isHovered = hoveredObject === id

  useFrame((_state, delta) => {
    meshRef.current.rotation.y += delta * 0.5
    
    // Update material based on selection/hover state
    const material = meshRef.current.material as MeshStandardMaterial
    
    if (isSelected) {
      material.emissive.setHex(0x444444)
      material.color.set(color).multiplyScalar(1.2)
    } else if (isHovered) {
      material.emissive.setHex(0x222222)
      material.color.set(color).multiplyScalar(1.1)
    } else {
      material.emissive.setHex(0x000000)
      material.color.set(color)
    }
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    
    if (event.ctrlKey || event.metaKey) {
      // Multi-select mode
      if (isSelected) {
        removeFromSelection(id)
      } else {
        addToSelection(id)
      }
    } else {
      // Single select mode
      setSelectedObjects([id])
    }
  }

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setHoveredObject(id)
    document.body.style.cursor = 'pointer'
  }

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setHoveredObject(null)
    document.body.style.cursor = 'default'
  }

  return (
    <mesh 
      ref={meshRef} 
      position={position}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      castShadow 
      receiveShadow
      name={id}  // Important: set the name for transform controls
      userData={{ id, type: 'cube' }}
    >
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial 
        color={color}
        transparent={false}
      />
      
      {/* Selection outline */}
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new BoxGeometry(2.02, 2.02, 2.02)]} />
          <lineBasicMaterial color="#00aaff" linewidth={2} />
        </lineSegments>
      )}
      
      {/* Hover outline */}
      {isHovered && !isSelected && (
        <lineSegments>
          <edgesGeometry args={[new BoxGeometry(2.01, 2.01, 2.01)]} />
          <lineBasicMaterial color="#ffffff" linewidth={1} transparent opacity={0.5} />
        </lineSegments>
      )}
    </mesh>
  )
}