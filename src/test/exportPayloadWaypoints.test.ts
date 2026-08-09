/**
 * T57 — waypoints / patrol routes threaded through the export
 * payload builders (`src/utils/exportPayload.ts`), verifying the
 * "waypoints and routes export to JSON" exit criterion at the
 * payload-construction layer (the layer this repo's tests can
 * exercise without a live Tauri backend).
 */
import { describe, expect, it } from 'vitest'

import { PatrolRouteId, WaypointId } from '@/types/brand'
import type { PatrolRoute, Waypoint } from '@/types/waypoints'
import {
  buildFileMenuLevelExportPayload,
  buildLevelExportPayload,
  buildPatrolRoutesExport,
  buildWaypointsExport,
} from '@/utils/exportPayload'

const waypoints: Waypoint[] = [
  { id: WaypointId('wp1'), position: [1, 0, 2], dwellTime: 1.5 },
  { id: WaypointId('wp2'), position: [3, 0, 4] },
]
const patrolRoutes: PatrolRoute[] = [
  { id: PatrolRouteId('r1'), waypointIds: [WaypointId('wp1'), WaypointId('wp2')], mode: 'loop' },
]

describe('T57 export payload waypoints wiring', () => {
  it('buildLevelExportPayload carries waypoints/patrol_routes with snake_case wire keys', () => {
    const payload = buildLevelExportPayload([], { waypoints, patrolRoutes })
    expect(payload.waypoints).toEqual([
      { id: 'wp1', position: [1, 0, 2], dwell_time: 1.5 },
      { id: 'wp2', position: [3, 0, 4] },
    ])
    expect(payload.patrol_routes).toEqual([
      { id: 'r1', waypoint_ids: ['wp1', 'wp2'], mode: 'loop' },
    ])
  })

  it('buildLevelExportPayload defaults to empty arrays when omitted', () => {
    const payload = buildLevelExportPayload([])
    expect(payload.waypoints).toEqual([])
    expect(payload.patrol_routes).toEqual([])
  })

  it('buildFileMenuLevelExportPayload carries waypoints/patrol_routes too', () => {
    const payload = buildFileMenuLevelExportPayload([], { waypoints, patrolRoutes })
    expect(payload.waypoints).toHaveLength(2)
    expect(payload.patrol_routes).toHaveLength(1)
  })

  it('a waypoint with no dwellTime omits dwell_time from the wire payload', () => {
    const payload = buildLevelExportPayload([], { waypoints })
    expect(payload.waypoints[1]).toEqual({ id: 'wp2', position: [3, 0, 4] })
    expect('dwell_time' in (payload.waypoints[1] as object)).toBe(false)
  })

  it('buildWaypointsExport / buildPatrolRoutesExport (JSON scene export) produce the same wire shape', () => {
    expect(buildWaypointsExport(waypoints)).toEqual([
      { id: 'wp1', position: [1, 0, 2], dwell_time: 1.5 },
      { id: 'wp2', position: [3, 0, 4] },
    ])
    expect(buildPatrolRoutesExport(patrolRoutes)).toEqual([
      { id: 'r1', waypoint_ids: ['wp1', 'wp2'], mode: 'loop' },
    ])
  })
})
