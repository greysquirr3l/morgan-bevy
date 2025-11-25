import { useEditorStore } from '@/store/editorStore'
import { useCallback, useState } from 'react'

// Performance testing component for generating large numbers of objects
export default function PerformanceTestPanel() {
  const { addObject, clearScene, sceneObjects } = useEditorStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastGenerationTime, setLastGenerationTime] = useState<number | null>(null)

  const generateTestScene = useCallback(async (objectCount: number) => {
    setIsGenerating(true)
    const startTime = performance.now()
    
    // Clear existing scene first
    clearScene()
    
    // Generate objects in batches to avoid blocking UI
    const batchSize = 100
    const batches = Math.ceil(objectCount / batchSize)
    
    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * batchSize
      const batchEnd = Math.min(batchStart + batchSize, objectCount)
      
      for (let i = batchStart; i < batchEnd; i++) {
        const x = (Math.random() - 0.5) * 100
        const y = Math.random() * 10
        const z = (Math.random() - 0.5) * 100
        
        const meshTypes = ['cube', 'sphere', 'pyramid'] as const
        const meshType = meshTypes[Math.floor(Math.random() * meshTypes.length)]
        
        addObject(meshType, [x, y, z])
      }
      
      // Yield to main thread between batches
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
    
    const endTime = performance.now()
    setLastGenerationTime(endTime - startTime)
    setIsGenerating(false)
  }, [addObject, clearScene])

  const generateSmallScene = () => generateTestScene(100)
  const generateMediumScene = () => generateTestScene(1000)
  const generateLargeScene = () => generateTestScene(5000)
  const generateMassiveScene = () => generateTestScene(10000)

  const currentObjectCount = Object.keys(sceneObjects).length

  return (
    <div className="bg-editor-surface border border-editor-border rounded-lg p-4">
      <h3 className="text-editor-text-primary font-medium mb-4">Performance Testing</h3>
      
      <div className="space-y-3">
        <div className="text-sm text-editor-text-secondary">
          Current Objects: <span className="font-mono text-editor-accent">{currentObjectCount}</span>
        </div>
        
        {lastGenerationTime && (
          <div className="text-sm text-editor-text-secondary">
            Last Generation: <span className="font-mono text-green-400">{lastGenerationTime.toFixed(0)}ms</span>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={generateSmallScene}
            disabled={isGenerating}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 
                       text-white text-sm rounded transition-colors"
          >
            {isGenerating ? 'Generating...' : '100 Objects'}
          </button>
          
          <button
            onClick={generateMediumScene}
            disabled={isGenerating}
            className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 
                       text-white text-sm rounded transition-colors"
          >
            {isGenerating ? 'Generating...' : '1K Objects'}
          </button>
          
          <button
            onClick={generateLargeScene}
            disabled={isGenerating}
            className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 
                       text-white text-sm rounded transition-colors"
          >
            {isGenerating ? 'Generating...' : '5K Objects'}
          </button>
          
          <button
            onClick={generateMassiveScene}
            disabled={isGenerating}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 
                       text-white text-sm rounded transition-colors"
          >
            {isGenerating ? 'Generating...' : '10K Objects'}
          </button>
        </div>
        
        <button
          onClick={() => clearScene()}
          disabled={isGenerating}
          className="w-full px-3 py-2 bg-editor-surface-dark hover:bg-gray-700 disabled:bg-gray-600 
                     text-editor-text-primary border border-editor-border rounded transition-colors"
        >
          Clear Scene
        </button>
        
        <div className="text-xs text-editor-text-muted border-t border-editor-border pt-3 mt-4">
          <p className="mb-2"><strong>Performance Tips:</strong></p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Toggle optimized rendering for 5K+ objects</li>
            <li>Use Stats overlay to monitor performance</li>
            <li>Observe LOD system with distance changes</li>
            <li>Test frustum culling by rotating camera</li>
          </ul>
        </div>
      </div>
    </div>
  )
}