// T35 — Asset import pipeline settings + result types.
//
// Mirrors the Rust types in `src-tauri/src/assets/import.rs`. The
// settings are persisted on the project file under
// `metadata.importSettings` (see `withImportSettings` /
// `readImportSettings` below), so a project that travels between
// machines keeps its import configuration.
//
// The defaults match the Rust `ImportSettings::default()` — empty
// project files get the same behaviour as a project with no
// settings block at all.

import { z } from 'zod'

import { ProjectDataSchema } from '@/types/schemas'

/// Per-project import settings. Persisted on the project file so a
/// project that's opened on another machine reproduces the same
/// behaviour.
export interface ImportSettings {
  /** Longest edge after compression. 0 = no resize. */
  readonly textureMaxSize: number
  /** WebP quality 0..100. Default 80. */
  readonly textureQuality: number
  /** If true, invalid files are skipped instead of failing the
   *  batch. Default false (fail-fast is easier to debug). */
  readonly skipInvalid: boolean
}

const ImportSettingsSchema = z
  .object({
    textureMaxSize: z.number().int().nonnegative().default(0),
    textureQuality: z.number().int().min(0).max(100).default(80),
    skipInvalid: z.boolean().default(false),
  })
  .strict()

/// Parse a settings blob that came out of `metadata.importSettings`.
/// Falls back to defaults on a `null`/`undefined`/missing key so
/// pre-T35 project files import cleanly.
export function parseImportSettings(raw: unknown): ImportSettings {
  if (raw === null || raw === undefined) return defaultImportSettings()
  const parsed = ImportSettingsSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn('parseImportSettings: invalid settings, falling back to defaults:', parsed.error.message)
    return defaultImportSettings()
  }
  return {
    textureMaxSize: parsed.data.textureMaxSize,
    textureQuality: parsed.data.textureQuality,
    skipInvalid: parsed.data.skipInvalid,
  }
}

export function defaultImportSettings(): ImportSettings {
  return { textureMaxSize: 0, textureQuality: 80, skipInvalid: false }
}

/// One entry in a batch import result. Mirrors `ImportEntry`.
export interface ImportEntry {
  /** Original source path. */
  readonly source: string
  /** Final destination — cache path if transformed, source if
   *  passed through. */
  readonly destination: string
  /** Validation / conversion error, if any. */
  readonly error?: string
}

/// Aggregate result of a batch import. Mirrors `ImportResult`.
export interface ImportResult {
  readonly entries: ImportEntry[]
  /** Count of entries that ran the transform pipeline (vs. passed
   *  through). */
  readonly transformed: number
}

// ─── Project-file persistence ────────────────────────────────────────────────
//
// The settings live on `ProjectData.metadata.importSettings`. We
// reuse the existing `metadata.passthrough()` shape (T20) and add
// a single key. Future import types (model conversion, audio
// re-encoding) plug into the same `importSettings` object without
// bumping the project schema version.

/**
 * Inject import settings into a `ProjectData.metadata` field,
 * leaving every other key intact. Returns a new object.
 */
export function withImportSettings(projectData: ProjectData, settings: ImportSettings): ProjectData {
  const metadata = (projectData.metadata ?? {}) as Record<string, unknown>
  return {
    ...projectData,
    metadata: {
      ...metadata,
      importSettings: settings,
    },
  }
}

/**
 * Pluck the import settings out of a parsed project payload.
 * Falls back to defaults on missing / malformed data so legacy
 * project files load with the same behaviour as a fresh project.
 */
export function readImportSettings(projectData: ProjectData): ImportSettings {
  const metadata = projectData.metadata as
    | (Record<string, unknown> & { importSettings?: unknown })
    | undefined
  return parseImportSettings(metadata?.importSettings)
}

interface ProjectData {
  schemaVersion: number
  scene: Record<string, unknown>
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

// Re-export the parsed-project schema type so consumers don't have
// to import from `@/types/schemas` directly for typing.
export type { ProjectData }

// Use a relaxed parse just for typing — the boundary parse is
// `ProjectDataSchema.parse(raw)`.
export function parseProjectData(raw: unknown): ProjectData | null {
  const result = ProjectDataSchema.safeParse(raw)
  if (!result.success) return null
  return result.data as unknown as ProjectData
}