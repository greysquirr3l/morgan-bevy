// Branded ID types — prevent passing the wrong kind of ID to a function
// expecting another kind. The `__brand` field is purely structural; the
// type checker treats it as a phantom and the runtime cost is zero.
//
// Construction is centralised via the parse* helpers, which validate at
// boundaries (Tauri invoke returns, URL params, clipboard payloads). Inside
// the codebase, IDs flow as already-typed values; never cast at the call
// site.

declare const __brand: unique symbol
export type Brand<T, B> = T & { readonly [__brand]: B }

export type ObjectId = Brand<string, 'ObjectId'>
export type AssetId = Brand<string, 'AssetId'>
export type MaterialId = Brand<string, 'MaterialId'>
export type PrefabId = Brand<string, 'PrefabId'>
export type LayerId = Brand<string, 'LayerId'>
export type ThemeId = Brand<string, 'ThemeId'>
export type Seed = Brand<number, 'Seed'>

export const ObjectId = (raw: string): ObjectId => raw as ObjectId
export const AssetId = (raw: string): AssetId => raw as AssetId
export const MaterialId = (raw: string): MaterialId => raw as MaterialId
export const PrefabId = (raw: string): PrefabId => raw as PrefabId
export const LayerId = (raw: string): LayerId => raw as LayerId
export const ThemeId = (raw: string): ThemeId => raw as ThemeId
export const Seed = (raw: number): Seed => raw as Seed

/**
 * Iterate a Map as `[id, value]` pairs in insertion order. Equivalent to
 * `Array.from(map.entries())` but reads more like `Object.entries`.
 */
export function mapEntries<K, V>(map: Map<K, V>): Array<[K, V]> {
  return Array.from(map.entries())
}

/**
 * Snapshot a Map as a plain `Record<string, V>`. Useful when a non-Map
 * consumer (a legacy component, a JSON serializer) needs a synchronous
 * read-only view. The returned Record is a fresh copy — mutating it does
 * not affect the source Map.
 */
export function mapToRecord<V>(map: Map<string, V>): Record<string, V> {
  const out: Record<string, V> = {}
  for (const [k, v] of map.entries()) {
    out[k] = v
  }
  return out
}

/**
 * Build a Map from a Record. Used by the IndexedDB autosave loader and by
 * test fixtures that construct initial state from a plain object.
 */
export function recordToMap<V>(record: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(record))
}
