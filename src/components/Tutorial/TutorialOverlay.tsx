/**
 * T58 — Tutorial spotlight overlay.
 *
 * Portal-rendered into `document.body` (same convention as other
 * full-screen modals in this codebase, e.g. `HelpModal`, except
 * those render in place — this one needs a true portal so the
 * spotlight can sit above every panel regardless of where the
 * overlay is mounted in the tree).
 *
 * Input outside the highlighted element is blocked by four opaque
 * "quadrant" divs surrounding the target's rect — the rect itself
 * is left uncovered so real clicks reach the real target underneath
 * (that's what `useTutorialStepValidation`'s `click` handler is
 * listening for). When the target can't be found, the overlay falls
 * back to a single full-screen backdrop plus a manual "Next" button
 * rather than crashing or blocking forever.
 *
 * Escape closes (pauses) the overlay — progress is left in-progress
 * and resumes next time, matching `HelpModal`'s Escape-closes
 * convention. "Skip tutorial" is a separate, explicit action that
 * records the skip so the tutorial doesn't need to be dismissed
 * again.
 */
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  advanceTutorialStep,
  getTutorial,
  restartTutorial,
  resumeOrStartTutorial,
  skipTutorial,
  type TutorialStatus,
  type TutorialStep,
} from '@/state/tutorial'

import { getSpotlightRect, type SpotlightRect } from './spotlightGeometry'
import { useFocusTrap } from './useFocusTrap'
import { useTutorialStepValidation } from './useTutorialStepValidation'

interface TutorialOverlayProps {
  /** `null` renders nothing. Set to a tutorial id to open it. */
  tutorialId: string | null
  onClose: () => void
}

const SPOTLIGHT_PADDING = 8

export default function TutorialOverlay({ tutorialId, onClose }: TutorialOverlayProps) {
  const tutorial = tutorialId ? getTutorial(tutorialId) : undefined
  const [stepIndex, setStepIndex] = useState(0)
  const [status, setStatus] = useState<TutorialStatus>('not-started')
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Resume-or-start whenever a tutorial is opened. This is the read
  // side of "tutorial state survives reload" — progress is read
  // straight from localStorage via `resumeOrStartTutorial`.
  useEffect(() => {
    if (!tutorialId) {
      setStatus('not-started')
      return
    }
    const progress = resumeOrStartTutorial(tutorialId)
    setStepIndex(progress.stepIndex)
    setStatus(progress.status)
  }, [tutorialId])

  const step: TutorialStep | undefined = tutorial?.steps[stepIndex]

  // Recompute the spotlight rect on step change and on
  // resize/scroll so the cutout tracks the (possibly moving) target.
  useEffect(() => {
    if (!step) {
      setRect(null)
      return
    }
    const update = () => setRect(getSpotlightRect(step.targetSelector, SPOTLIGHT_PADDING))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step])

  const handleValidated = () => {
    if (!tutorialId) return
    const progress = advanceTutorialStep(tutorialId)
    setStepIndex(progress.stepIndex)
    setStatus(progress.status)
  }

  useTutorialStepValidation(status === 'in-progress' ? step : undefined, handleValidated)
  useFocusTrap(cardRef, Boolean(tutorialId) && (status === 'in-progress' || status === 'completed'))

  useEffect(() => {
    if (!tutorialId) return
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [tutorialId, onClose])

  if (!tutorialId || !tutorial) return null

  const handleSkip = () => {
    skipTutorial(tutorialId)
    onClose()
  }

  const handleReplay = () => {
    const progress = restartTutorial(tutorialId)
    setStepIndex(progress.stepIndex)
    setStatus(progress.status)
  }

  if (status === 'completed') {
    return createPortal(
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60"
        role="dialog"
        aria-modal="true"
        aria-label={`${tutorial.title} tutorial complete`}
      >
        <div
          ref={cardRef}
          className="bg-editor-panel border border-editor-border rounded-lg p-6 max-w-sm w-full mx-4 text-center space-y-4"
        >
          <h2 className="text-lg font-semibold">{tutorial.title} complete!</h2>
          <p className="text-sm text-editor-textMuted">
            Nice work — you can replay this tutorial any time from the Help menu.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={handleReplay}
              className="px-3 py-1.5 text-sm bg-editor-bg hover:bg-editor-border border border-editor-border rounded"
            >
              Replay
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-editor-accent hover:bg-blue-600 text-white rounded"
            >
              Done
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  if (!step) return null

  const targetMissing = rect === null

  return createPortal(
    // Audit (Critical #6) regression: this outer div used to default
    // to `pointer-events: auto` for the whole viewport, so even though
    // the four quadrant blockers deliberately left the spotlight
    // rectangle uncovered, the wrapper itself was still on top of
    // every target and silently absorbed the click. The target's own
    // click handler never fired, so step-validation never advanced
    // — 3 of 8 tutorial steps stuck permanently. Flip the wrapper to
    // `pointer-events: none` and re-enable `pointer-events: auto` on
    // the elements that DO need to receive input (the quadrants
    // block clicks, the step card owns its own buttons, the missing-
    // target backdrop catches input as before).
    <div
      className="fixed inset-0 z-[10000] pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label={`${tutorial.title} tutorial`}
      data-testid="tutorial-overlay"
    >
      {rect ? (
        <>
          {/* Blocking quadrants — the rect itself is left open so
              the real target underneath stays clickable. The four
              blockers each re-enable pointer events to absorb
              clicks outside the spotlight. */}
          <div
            className="fixed bg-black/60 pointer-events-auto"
            style={{ top: 0, left: 0, right: 0, height: rect.top }}
          />
          <div
            className="fixed bg-black/60 pointer-events-auto"
            style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="fixed bg-black/60 pointer-events-auto"
            style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }}
          />
          <div
            className="fixed bg-black/60 pointer-events-auto"
            style={{
              top: rect.top,
              left: rect.left + rect.width,
              right: 0,
              height: rect.height,
            }}
          />
          <div
            className="fixed border-2 border-editor-accent rounded pointer-events-none"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          />
        </>
      ) : (
        // When the target can't be located, fall back to a full-
        // screen backdrop with `pointer-events: auto` so the user
        // can't poke at the app behind it (the "Next" button in the
        // step card is the only escape).
        <div className="fixed inset-0 bg-black/60 pointer-events-auto" />
      )}

      {/* Step card */}
      <div
        ref={cardRef}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-editor-panel border border-editor-border rounded-lg shadow-2xl p-5 max-w-md w-full mx-4 space-y-3 pointer-events-auto"
        data-testid="tutorial-step-card"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-editor-accent">
              {tutorial.title} — Step {stepIndex + 1} of {tutorial.steps.length}
            </div>
            <h3 className="text-base font-semibold mt-1">{step.title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close tutorial"
            className="p-1 rounded hover:bg-editor-border"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-editor-textMuted">{step.body}</p>
        {targetMissing && (
          <p className="text-xs text-yellow-500" role="status">
            Couldn&apos;t find this step&apos;s target on screen right now — click Next to continue
            anyway.
          </p>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-editor-border">
          <button
            onClick={handleSkip}
            className="text-xs text-editor-textMuted hover:text-editor-text"
          >
            Skip tutorial
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleReplay}
              className="px-3 py-1.5 text-xs bg-editor-bg hover:bg-editor-border border border-editor-border rounded"
            >
              Replay
            </button>
            {targetMissing && (
              <button
                onClick={handleValidated}
                className="px-3 py-1.5 text-xs bg-editor-accent hover:bg-blue-600 text-white rounded"
              >
                Next
              </button>
            )}
          </div>
        </div>
        <div className="text-xs text-editor-textMuted pt-1">
          Press{' '}
          <kbd className="px-1 py-0.5 bg-editor-bg rounded border border-editor-border">Esc</kbd> to
          pause.
        </div>
      </div>
    </div>,
    document.body
  )
}
