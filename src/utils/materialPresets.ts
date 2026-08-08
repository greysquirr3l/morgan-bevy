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

import { isValidIdString, MaterialId } from '@/types/brand'

export interface MaterialPreset {
  id: MaterialId
  name: string
  baseColor: string
  metallic: number
  roughness: number
  emissive: string
  emissiveIntensity: number
  texture?: string
}

export interface MaterialInstance {
  presetId: MaterialId
  overrides: Partial<Omit<MaterialPreset, 'id' | 'name'>>
}

const STORAGE_KEY = 'morgan-bevy-material-presets'

/** Default presets shipped with the editor. */
export const DEFAULT_PRESETS: readonly MaterialPreset[] = Object.freeze([
  {
    id: MaterialId('default-metal'),
    name: 'Metal',
    baseColor: '#b0b0b0',
    metallic: 1.0,
    roughness: 0.2,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: MaterialId('default-concrete'),
    name: 'Concrete',
    baseColor: '#808080',
    metallic: 0.0,
    roughness: 0.8,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: MaterialId('default-plastic'),
    name: 'Plastic',
    baseColor: '#ffffff',
    metallic: 0.0,
    roughness: 0.5,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: MaterialId('default-wood'),
    name: 'Wood',
    baseColor: '#8b4513',
    metallic: 0.0,
    roughness: 0.7,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: MaterialId('default-glass'),
    name: 'Glass',
    baseColor: '#ffffff',
    metallic: 0.0,
    roughness: 0.0,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: MaterialId('default-gold'),
    name: 'Gold',
    baseColor: '#ffd700',
    metallic: 1.0,
    roughness: 0.1,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: MaterialId('default-copper'),
    name: 'Copper',
    baseColor: '#b87333',
    metallic: 1.0,
    roughness: 0.3,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: MaterialId('default-chrome'),
    name: 'Chrome',
    baseColor: '#c0c0c0',
    metallic: 1.0,
    roughness: 0.05,
    emissive: '#000000',
    emissiveIntensity: 0.0,
  },
  {
    id: MaterialId('default-neon'),
    name: 'Neon',
    baseColor: '#ff00ff',
    metallic: 0.0,
    roughness: 0.9,
    emissive: '#ff00ff',
    emissiveIntensity: 1.0,
  },
  {
    id: MaterialId('default-led'),
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
export function deleteMaterialPreset(id: MaterialId): MaterialPreset[] {
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

// Boundary: presets are read back out of localStorage as untrusted
// JSON. `isValidIdString` (rather than a bare `typeof === 'string'`
// check) rejects a corrupted/malformed `id` here instead of letting
// it flow into the app as an ill-shaped `MaterialId`.
function isMaterialPreset(value: unknown): value is MaterialPreset {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    isValidIdString(v.id) &&
    typeof v.name === 'string' &&
    typeof v.baseColor === 'string' &&
    typeof v.metallic === 'number' &&
    typeof v.roughness === 'number' &&
    typeof v.emissive === 'string' &&
    typeof v.emissiveIntensity === 'number'
  )
}

/** Resolve a material instance against its preset. */
export function effectiveMaterial(
  preset: MaterialPreset | undefined,
  instance: MaterialInstance | undefined,
): {
  baseColor: string
  metallic: number
  roughness: number
  emissive: string
  emissiveIntensity: number
  texture?: string
} {
  const base: MaterialPreset = preset ?? {
    id: MaterialId('fallback'),
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
export function newPresetId(name: string): MaterialId {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const suffix = Math.random().toString(36).slice(2, 8)
  // Generation site (not a boundary): minted here, not parsed from
  // untrusted input — use the plain constructor.
  return MaterialId(`${slug || 'preset'}-${suffix}`)
}
