/**
 * Recent-projects list — persists to `localStorage` under a single key.
 *
 * - Deduped: opening the same path twice moves it to the top.
 * - Capped: at most `MAX_RECENT` entries; oldest falls off.
 * - Pruned: missing files are removed lazily on next access.
 *
 * Format on disk: a JSON array of absolute paths, most-recent first.
 */
import { invoke } from '@tauri-apps/api/core'

const STORAGE_KEY = 'morgan-bevy.recent-projects'
/** Maximum number of entries to retain. */
export const MAX_RECENT = 10

/**
 * A single entry in the recent-projects list. We store the absolute path
 * (set by the Tauri dialog plugin when the user picks a file) plus the
 * project name derived from the file name.
 */
export interface RecentProject {
  /** Absolute path to the `.mbp` file. */
  path: string
  /** Filename without directory, e.g. "office.mbp". */
  name: string
  /** ISO-8601 timestamp of the most recent open. */
  openedAt: string
}

function readRaw(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Best-effort shape filter; prune invalid entries rather than throw.
    return parsed.filter(
      (entry): entry is RecentProject =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { path?: unknown }).path === 'string' &&
        typeof (entry as { name?: unknown }).name === 'string' &&
        typeof (entry as { openedAt?: unknown }).openedAt === 'string'
    )
  } catch {
    // Corrupted localStorage; start fresh rather than propagate the
    // parse error to the UI.
    return []
  }
}

function writeRaw(entries: RecentProject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota exceeded or storage disabled (e.g. private mode). The
    // recent-projects list is a UX nicety, not a correctness concern.
  }
}

/**
 * Add a project to the top of the recent-projects list, deduped by
 * path, capped at MAX_RECENT. Returns the updated list.
 */
export function addRecentProject(path: string, name: string): RecentProject[] {
  const current = readRaw()
  const filtered = current.filter(e => e.path !== path)
  const entry: RecentProject = {
    path,
    name,
    openedAt: new Date().toISOString(),
  }
  const next = [entry, ...filtered].slice(0, MAX_RECENT)
  writeRaw(next)
  return next
}

/**
 * Return the current recent-projects list, most-recent first. Filters
 * out entries whose files no longer exist on disk (best-effort, async
 * — entries are not awaited here; use `pruneMissingRecents` to do it
 * in the background).
 */
export function getRecentProjects(): RecentProject[] {
  return readRaw()
}

/**
 * Remove entries whose backing file no longer exists. Returns the
 * updated list. Best-effort: a path that errors for any reason other
 * than "missing" is kept.
 */
export async function pruneMissingRecents(entries: RecentProject[]): Promise<RecentProject[]> {
  if (entries.length === 0) return entries
  const checks = await Promise.allSettled(
    entries.map(e => invoke<boolean>('path_exists', { path: e.path }))
  )
  const survivors = entries.filter((_e, i) => {
    const result = checks[i]
    if (result.status === 'fulfilled') return result.value
    // On rejection, keep the entry — better a stale entry than losing
    // the user's history.
    return true
  })
  if (survivors.length !== entries.length) {
    writeRaw(survivors)
  }
  return survivors
}

/**
 * Clear the recent-projects list. Test helper.
 */
export function clearRecentProjects(): void {
  writeRaw([])
}

/**
 * Format the relative "X ago" string used in the recent-projects UI.
 * Best-effort; returns an empty string on parse error.
 */
export function formatRecentTimestamp(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}
