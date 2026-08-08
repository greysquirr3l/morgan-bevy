// T91c — Inspector panel for VfxMarker.
//
// Particle / Billboard. The two variants share no fields (Particle
// has `path` + `count`, Billboard has `texture` + `size`), so
// switching `kind` is a fresh default rather than a carry-over.
// This is the cleanest schema-valid transition for a fully-
// disjoint variant pair.

import { Plus } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { ObjectId } from '@/types/brand'
import {
  VFX_MARKER_KINDS,
  defaultVfxMarker,
  type VfxMarker,
  type VfxMarkerKind,
} from '@/types/markers'
import { parseFiniteInt } from './MarkerFieldUtils'
import {
  PanelActions,
  PanelSection,
  StringField,
  Vec2Field,
} from './MarkerFields'

const VARIANT_LABELS: Record<VfxMarkerKind, string> = {
  [VFX_MARKER_KINDS.particle]: 'Particle',
  [VFX_MARKER_KINDS.billboard]: 'Billboard',
}

export interface VfxMarkerPanelProps {
  marker: VfxMarker | undefined
  onUpdate: (next: VfxMarker | undefined) => void
}

export default function VfxMarkerPanel({ marker, onUpdate }: VfxMarkerPanelProps) {
  if (!marker) {
    return (
      <PanelSection title="VFX">
        <button
          type="button"
          onClick={() => onUpdate(defaultVfxMarker(VFX_MARKER_KINDS.particle))}
          className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:border-editor-accent inline-flex items-center justify-center gap-1"
        >
          <Plus size={12} />
          Add VFX
        </button>
      </PanelSection>
    )
  }

  return (
    <PanelSection title="VFX">
      <div>
        <label className="block text-xs text-editor-textMuted mb-1">Variant</label>
        <select
          value={marker.kind}
          onChange={e => {
            const nextKind = e.target.value as VfxMarkerKind
            // Particle and Billboard share no fields — switching is
            // a fresh default. Both are always schema-valid.
            onUpdate(defaultVfxMarker(nextKind))
          }}
          className="w-full px-2 py-1 text-sm bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
        >
          {Object.values(VFX_MARKER_KINDS).map(k => (
            <option key={k} value={k}>
              {VARIANT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {marker.kind === VFX_MARKER_KINDS.particle && (
        <>
          <StringField
            label="Path"
            value={marker.path}
            onChange={next => onUpdate({ ...marker, path: next })}
            placeholder="campfire.vfx"
          />
          <div>
            <label className="block text-xs text-editor-textMuted mb-1">Count</label>
            <input
              type="number"
              value={marker.count}
              onChange={e => onUpdate({ ...marker, count: parseFiniteInt(e.target.value, marker.count) })}
              className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
              step={1}
              min={0}
            />
          </div>
        </>
      )}

      {marker.kind === VFX_MARKER_KINDS.billboard && (
        <>
          <StringField
            label="Texture"
            value={marker.texture}
            onChange={next => onUpdate({ ...marker, texture: next })}
            placeholder="smoke.png"
          />
          <Vec2Field
            label="Size"
            value={[marker.size[0], marker.size[1]]}
            onChange={next => onUpdate({ ...marker, size: next })}
            step={0.1}
            min={0}
          />
        </>
      )}

      <PanelActions onRemove={() => onUpdate(undefined)} removeLabel="Remove VFX" />
    </PanelSection>
  )
}

export interface VfxMarkerPanelConnectedProps {
  objectId: ObjectId
}

export function ConnectedVfxMarkerPanel({ objectId }: VfxMarkerPanelConnectedProps) {
  const marker = useEditorStore(s => s.sceneObjects.get(objectId)?.vfx)
  const update = useEditorStore(s => s.updateObjectVfx)
  return <VfxMarkerPanel marker={marker} onUpdate={next => update(objectId, next)} />
}
