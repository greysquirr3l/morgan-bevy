import { forwardRef, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Color, ShaderMaterial, type Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

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
        outlineOpacity: { value: isSelected ? 0.8 : 0.6 },
      },
      transparent: true,
      side: 2, // THREE.BackSide
    })
  }, [isSelected, isHovered, selectedColor, hoveredColor])

  // Base material with efficient color updates
  const material = useMemo(
    () => (
      <meshStandardMaterial
        color={isSelected ? selectedColor : isHovered ? hoveredColor : baseColorObj}
        transparent={isHovered && !isSelected}
        opacity={isHovered && !isSelected ? 0.8 : 1.0}
      />
    ),
    [isSelected, isHovered, selectedColor, hoveredColor, baseColorObj]
  )

  return {
    material,
    needsOutline: isSelected || isHovered,
    outlineMaterial,
  }
}

// Selection highlighting component with outline.
//
// `children` MUST be bare geometry (e.g. `<boxGeometry />`), matching how
// `Scene.tsx`'s SceneObject3D composes a mesh: `<mesh ...><boxGeometry />
// <meshStandardMaterial /></mesh>`. The transform/interaction props below
// are applied to the actual rendered `<mesh>` elements (main + outline)
// here, rather than the caller wrapping its own `<mesh>` around
// `children` — doing that would nest a fully-formed mesh inside this
// component's outer mesh, leaving the inner (visible, geometry-bearing)
// mesh without an explicit material and the outer mesh's material
// attached to a geometry-less, invisible mesh. See T-OptimizedSelection
// bugfix notes.
export interface SelectionHighlightProps {
  children: ReactNode
  isSelected: boolean
  isHovered: boolean
  baseColor?: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  castShadow?: boolean
  receiveShadow?: boolean
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void
  userData?: Record<string, unknown>
  name?: string
}

export const SelectionHighlight = forwardRef<Mesh, SelectionHighlightProps>(
  function SelectionHighlight(
    {
      children,
      isSelected,
      isHovered,
      baseColor,
      position,
      rotation,
      scale,
      castShadow,
      receiveShadow,
      onClick,
      onPointerOver,
      onPointerOut,
      userData,
      name,
    },
    ref
  ) {
    const { material, needsOutline, outlineMaterial } = useSelectionHighlight(
      isSelected,
      isHovered,
      baseColor
    )

    if (needsOutline && outlineMaterial) {
      return (
        <group>
          {/* Main object: real geometry + interaction handlers + base material */}
          <mesh
            ref={ref}
            name={name}
            position={position}
            rotation={rotation}
            scale={scale}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
            onClick={onClick}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
            userData={userData}
          >
            {children}
            {material}
          </mesh>

          {/* Outline mesh: visual-only backface shell, lined up via the
              same transform but not a raycast target (no handlers/userData)
              so it can't swallow clicks meant for the main mesh or confuse
              other code that raycasts scene.children for userData.objectId
              (e.g. BoxSelection.tsx). */}
          <mesh
            position={position}
            rotation={rotation}
            scale={scale}
            material={outlineMaterial}
            raycast={() => null}
          >
            {children}
          </mesh>
        </group>
      )
    }

    return (
      <mesh
        ref={ref}
        name={name}
        position={position}
        rotation={rotation}
        scale={scale}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        userData={userData}
      >
        {children}
        {material}
      </mesh>
    )
  }
)

// Efficient multi-object selection manager.
//
// The `selectionBuffer` ref is a per-id map of `{ selected, hovered }`
// flags. Consumers (the viewport's per-frame render loop) read it on
// every frame to decide which meshes need their outline material
// swapped, without forcing a React re-render. The buffer is updated
// inside a `useEffect` (not `useMemo`) because the body performs a
// side-effect — mutating the ref — which is exactly the contract
// React's rules-of-hooks reserve `useEffect` for.
export function useSelectionManager(objectIds: string[]) {
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set())
  const [hoveredObject, setHoveredObject] = useState<string | null>(null)
  const selectionBuffer = useRef<Map<string, { selected: boolean; hovered: boolean }>>(new Map())

  // T48: derive the buffer from the canonical state during render
  // and mutate the ref. Mutating a ref during render is the
  // documented pattern for per-frame derived data (AGENTS.md §3
  // "Per-frame render-loop values live in useRef or in Three.js
  // objects directly — never in Zustand state"). We use `useMemo`
  // (not `useEffect`) so the buffer is available to the render that
  // produced it; `useEffect` would commit the mutation one tick
  // later and consumers reading `result.current` synchronously after
  // a state update would see a stale empty buffer.
  useMemo(() => {
    const next = new Map<string, { selected: boolean; hovered: boolean }>()
    for (const id of objectIds) {
      next.set(id, {
        selected: selectedObjects.has(id),
        hovered: hoveredObject === id,
      })
    }
    selectionBuffer.current = next
    return next
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
    isHovered,
  }
}
