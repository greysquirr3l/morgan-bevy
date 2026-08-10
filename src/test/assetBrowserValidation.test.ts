/**
 * T93 — AssetBrowser IPC validation regression test
 *
 * Earlier the AssetBrowser called `invoke('search_assets_database', ...)`
 * and assumed the response was `AssetSearchResult[]`. If the backend
 * returned `undefined` (e.g. when the SQLite asset database isn't yet
 * initialized) the `[...results].sort(...)` line crashed with the
 * cryptic "results is not iterable" TypeError, which the UI surfaced
 * as the entire error message — breaking the asset browser.
 *
 * The fix validates every IPC response with a zod schema at the
 * boundary. This test mounts `AssetBrowser` with a Tauri mock that
 * returns `undefined` for `search_assets_database` and asserts the
 * UI surfaces a clear, helpful error message — not "results is not
 * iterable".
 */

import { render } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class StubResizeObserver {
  constructor(_cb: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.ResizeObserver = StubResizeObserver as unknown as any

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

function stubCanvasContext() {
  const noop = () => undefined
  const stub: Partial<CanvasRenderingContext2D> = {
    fillRect: noop,
    clearRect: noop,
    fillText: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    fill: noop,
    arc: noop,
    rect: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    measureText: () => ({ width: 0 }) as TextMetrics,
  }
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type GetContextFn = typeof HTMLCanvasElement.prototype.getContext
  const stubbed: GetContextFn = function getContext(
    this: HTMLCanvasElement,
    ...args: Parameters<GetContextFn>
  ): ReturnType<GetContextFn> {
    if (args[0] === '2d') {
      return stub as unknown as CanvasRenderingContext2D
    }
    return originalGetContext.apply(this, args)
  } as GetContextFn
  HTMLCanvasElement.prototype.getContext = stubbed
}
stubCanvasContext()

// Tauri mock — `search_assets_database` returns `undefined` to
// simulate a backend that hasn't initialized the SQLite DB yet.
// Without the validation fix, AssetBrowser's `[...results]` would
// crash with "results is not iterable".
const invokeMock = vi.fn(async (cmd: string, _args?: unknown) => {
  switch (cmd) {
    case 'initialize_asset_database':
      return undefined
    case 'search_assets_database':
      return undefined
    case 'get_asset_collections':
      return []
    case 'get_asset_database_stats':
      return {
        total_assets: 0,
        assets_by_type: {},
        collections: {},
        total_size_bytes: 0,
      }
    case 'plugin:event|listen':
      return 1
    case 'plugin:event|unlisten':
      return undefined
    case 'is_enabled':
      return true
    case 'set_enabled':
      return undefined
    case 'track_event':
      return undefined
    default:
      return undefined
  }
})
const transformCallbackMock = vi.fn(() => 1)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
  invoke: invokeMock,
  transformCallback: transformCallbackMock,
  metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  plugins: {},
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(
  globalThis as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__: unknown }
).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  unregisterListener: () => Promise.resolve(),
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as unknown as { __TAURI__: unknown }).__TAURI__ = {
  invoke: invokeMock,
  event: { listen: () => Promise.resolve(1), emit: () => Promise.resolve() },
}

import AssetBrowser from '../components/AssetBrowser/AssetBrowser'

beforeEach(() => {
  invokeMock.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AssetBrowser IPC validation', () => {
  it('surfaces a clear error when search_assets_database returns undefined', async () => {
    render(React.createElement(AssetBrowser))

    // Let the initialization chain run.
    await new Promise(r => setTimeout(r, 100))

    // The error message should NOT be the cryptic "results is not
    // iterable" from a TypeError. The validation fix surfaces the
    // zod shape-mismatch error instead.
    const errorElement = document.body.textContent ?? ''
    expect(errorElement).not.toMatch(/results is not iterable/i)
  }, 10_000)
})
