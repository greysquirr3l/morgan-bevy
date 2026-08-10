import { useEditorStore } from '@/store/editorStore'
import { ProjectDataSchema, type ProjectData } from '@/types/schemas'
import { LoadCommand, type Command } from '@/utils/commands'
import { addRecentProject } from '@/utils/recentProjects'
import { isTauriRuntime } from '@/utils/tauriEnv'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect } from 'react'

/**
 * Subscribes to the backend `morgan://open-project` event and loads
 * the project whose path is sent. Fired when the OS launches
 * Morgan-Bevy via a registered file association (e.g. double-clicking
 * a `.morgan` file in the file manager).
 *
 * Should be mounted exactly once near the root of the React tree.
 */
export function useStartupFile(): void {
  const executeCommand = useEditorStore(s => s.executeCommand)

  useEffect(() => {
    // Non-Tauri builds (Vite dev server, `npm run dev`) don't have
    // the webview's event bus. Skip the subscription entirely rather
    // than letting `listen()` throw a cryptic
    // `window.__TAURI_INTERNALS__.transformCallback is not a function`
    // on Tauri 2.x — which doesn't break the app, but pollutes the
    // console with a warning on every launch.
    if (!isTauriRuntime()) {
      return
    }
    let unlisten: (() => void) | null = null
    let cancelled = false

    void (async () => {
      try {
        const handler = await listen<string>('morgan://open-project', event => {
          void handleOpenProject(event.payload, executeCommand)
        })
        if (cancelled) {
          handler()
        } else {
          unlisten = handler
        }
      } catch (e) {
        // Listener is best-effort: dev / web builds won't have the
        // Tauri event bus. Log and continue — the in-app File > Open
        // menu still works in those environments.
        console.warn('useStartupFile: failed to subscribe', e)
      }
    })()

    // T97: also probe the Rust side for a `current_level` cache.
    // If the Rust side has a level loaded (e.g. the user re-launched
    // the app while a level was open in the Rust-side cache), pull
    // it into the front-end store so the UI doesn't show a stale
    // empty scene. Best-effort — failures here don't block the
    // hook's main purpose.
    void syncCurrentLevelFromRust()

    return () => {
      cancelled = true
      if (unlisten) unlisten()
    }
  }, [executeCommand])
}

/**
 * Probe the Rust side for a `current_level` cache and apply it to
 * the front-end store if present. Used as the startup rehydration
 * step — a previous app session may have left the Rust side with a
 * level loaded (the Bevy-runtime cache, distinct from the
 * editor's `ProjectData` file), and we want to show that level on
 * launch instead of an empty scene.
 *
 * Distinct from `handleOpenProject` which reads a `.morgan` file
 * from disk via the OS file association.
 */
async function syncCurrentLevelFromRust(): Promise<void> {
  try {
    const { getCurrentLevel } = await import('@/types/levelBridge')
    const levelData = await getCurrentLevel()
    if (!levelData) return
    const projectData: ProjectData = ProjectDataSchema.parse({
      schemaVersion: 1,
      scene: {
        objects: levelData.entities ?? [],
        layers: [],
        activeLayer: null,
        selectedObjects: [],
        settings: {
          gridSize: 1,
          snapToGrid: false,
          transformMode: 'select',
          coordinateSpace: 'world',
        },
      },
      metadata: {
        name: levelData.metadata.theme,
        savedAt: new Date().toISOString(),
        objectCount: Array.isArray(levelData.entities) ? levelData.entities.length : 0,
        layerCount: 0,
      },
    })
    const executeCommand = useEditorStore.getState().executeCommand
    executeCommand(new LoadCommand(projectData.scene as never))
    const md = projectData.metadata
    console.log(
      `Restored level from Rust cache (theme=${levelData.metadata.theme}, objects=${md?.objectCount ?? 0})`
    )
  } catch (e) {
    // Non-fatal — the user can always open a project via File > Open.
    console.warn('syncCurrentLevelFromRust: failed', e)
  }
}

/**
 * Pull a project from disk, validate it against the public schema,
 * apply it to the editor store via `LoadCommand`, and add the path
 * to the recent-projects list.
 *
 * Exported for tests; the hook itself only fires this in response to
 * the backend event.
 */
export async function handleOpenProject(
  path: string,
  executeCommand: (cmd: Command) => void
): Promise<void> {
  try {
    const raw = await invoke<unknown>('load_project_from_path', { path })
    const projectData = ProjectDataSchema.parse(raw) as ProjectData
    const command = new LoadCommand(projectData.scene as never)
    executeCommand(command)
    const name = path.split(/[\\/]/).pop() ?? path
    addRecentProject(path, name)
  } catch (e) {
    // Failures here are non-fatal — the user can recover via the
    // File > Open dialog. We log instead of alerting so a missing
    // file at startup doesn't disrupt the user.
    console.error('useStartupFile: failed to load project from', path, e)
  }
}
