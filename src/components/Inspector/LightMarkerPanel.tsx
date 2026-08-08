// T91c — Inspector panel for LightMarker.
//
// Renders the panel only when a single object is selected (the parent
// Inspector gates this). Behaviour:
//
//   - No marker present → "Add Light" affordance.
//   - Marker present → variant selector + fields for that variant +
//     "Remove" affordance.
//
// Switching `kind` builds a fresh variant-from-default and carries
// over the fields the two variants actually share, so the new
// variant always passes the zod schema (T91a). The panel tests
// pin this contract by parsing the resulting store value with the
// schema.

import { Plus } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { ObjectId } from '@/types/brand'
import {
  LIGHT_MARKER_KINDS,
  defaultLightMarker,
  type LightMarker,
  type LightMarkerKind,
} from '@/types/markers'
import {
  BooleanField,
  NumberField,
  PanelActions,
  PanelSection,
  Vec3Field,
} from './MarkerFields'

const VARIANT_LABELS: Record<LightMarkerKind, string> = {
  [LIGHT_MARKER_KINDS.point]: 'Point',
  [LIGHT_MARKER_KINDS.spot]: 'Spot',
  [LIGHT_MARKER_KINDS.directional]: 'Directional',
}

export interface LightMarkerPanelProps {
  /** Current marker (or `undefined` if the object has no light). */
  marker: LightMarker | undefined
  /** Read from the store with a narrow selector; the parent may
   *  pass the action in to keep the panel decoupled. */
  onUpdate: (next: LightMarker | undefined) => void
}

export default function LightMarkerPanel({ marker, onUpdate }: LightMarkerPanelProps) {
  if (!marker) {
    return (
      <PanelSection title="Light">
        <button
          type="button"
          onClick={() => onUpdate(defaultLightMarker(LIGHT_MARKER_KINDS.point))}
          className="w-full px-2 py-1 text-xs bg-editor-bg border border-editor-border rounded hover:border-editor-accent inline-flex items-center justify-center gap-1"
        >
          <Plus size={12} />
          Add Light
        </button>
      </PanelSection>
    )
  }

  return (
    <PanelSection title="Light">
      <div>
        <label className="block text-xs text-editor-textMuted mb-1">Variant</label>
        <select
          value={marker.kind}
          onChange={e => {
            const nextKind = e.target.value as LightMarkerKind
            // Extract the shared fields (color, intensity, shadows,
            // and range when the source is point/spot) from the
            // current variant, then build the new variant. The
            // variant-specific fields (inner_angle, outer_angle)
            // come from the default so the new variant is always
            // schema-valid.
            const cur = marker
            const sharedColor: [number, number, number] = [cur.color[0], cur.color[1], cur.color[2]]
            const sharedIntensity = cur.intensity
            const sharedShadows = cur.shadows
            const sharedRange = cur.kind === LIGHT_MARKER_KINDS.directional ? 10 : cur.range

            if (nextKind === LIGHT_MARKER_KINDS.point) {
              onUpdate({
                kind: LIGHT_MARKER_KINDS.point,
                color: sharedColor,
                intensity: sharedIntensity,
                range: sharedRange,
                shadows: sharedShadows,
              })
            } else if (nextKind === LIGHT_MARKER_KINDS.spot) {
              // The kind is narrowed to `spot` here, so the default
              // factory's returned variant is also narrowed to its
              // Spot variant — both `inner_angle` and `outer_angle`
              // are guaranteed to exist.
              const defaults = defaultLightMarker(LIGHT_MARKER_KINDS.spot)
              if (defaults.kind === LIGHT_MARKER_KINDS.spot) {
                onUpdate({
                  kind: LIGHT_MARKER_KINDS.spot,
                  color: sharedColor,
                  intensity: sharedIntensity,
                  range: sharedRange,
                  inner_angle: defaults.inner_angle,
                  outer_angle: defaults.outer_angle,
                  shadows: sharedShadows,
                })
              }
            } else {
              onUpdate({
                kind: LIGHT_MARKER_KINDS.directional,
                color: sharedColor,
                intensity: sharedIntensity,
                shadows: sharedShadows,
              })
            }
          }}
          className="w-full px-2 py-1 text-sm bg-editor-bg border border-editor-border rounded focus:outline-none focus:border-editor-accent"
        >
          {Object.values(LIGHT_MARKER_KINDS).map(k => (
            <option key={k} value={k}>
              {VARIANT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {/* Variant-specific fields. Switching `kind` is impossible here
          (the select above owns it), so switch is exhaustive. */}
      {marker.kind === LIGHT_MARKER_KINDS.point && (
        <>
          <Vec3Field
            label="Color"
            value={[marker.color[0], marker.color[1], marker.color[2]]}
            onChange={next => onUpdate({ ...marker, color: next })}
          />
          <NumberField
            label="Intensity"
            value={marker.intensity}
            onChange={next => onUpdate({ ...marker, intensity: next })}
            step={10}
            min={0}
          />
          <NumberField
            label="Range"
            value={marker.range}
            onChange={next => onUpdate({ ...marker, range: next })}
            step={0.1}
            min={0}
          />
          <BooleanField
            label="Shadows"
            value={marker.shadows}
            onChange={next => onUpdate({ ...marker, shadows: next })}
          />
        </>
      )}

      {marker.kind === LIGHT_MARKER_KINDS.spot && (
        <>
          <Vec3Field
            label="Color"
            value={[marker.color[0], marker.color[1], marker.color[2]]}
            onChange={next => onUpdate({ ...marker, color: next })}
          />
          <NumberField
            label="Intensity"
            value={marker.intensity}
            onChange={next => onUpdate({ ...marker, intensity: next })}
            step={10}
            min={0}
          />
          <NumberField
            label="Range"
            value={marker.range}
            onChange={next => onUpdate({ ...marker, range: next })}
            step={0.1}
            min={0}
          />
          <NumberField
            label="Inner angle (rad)"
            value={marker.inner_angle}
            onChange={next => onUpdate({ ...marker, inner_angle: next })}
            step={0.05}
            min={0}
          />
          <NumberField
            label="Outer angle (rad)"
            value={marker.outer_angle}
            onChange={next => onUpdate({ ...marker, outer_angle: next })}
            step={0.05}
            min={0}
          />
          <BooleanField
            label="Shadows"
            value={marker.shadows}
            onChange={next => onUpdate({ ...marker, shadows: next })}
          />
        </>
      )}

      {marker.kind === LIGHT_MARKER_KINDS.directional && (
        <>
          <Vec3Field
            label="Color"
            value={[marker.color[0], marker.color[1], marker.color[2]]}
            onChange={next => onUpdate({ ...marker, color: next })}
          />
          <NumberField
            label="Intensity"
            value={marker.intensity}
            onChange={next => onUpdate({ ...marker, intensity: next })}
            step={0.1}
            min={0}
          />
          <BooleanField
            label="Shadows"
            value={marker.shadows}
            onChange={next => onUpdate({ ...marker, shadows: next })}
          />
        </>
      )}

      <PanelActions onRemove={() => onUpdate(undefined)} removeLabel="Remove Light" />
    </PanelSection>
  )
}

// ─── Glue helper ─────────────────────────────────────────────────────────────
//
// A thin wrapper that pulls the right slice from the store and wires
// the panel to the T91b action. The Inspector imports this so the
// panel itself stays decoupled from the store and is testable with
// a plain `marker`/`onUpdate` pair.

export interface LightMarkerPanelConnectedProps {
  objectId: ObjectId
}

export function ConnectedLightMarkerPanel({ objectId }: LightMarkerPanelConnectedProps) {
  const marker = useEditorStore(s => s.sceneObjects.get(objectId)?.light)
  const update = useEditorStore(s => s.updateObjectLight)
  return <LightMarkerPanel marker={marker} onUpdate={next => update(objectId, next)} />
}
