import { useEditorStore } from '@/store/editorStore'
import { loadLevelFromFile, saveLevelToFile } from '@/types/levelBridge'
import {
  applyExportOptions,
  buildLevelExportPayload,
  levelExportPayloadToLevelData,
} from '@/utils/exportPayload'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { Box, Code, Download, FileText, FolderOpen } from 'lucide-react'
import { useState } from 'react'

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
  const { sceneObjects, waypoints, patrolRoutes, lights } = useEditorStore()
  const [isExporting, setIsExporting] = useState(false)
  const [outputPath, setOutputPath] = useState('')
  const [lastExportResult, setLastExportResult] = useState<ExportResult | null>(null)
  // Audit (Major #17) regression: the metadata / generation-data /
  // optimize-for-size checkboxes used to be `defaultChecked` with
  // no `onChange` and no state — they were inert. Promote them to
  // real state and forward to the Rust export command so the
  // chosen behaviour actually affects the output.
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [includeGenerationData, setIncludeGenerationData] = useState(true)
  const [optimizeForSize, setOptimizeForSize] = useState(false)

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
        format.id === formatId ? { ...format, enabled: !format.enabled } : format
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

  /**
   * Save the current level (the Bevy-shaped payload, not the
   * editor's project file) to a specific path on disk. Distinct
   * from `handleExport` (which runs the full export pipeline and
   * writes JSON / RON / Rust / glTF / FBX in parallel): this
   * writes a single `.morgan-level` file that can be loaded
   * back via `loadLevelFromFile`. Useful for version-control
   * snapshots of generated levels before they're exported into
   * the engine runtime.
   *
   * Note: LevelData and LevelExportPayload have different shapes
   * — LevelData is the Bevy-runtime shape (metadata/dimensions/
   * entities) and LevelExportPayload is the editor's
   * serialization. We map between the two here.
   */
  const handleSaveLevel = async () => {
    try {
      const exported = buildLevelExportPayload(sceneObjects.values(), {
        waypoints,
        patrolRoutes,
        lights,
      })
      const levelData = levelExportPayloadToLevelData(exported)
      const path = window.prompt(
        'Save level to (full path, including filename):',
        'untitled.morgan-level'
      )
      if (!path || !path.trim()) return
      await saveLevelToFile(levelData, path.trim())
      alert(`Level saved to ${path.trim()}`)
    } catch (error) {
      console.error('Save level failed:', error)
      alert(`Save level failed: ${error}`)
    }
  }

  /**
   * Load a `.morgan-level` file from disk. The Rust side
   * round-trips through the spatial index (so culling / LOD stay
   * accurate) and returns the parsed LevelData which we surface
   * as a summary; the editor's scene objects come from
   * `load_project_from_path` in FileMenu.
   */
  const handleLoadLevel = async () => {
    try {
      const selected = await open({
        multiple: false,
        title: 'Open Level',
        filters: [{ name: 'Level', extensions: ['morgan-level', 'json'] }],
      })
      if (!selected || typeof selected !== 'string') return
      const loaded = await loadLevelFromFile(selected)
      const objs = Array.isArray(loaded.entities) ? loaded.entities : []
      console.log(
        `Loaded level with ${objs.length} entities from ${selected} (theme=${loaded.metadata.theme})`
      )
      alert(`Level loaded with ${objs.length} entities. Apply via File > Open Project.`)
    } catch (error) {
      console.error('Load level failed:', error)
      alert(`Load level failed: ${error}`)
    }
  }

  const handleExport = async () => {
    if (!outputPath) {
      alert('Please select an output directory')
      return
    }

    const enabledFormats = exportFormats.filter(format => format.enabled).map(format => format.id)

    if (enabledFormats.length === 0) {
      alert('Please select at least one export format')
      return
    }

    setIsExporting(true)
    try {
      // T91d: payload built by the pure utility — markers ride
      // along via spread-when-present so absent markers omit the
      // key entirely (matches Rust `skip_serializing_if`).
      // T57: waypoints / patrol routes ride along as level-level
      // arrays alongside the per-object markers. T55: the global
      // lighting rig rides along the same way — previously missing
      // entirely, so a scene's lighting never round-tripped into
      // any export.
      const builtPayload = buildLevelExportPayload(sceneObjects.values(), {
        waypoints,
        patrolRoutes,
        lights,
      })

      // Audit fix: the Rust `export_level` command only accepts
      // `level_data, formats, output_path` — `includeMetadata` /
      // `includeGenerationData` / `optimizeForSize` below would be
      // silently dropped by serde if forwarded as extra invoke()
      // args (not authorized to change the Rust command signature).
      // So the checkboxes are made real by filtering the payload
      // itself on the frontend first; see `applyExportOptions` for
      // exactly what each flag does.
      const levelData = applyExportOptions(builtPayload, {
        includeMetadata,
        includeGenerationData,
        optimizeForSize,
      })

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
        <div className="text-xs text-gray-400 mb-1">Objects: {sceneObjects.size}</div>
        {lastExportResult && (
          <div className="text-xs text-green-400">
            Last export: {lastExportResult.exported_files.filter(f => f.success).length} files in{' '}
            {lastExportResult.export_time_ms}ms
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
            onChange={e => setOutputPath(e.target.value)}
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
          {exportFormats.map(format => (
            <label
              key={format.id}
              className="flex items-center space-x-2 p-2 bg-editor-bg rounded border border-editor-border hover:bg-editor-border cursor-pointer"
            >
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
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={e => setIncludeMetadata(e.target.checked)}
              className="rounded"
              data-testid="export-include-metadata"
            />
            <span className="text-xs">Include Metadata</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={includeGenerationData}
              onChange={e => setIncludeGenerationData(e.target.checked)}
              className="rounded"
              data-testid="export-include-generation-data"
            />
            <span className="text-xs">Include Generation Data</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={optimizeForSize}
              onChange={e => setOptimizeForSize(e.target.checked)}
              className="rounded"
              data-testid="export-optimize-size"
            />
            <span className="text-xs">Optimize for Size</span>
          </label>
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isExporting || sceneObjects.size === 0}
        className={`w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs rounded ${
          isExporting || sceneObjects.size === 0
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

      {/* Level-file round-trip (save/load `.morgan-level`) */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleSaveLevel}
          disabled={isExporting || sceneObjects.size === 0}
          className="flex-1 px-3 py-1 text-xs bg-editor-bg hover:bg-editor-hover border border-editor-border rounded text-editor-text disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save the current level as a single .morgan-level file"
        >
          Save Level…
        </button>
        <button
          onClick={handleLoadLevel}
          className="flex-1 px-3 py-1 text-xs bg-editor-bg hover:bg-editor-hover border border-editor-border rounded text-editor-text"
          title="Load a .morgan-level file from disk"
        >
          Load Level…
        </button>
      </div>

      {/* Export Results */}
      {lastExportResult && (
        <div className="mt-3 p-2 bg-editor-bg rounded border border-editor-border">
          <h4 className="text-xs font-medium mb-2">Last Export Results</h4>
          <div className="space-y-1">
            {lastExportResult.exported_files.map((file, index) => (
              <div
                key={index}
                className={`text-xs p-1 rounded ${
                  file.success ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
                }`}
              >
                <div className="font-medium">{file.format}</div>
                <div className="text-xs opacity-75">
                  {file.success
                    ? `${file.file_path.split(/[\\/]/).pop()} (${formatFileSize(file.file_size)})`
                    : 'Export failed'}
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
