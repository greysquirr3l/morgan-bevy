/**
 * T58 — spotlight geometry edge cases: an invalid or missing
 * `targetSelector` must degrade gracefully (return `null`) rather
 * than throwing, so the overlay never crashes on bad step data.
 */
import { describe, expect, it } from 'vitest'

import { getSpotlightRect } from '@/components/Tutorial/spotlightGeometry'

describe('T58 getSpotlightRect', () => {
  it('returns null when the selector matches nothing', () => {
    expect(getSpotlightRect('[data-tutorial-target="does-not-exist"]')).toBeNull()
  })

  it('returns null (does not throw) for a malformed CSS selector', () => {
    expect(() => getSpotlightRect('[[[not-valid-css')).not.toThrow()
    expect(getSpotlightRect('[[[not-valid-css')).toBeNull()
  })

  it('returns a padded rect for a positioned element', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    el.getBoundingClientRect = () => ({
      top: 100,
      left: 50,
      width: 200,
      height: 40,
      right: 250,
      bottom: 140,
      x: 50,
      y: 100,
      toJSON() {
        return this
      },
    })
    el.setAttribute('data-tutorial-target', 'positioned')

    const rect = getSpotlightRect('[data-tutorial-target="positioned"]', 10)
    expect(rect).toEqual({ top: 90, left: 40, width: 220, height: 60 })

    document.body.removeChild(el)
  })
})
