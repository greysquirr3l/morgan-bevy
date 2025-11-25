import { useState } from 'react'
import { Download, FolderOpen, FileText, Code, Box } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useEditorStore } from '@/store/editorStore'

interface ExportFormat {
  id: 'JSON' | 'RON' | 'RustCode' | 'GLTF' | 'FBX'
  name: string
  description: string
  icon: React.ReactNode
  fileExtension: string
  enabled: boolean
}

interface ExportedFile {
  format: ExportFormat['id']
  file_path: string
  file_size: number
  success: boolean
}

interface ExportResult {
  exported_files: ExportedFile[]
  total_objects: number
  export_time_ms: number
  errors: string[]
  warnings: string[]
}

export default function ExportPanel() {
  const { sceneObjects } = useEditorStore()
  const [isExporting, setIsExporting] = useState(false)
  const [outputPath, setOutputPath] = useState('')
  const [lastExportResult, setLastExportResult] = useState<ExportResult | null>(null)
  
  const [exportFormats, setExportFormats] = useState<ExportFormat[]>([
    {
      id: 'JSON',
      name: 'JSON',
      description: 'Universal JSON format for any engine',
      icon: <FileText className="w-4 h-4" />,
      fileExtension: 'json',
      enabled: true,
    },
    {
      id: 'RON',
      name: 'RON (Bevy)',
      description: 'Rust Object Notation - native Bevy format',
      icon: <Code className="w-4 h-4" />,
      fileExtension: 'ron',
      enabled: true,
    },
    {
      id: 'RustCode',
      name: 'Rust Code',
      description: 'Generated Rust code for direct integration',
      icon: <Code className="w-4 h-4" />,
      fileExtension: 'rs',
      enabled: false,
    },
    {
      id: 'GLTF',
      name: 'glTF 2.0',
      description: 'glTF format with PBR materials',
      icon: <Box className="w-4 h-4" />,
      fileExtension: 'gltf',
      enabled: false,
    },
    {
      id: 'FBX',
      name: 'FBX',
      description: 'Autodesk FBX format for 3D software',
      icon: <Box className="w-4 h-4" />,
      fileExtension: 'fbx',
      enabled: false,
    },
  ])

  const toggleFormat = (formatId: ExportFormat['id']) => {
    setExportFormats(formats => 
      formats.map(format => 
        format.id === formatId 
          ? { ...format, enabled: !format.enabled }
          : format
      )
    )
  }

  const selectOutputPath = async () => {
    try {
      const selected = await open({
        directory: true,
        title: 'Select Export Directory',
      })
      
      if (selected && typeof selected === 'string') {
        setOutputPath(selected)
      }
    } catch (error) {
      console.error('Failed to select output path:', error)
    }
  }

  const handleExport = async () => {
    if (!outputPath) {
      alert('Please select an output directory')
      return
    }

    const enabledFormats = exportFormats
      .filter(format => format.enabled)
      .map(format => format.id)

    if (enabledFormats.length === 0) {
      alert('Please select at least one export format')
      return
    }

    setIsExporting(true)
    try {
      // Create level data from current scene
      const levelData = {
        id: 'level-' + Date.now(),
        name: 'Morgan-Bevy Level',
        objects: Object.values(sceneObjects).map((obj: any) => ({
          id: obj.id,
          name: obj.name,
          transform: {
            position: obj.position,
            rotation: [0, 0, 0, 1], // Convert from Euler to quaternion if needed
            scale: obj.scale,
          },
          material: `material_${obj.meshType}`,
          mesh: obj.meshType,
          layer: obj.layerId || 'Default',
          tags: ['exported'],
          metadata: {
            created_at: new Date().toISOString(),
            mesh_type: obj.meshType,
          },
        })),
        layers: ['Default', 'Generated'],
        generation_seed: null,
        generation_params: null,
        bounds: {
          min: [-50.0, -5.0, -50.0],
          max: [50.0, 5.0, 50.0],
        },
      }

      const result: ExportResult = await invoke('export_level', {
        levelData,
        formats: enabledFormats,
        outputPath,
      })

      setLastExportResult(result)
      console.log('Export completed:', result)
      
      // Show success message
      const successFiles = result.exported_files.filter(f => f.success)
      if (successFiles.length > 0) {
        alert(`Successfully exported ${successFiles.length} files in ${result.export_time_ms}ms`)
      }
      
      // Show errors if any
      if (result.errors.length > 0) {
        console.error('Export errors:', result.errors)
        alert(`Export completed with errors: ${result.errors.join(', ')}`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert(`Export failed: ${error}`)
    } finally {
      setIsExporting(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="px-3 py-2">
      {/* Export Status */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-1">
          Objects: {Object.keys(sceneObjects).length}
        </div>
        {lastExportResult && (
          <div className="text-xs text-green-400">
            Last export: {lastExportResult.exported_files.filter(f => f.success).length} files 
            in {lastExportResult.export_time_ms}ms
          </div>
        )}
      </div>

      {/* Output Path */}
      <div className="mb-3">
        <label className="block text-xs text-editor-textMuted mb-1">Output Directory</label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            placeholder="Select output directory..."
            className="flex-1 px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
          />
          <button
            onClick={selectOutputPath}
            className="px-2 py-1 text-xs bg-editor-border hover:bg-gray-600 rounded flex items-center space-x-1"
            title="Browse for directory"
          >
            <FolderOpen className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Export Formats */}
      <div className="mb-3">
        <label className="block text-xs text-editor-textMuted mb-1">Export Formats</label>
        <div className="space-y-2">
          {exportFormats.map((format) => (
            <label key={format.id} className="flex items-center space-x-2 p-2 bg-editor-bg rounded border border-editor-border hover:bg-editor-border cursor-pointer">
              <input
                type="checkbox"
                checked={format.enabled}
                onChange={() => toggleFormat(format.id)}
                className="rounded"
              />
              <div className="text-editor-accent">{format.icon}</div>
              <div className="flex-1">
                <div className="text-xs font-medium text-editor-text">{format.name}</div>
                <div className="text-xs text-editor-textMuted">{format.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Export Options */}
      <div className="mb-3">
        <label className="block text-xs text-editor-textMuted mb-1">Options</label>
        <div className="space-y-1">
          <label className="flex items-center space-x-2">
            <input type="checkbox" defaultChecked className="rounded" />
            <span className="text-xs">Include Metadata</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" defaultChecked className="rounded" />
            <span className="text-xs">Include Generation Data</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" className="rounded" />
            <span className="text-xs">Optimize for Size</span>
          </label>
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isExporting || Object.keys(sceneObjects).length === 0}
        className={`w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs rounded ${
          isExporting || Object.keys(sceneObjects).length === 0
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-500'
        }`}
      >
        {isExporting ? (
          <>
            <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Export Level</span>
          </>
        )}
      </button>

      {/* Export Results */}
      {lastExportResult && (
        <div className="mt-3 p-2 bg-editor-bg rounded border border-editor-border">
          <h4 className="text-xs font-medium mb-2">Last Export Results</h4>
          <div className="space-y-1">
            {lastExportResult.exported_files.map((file, index) => (
              <div key={index} className={`text-xs p-1 rounded ${
                file.success ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
              }`}>
                <div className="font-medium">{file.format}</div>
                <div className="text-xs opacity-75">
                  {file.success 
                    ? `${file.file_path.split('/').pop()} (${formatFileSize(file.file_size)})`
                    : 'Export failed'
                  }
                </div>
              </div>
            ))}
            {lastExportResult.warnings.length > 0 && (
              <div className="text-xs text-yellow-400 mt-2">
                Warnings: {lastExportResult.warnings.join(', ')}
              </div>
            )}
            {lastExportResult.errors.length > 0 && (
              <div className="text-xs text-red-400 mt-2">
                Errors: {lastExportResult.errors.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}