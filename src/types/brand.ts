/* eslint-disable no-redeclare --
 * Branded ID types and their constructors intentionally share a name — the
 * type and the runtime constructor are the same conceptual identifier. The
 * `type` keyword above disambiguates the type from the function for the
 * TypeScript compiler; ESLint's `no-redeclare` rule does not understand that
 * distinction.
 */
//
// Branded ID types — prevent passing the wrong kind of ID to a function
// expecting another kind. The `__brand` field is purely structural; the
// type checker treats it as a phantom and the runtime cost is zero.
//
// Each ID has two names: a TypeScript *type* (capitalised, used in
// signatures) and a runtime *constructor* function (capitalised, used at
// boundaries to brand raw values). They share a name by design — TS lets
// you have one of each per name in the same module via the `type` keyword.

declare const __brand: unique symbol
export type Brand<T, B> = T & { readonly [__brand]: B }

export type ObjectId = Brand<string, 'ObjectId'>
export type AssetId = Brand<string, 'AssetId'>
export type MaterialId = Brand<string, 'MaterialId'>
export type PrefabId = Brand<string, 'PrefabId'>
export type LayerId = Brand<string, 'LayerId'>
export type ThemeId = Brand<string, 'ThemeId'>
export type Seed = Brand<number, 'Seed'>

// Constructor functions — used at boundaries (Tauri invoke returns,
// URL params, clipboard payloads) to brand raw strings/numbers. Inside
// the codebase, IDs flow as already-typed values; never cast at the
// call site.
export function ObjectId(raw: string): ObjectId {
  return raw as ObjectId
}
export function AssetId(raw: string): AssetId {
  return raw as AssetId
}
export function MaterialId(raw: string): MaterialId {
  return raw as MaterialId
}
export function PrefabId(raw: string): PrefabId {
  return raw as PrefabId
}
export function LayerId(raw: string): LayerId {
  return raw as LayerId
}
export function ThemeId(raw: string): ThemeId {
  return raw as ThemeId
}
export function Seed(raw: number): Seed {
  return raw as Seed
}

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
