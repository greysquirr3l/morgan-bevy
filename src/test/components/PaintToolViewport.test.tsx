/**
 * T54 — `PaintToolViewport` smoke test.
 *
 * `usePaintTool` (and therefore this component) requires
 * `@react-three/fiber`'s `useThree`, which only works inside a real
 * `<Canvas>`. Mocked here the same way `OptimizedScene.test.tsx`
 * mocks it (T78 precedent) — this is a shallow "does it render /
 * not render the brush indicator element" check, not a raycasting
 * integration test; there is no headless-WebGL raycast harness in
 * this repo (see `TransformGizmos`, which has no test file either).
 */
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

const fakeGl = { domElement: document.createElement('canvas') }
const fakeCamera = new THREE.PerspectiveCamera()
const fakeScene = new THREE.Scene()

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ camera: fakeCamera, scene: fakeScene, gl: fakeGl }),
}))

import PaintToolViewport from '@/components/PaintTool/PaintToolViewport'
import { useEditorStore } from '@/store/editorStore'

describe('PaintToolViewport', () => {
  beforeEach(() => {
    useEditorStore.setState({ paintToolActive: false })
  })

  it('renders nothing when the paint tool is inactive', () => {
    const { container } = render(<PaintToolViewport />)
    expect(container.querySelector('[data-testid="paint-brush-ring"]')).toBeNull()
  })

  it('renders the brush ring indicator once the paint tool is active', () => {
    useEditorStore.setState({ paintToolActive: true })
    const { container } = render(<PaintToolViewport />)
    expect(container.querySelector('[data-testid="paint-brush-ring"]')).not.toBeNull()
  })
})
