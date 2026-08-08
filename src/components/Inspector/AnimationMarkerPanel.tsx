// T91c — Inspector panel for AnimationMarker.
//
// Same shape as LightMarkerPanel: "Add" affordance when absent,
// variant selector + variant-specific fields when present, "Remove"
// affordance. Switching `kind` carries over `clip` (the only field
// the two variants share) and seeds the Play-only fields from the
// default so the new variant is always schema-valid.

import { Plus } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { ObjectId } from '@/types/brand'
import {
  ANIMATION_MARKER_KINDS,
  defaultAnimationMarker,
  type AnimationMarker,
  type AnimationMarkerKind,
} from '@/types/markers'
import {
  BooleanField,
  NumberField,
  PanelActions,
  PanelSection,
  StringField,
} from './MarkerFields'

const VARIANT_LABELS: Record<AnimationMarkerKind, string> = {
  [ANIMATION_MARKER_KINDS.play]: 'Play (loop)',
  [ANIMATION_MARKER_KINDS.play_once]: 'Play once',
}

export interface AnimationMarkerPanelProps {
  marker: AnimationMarker | undefined
  onUpdate: (next: AnimationMarker | undefined) => void
}

export default function AnimationMarkerPanel({ marker, onUpdate }: AnimationMarkerPanelProps) {
  if (!marker) {
    return (
      <PanelSection title="Animation">
        <button
          type="button"
          onClick={() => onUpdate(defaultAnimationMarker(ANIMATION_MARKER_KINDS.play))}
          className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:border-editor-accent inline-flex items-center justify-center gap-1"
        >
          <Plus size={12} />
          Add Animation
        </button>
      </PanelSection>
    )
  }

  return (
    <PanelSection title="Animation">
      <div>
        <label className="block text-xs text-editor-textMuted mb-1">Variant</label>
        <select
          value={marker.kind}
          onChange={e => {
            const nextKind = e.target.value as AnimationMarkerKind
            // shared field: clip. The Play-only fields (repeat, speed)
            // come from the default — the variant is fresh and schema-valid.
            if (nextKind === ANIMATION_MARKER_KINDS.play) {
              const defaults = defaultAnimationMarker(ANIMATION_MARKER_KINDS.play)
              if (defaults.kind === ANIMATION_MARKER_KINDS.play) {
                onUpdate({
                  kind: ANIMATION_MARKER_KINDS.play,
                  clip: marker.clip,
                  repeat: defaults.repeat,
                  speed: defaults.speed,
                })
              }
            } else {
              onUpdate({
                kind: ANIMATION_MARKER_KINDS.play_once,
                clip: marker.clip,
              })
            }
          }}
          className="w-full px-2 py-1 text-sm bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
        >
          {Object.values(ANIMATION_MARKER_KINDS).map(k => (
            <option key={k} value={k}>
              {VARIANT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {marker.kind === ANIMATION_MARKER_KINDS.play && (
        <>
          <StringField
            label="Clip"
            value={marker.clip}
            onChange={next => onUpdate({ ...marker, clip: next })}
            placeholder="banner.anim"
          />
          <BooleanField
            label="Repeat"
            value={marker.repeat}
            onChange={next => onUpdate({ ...marker, repeat: next })}
          />
          <NumberField
            label="Speed"
            value={marker.speed}
            onChange={next => onUpdate({ ...marker, speed: next })}
            step={0.1}
            min={0}
          />
        </>
      )}

      {marker.kind === ANIMATION_MARKER_KINDS.play_once && (
        <StringField
          label="Clip"
          value={marker.clip}
          onChange={next => onUpdate({ ...marker, clip: next })}
          placeholder="banner.anim"
        />
      )}

      <PanelActions onRemove={() => onUpdate(undefined)} removeLabel="Remove Animation" />
    </PanelSection>
  )
}

export interface AnimationMarkerPanelConnectedProps {
  objectId: ObjectId
}

export function ConnectedAnimationMarkerPanel({ objectId }: AnimationMarkerPanelConnectedProps) {
  const marker = useEditorStore(s => s.sceneObjects.get(objectId)?.animation)
  const update = useEditorStore(s => s.updateObjectAnimation)
  return (
    <AnimationMarkerPanel marker={marker} onUpdate={next => update(objectId, next)} />
  )
}
