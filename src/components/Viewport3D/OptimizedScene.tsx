import { Mesh, BoxGeometry, MeshStandardMaterial } from 'three'
import { useRef, useMemo } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { 
  LODSphereGeometry, 
  LODBoxGeometry, 
  LODConeGeometry,
  usePerformanceCulling,
  usePerformanceManager,
  InstancedObjectManager,
  SelectionHighlight,
  PerformanceObject
} from '@/performance'

// Ground plane (unchanged)
function Ground() {
  const { clearSelection } = useEditorStore()
  
  const handleClick = () => {
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

// Optimized individual scene object with performance features
function OptimizedSceneObject({ 
  id, 
  meshType, 
  position, 
  rotation, 
  scale, 
  visible,
  material,
  importance = 0.5 
}: { 
  id: string
  meshType: 'cube' | 'sphere' | 'pyramid'
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  visible: boolean
  importance?: number
  material?: {
    baseColor: string
    metallic: number
    roughness: number
    texture?: string
  }
}) {
  const meshRef = useRef<Mesh>(null)
  const { selectedObjects, setSelectedObjects, addToSelection, hoveredObject, setHoveredObject } = useEditorStore()
  
  const isSelected = selectedObjects.includes(id)
  const isHovered = hoveredObject === id
  
  // Performance culling - check if object should render
  const { shouldRender, lodLevel } = usePerformanceCulling(
    position, 
    scale, 
    importance > 0.8 ? 200 : 100 // Important objects render at greater distances
  )
  
  // Early return if culled
  if (!visible || !shouldRender) return null
  
  const handleClick = (e: any) => {
    e.stopPropagation()
    
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      if (isSelected) {
        setSelectedObjects(selectedObjects.filter((objId: string) => objId !== id))
      } else {
        addToSelection(id)
      }
    } else {
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
  
  // LOD-aware geometry based on performance level
  const renderGeometry = () => {
    switch (meshType) {
      case 'cube':
        return <LODBoxGeometry position={position} size={scale} />
      case 'sphere':
        return <LODSphereGeometry position={position} />
      case 'pyramid':
        return <LODConeGeometry position={position} />
      default:
        return <LODBoxGeometry position={position} size={scale} />
    }
  }
  
  const baseColor = material?.baseColor || '#9ca3af'
  
  return (
    <SelectionHighlight
      isSelected={isSelected}
      isHovered={isHovered}
      baseColor={baseColor}
    >
      <mesh
        ref={meshRef}
        name={id}
        position={position}
        rotation={rotation}
        scale={scale}
        castShadow={lodLevel < 2} // Only cast shadows for nearby objects
        receiveShadow={lodLevel < 3}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        userData={{ objectId: id, meshType }}
      >
        {renderGeometry()}
      </mesh>
    </SelectionHighlight>
  )
}

// Performance debug overlay component (moved outside to avoid Three.js context issues)
export function PerformanceOverlay({ metrics, qualityInfo }: any) {
  const { showStats } = useEditorStore()
  
  if (!showStats) return null
  
  return (
    <div className="absolute top-20 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded font-mono">
      <div>Objects: {metrics.renderedObjects}/{metrics.totalObjects}</div>
      <div>Culled: {metrics.culledObjects}</div>
      <div>Instanced: {metrics.instancedObjects}</div>
      <div>FPS: {metrics.frameRate}</div>
      <div>Memory: {metrics.memoryUsage}MB</div>
      <div>Quality: {Math.round(qualityInfo.qualityMultiplier * 100)}%</div>
      <div>LOD Distance: {qualityInfo.lodDistance}</div>
    </div>
  )
}

export default function OptimizedScene() {
  const { sceneObjects, layers } = useEditorStore()
  // Remove useAdaptiveQuality to avoid R3F hooks issues
  const qualityMultiplier = 1.0 // Use default quality for now
  
  // Convert scene objects to performance objects
  const performanceObjects: PerformanceObject[] = useMemo(() => {
    return Object.values(sceneObjects).map((obj: any) => {
      if (obj.type !== 'mesh' || !obj.meshType) return null
      
      // Calculate importance based on selection, layer, and user interaction
      let importance = 0.5
      if (obj.id.includes('selected')) importance = 1.0
      if (obj.layerId === 'walls') importance = 0.8
      if (obj.layerId === 'floors') importance = 0.6
      if (obj.metadata?.fromGrid) importance = 0.4
      
      return {
        id: obj.id,
        meshType: obj.meshType,
        position: obj.position,
        rotation: obj.rotation,
        scale: obj.scale,
        color: obj.material?.baseColor || '#9ca3af',
        visible: obj.visible && (layers.find(l => l.id === obj.layerId)?.visible ?? true),
        importance,
        boundingRadius: Math.max(...obj.scale) * 0.5
      }
    }).filter(Boolean) as PerformanceObject[]
  }, [sceneObjects, layers])
  
  // Performance management system
  const { renderingGroups } = usePerformanceManager(
    performanceObjects,
    qualityMultiplier > 0.8 ? 8000 : qualityMultiplier > 0.5 ? 5000 : 3000
  )
  
  return (
    <>
      {/* Ground plane */}
      <Ground />
      
      {/* Individual objects (important/selected items) */}
      {renderingGroups.individual.map((obj) => (
        <OptimizedSceneObject
          key={obj.id}
          id={obj.id}
          meshType={obj.meshType}
          position={obj.position}
          rotation={obj.rotation}
          scale={obj.scale}
          visible={obj.visible !== false}
          importance={obj.importance}
          material={{
            baseColor: obj.color || '#9ca3af',
            metallic: 0.0,
            roughness: 0.5
          }}
        />
      ))}
      
      {/* Instanced objects for performance */}
      <InstancedObjectManager
        objects={[
          ...renderingGroups.instanced.cube,
          ...renderingGroups.instanced.sphere,
          ...renderingGroups.instanced.pyramid
        ]}
        maxInstancesPerType={Math.ceil(2000 * qualityMultiplier)}
      />
      
      {/* Reference axes (only show in high quality mode) */}
      {qualityMultiplier > 0.7 && (
        <>
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
        </>
      )}
    </>
  )
}