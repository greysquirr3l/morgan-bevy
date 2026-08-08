import { useEditorStore } from '@/store/editorStore'
import { serializeMap } from '@/store/mapSerialization'
import { AssetId, LayerId } from '@/types/brand'
import { ProjectDataSchema, type ProjectData } from '@/types/schemas'
import { LoadCommand, SaveCommand } from '@/utils/commands'
import { loadExampleLevels } from '@/utils/exampleLevels'
import { buildBevyEntitiesExport, buildFileMenuLevelExportPayload } from '@/utils/exportPayload'
import { collectAssetRefs, missingRefs, readAssetRefs, withAssetRefs } from '@/utils/projectAssets'
import {
  addRecentProject,
  clearRecentProjects,
  formatRecentTimestamp,
  getRecentProjects,
  pruneMissingRecents,
  type RecentProject,
} from '@/utils/recentProjects'
import { invoke } from '@tauri-apps/api/core'
import { BookOpen, Clock, Download, FileText, FolderOpen, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface FileMenuProps {
  isOpen: boolean
  onClose: () => void
  position: { x: number; y: number }
  onManualSave?: () => void
}

export default function FileMenu({ isOpen, onClose, position, onManualSave }: FileMenuProps) {
  const { executeCommand, sceneObjects, layers, currentProjectPath } = useEditorStore()
  const [isExporting, setIsExporting] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [, setLastSavedPath] = useState<string | null>(null)

  // T61: bundled example projects (Office / Dungeon / Castle /
  // SciFi). Loaded eagerly so the menu renders without a flash;
  // `loadExampleLevels` is fast because the data is inlined at
  // build time by Vite's `import.meta.glob`.
  const exampleProjects = loadExampleLevels()

  // Apply a parsed `ProjectData` to the editor store. Mirrors the
  // historical `LoadCommand` shape but works with the zod-validated
  // schema payload rather than an untyped JSON blob.
  const applyProjectDataToStore = (projectData: ProjectData, sourcePath?: string) => {
    // The historical `LoadCommand` takes an untyped `sceneData`. The
    // typed schema payload is forwarded as-is — the internal
    // `LoadCommand` is permissive about extra fields.
    const command = new LoadCommand(projectData.scene as never)
    executeCommand(command)
    // Record the source path so subsequent "Save" overwrites in place.
    useEditorStore.getState().setCurrentProjectPath(sourcePath ?? null)

    // Cross-check the project's asset refs against the live asset
    // database. We do this best-effort: a failure to query the
    // database must not block the load itself.
    const refs = readAssetRefs(projectData)
    if (refs.length === 0) return
    void (async () => {
      try {
        const knownPaths = await invoke<unknown>('search_assets_database', {
          query: '',
        })
        const knownSet = new Set<string>()
        if (Array.isArray(knownPaths)) {
          for (const entry of knownPaths) {
            if (entry && typeof entry === 'object' && 'path' in entry) {
              const p = (entry as { path?: unknown }).path
              if (typeof p === 'string') knownSet.add(p)
            }
          }
        }
        const missing = missingRefs(knownSet, refs)
        // `AssetRef` values are texture *paths* (e.g. "textures/wood.png"),
        // not UUID-shaped ids — they legitimately contain `/` and `.`, so
        // they will never satisfy `ID_PATTERN`. Brand them with the plain
        // constructor (a locally-computed relabeling, not a validating
        // parse) rather than `parseAssetId`, which would reject every
        // real path.
        useEditorStore.getState().setMissingAssetRefs(missing.map(AssetId))
        if (missing.length > 0) {
          console.warn(`Project loaded with ${missing.length} missing asset(s):`, missing)
        }
      } catch (e) {
        // Non-fatal: asset database may not be initialised in dev /
        // web builds. The scene loads regardless.
        console.debug('Asset-ref check skipped:', e)
      }
    })()
  }

  // Load the recent-projects list on mount and prune missing entries.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const initial = getRecentProjects()
      if (cancelled) return
      setRecentProjects(initial)
      const pruned = await pruneMissingRecents(initial)
      if (cancelled) return
      setRecentProjects(pruned)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!isOpen) return null

  const handleNewScene = () => {
    if (Array.from(sceneObjects.keys()).length > 0) {
      const confirmClear = window.confirm('Are you sure? This will clear the current scene.')
      if (!confirmClear) return
    }

    // Clear scene and reset to default
    useEditorStore.setState({
      sceneObjects: new Map(),
      selectedObjects: [],
      undoHistory: [],
      redoHistory: [],
      activeLayer: LayerId('default'),
    })
    onClose()
  }

  const handleSave = () => {
    const command = new SaveCommand()
    executeCommand(command)
    onClose()
  }

  const handleLoad = () => {
    // Create file input element
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.morgan'
    input.onchange = event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = e => {
          try {
            const content = e.target?.result as string
            const data = JSON.parse(content)
            const command = new LoadCommand(data)
            executeCommand(command)
          } catch (error) {
            alert('Error loading file: Invalid format')
            console.error('Load error:', error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
    onClose()
  }

  // T61: replace the current scene with one of the bundled
  // example projects. Confirms with the user first because the
  // current scene is discarded (no undo for "Open Project" — the
  // spec mentions that constraint explicitly).
  const loadTemplate = (id: string) => {
    const eg = exampleProjects.find(e => e.id === id)
    if (!eg) return
    if (!confirm(`Load template "${eg.name}"? Your current scene will be discarded.`)) {
      return
    }
    try {
      const command = new LoadCommand(eg.projectData as never)
      executeCommand(command)
      onClose()
    } catch (error) {
      alert(`Failed to load template: ${error}`)
      console.error('Template load error:', error)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)

    try {
      // Create comprehensive export data
      const exportData = {
        metadata: {
          version: '1.0.0',
          editor: 'Morgan-Bevy',
          exportedAt: new Date().toISOString(),
          objectCount: Array.from(sceneObjects.keys()).length,
          layerCount: layers.length,
        },
        scene: {
          objects: serializeMap(sceneObjects),
          layers: layers,
          settings: {
            gridSize: useEditorStore.getState().gridSize,
            snapToGrid: useEditorStore.getState().snapToGrid,
          },
        },
        // Bevy-compatible format
        bevy: {
          // T91d: payload built by the pure utility — markers ride
          // along as top-level keys on each entity, spread only
          // when present (no `null` values; matches Rust
          // `skip_serializing_if`).
          entities: buildBevyEntitiesExport(sceneObjects.values(), layers),
        },
      }

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `morgan-scene-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('Error exporting scene')
      console.error('Export error:', error)
    } finally {
      setIsExporting(false)
    }

    onClose()
  }

  const saveProject = async () => {
    try {
      const state = useEditorStore.getState()
      const projectData: ProjectData = ProjectDataSchema.parse(
        withAssetRefs(
          {
            schemaVersion: 1,
            scene: {
              objects: serializeMap(state.sceneObjects),
              layers: state.layers,
              activeLayer: state.activeLayer,
              selectedObjects: state.selectedObjects,
              settings: {
                gridSize: state.gridSize,
                snapToGrid: state.snapToGrid,
                transformMode: state.transformMode,
                coordinateSpace: state.coordinateSpace,
              },
            },
            metadata: {
              name: 'Morgan-Bevy Project',
              savedAt: new Date().toISOString(),
              objectCount: state.sceneObjects.size,
              layerCount: state.layers.length,
            },
          },
          collectAssetRefs(state)
        )
      )

      // Save As: clear the in-memory path so the Rust side pops the
      // dialog. If the user already has a project open (Save), we
      // pass the existing path and the Rust side overwrites it
      // in-place without prompting.
      const path = await invoke<string>('save_project', {
        projectData,
        path: state.currentProjectPath,
      })
      const name = path.split(/[\\/]/).pop() ?? 'project.morgan'
      setRecentProjects(addRecentProject(path, name))
      setLastSavedPath(path)
      state.setCurrentProjectPath(path)
      onClose()
    } catch (error) {
      console.error('Save failed:', error)
      alert(`Save failed: ${error}`)
    }
  }

  const saveProjectAs = async () => {
    // Force the Save-As flow even if a current path is set: clear
    // the in-memory path, then delegate to `saveProject` so the
    // Rust side will pop the dialog.
    useEditorStore.getState().setCurrentProjectPath(null)
    await saveProject()
  }

  const openProject = async () => {
    try {
      const raw = await invoke<unknown>('load_project')
      const projectData = ProjectDataSchema.parse(raw)
      applyProjectDataToStore(projectData, undefined)
      // The Rust side returns the parsed JSON, not the path — but the
      // save_project command returned the path. For "Open" we don't
      // currently get the path back, so we add a synthetic recent
      // entry derived from the project metadata name (the user can
      // re-save to lock the path into recents).
      const fallbackName =
        (projectData.metadata as { name?: string } | undefined)?.name ??
        `${(projectData.metadata as { name?: string } | undefined)?.name ?? 'project'}.mbp`
      setRecentProjects(
        addRecentProject(
          (projectData.metadata as { name?: string } | undefined)?.name ?? 'in-memory',
          fallbackName
        )
      )
      onClose()
    } catch (error) {
      console.error('Load failed:', error)
      alert(`Load failed: ${error}`)
    }
  }

  const openRecentProject = async (entry: RecentProject) => {
    try {
      const raw = await invoke<unknown>('load_project_from_path', {
        path: entry.path,
      })
      const projectData = ProjectDataSchema.parse(raw)
      applyProjectDataToStore(projectData, entry.path)
      setRecentProjects(addRecentProject(entry.path, entry.name))
      onClose()
    } catch (error) {
      // If the file is missing, prune it from the list and let the
      // user retry.
      console.error('Failed to open recent project', entry.path, error)
      setRecentProjects(
        (await pruneMissingRecents(getRecentProjects())).filter(e => e.path !== entry.path)
      )
      alert(`Failed to open ${entry.name}: ${error}`)
    }
  }

  const clearRecents = () => {
    clearRecentProjects()
    setRecentProjects([])
  }

  const exportLevel = () => {
    setShowExportModal(true)
  }

  const handleLevelExport = async (format: 'json' | 'ron' | 'rust') => {
    try {
      // T91d: payload built by the pure utility — markers ride
      // along via spread-when-present so absent markers omit the
      // key entirely (matches Rust `skip_serializing_if`).
      const levelData = buildFileMenuLevelExportPayload(sceneObjects.values())

      // Export via Tauri command
      await invoke('export_level_simple', {
        levelData,
        format,
        outputPath: null, // Let user choose
      })

      setShowExportModal(false)
      onClose()
      console.log(`Exported level as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export failed:', error)
      alert(`Export failed: ${error}`)
    }
  }

  return (
    <>
      {/* Backdrop to close menu */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* File Menu */}
      <div
        className="fixed bg-editor-panel border border-editor-border rounded-md shadow-lg py-1 z-50 min-w-48"
        style={{
          left: position.x,
          top: position.y,
          maxHeight: '400px',
          overflowY: 'auto',
        }}
      >
        {/* New Scene */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={handleNewScene}
        >
          <FileText className="w-4 h-4" />
          <span>New Scene</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+N</span>
        </button>

        {/* Separator */}
        <div className="border-t border-editor-border my-1" />

        {/* Load Scene */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={handleLoad}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Open Scene...</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+O</span>
        </button>

        {/* Save Scene */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={handleSave}
        >
          <Save className="w-4 h-4" />
          <span>Save Scene</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+S</span>
        </button>

        {/* Auto-Save to Local Storage */}
        {onManualSave && (
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
            onClick={onManualSave}
          >
            <Save className="w-4 h-4 text-blue-400" />
            <span>Save Work Locally</span>
            <span className="ml-auto text-xs text-editor-textMuted">Auto-restore</span>
          </button>
        )}

        {/* Separator */}
        <div className="border-t border-editor-border my-1" />

        {/* Project Operations */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={saveProject}
        >
          <Save className="w-4 h-4" />
          <span>{currentProjectPath ? 'Save Project' : 'Save Project As…'}</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+Shift+S</span>
        </button>

        {currentProjectPath && (
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
            onClick={saveProjectAs}
          >
            <Save className="w-4 h-4" />
            <span>Save Project As…</span>
          </button>
        )}

        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={openProject}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Open Project...</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+Shift+O</span>
        </button>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <>
            <div className="border-t border-editor-border my-1" />
            <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-editor-textMuted flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Recent</span>
              </span>
              <button
                type="button"
                className="text-editor-textMuted hover:text-editor-text"
                onClick={clearRecents}
                aria-label="Clear recent projects"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {recentProjects.map(entry => (
              <button
                key={entry.path}
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
                onClick={() => openRecentProject(entry)}
                title={entry.path}
              >
                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{entry.name}</div>
                  <div className="text-[10px] text-editor-textMuted truncate">
                    {formatRecentTimestamp(entry.openedAt)}
                  </div>
                </div>
              </button>
            ))}
          </>
        )}

        {/* Separator */}
        <div className="border-t border-editor-border my-1" />

        {/* T61: Example projects (Templates). Bundled at build time
            via Vite's import.meta.glob — Office / Dungeon / Castle /
            SciFi. Clicking one replaces the current scene. The
            user is warned via `confirm` because there's no undo for
            Open Project. */}
        <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-editor-textMuted flex items-center space-x-1">
          <BookOpen className="w-3 h-3" />
          <span>Templates</span>
        </div>
        {exampleProjects.map(eg => (
          <button
            key={eg.id}
            className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
            onClick={() => loadTemplate(eg.id)}
            title={eg.description}
          >
            <FileText className="w-4 h-4" />
            <span>{eg.name}</span>
            <span className="ml-auto text-xs text-editor-textMuted truncate max-w-[8rem]">
              {eg.description.split('.')[0]}
            </span>
          </button>
        ))}

        {/* Separator */}
        <div className="border-t border-editor-border my-1" />

        {/* Export Scene */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
          <span>{isExporting ? 'Exporting...' : 'Export Scene...'}</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+E</span>
        </button>

        {/* Export Level */}
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
          onClick={exportLevel}
        >
          <Download className="w-4 h-4" />
          <span>Export Level...</span>
          <span className="ml-auto text-xs text-editor-textMuted">Ctrl+Shift+E</span>
        </button>

        {/* Scene Info */}
        <div className="border-t border-editor-border my-1" />
        <div className="px-3 py-2 text-xs text-editor-textMuted">
          <div>Objects: {Array.from(sceneObjects.keys()).length}</div>
          <div>Layers: {layers.length}</div>
        </div>
      </div>

      {/* Export Level Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-editor-panel border border-editor-border rounded-lg p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">Export Level</h2>

            <div className="space-y-3 mb-6">
              <button
                className="w-full flex items-center justify-between p-3 bg-editor-bg hover:bg-editor-hover rounded text-left"
                onClick={() => handleLevelExport('json')}
              >
                <div>
                  <div className="font-medium">JSON Export</div>
                  <div className="text-sm text-editor-textMuted">
                    Universal format for web and tools
                  </div>
                </div>
                <Download className="w-5 h-5" />
              </button>

              <button
                className="w-full flex items-center justify-between p-3 bg-editor-bg hover:bg-editor-hover rounded text-left"
                onClick={() => handleLevelExport('ron')}
              >
                <div>
                  <div className="font-medium">RON Export</div>
                  <div className="text-sm text-editor-textMuted">Native Bevy format</div>
                </div>
                <Download className="w-5 h-5" />
              </button>

              <button
                className="w-full flex items-center justify-between p-3 bg-editor-bg hover:bg-editor-hover rounded text-left"
                onClick={() => handleLevelExport('rust')}
              >
                <div>
                  <div className="font-medium">Rust Code</div>
                  <div className="text-sm text-editor-textMuted">Direct import code generation</div>
                </div>
                <Download className="w-5 h-5" />
              </button>
            </div>

            <div className="flex space-x-2">
              <button
                className="flex-1 px-4 py-2 bg-editor-bg hover:bg-editor-hover rounded"
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
