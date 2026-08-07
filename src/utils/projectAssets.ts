/**
 * Asset-ref utilities (T20).
 *
 * A `ProjectData.metadata.assetRefs` array captures the set of
 * asset IDs the saved scene depends on. On save, we collect every
 * `material.texture` value into that array. On load, the caller
 * cross-checks the array against the live asset database to surface
 * "missing asset" warnings.
 */
import type { EditorState } from '@/store/editorStore'
import type { ProjectData } from '@/types/schemas'

/** Asset-ID-like — currently just the texture path string. */
export type AssetRef = string

/**
 * Scan the editor's scene objects and collect every distinct
 * `material.texture` value. These are the assets a project depends
 * on; if any are missing from the asset library on load, the user
 * sees a warning.
 */
export function collectAssetRefs(state: Pick<EditorState, 'sceneObjects'>): AssetRef[] {
  const refs = new Set<AssetRef>()
  for (const obj of state.sceneObjects.values()) {
    const texture = obj.material?.texture
    if (texture && texture.length > 0) {
      refs.add(texture)
    }
  }
  return Array.from(refs)
}

/**
 * Inject the asset-ref list into the `metadata` of a project payload
 * while leaving every other field intact. Returns a new object so
 * the caller does not have to mutate the input.
 */
export function withAssetRefs(projectData: ProjectData, refs: AssetRef[]): ProjectData {
  const metadata = (projectData.metadata ?? {}) as Record<string, unknown>
  return {
    ...projectData,
    metadata: {
      ...metadata,
      assetRefs: refs,
    },
  }
}

/** Pluck the asset-ref list out of a parsed project payload, if any. */
export function readAssetRefs(projectData: ProjectData): AssetRef[] {
  const metadata = projectData.metadata as
    | (Record<string, unknown> & { assetRefs?: unknown })
    | undefined
  if (!metadata || !Array.isArray(metadata.assetRefs)) {
    return []
  }
  return metadata.assetRefs.filter((r): r is AssetRef => typeof r === 'string')
}

/**
 * Subtract `candidates` from `known`, returning the items that are
 * not present. Used after a project load to find missing assets.
 */
export function missingRefs(known: Iterable<AssetRef>, candidates: Iterable<AssetRef>): AssetRef[] {
  const knownSet = new Set(known)
  return Array.from(candidates).filter(c => !knownSet.has(c))
}
