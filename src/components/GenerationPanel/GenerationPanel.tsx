import { useState } from 'react'
import { Play, Shuffle, Download } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '@/store/editorStore'
import { CreateObjectCommand } from '@/utils/commands'

interface GenerationParams {
  algorithm: 'BSP' | 'WFC'
  width: number
  height: number
  depth: number
  seed: number | null
  theme: string
  
  // BSP-specific
  minRoomSize?: number
  maxRoomSize?: number
  splitIterations?: number
  largeRoomProbability?: number
  corridorWidth?: number
  
  // WFC-specific
  tileset?: string
  maxIterations?: number
  backtrackLimit?: number
}

interface LevelData {
  id: string
  name: string
  objects: Array<{
    id: string
    name: string
    transform: {
      position: [number, number, number]
      rotation: [number, number, number, number]
      scale: [number, number, number]
    }
    material?: string
    mesh?: string
    layer: string
    tags: string[]
    metadata: Record<string, any>
  }>
  layers: string[]
  generation_seed?: number
  bounds: {
    min: [number, number, number]
    max: [number, number, number]
  }
}

interface GenerationPanelProps {}

export default function GenerationPanel(_props: GenerationPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [params, setParams] = useState<GenerationParams>({
    algorithm: 'BSP',
    width: 24,
    height: 18,
    depth: 1,
    seed: null,
    theme: 'office',
    minRoomSize: 4,
    maxRoomSize: 12,
    splitIterations: 6,
    largeRoomProbability: 0.15,
    corridorWidth: 2,
    tileset: 'dungeon',
    maxIterations: 10000,
    backtrackLimit: 100
  })
  const [lastGenerated, setLastGenerated] = useState<LevelData | null>(null)
  const [recentSeeds, setRecentSeeds] = useState<Array<{seed: number, algorithm: string, timestamp: string}>>([])
  
  const { clearSelection, setSelectedObjects, executeCommand } = useEditorStore()

  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 1000000)
    setParams(prev => ({ ...prev, seed }))
  }

  const handleGenerate = async () => {
    if (isGenerating) return
    
    console.log('Starting generation with params:', params)
    setIsGenerating(true)
    try {
      const finalSeed = params.seed || Date.now()
      let levelData: LevelData
      
      console.log(`Generating with ${params.algorithm} algorithm, seed: ${finalSeed}`)
      
      if (params.algorithm === 'BSP') {
        const bspParams = {
          width: params.width,
          height: params.height,
          depth: params.depth,
          min_room_size: params.minRoomSize || 4,
          max_room_size: params.maxRoomSize || 12,
          corridor_width: params.corridorWidth || 2,
          theme: params.theme,
          seed: finalSeed
        }
        console.log('BSP params:', bspParams)
        levelData = await invoke('generate_bsp_level', { params: bspParams })
      } else {
        const wfcParams = {
          width: params.width,
          height: params.height,
          depth: params.depth,
          tileset: params.tileset || 'dungeon',
          max_iterations: params.maxIterations || 10000,
          backtrack_limit: params.backtrackLimit || 100,
          seed: finalSeed
        }
        console.log('WFC params:', wfcParams)
        levelData = await invoke('generate_wfc_level', { params: wfcParams })
      }
      
      console.log('Generated level data:', levelData)
      
      // Clear existing selection
      clearSelection()
      
      // Add generated objects to scene using command system
      const newObjectIds: string[] = []
      for (const obj of levelData.objects) {
        // Convert mesh to primitive type
        let meshType: 'cube' | 'sphere' | 'pyramid' = 'cube'
        if (obj.mesh?.includes('sphere')) {
          meshType = 'sphere'
        } else if (obj.mesh?.includes('pyramid') || obj.mesh?.includes('cone')) {
          meshType = 'pyramid'
        }
        
        // Create using command system for proper object creation
        const command = new CreateObjectCommand(meshType, obj.transform.position)
        command.execute()
        executeCommand(command)
        
        // Get the created object ID
        const createdId = command.objectId
        newObjectIds.push(createdId)
        
        // Update the object properties to match the generated data
        const { updateObjectTransform, updateObjectName } = useEditorStore.getState()
        updateObjectName(createdId, obj.name)
        
        // Convert quaternion to Euler angles
        const quaternion = obj.transform.rotation
        const [x, y, z, w] = quaternion
        const yaw = Math.atan2(2.0 * (w * y + x * z), 1.0 - 2.0 * (y * y + z * z))
        const rotation: [number, number, number] = [0, yaw * (180 / Math.PI), 0]
        
        updateObjectTransform(createdId, {
          position: obj.transform.position,
          rotation,
          scale: obj.transform.scale
        })
      }
      
      // Select all generated objects
      setSelectedObjects(newObjectIds)
      
      // Update recent seeds
      const seedEntry = {
        seed: finalSeed,
        algorithm: params.algorithm,
        timestamp: new Date().toLocaleString()
      }
      setRecentSeeds(prev => [seedEntry, ...prev.slice(0, 9)])
      
      setLastGenerated(levelData)
      setParams(prev => ({ ...prev, seed: finalSeed }))
      
      console.log(`Generated ${levelData.objects.length} objects using ${params.algorithm}`)
      
    } catch (error) {
      console.error('Generation failed:', error)
      alert(`Generation failed: ${error}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const loadSeed = (seedEntry: {seed: number, algorithm: string}) => {
    setParams(prev => ({ 
      ...prev, 
      seed: seedEntry.seed, 
      algorithm: seedEntry.algorithm as 'BSP' | 'WFC'
    }))
  }

  const exportGeneration = () => {
    if (!lastGenerated) return
    
    const exportData = {
      metadata: {
        version: '1.0.0',
        algorithm: params.algorithm,
        exportedAt: new Date().toISOString()
      },
      parameters: params,
      levelData: lastGenerated
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${params.algorithm.toLowerCase()}-level-${params.seed}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-3 py-2">
      <div className="flex justify-between items-start mb-3">
        <div className="text-xs text-gray-400">
          Objects: {lastGenerated?.objects.length || 0}
        </div>
      </div>
      
      {/* Algorithm Selection */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">Algorithm</label>
          <div className="flex space-x-2">
            <label className="flex items-center space-x-1">
              <input 
                type="radio" 
                name="algorithm" 
                value="BSP" 
                checked={params.algorithm === 'BSP'}
                onChange={(e) => setParams(prev => ({ ...prev, algorithm: e.target.value as 'BSP' }))}
                className="text-generation-bsp"
              />
              <span className="text-generation-bsp text-xs">BSP</span>
            </label>
            <label className="flex items-center space-x-1">
              <input 
                type="radio" 
                name="algorithm" 
                value="WFC" 
                checked={params.algorithm === 'WFC'}
                onChange={(e) => setParams(prev => ({ ...prev, algorithm: e.target.value as 'WFC' }))}
                className="text-generation-wfc"
              />
              <span className="text-generation-wfc text-xs">WFC</span>
            </label>
          </div>
        </div>
        
        {/* Dimensions */}
        <div>
          <label className="block text-xs text-editor-textMuted mb-1">Dimensions</label>
          <div className="flex space-x-1">
            <input
              type="number"
              value={params.width}
              onChange={(e) => setParams(prev => ({ ...prev, width: parseInt(e.target.value) || 24 }))}
              className="w-10 px-1 py-1 text-xs bg-editor-bg border border-editor-border rounded"
              min="8" max="100"
            />
            <span className="text-xs text-editor-textMuted self-center">×</span>
            <input
              type="number"
              value={params.height}
              onChange={(e) => setParams(prev => ({ ...prev, height: parseInt(e.target.value) || 24 }))}
              className="w-10 px-1 py-1 text-xs bg-editor-bg border border-editor-border rounded"
              min="8" max="100"
            />
          </div>
        </div>
      </div>
      
      {/* Theme Selection */}
      <div className="mb-3">
        <label className="block text-xs text-editor-textMuted mb-1">Theme</label>
        <select
          value={params.theme}
          onChange={(e) => setParams(prev => ({ ...prev, theme: e.target.value }))}
          className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded"
        >
          <option value="office">Office</option>
          <option value="dungeon">Dungeon</option>
          <option value="scifi">Sci-Fi</option>
          <option value="castle">Castle</option>
        </select>
      </div>
      
      {/* Seed Management */}
      <div className="mb-3">
        <label className="block text-xs text-editor-textMuted mb-1">Seed</label>
        <div className="flex space-x-2">
          <input
            type="number"
            value={params.seed || ''}
            onChange={(e) => setParams(prev => ({ ...prev, seed: e.target.value ? parseInt(e.target.value) : null }))}
            className="flex-1 px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded"
            placeholder="Random seed"
          />
          <button
            onClick={generateRandomSeed}
            className="px-2 py-1 text-xs bg-editor-border hover:bg-gray-600 rounded"
            title="Generate random seed"
          >
            <Shuffle className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      {/* Generation Controls */}
      <div className="flex space-x-2 mb-3">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`flex-1 flex items-center justify-center space-x-1 px-3 py-1 text-xs rounded ${
            isGenerating 
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : params.algorithm === 'BSP'
                ? 'bg-generation-bsp text-black hover:bg-green-500'
                : 'bg-generation-wfc text-black hover:bg-purple-500'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Generate {params.algorithm}</span>
            </>
          )}
        </button>
        
        {lastGenerated && (
          <button
            onClick={exportGeneration}
            className="px-2 py-1 text-xs bg-editor-border hover:bg-gray-600 rounded flex items-center space-x-1"
            title="Export generation data"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Recent Seeds */}
      {recentSeeds.length > 0 && (
        <div>
          <div className="text-xs font-medium text-editor-textMuted mb-1">Recent Seeds</div>
          <div className="max-h-16 overflow-y-auto space-y-1">
            {recentSeeds.map((seedEntry, index) => (
              <div 
                key={`${seedEntry.seed}-${index}`}
                className="flex items-center justify-between p-1 bg-editor-bg rounded text-xs hover:bg-editor-border cursor-pointer"
                onClick={() => loadSeed(seedEntry)}
              >
                <div className="flex items-center space-x-2">
                  <span className={seedEntry.algorithm === 'BSP' ? 'text-generation-bsp' : 'text-generation-wfc'}>
                    {seedEntry.algorithm}
                  </span>
                  <span className="text-editor-text">{seedEntry.seed}</span>
                </div>
                <span className="text-editor-textMuted">{seedEntry.timestamp.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}