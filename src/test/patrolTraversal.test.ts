/**
 * T57 — `nextPatrolIndex` (pure patrol-route traversal stepping).
 */
import { describe, expect, it } from 'vitest'

import { PatrolRouteId, WaypointId } from '@/types/brand'
import type { PatrolRoute } from '@/types/waypoints'
import { nextPatrolIndex } from '@/utils/patrolTraversal'

function route(waypointIds: string[], mode: PatrolRoute['mode']): PatrolRoute {
  return {
    id: PatrolRouteId('route1'),
    waypointIds: waypointIds.map(id => WaypointId(id)),
    mode,
  }
}

describe('T57 nextPatrolIndex', () => {
  // ─── Required test: loop mode A -> B -> C -> A -> ... ───────────────────
  it('loop mode traverses [A, B, C] as A -> B -> C -> A -> ...', () => {
    const r = route(['A', 'B', 'C'], 'loop')
    let index = 0
    let direction: 1 | -1 = 1
    const visited: number[] = [index]
    for (let i = 0; i < 8; i++) {
      const step = nextPatrolIndex(r, index, direction)
      index = step.index
      direction = step.direction
      visited.push(index)
    }
    expect(visited).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2])
  })

  it('loop mode wraps backwards when direction is -1', () => {
    const r = route(['A', 'B', 'C'], 'loop')
    const step = nextPatrolIndex(r, 0, -1)
    expect(step).toEqual({ index: 2, direction: -1 })
  })

  // ─── Edge case: ping-pong bounces at either end ─────────────────────────
  it('ping-pong mode bounces direction at both ends', () => {
    const r = route(['A', 'B', 'C'], 'ping-pong')
    let index = 0
    let direction: 1 | -1 = 1
    const visited: Array<{ index: number; direction: 1 | -1 }> = [{ index, direction }]
    for (let i = 0; i < 6; i++) {
      const step = nextPatrolIndex(r, index, direction)
      index = step.index
      direction = step.direction
      visited.push({ index, direction })
    }
    // A(0,+1) -> B(1,+1) -> C(2,+1) -> bounce -> B(1,-1) -> A(0,-1) -> bounce -> B(1,+1) -> C(2,+1)
    expect(visited.map(v => v.index)).toEqual([0, 1, 2, 1, 0, 1, 2])
    expect(visited[2]).toEqual({ index: 2, direction: 1 })
    expect(visited[3]).toEqual({ index: 1, direction: -1 })
  })

  // ─── Edge case: random mode uses the injected RNG deterministically ────
  it('random mode picks a different index using the injected rng, never Math.random directly', () => {
    const r = route(['A', 'B', 'C'], 'random')
    // Stub rng always returns a value that would map to the current
    // index first (0 / 3 = index 0), then a different index (2/3 ->
    // index 2) — verifies the "pick a different index" loop actually
    // re-samples rather than accepting the first draw blindly.
    const values = [0, 2 / 3]
    let call = 0
    const rng = () => {
      const v = values[call] ?? 0
      call += 1
      return v
    }
    const step = nextPatrolIndex(r, 0, 1, rng)
    expect(step.index).toBe(2)
    expect(step.index).not.toBe(0)
  })

  // ─── Degenerate routes ───────────────────────────────────────────────────
  it('a route with 0 or 1 waypoints has no next index to compute', () => {
    expect(nextPatrolIndex(route([], 'loop'), 0, 1)).toEqual({ index: 0, direction: 1 })
    expect(nextPatrolIndex(route(['A'], 'loop'), 0, 1)).toEqual({ index: 0, direction: 1 })
  })
})
