import { describe, it, expect } from 'vitest';
import {
  AssetSearchResultSchema,
  CollectionSchema,
  DatabaseStatsSchema,
  ScanResultSchema,
  parseInvoke,
} from '../types/schemas';
import { AssetSearchParamsSchema } from '../types/assetDatabase';

describe('Tauri IPC zod schemas (T76)', () => {
  it('AssetSearchResultSchema accepts a valid result with nested asset', () => {
    const valid = {
      asset: {
        id: 1,
        name: 'wall.gltf',
        file_path: '/assets/wall.gltf',
        asset_type: 'model',
        collection: 'default',
        file_size: 12345,
        checksum: 'abc123',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      },
      metadata: [{ asset_id: 1, key: 'author', value: 'me' }],
      has_thumbnail: true,
    };
    expect(AssetSearchResultSchema.safeParse(valid).success).toBe(true);
  });

  it('AssetSearchResultSchema rejects a result missing nested asset', () => {
    const broken = {
      metadata: [],
      has_thumbnail: false,
    };
    expect(AssetSearchResultSchema.safeParse(broken).success).toBe(false);
  });

  it('AssetSearchResultSchema rejects nested asset with wrong field type', () => {
    const broken = {
      asset: {
        id: 'not-a-number',
        name: 'wall.gltf',
        file_path: '/assets/wall.gltf',
        asset_type: 'model',
        collection: 'default',
        file_size: 12345,
        checksum: 'abc',
        created_at: 'x',
        updated_at: 'x',
      },
      metadata: [],
      has_thumbnail: false,
    };
    expect(AssetSearchResultSchema.safeParse(broken).success).toBe(false);
  });

  it('AssetSearchParamsSchema accepts a minimal query', () => {
    expect(AssetSearchParamsSchema.safeParse({ query: 'wall' }).success).toBe(true);
  });

  it('AssetSearchParamsSchema rejects a missing query', () => {
    expect(AssetSearchParamsSchema.safeParse({}).success).toBe(false);
  });

  it('CollectionSchema accepts a valid collection with optional fields', () => {
    expect(
      CollectionSchema.safeParse({
        id: 1,
        name: 'Models',
        asset_count: 100,
      }).success,
    ).toBe(true);
    expect(
      CollectionSchema.safeParse({
        id: 1,
        name: 'Models',
        asset_count: 100,
        description: 'A collection',
        license_info: 'MIT',
      }).success,
    ).toBe(true);
  });

  it('CollectionSchema rejects negative asset_count', () => {
    expect(
      CollectionSchema.safeParse({
        id: 1,
        name: 'Models',
        asset_count: -1,
      }).success,
    ).toBe(false);
  });

  it('DatabaseStatsSchema accepts a valid stats payload', () => {
    expect(
      DatabaseStatsSchema.safeParse({
        total_assets: 1000,
        total_collections: 5,
        assets_by_type: { model: 800, texture: 200 },
        total_size_bytes: 1024,
        collections: { default: 800, models: 200 },
      }).success,
    ).toBe(true);
  });

  it('ScanResultSchema accepts a valid scan result', () => {
    expect(
      ScanResultSchema.safeParse({
        total_assets: 1000,
        collections_found: ['default'],
        assets_by_type: { model: 800 },
        scan_duration_ms: 42,
        errors: [],
      }).success,
    ).toBe(true);
  });

  it('parseInvoke returns parsed data on success', () => {
    const raw = {
      asset: {
        id: 1, name: 'y', file_path: '/z', asset_type: 'model',
        collection: 'default', file_size: 1, checksum: 'x',
        created_at: '2025', updated_at: '2025',
      },
      metadata: [],
      has_thumbnail: false,
    };
    const result = parseInvoke(AssetSearchResultSchema, raw, 'test_command');
    expect(result.asset.name).toBe('y');
  });

  it('parseInvoke throws on malformed payload', () => {
    expect(() => parseInvoke(AssetSearchResultSchema, { broken: true }, 'bad_command')).toThrow(
      /bad_command/,
    );
  });

  it('parseInvoke throws helpfully on a real-world drift case', () => {
    // What if the Rust side renames `asset.file_path` to `asset.path`?
    // Old code that trusted the type would silently produce undefined.
    // With zod, we catch it at parse time.
    const drifted = {
      asset: {
        id: 1, name: 'y', path: '/z', // <-- renamed
        asset_type: 'model', collection: 'default',
        file_size: 1, checksum: 'x',
        created_at: '2025', updated_at: '2025',
      },
      metadata: [],
      has_thumbnail: false,
    };
    expect(() => parseInvoke(AssetSearchResultSchema, drifted, 'search_assets_database')).toThrow(
      /file_path/,
    );
  });
});
