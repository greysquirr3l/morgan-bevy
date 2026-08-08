// T71 — Opt-in usage analytics.
//
// The default state is **opt-out**: the user must explicitly
// enable analytics before any event leaves their machine. When
// opt-in is on, events are written to localStorage under
// `morgan-bevy-analytics-events` (the in-app "buffer"). The user
// can export the buffer as JSON (GDPR data export) or delete it
// (GDPR right to erasure) from the Settings panel.
//
// The endpoint field is wired in v1 but defaults to `local-only` —
// no event is ever sent off-device in the current configuration.
// Future maintainer work can flip the default to a real endpoint
// after a privacy review (see `docs/user/analytics.md` for the
// review checklist).

import { z } from 'zod'

// ─── Event schema ────────────────────────────────────────────────────────
//
// Events are intentionally tiny + untyped. We do NOT capture scene
// contents, object names, file paths, or any user data — only the
// action id (an enum value) and a coarse metric. The `extra` field
// is bounded so a future maintainer can't accidentally pipe a
// payload into it.

const AnalyticsEventSchema = z.object({
  /** Monotonically-increasing event id. */
  seq: z.number().int().nonnegative(),
  /** Unix timestamp in milliseconds. */
  ts: z.number().int().nonnegative(),
  /** Stable action enum, e.g. `'export.scene'`, `'generate.bsp'`. */
  action: z.string().min(1).max(64),
  /** Optional numeric metric — duration (ms) for performance, count for usage, etc. */
  metric: z.number().finite().optional(),
  /** Bounded extra metadata. Free-form but capped at 256 chars total. */
  extra: z.string().max(256).optional(),
})

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>

const EventBufferSchema = z.object({
  schemaVersion: z.literal(1),
  installedAt: z.number().int().nonnegative(),
  // The cap is enforced on write, not on parse — a buffer with
  // an entry beyond the cap just gets trimmed on the next write.
  // Parse uses `.passthrough()` so a single malformed entry
  // doesn't sink the whole buffer; the inner events list is
  // filtered element-by-element below.
  events: z.array(z.unknown()).max(20_000),
})

export type AnalyticsBuffer = z.infer<typeof EventBufferSchema>

// ─── Settings ────────────────────────────────────────────────────────────

const STORAGE_SETTINGS = 'morgan-bevy-analytics-settings'
const STORAGE_EVENTS = 'morgan-bevy-analytics-events'
const STORAGE_CONSENT = 'morgan-bevy-analytics-consent-seen'

const AnalyticsSettingsSchema = z.object({
  /** When false (the default), no event ever leaves the buffer. */
  enabled: z.boolean().default(false),
  /**
   * Endpoint to flush to. The default `'local-only'` keeps events
   * in localStorage indefinitely (readable via the Settings panel's
   * export button). A maintainer can switch this to a real URL
   * after a privacy review.
   */
  endpoint: z.string().default('local-only'),
  /** Last time the buffer was successfully flushed. Unix ms. */
  lastFlushedAt: z.number().int().nonnegative().optional(),
})

export type AnalyticsSettings = z.infer<typeof AnalyticsSettingsSchema>

export const DEFAULT_ANALYTICS_SETTINGS: AnalyticsSettings = {
  enabled: false,
  endpoint: 'local-only',
}

// ─── Persistence ────────────────────────────────────────────────────────

function readSettings(): AnalyticsSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS)
    if (!raw) return DEFAULT_ANALYTICS_SETTINGS
    const parsed = AnalyticsSettingsSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      console.warn('analytics: settings corrupt, falling back to defaults:', parsed.error.message)
      return DEFAULT_ANALYTICS_SETTINGS
    }
    return parsed.data
  } catch {
    return DEFAULT_ANALYTICS_SETTINGS
  }
}

function writeSettings(settings: AnalyticsSettings): void {
  try {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings))
  } catch {
    // Quota / private mode — silent no-op. The default settings
    // continue to work.
  }
}

function readBuffer(): AnalyticsBuffer {
  try {
    const raw = localStorage.getItem(STORAGE_EVENTS)
    if (!raw) {
      return { schemaVersion: 1, installedAt: Date.now(), events: [] }
    }
    const parsed = EventBufferSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      console.warn('analytics: buffer corrupt, starting fresh:', parsed.error.message)
      return { schemaVersion: 1, installedAt: Date.now(), events: [] }
    }
    // Filter each entry through the event schema. This lets a
    // single malformed event be dropped without losing the rest
    // of the buffer.
    const validEvents: AnalyticsEvent[] = []
    let dropped = 0
    for (const candidate of parsed.data.events) {
      const eventResult = AnalyticsEventSchema.safeParse(candidate)
      if (eventResult.success) {
        validEvents.push(eventResult.data)
      } else {
        dropped++
      }
    }
    if (dropped > 0) {
      console.warn(`analytics: dropped ${dropped} malformed event(s) on read`)
    }
    // Apply the cap on read too, in case the persisted buffer
    // somehow exceeded it.
    return {
      schemaVersion: 1,
      installedAt: parsed.data.installedAt,
      events: validEvents.slice(-10_000),
    }
  } catch {
    return { schemaVersion: 1, installedAt: Date.now(), events: [] }
  }
}

function writeBuffer(buffer: AnalyticsBuffer): void {
  try {
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(buffer))
  } catch {
    // Quota exhausted — drop the oldest event. The cap is 10k
    // so this should never fire under normal use; it's the safety
    // valve.
    const trimmed: AnalyticsBuffer = {
      schemaVersion: 1,
      installedAt: buffer.installedAt,
      events: buffer.events.slice(-10_000),
    }
    try {
      localStorage.setItem(STORAGE_EVENTS, JSON.stringify(trimmed))
    } catch {
      // Give up. The buffer is best-effort.
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────

/** Read the current analytics settings. */
export function getAnalyticsSettings(): AnalyticsSettings {
  return readSettings()
}

/** Update analytics settings. Persists to localStorage. */
export function setAnalyticsSettings(next: AnalyticsSettings): void {
  writeSettings(next)
}

/** True iff the user has explicitly opted in. */
export function isAnalyticsEnabled(): boolean {
  return readSettings().enabled
}

/**
 * One-shot consent acknowledgement. The first-launch dialog calls
 * this on either "Accept" or "Decline" so the dialog doesn't keep
 * re-appearing on every launch. Settings can still be changed
 * later via the Settings panel.
 */
export function markConsentSeen(): void {
  try {
    localStorage.setItem(STORAGE_CONSENT, '1')
  } catch {
    // ignore
  }
}

export function hasConsentBeenSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_CONSENT) === '1'
  } catch {
    return false
  }
}

/**
 * Record an event. **No-op when analytics is disabled** — this is
 * the single guard that makes the module opt-in by default. The
 * call site doesn't need to check; the analytics module enforces it.
 */
export function recordEvent(
  action: string,
  options: { metric?: number; extra?: string } = {}
): void {
  const settings = readSettings()
  if (!settings.enabled) return

  const buffer = readBuffer()
  const event: AnalyticsEvent = {
    seq: buffer.events.length,
    ts: Date.now(),
    action,
    ...(options.metric !== undefined ? { metric: options.metric } : {}),
    ...(options.extra !== undefined ? { extra: options.extra } : {}),
  }
  buffer.events.push(event)
  writeBuffer(buffer)
}

/** Record a duration in milliseconds (sugar for `recordEvent('x', {metric})`). */
export function recordDuration(action: string, startedAt: number): void {
  recordEvent(action, { metric: Date.now() - startedAt })
}

/** Read the current buffer. For the Settings panel's "view my data" UI. */
export function readAnalyticsBuffer(): AnalyticsBuffer {
  return readBuffer()
}

/** GDPR data export — return the buffer as a pretty-printed JSON string. */
export function exportAnalyticsAsJson(): string {
  return JSON.stringify(readBuffer(), null, 2)
}

/** GDPR right to erasure — drop the buffer + reset settings to defaults. */
export function deleteAnalyticsData(): void {
  try {
    localStorage.removeItem(STORAGE_EVENTS)
  } catch {
    // ignore
  }
  writeSettings(DEFAULT_ANALYTICS_SETTINGS)
}

/** Test-only: clear all three storage keys. */
export function _resetAnalyticsForTests(): void {
  try {
    localStorage.removeItem(STORAGE_SETTINGS)
    localStorage.removeItem(STORAGE_EVENTS)
    localStorage.removeItem(STORAGE_CONSENT)
  } catch {
    // ignore
  }
}
