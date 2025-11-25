import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { InstancedObjectData } from './InstancedRendering'

// Performance metrics tracking
interface PerformanceMetrics {
  totalObjects: number
  renderedObjects: number
  culledObjects: number
  instancedObjects: number
  frameRate: number
  memoryUsage: number
}

// Object rendering strategy based on performance characteristics
export type RenderingStrategy = 'individual' | 'instanced' | 'culled' | 'lod'

// Enhanced object data for performance management
export interface PerformanceObject extends InstancedObjectData {
  meshType: 'cube' | 'sphere' | 'pyramid'
  layerId?: string
  renderStrategy?: RenderingStrategy
  importance?: number // 0-1, higher = more important
  boundingRadius?: number
}

// Hook for intelligent performance management
export function usePerformanceManager(
  objects: PerformanceObject[],
  maxRenderBudget: number = 5000 // Maximum objects to render per frame
) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalObjects: 0,
    renderedObjects: 0,
    culledObjects: 0,
    instancedObjects: 0,
    frameRate: 60,
    memoryUsage: 0
  })
  
  const frameCount = useRef(0)
  const frameTimeBuffer = useRef<number[]>([])
  
  // Group objects by rendering strategy
  const renderingGroups = useMemo(() => {
    const groups = {
      individual: [] as PerformanceObject[],
      instanced: {
        cube: [] as PerformanceObject[],
        sphere: [] as PerformanceObject[],
        pyramid: [] as PerformanceObject[]
      },
      culled: [] as PerformanceObject[],
      lod: [] as PerformanceObject[]
    }
    
    // Sort objects by importance for rendering priority
    const sortedObjects = [...objects].sort((a, b) => 
      (b.importance || 0.5) - (a.importance || 0.5)
    )
    
    let renderBudgetUsed = 0
    
    sortedObjects.forEach(obj => {
      // Determine rendering strategy based on object characteristics
      const shouldInstance = objects.filter(o => 
        o.meshType === obj.meshType && 
        !o.id.includes('selected') && 
        !o.id.includes('hovered')
      ).length > 10 // Instance if more than 10 similar objects
      
      const isImportant = (obj.importance || 0.5) > 0.8
      const isInBudget = renderBudgetUsed < maxRenderBudget
      
      if (!isInBudget && !isImportant) {
        groups.culled.push(obj)
      } else if (shouldInstance && isInBudget) {
        groups.instanced[obj.meshType].push(obj)
        renderBudgetUsed++
      } else if (isInBudget) {
        groups.individual.push(obj)
        renderBudgetUsed++
      } else {
        groups.culled.push(obj)
      }
    })
    
    return groups
  }, [objects, maxRenderBudget])
  
  // Performance monitoring
  useFrame((_, delta) => {
    frameCount.current++
    
    // Calculate frame rate every 60 frames
    if (frameCount.current % 60 === 0) {
      frameTimeBuffer.current.push(delta)
      
      if (frameTimeBuffer.current.length > 10) {
        frameTimeBuffer.current.shift()
      }
      
      const avgFrameTime = frameTimeBuffer.current.reduce((a, b) => a + b, 0) / frameTimeBuffer.current.length
      const fps = Math.min(60, Math.round(1 / avgFrameTime))
      
      const renderedCount = (
        renderingGroups.individual.length +
        renderingGroups.instanced.cube.length +
        renderingGroups.instanced.sphere.length +
        renderingGroups.instanced.pyramid.length
      )
      
      setMetrics({
        totalObjects: objects.length,
        renderedObjects: renderedCount,
        culledObjects: renderingGroups.culled.length,
        instancedObjects: (
          renderingGroups.instanced.cube.length +
          renderingGroups.instanced.sphere.length +
          renderingGroups.instanced.pyramid.length
        ),
        frameRate: fps,
        memoryUsage: Math.round((performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0)
      })
    }
  })
  
  return {
    renderingGroups,
    metrics,
    shouldReduceQuality: metrics.frameRate < 30,
    shouldIncreaseQuality: metrics.frameRate > 55 && metrics.renderedObjects < maxRenderBudget * 0.8
  }
}

// Adaptive quality manager - automatically adjusts rendering quality based on performance
export function useAdaptiveQuality(
  baseQuality: number = 1.0,
  targetFrameRate: number = 60
) {
  const [currentQuality, setCurrentQuality] = useState(baseQuality)
  const frameTimeHistory = useRef<number[]>([])
  const adjustmentCooldown = useRef(0)
  
  useFrame((_, delta) => {
    frameTimeHistory.current.push(delta)
    
    if (frameTimeHistory.current.length > 30) {
      frameTimeHistory.current.shift()
    }
    
    adjustmentCooldown.current--
    
    // Only adjust quality every 30 frames and when not in cooldown
    if (frameTimeHistory.current.length === 30 && adjustmentCooldown.current <= 0) {
      const avgFrameTime = frameTimeHistory.current.reduce((a, b) => a + b, 0) / 30
      const currentFPS = 1 / avgFrameTime
      
      if (currentFPS < targetFrameRate * 0.8) {
        // Reduce quality to improve performance
        setCurrentQuality(prev => Math.max(0.2, prev - 0.1))
        adjustmentCooldown.current = 180 // 3 second cooldown
      } else if (currentFPS > targetFrameRate * 0.95 && currentQuality < baseQuality) {
        // Increase quality if performance allows
        setCurrentQuality(prev => Math.min(baseQuality, prev + 0.05))
        adjustmentCooldown.current = 180
      }
    }
  })
  
  return {
    qualityMultiplier: currentQuality,
    lodDistance: Math.max(50, 100 * currentQuality),
    shadowQuality: currentQuality > 0.5 ? 'high' : 'low',
    instanceThreshold: Math.ceil(5 / currentQuality), // Lower threshold when quality is reduced
    maxRenderDistance: Math.max(50, 200 * currentQuality)
  }
}

// Performance debugging overlay
export function usePerformanceDebug() {
  const [debugInfo, setDebugInfo] = useState({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    memoryMB: 0
  })
  
  useFrame((state) => {
    const info = state.gl.info
    
    setDebugInfo({
      fps: Math.round(1 / state.clock.getDelta()),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      memoryMB: Math.round((performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0)
    })
  })
  
  return debugInfo
}