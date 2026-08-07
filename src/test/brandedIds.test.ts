/**
 * T77 — Branded ID type tests.
 *
 * Verifies the runtime helpers in `src/types/brand.ts`:
 *  - `parseObjectId(invalid)` throws on bad input.
 *  - `parseObjectId(uuid)` returns a branded `ObjectId` value.
 *  - The raw string round-trips through `ObjectId(raw) -> String(obj)`.
 *  - The static brand type guard rejects `unknown` and accepts
 *    correctly-shaped strings.
 *
 * The *type-level* test (passing a `string` to a function expecting
 * `ObjectId` is a compile error) lives in `src/test/brandedIds.type-test.ts`
 * under `if (false)` — it's compile-only and vitest ignores it.
 */
import {
  AssetId,
  LayerId,
  MaterialId,
  ObjectId,
  PrefabId,
  Seed,
  ThemeId,
  isAssetId,
  isLayerId,
  isMaterialId,
  isObjectId,
  isPrefabId,
  isSeed,
  isThemeId,
  isValidIdString,
  parseAssetId,
  parseLayerId,
  parseMaterialId,
  parseObjectId,
  parsePrefabId,
  parseSeed,
  parseThemeId,
} from '@/types/brand'
import { describe, expect, it } from 'vitest'

describe('branded ID parsing', () => {
  describe('isValidIdString', () => {
    it('accepts a 36-char UUID with dashes', () => {
      expect(isValidIdString('aabbccdd-1234-5678-9abc-def012345678')).toBe(true)
    })

    it('accepts a 32-char hex string (UUID without dashes)', () => {
      expect(isValidIdString('aabbccdd123456789abcdef0123456789')).toBe(true)
    })

    it('accepts short IDs (4+ chars) used by tests', () => {
      expect(isValidIdString('obj-1')).toBe(true)
      expect(isValidIdString('wall_north')).toBe(true)
    })

    it('accepts underscores + alphanumerics', () => {
      expect(isValidIdString('obj_123_abc')).toBe(true)
    })

    it('rejects empty strings', () => {
      expect(isValidIdString('')).toBe(false)
    })

    it('rejects strings with whitespace', () => {
      expect(isValidIdString('hello world')).toBe(false)
      expect(isValidIdString(' leading-space')).toBe(false)
    })

    it('rejects strings over 64 chars', () => {
      expect(isValidIdString('a'.repeat(65))).toBe(false)
    })

    it('rejects strings under 4 chars', () => {
      expect(isValidIdString('ab')).toBe(false)
      expect(isValidIdString('abc')).toBe(false)
    })

    it('rejects non-string inputs', () => {
      expect(isValidIdString(undefined)).toBe(false)
      expect(isValidIdString(null)).toBe(false)
      expect(isValidIdString(123)).toBe(false)
      expect(isValidIdString({})).toBe(false)
    })
  })

  describe('parseObjectId', () => {
    it('returns a branded ObjectId for a valid UUID', () => {
      const raw = 'aabbccdd-1234-5678-9abc-def012345678'
      const id = parseObjectId(raw)
      expect(id).toBe(raw)
      // The runtime value is still a string — the brand is purely
      // type-level. Consumers can pass it anywhere a `string` is
      // accepted in JS APIs (e.g. `Map.set` keys, `JSON.stringify`).
      expect(typeof id).toBe('string')
    })

    it('throws for an empty string', () => {
      expect(() => parseObjectId('')).toThrow(/Invalid ObjectId/)
    })

    it('throws for whitespace', () => {
      expect(() => parseObjectId('has space')).toThrow(/Invalid ObjectId/)
    })

    it('throws for non-string input', () => {
      expect(() => parseObjectId(undefined)).toThrow(/Invalid ObjectId/)
      expect(() => parseObjectId(42)).toThrow(/Invalid ObjectId/)
      expect(() => parseObjectId({})).toThrow(/Invalid ObjectId/)
    })

    it('throws for too-long strings', () => {
      expect(() => parseObjectId('a'.repeat(65))).toThrow(/Invalid ObjectId/)
    })
  })

  describe('parse*Id helpers for the other brands', () => {
    it('parseAssetId accepts a valid ID', () => {
      expect(parseAssetId('asset-1234')).toBe('asset-1234')
    })
    it('parseMaterialId rejects bad input', () => {
      expect(() => parseMaterialId('mat with space')).toThrow(/Invalid MaterialId/)
    })
    it('parsePrefabId accepts a valid ID', () => {
      expect(parsePrefabId('prefab_abc_123')).toBe('prefab_abc_123')
    })
    it('parseLayerId rejects bad input', () => {
      expect(() => parseLayerId('')).toThrow(/Invalid LayerId/)
    })
    it('parseThemeId accepts a valid ID', () => {
      expect(parseThemeId('theme-dungeon')).toBe('theme-dungeon')
    })
  })

  describe('parseSeed', () => {
    it('accepts a finite integer', () => {
      const seed = parseSeed(42)
      expect(seed).toBe(42)
      expect(typeof seed).toBe('number')
    })

    it('accepts 0', () => {
      expect(parseSeed(0)).toBe(0)
    })

    it('rejects NaN', () => {
      expect(() => parseSeed(Number.NaN)).toThrow(/Invalid Seed/)
    })

    it('rejects Infinity', () => {
      expect(() => parseSeed(Infinity)).toThrow(/Invalid Seed/)
    })

    it('rejects negative numbers (or accepts — see spec)', () => {
      // Editor seeds are u64 under the hood. Negative values would
      // silently lose precision when crossing the IPC boundary; we
      // reject them explicitly.
      expect(() => parseSeed(-1)).toThrow(/Invalid Seed/)
    })

    it('rejects floats', () => {
      expect(() => parseSeed(3.14)).toThrow(/Invalid Seed/)
    })

    it('rejects non-numbers', () => {
      expect(() => parseSeed('42')).toThrow(/Invalid Seed/)
      expect(() => parseSeed(undefined)).toThrow(/Invalid Seed/)
    })
  })

  describe('type guards', () => {
    it('isObjectId accepts a valid branded value', () => {
      expect(isObjectId(ObjectId('obj-1'))).toBe(true)
    })
    it('isObjectId rejects non-string values', () => {
      expect(isObjectId(undefined)).toBe(false)
      expect(isObjectId(null)).toBe(false)
      expect(isObjectId(42)).toBe(false)
    })
    it('isObjectId rejects malformed strings', () => {
      expect(isObjectId('')).toBe(false)
      expect(isObjectId('has space')).toBe(false)
    })

    it('isAssetId accepts valid and rejects invalid', () => {
      expect(isAssetId(AssetId('asset-1'))).toBe(true)
      expect(isAssetId('')).toBe(false)
    })
    it('isMaterialId accepts valid and rejects invalid', () => {
      expect(isMaterialId(MaterialId('mat-1'))).toBe(true)
      expect(isMaterialId('')).toBe(false)
    })
    it('isPrefabId accepts valid and rejects invalid', () => {
      expect(isPrefabId(PrefabId('prefab-1'))).toBe(true)
      expect(isPrefabId('')).toBe(false)
    })
    it('isLayerId accepts valid and rejects invalid', () => {
      expect(isLayerId(LayerId('layer-1'))).toBe(true)
      expect(isLayerId('')).toBe(false)
    })
    it('isThemeId accepts valid and rejects invalid', () => {
      expect(isThemeId(ThemeId('theme-1'))).toBe(true)
      expect(isThemeId('')).toBe(false)
    })
    it('isSeed accepts a finite integer and rejects NaN', () => {
      expect(isSeed(42)).toBe(true)
      expect(isSeed(0)).toBe(true)
      expect(isSeed(Number.NaN)).toBe(false)
      expect(isSeed(Infinity)).toBe(false)
      expect(isSeed(3.14)).toBe(false)
      expect(isSeed('42')).toBe(false)
      expect(isSeed(Seed(7))).toBe(true)
    })
  })

  describe('round-trip through JSON', () => {
    it('preserves the raw string value', () => {
      const raw = 'aabbccdd-1234-5678-9abc-def012345678'
      const id = parseObjectId(raw)
      const json = JSON.stringify(id)
      // The brand is purely type-level — the JSON value is the
      // bare string. After parse + cast the round-trip is exact.
      expect(JSON.parse(json)).toBe(raw)
      expect(isObjectId(JSON.parse(json))).toBe(true)
    })

    it('preserves the raw seed value', () => {
      const seed = parseSeed(123_456_789)
      expect(JSON.parse(JSON.stringify(seed))).toBe(123_456_789)
    })
  })
})
