/**
 * T35 — import settings.
 *
 * Contract pinned:
 *  - Defaults match the Rust `ImportSettings::default()`.
 *  - `parseImportSettings` accepts valid blobs, returns defaults
 *    on missing / malformed data (so legacy project files load
 *    with the same behaviour).
 *  - `withImportSettings` / `readImportSettings` round-trip
 *    through a project payload.
 */
import { describe, expect, it } from 'vitest'

import {
  defaultImportSettings,
  parseImportSettings,
  readImportSettings,
  withImportSettings,
} from '@/types/import'

describe('T35 defaultImportSettings', () => {
  it('returns the canonical defaults (no resize, quality 80, fail-fast)', () => {
    expect(defaultImportSettings()).toEqual({
      textureMaxSize: 0,
      textureQuality: 80,
      skipInvalid: false,
    })
  })
})

describe('T35 parseImportSettings', () => {
  it('parses a valid blob with all fields set', () => {
    expect(
      parseImportSettings({
        textureMaxSize: 1024,
        textureQuality: 90,
        skipInvalid: true,
      })
    ).toEqual({
      textureMaxSize: 1024,
      textureQuality: 90,
      skipInvalid: true,
    })
  })

  it('falls back to defaults on null', () => {
    expect(parseImportSettings(null)).toEqual(defaultImportSettings())
  })

  it('falls back to defaults on undefined', () => {
    expect(parseImportSettings(undefined)).toEqual(defaultImportSettings())
  })

  it('falls back to defaults on a malformed blob and warns', () => {
    // textureQuality out of range.
    expect(parseImportSettings({ textureQuality: 200 })).toEqual(defaultImportSettings())
    // Wrong type.
    expect(parseImportSettings('not an object')).toEqual(defaultImportSettings())
    // Unknown keys would be tolerated (strict mode is on, so we
    // warn and fall back).
    expect(parseImportSettings({ textureMaxSize: 1, mystery: 'x' })).toEqual(
      defaultImportSettings()
    )
  })

  it('applies field-level defaults when only some fields are set', () => {
    expect(parseImportSettings({ textureMaxSize: 2048 })).toEqual({
      textureMaxSize: 2048,
      textureQuality: 80,
      skipInvalid: false,
    })
  })
})

describe('T35 withImportSettings / readImportSettings round-trip', () => {
  const baseProject = {
    schemaVersion: 1,
    scene: { objects: [], layers: [], activeLayer: 'default' },
  }

  it('round-trips a complete settings blob through project metadata', () => {
    const settings = { textureMaxSize: 1024, textureQuality: 75, skipInvalid: true }
    const withSettings = withImportSettings(baseProject, settings)
    expect(readImportSettings(withSettings)).toEqual(settings)
  })

  it('preserves existing metadata fields when injecting settings', () => {
    const project = { ...baseProject, metadata: { name: 'MyProject', assetRefs: ['a.png'] } }
    const withSettings = withImportSettings(project, defaultImportSettings())
    const metadata = withSettings.metadata as {
      name?: string
      assetRefs?: string[]
      importSettings?: unknown
    }
    expect(metadata.name).toBe('MyProject')
    expect(metadata.assetRefs).toEqual(['a.png'])
    expect(metadata.importSettings).toEqual(defaultImportSettings())
  })

  it('returns defaults when metadata is missing', () => {
    expect(readImportSettings(baseProject)).toEqual(defaultImportSettings())
  })

  it('returns defaults when importSettings key is missing', () => {
    expect(readImportSettings({ ...baseProject, metadata: { name: 'x' } })).toEqual(
      defaultImportSettings()
    )
  })
})
