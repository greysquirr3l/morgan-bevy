/**
 * T89 — Blank-screen diagnostic
 *
 * Loads the editor in a real jsdom environment with a non-empty localStorage
 * (so the recovery-dialog path is exercised) and asserts that the rendered
 * DOM contains visible text, not a blank screen. This catches regressions
 * where the editor mounts but renders nothing visible (e.g. isReady stays
 * false, an early return hides everything, or a modal fills the viewport
 * with no visible body).
 *
 * If you are debugging "blank screen", start here.
 */

import { render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// jsdom does not implement ResizeObserver by default, but @react-three/fiber
// (via react-use-measure) requires it. Stub a no-op implementation that
// fires once on construction so the Canvas can mount without throwing.
class StubResizeObserver {
  private cb: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
  }
  observe() {
    // fire once with a sensible size so children can read initial dimensions
    queueMicrotask(() =>
      this.cb(
        [
          {
            contentRect: {
              width: 1024,
              height: 768,
              top: 0,
              left: 0,
              bottom: 768,
              right: 1024,
              x: 0,
              y: 0,
            } as DOMRectReadOnly,
            target: document.body,
            borderBoxSize: [] as unknown as readonly ResizeObserverSize[],
            contentBoxSize: [] as unknown as readonly ResizeObserverSize[],
            devicePixelContentBoxSize: [] as unknown as readonly ResizeObserverSize[],
          } as unknown as ResizeObserverEntry,
        ],
        this
      )
    )
  }
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver

// jsdom's default matchMedia stub returns matches:false for everything; we
// need to satisfy any callers that gate UI on viewport breakpoints.
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

// We need a real Tauri surface. The Tauri global is what `window.__TAURI__`
// would be; the helpers in src/utils/tauri.ts read from it.
const invokeMock = vi.fn(async (cmd: string, _args?: unknown) => {
  switch (cmd) {
    case 'list_recent_projects':
      return []
    case 'list_themes':
      return []
    case 'list_prefabs':
      return []
    case 'list_assets':
      return []
    case 'load_scene':
      return null
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
;(globalThis as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
  invoke: invokeMock,
  transformCallback: transformCallbackMock,
  metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  plugins: {},
}
const eventPluginInternals = {
  unregisterListener: () => Promise.resolve(),
}
;(
  globalThis as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__: unknown }
).__TAURI_EVENT_PLUGIN_INTERNALS__ = eventPluginInternals
;(window as unknown as { __TAURI__: unknown }).__TAURI__ = {
  invoke: invokeMock,
  event: { listen: () => Promise.resolve(1), emit: () => Promise.resolve() },
}

// jsdom's HTMLCanvasElement.getContext('2d') returns null by default. The
// GridView component calls getContext('2d') in a useEffect and then invokes
// `ctx.fillRect`, which throws if ctx is null. Stub a no-op 2d context so
// the passive effect chain runs to completion.
function stubCanvasContext() {
  const noop = () => undefined
  const stub: Partial<CanvasRenderingContext2D> = {
    fillRect: noop,
    clearRect: noop,
    getImageData: () =>
      ({ data: new Uint8ClampedArray(), width: 0, height: 0, colorSpace: 'srgb' }) as ImageData,
    putImageData: noop,
    createImageData: () =>
      ({ data: new Uint8ClampedArray(), width: 0, height: 0, colorSpace: 'srgb' }) as ImageData,
    setTransform: noop,
    fillText: noop,
    measureText: () => ({ width: 0 }) as TextMetrics,
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
  }
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  // The HTMLCanvasElement.getContext signature is an overloaded union of
  // ("2d") / ("bitmaprenderer") / ("webgl"/"webgl2"). Casting to the union
  // type keeps the overload structure intact while letting us stub the 2d
  // branch without losing the others' behaviour.
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

import App from '../App'

beforeEach(() => {
  // No autosave seed — we are testing the cold-start path (the path the
  // user sees on a fresh launch, where isReady becomes true and the main
  // UI renders without the recovery dialog). This is the most likely
  // blank-screen path after a `clearLocalStorage()` or first install.
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App blank-screen diagnostic', () => {
  it('renders visible content (not a blank screen)', async () => {
    render(React.createElement(App))

    // Wait one tick for the isReady useEffect to run.
    await new Promise(r => setTimeout(r, 50))

    // If isReady never became true the loading placeholder would still be
    // visible — assert it's gone.
    expect(screen.queryByText(/Loading Morgan-Bevy/i)).not.toBeInTheDocument()

    // No autosave seeded, so the recovery dialog must NOT be shown.
    expect(screen.queryByRole('button', { name: /recover work/i })).not.toBeInTheDocument()

    // The document body should contain non-whitespace text somewhere —
    // this is the ultimate "not blank" check. (Toolbar labels, status
    // text, etc. should add up to well over a few characters.)
    const bodyText = document.body.textContent ?? ''
    expect(bodyText.trim().length).toBeGreaterThan(20)
  })

  it('renders the recovery dialog when a recent autosave exists', async () => {
    // Seed a valid autosave payload that matches the saveToLocalStorage
    // schema (selectedTheme is a SelectedTheme object with `tiles`,
    // sceneObjects is an Array<[id, obj]> with `name`).
    localStorage.setItem(
      'morgan-bevy.autosave',
      JSON.stringify({
        gridData: [],
        selectedTheme: { id: 'forest', name: 'Forest', tiles: {} },
        sceneObjects: [
          [
            'cube-0',
            {
              id: 'cube-0',
              name: 'Test Cube',
              type: 'cube',
              position: [0, 0.5, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              visible: true,
              locked: false,
            },
          ],
        ],
        viewportMode: '3d',
        timestamp: new Date().toISOString(),
      })
    )

    render(React.createElement(App))
    await new Promise(r => setTimeout(r, 50))

    expect(screen.queryByText(/Loading Morgan-Bevy/i)).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /recover work/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start fresh/i })).toBeInTheDocument()
  })
})
