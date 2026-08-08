// T71 — First-launch analytics consent dialog.
//
// Shown once on first launch. The user can either accept (opt
// in) or decline (opt out, the default). Either way, the
// consent flag is set so the dialog doesn't re-appear on
// subsequent launches. Settings can be changed later from the
// Settings panel.
//
// `setAnalyticsSettings` only writes — the module's `recordEvent`
// reads the setting on every call so toggling here takes effect
// immediately. No subscribe / refresh needed.

import { useState } from 'react'

import { getAnalyticsSettings, markConsentSeen, setAnalyticsSettings } from '@/utils/analytics'

export interface AnalyticsConsentDialogProps {
  /** Override the consent-seen flag for tests (true = show the dialog). */
  shouldShow?: boolean
  /** Override the dismiss action for tests. */
  onDismiss?: () => void
}

export default function AnalyticsConsentDialog(props: AnalyticsConsentDialogProps) {
  const [decided, setDecided] = useState(false)
  const settings = getAnalyticsSettings()
  // The parent decides whether to render this. If we got here,
  // show the dialog.
  if (props.shouldShow === false) return null

  const accept = () => {
    setAnalyticsSettings({ ...settings, enabled: true })
    markConsentSeen()
    setDecided(true)
    props.onDismiss?.()
  }

  const decline = () => {
    setAnalyticsSettings({ ...settings, enabled: false })
    markConsentSeen()
    setDecided(true)
    props.onDismiss?.()
  }

  if (decided) return null

  return (
    <div
      data-testid="analytics-consent-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div className="bg-editor-panel border border-editor-border rounded-md p-6 max-w-md shadow-lg">
        <h2 className="text-sm font-medium mb-2">Help improve Morgan-Bevy?</h2>
        <p className="text-xs text-editor-textMuted mb-4">
          We'd like to collect which features you use and a few performance timings (e.g. how long
          the BSP generator takes) so we can focus on what's slow. We do not collect scene contents,
          file paths, or object names. You can change this any time in Settings.
        </p>
        <ul className="text-[11px] text-editor-textMuted list-disc pl-5 mb-4 space-y-1">
          <li>What's collected: feature-action ids + coarse timings</li>
          <li>What's not: scene contents, file paths, names, anything personal</li>
          <li>
            Where it goes: localStorage by default (<code>local-only</code>)
          </li>
          <li>GDPR: export or delete from Settings any time</li>
        </ul>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={decline}
            className="px-3 py-1 text-xs text-editor-textMuted hover:text-editor-text border border-editor-border rounded"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="px-3 py-1 text-xs bg-editor-accent hover:bg-blue-600 text-white rounded"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
