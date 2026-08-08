// T91c — Inspector panel for AudioMarker.
//
// Ambient / OneShot. Both share `path` and `volume`; Ambient adds
// `looping`. Switching `kind` carries those two shared fields and
// fills the variant-specific field from the default.

import { Plus } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { ObjectId } from '@/types/brand'
import {
  AUDIO_MARKER_KINDS,
  defaultAudioMarker,
  type AudioMarker,
  type AudioMarkerKind,
} from '@/types/markers'
import {
  BooleanField,
  NumberField,
  PanelActions,
  PanelSection,
  StringField,
} from './MarkerFields'

const VARIANT_LABELS: Record<AudioMarkerKind, string> = {
  [AUDIO_MARKER_KINDS.ambient]: 'Ambient (loop)',
  [AUDIO_MARKER_KINDS.one_shot]: 'One shot',
}

export interface AudioMarkerPanelProps {
  marker: AudioMarker | undefined
  onUpdate: (next: AudioMarker | undefined) => void
}

export default function AudioMarkerPanel({ marker, onUpdate }: AudioMarkerPanelProps) {
  if (!marker) {
    return (
      <PanelSection title="Audio">
        <button
          type="button"
          onClick={() => onUpdate(defaultAudioMarker(AUDIO_MARKER_KINDS.ambient))}
          className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:border-editor-accent inline-flex items-center justify-center gap-1"
        >
          <Plus size={12} />
          Add Audio
        </button>
      </PanelSection>
    )
  }

  return (
    <PanelSection title="Audio">
      <div>
        <label className="block text-xs text-editor-textMuted mb-1">Variant</label>
        <select
          value={marker.kind}
          onChange={e => {
            const nextKind = e.target.value as AudioMarkerKind
            // shared fields: path, volume. `looping` is Ambient-only
            // and comes from the default.
            if (nextKind === AUDIO_MARKER_KINDS.ambient) {
              const defaults = defaultAudioMarker(AUDIO_MARKER_KINDS.ambient)
              if (defaults.kind === AUDIO_MARKER_KINDS.ambient) {
                onUpdate({
                  kind: AUDIO_MARKER_KINDS.ambient,
                  path: marker.path,
                  volume: marker.volume,
                  looping: defaults.looping,
                })
              }
            } else {
              onUpdate({
                kind: AUDIO_MARKER_KINDS.one_shot,
                path: marker.path,
                volume: marker.volume,
              })
            }
          }}
          className="w-full px-2 py-1 text-sm bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
        >
          {Object.values(AUDIO_MARKER_KINDS).map(k => (
            <option key={k} value={k}>
              {VARIANT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {marker.kind === AUDIO_MARKER_KINDS.ambient && (
        <>
          <StringField
            label="Path"
            value={marker.path}
            onChange={next => onUpdate({ ...marker, path: next })}
            placeholder="fountain.ogg"
          />
          <NumberField
            label="Volume"
            value={marker.volume}
            onChange={next => onUpdate({ ...marker, volume: next })}
            step={0.05}
            min={0}
            max={1}
          />
          <BooleanField
            label="Looping"
            value={marker.looping}
            onChange={next => onUpdate({ ...marker, looping: next })}
          />
        </>
      )}

      {marker.kind === AUDIO_MARKER_KINDS.one_shot && (
        <>
          <StringField
            label="Path"
            value={marker.path}
            onChange={next => onUpdate({ ...marker, path: next })}
            placeholder="clang.ogg"
          />
          <NumberField
            label="Volume"
            value={marker.volume}
            onChange={next => onUpdate({ ...marker, volume: next })}
            step={0.05}
            min={0}
            max={1}
          />
        </>
      )}

      <PanelActions onRemove={() => onUpdate(undefined)} removeLabel="Remove Audio" />
    </PanelSection>
  )
}

export interface AudioMarkerPanelConnectedProps {
  objectId: ObjectId
}

export function ConnectedAudioMarkerPanel({ objectId }: AudioMarkerPanelConnectedProps) {
  const marker = useEditorStore(s => s.sceneObjects.get(objectId)?.audio)
  const update = useEditorStore(s => s.updateObjectAudio)
  return (
    <AudioMarkerPanel marker={marker} onUpdate={next => update(objectId, next)} />
  )
}
