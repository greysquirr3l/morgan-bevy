import { Canvas } from '@react-three/fiber'
import { Grid, Stats } from '@react-three/drei'
import Scene from './Scene'
import OptimizedScene, { PerformanceOverlay } from './OptimizedScene'
import BoxSelection, { BoxSelectionOverlay } from './BoxSelection'
import TransformGizmos from '../TransformGizmos'
import TransformConstraintIndicator from '../TransformConstraintIndicator'
import CameraSystem from './CameraSystem'
import { useEditorStore } from '@/store/editorStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useBoxSelection } from '@/hooks/useBoxSelection'
import { useCameraControls } from '@/hooks/useCameraControls'
import { usePerformanceManager, PerformanceObject } from '@/performance'
import { useCallback, useState, forwardRef, useImperativeHandle, useMemo } from 'react'
import React from 'react'
// Camera controls interface
export interface CameraControlsRef {
  resetView: () => void
  focusSelection: () => void
  frameAll: () => void
}

// Performance context component that handles R3F hooks within Canvas
function PerformanceContext({ 
  performanceObjects, 
  setMetrics, 
  setQualityInfo
}: {
  performanceObjects: PerformanceObject[]
  setMetrics: (metrics: any) => void
  setQualityInfo: (quality: any) => void
}) {
  const { metrics } = usePerformanceManager(
    performanceObjects,
    5000 // max render budget
  )
  
  // Update parent component with metrics
  React.useEffect(() => {
    setMetrics(metrics)
  }, [metrics, setMetrics])
  
  // Simple quality management without useFrame for now
  React.useEffect(() => {
    setQualityInfo({
      qualityMultiplier: metrics.frameRate > 30 ? 1.0 : 0.6,
      lodDistance: metrics.frameRate > 30 ? 50 : 30,
      instanceThreshold: 10
    })
  }, [metrics.frameRate, setQualityInfo])
  
  return null
}

// Camera controls component that provides the controls within Canvas context
function CameraControls({ cameraControlsRef }: { cameraControlsRef: React.ForwardedRef<CameraControlsRef> }) {
  const { resetView, focusSelection, frameAll } = useCameraControls()
  const { cameraMode, setCameraMode } = useEditorStore()
  
  useImperativeHandle(cameraControlsRef, () => ({
    resetView,
    focusSelection,
    frameAll
  }), [resetView, focusSelection, frameAll])

  return (
    <CameraSystem 
      mode={cameraMode} 
      onModeChange={setCameraMode}
    />
  )
}

export default forwardRef<CameraControlsRef, object>((_props, ref) => {
  const { showGrid, showStats, transformMode, addObject, cameraMode, sceneObjects, layers } = useEditorStore()
  const [isDragOver, setIsDragOver] = useState(false)
  const [useOptimizedRendering, setUseOptimizedRendering] = useState(true)
  const { boxState } = useBoxSelection()
  useKeyboardShortcuts()

  // Performance state managed locally
  const [metrics, setMetrics] = useState({
    totalObjects: 0,
    renderedObjects: 0,
    culledObjects: 0,
    instancedObjects: 0,
    frameRate: 60,
    memoryUsage: 0
  })
  
  const [qualityInfo, setQualityInfo] = useState({
    qualityMultiplier: 1.0,
    lodDistance: 50,
    instanceThreshold: 10
  })
  
  // Convert scene objects to performance objects for metrics
  const performanceObjects: PerformanceObject[] = useMemo(() => {
    return Object.values(sceneObjects).map((obj: any) => {
      if (obj.type !== 'mesh' || !obj.meshType) return null
      
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

  // Handle drag and drop from assets panel
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    
    try {
      const assetData = JSON.parse(event.dataTransfer.getData('application/json'))
      
      // Only handle asset drops (not other types of drag data)
      if (!assetData.isAsset) {
        return
      }
      
      // Calculate drop position (simplified - would normally use raycasting)
      const rect = event.currentTarget.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 20 - 10
      const z = ((event.clientY - rect.top) / rect.height) * 20 - 10
      
      // Determine object type based on asset type and name
      let objectType: 'cube' | 'sphere' | 'pyramid' = 'cube' // default fallback
      if (assetData.type === 'model') {
        // Map common model names to basic shapes for demo
        const fileName = assetData.name.toLowerCase()
        if (fileName.includes('sphere')) {
          objectType = 'sphere'
        } else if (fileName.includes('cube') || fileName.includes('box')) {
          objectType = 'cube'
        } else if (fileName.includes('pyramid') || fileName.includes('cone')) {
          objectType = 'pyramid'
        } else {
          objectType = 'cube' // default for unknown models
        }
      }
      
      // Create the 3D object in the scene
      const objectId = addObject(objectType, [x, 0, z])
      
      console.log(`Dropped asset "${assetData.name}" (${assetData.type}) at position [${x.toFixed(2)}, 0, ${z.toFixed(2)}]`)
      console.log('Created object ID:', objectId, 'Type:', objectType)
      
    } catch (error) {
      console.error('Failed to handle asset drop:', error)
    }
  }, [addObject])

  return (
    <div 
      className={`viewport-3d w-full h-full bg-gray-900 relative ${
        isDragOver ? 'ring-2 ring-blue-400 ring-inset' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-400/10 border-2 border-dashed border-blue-400 pointer-events-none flex items-center justify-center z-10">
          <div className="bg-blue-600/80 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
            Drop asset here to add to scene
          </div>
        </div>
      )}

      {/* Box Selection Overlay */}
      <BoxSelectionOverlay 
        isSelecting={boxState.isSelecting}
        startPoint={boxState.startPoint}
        currentPoint={boxState.currentPoint}
      />

      {/* Transform Constraint Indicator */}
      <TransformConstraintIndicator />

      <Canvas
        camera={{ 
          position: [10, 10, 10], 
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        gl={{ 
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true
        }}
        shadows
        onCreated={({ gl }) => {
          gl.setSize(window.innerWidth, window.innerHeight)
        }}
      >
        {/* Performance context to handle R3F hooks */}
        <PerformanceContext 
          performanceObjects={performanceObjects}
          setMetrics={setMetrics}
          setQualityInfo={setQualityInfo}
        />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <pointLight position={[-10, -10, -10]} intensity={0.2} />

        {/* Camera Controls */}
        {/* Camera Controls */}
        <CameraControls cameraControlsRef={ref} />

        {/* Grid */}
        {showGrid && (
          <Grid
            renderOrder={-1}
            position={[0, -0.01, 0]}
            infiniteGrid
            cellSize={1}
            cellThickness={1}
            cellColor={'#6f6f6f'}
            sectionSize={10}
            sectionThickness={1.5}
            sectionColor={'#9d4b4b'}
            fadeDistance={50}
            fadeStrength={1}
          />
        )}

        {/* Scene Content */}
        {useOptimizedRendering ? (
          <OptimizedScene />
        ) : (
          <Scene />
        )}

        {/* Transform Gizmos - needs to be inside Canvas for R3F hooks */}
        <TransformGizmos />

        {/* Box Selection - needs to be inside Canvas for R3F hooks */}
        <BoxSelection />

        {/* Performance Stats */}
        {showStats && <Stats />}
      </Canvas>

      {/* Viewport UI Overlay */}
      <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
        <div>Camera: {cameraMode}</div>
        <div>Grid: {showGrid ? 'On' : 'Off'}</div>
        <div>Transform: {transformMode}</div>
        <div>Rendering: {useOptimizedRendering ? 'Optimized' : 'Standard'}</div>
      </div>

      {/* Performance Controls */}
      <div className="absolute top-2 right-2 flex space-x-2">
        <button 
          className={`px-2 py-1 text-xs rounded ${
            useOptimizedRendering 
              ? 'bg-green-600 text-white' 
              : 'bg-black bg-opacity-50 text-white hover:bg-opacity-75'
          }`}
          onClick={() => setUseOptimizedRendering(!useOptimizedRendering)}
          title="Toggle performance optimization"
        >
          {useOptimizedRendering ? '⚡ Optimized' : '🐌 Standard'}
        </button>
      </div>

      {/* Camera Mode Controls */}
      <div className="absolute bottom-2 left-2 flex space-x-2">
        <button 
          className={`px-2 py-1 text-xs rounded ${
            cameraMode === 'orbit' 
              ? 'bg-editor-accent text-white' 
              : 'bg-black bg-opacity-50 text-white hover:bg-opacity-75'
          }`}
          onClick={() => useEditorStore.getState().setCameraMode('orbit')}
        >
          Orbit
        </button>
        <button 
          className={`px-2 py-1 text-xs rounded ${
            cameraMode === 'fly' 
              ? 'bg-editor-accent text-white' 
              : 'bg-black bg-opacity-50 text-white hover:bg-opacity-75'
          }`}
          onClick={() => useEditorStore.getState().setCameraMode('fly')}
        >
          Fly
        </button>
        <button 
          className={`px-2 py-1 text-xs rounded ${
            cameraMode === 'orthographic' 
              ? 'bg-editor-accent text-white' 
              : 'bg-black bg-opacity-50 text-white hover:bg-opacity-75'
          }`}
          onClick={() => useEditorStore.getState().setCameraMode('orthographic')}
        >
          Ortho
        </button>
      </div>

      {/* Coordinates Display */}
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded font-mono">
        <div>X: 0.0 Y: 0.0 Z: 0.0</div>
      </div>

      {/* Performance Overlay */}
      {useOptimizedRendering && (
        <PerformanceOverlay 
          metrics={metrics} 
          qualityInfo={qualityInfo} 
        />
      )}
    </div>
  )
})