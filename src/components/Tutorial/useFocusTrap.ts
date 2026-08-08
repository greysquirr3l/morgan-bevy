/**
 * T58 — Minimal focus trap for the tutorial overlay.
 *
 * No `@radix-ui` primitive with a focus-trap ships in this project's
 * dependencies today (checked `package.json`), and the trap needed
 * here is small: keep Tab/Shift+Tab cycling within the overlay card
 * while it is open. Written by hand rather than pulling in a new
 * dependency.
 */
import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    // Move focus into the trap on open.
    const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    if (focusables.length > 0 && !container.contains(document.activeElement)) {
      focusables[0]?.focus()
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const currentFocusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      )
      if (currentFocusables.length === 0) return

      const first = currentFocusables[0]
      const last = currentFocusables[currentFocusables.length - 1]
      if (!first || !last) return

      const activeElement = document.activeElement

      if (e.shiftKey) {
        if (activeElement === first || !container.contains(activeElement)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (activeElement === last || !container.contains(activeElement)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeydown)
    return () => container.removeEventListener('keydown', handleKeydown)
  }, [containerRef, active])
}
