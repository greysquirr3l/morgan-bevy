/**
 * Tests for the file-association startup hook (T73). Verifies that:
 *  - `handleOpenProject` invokes `load_project_from_path` with the path
 *    and forwards the parsed payload to `executeCommand`.
 *  - Failures are swallowed (logged, not alerted) so a bad file at
 *    launch doesn't block the user from using the editor.
 *  - The path is added to the recent-projects list on success.
 */
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvoke = vi.fn()
const mockListen = vi.fn()
const mockUnlisten = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}))

import type { Mock } from 'vitest'
import type { Command } from '../utils/commands'

const { mockExecuteCommand } = vi.hoisted(() => ({
  mockExecuteCommand: vi.fn() as Mock<[Command], void>,
}))
vi.mock('@/store/editorStore', () => ({
  useEditorStore: Object.assign(
    () => ({
      executeCommand: mockExecuteCommand,
    }),
    {
      getState: () => ({ executeCommand: mockExecuteCommand }),
      setState: vi.fn(),
    }
  ),
}))

// Stub the recent-projects helper so we can assert on the side effect.
const { mockAddRecentProject } = vi.hoisted(() => ({
  mockAddRecentProject: vi.fn(),
}))
vi.mock('@/utils/recentProjects', async importOriginal => {
  const actual = await importOriginal<typeof import('../utils/recentProjects')>()
  return {
    ...actual,
    addRecentProject: (...args: unknown[]) => mockAddRecentProject(...args),
  }
})

import { handleOpenProject, useStartupFile } from '../hooks/useStartupFile'
import { clearRecentProjects } from '../utils/recentProjects'

describe('useStartupFile hook', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockListen.mockReset()
    mockUnlisten.mockReset()
    mockExecuteCommand.mockReset()
    mockAddRecentProject.mockReset()
    clearRecentProjects()
  })

  it('subscribes to the morgan://open-project event on mount and unsubscribes on unmount', async () => {
    mockListen.mockResolvedValue(mockUnlisten)
    const { unmount } = renderHook(() => useStartupFile())

    // Wait for the listener to register.
    await vi.waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('morgan://open-project', expect.any(Function))
    })

    // Allow microtasks for the awaited promise to resolve and assign
    // the unlisten handle to local state before unmounting.
    await Promise.resolve()
    await Promise.resolve()

    unmount()
    expect(mockUnlisten).toHaveBeenCalled()
  })

  it('does not throw when the listen call fails (web/dev environments)', async () => {
    mockListen.mockRejectedValue(new Error('no Tauri'))
    // Simulate a Tauri runtime so the hook actually attempts to
    // subscribe. Without `window.__TAURI__` set, the hook's
    // `isTauriRuntime()` guard returns early and `listen` is never
    // called — that path is covered by the next test.
    ;(window as unknown as { __TAURI__: unknown }).__TAURI__ = { invoke: vi.fn() }
    const errorSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(() => renderHook(() => useStartupFile())).not.toThrow()
    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('failed to subscribe'),
        expect.anything()
      )
    })
    errorSpy.mockRestore()
    ;(window as unknown as { __TAURI__: unknown }).__TAURI__ = undefined
  })

  it('skips the listen call entirely when not running in a Tauri runtime', () => {
    // No `window.__TAURI__` set in this test — simulates the Vite
    // dev server / `npm run dev` path where the webview shell is
    // absent.
    const win = window as { __TAURI__?: unknown }
    win.__TAURI__ = undefined

    expect(() => renderHook(() => useStartupFile())).not.toThrow()
    expect(mockListen).not.toHaveBeenCalled()
  })
})

describe('handleOpenProject helper', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockExecuteCommand.mockReset()
    mockAddRecentProject.mockReset()
    clearRecentProjects()
  })

  it('loads the project, applies it, and records it in recents on success', async () => {
    const projectPayload = {
      schemaVersion: 1,
      scene: { objects: [], layers: [], activeLayer: 'default' },
      metadata: { name: 'starter' },
    }
    mockInvoke.mockResolvedValue(projectPayload)

    await handleOpenProject('/tmp/starter.morgan', mockExecuteCommand)

    expect(mockInvoke).toHaveBeenCalledWith('load_project_from_path', {
      path: '/tmp/starter.morgan',
    })
    expect(mockExecuteCommand).toHaveBeenCalledTimes(1)
    expect(mockAddRecentProject).toHaveBeenCalledWith('/tmp/starter.morgan', 'starter.morgan')
  })

  it('swallows invoke errors without throwing or alerting', async () => {
    mockInvoke.mockRejectedValue(new Error('disk gone'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

    await expect(
      handleOpenProject('/tmp/missing.morgan', mockExecuteCommand)
    ).resolves.toBeUndefined()

    expect(mockExecuteCommand).not.toHaveBeenCalled()
    expect(mockAddRecentProject).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()
    expect(alertSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
    alertSpy.mockRestore()
  })

  it('swallows schema-validation errors (drift between Rust and TS)', async () => {
    mockInvoke.mockResolvedValue({ schemaVersion: 1, scene: 'not-an-object' })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(handleOpenProject('/tmp/bad.morgan', mockExecuteCommand)).resolves.toBeUndefined()

    expect(mockExecuteCommand).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})
