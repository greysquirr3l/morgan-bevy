// T34 — Broken Links panel.
//
// The editor already records every asset a project references
// (T20: `collectAssetRefs` walks `SceneObject.material.texture`),
// and on project load the diff against the live asset database is
// computed and stored on `missingAssetRefs` (see
// `src/utils/projectAssets.ts` + `FileMenu.applyProjectDataToStore`).
//
// What was missing was the user-facing surface. `BrokenLinksPanel`
// reads the existing state slice, renders the list, and offers
// three affordances: dismiss an individual entry, dismiss all, and
// (when a thumbnail pipeline exists) re-scan the database to refresh.
//
// The dismiss actions are intentionally non-destructive — they
// don't delete the missing file (it's already not on disk), they
// just clear the in-memory warning. A future "Find / Re-link" button
// would let the user point at a replacement; v1 ships the warning
// surface, not the recovery flow.

import { AlertTriangle, X } from 'lucide-react'

import { useEditorStore } from '@/store/editorStore'
import { AssetId } from '@/types/brand'

export interface BrokenLinksPanelProps {
  /** Override the store-derived state in tests; defaults to the
   *  live editor store. */
  missingRefs?: AssetId[]
  /** Override the dismiss action in tests. */
  onDismiss?: (ref: AssetId) => void
  /** Override the dismiss-all action in tests. */
  onDismissAll?: () => void
}

export default function BrokenLinksPanel(props: BrokenLinksPanelProps) {
  const storeMissing = useEditorStore(s => s.missingAssetRefs)
  const storeDismiss = useEditorStore(s => s.setMissingAssetRefs)

  const missing = props.missingRefs ?? storeMissing
  const dismiss = (ref: AssetId) =>
    props.onDismiss
      ? props.onDismiss(ref)
      : storeDismiss(missing.filter(r => r !== ref))
  const dismissAll = () =>
    props.onDismissAll ? props.onDismissAll() : storeDismiss([])

  if (missing.length === 0) return null

  return (
    <div
      data-testid="broken-links-panel"
      className="border-t border-editor-border bg-red-950/30 px-3 py-2 text-xs"
    >
      <div className="flex items-center justify-between gap-2 pb-1">
        <span className="inline-flex items-center gap-1 text-red-400 font-medium">
          <AlertTriangle className="w-3 h-3" />
          Broken Links ({missing.length})
        </span>
        <button
          type="button"
          className="text-red-400 hover:text-red-300 underline-offset-2 hover:underline"
          onClick={dismissAll}
        >
          Dismiss all
        </button>
      </div>
      <ul className="space-y-1 max-h-32 overflow-y-auto">
        {missing.map(ref => (
          <li
            key={ref}
            data-testid="broken-link-row"
            className="flex items-center justify-between gap-2 rounded bg-red-900/40 px-2 py-1 font-mono"
          >
            <span className="truncate" title={ref}>
              {ref}
            </span>
            <button
              type="button"
              aria-label={`Dismiss ${ref}`}
              className="text-red-300 hover:text-white"
              onClick={() => dismiss(ref)}
            >
              <X className="w-3 h-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}