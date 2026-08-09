// T57 — Pure patrol-route traversal stepping.
//
// `nextPatrolIndex` is deliberately RNG-injected (never calls
// `Math.random()` internally) so `random` mode is deterministic and
// testable — the caller (a future runtime/AI system, out of this
// task's scope) supplies `Math.random` in production and a seeded
// stub in tests.

import type { PatrolRoute } from '@/types/waypoints'

export interface PatrolStep {
  index: number
  direction: 1 | -1
}

/**
 * Compute the next waypoint index for a patrol route given the
 * current index and direction of travel.
 *
 * - `loop`: advances by `direction`, wrapping past either end back
 *   to the opposite end (`A -> B -> C -> A -> ...` for `direction:
 *   1`). `direction` is returned unchanged.
 * - `ping-pong`: advances by `direction` until it would run off
 *   either end, then reverses (`A -> B -> C -> B -> A -> ...`).
 * - `random`: picks a uniformly random index other than
 *   `currentIndex` using the injected `rng` (defaults to
 *   `Math.random`); `direction` passes through unchanged (it isn't
 *   meaningful for random traversal, but the return shape stays
 *   uniform across modes so callers don't need a mode switch).
 *
 * Routes with 0 or 1 waypoints have no next index to compute; both
 * are handled by returning `{ index: 0, direction }` without
 * touching `rng` or looping.
 */
export function nextPatrolIndex(
  route: Pick<PatrolRoute, 'waypointIds' | 'mode'>,
  currentIndex: number,
  direction: 1 | -1,
  rng: () => number = Math.random
): PatrolStep {
  const n = route.waypointIds.length
  if (n <= 1) return { index: 0, direction }

  switch (route.mode) {
    case 'loop': {
      const index = (((currentIndex + direction) % n) + n) % n
      return { index, direction }
    }
    case 'ping-pong': {
      const raw = currentIndex + direction
      if (raw >= n) return { index: n - 2, direction: -1 }
      if (raw < 0) return { index: Math.min(1, n - 1), direction: 1 }
      return { index: raw, direction }
    }
    case 'random': {
      let index = currentIndex
      // n >= 2 here (n <= 1 short-circuited above), so this always
      // terminates.
      while (index === currentIndex) {
        index = Math.floor(rng() * n)
      }
      return { index, direction }
    }
    default: {
      // Exhaustiveness guard — PatrolMode is a closed union, so this
      // is unreachable at the type level; kept as a safe fallback
      // rather than a `never` cast that would crash at runtime if
      // the union is ever widened without updating this switch.
      return { index: currentIndex, direction }
    }
  }
}
