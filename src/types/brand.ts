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

// ---------------------------------------------------------------------------
// Parsing + validation — T77.
//
// At every *boundary* (Tauri invoke return, URL params, clipboard payload,
// file deserialization, URL hash) raw `string` / `number` values enter
// the system. These `parse*Id` helpers are the ONE place those raw values
// become branded IDs. They validate the input shape (a UUID-like
// alphanumeric string) and throw on garbage so the rest of the codebase
// can rely on the brand.
//
// Inside the codebase, IDs flow as already-typed values — never cast at
// the call site. The wiring-audit test (`src/test/wiringAudit.test.ts`)
// guarantees these helpers stay referenced.
// ---------------------------------------------------------------------------

/**
 * UUID-shaped pattern used by every entity the editor creates. The
 * editor's `Uuid::new_v4().to_string()` is a hex string with dashes;
 * the editor's tests use shorter IDs (`obj-1`, `wall_north`), so the
 * minimum is 4 chars rather than 32/36.
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/

/**
 * Validate a raw string is acceptable as a `Brand<string, _>` ID.
 * Returns `true` for non-empty alphanumeric + dash + underscore strings
 * up to 64 chars. Throws nothing — callers compose with `parse*Id`.
 */
export function isValidIdString(raw: unknown): raw is string {
  return typeof raw === 'string' && ID_PATTERN.test(raw)
}

/**
 * Parse + brand a raw string as an `ObjectId`. Throws if `raw` is not a
 * valid ID string. Used at every Tauri/IPC boundary that returns an
 * object ID (level export, scene save, autosave restore, etc.).
 */
export function parseObjectId(raw: unknown): ObjectId {
  if (!isValidIdString(raw)) {
    throw new Error(`Invalid ObjectId: ${JSON.stringify(raw)}`)
  }
  return raw as ObjectId
}

export function parseAssetId(raw: unknown): AssetId {
  if (!isValidIdString(raw)) {
    throw new Error(`Invalid AssetId: ${JSON.stringify(raw)}`)
  }
  return raw as AssetId
}

export function parseMaterialId(raw: unknown): MaterialId {
  if (!isValidIdString(raw)) {
    throw new Error(`Invalid MaterialId: ${JSON.stringify(raw)}`)
  }
  return raw as MaterialId
}

export function parsePrefabId(raw: unknown): PrefabId {
  if (!isValidIdString(raw)) {
    throw new Error(`Invalid PrefabId: ${JSON.stringify(raw)}`)
  }
  return raw as PrefabId
}

export function parseLayerId(raw: unknown): LayerId {
  if (!isValidIdString(raw)) {
    throw new Error(`Invalid LayerId: ${JSON.stringify(raw)}`)
  }
  return raw as LayerId
}

export function parseThemeId(raw: unknown): ThemeId {
  if (!isValidIdString(raw)) {
    throw new Error(`Invalid ThemeId: ${JSON.stringify(raw)}`)
  }
  return raw as ThemeId
}

/**
 * Parse + brand a raw number as a `Seed`. Throws if `raw` is not a
 * finite non-negative integer. Used at the boundary that produces a
 * level seed (BSP / WFC generator outputs, user-typed seed input).
 * The Rust side stores seeds as `u64`, so we reject negatives to
 * avoid silent precision loss when crossing the IPC boundary.
 */
export function parseSeed(raw: unknown): Seed {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || !Number.isInteger(raw) || raw < 0) {
    throw new Error(`Invalid Seed: ${JSON.stringify(raw)}`)
  }
  return raw as Seed
}

/**
 * Type guards for branded IDs — `unknown`-narrowing helpers used at
 * boundaries that yield `unknown` (e.g. JSON parse of clipboard data,
 * URL search params). Equivalent to a type predicate: `value is T`.
 */
export const isObjectId = (value: unknown): value is ObjectId => isValidIdString(value)
export const isAssetId = (value: unknown): value is AssetId => isValidIdString(value)
export const isMaterialId = (value: unknown): value is MaterialId => isValidIdString(value)
export const isPrefabId = (value: unknown): value is PrefabId => isValidIdString(value)
export const isLayerId = (value: unknown): value is LayerId => isValidIdString(value)
export const isThemeId = (value: unknown): value is ThemeId => isValidIdString(value)
export const isSeed = (value: unknown): value is Seed =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)

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
export function mapToRecord<K extends string, V>(map: Map<K, V>): Record<K, V> {
  const out = {} as Record<K, V>
  for (const [k, v] of map.entries()) {
    out[k] = v
  }
  return out
}

/**
 * Build a Map from a Record. Used by the IndexedDB autosave loader and by
 * test fixtures that construct initial state from a plain object.
 */
export function recordToMap<K extends string, V>(record: Record<K, V>): Map<K, V> {
  return new Map(Object.entries(record) as Array<[K, V]>)
}
