/**
 * T91c — Inspector marker panel tests.
 *
 * Contract being pinned:
 *   - Each panel renders its "Add" affordance when no marker.
 *   - Clicking "Add" calls the matching T91b action and the panel
 *     then renders that variant's fields.
 *   - Switching `kind` produces a marker that **passes T91a's zod
 *     schema** — this catches half-populated variants that would
 *     silently fail on the Rust side.
 *   - "Remove" calls the action with `undefined` and the panel
 *     returns to its "Add" state.
 *   - The connected panels pull from the store and re-render after
 *     a write.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// Mock lucide icons — they're decorative, and materialise as
// `<svg>` elements that can't be selected by text. Replace with
// text-only shims.
vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="plus-icon">+</span>,
}))

import { useEditorStore } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'
import {
  defaultAnimationMarker,
  defaultAudioMarker,
  defaultLightMarker,
  defaultVfxMarker,
  ANIMATION_MARKER_KINDS,
  AUDIO_MARKER_KINDS,
  LIGHT_MARKER_KINDS,
  VFX_MARKER_KINDS,
  type AnimationMarker,
  type AudioMarker,
  type LightMarker,
  type VfxMarker,
} from '@/types/markers'
import {
  AnimationMarkerSchema,
  AudioMarkerSchema,
  LightMarkerSchema,
  VfxMarkerSchema,
} from '@/types/schemas'

import { ConnectedLightMarkerPanel } from '@/components/Inspector/LightMarkerPanel'
import { ConnectedAnimationMarkerPanel } from '@/components/Inspector/AnimationMarkerPanel'
import { ConnectedAudioMarkerPanel } from '@/components/Inspector/AudioMarkerPanel'
import { ConnectedVfxMarkerPanel } from '@/components/Inspector/VfxMarkerPanel'

function resetStore(seed?: {
  light?: LightMarker
  animation?: AnimationMarker
  audio?: AudioMarker
  vfx?: VfxMarker
}): ObjectId {
  useEditorStore.setState({
    selectedObjects: [],
    sceneObjects: new Map(),
    layers: [
      { id: LayerId('default'), name: 'Default', visible: true, locked: false, color: '#fff' },
    ],
    activeLayer: LayerId('default'),
  })
  const id = ObjectId('obj_under_test')
  useEditorStore.setState(state => {
    state.sceneObjects.set(id, {
      id,
      name: 'Test',
      type: 'mesh',
      meshType: 'cube',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      layerId: LayerId('default'),
      children: [],
      ...seed,
    })
    return state
  })
  return id
}

// ─── LightMarkerPanel ────────────────────────────────────────────────────────

describe('T91c LightMarkerPanel', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders the "Add Light" affordance when no light marker is present', () => {
    const id = resetStore()
    render(<ConnectedLightMarkerPanel objectId={id} />)
    expect(screen.getByText('Add Light')).toBeInTheDocument()
  })

  it('clicking "Add Light" creates a Point marker via the store action', () => {
    const id = resetStore()
    render(<ConnectedLightMarkerPanel objectId={id} />)
    fireEvent.click(screen.getByText('Add Light'))

    const obj = useEditorStore.getState().sceneObjects.get(id)
    const parsed = LightMarkerSchema.safeParse(obj?.light)
    expect(parsed.success).toBe(true)
    expect(obj?.light?.kind).toBe('point')
  })

  it('renders the variant selector + fields when a marker exists', () => {
    const id = resetStore({ light: defaultLightMarker(LIGHT_MARKER_KINDS.spot) })
    render(<ConnectedLightMarkerPanel objectId={id} />)
    // The variant selector mirrors the kind label.
    expect(screen.getByText('Spot')).toBeInTheDocument()
    // Spot-specific fields are present.
    expect(screen.getByText('Inner angle (rad)')).toBeInTheDocument()
    expect(screen.getByText('Outer angle (rad)')).toBeInTheDocument()
    // Shared fields are present.
    expect(screen.getByText('Color')).toBeInTheDocument()
    expect(screen.getByText('Intensity')).toBeInTheDocument()
    expect(screen.getByText('Range')).toBeInTheDocument()
  })

  it('switching kind produces a schema-valid marker of the new variant', () => {
    const id = resetStore({
      light: {
        kind: LIGHT_MARKER_KINDS.point,
        color: [0.5, 0.5, 0.5],
        intensity: 500,
        range: 7,
        shadows: true,
      },
    })
    const { container } = render(<ConnectedLightMarkerPanel objectId={id} />)

    // Switch to spot. The select is the only <select> in the panel.
    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'spot' } })

    const obj = useEditorStore.getState().sceneObjects.get(id)
    const parsed = LightMarkerSchema.safeParse(obj?.light)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.kind).toBe('spot')
      // Carried over shared fields.
      expect(parsed.data.color).toEqual([0.5, 0.5, 0.5])
      expect(parsed.data.intensity).toBe(500)
      expect(parsed.data.shadows).toBe(true)
      // Spot-specific fields are populated from the default.
      if (parsed.data.kind === 'spot') {
        expect(parsed.data.inner_angle).toBeGreaterThan(0)
        expect(parsed.data.outer_angle).toBeGreaterThan(parsed.data.inner_angle)
      }
    }
  })

  it('switching point -> directional drops range but keeps shared fields', () => {
    const id = resetStore({
      light: {
        kind: LIGHT_MARKER_KINDS.point,
        color: [1, 0, 0],
        intensity: 100,
        range: 5,
        shadows: false,
      },
    })
    const { container } = render(<ConnectedLightMarkerPanel objectId={id} />)
    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'directional' } })

    const obj = useEditorStore.getState().sceneObjects.get(id)
    const parsed = LightMarkerSchema.safeParse(obj?.light)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.kind).toBe('directional')
      expect(parsed.data.color).toEqual([1, 0, 0])
      expect(parsed.data.intensity).toBe(100)
      expect(parsed.data.shadows).toBe(false)
    }
  })

  it('"Remove Light" calls the action with undefined and the panel returns to "Add"', () => {
    const id = resetStore({ light: defaultLightMarker() })
    render(<ConnectedLightMarkerPanel objectId={id} />)
    expect(screen.getByText('Remove Light')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Remove Light'))

    expect('light' in (useEditorStore.getState().sceneObjects.get(id) ?? {})).toBe(false)
    expect(screen.getByText('Add Light')).toBeInTheDocument()
  })
})

// ─── AnimationMarkerPanel ────────────────────────────────────────────────────

describe('T91c AnimationMarkerPanel', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders "Add Animation" when no animation marker is present', () => {
    const id = resetStore()
    render(<ConnectedAnimationMarkerPanel objectId={id} />)
    expect(screen.getByText('Add Animation')).toBeInTheDocument()
  })

  it('clicking "Add Animation" creates a Play marker', () => {
    const id = resetStore()
    render(<ConnectedAnimationMarkerPanel objectId={id} />)
    fireEvent.click(screen.getByText('Add Animation'))

    const obj = useEditorStore.getState().sceneObjects.get(id)
    const parsed = AnimationMarkerSchema.safeParse(obj?.animation)
    expect(parsed.success).toBe(true)
    expect(obj?.animation?.kind).toBe('play')
  })

  it('switching play -> play_once produces a schema-valid marker', () => {
    const id = resetStore({
      animation: {
        kind: ANIMATION_MARKER_KINDS.play,
        clip: 'banner.anim',
        repeat: true,
        speed: 1.0,
      },
    })
    const { container } = render(<ConnectedAnimationMarkerPanel objectId={id} />)
    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'play_once' } })

    const obj = useEditorStore.getState().sceneObjects.get(id)
    const parsed = AnimationMarkerSchema.safeParse(obj?.animation)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.kind).toBe('play_once')
      // The shared `clip` is carried over.
      expect(parsed.data.clip).toBe('banner.anim')
    }
  })

  it('"Remove Animation" clears the marker', () => {
    const id = resetStore({ animation: defaultAnimationMarker() })
    render(<ConnectedAnimationMarkerPanel objectId={id} />)
    fireEvent.click(screen.getByText('Remove Animation'))
    expect('animation' in (useEditorStore.getState().sceneObjects.get(id) ?? {})).toBe(false)
    expect(screen.getByText('Add Animation')).toBeInTheDocument()
  })
})

// ─── AudioMarkerPanel ────────────────────────────────────────────────────────

describe('T91c AudioMarkerPanel', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders "Add Audio" when no audio marker is present', () => {
    const id = resetStore()
    render(<ConnectedAudioMarkerPanel objectId={id} />)
    expect(screen.getByText('Add Audio')).toBeInTheDocument()
  })

  it('clicking "Add Audio" creates an Ambient marker', () => {
    const id = resetStore()
    render(<ConnectedAudioMarkerPanel objectId={id} />)
    fireEvent.click(screen.getByText('Add Audio'))

    const obj = useEditorStore.getState().sceneObjects.get(id)
    const parsed = AudioMarkerSchema.safeParse(obj?.audio)
    expect(parsed.success).toBe(true)
    expect(obj?.audio?.kind).toBe('ambient')
  })

  it('switching ambient -> one_shot produces a schema-valid marker', () => {
    const id = resetStore({
      audio: {
        kind: AUDIO_MARKER_KINDS.ambient,
        path: 'fountain.ogg',
        volume: 0.8,
        looping: true,
      },
    })
    const { container } = render(<ConnectedAudioMarkerPanel objectId={id} />)
    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'one_shot' } })

    const obj = useEditorStore.getState().sceneObjects.get(id)
    const parsed = AudioMarkerSchema.safeParse(obj?.audio)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.kind).toBe('one_shot')
      expect(parsed.data.path).toBe('fountain.ogg')
      expect(parsed.data.volume).toBe(0.8)
    }
  })

  it('"Remove Audio" clears the marker', () => {
    const id = resetStore({ audio: defaultAudioMarker() })
    render(<ConnectedAudioMarkerPanel objectId={id} />)
    fireEvent.click(screen.getByText('Remove Audio'))
    expect('audio' in (useEditorStore.getState().sceneObjects.get(id) ?? {})).toBe(false)
    expect(screen.getByText('Add Audio')).toBeInTheDocument()
  })
})

// ─── VfxMarkerPanel ──────────────────────────────────────────────────────────

describe('T91c VfxMarkerPanel', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders "Add VFX" when no vfx marker is present', () => {
    const id = resetStore()
    render(<ConnectedVfxMarkerPanel objectId={id} />)
    expect(screen.getByText('Add VFX')).toBeInTheDocument()
  })

  it('clicking "Add VFX" creates a Particle marker', () => {
    const id = resetStore()
    render(<ConnectedVfxMarkerPanel objectId={id} />)
    fireEvent.click(screen.getByText('Add VFX'))

    const obj = useEditorStore.getState().sceneObjects.get(id)
    const parsed = VfxMarkerSchema.safeParse(obj?.vfx)
    expect(parsed.success).toBe(true)
    expect(obj?.vfx?.kind).toBe('particle')
  })

  it('switching particle -> billboard produces a schema-valid marker', () => {
    const id = resetStore({
      vfx: {
        kind: VFX_MARKER_KINDS.particle,
        path: 'campfire.vfx',
        count: 50,
      },
    })
    const { container } = render(<ConnectedVfxMarkerPanel objectId={id} />)
    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'billboard' } })

    const obj = useEditorStore.getState().sceneObjects.get(id)
    const parsed = VfxMarkerSchema.safeParse(obj?.vfx)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.kind).toBe('billboard')
      // Billboard has its own defaulted fields.
      if (parsed.data.kind === 'billboard') {
        expect(parsed.data.size).toBeDefined()
        expect(parsed.data.size).toHaveLength(2)
      }
    }
  })

  it('"Remove VFX" clears the marker', () => {
    const id = resetStore({ vfx: defaultVfxMarker() })
    render(<ConnectedVfxMarkerPanel objectId={id} />)
    fireEvent.click(screen.getByText('Remove VFX'))
    expect('vfx' in (useEditorStore.getState().sceneObjects.get(id) ?? {})).toBe(false)
    expect(screen.getByText('Add VFX')).toBeInTheDocument()
  })
})

// ─── Field editing ───────────────────────────────────────────────────────────

describe('T91c field editing writes through to the store', () => {
  it('Light intensity change writes through the T91b action', () => {
    const id = resetStore({ light: defaultLightMarker() })
    render(<ConnectedLightMarkerPanel objectId={id} />)

    // The default Point intensity is 1000; find the input by its
    // current value. The four Point-variant number inputs are
    // Color R/G/B (1, 1, 1) and Intensity (1000).
    const intensityInput = screen.getByDisplayValue('1000') as HTMLInputElement
    fireEvent.change(intensityInput, { target: { value: '2500' } })

    const obj = useEditorStore.getState().sceneObjects.get(id)
    if (obj?.light && obj.light.kind === LIGHT_MARKER_KINDS.point) {
      expect(obj.light.intensity).toBe(2500)
    } else {
      throw new Error('expected a point light in the store')
    }
  })

  it('VFX count is parsed as a non-negative integer (negative input is clamped)', () => {
    const id = resetStore({ vfx: defaultVfxMarker() })
    render(<ConnectedVfxMarkerPanel objectId={id} />)

    // Particle default count is 100.
    const countInput = screen.getByDisplayValue('100') as HTMLInputElement
    fireEvent.change(countInput, { target: { value: '-10' } })

    const obj = useEditorStore.getState().sceneObjects.get(id)
    if (obj?.vfx && obj.vfx.kind === VFX_MARKER_KINDS.particle) {
      expect(obj.vfx.count).toBe(0)
    } else {
      throw new Error('expected a particle VFX in the store')
    }
  })
})

// ─── No selection ────────────────────────────────────────────────────────────

describe('T91c panels do not render without a selected object', () => {
  /*
   * The connected panels take an `objectId` prop directly. The parent
   * Inspector gates the `<ConnectedXyzMarkerPanel />` block on
   * `selectedCount === 1 && primaryObject`. The marker panel itself
   * shows an "Add" affordance when its scene object's marker field is
   * `undefined` — so a stale id (the object was removed from the
   * store) ends up with the "Add" button. The contract is enforced at
   * the Inspector level, not the panel level. This test exists to
   * document that contract.
   */
  it('a stale (missing) object id renders the "Add" affordance — the Inspector gates this', () => {
    render(<ConnectedLightMarkerPanel objectId={ObjectId('never_existed')} />)
    // The panel renders the "Add Light" affordance because the marker
    // is undefined. The Inspector guarantees this code path is never
    // reached when the id is missing.
    expect(screen.getByText('Add Light')).toBeInTheDocument()
  })
})
