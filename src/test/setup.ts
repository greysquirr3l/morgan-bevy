// Test setup file for Vitest
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Extend global interface for TypeScript
declare global {
  var mockTauri: any
}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
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
  }
}

// Mock window.__TAURI__
Object.defineProperty(window, '__TAURI__', {
  value: globalThis.mockTauri,
  writable: true
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
  }))
})