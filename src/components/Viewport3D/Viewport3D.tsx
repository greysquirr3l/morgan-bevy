import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Stats } from '@react-three/drei'
import Scene from './Scene'
import BoxSelection from './BoxSelection'
import TransformGizmos from '../TransformGizmos'
import { useEditorStore } from '@/store/editorStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useCallback, useState } from 'react'

export default function Viewport3D() {
  const { showGrid, showStats, cameraMode, transformMode, addObject } = useEditorStore()
  const [isDragOver, setIsDragOver] = useState(false)
  useKeyboardShortcuts()

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
        {cameraMode === 'orbit' && (
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            panSpeed={1}
            zoomSpeed={1}
            rotateSpeed={1}
            minDistance={1}
            maxDistance={100}
          />
        )}

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
        <Scene />

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
            cameraMode === 'top-down' 
              ? 'bg-editor-accent text-white' 
              : 'bg-black bg-opacity-50 text-white hover:bg-opacity-75'
          }`}
          onClick={() => useEditorStore.getState().setCameraMode('top-down')}
        >
          Top
        </button>
      </div>

      {/* Coordinates Display */}
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded font-mono">
        <div>X: 0.0 Y: 0.0 Z: 0.0</div>
      </div>
    </div>
  )
}