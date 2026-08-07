/**
 * Tests for the updater helpers (T68).
 *
 * The plugin itself (`@tauri-apps/plugin-updater`) is mocked so we
 * exercise the wrapper without needing a Tauri runtime. The
 * wrapper covers:
 *   - readChannel / writeChannel round-trip via localStorage,
 *     plus corruption / private-mode tolerance.
 *   - checkForUpdate returns the snapshot shape on success and an
 *     "unavailable" shape when the plugin throws.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheck = vi.fn()
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}))

import { CHANNEL_STORAGE_KEY, checkForUpdate, readChannel, writeChannel } from '../utils/updater'

function makeUpdate(metadata: Record<string, unknown> = {}) {
  return {
    available: true,
    currentVersion: '0.4.0',
    version: '0.5.0',
    body: 'See CHANGELOG.md',
    rawJson: {},
    downloadedBytes: 0,
    ...metadata,
  }
}

describe('readChannel / writeChannel', () => {
  beforeEach(() => localStorage.removeItem(CHANNEL_STORAGE_KEY))
  afterEach(() => localStorage.removeItem(CHANNEL_STORAGE_KEY))

  it('defaults to stable when no channel is stored', () => {
    expect(readChannel()).toBe('stable')
  })

  it('round-trips a prerelease value through localStorage', () => {
    writeChannel('prerelease')
    expect(readChannel()).toBe('prerelease')
  })

  it('falls back to stable on a corrupt JSON value', () => {
    localStorage.setItem(CHANNEL_STORAGE_KEY, '{not-json')
    expect(readChannel()).toBe('stable')
  })

  it('falls back to stable on an unknown string value', () => {
    localStorage.setItem(CHANNEL_STORAGE_KEY, 'nightly')
    expect(readChannel()).toBe('stable')
  })

  it('writeChannel tolerates a throwing localStorage (private mode)', () => {
    const original = localStorage.setItem
    localStorage.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      // Should not throw — private mode is a best-effort fallback.
      writeChannel('prerelease')
    } finally {
      localStorage.setItem = original
    }
  })
})

describe('checkForUpdate', () => {
  beforeEach(() => {
    mockCheck.mockReset()
  })

  it('returns an idle snapshot when the plugin reports no update', async () => {
    mockCheck.mockResolvedValue(null)
    const state = await checkForUpdate()
    expect(state.available).toBe(true)
    expect(state.status).toBe('idle')
    expect(state.version).toBeUndefined()
  })

  it('captures version + body when an update is available', async () => {
    mockCheck.mockResolvedValue(makeUpdate({ body: 'Bug fixes' }))
    const state = await checkForUpdate()
    expect(state.version).toBe('0.5.0')
    expect(state.currentVersion).toBe('0.4.0')
    expect(state.body).toBe('Bug fixes')
  })

  it('passes allowDowngrades only when the channel is prerelease', async () => {
    mockCheck.mockResolvedValue(null)
    await checkForUpdate('stable')
    expect(mockCheck).toHaveBeenLastCalledWith({ allowDowngrades: false })
    await checkForUpdate('prerelease')
    expect(mockCheck).toHaveBeenLastCalledWith({ allowDowngrades: true })
  })

  it('returns the unavailable shape when the plugin throws', async () => {
    mockCheck.mockRejectedValue(new Error('network down'))
    const state = await checkForUpdate()
    expect(state.available).toBe(false)
    expect(state.status).toBe('error')
    expect(state.error).toBe('network down')
  })

  it('coerces a non-Error rejection into a string message', async () => {
    mockCheck.mockRejectedValue('plain string')
    const state = await checkForUpdate()
    expect(state.error).toBe('plain string')
  })
})
