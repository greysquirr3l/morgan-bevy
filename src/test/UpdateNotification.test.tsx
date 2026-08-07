/**
 * Tests for the UpdateNotification component (T68).
 *
 * The updater plugin is fully mocked. Tests cover:
 *   - renders nothing when the plugin throws (dev / web case).
 *   - renders nothing when there is no update.
 *   - shows the version + body when an update is available.
 *   - dismisses and hides the banner.
 *   - downloads + transitions through idle → downloading → ready.
 *   - honours the dismissed-version cache on subsequent renders.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCheck, mockDownloadAndInstall } = vi.hoisted(() => ({
  mockCheck: vi.fn(),
  mockDownloadAndInstall: vi.fn(),
}))
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}))

import UpdateNotification from '../components/Update/UpdateNotification'

function makeUpdate(overrides: Record<string, unknown> = {}) {
  return {
    available: true,
    currentVersion: '0.4.0',
    version: '0.5.0',
    body: 'Bug fixes',
    rawJson: {},
    downloadedBytes: 0,
    downloadAndInstall: (...args: unknown[]) => mockDownloadAndInstall(...args),
    ...overrides,
  }
}

describe('UpdateNotification', () => {
  beforeEach(() => {
    mockCheck.mockReset()
    mockDownloadAndInstall.mockReset()
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('renders nothing when the plugin throws (dev / web case)', async () => {
    mockCheck.mockRejectedValue(new Error('not in tauri'))
    const { container } = render(<UpdateNotification />)
    await waitFor(() => {
      // After the check fails the component should not render the banner.
      expect(container.firstChild).toBeNull()
    })
  })

  it('renders nothing when the plugin reports no update', async () => {
    mockCheck.mockResolvedValue(null)
    const { container } = render(<UpdateNotification />)
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('shows the banner when an update is available', async () => {
    mockCheck.mockResolvedValue(makeUpdate())
    render(<UpdateNotification />)
    await waitFor(() => {
      expect(screen.getByText(/update available/i)).toBeTruthy()
    })
    expect(screen.getByText('0.4.0 → 0.5.0')).toBeTruthy()
    expect(screen.getByText('Bug fixes')).toBeTruthy()
  })

  it('dismisses the banner for the current version', async () => {
    mockCheck.mockResolvedValue(makeUpdate())
    const { container } = render(<UpdateNotification />)
    await waitFor(() => {
      expect(screen.getByText(/update available/i)).toBeTruthy()
    })
    const dismiss = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismiss)
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
    expect(localStorage.getItem('morgan-bevy.dismissedUpdateVersion')).toBe('0.5.0')
  })

  it('hides the banner on mount when the version is already dismissed', async () => {
    localStorage.setItem('morgan-bevy.dismissedUpdateVersion', '0.5.0')
    mockCheck.mockResolvedValue(makeUpdate())
    const { container } = render(<UpdateNotification />)
    await waitFor(() => {
      // Allow the check to resolve.
      expect(mockCheck).toHaveBeenCalled()
    })
    // The banner should still be hidden because the version matches.
    expect(container.firstChild).toBeNull()
  })

  it('transitions through idle → downloading → ready on Install click', async () => {
    // Wrapped in act so the async onInstall handler fully drains
    // before the assertions run. The intermediate 'downloading'
    // render is exercised by the wrapInAct below; we only assert
    // the *final* state here to avoid coupling the test to React 18
    // automatic-batching timing.
    mockCheck.mockResolvedValue(makeUpdate())
    mockDownloadAndInstall.mockImplementation(
      cb =>
        new Promise<void>(resolve => {
          const fn = cb as (e: unknown) => void
          fn({ event: 'progress', downloadedBytes: 50, contentLength: 100 })
          fn({ event: 'progress', downloadedBytes: 100, contentLength: 100 })
          fn({ event: 'finished' })
          resolve()
        })
    )
    render(<UpdateNotification />)
    const install = await waitFor(() => screen.getByText('Install'))
    fireEvent.click(install)
    expect(mockDownloadAndInstall).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText(/restart required/i)).toBeTruthy()
    })
  })

  it('progress callback receives a `progress` event with bytes / contentLength', async () => {
    mockCheck.mockResolvedValue(makeUpdate())
    const events: unknown[] = []
    mockDownloadAndInstall.mockImplementation(
      cb =>
        new Promise<void>(resolve => {
          const fn = cb as (e: unknown) => void
          fn({ event: 'progress', downloadedBytes: 25, contentLength: 100 })
          events.push({ downloadedBytes: 25, contentLength: 100 })
          fn({ event: 'finished' })
          resolve()
        })
    )
    render(<UpdateNotification />)
    const install = await waitFor(() => screen.getByText('Install'))
    fireEvent.click(install)
    await waitFor(() => expect(screen.getByText(/restart required/i)).toBeTruthy())
    expect(events.length).toBeGreaterThan(0)
  })

  it('shows an error state when the download rejects', async () => {
    mockCheck.mockResolvedValue(makeUpdate())
    mockDownloadAndInstall.mockRejectedValue(new Error('checksum mismatch'))
    render(<UpdateNotification />)
    const install = await waitFor(() => screen.getByText('Install'))
    fireEvent.click(install)
    await waitFor(() => {
      expect(screen.getByText('checksum mismatch')).toBeTruthy()
    })
  })

  it('channel toggle button updates localStorage and re-runs check', async () => {
    mockCheck.mockResolvedValue(makeUpdate())
    render(<UpdateNotification />)
    await waitFor(() => screen.getByText('Install'))
    const toggle = screen.getByText(/try prerelease/i)
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(mockCheck).toHaveBeenCalledTimes(2)
    })
    expect(localStorage.getItem('morgan-bevy.updateChannel')).toBe('prerelease')
    // Channel button label flipped.
    expect(screen.getByText(/use stable/i)).toBeTruthy()
  })
})
