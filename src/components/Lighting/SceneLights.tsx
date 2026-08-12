/**
 * SceneLights (audit Critical #7 regression).
 *
 * Renders the editor's lighting rig (`state.lights`) into the R3F
 * scene as the corresponding Three.js light class. Before this
 * existed, `Viewport3D.tsx` hardcoded three lights
 * (`<ambientLight>`, `<directionalLight>`, `<pointLight>`) and never
 * looked at the store — so "Auto-Light" or any manual edit in
 * `LightingTools` changed state but the viewport kept showing the
 * original three lights. Cranking ambient intensity to 20 confirmed
 * the bug live (visually unchanged).
 *
 * The component keeps a default rig when `state.lights` is empty so
 * a brand-new scene isn't pitch-black, mirroring the previous
 * hardcoded values (`0.4` ambient + a single directional sun + a
 * low-intensity fill point light). Once the user places their first
 * light or runs Auto-Light, those defaults are replaced by whatever
 * the rig contains.
 */
import { useEditorStore } from '@/store/editorStore'
import type { LightSource, ShadowQuality } from '@/utils/lighting'

/** Three.js shadow-map type for `shadow-mapSize-width` / `-height`. */
const SHADOW_MAP_SIZE: Record<ShadowQuality, number> = {
  off: 0,
  hard: 1024,
  soft: 2048,
  ultra: 4096,
}

/** Three.js shadow-renderer type for `shadow-camera-*` precision. */
const SHADOW_CAMERA_FAR = 50
const SHADOW_CAMERA_HALF = 10

/** Default rig when the store has no lights yet. Mirrors the
 *  pre-fix hardcoded values so a brand-new scene still has a sun
 *  and a tiny fill light. */
const DEFAULT_RIG: LightSource[] = [
  {
    id: 'default-ambient',
    kind: 'ambient',
    position: [0, 0, 0],
    color: [1, 1, 1],
    intensity: 0.4,
    castShadow: false,
    shadowQuality: 'off',
  },
  {
    id: 'default-directional',
    kind: 'directional',
    position: [10, 10, 5],
    color: [1, 1, 1],
    intensity: 1.2,
    castShadow: true,
    shadowQuality: 'soft',
  },
  {
    id: 'default-fill-point',
    kind: 'point',
    position: [-10, -10, -10],
    color: [1, 1, 1],
    intensity: 0.2,
    castShadow: false,
    shadowQuality: 'off',
  },
]

export default function SceneLights() {
  const lights = useEditorStore(s => s.lights)
  const rig = lights.length > 0 ? lights : DEFAULT_RIG

  return (
    <>
      {rig.map(light => {
        const mapSize = SHADOW_MAP_SIZE[light.shadowQuality]
        const shadowEnabled = light.castShadow && mapSize > 0
        const baseColor = rgbToCss(light.color)
        switch (light.kind) {
          case 'ambient':
            return <ambientLight key={light.id} intensity={light.intensity} color={baseColor} />
          case 'directional':
            return (
              <directionalLight
                key={light.id}
                position={light.position}
                intensity={light.intensity}
                color={baseColor}
                castShadow={shadowEnabled}
                shadow-mapSize-width={mapSize}
                shadow-mapSize-height={mapSize}
                shadow-camera-far={SHADOW_CAMERA_FAR}
                shadow-camera-left={-SHADOW_CAMERA_HALF}
                shadow-camera-right={SHADOW_CAMERA_HALF}
                shadow-camera-top={SHADOW_CAMERA_HALF}
                shadow-camera-bottom={-SHADOW_CAMERA_HALF}
              />
            )
          case 'point':
            return (
              <pointLight
                key={light.id}
                position={light.position}
                intensity={light.intensity}
                color={baseColor}
                castShadow={shadowEnabled}
                shadow-mapSize-width={mapSize}
                shadow-mapSize-height={mapSize}
              />
            )
          case 'spot':
            return (
              <spotLight
                key={light.id}
                position={light.position}
                intensity={light.intensity}
                color={baseColor}
                angle={light.angle ?? Math.PI / 6}
                castShadow={shadowEnabled}
                shadow-mapSize-width={mapSize}
                shadow-mapSize-height={mapSize}
              />
            )
        }
      })}
    </>
  )
}

function rgbToCss([r, g, b]: [number, number, number]): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n * 255)))
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`
}
