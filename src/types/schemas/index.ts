// Zod schemas for every Tauri `invoke` return type and request payload.
//
// Why: Tauri IPC is an untrusted network boundary. The Rust side deserialises via
// serde into typed Rust values; the TS side receives JSON. The two type spaces
// drift silently. Validating with zod at the boundary fails loudly at parse time
// rather than producing runtime undefined at the call site.
//
// The shapes here mirror the existing consumer types in `useAssetDatabase.ts` and
// `AssetBrowser.tsx` so the wrappers in `assetDatabase.ts` validate the incoming
// Rust payload without changing the public TS contract.
//
// Reference: docs/dev/typescript-counterintuitive-patterns.md §17.

import { z } from 'zod';

// ─── Primitive aliases ─────────────────────────────────────────────────────────

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3Schema>;

// ─── Asset domain ─────────────────────────────────────────────────────────────

// Mirrors the Rust AssetRecord / AssetMetadata shapes consumed by
// useAssetDatabase.ts and AssetBrowser.tsx.
const AssetRecordSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string(),
  file_path: z.string(),
  asset_type: z.string(),
  collection: z.string(),
  file_size: z.number().int().nonnegative(),
  checksum: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AssetRecord = z.infer<typeof AssetRecordSchema>;

const AssetMetadataSchema = z.object({
  asset_id: z.number().int().nonnegative(),
  key: z.string(),
  value: z.string(),
});
export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;

export const AssetSearchResultSchema = z.object({
  asset: AssetRecordSchema,
  metadata: z.array(AssetMetadataSchema),
  has_thumbnail: z.boolean(),
});
export type AssetSearchResult = z.infer<typeof AssetSearchResultSchema>;

export const CollectionSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string(),
  description: z.string().optional(),
  license_info: z.string().optional(),
  asset_count: z.number().int().nonnegative(),
});
export type Collection = z.infer<typeof CollectionSchema>;

export const DatabaseStatsSchema = z.object({
  total_assets: z.number().int().nonnegative(),
  total_collections: z.number().int().nonnegative(),
  assets_by_type: z.record(z.string(), z.number().int().nonnegative()),
  total_size_bytes: z.number().int().nonnegative(),
  collections: z.record(z.string(), z.number().int().nonnegative()),
});
export type DatabaseStats = z.infer<typeof DatabaseStatsSchema>;

export const ScanResultSchema = z.object({
  total_assets: z.number().int().nonnegative(),
  collections_found: z.array(z.string()),
  assets_by_type: z.record(z.string(), z.number().int().nonnegative()),
  scan_duration_ms: z.number().int().nonnegative(),
  errors: z.array(z.string()),
});
export type ScanResult = z.infer<typeof ScanResultSchema>;

// ─── Generation ───────────────────────────────────────────────────────────────

export const ThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tile_chars: z.record(z.string(), z.string()).optional(),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const LevelDataSchema = z.object({
  metadata: z.object({
    generator: z.string(),
    seed: z.number().int(),
    algorithm: z.string(),
    theme: z.string(),
  }).passthrough(),
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    floors: z.number().int().positive(),
  }).passthrough(),
  entities: z.array(z.object({}).passthrough()),
});
export type LevelData = z.infer<typeof LevelDataSchema>;

// ─── Export ───────────────────────────────────────────────────────────────────

export const ExportResultSchema = z.object({
  exported_files: z.array(z.string()),
  total_objects: z.number().int().nonnegative(),
  export_time_ms: z.number().nonnegative(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  manifest_path: z.string().optional(),
});
export type ExportResult = z.infer<typeof ExportResultSchema>;

// ─── Project file ─────────────────────────────────────────────────────────────

export const ProjectDataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  scene: z.object({}).passthrough(),
  metadata: z.object({}).passthrough().optional(),
});
export type ProjectData = z.infer<typeof ProjectDataSchema>;

// ─── Validation helper ────────────────────────────────────────────────────────

/**
 * Parse a Tauri invoke return value against a schema. Throws on mismatch.
 * Use this in every `tauri.invoke()` wrapper, never at the call site.
 */
export function parseInvoke<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  command: string,
): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Tauri command "${command}" returned an unexpected shape: ${result.error.message}`,
    );
  }
  return result.data;
}
