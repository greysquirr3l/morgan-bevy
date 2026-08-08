// T71 — Analytics settings panel.
//
// Reads / writes the analytics module's settings via the typed
// helpers in `src/utils/analytics.ts`. Three actions:
//   1. Toggle opt-in.
//   2. Edit the endpoint URL (read-only when opt-in is off, so the
//      user doesn't accidentally point the buffer at a real server
//      and then forget they enabled it later).
//   3. Export the buffer as JSON (GDPR data export) or delete it
//      (GDPR right to erasure).
//
// Renders nothing when no Settings row is open — the parent panel
// decides when to mount this.

import { useState } from 'react'

import { useEditorStore } from '@/store/editorStore'
import {
  deleteAnalyticsData,
  exportAnalyticsAsJson,
  getAnalyticsSettings,
  readAnalyticsBuffer,
  setAnalyticsSettings,
  type AnalyticsSettings,
} from '@/utils/analytics'

export interface AnalyticsPanelProps {
  /** Override the settings getter for tests. */
  settingsOverride?: AnalyticsSettings
  /** Override the count getter for tests. */
  countOverride?: number
}

export default function AnalyticsPanel(props: AnalyticsPanelProps) {
  // The store update is just a "set a flag" — the panel reads
  // from the analytics module directly, not from the store, so
  // we don't have to wire a per-event store action. The
  // component re-renders on toggle because `settings.enabled`
  // changes, which forces a re-read of the buffer.
  const setSelectedObjects = useEditorStore(s => s.setSelectedObjects)
  void setSelectedObjects
  const [settings, setLocalSettings] = useState<AnalyticsSettings>(
    props.settingsOverride ?? getAnalyticsSettings()
  )
  const count = props.countOverride ?? readAnalyticsBuffer().events.length

  const update = (patch: Partial<AnalyticsSettings>) => {
    const next = { ...settings, ...patch }
    setLocalSettings(next)
    setAnalyticsSettings(next)
  }

  const handleToggle = (enabled: boolean) => {
    update({ enabled })
  }

  const handleEndpointChange = (endpoint: string) => {
    update({ endpoint })
  }

  const handleExport = () => {
    const json = exportAnalyticsAsJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `morgan-bevy-analytics-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = () => {
    if (!confirm('Delete all stored analytics data and reset settings to defaults?')) {
      return
    }
    deleteAnalyticsData()
    setLocalSettings(getAnalyticsSettings())
  }

  return (
    <div data-testid="analytics-panel" className="space-y-3 text-xs">
      <div>
        <label className="flex items-center gap-2 text-editor-textMuted">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={e => handleToggle(e.target.checked)}
            className="w-3 h-3 rounded border-editor-border bg-editor-bg accent-editor-accent"
          />
          <span>Send usage analytics to help improve Morgan-Bevy</span>
        </label>
        <p className="mt-1 pl-5 text-[10px] text-editor-textMuted">
          Off by default. We collect which features are used and performance timings — never scene
          contents, file paths, or object names. See the{' '}
          <a href="#/analytics-help" className="underline">
            Help
          </a>{' '}
          panel for the full privacy story.
        </p>
      </div>

      <div>
        <label className="block text-editor-textMuted mb-1">Endpoint</label>
        <input
          type="text"
          value={settings.endpoint}
          onChange={e => handleEndpointChange(e.target.value)}
          disabled={!settings.enabled}
          placeholder="local-only"
          className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent disabled:opacity-50"
        />
        <p className="mt-1 text-[10px] text-editor-textMuted">
          Default is <code className="text-editor-text">local-only</code> — events are kept in
          localStorage. A maintainer can switch this to a real URL after a privacy review.
        </p>
      </div>

      <div className="border-t border-editor-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-editor-textMuted">
            Stored events: <span className="font-mono">{count}</span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={count === 0}
              className="px-2 py-1 bg-editor-accent hover:bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Export my data (JSON)
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={count === 0 && !settings.enabled}
              className="px-2 py-1 text-red-400 border border-red-400/40 rounded hover:bg-red-400/10 disabled:opacity-50"
            >
              Delete my data
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
