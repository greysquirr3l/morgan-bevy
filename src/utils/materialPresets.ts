/**
 * Material-preset helpers (T18).
 *
 * A *material preset* is a named, reusable bundle of PBR parameters
 * stored in localStorage. A *material instance* on a scene object
 * is the composition of a preset reference and a (possibly empty)
 * set of per-object overrides.
 *
 * Wire format:
 *   MaterialPreset = { id; name; baseColor; metallic; roughness;
 *                      emissive; emissiveIntensity; texture? }
 *   MaterialInstance = { presetId; overrides: Partial<MaterialPreset> }
 *
 * Resolution (preset + overrides) is `effectiveMaterial` — the
 * material actually rendered for that object.
 */

import type { EditorState } from '@/store/editorStore'

export interface MaterialPreset {
  id: string
  name: string
  baseColor: string
  metallic: number
  roughness: number
  emissive: string
  emissiveIntensity: number
  texture?: string
}

export interface MaterialInstance {
  presetId: string
  overrides: Partial<Omit<MaterialPreset, 'id' | 'name'>>
}

const STORAGE_KEY = 'morgan-bevy-material-presets'

/** Default presets shipped with the editor. */
export const DEFAULT_PRESETS: readonly MaterialPreset[] = Object.freeze([
  {
    id: 'default-metal',
    name: 'Metal',
    baseColor: '#b0b0b0',
    metallic: 1.0,
    roughness: 0.2,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: 'default-concrete',
    name: 'Concrete',
    baseColor: '#808080',
    metallic: 0.0,
    roughness: 0.8,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: 'default-plastic',
    name: 'Plastic',
    baseColor: '#ffffff',
    metallic: 0.0,
    roughness: 0.5,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: 'default-wood',
    name: 'Wood',
    baseColor: '#8b4513',
    metallic: 0.0,
    roughness: 0.7,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: 'default-glass',
    name: 'Glass',
    baseColor: '#ffffff',
    metallic: 0.0,
    roughness: 0.0,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: 'default-gold',
    name: 'Gold',
    baseColor: '#ffd700',
    metallic: 1.0,
    roughness: 0.1,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: 'default-copper',
    name: 'Copper',
    baseColor: '#b87333',
    metallic: 1.0,
    roughness: 0.3,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: 'default-chrome',
    name: 'Chrome',
    baseColor: '#c0c0c0',
    metallic: 1.0,
    roughness: 0.05,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: 'default-neon',
    name: 'Neon',
    baseColor: '#ff00ff',
    metallic: 0.0,
    roughness: 0.9,
    emissive: '#ff00ff',
    emissiveIntensity: 1.0,
  },
  {
    id: 'default-led',
    name: 'LED',
    baseColor: '#ffffff',
    metallic: 0.0,
    roughness: 0.8,
    emissive: '#00ffff',
    emissiveIntensity: 0.5,
  },
])

/** Read every preset (defaults + user-added) from localStorage. */
export function listMaterialPresets(): MaterialPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_PRESETS]
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...DEFAULT_PRESETS]
    return [...DEFAULT_PRESETS, ...parsed.filter(isMaterialPreset)]
  } catch {
    return [...DEFAULT_PRESETS]
  }
}

/** Persist a custom preset (user-added) to localStorage. */
export function saveMaterialPreset(preset: MaterialPreset): void {
  const existing = readCustomPresets()
  const filtered = existing.filter(p => p.id !== preset.id)
  const next = [...filtered, preset]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

/** Remove a custom preset by id. Returns the remaining custom presets. */
export function deleteMaterialPreset(id: string): MaterialPreset[] {
  const existing = readCustomPresets()
  const next = existing.filter(p => p.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

function readCustomPresets(): MaterialPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isMaterialPreset)
  } catch {
    return []
  }
}

function isMaterialPreset(value: unknown): value is MaterialPreset {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.baseColor === 'string' &&
    typeof v.metallic === 'number' &&
    typeof v.roughness === 'number' &&
    typeof v.emissive === 'string' &&
    typeof v.emissiveIntensity === 'number'
  )
}

/**
 * Resolve a material instance to the effective values applied at
 * render time. `overrides` win where present; everything else falls
 * through to the base preset.
 */
export function effectiveMaterial(
  preset: MaterialPreset | undefined,
  instance: MaterialInstance | undefined
): {
  baseColor: string
  metallic: number
  roughness: number
  emissive: string
  emissiveIntensity: number
  texture?: string
} {
  const base: MaterialPreset = preset ?? {
    id: 'fallback',
    name: 'Default',
    baseColor: '#808080',
    metallic: 0,
    roughness: 1,
    emissive: '#000000',
    emissiveIntensity: 0,
  }
  if (!instance) {
    return {
      baseColor: base.baseColor,
      metallic: base.metallic,
      roughness: base.roughness,
      emissive: base.emissive,
      emissiveIntensity: base.emissiveIntensity,
      ...(base.texture !== undefined ? { texture: base.texture } : {}),
    }
  }
  return {
    baseColor: instance.overrides.baseColor ?? base.baseColor,
    metallic: instance.overrides.metallic ?? base.metallic,
    roughness: instance.overrides.roughness ?? base.roughness,
    emissive: instance.overrides.emissive ?? base.emissive,
    emissiveIntensity: instance.overrides.emissiveIntensity ?? base.emissiveIntensity,
    ...((instance.overrides.texture ?? base.texture) !== undefined
      ? { texture: instance.overrides.texture ?? base.texture }
      : {}),
  }
}

/** Create a stable preset id from a name (collision-resistant). */
export function newPresetId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${slug || 'preset'}-${suffix}`
}

/**
 * Whether the per-object `material` field stored in the scene
 * matches the resolved effective material of the given instance
 * (i.e. the instance is the source of truth). Used by the
 * Inspector to show a "(linked to preset)" badge.
 */
export function instanceMatches(
  stored: EditorState['sceneObjects'] extends Map<string, infer V>
    ? V extends { material?: infer M }
      ? M
      : never
    : never,
  preset: MaterialPreset | undefined,
  instance: MaterialInstance | undefined
): boolean {
  const effective = effectiveMaterial(preset, instance)
  if (!stored) return false
  const s = stored as {
    baseColor?: string
    metallic?: number
    roughness?: number
    emissive?: string
    emissiveIntensity?: number
    texture?: string
  }
  return (
    s.baseColor === effective.baseColor &&
    s.metallic === effective.metallic &&
    s.roughness === effective.roughness &&
    s.emissive === effective.emissive &&
    s.emissiveIntensity === effective.emissiveIntensity &&
    (s.texture ?? null) === (effective.texture ?? null)
  )
}
