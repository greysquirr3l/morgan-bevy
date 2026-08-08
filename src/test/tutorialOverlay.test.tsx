/**
 * T58 — TutorialOverlay component tests.
 *
 * Covers the two required cases end-to-end through the rendered
 * overlay (click on the real target advances the step; skip
 * persists), plus keyboard-navigation (Escape pauses, Tab stays
 * inside the trap) and the missing-target fallback.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TutorialOverlay from '@/components/Tutorial'
import {
  _resetTutorialStateForTests,
  getTutorialProgress,
  shouldAutoPrompt,
} from '@/state/tutorial'

beforeEach(() => {
  _resetTutorialStateForTests()
})

describe('T58 TutorialOverlay', () => {
  it('renders nothing when no tutorial is active', () => {
    const { container } = render(<TutorialOverlay tutorialId={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('completing step 1 (clicking the real target) advances to step 2', () => {
    render(
      <>
        <button data-tutorial-target="actions-create-cube">Cube</button>
        <TutorialOverlay tutorialId="getting-started" onClose={vi.fn()} />
      </>
    )
    expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cube'))

    expect(screen.getByText(/Step 2 of 5/)).toBeInTheDocument()
    expect(getTutorialProgress('getting-started').stepIndex).toBe(1)
  })

  it('skipping the tutorial records the skip and does not auto-prompt again', () => {
    const onClose = vi.fn()
    render(<TutorialOverlay tutorialId="getting-started" onClose={onClose} />)

    fireEvent.click(screen.getByText('Skip tutorial'))

    expect(onClose).toHaveBeenCalledOnce()
    expect(getTutorialProgress('getting-started').status).toBe('skipped')
    expect(shouldAutoPrompt('getting-started')).toBe(false)
  })

  it('falls back gracefully when the target selector matches nothing', () => {
    // No `actions-create-cube` element is rendered anywhere — the
    // overlay must not crash, and should offer a manual way past
    // the un-locatable step.
    render(<TutorialOverlay tutorialId="getting-started" onClose={vi.fn()} />)

    expect(screen.getByText(/couldn.t find/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(getTutorialProgress('getting-started').stepIndex).toBe(1)
  })

  it('reload mid-tutorial resumes at the persisted step instead of restarting', () => {
    const { unmount } = render(<TutorialOverlay tutorialId="getting-started" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' })) // target missing -> manual advance
    unmount()

    // Simulate a reload: fresh mount, same tutorial id.
    render(<TutorialOverlay tutorialId="getting-started" onClose={vi.fn()} />)
    expect(screen.getByText(/Step 2 of 5/)).toBeInTheDocument()
  })

  it('Escape closes (pauses) without recording a skip', () => {
    const onClose = vi.fn()
    render(<TutorialOverlay tutorialId="getting-started" onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
    expect(getTutorialProgress('getting-started').status).toBe('in-progress')
  })

  it('replay resets to step 1', () => {
    render(<TutorialOverlay tutorialId="getting-started" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(/Step 2 of 5/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))

    expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument()
    expect(getTutorialProgress('getting-started').stepIndex).toBe(0)
  })

  it('Tab cycles focus within the step card (focus trap)', () => {
    render(<TutorialOverlay tutorialId="getting-started" onClose={vi.fn()} />)
    const card = screen.getByTestId('tutorial-step-card')
    const focusable = card.querySelectorAll('button')
    expect(focusable.length).toBeGreaterThan(0)
    const last = focusable[focusable.length - 1] as HTMLElement
    last.focus()
    fireEvent.keyDown(card, { key: 'Tab' })
    expect(document.activeElement).toBe(focusable[0])
  })

  it('shows the second per-feature tutorial (procedural generation)', () => {
    render(<TutorialOverlay tutorialId="procedural-generation" onClose={vi.fn()} />)
    expect(screen.getByText(/Procedural Generation — Step 1 of 3/)).toBeInTheDocument()
  })
})
