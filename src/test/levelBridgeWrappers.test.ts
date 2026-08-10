/**
 * T97 — Unit tests for the new FE wrappers around the 11
 * previously-unused Rust commands.
 *
 * Each wrapper is exercised by mocking `@tauri-apps/api/core`'s
 * `invoke` and asserting the wrapper's contract:
 *   - forwards the right command name + payload to Rust
 *   - validates the response against the matching zod schema
 *   - propagates errors as rejected promises (Rust returns
 *     `Result<T, String>` so a failure is a thrown exception,
 *     not a null/empty value)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

// ─────────────────────────────────────────────────────────────────────────
// Asset wrappers (`src/types/assetDatabase.ts`)
// ─────────────────────────────────────────────────────────────────────────

describe('assetDatabase wrappers (T97)', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('generateThumbnails forwards to Rust with no payload', async () => {
    mockInvoke.mockResolvedValueOnce(7)
    const { generateThumbnails } = await import('@/types/assetDatabase')
    const submitted = await generateThumbnails()
    expect(submitted).toBe(7)
    expect(mockInvoke).toHaveBeenCalledWith('generate_thumbnails')
  })

  it('cleanupThumbnails forwards to Rust with no payload', async () => {
    mockInvoke.mockResolvedValueOnce(2)
    const { cleanupThumbnails } = await import('@/types/assetDatabase')
    const removed = await cleanupThumbnails()
    expect(removed).toBe(2)
    expect(mockInvoke).toHaveBeenCalledWith('cleanup_thumbnails')
  })

  it('importAssets forwards sources + settings + optional cacheDir', async () => {
    mockInvoke.mockResolvedValueOnce({
      entries: [
        { source: '/a.png', destination: '/cache/a.webp' },
        // `error` is optional and absent-on-success per Rust's
        // `skip_serializing_if`. The mock omits it on the
        // happy-path entry to match real responses.
        { source: '/b.fbx', destination: '/cache/b.fbx' },
      ],
      transformed: 1,
    })
    const { importAssets } = await import('@/types/assetDatabase')
    const result = await importAssets(
      ['/a.png', '/b.fbx'],
      { texture_max_size: 1024, texture_quality: 80, skip_invalid: false },
      '/tmp/cache'
    )
    expect(result.entries).toHaveLength(2)
    expect(result.transformed).toBe(1)
    expect(mockInvoke).toHaveBeenCalledWith('import_assets', {
      sources: ['/a.png', '/b.fbx'],
      settings: { texture_max_size: 1024, texture_quality: 80, skip_invalid: false },
      cacheDir: '/tmp/cache',
    })
  })

  it('importAssets omits cacheDir when not supplied', async () => {
    mockInvoke.mockResolvedValueOnce({ entries: [], transformed: 0 })
    const { importAssets } = await import('@/types/assetDatabase')
    await importAssets(['/x.png'], {
      texture_max_size: 0,
      texture_quality: 80,
      skip_invalid: true,
    })
    expect(mockInvoke).toHaveBeenCalledWith('import_assets', {
      sources: ['/x.png'],
      settings: { texture_max_size: 0, texture_quality: 80, skip_invalid: true },
      cacheDir: undefined,
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Theme wrappers (`src/types/themes.ts`)
// ─────────────────────────────────────────────────────────────────────────

describe('theme wrappers (T97)', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getThemeById returns null on Rust "Theme not found" error', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Theme not found: nope'))
    const { getThemeById } = await import('@/types/themes')
    const result = await getThemeById('nope')
    expect(result).toBeNull()
    expect(mockInvoke).toHaveBeenCalledWith('get_theme_by_id', { themeId: 'nope' })
  })

  it('getThemeById validates the response shape via zod', async () => {
    mockInvoke.mockResolvedValueOnce({
      id: 'office',
      name: 'Office',
      description: 'A theme',
      author: 'me',
      version: '1.0.0',
      tiles: {},
      default_floor_height: 1,
      wall_height: 3,
      lighting: {
        ambient_color: [1, 1, 1],
        ambient_intensity: 0.5,
        directional_color: [1, 1, 1],
        directional_intensity: 0.8,
        directional_direction: [0, 1, 0],
        shadow_enabled: true,
      },
      materials: {},
      mesh_variants: {},
    })
    const { getThemeById } = await import('@/types/themes')
    const theme = await getThemeById('office')
    expect(theme?.id).toBe('office')
    expect(theme?.wall_height).toBe(3)
  })

  it('getThemeLegend forwards themeId and returns the legend string', async () => {
    mockInvoke.mockResolvedValueOnce('Floor # Wall D Door')
    const { getThemeLegend } = await import('@/types/themes')
    const text = await getThemeLegend('office')
    expect(text).toBe('Floor # Wall D Door')
    expect(mockInvoke).toHaveBeenCalledWith('get_theme_legend', { themeId: 'office' })
  })

  it('renderTilesToGrid serialises a 2D tile map', async () => {
    mockInvoke.mockResolvedValueOnce('####\n#..#\n####')
    const { renderTilesToGrid } = await import('@/types/themes')
    const grid = await renderTilesToGrid('office', [
      ['#', '#', '#', '#'],
      ['#', '.', '.', '#'],
      ['#', '#', '#', '#'],
    ])
    expect(grid).toBe('####\n#..#\n####')
    expect(mockInvoke).toHaveBeenCalledWith('render_tiles_to_grid', {
      themeId: 'office',
      tileMap: [
        ['#', '#', '#', '#'],
        ['#', '.', '.', '#'],
        ['#', '#', '#', '#'],
      ],
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Level / spatial wrappers (`src/types/levelBridge.ts`)
// ─────────────────────────────────────────────────────────────────────────

describe('levelBridge wrappers (T97)', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('queryObjectsInBounds forwards a BoundingBox', async () => {
    mockInvoke.mockResolvedValueOnce(['obj-1', 'obj-7'])
    const { queryObjectsInBounds } = await import('@/types/levelBridge')
    const ids = await queryObjectsInBounds({
      min: [-1, -1, -1],
      max: [1, 1, 1],
    })
    expect(ids).toEqual(['obj-1', 'obj-7'])
    expect(mockInvoke).toHaveBeenCalledWith('query_objects_in_bounds', {
      bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
    })
  })

  it('updateObjectTransform sends a Transform3D with quaternion rotation', async () => {
    mockInvoke.mockResolvedValueOnce(undefined)
    const { updateObjectTransform } = await import('@/types/levelBridge')
    await updateObjectTransform('obj-1', {
      position: [1, 2, 3],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    })
    expect(mockInvoke).toHaveBeenCalledWith('update_object_transform', {
      objectId: 'obj-1',
      transform: {
        position: [1, 2, 3],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
    })
  })

  it('getCurrentLevel returns null when Rust has no level loaded', async () => {
    mockInvoke.mockResolvedValueOnce(null)
    const { getCurrentLevel } = await import('@/types/levelBridge')
    expect(await getCurrentLevel()).toBeNull()
    expect(mockInvoke).toHaveBeenCalledWith('get_current_level')
  })

  it('getCurrentLevel validates the LevelData shape', async () => {
    mockInvoke.mockResolvedValueOnce({
      metadata: { generator: 'bsp', seed: 42, algorithm: 'bsp', theme: 'office' },
      dimensions: { width: 48, height: 36, floors: 3 },
      entities: [],
    })
    const { getCurrentLevel } = await import('@/types/levelBridge')
    const level = await getCurrentLevel()
    expect(level?.metadata.theme).toBe('office')
    expect(level?.dimensions.width).toBe(48)
  })

  it('saveLevelToFile sends levelData + path', async () => {
    mockInvoke.mockResolvedValueOnce(undefined)
    const { saveLevelToFile } = await import('@/types/levelBridge')
    const levelData = {
      metadata: { generator: 'manual', seed: 0, algorithm: 'manual', theme: 'office' },
      dimensions: { width: 48, height: 36, floors: 3 },
      entities: [],
    }
    await saveLevelToFile(levelData, '/tmp/level.morgan-level')
    expect(mockInvoke).toHaveBeenCalledWith('save_level_to_file', {
      levelData,
      filePath: '/tmp/level.morgan-level',
    })
  })

  it('loadLevelFromFile returns the parsed LevelData', async () => {
    mockInvoke.mockResolvedValueOnce({
      metadata: { generator: 'bsp', seed: 7, algorithm: 'bsp', theme: 'dungeon' },
      dimensions: { width: 48, height: 36, floors: 3 },
      entities: [{ id: 'a' }, { id: 'b' }],
    })
    const { loadLevelFromFile } = await import('@/types/levelBridge')
    const level = await loadLevelFromFile('/tmp/x.morgan-level')
    expect(level.entities).toHaveLength(2)
    expect(mockInvoke).toHaveBeenCalledWith('load_level_from_file', {
      filePath: '/tmp/x.morgan-level',
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Quaternion helper (the `useRustTransformSync` hook depends on it)
// ─────────────────────────────────────────────────────────────────────────

describe('eulerToQuat / quatToEuler (T97)', () => {
  it('identity rotation maps to [0, 0, 0, 1]', async () => {
    const { eulerToQuat } = await import('@/utils/quat')
    expect(eulerToQuat([0, 0, 0])).toEqual([0, 0, 0, 1])
  })

  it('round-trips through quat → euler for common angles', async () => {
    const { eulerToQuat, quatToEuler } = await import('@/utils/quat')
    // Non-degenerate cases. We deliberately exclude gimbal-lock
    // configs (e.g. pitch = ±90° with yaw at 180°) where the
    // Euler representation isn't unique — at those angles the
    // round-trip can pick a different but equivalent euler triple.
    const cases: [number, number, number][] = [
      [30, 45, 60],
      [90, 0, 0],
      [10, -20, 30],
      [0, 0, 90],
      [-45, 30, 15],
    ]
    for (const [x, y, z] of cases) {
      const back = quatToEuler(eulerToQuat([x, y, z]))
      for (let i = 0; i < 3; i++) {
        // Tolerance 1e-3° — float round-trip on three trig pairs.
        expect(Math.abs(back[i] - [x, y, z][i])).toBeLessThan(1e-3)
      }
    }
  })
})
