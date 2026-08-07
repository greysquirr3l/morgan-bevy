/**
 * In-app "Update available" notification (T68).
 *
 * Mounts once near the top of the React tree (in App.tsx). On
 * mount, calls the updater plugin to check for a newer release. If
 * an update is available, shows a banner with:
 *   - Install — downloads in the background, prompts the OS to
 *     stage the update, and signals that a restart is required.
 *   - Dismiss — hides the banner for this specific version
 *     (persisted via localStorage so we don't re-prompt).
 *   - Switch channel — toggles between `stable` (default) and
 *     `prerelease` (opt-in early access) and re-checks.
 *
 * In dev / web builds the plugin is unreachable, so the component
 * renders nothing.
 */
import { readChannel, writeChannel, type UpdateChannel } from '@/utils/updater'
import { check as tauriCheck, type Update } from '@tauri-apps/plugin-updater'
import { RefreshCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const DISMISS_KEY = 'morgan-bevy.dismissedUpdateVersion'

type Status = 'idle' | 'checking' | 'downloading' | 'ready' | 'error'

export default function UpdateNotification() {
  const [available, setAvailable] = useState(false)
  const [update, setUpdate] = useState<Update | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | undefined>()
  const [channel, setChannel] = useState<UpdateChannel>(() => readChannel())
  const [dismissed, setDismissed] = useState<string | undefined>()
  const checkedRef = useRef(false)

  useEffect(() => {
    // Initial localStorage probe so the banner respects "dismissed
    // for this version" on the very first render.
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) ?? undefined)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true
    void runCheck(channel, true)
  }, [channel])

  const runCheck = async (target: UpdateChannel, isInitial: boolean) => {
    if (!isInitial) setStatus('checking')
    try {
      const u = await tauriCheck({ allowDowngrades: target === 'prerelease' })
      setAvailable(true)
      setUpdate(u)
      if (u) {
        try {
          setDismissed(localStorage.getItem(DISMISS_KEY) ?? undefined)
        } catch {
          // ignore
        }
      }
    } catch (e) {
      // Plugin unreachable (dev / web) — render nothing.
      setAvailable(false)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const onInstall = async () => {
    if (!update) return
    setStatus('downloading')
    setProgress(0)
    setError(undefined)
    try {
      await update.downloadAndInstall(event => {
        const e = event as unknown as {
          event?: string
          downloadedBytes?: number
          contentLength?: number
        }
        if (e.event === 'progress' && e.contentLength && typeof e.downloadedBytes === 'number') {
          setProgress(Math.min(1, e.downloadedBytes / e.contentLength))
        }
      })
      setStatus('ready')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const onDismiss = () => {
    if (!update) return
    try {
      localStorage.setItem(DISMISS_KEY, update.version)
    } catch {
      // best-effort
    }
    setDismissed(update.version)
    setUpdate(null)
  }

  const onChannelToggle = () => {
    const next: UpdateChannel = channel === 'stable' ? 'prerelease' : 'stable'
    setChannel(next)
    writeChannel(next)
    void runCheck(next, false)
  }

  if (!available || !update) return null
  if (dismissed === update.version) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-editor-accent bg-editor-panel shadow-lg p-4 text-sm"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className="w-5 h-5 mt-0.5 text-editor-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium">Update available</div>
          <div className="text-xs text-editor-textMuted">
            {update.currentVersion} → {update.version}
          </div>
          {update.body && (
            <pre className="mt-2 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
              {update.body}
            </pre>
          )}
          {status === 'downloading' && (
            <div className="mt-2">
              <div className="h-1 bg-editor-border rounded overflow-hidden">
                <div
                  className="h-full bg-editor-accent transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <div className="text-xs text-editor-textMuted mt-1">
                Downloading… {Math.round(progress * 100)}%
              </div>
            </div>
          )}
          {status === 'ready' && (
            <div className="text-xs text-editor-textMuted mt-2">Restart required to apply.</div>
          )}
          {status === 'error' && error && <div className="text-xs text-red-400 mt-1">{error}</div>}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {(status === 'idle' || status === 'checking') && (
              <button
                className="px-2 py-1 text-xs bg-editor-accent text-white rounded hover:bg-editor-accent/80 disabled:opacity-50"
                onClick={onInstall}
                disabled={status === 'checking'}
              >
                Install
              </button>
            )}
            {status === 'downloading' && (
              <button
                className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded"
                disabled
              >
                Downloading…
              </button>
            )}
            {status === 'ready' && (
              <button
                className="px-2 py-1 text-xs bg-editor-accent text-white rounded hover:bg-editor-accent/80"
                onClick={() => {
                  // The plugin's `install()` triggers the OS-level
                  // restart. The frontend cannot directly call
                  // `window.location.reload()` until that hook fires,
                  // so we rely on the runtime.
                  void (
                    window as unknown as {
                      __TAURI__?: { core?: { invoke?: (cmd: string) => void } }
                    }
                  ).__TAURI__?.core?.invoke?.('plugin:updater|install')
                }}
              >
                Restart to update
              </button>
            )}
            <button
              className="px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded"
              onClick={onChannelToggle}
              title={`Update channel is "${channel}". Click to toggle.`}
            >
              {channel === 'stable' ? 'Try prerelease' : 'Use stable'}
            </button>
            {(status === 'idle' || status === 'error') && (
              <button
                className="ml-auto p-1 text-editor-textMuted hover:text-editor-text"
                onClick={onDismiss}
                title="Dismiss this update notification"
                aria-label="Dismiss update notification"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
