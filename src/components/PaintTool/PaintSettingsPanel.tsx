// T54 — Paint tool settings panel. Rendered as a floating overlay
// in `Viewport3D.tsx` (outside `<Canvas>`, same tier as the
// existing "Camera Mode Controls" / "Performance Controls"
// overlays) — visible only while the paint tool is active (P).
import { useEditorStore } from '@/store/editorStore'
import { MaterialId } from '@/types/brand'
import { listMaterialPresets } from '@/utils/materialPresets'
import { BRUSH_FALLOFFS } from '@/utils/paintTool'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import UVEditor from './UVEditor'

export default function PaintSettingsPanel() {
  const {
    paintToolActive,
    paintBrushRadius,
    paintBrushFalloff,
    paintTargetMaterialId,
    setPaintToolActive,
    setPaintBrushRadius,
    setPaintBrushFalloff,
    setPaintTargetMaterialId,
    selectedObjects,
  } = useEditorStore(
    useShallow(s => ({
      paintToolActive: s.paintToolActive,
      paintBrushRadius: s.paintBrushRadius,
      paintBrushFalloff: s.paintBrushFalloff,
      paintTargetMaterialId: s.paintTargetMaterialId,
      setPaintToolActive: s.setPaintToolActive,
      setPaintBrushRadius: s.setPaintBrushRadius,
      setPaintBrushFalloff: s.setPaintBrushFalloff,
      setPaintTargetMaterialId: s.setPaintTargetMaterialId,
      selectedObjects: s.selectedObjects,
    }))
  )

  const [showUVEditor, setShowUVEditor] = useState(false)

  if (!paintToolActive) return null

  // Cheap to recompute per-render (small array, panel only mounts
  // while the tool is active) — avoids a stale preset list if the
  // user saves a new one via the Material panel while painting.
  const presets = listMaterialPresets()
  const primarySelected = selectedObjects[0]

  return (
    <div
      className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-black bg-opacity-70 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2 flex items-center gap-3 shadow-lg"
      data-testid="paint-settings-panel"
    >
      <span className="font-medium">Paint Tool</span>

      <label className="flex items-center gap-1">
        Radius
        <input
          type="range"
          min={0.1}
          max={10}
          step={0.1}
          value={paintBrushRadius}
          onChange={event => setPaintBrushRadius(parseFloat(event.target.value))}
          aria-label="Brush radius"
        />
        <span className="w-8 text-right tabular-nums">{paintBrushRadius.toFixed(1)}</span>
      </label>

      <div className="flex items-center gap-1" role="group" aria-label="Brush falloff">
        {BRUSH_FALLOFFS.map(falloff => (
          <button
            key={falloff}
            onClick={() => setPaintBrushFalloff(falloff)}
            aria-pressed={paintBrushFalloff === falloff}
            className={`px-2 py-0.5 rounded capitalize ${
              paintBrushFalloff === falloff
                ? 'bg-editor-accent text-white'
                : 'bg-white bg-opacity-10 hover:bg-opacity-20'
            }`}
          >
            {falloff}
          </button>
        ))}
      </div>

      <select
        value={paintTargetMaterialId ?? ''}
        onChange={event =>
          setPaintTargetMaterialId(event.target.value ? MaterialId(event.target.value) : null)
        }
        aria-label="Target material"
        className="bg-editor-bg border border-editor-border rounded px-1 py-0.5"
      >
        <option value="">Select material…</option>
        {presets.map(preset => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>

      <button
        disabled={!primarySelected}
        onClick={() => setShowUVEditor(true)}
        className="px-2 py-0.5 rounded bg-white bg-opacity-10 hover:bg-opacity-20 disabled:opacity-40"
        title="Edit UVs for the selected object"
      >
        UV Editor
      </button>

      <button
        onClick={() => setPaintToolActive(false)}
        className="px-2 py-0.5 rounded bg-white bg-opacity-10 hover:bg-opacity-20"
        title="Exit paint tool (P)"
      >
        Done
      </button>

      {showUVEditor && primarySelected && (
        <UVEditor objectId={primarySelected} onClose={() => setShowUVEditor(false)} />
      )}
    </div>
  )
}
