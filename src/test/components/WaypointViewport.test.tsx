/**
 * T57 — `WaypointViewport` smoke test.
 *
 * `useWaypointTool` (and therefore this component) requires
 * `@react-three/fiber`'s `useThree`, which only works inside a real
 * `<Canvas>`. Mocked here the same way `PaintToolViewport.test.tsx`
 * (T54 precedent) mocks it — a shallow "does it render the expected
 * number of sphere/line elements" check, not a raycasting
 * integration test.
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

import WaypointViewport from '@/components/Waypoints/WaypointViewport'
import { useEditorStore } from '@/store/editorStore'
import { PatrolRouteId, WaypointId } from '@/types/brand'

describe('WaypointViewport', () => {
  beforeEach(() => {
    useEditorStore.setState({ waypoints: [], patrolRoutes: [], waypointPlacementActive: false })
  })

  it('renders the overlay group with no spheres when there are no waypoints', () => {
    const { container } = render(<WaypointViewport navMesh={null} />)
    expect(container.querySelector('[name="waypoint-overlay"]')).not.toBeNull()
    expect(container.querySelectorAll('[name^="waypoint-sphere-"]').length).toBe(0)
  })

  it('renders one sphere per waypoint', () => {
    useEditorStore.setState({
      waypoints: [
        { id: WaypointId('a'), position: [0, 0, 0] },
        { id: WaypointId('b'), position: [1, 0, 0] },
      ],
    })
    const { container } = render(<WaypointViewport navMesh={null} />)
    expect(container.querySelectorAll('[name^="waypoint-sphere-"]').length).toBe(2)
    expect(container.querySelector('[name="waypoint-sphere-a"]')).not.toBeNull()
    expect(container.querySelector('[name="waypoint-sphere-b"]')).not.toBeNull()
  })

  it('renders path lines for a patrol route with 2+ waypoints', () => {
    useEditorStore.setState({
      waypoints: [
        { id: WaypointId('a'), position: [0, 0, 0] },
        { id: WaypointId('b'), position: [1, 0, 0] },
      ],
      patrolRoutes: [
        { id: PatrolRouteId('r1'), waypointIds: [WaypointId('a'), WaypointId('b')], mode: 'loop' },
      ],
    })
    const { container } = render(<WaypointViewport navMesh={null} />)
    expect(container.querySelector('[name="waypoint-path-lines"]')).not.toBeNull()
  })

  it('renders no path lines when there are no patrol routes', () => {
    useEditorStore.setState({
      waypoints: [{ id: WaypointId('a'), position: [0, 0, 0] }],
      patrolRoutes: [],
    })
    const { container } = render(<WaypointViewport navMesh={null} />)
    expect(container.querySelector('[name="waypoint-path-lines"]')).toBeNull()
  })
})
