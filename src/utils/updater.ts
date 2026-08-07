/**
 * Frontend wrapper around `@tauri-apps/plugin-updater` (T68).
 *
 * The raw plugin API is callback-heavy (`check()` returns `Update |
 * null`, `downloadAndInstall` takes a progress callback). This module
 * gives the rest of the codebase a typed, event-style surface so
 * the UpdateNotification component can mount a single
 * subscription and not have to plumb callbacks everywhere.
 *
 * Channels: `stable` is the default; `prerelease` is an opt-in for
 * users who want early access. The channel selection is stored
 * under the `morgan-bevy.updateChannel` localStorage key.
 */

import { check as tauriCheck } from '@tauri-apps/plugin-updater'

export type UpdateChannel = 'stable' | 'prerelease'

/** Snapshot of the updater state machine. */
export interface UpdateState {
  /** Whether the wrapped plugin is reachable (false in dev / web). */
  available: boolean
  /** Currently-running check or download. */
  status: 'idle' | 'checking' | 'downloading' | 'ready' | 'installing' | 'error'
  /** Latest version available on the update server (if any). */
  version?: string
  /** Current installed version (from the plugin). */
  currentVersion?: string
  /** Release notes / changelog text from the update manifest. */
  body?: string
  /** Download progress 0..1. */
  progress: number
  /** Last error, surfaced for the UI to render. */
  error?: string
}

/** Stable channel — update when the running version is older than the
 *  latest stable release on the update server. */
export const CHANNEL_STORAGE_KEY = 'morgan-bevy.updateChannel'

export function readChannel(): UpdateChannel {
  try {
    const stored = localStorage.getItem(CHANNEL_STORAGE_KEY)
    return stored === 'prerelease' ? 'prerelease' : 'stable'
  } catch {
    return 'stable'
  }
}

export function writeChannel(channel: UpdateChannel): void {
  try {
    localStorage.setItem(CHANNEL_STORAGE_KEY, channel)
  } catch {
    // localStorage may be unavailable (private mode); fall through
    // and accept that the channel won't persist.
  }
}

/** Initial state — nothing is running, no error. */
export const INITIAL_UPDATE_STATE: UpdateState = {
  available: false,
  status: 'idle',
  progress: 0,
}

/**
 * Attempt to reach the updater backend. Returns `null` if the
 * plugin isn't reachable (dev mode / web), otherwise an `Update`
 * instance we can later download/install.
 */
export async function checkForUpdate(channel: UpdateChannel = 'stable'): Promise<UpdateState> {
  try {
    const update = await tauriCheck({
      // Allow downgrades only when the user explicitly opts into
      // the prerelease channel — that's how you roll back.
      allowDowngrades: channel === 'prerelease',
    })
    if (!update) {
      return { ...INITIAL_UPDATE_STATE, available: true, status: 'idle' }
    }
    return {
      ...INITIAL_UPDATE_STATE,
      available: true,
      status: 'idle',
      version: update.version,
      currentVersion: update.currentVersion,
      body: update.body,
    }
  } catch (e) {
    // The plugin throws when it can't reach the endpoint (no
    // network, dev mode, etc.). Surface a friendly error rather
    // than crashing the host.
    return {
      ...INITIAL_UPDATE_STATE,
      available: false,
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * Download the previously-checked update. Calls `onProgress` as
 * bytes stream in (0..1). Returns the new state on completion.
 *
 * The caller is responsible for retaining the `Update` instance
 * returned from `checkForUpdate`. This wrapper doesn't keep it
 * because the plugin doesn't expose the current version of a
 * "checked but not yet downloaded" update on the store.
 */
export async function downloadUpdate(
  update: { downloadAndInstall: (cb?: (e: unknown) => void) => Promise<void> },
  onProgress: (p: number) => void
): Promise<void> {
  try {
    await update.downloadAndInstall(event => {
      // The plugin's DownloadEvent has `event: 'started' |
      // 'progress' | 'finished'` and a contentLength. We only
      // care about progress for the UI.
      const e = event as unknown as {
        event?: string
        downloadedBytes?: number
        contentLength?: number
      }
      if (e.event === 'progress' && e.contentLength && typeof e.downloadedBytes === 'number') {
        onProgress(Math.min(1, e.downloadedBytes / e.contentLength))
      }
    })
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e))
  }
}
