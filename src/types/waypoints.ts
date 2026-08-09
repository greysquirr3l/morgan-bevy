// T57 — AI waypoint placement + patrol route data model.
//
// These are editor-authored objects, distinct from `NavMesh` (which
// is regenerated on demand from scene geometry, T56). Waypoints and
// patrol routes are hand-placed by the level designer and persist
// independently of any particular navmesh generation — the same
// pattern as `lights` (T55) in `editorStore.ts`.
//
// Wire format (export payloads / Rust mirror): field names here are
// camelCase on the TS side but the export payload builders
// (`src/utils/exportPayload.ts`) translate to the snake_case keys
// the Rust `Waypoint` / `PatrolRoute` structs expect
// (`src-tauri/src/spatial/waypoints.rs`) — see that module's doc
// comment for the exact wire shape.

import type { PatrolRouteId, WaypointId } from '@/types/brand'

/**
 * A single navigation waypoint. `dwellTime` (seconds) and
 * `nextWaypointId` are both optional — a waypoint with neither is a
 * bare position marker; `nextWaypointId` lets a waypoint carry an
 * explicit single successor independent of any `PatrolRoute` (e.g.
 * a one-off "go here, then there" link), while `PatrolRoute` models
 * an ordered, named sequence with a traversal mode.
 */
export interface Waypoint {
  id: WaypointId
  position: [number, number, number]
  /** Seconds to pause at this waypoint before continuing. Absent
   *  means "no dwell" (pass through immediately). */
  dwellTime?: number
  /** Optional explicit link to the next waypoint, independent of
   *  patrol route membership. */
  nextWaypointId?: WaypointId
}

/**
 * Traversal modes for a `PatrolRoute`:
 * - `loop`: after the last waypoint, wrap back to the first.
 * - `ping-pong`: bounce back and forth between the first and last.
 * - `random`: jump to a random *other* waypoint in the route each step.
 *
 * `as const` + derived union, per project convention (see
 * `src/utils/paintTool.ts`'s `BRUSH_FALLOFFS`) — the array doubles as
 * the source of truth for UI mode selectors.
 */
export const PATROL_MODES = ['loop', 'ping-pong', 'random'] as const
export type PatrolMode = (typeof PATROL_MODES)[number]

/**
 * An ordered patrol route: a sequence of waypoint ids plus how to
 * traverse them. `waypointIds` references `Waypoint.id`s held
 * elsewhere (the editor store's `waypoints` array) rather than
 * embedding the waypoints themselves, so editing a waypoint's
 * position doesn't require touching every route that references it.
 */
export interface PatrolRoute {
  id: PatrolRouteId
  waypointIds: WaypointId[]
  mode: PatrolMode
}
