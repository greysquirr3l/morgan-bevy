/**
 * T58 — Validates a tutorial step's practice action.
 *
 * Wired via a single hook rather than scattering global event
 * listeners across app components:
 *   - `click`    — listens for a click that lands on (or inside) the
 *                  element matching `step.targetSelector`.
 *   - `keypress` — listens for a `keydown` whose normalized combo
 *                  matches `step.expectedValue`.
 *   - `observe`  — auto-advances after `step.observeDelayMs` (or the
 *                  default delay) with no user action required.
 *
 * A missing/invalid `targetSelector` does not throw — `click`
 * validation simply never fires (the overlay's "target not found"
 * fallback lets the user click Next manually instead).
 */
import { useEffect } from 'react'

import {
  DEFAULT_OBSERVE_DELAY_MS,
  normalizeKeyboardEvent,
  type TutorialStep,
} from '@/state/tutorial'

export function useTutorialStepValidation(
  step: TutorialStep | undefined,
  onValidated: () => void
): void {
  useEffect(() => {
    if (!step) return

    if (step.action === 'observe') {
      const timer = window.setTimeout(onValidated, step.observeDelayMs ?? DEFAULT_OBSERVE_DELAY_MS)
      return () => window.clearTimeout(timer)
    }

    if (step.action === 'click') {
      const handleClick = (e: MouseEvent) => {
        const target = e.target
        if (!(target instanceof Element)) return
        if (target.closest(step.targetSelector)) onValidated()
      }
      document.addEventListener('click', handleClick, true)
      return () => document.removeEventListener('click', handleClick, true)
    }

    if (step.action === 'keypress') {
      const handleKeydown = (e: KeyboardEvent) => {
        if (!step.expectedValue) return
        if (normalizeKeyboardEvent(e) === step.expectedValue) onValidated()
      }
      window.addEventListener('keydown', handleKeydown)
      return () => window.removeEventListener('keydown', handleKeydown)
    }

    return undefined
  }, [step, onValidated])
}
