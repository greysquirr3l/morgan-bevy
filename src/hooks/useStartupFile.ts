import { useEditorStore } from '@/store/editorStore'
import { ProjectDataSchema, type ProjectData } from '@/types/schemas'
import { LoadCommand, type Command } from '@/utils/commands'
import { addRecentProject } from '@/utils/recentProjects'
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

    return () => {
      cancelled = true
      if (unlisten) unlisten()
    }
  }, [executeCommand])
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
