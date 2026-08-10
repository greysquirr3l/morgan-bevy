/**
 * T97 — Theme command wrappers
 *
 * These three Tauri commands were defined on the Rust side but
 * had no front-end callers. Now they do — `getThemeById` is the
 * primary way to fetch the full theme shape (lighting, materials,
 * mesh variants) for the Grid View / Inspector. `getThemeLegend`
 * produces a human-readable legend string used by the tile
 * palette tooltip. `renderTilesToGrid` round-trips a 2D tile
 * array back to its source string (the inverse of
 * `parse_grid_to_tiles`), useful for the "import from clipboard"
 * path.
 */
import { FullThemeSchema, parseInvoke, type FullTheme } from './schemas'

/**
 * Fetch the full `Theme` shape for `theme_id`. Returns `null` if
 * the theme isn't in the library — callers should fall back to the
 * default theme in that case.
 */
export async function getThemeById(themeId: string): Promise<FullTheme | null> {
  const { invoke } = await import('@tauri-apps/api/core')
  try {
    const raw = await invoke<unknown>('get_theme_by_id', { themeId })
    return parseInvoke(FullThemeSchema, raw, 'get_theme_by_id')
  } catch (e) {
    // Rust returns `Err("Theme not found: {id}")` for missing
    // themes; we surface that as `null` rather than a thrown
    // exception so callers can chain to a fallback theme.
    if (e instanceof Error && e.message.startsWith('Theme not found')) {
      return null
    }
    throw e
  }
}

/**
 * Render the theme's tile legend — a human-readable legend of
 * which character maps to which tile type. Surfaced as the
 * `title` attribute on the Grid View palette buttons.
 */
export async function getThemeLegend(themeId: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string>('get_theme_legend', { themeId })
}

/**
 * Inverse of `parse_grid_to_tiles`: take a 2D tile map (one
 * character per cell) and serialise it back to the grid-string
 * format the editor stores. Used by the copy / paste round-trip
 * and by the "import level from text" dialog.
 */
export async function renderTilesToGrid(themeId: string, tileMap: string[][]): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core')
  const raw = await invoke<unknown>('render_tiles_to_grid', {
    themeId,
    tileMap,
  })
  // The Rust side returns `Result<String, String>`. The error path
  // (theme not found) propagates through the catch as a thrown
  // exception; the success path is a plain string.
  if (typeof raw !== 'string') {
    throw new Error(
      `Tauri command "render_tiles_to_grid" returned a non-string shape: ${JSON.stringify(raw)}`
    )
  }
  return raw
}

// Re-export for callers that already import from this module.
export type { FullTheme }
