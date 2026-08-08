// T51 — Snap Points Inspector panel.
//
// Renders the snap points attached to the currently selected
// object. The drag-snap integration with TransformGizmos is a
// follow-up (T51 v2); this is the data + UI for *managing* the
// points.
//
// Add / remove / edit-label / edit-category per point. The
// default local position is the object's centre (0,0,0); the
// user can move it later by editing the position field. The
// transform-aware snap math lives in `src/utils/snapPoints.ts`.

import { useEditorStore } from '@/store/editorStore'
import { Plus, X } from 'lucide-react'

import {
  DEFAULT_SNAP_POINT_CATEGORY,
  SNAP_POINT_CATEGORIES,
  mintSnapPointId,
  type SnapPoint,
  type SnapPointCategory,
} from '@/types/snapPoints'

export interface SnapPointsPanelProps {
  /** Override the primary object — used by tests. */
  primaryObjectId?: string
}

export default function SnapPointsPanel(props: SnapPointsPanelProps) {
  const primaryObjectId = useEditorStore(s => props.primaryObjectId ?? s.selectedObjects[0])
  const sceneObject = useEditorStore(s =>
    primaryObjectId ? s.sceneObjects.get(primaryObjectId as never) : null
  )

  if (!sceneObject) return null
  const objectId = primaryObjectId as string
  const points: SnapPoint[] = sceneObject.snapPoints ?? []

  const addPoint = () => {
    const id = mintSnapPointId()
    const newPoint: SnapPoint = {
      id,
      objectId,
      localPosition: [0, 0, 0],
      localRotation: [0, 0, 0, 1],
      label: 'New Point',
      category: DEFAULT_SNAP_POINT_CATEGORY,
    }
    useEditorStore.setState(state => {
      const o = state.sceneObjects.get(objectId as never)
      if (!o) return state
      o.snapPoints = [...(o.snapPoints ?? []), newPoint]
      return state
    })
  }

  const updatePoint = (id: string, patch: Partial<SnapPoint>) => {
    useEditorStore.setState(state => {
      const o = state.sceneObjects.get(objectId as never)
      if (!o?.snapPoints) return state
      o.snapPoints = o.snapPoints.map(p => (p.id === id ? { ...p, ...patch } : p))
      return state
    })
  }

  const removePoint = (id: string) => {
    useEditorStore.setState(state => {
      const o = state.sceneObjects.get(objectId as never)
      if (!o?.snapPoints) return state
      o.snapPoints = o.snapPoints.filter(p => p.id !== id)
      // Drop the field entirely if the array is empty.
      if (o.snapPoints.length === 0) delete o.snapPoints
      return state
    })
  }

  return (
    <div data-testid="snap-points-panel" className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-editor-textMuted">
          Snap Points: <span className="font-mono">{points.length}</span>
        </span>
        <button
          type="button"
          onClick={addPoint}
          className="px-2 py-1 bg-editor-accent hover:bg-blue-600 text-white rounded inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {points.length === 0 ? (
        <p className="text-[11px] text-editor-textMuted italic">
          No snap points yet. Add one to start using this object as a snap target for nearby
          objects.
        </p>
      ) : (
        <ul className="space-y-1">
          {points.map(p => (
            <li
              key={p.id}
              data-testid="snap-point-row"
              className="flex items-center gap-1 rounded bg-editor-bg px-2 py-1"
            >
              <input
                type="text"
                value={p.label}
                onChange={e => updatePoint(p.id, { label: e.target.value })}
                className="flex-1 min-w-0 bg-transparent border border-editor-border rounded px-1 py-0.5 text-xs"
                placeholder="label"
                aria-label={`Snap point ${p.id} label`}
              />
              <select
                value={p.category}
                onChange={e => updatePoint(p.id, { category: e.target.value as SnapPointCategory })}
                className="bg-editor-bg border border-editor-border rounded text-xs px-1 py-0.5"
                aria-label={`Snap point ${p.id} category`}
              >
                {SNAP_POINT_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removePoint(p.id)}
                aria-label={`Remove snap point ${p.id}`}
                className="text-red-400 hover:text-red-300"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
