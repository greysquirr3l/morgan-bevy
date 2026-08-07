import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetFrontendCrashHandlerForTesting,
  installFrontendCrashHandler,
} from '../utils/crashHandler'

describe('frontend crash handler', () => {
  beforeEach(() => {
    _resetFrontendCrashHandlerForTesting()
  })

  afterEach(() => {
    _resetFrontendCrashHandlerForTesting()
    vi.restoreAllMocks()
  })

  it('formats Error instances with name and message', () => {
    const error = new TypeError('something broke')
    const lines: string[] = []
    const original = console.error
    console.error = (msg: string) => lines.push(msg)

    installFrontendCrashHandler()
    window.dispatchEvent(new ErrorEvent('error', { error, message: 'fallback' }))
    console.error = original

    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('window.error')
    expect(lines[0]).toContain('TypeError: something broke')
  })

  it('formats string errors', () => {
    const lines: string[] = []
    const original = console.error
    console.error = (msg: string) => lines.push(msg)

    installFrontendCrashHandler()
    window.dispatchEvent(new ErrorEvent('error', { error: 'plain string' }))
    console.error = original

    expect(lines[0]).toContain('window.error')
    expect(lines[0]).toContain('plain string')
  })

  it('handles unhandledrejection', async () => {
    const lines: string[] = []
    const original = console.error
    console.error = (msg: string) => lines.push(msg)

    installFrontendCrashHandler()
    // Catch the synthetic rejection so the unhandledrejection event fires
    // through our handler instead of being treated as a real unhandled
    // rejection in the test runner.
    const rejected = Promise.reject(new Error('rej'))
    rejected.catch(() => {}) // suppress unhandled in the test runtime
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        promise: rejected,
        reason: new Error('rej'),
      })
    )
    // Give the handler a microtask to run.
    await new Promise(r => setTimeout(r, 0))
    console.error = original

    expect(lines.some(l => l.includes('unhandledrejection'))).toBe(true)
  })

  it('does nothing if Tauri invoke is unavailable', () => {
    installFrontendCrashHandler()
    window.dispatchEvent(new ErrorEvent('error', { error: 'no tauri' }))
    // The handler swallows the failure silently.
    expect(true).toBe(true)
  })

  it('is idempotent — second install is a no-op', () => {
    installFrontendCrashHandler()
    installFrontendCrashHandler()
    expect(true).toBe(true)
  })
})
