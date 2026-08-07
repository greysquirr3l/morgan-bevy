/**
 * Lighting tools UI (T55).
 *
 * Lightweight toolbar that:
 *  - lists the scene's lights with kind / intensity / shadow controls,
 *  - exposes a "Place Light" button that drops a point light at the
 *    world origin,
 *  - exposes a "Auto-Light" theme dropdown that calls
 *    `autoLightPlacement` and writes the result into the store.
 *
 * The full in-viewport click-to-place workflow is a follow-up; this
 * initial version is enough to drive the export pipeline and the
 * theme auto-lighting contract documented in T55.
 */
import { ChevronRight, Lightbulb, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import {
  autoLightPlacement,
  computePointLightGrid,
  type SceneBounds,
} from '@/utils/autoLightPlacement'
import { defaultLight, type LightKind, type ShadowQuality } from '@/utils/lighting'
import { getTheme, THEME_LIST, type ThemeId } from '@/utils/lightThemes'

export default function LightingTools() {
  const lights = useEditorStore(s => s.lights)
  const setLights = useEditorStore(s => s.setLights)
  const addLight = useEditorStore(s => s.addLight)
  const removeLight = useEditorStore(s => s.removeLight)
  const updateLight = useEditorStore(s => s.updateLight)
  const sceneObjects = useEditorStore(s => s.sceneObjects)

  const [isExpanded, setIsExpanded] = useState(false)
  const [themeId, setThemeId] = useState<ThemeId>('office')

  // Derive the scene's bounding box from the sceneObjects Map.
  // Falls back to a small default box for an empty scene so the
  // auto-lighting rig is still useful for first-time users.
  const bounds = deriveBounds(sceneObjects) ?? { min: [-5, 0, -5], max: [5, 4, 5] }

  const placeLightAtOrigin = (kind: LightKind = 'point') => {
    const light = defaultLight(kind, `light-${Date.now().toString(36)}`)
    light.name = `${kind[0]!.toUpperCase()}${kind.slice(1)} ${lights.length + 1}`
    addLight(light)
  }

  const applyAutoLight = () => {
    const theme = getTheme(themeId)
    const rig = autoLightPlacement(bounds, theme, `auto-${themeId}`)
    setLights(rig)
  }

  const gridPreviewCount = computePointLightGrid(bounds).length

  return (
    <div className="border-b border-editor-border">
      <div
        className="p-2 bg-editor-panel flex items-center cursor-pointer hover:bg-editor-border"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <span className="text-xs">▼</span>
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <Lightbulb className="w-3 h-3 ml-2 text-yellow-400" />
        <span className="ml-2 text-sm font-medium">Lighting</span>
        <span className="ml-auto text-xs text-editor-textMuted">
          {lights.length} light{lights.length === 1 ? '' : 's'}
        </span>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-3 bg-editor-bg">
          {/* Theme + auto-placement */}
          <div className="space-y-2">
            <label className="block text-xs text-editor-textMuted">
              Theme
            </label>
            <div className="flex items-center gap-2">
              <select
                className="flex-1 px-2 py-1 text-xs bg-editor-panel border border-editor-border rounded focus:outline-none focus:border-editor-accent"
                value={themeId}
                onChange={e => setThemeId(e.target.value as ThemeId)}
              >
                {THEME_LIST.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                className="px-2 py-1 text-xs bg-editor-accent text-white rounded hover:bg-editor-accent/80"
                onClick={applyAutoLight}
                title={`Replace the scene lighting with the ${themeId} auto-placement rig`}
              >
                Auto-Light
              </button>
            </div>
            <div className="text-xs text-editor-textMuted">
              Auto-lighting will place ~{gridPreviewCount} point lights
              across the floor in a {bounds.max[0] - bounds.min[0]}×
              {bounds.max[2] - bounds.min[2]} unit grid.
            </div>
          </div>

          {/* Manual placement */}
          <div className="flex items-center gap-2">
            <button
              className="flex-1 px-2 py-1 text-xs bg-editor-panel border border-editor-border rounded hover:border-editor-accent flex items-center justify-center gap-1"
              onClick={() => placeLightAtOrigin('point')}
              title="Drop a point light at the world origin"
            >
              <Plus className="w-3 h-3" />
              Point Light
            </button>
            <button
              className="flex-1 px-2 py-1 text-xs bg-editor-panel border border-editor-border rounded hover:border-editor-accent flex items-center justify-center gap-1"
              onClick={() => placeLightAtOrigin('spot')}
              title="Drop a spot light at the world origin"
            >
              <Plus className="w-3 h-3" />
              Spot Light
            </button>
          </div>

          {/* Light list */}
          <div className="space-y-1">
            <h4 className="text-xs font-medium uppercase tracking-wider text-editor-textMuted">
              Scene Lights
            </h4>
            {lights.length === 0 ? (
              <div className="text-xs text-editor-textMuted italic">
                No lights yet. Click Auto-Light or place one manually.
              </div>
            ) : (
              <ul className="space-y-1">
                {lights.map(light => (
                  <li
                    key={light.id}
                    className="flex items-center gap-2 px-2 py-1 bg-editor-panel border border-editor-border rounded text-xs"
                  >
                    <select
                      className="bg-transparent text-xs focus:outline-none"
                      value={light.kind}
                      onChange={e =>
                        updateLight(light.id, {
                          kind: e.target.value as LightKind,
                        })
                      }
                    >
                      <option value="ambient">Ambient</option>
                      <option value="directional">Directional</option>
                      <option value="point">Point</option>
                      <option value="spot">Spot</option>
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="20"
                      className="w-16 px-1 py-0.5 bg-editor-bg border border-editor-border rounded text-xs"
                      value={light.intensity}
                      onChange={e =>
                        updateLight(light.id, {
                          intensity: Number.parseFloat(e.target.value) || 0,
                        })
                      }
                      aria-label="Intensity"
                    />
                    <select
                      className="bg-transparent text-xs focus:outline-none"
                      value={light.shadowQuality}
                      onChange={e =>
                        updateLight(light.id, {
                          shadowQuality: e.target.value as ShadowQuality,
                          castShadow: e.target.value !== 'off',
                        })
                      }
                    >
                      <option value="off">No Shadow</option>
                      <option value="hard">Hard</option>
                      <option value="soft">Soft</option>
                      <option value="ultra">Ultra</option>
                    </select>
                    <button
                      className="ml-auto p-1 text-red-500 hover:text-red-400"
                      onClick={() => removeLight(light.id)}
                      title="Remove this light"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function deriveBounds(
  sceneObjects: Map<
string,
    {
      position: [number, number, number]
    }
>,
): SceneBounds | null {
  if (sceneObjects.size === 0) return null
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const obj of sceneObjects.values()) {
    const [x, y, z] = obj.position
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  }
}