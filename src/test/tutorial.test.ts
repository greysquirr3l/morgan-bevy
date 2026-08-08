/**
 * T58 — Tutorial state machine + persistence unit tests.
 *
 * Covers the two required cases from the task spec:
 *   - completing step 1 advances to step 2
 *   - skipping records the skip and does not auto-prompt again
 * plus edge cases: reload mid-tutorial resumes at the persisted
 * step, and corrupt/missing localStorage falls back to defaults
 * instead of throwing.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  _resetTutorialStateForTests,
  advanceTutorialStep,
  defaultProgress,
  GETTING_STARTED_TUTORIAL,
  getTutorial,
  getTutorialProgress,
  normalizeKeyboardEvent,
  PROCEDURAL_GENERATION_TUTORIAL,
  readTutorialState,
  restartTutorial,
  resumeOrStartTutorial,
  shouldAutoPrompt,
  skipTutorial,
  startTutorial,
  TUTORIALS,
  tutorialReducer,
} from '@/state/tutorial'

beforeEach(() => {
  _resetTutorialStateForTests()
})

describe('T58 tutorial data', () => {
  it('every tutorial has at least one step and a unique step id set', () => {
    for (const tutorial of TUTORIALS) {
      expect(tutorial.steps.length).toBeGreaterThan(0)
      const ids = new Set(tutorial.steps.map(s => s.id))
      expect(ids.size).toBe(tutorial.steps.length)
    }
  })

  it('tutorial ids are unique', () => {
    const ids = new Set(TUTORIALS.map(t => t.id))
    expect(ids.size).toBe(TUTORIALS.length)
  })

  it('getTutorial resolves a known id and returns undefined for an unknown one', () => {
    expect(getTutorial('getting-started')).toBe(GETTING_STARTED_TUTORIAL)
    expect(getTutorial('procedural-generation')).toBe(PROCEDURAL_GENERATION_TUTORIAL)
    expect(getTutorial('does-not-exist')).toBeUndefined()
  })

  it('every keypress step declares an expectedValue', () => {
    for (const tutorial of TUTORIALS) {
      for (const step of tutorial.steps) {
        if (step.action === 'keypress') {
          expect(step.expectedValue).toBeTruthy()
        }
      }
    }
  })
})

describe('T58 tutorialReducer', () => {
  it('completing step 1 advances to step 2', () => {
    const start = tutorialReducer(defaultProgress('getting-started'), { type: 'start' })
    expect(start).toEqual({ tutorialId: 'getting-started', stepIndex: 0, status: 'in-progress' })

    const afterStep1 = tutorialReducer(start, {
      type: 'advance',
      stepCount: GETTING_STARTED_TUTORIAL.steps.length,
    })
    expect(afterStep1.stepIndex).toBe(1)
    expect(afterStep1.status).toBe('in-progress')
  })

  it('advancing past the last step completes the tutorial', () => {
    const stepCount = 2
    let progress = tutorialReducer(defaultProgress('x'), { type: 'start' })
    progress = tutorialReducer(progress, { type: 'advance', stepCount })
    expect(progress.status).toBe('in-progress')
    progress = tutorialReducer(progress, { type: 'advance', stepCount })
    expect(progress).toEqual({ tutorialId: 'x', stepIndex: 1, status: 'completed' })
  })

  it('skip sets status to skipped without changing stepIndex', () => {
    const progress = tutorialReducer(
      { tutorialId: 'x', stepIndex: 2, status: 'in-progress' },
      { type: 'skip' }
    )
    expect(progress).toEqual({ tutorialId: 'x', stepIndex: 2, status: 'skipped' })
  })

  it('restart resets to step 0 regardless of prior status', () => {
    const progress = tutorialReducer(
      { tutorialId: 'x', stepIndex: 4, status: 'completed' },
      { type: 'restart' }
    )
    expect(progress).toEqual({ tutorialId: 'x', stepIndex: 0, status: 'in-progress' })
  })
})

describe('T58 tutorial persistence', () => {
  it('starts with not-started defaults when nothing is persisted', () => {
    expect(getTutorialProgress('getting-started')).toEqual(defaultProgress('getting-started'))
    expect(readTutorialState()).toEqual({ schemaVersion: 1, progress: {} })
  })

  it('completing step 1 advances to step 2 and persists', () => {
    startTutorial('getting-started')
    const progress = advanceTutorialStep('getting-started')
    expect(progress.stepIndex).toBe(1)
    expect(progress.status).toBe('in-progress')
    // Re-reading (simulating a fresh module load) sees the same state.
    expect(getTutorialProgress('getting-started').stepIndex).toBe(1)
  })

  it('skipping the tutorial records the skip and does not show it again', () => {
    startTutorial('getting-started')
    skipTutorial('getting-started')
    expect(getTutorialProgress('getting-started').status).toBe('skipped')
    expect(shouldAutoPrompt('getting-started')).toBe(false)

    // Even after "reloading" (fresh reads), the skip persists.
    expect(getTutorialProgress('getting-started').status).toBe('skipped')
    expect(shouldAutoPrompt('getting-started')).toBe(false)
  })

  it('reload mid-tutorial resumes at the persisted step (does not restart)', () => {
    startTutorial('getting-started')
    advanceTutorialStep('getting-started')
    advanceTutorialStep('getting-started')
    // Simulate reopening the tutorial after a reload.
    const resumed = resumeOrStartTutorial('getting-started')
    expect(resumed.stepIndex).toBe(2)
    expect(resumed.status).toBe('in-progress')
  })

  it('resumeOrStartTutorial starts fresh for a completed or skipped tutorial', () => {
    startTutorial('getting-started')
    skipTutorial('getting-started')
    const resumed = resumeOrStartTutorial('getting-started')
    expect(resumed).toEqual({ tutorialId: 'getting-started', stepIndex: 0, status: 'in-progress' })
  })

  it('replay always restarts from step 0', () => {
    startTutorial('getting-started')
    advanceTutorialStep('getting-started')
    const replayed = restartTutorial('getting-started')
    expect(replayed.stepIndex).toBe(0)
    expect(replayed.status).toBe('in-progress')
  })

  it('tracks two tutorials independently', () => {
    startTutorial('getting-started')
    advanceTutorialStep('getting-started')
    startTutorial('procedural-generation')
    expect(getTutorialProgress('getting-started').stepIndex).toBe(1)
    expect(getTutorialProgress('procedural-generation').stepIndex).toBe(0)
  })

  it('corrupt JSON in localStorage falls back to defaults instead of throwing', () => {
    localStorage.setItem('morgan-bevy.tutorial', '{not-json')
    expect(() => getTutorialProgress('getting-started')).not.toThrow()
    expect(getTutorialProgress('getting-started')).toEqual(defaultProgress('getting-started'))
  })

  it('a malformed entry for one tutorial does not sink the whole state', () => {
    localStorage.setItem(
      'morgan-bevy.tutorial',
      JSON.stringify({
        schemaVersion: 1,
        progress: {
          'getting-started': { tutorialId: 'getting-started', stepIndex: 1, status: 'in-progress' },
          bogus: { tutorialId: 'bogus', stepIndex: 'not-a-number', status: 'in-progress' },
        },
      })
    )
    expect(getTutorialProgress('getting-started').stepIndex).toBe(1)
    expect(getTutorialProgress('bogus')).toEqual(defaultProgress('bogus'))
  })
})

describe('T58 normalizeKeyboardEvent', () => {
  it('normalizes a bare key press', () => {
    expect(
      normalizeKeyboardEvent({ key: 'W', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false })
    ).toBe('w')
  })

  it('normalizes modifiers in a fixed order', () => {
    expect(
      normalizeKeyboardEvent({ key: 'S', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false })
    ).toBe('ctrl+s')
    expect(
      normalizeKeyboardEvent({ key: 's', ctrlKey: true, shiftKey: true, altKey: true, metaKey: true })
    ).toBe('ctrl+shift+alt+meta+s')
  })
})
