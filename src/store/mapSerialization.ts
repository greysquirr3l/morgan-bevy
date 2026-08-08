/**
 * Map <-> JSON-safe entries round-trip for persistence boundaries
 * (localStorage autosave, `.morgan` project files, in-file scene
 * loads). `JSON.stringify` does not serialize `Map` — a bare Map
 * argument produces `{}` — so every path that writes a Map to JSON
 * (or reads one back) must go through `serializeMap` / `deserializeMap`
 * rather than hand-rolling `Array.from(map.entries())` at each call
 * site.
 *
 * T78: this module exists to keep the (de)serialization concern out
 * of `src/store/editorStore.ts`, which already owns the store shape
 * and actions.
 */
import { mapEntries } from '@/types/brand'

/**
 * `Map<K, V>` -> `Array<[K, V]>`, preserving insertion order. Thin
 * wrapper over `mapEntries` (from `types/brand.ts`) so both names
 * exist for their respective call sites — this one signals "about to
 * cross a JSON boundary," `mapEntries` signals "just iterate."
 */
export function serializeMap<K, V>(map: Map<K, V>): Array<[K, V]> {
  return mapEntries(map)
}

/**
 * `Array<[K, V]>` -> `Map<K, V>`. Accepts `unknown` because `raw`
 * crossed a JSON boundary (file load, localStorage read) — it may
 * also be a plain `Record<string, V>` if it came from a pre-T78 save
 * file, so both shapes are normalized to entries first.
 *
 * `isValidKey` narrows each key before admitting the entry; an entry
 * whose key fails validation is dropped (with a `console.warn`)
 * rather than discarding the whole payload — one malformed id must
 * not sink the rest of the scene.
 */
export function deserializeMap<K, V>(
  raw: unknown,
  isValidKey: (key: unknown) => key is K
): Map<K, V> {
  const out = new Map<K, V>()
  for (const [key, value] of normalizeEntries(raw)) {
    if (!isValidKey(key)) {
      console.warn('deserializeMap: dropping entry with invalid key', key)
      continue
    }
    out.set(key, value as V)
  }
  return out
}

function normalizeEntries(raw: unknown): Array<[unknown, unknown]> {
  if (Array.isArray(raw)) return raw as Array<[unknown, unknown]>
  if (raw !== null && typeof raw === 'object') return Object.entries(raw)
  return []
}
