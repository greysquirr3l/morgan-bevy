// T61 — bundled example projects.
//
// Four hand-authored project files under `src/data/examples/` —
// Office, Dungeon, Castle, SciFi — each demonstrating a different
// editor feature (prefabs, BSP-style layout, multi-floor layout,
// T91 lighting markers respectively). The library is bundled at
// build time via Vite's `import.meta.glob` (eager, default-import)
// — the same pattern used by `src/data/prefabs/`.
//
// Each example's metadata is extracted from the project file's
// `metadata.name` + `metadata.description` fields. The example's
// `id` is the file's basename without the `.example.json` suffix.

import { ProjectDataSchema, type ProjectData } from '@/types/schemas'

export interface ExampleLevelMeta {
  /** Stable id derived from the filename (`office`, `dungeon`, ...). */
  readonly id: string
  /** Display name shown in the Templates menu. */
  readonly name: string
  /** Short description of what the example demonstrates. */
  readonly description: string
  /** The parsed `ProjectData` payload — ready to feed into the
   *  existing `applyProjectDataToStore` helper in `FileMenu.tsx`. */
  readonly projectData: ProjectData
}

// Vite's `import.meta.glob` with `eager: true` inlines every
// `*.example.json` file under `src/data/examples/` at build time.
// The result is a plain map of path -> parsed JSON value.
const EXAMPLE_MODULES = import.meta.glob<{ default: ProjectData }>(
  '../data/examples/*.example.json',
  { eager: true }
)

const META_SUFFIX = '.example.json'

/**
 * T61: load the bundled example projects. Each entry has been
 * parsed by Vite's JSON importer, but the boundary is still
 * untrusted (a hand-edited file could be malformed) — we trust
 * only the Vite parse plus the metadata-string check; everything
 * else flows through `ProjectDataSchema.safeParse` at load time.
 *
 * Drops anything that fails the light validation with a
 * `console.warn` — one bad file must not sink the whole menu.
 */
export function loadExampleLevels(): ExampleLevelMeta[] {
  const out: ExampleLevelMeta[] = []
  for (const [path, mod] of Object.entries(EXAMPLE_MODULES)) {
    const fileName = path.split('/').pop() ?? path
    if (!fileName.endsWith(META_SUFFIX)) continue
    const id = fileName.slice(0, -META_SUFFIX.length)
    const candidate = mod.default

    const meta = candidate.metadata as { name?: unknown; description?: unknown } | undefined
    const name = typeof meta?.name === 'string' ? meta.name : id
    const description = typeof meta?.description === 'string' ? meta.description : ''

    // Bare-minimum validation: schemaVersion must be a positive
    // integer and scene must be an object. Anything more rigorous
    // lives in `ProjectDataSchema.safeParse` at load time (T20).
    const scene = (candidate as { scene?: unknown }).scene
    const schemaVersion = (candidate as { schemaVersion?: unknown }).schemaVersion
    if (
      typeof schemaVersion !== 'number' ||
      !Number.isInteger(schemaVersion) ||
      schemaVersion < 1
    ) {
      console.warn(`exampleLevels: dropping ${fileName} — invalid schemaVersion`)
      continue
    }
    if (typeof scene !== 'object' || scene === null) {
      console.warn(`exampleLevels: dropping ${fileName} — missing scene`)
      continue
    }

    out.push({
      id,
      name,
      description,
      projectData: candidate,
    })
  }
  // Stable order: by id. The menu always shows examples in the
  // same order regardless of glob resolution order.
  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
}

/**
 * T61: validate a payload against the canonical schema. Returns
 * the parsed data on success; returns `null` (with a `console.warn`)
 * on schema drift so a future schema bump doesn't crash the editor.
 */
export function parseExampleProject(raw: unknown): ProjectData | null {
  const result = ProjectDataSchema.safeParse(raw)
  if (!result.success) {
    console.warn('exampleLevels: project schema drift:', result.error.message)
    return null
  }
  return result.data
}
