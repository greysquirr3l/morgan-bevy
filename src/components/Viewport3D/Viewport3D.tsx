import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Stats } from '@react-three/drei'
import Scene from './Scene'
import BoxSelection from './BoxSelection'
import { useEditorStore } from '@/store/editorStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

export default function Viewport3D() {
  const { showGrid, showStats, cameraMode, transformMode } = useEditorStore()
  useKeyboardShortcuts()

  return (
    <div className="viewport-3d w-full h-full bg-gray-900">
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

        {/* Performance Stats */}
        {showStats && <Stats />}
      </Canvas>

      {/* Box Selection Overlay */}
      <BoxSelection />

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