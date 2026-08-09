/**
 * T57 — `waypoints` / `patrolRoutes` store slice. Mirrors the shape
 * of the `lights` slice (T55): array of records + add/remove/update
 * actions.
 */
import { useEditorStore } from '@/store/editorStore'
import { PatrolRouteId, WaypointId } from '@/types/brand'
import { beforeEach, describe, expect, it } from 'vitest'

describe('T57 waypoints store slice', () => {
  beforeEach(() => {
    useEditorStore.setState({
      waypoints: [],
      patrolRoutes: [],
      waypointPlacementActive: false,
      waypointDefaultDwellTime: 0,
    })
  })

  it('addWaypoint appends a waypoint', () => {
    const { addWaypoint } = useEditorStore.getState()
    addWaypoint({ id: WaypointId('wp1'), position: [1, 0, 2] })
    expect(useEditorStore.getState().waypoints).toHaveLength(1)
    expect(useEditorStore.getState().waypoints[0]).toEqual({
      id: WaypointId('wp1'),
      position: [1, 0, 2],
    })
  })

  it('updateWaypoint patches an existing waypoint', () => {
    const { addWaypoint, updateWaypoint } = useEditorStore.getState()
    addWaypoint({ id: WaypointId('wp1'), position: [0, 0, 0] })
    updateWaypoint(WaypointId('wp1'), { dwellTime: 3 })
    expect(useEditorStore.getState().waypoints[0]?.dwellTime).toBe(3)
  })

  it('updateWaypoint with dwellTime: undefined removes the field entirely (not a literal undefined)', () => {
    const { addWaypoint, updateWaypoint } = useEditorStore.getState()
    addWaypoint({ id: WaypointId('wp1'), position: [0, 0, 0], dwellTime: 3 })
    updateWaypoint(WaypointId('wp1'), { dwellTime: undefined })
    const wp = useEditorStore.getState().waypoints[0]
    expect(wp).toBeDefined()
    expect(wp && 'dwellTime' in wp).toBe(false)
  })

  it('updateWaypoint on an unknown id is a no-op', () => {
    const { updateWaypoint } = useEditorStore.getState()
    updateWaypoint(WaypointId('missing'), { dwellTime: 3 })
    expect(useEditorStore.getState().waypoints).toEqual([])
  })

  it('removeWaypoint removes the waypoint and prunes it from patrol routes + nextWaypointId links', () => {
    const { addWaypoint, addPatrolRoute, removeWaypoint } = useEditorStore.getState()
    addWaypoint({ id: WaypointId('a'), position: [0, 0, 0], nextWaypointId: WaypointId('b') })
    addWaypoint({ id: WaypointId('b'), position: [1, 0, 0] })
    addPatrolRoute({
      id: PatrolRouteId('r1'),
      waypointIds: [WaypointId('a'), WaypointId('b')],
      mode: 'loop',
    })

    removeWaypoint(WaypointId('b'))

    const state = useEditorStore.getState()
    expect(state.waypoints.map(w => w.id)).toEqual([WaypointId('a')])
    expect(state.patrolRoutes[0]?.waypointIds).toEqual([WaypointId('a')])
    expect(state.waypoints[0] && 'nextWaypointId' in state.waypoints[0]).toBe(false)
  })

  it('setWaypointPlacementActive toggles the placement flag', () => {
    const { setWaypointPlacementActive } = useEditorStore.getState()
    setWaypointPlacementActive(true)
    expect(useEditorStore.getState().waypointPlacementActive).toBe(true)
  })

  it('setWaypointDefaultDwellTime rejects negative values', () => {
    const { setWaypointDefaultDwellTime } = useEditorStore.getState()
    setWaypointDefaultDwellTime(2)
    expect(useEditorStore.getState().waypointDefaultDwellTime).toBe(2)
    setWaypointDefaultDwellTime(-1)
    expect(useEditorStore.getState().waypointDefaultDwellTime).toBe(2)
  })

  it('addPatrolRoute / removePatrolRoute / updatePatrolRoute mirror the light actions', () => {
    const { addPatrolRoute, removePatrolRoute, updatePatrolRoute } = useEditorStore.getState()
    addPatrolRoute({
      id: PatrolRouteId('r1'),
      waypointIds: [WaypointId('a'), WaypointId('b')],
      mode: 'loop',
    })
    expect(useEditorStore.getState().patrolRoutes).toHaveLength(1)

    updatePatrolRoute(PatrolRouteId('r1'), { mode: 'ping-pong' })
    expect(useEditorStore.getState().patrolRoutes[0]?.mode).toBe('ping-pong')

    removePatrolRoute(PatrolRouteId('r1'))
    expect(useEditorStore.getState().patrolRoutes).toEqual([])
  })
})
