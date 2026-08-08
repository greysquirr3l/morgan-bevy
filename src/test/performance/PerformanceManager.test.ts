/**
 * T80 — render loop must not drive a React re-render every frame.
 *
 * `usePerformanceDebug` (src/performance/PerformanceManager.tsx) used
 * to call `setDebugInfo` unconditionally inside `useFrame`, so a 60
 * FPS scene meant 60 React re-renders/sec for a HUD number nobody
 * can read that fast. It's now throttled to `HUD_UPDATE_INTERVAL_MS`
 * (~2 Hz) via a ref timestamp. `@react-three/fiber`'s `useFrame`
 * needs a live WebGL canvas to run for real, so it's mocked here to
 * capture the registered callback and invoke it synchronously —
 * exercising the throttle logic without a renderer.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

type FrameCallback = (state: unknown, delta: number) => void
let frameCallback: FrameCallback | null = null

vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: FrameCallback) => {
    frameCallback = cb
  },
}))

import { usePerformanceDebug } from '@/performance/PerformanceManager'

function fakeR3FState() {
  return {
    gl: { info: { render: { calls: 10, triangles: 500 } } },
    clock: { getDelta: () => 1 / 60 },
  }
}

describe('usePerformanceDebug render-loop throttling', () => {
  it('does not re-render on every frame — only when the throttle window elapses', () => {
    let renderCount = 0
    renderHook(() => {
      renderCount++
      return usePerformanceDebug()
    })
    expect(frameCallback).toBeTruthy()
    const mountedRenderCount = renderCount

    // First frame always commits (the ref starts at 0, so the
    // throttle window has trivially "elapsed") — that's the initial
    // real reading landing in the HUD.
    act(() => {
      frameCallback?.(fakeR3FState(), 1 / 60)
    })
    const afterFirstFrame = renderCount
    expect(afterFirstFrame).toBeGreaterThan(mountedRenderCount)

    // Before the fix, each of these 30 calls (simulating half a
    // second at 60 FPS) called `setDebugInfo` and forced a render.
    // With the throttle, none of them land inside the same window.
    act(() => {
      for (let i = 0; i < 30; i++) {
        frameCallback?.(fakeR3FState(), 1 / 60)
      }
    })
    expect(renderCount).toBe(afterFirstFrame)
  })

  it('still returns live gl.info counters once the throttle allows an update', () => {
    const { result } = renderHook(() => usePerformanceDebug())
    act(() => {
      frameCallback?.(fakeR3FState(), 1 / 60)
    })
    expect(result.current.drawCalls).toBe(10)
    expect(result.current.triangles).toBe(500)
  })
})
