/**
 * T58 — Spotlight rect computation for the tutorial overlay.
 *
 * Looks up `targetSelector` in the live DOM and returns a padded
 * bounding rect the overlay uses to cut a hole in the dimmed
 * backdrop. Returns `null` (rather than throwing) when the selector
 * doesn't match anything — an invalid/missing target degrades the
 * overlay to a full-screen backdrop with a "target not found"
 * fallback instead of crashing (see `TutorialOverlay`).
 */

export interface SpotlightRect {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

export function getSpotlightRect(
  targetSelector: string,
  padding = 8
): SpotlightRect | null {
  let el: Element | null
  try {
    el = document.querySelector(targetSelector)
  } catch {
    // Malformed CSS selector — treat exactly like "not found".
    return null
  }
  if (!el) return null

  const domRect = el.getBoundingClientRect()
  if (domRect.width === 0 && domRect.height === 0) return null

  return {
    top: Math.max(0, domRect.top - padding),
    left: Math.max(0, domRect.left - padding),
    width: domRect.width + padding * 2,
    height: domRect.height + padding * 2,
  }
}
