import { useMemo, useRef, useState } from 'react'
import { Color, ShaderMaterial } from 'three'

// Selection outline shader - more efficient than changing materials
const outlineVertexShader = `
  varying vec3 vNormal;
  uniform float outlineThickness;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 pos = modelViewMatrix * vec4(position + normal * outlineThickness, 1.0);
    gl_Position = projectionMatrix * pos;
  }
`

const outlineFragmentShader = `
  varying vec3 vNormal;
  uniform vec3 outlineColor;
  uniform float outlineOpacity;
  
  void main() {
    float intensity = pow(0.4 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
    gl_FragColor = vec4(outlineColor, outlineOpacity) * intensity;
  }
`

// Hook for efficient selection highlighting
export function useSelectionHighlight(
  isSelected: boolean,
  isHovered: boolean,
  baseColor: string = '#9ca3af'
): {
  material: React.ReactElement
  needsOutline: boolean
  outlineMaterial?: ShaderMaterial
} {
  const selectedColor = useMemo(() => new Color('#60a5fa'), [])
  const hoveredColor = useMemo(() => new Color('#fbbf24'), [])
  const baseColorObj = useMemo(() => new Color(baseColor), [baseColor])
  
  // Create outline material for selection
  const outlineMaterial = useMemo(() => {
    if (!isSelected && !isHovered) return undefined
    
    return new ShaderMaterial({
      vertexShader: outlineVertexShader,
      fragmentShader: outlineFragmentShader,
      uniforms: {
        outlineColor: { value: isSelected ? selectedColor : hoveredColor },
        outlineThickness: { value: isSelected ? 0.02 : 0.015 },
        outlineOpacity: { value: isSelected ? 0.8 : 0.6 }
      },
      transparent: true,
      side: 2 // THREE.BackSide
    })
  }, [isSelected, isHovered, selectedColor, hoveredColor])

  // Base material with efficient color updates
  const material = useMemo(() => (
    <meshStandardMaterial 
      color={isSelected ? selectedColor : isHovered ? hoveredColor : baseColorObj}
      transparent={isHovered && !isSelected}
      opacity={isHovered && !isSelected ? 0.8 : 1.0}
    />
  ), [isSelected, isHovered, selectedColor, hoveredColor, baseColorObj])

  return {
    material,
    needsOutline: isSelected || isHovered,
    outlineMaterial
  }
}

// Selection highlighting component with outline
export function SelectionHighlight({ 
  children, 
  isSelected, 
  isHovered, 
  baseColor 
}: {
  children: React.ReactNode
  isSelected: boolean
  isHovered: boolean
  baseColor?: string
}) {
  const { material, needsOutline, outlineMaterial } = useSelectionHighlight(
    isSelected, 
    isHovered, 
    baseColor
  )

  if (needsOutline && outlineMaterial) {
    return (
      <group>
        {/* Main object with base material */}
        <mesh>
          {children}
          {material}
        </mesh>
        
        {/* Outline mesh */}
        <mesh material={outlineMaterial}>
          {children}
        </mesh>
      </group>
    )
  }

  return (
    <mesh>
      {children}
      {material}
    </mesh>
  )
}

// Efficient multi-object selection manager
export function useSelectionManager(objectIds: string[]) {
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set())
  const [hoveredObject, setHoveredObject] = useState<string | null>(null)
  const selectionBuffer = useRef<Map<string, { selected: boolean, hovered: boolean }>>(new Map())
  
  // Update selection buffer when objects change
  useMemo(() => {
    const newBuffer = new Map()
    
    objectIds.forEach(id => {
      newBuffer.set(id, {
        selected: selectedObjects.has(id),
        hovered: hoveredObject === id
      })
    })
    
    selectionBuffer.current = newBuffer
  }, [objectIds, selectedObjects, hoveredObject])

  const selectObject = (id: string, additive: boolean = false) => {
    if (additive) {
      const newSelection = new Set(selectedObjects)
      if (newSelection.has(id)) {
        newSelection.delete(id)
      } else {
        newSelection.add(id)
      }
      setSelectedObjects(newSelection)
    } else {
      setSelectedObjects(new Set([id]))
    }
  }

  const selectMultiple = (ids: string[], additive: boolean = false) => {
    if (additive) {
      const newSelection = new Set([...selectedObjects, ...ids])
      setSelectedObjects(newSelection)
    } else {
      setSelectedObjects(new Set(ids))
    }
  }

  const clearSelection = () => {
    setSelectedObjects(new Set())
  }

  const hoverObject = (id: string | null) => {
    setHoveredObject(id)
  }

  const isSelected = (id: string) => selectedObjects.has(id)
  const isHovered = (id: string) => hoveredObject === id

  return {
    selectedObjects,
    hoveredObject,
    selectionBuffer: selectionBuffer.current,
    selectObject,
    selectMultiple,
    clearSelection,
    hoverObject,
    isSelected,
    isHovered
  }
}