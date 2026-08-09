// Test setup file for Vitest
/* eslint-disable no-var */
import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'

// Extend global interface for TypeScript
declare global {
  var mockTauri: any
}

// Mock localStorage with a Map-backed implementation. The default
// jsdom global is disabled (see `vitest.config.ts`); this mock gives
// the recent-projects list, SaveCommand, and any other consumer of
// `window.localStorage` a working in-memory store.
const localStorageMap = new Map<string, string>()

beforeEach(() => {
  localStorageMap.clear()
})
const localStorageMock: Storage = {
  get length() {
    return localStorageMap.size
  },
  clear() {
    localStorageMap.clear()
  },
  getItem(key) {
    return localStorageMap.get(key) ?? null
  },
  key(index) {
    return Array.from(localStorageMap.keys())[index] ?? null
  },
  removeItem(key) {
    localStorageMap.delete(key)
  },
  setItem(key, value) {
    localStorageMap.set(key, value)
  },
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock clipboard
const clipboardMock = {
  writeText: vi.fn(),
  readText: vi.fn(),
}
Object.defineProperty(navigator, 'clipboard', {
  value: clipboardMock,
  writable: true,
})

// Mock Tauri APIs for testing
globalThis.mockTauri = {
  invoke: vi.fn(),
  fs: {
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
  },
  dialog: {
    open: vi.fn(),
    save: vi.fn(),
  },
}

// Mock window.__TAURI__ (the legacy global, only set when
// `withGlobalTauri: true` in `tauri.conf.json`).
Object.defineProperty(window, '__TAURI__', {
  value: globalThis.mockTauri,
  writable: true,
})

// Mock window.__TAURI_INTERNALS__ (the IPC bridge that
// `@tauri-apps/api/core` `invoke()` reads at call time). The
// `isTauriRuntime()` guard in `src/utils/tauriEnv.ts` checks for this
// specifically — without `invoke` defined here, the guard would
// return false even though `__TAURI__` is set, and components would
// throw "Cannot read properties of undefined (reading 'invoke')"
// instead of the friendly "feature unavailable in web preview" path.
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {
    invoke: globalThis.mockTauri.invoke,
    transformCallback: (cb: unknown) => cb,
  },
  writable: true,
})

// Mock Three.js WebGL context for headless testing
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => ({
    clearColor: vi.fn(),
    clear: vi.fn(),
    drawElements: vi.fn(),
    createShader: vi.fn(),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    createProgram: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    useProgram: vi.fn(),
    getAttribLocation: vi.fn(),
    getUniformLocation: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    createBuffer: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    uniform1i: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    viewport: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    depthFunc: vi.fn(),
    clearDepth: vi.fn(),
    getParameter: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getShaderParameter: vi.fn(() => true),
  })),
})
