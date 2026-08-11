/**
 * SettingsModal — application settings entry point.
 *
 * Companion to HelpModal / KeyboardShortcutsModal (same fixed-overlay
 * shell, opened from a menu, closes on Esc or backdrop click). Houses
 * the settings panels under `src/components/Settings/` — currently
 * just `AnalyticsPanel`, but future settings sections should be added
 * here rather than growing a second entry point.
 */
import { X } from 'lucide-react'
import { useEffect } from 'react'

import AnalyticsPanel from './AnalyticsPanel'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="bg-editor-panel border border-editor-border rounded-lg shadow-2xl max-w-md w-full mx-4 flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-editor-border px-6 py-4">
          <h2 id="settings-modal-title" className="text-lg font-semibold">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1 rounded hover:bg-editor-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-2 flex-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-editor-accent">
            Privacy &amp; Analytics
          </h3>
          <AnalyticsPanel />
        </div>

        {/* Footer */}
        <div className="border-t border-editor-border px-6 py-3 text-xs text-editor-textMuted">
          Press{' '}
          <kbd className="px-1.5 py-0.5 bg-editor-bg rounded border border-editor-border">Esc</kbd>{' '}
          to close.
        </div>
      </div>
    </div>
  )
}
