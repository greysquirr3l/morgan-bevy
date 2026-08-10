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

import { z } from 'zod'

// ─── Primitive aliases ─────────────────────────────────────────────────────────

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()])
export type Vec3 = z.infer<typeof Vec3Schema>

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
})
export type AssetRecord = z.infer<typeof AssetRecordSchema>

const AssetMetadataSchema = z.object({
  asset_id: z.number().int().nonnegative(),
  key: z.string(),
  value: z.string(),
})
export type AssetMetadata = z.infer<typeof AssetMetadataSchema>

export const AssetSearchResultSchema = z.object({
  asset: AssetRecordSchema,
  metadata: z.array(AssetMetadataSchema),
  has_thumbnail: z.boolean(),
})
export type AssetSearchResult = z.infer<typeof AssetSearchResultSchema>

export const CollectionSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string(),
  description: z.string().optional(),
  license_info: z.string().optional(),
  asset_count: z.number().int().nonnegative(),
})
export type Collection = z.infer<typeof CollectionSchema>

export const DatabaseStatsSchema = z.object({
  total_assets: z.number().int().nonnegative(),
  total_collections: z.number().int().nonnegative(),
  assets_by_type: z.record(z.string(), z.number().int().nonnegative()),
  total_size_bytes: z.number().int().nonnegative(),
  collections: z.record(z.string(), z.number().int().nonnegative()),
})
export type DatabaseStats = z.infer<typeof DatabaseStatsSchema>

export const ScanResultSchema = z.object({
  total_assets: z.number().int().nonnegative(),
  collections_found: z.array(z.string()),
  assets_by_type: z.record(z.string(), z.number().int().nonnegative()),
  scan_duration_ms: z.number().int().nonnegative(),
  errors: z.array(z.string()),
})
export type ScanResult = z.infer<typeof ScanResultSchema>

// ─── Generation ───────────────────────────────────────────────────────────────

export const ThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tile_chars: z.record(z.string(), z.string()).optional(),
})
export type Theme = z.infer<typeof ThemeSchema>

export const LevelDataSchema = z.object({
  metadata: z
    .object({
      generator: z.string(),
      seed: z.number().int(),
      algorithm: z.string(),
      theme: z.string(),
    })
    .passthrough(),
  dimensions: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      floors: z.number().int().positive(),
    })
    .passthrough(),
  entities: z.array(z.object({}).passthrough()),
})
export type LevelData = z.infer<typeof LevelDataSchema>

// ─── Export ───────────────────────────────────────────────────────────────────

export const ExportResultSchema = z.object({
  exported_files: z.array(z.string()),
  total_objects: z.number().int().nonnegative(),
  export_time_ms: z.number().nonnegative(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  manifest_path: z.string().optional(),
})
export type ExportResult = z.infer<typeof ExportResultSchema>

// ─── Project file ─────────────────────────────────────────────────────────────

export const ProjectDataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  scene: z.object({}).passthrough(),
  metadata: z.object({}).passthrough().optional(),
})
export type ProjectData = z.infer<typeof ProjectDataSchema>

// ─── Marker schemas (T91a) ────────────────────────────────────────────────────
//
// Wire format mirrors the Rust enums in src-tauri/src/export/exporters.rs:
//   #[serde(tag = "kind", rename_all = "snake_case")]
// …so `kind` is the discriminant and every variant name is snake_case
// (play_once, one_shot). Field names are also snake_case (inner_angle,
// outer_angle) and cross the IPC boundary verbatim. camelCase variants
// or fields are rejected by the schema — which is the safety net for
// "someone typoed this in editor code and the level silently dropped
// its animation marker on the Rust side."
//
// The TS mirror types in `src/types/markers.ts` are written by hand to
// keep the marker shape co-located with the four KIND literal tables —
// this file focuses on the *runtime* validation. The two are kept in
// sync by `src/test/markerTypes.test.ts`.

const Vec2Schema = z.tuple([z.number(), z.number()])

// `.strict()` on every variant is the IPC-boundary safety net: any
// unknown field on the wire (typo, camelCase drift, extra fields from
// a forward-compat Rust feature) fails validation instead of being
// silently stripped. The project rule is "fail loudly at parse time,
// not silently at runtime" — and a partially-stripped marker is exactly
// the kind of silent failure that turns into a missing animation on
// a saved level with no trace in the editor.

const LightPointSchema = z
  .object({
    kind: z.literal('point'),
    color: Vec3Schema,
    intensity: z.number(),
    range: z.number(),
    shadows: z.boolean(),
  })
  .strict()

const LightSpotSchema = z
  .object({
    kind: z.literal('spot'),
    color: Vec3Schema,
    intensity: z.number(),
    range: z.number(),
    inner_angle: z.number(),
    outer_angle: z.number(),
    shadows: z.boolean(),
  })
  .strict()

const LightDirectionalSchema = z
  .object({
    kind: z.literal('directional'),
    color: Vec3Schema,
    intensity: z.number(),
    shadows: z.boolean(),
  })
  .strict()

export const LightMarkerSchema = z.discriminatedUnion('kind', [
  LightPointSchema,
  LightSpotSchema,
  LightDirectionalSchema,
])
export type LightMarkerInput = z.infer<typeof LightMarkerSchema>

const AnimationPlaySchema = z
  .object({
    kind: z.literal('play'),
    clip: z.string(),
    repeat: z.boolean(),
    speed: z.number(),
  })
  .strict()

const AnimationPlayOnceSchema = z
  .object({
    kind: z.literal('play_once'),
    clip: z.string(),
  })
  .strict()

export const AnimationMarkerSchema = z.discriminatedUnion('kind', [
  AnimationPlaySchema,
  AnimationPlayOnceSchema,
])
export type AnimationMarkerInput = z.infer<typeof AnimationMarkerSchema>

const AudioAmbientSchema = z
  .object({
    kind: z.literal('ambient'),
    path: z.string(),
    volume: z.number(),
    looping: z.boolean(),
  })
  .strict()

const AudioOneShotSchema = z
  .object({
    kind: z.literal('one_shot'),
    path: z.string(),
    volume: z.number(),
  })
  .strict()

export const AudioMarkerSchema = z.discriminatedUnion('kind', [
  AudioAmbientSchema,
  AudioOneShotSchema,
])
export type AudioMarkerInput = z.infer<typeof AudioMarkerSchema>

const VfxParticleSchema = z
  .object({
    kind: z.literal('particle'),
    path: z.string(),
    count: z.number().int().nonnegative(),
  })
  .strict()

const VfxBillboardSchema = z
  .object({
    kind: z.literal('billboard'),
    texture: z.string(),
    size: Vec2Schema,
  })
  .strict()

export const VfxMarkerSchema = z.discriminatedUnion('kind', [VfxParticleSchema, VfxBillboardSchema])
export type VfxMarkerInput = z.infer<typeof VfxMarkerSchema>

// ─── Navigation mesh (T56) ──────────────────────────────────────────────────────
//
// Wire format mirrors `src-tauri/src/spatial/navmesh.rs`. Unlike the marker
// enums above, `ObstacleKind` / `OffMeshConnectionKind` are plain
// `#[serde(rename_all = "snake_case")]` unit enums (no `tag`), so they
// serialize as bare strings (`"wall"`, `"free_standing"`) rather than
// `{ kind: "..." }` objects — `z.enum(...)`, not `z.discriminatedUnion(...)`.

export const NavWalkableSurfaceSchema = z
  .object({
    min: Vec2Schema,
    max: Vec2Schema,
    height: z.number(),
  })
  .strict()
export type NavWalkableSurface = z.infer<typeof NavWalkableSurfaceSchema>

export const NavObstacleKindSchema = z.enum(['wall', 'free_standing'])
export type NavObstacleKind = z.infer<typeof NavObstacleKindSchema>

export const NavObstacleInputSchema = z
  .object({
    min: Vec2Schema,
    max: Vec2Schema,
    kind: NavObstacleKindSchema,
  })
  .strict()
export type NavObstacleInput = z.infer<typeof NavObstacleInputSchema>

export const NavPolygonSchema = z
  .object({
    id: z.number().int().nonnegative(),
    vertex_indices: z.array(z.number().int().nonnegative()),
    triangle_indices: z.array(z.number().int().nonnegative()),
  })
  .strict()
export type NavPolygon = z.infer<typeof NavPolygonSchema>

export const NavObstacleSchema = z
  .object({
    min: Vec3Schema,
    max: Vec3Schema,
  })
  .strict()
export type NavObstacle = z.infer<typeof NavObstacleSchema>

export const NavConnectionSchema = z
  .object({
    polygon_a: z.number().int().nonnegative(),
    polygon_b: z.number().int().nonnegative(),
    portal: z.tuple([Vec3Schema, Vec3Schema]),
  })
  .strict()
export type NavConnection = z.infer<typeof NavConnectionSchema>

export const OffMeshConnectionKindSchema = z.enum(['jump', 'ladder', 'teleport'])
export type OffMeshConnectionKind = z.infer<typeof OffMeshConnectionKindSchema>

export const OffMeshConnectionSchema = z
  .object({
    start: Vec3Schema,
    end: Vec3Schema,
    kind: OffMeshConnectionKindSchema,
    bidirectional: z.boolean(),
  })
  .strict()
export type OffMeshConnection = z.infer<typeof OffMeshConnectionSchema>

export const NavMeshSchema = z
  .object({
    vertices: z.array(Vec3Schema),
    polygons: z.array(NavPolygonSchema),
    obstacles: z.array(NavObstacleSchema),
    connections: z.array(NavConnectionSchema),
    off_mesh_connections: z.array(OffMeshConnectionSchema),
  })
  .strict()
export type NavMesh = z.infer<typeof NavMeshSchema>

// ─── Validation helper ────────────────────────────────────────────────────────

/**
 * Parse a Tauri invoke return value against a schema. Throws on mismatch.
 * Use this in every `tauri.invoke()` wrapper, never at the call site.
 */
export function parseInvoke<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  command: string
): z.infer<S> {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new Error(
      `Tauri command "${command}" returned an unexpected shape: ${result.error.message}`
    )
  }
  return result.data
}

// ─── Spatial / Scene primitives ───────────────────────────────────────────────
//
// These mirror the Rust `Transform3D` and `BoundingBox` shapes
// consumed by `query_objects_in_bounds` and `update_object_transform`.
// Keep in sync with `src-tauri/src/main.rs::Transform3D` and
// `src-tauri/src/spatial/mod.rs::BoundingBox`.

export const Transform3DSchema = z.object({
  position: Vec3Schema,
  // Quaternion [x, y, z, w] for smooth interpolation.
  rotation: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  scale: Vec3Schema,
})
export type Transform3D = z.infer<typeof Transform3DSchema>

export const BoundingBoxSchema = z.object({
  min: Vec3Schema,
  max: Vec3Schema,
})
export type BoundingBox = z.infer<typeof BoundingBoxSchema>

// ─── Theme shapes ────────────────────────────────────────────────────────────
//
// The Rust `Theme` struct (src-tauri/src/generation/themes.rs) is
// richer than the `Theme` we previously declared — it carries
// lighting, materials, and mesh variants. We expose the full shape
// here so `get_theme_by_id` and `get_theme_legend` can validate
// the response, while the legacy `ThemeSchema` (above) keeps the
// minimal subset for callers that only need `id` / `name`.

export const ThemeLightingSchema = z.object({
  ambient_color: z.tuple([z.number(), z.number(), z.number()]),
  ambient_intensity: z.number(),
  directional_color: z.tuple([z.number(), z.number(), z.number()]),
  directional_intensity: z.number(),
  directional_direction: z.tuple([z.number(), z.number(), z.number()]),
  shadow_enabled: z.boolean(),
})
export type ThemeLighting = z.infer<typeof ThemeLightingSchema>

export const MaterialInfoSchema = z.object({
  diffuse: z.string().nullable().optional(),
  normal: z.string().nullable().optional(),
  metallic: z.string().nullable().optional(),
  roughness: z.string().nullable().optional(),
  emission: z.string().nullable().optional(),
})
export type MaterialInfo = z.infer<typeof MaterialInfoSchema>

export const TileDefinitionSchema = z
  .object({
    tile_type: z.string(),
    name: z.string(),
    description: z.string(),
    visual: z.object({}).passthrough(),
    mesh: z.unknown().nullable().optional(),
    collision: z.boolean().optional(),
    walkable: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough()
export type TileDefinition = z.infer<typeof TileDefinitionSchema>

export const FullThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  author: z.string(),
  version: z.string(),
  tiles: z.record(z.string(), TileDefinitionSchema),
  default_floor_height: z.number(),
  wall_height: z.number(),
  lighting: ThemeLightingSchema,
  materials: z.record(z.string(), MaterialInfoSchema),
  mesh_variants: z.record(z.string(), z.array(z.string())),
})
export type FullTheme = z.infer<typeof FullThemeSchema>

// ─── Asset import shapes ─────────────────────────────────────────────────────
//
// Mirrors the Rust `ImportSettings` / `ImportEntry` / `ImportResult`
// shapes (src-tauri/src/assets/import.rs). Used by `import_assets`.

export const ImportSettingsSchema = z.object({
  texture_max_size: z.number().int().nonnegative().default(0),
  texture_quality: z.number().int().min(0).max(100).default(80),
  skip_invalid: z.boolean().default(false),
})
export type ImportSettings = z.infer<typeof ImportSettingsSchema>

export const ImportEntrySchema = z.object({
  source: z.string(),
  destination: z.string(),
  error: z.string().optional(),
})
export type ImportEntry = z.infer<typeof ImportEntrySchema>

export const ImportResultSchema = z.object({
  entries: z.array(ImportEntrySchema),
  transformed: z.number().int().nonnegative(),
})
export type ImportResult = z.infer<typeof ImportResultSchema>
