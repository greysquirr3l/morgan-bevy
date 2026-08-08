/**
 * T58 — Tutorial system: step data, state machine, and persistence.
 *
 * This is a pure module (no React) so the step data + state machine
 * are unit-testable without rendering anything. The UI layer lives
 * in `src/components/Tutorial/` and imports from here.
 *
 * Persistence follows the established localStorage pattern used by
 * `src/utils/analytics.ts` / `src/utils/shortcutStore.ts`: a single
 * namespaced key, zod-validated on read, corruption-tolerant (falls
 * back to defaults rather than throwing). Per T87 the key must be
 * namespaced `morgan-bevy.<name>`.
 */

import { z } from 'zod'

// ─── Step + tutorial data ──────────────────────────────────────────────

/** `as const` tuple + derived literal union — project convention
 *  (see `src/types/menuActions.ts`) instead of a TS `enum`. */
export const TUTORIAL_ACTIONS = ['click', 'keypress', 'observe'] as const
export type TutorialActionType = (typeof TUTORIAL_ACTIONS)[number]

export interface TutorialStep {
  readonly id: string
  readonly title: string
  readonly body: string
  /** CSS selector for the element to spotlight — typically a
   *  `[data-tutorial-target="..."]` attribute selector added to the
   *  target component, or an existing stable class (e.g.
   *  `.viewport-3d`). */
  readonly targetSelector: string
  readonly action: TutorialActionType
  /**
   * For `action: 'keypress'` — the expected key combo, normalized as
   * `[ctrl+][shift+][alt+][meta+]<key>`, all lowercase, modifiers in
   * that fixed order (see `normalizeKeyCombo`). Unused otherwise.
   */
  readonly expectedValue?: string
  /** For `action: 'observe'` — delay (ms) before auto-advancing.
   *  Defaults to `DEFAULT_OBSERVE_DELAY_MS`. */
  readonly observeDelayMs?: number
}

export interface Tutorial {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly steps: readonly TutorialStep[]
}

export const DEFAULT_OBSERVE_DELAY_MS = 1200

/** Getting-started tutorial — maps to real, already-shipped
 *  features: place an object (ActionsPanel), select it (Hierarchy),
 *  inspect it (Inspector), move it (transform.translate shortcut,
 *  key `w`), save it (Ctrl+S). */
export const GETTING_STARTED_TUTORIAL: Tutorial = {
  id: 'getting-started',
  title: 'Getting Started',
  description: 'Place an object, select it, inspect it, move it, and save your work.',
  steps: [
    {
      id: 'place-object',
      title: 'Place an object',
      body: 'Click "Cube" in the Actions panel to add a cube to the scene.',
      targetSelector: '[data-tutorial-target="actions-create-cube"]',
      action: 'click',
    },
    {
      id: 'select-object',
      title: 'Select it',
      body: 'Click the object in the Hierarchy panel to select it.',
      targetSelector: '[data-tutorial-target="hierarchy-object-list"]',
      action: 'click',
    },
    {
      id: 'open-inspector',
      title: 'Open the Inspector',
      body: "The Inspector panel on the right shows the selected object's position, rotation, scale, and material.",
      targetSelector: '[data-tutorial-target="inspector-panel"]',
      action: 'observe',
    },
    {
      id: 'translate-object',
      title: 'Move it',
      body: 'Press W to switch to the Move tool, then drag an axis handle in the viewport to translate the object.',
      targetSelector: '.viewport-3d',
      action: 'keypress',
      expectedValue: 'w',
    },
    {
      id: 'save-project',
      title: 'Save your work',
      body: 'Press Ctrl+S to save a local snapshot — it is auto-restored the next time you open Morgan-Bevy.',
      targetSelector: '[data-tutorial-target="file-menu-trigger"]',
      action: 'keypress',
      expectedValue: 'ctrl+s',
    },
  ],
}

/** Per-feature tutorial: procedural generation (BSP / WFC). */
export const PROCEDURAL_GENERATION_TUTORIAL: Tutorial = {
  id: 'procedural-generation',
  title: 'Procedural Generation',
  description: 'Generate a level with BSP or WFC from the Generation panel.',
  steps: [
    {
      id: 'open-generation-panel',
      title: 'Open the Generation panel',
      body: 'The Generation panel on the right lets you run BSP or WFC level generation.',
      targetSelector: '[data-tutorial-target="generation-panel"]',
      action: 'observe',
    },
    {
      id: 'pick-algorithm',
      title: 'Pick an algorithm',
      body: 'Choose BSP for room-and-corridor layouts, or WFC for tile-based patterns.',
      targetSelector: '[data-tutorial-target="generation-algorithm-select"]',
      action: 'observe',
    },
    {
      id: 'generate',
      title: 'Generate',
      body: 'Click "Generate" to build a level from the selected algorithm and theme.',
      targetSelector: '[data-tutorial-target="generation-generate-button"]',
      action: 'click',
    },
  ],
}

export const TUTORIALS: readonly Tutorial[] = [
  GETTING_STARTED_TUTORIAL,
  PROCEDURAL_GENERATION_TUTORIAL,
]

export function getTutorial(tutorialId: string): Tutorial | undefined {
  return TUTORIALS.find(t => t.id === tutorialId)
}

// ─── State machine ──────────────────────────────────────────────────────

export const TUTORIAL_STATUSES = ['not-started', 'in-progress', 'completed', 'skipped'] as const
export type TutorialStatus = (typeof TUTORIAL_STATUSES)[number]

export interface TutorialProgress {
  readonly tutorialId: string
  readonly stepIndex: number
  readonly status: TutorialStatus
}

export function defaultProgress(tutorialId: string): TutorialProgress {
  return { tutorialId, stepIndex: 0, status: 'not-started' }
}

/**
 * Pure reducer for the tutorial state machine. Every transition is
 * enumerated explicitly with an exhaustive `switch` so a new event
 * type is a compile error until handled here.
 */
export type TutorialEvent =
  | { readonly type: 'start' }
  | { readonly type: 'advance'; readonly stepCount: number }
  | { readonly type: 'skip' }
  | { readonly type: 'restart' }

export function tutorialReducer(
  progress: TutorialProgress,
  event: TutorialEvent
): TutorialProgress {
  switch (event.type) {
    case 'start':
      return { ...progress, stepIndex: 0, status: 'in-progress' }
    case 'restart':
      return { ...progress, stepIndex: 0, status: 'in-progress' }
    case 'skip':
      return { ...progress, status: 'skipped' }
    case 'advance': {
      const nextIndex = progress.stepIndex + 1
      if (nextIndex >= event.stepCount) {
        return { ...progress, stepIndex: Math.max(0, event.stepCount - 1), status: 'completed' }
      }
      return { ...progress, stepIndex: nextIndex, status: 'in-progress' }
    }
    default:
      return assertNeverTutorialEvent(event)
  }
}

function assertNeverTutorialEvent(value: never): never {
  throw new Error(`Unhandled tutorial event: ${JSON.stringify(value)}`)
}

// ─── Keyboard combo normalization ───────────────────────────────────────

/**
 * Normalize a `KeyboardEvent` into the same `expectedValue` format
 * used by `TutorialStep.expectedValue` — lowercase key, modifiers
 * prefixed in a fixed order: ctrl, shift, alt, meta.
 */
export function normalizeKeyboardEvent(e: {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
}): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.shiftKey) parts.push('shift')
  if (e.altKey) parts.push('alt')
  if (e.metaKey) parts.push('meta')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

// ─── Persistence ─────────────────────────────────────────────────────────

// T87: every localStorage key must be namespaced `morgan-bevy.<name>`.
const STORAGE_KEY = 'morgan-bevy.tutorial'
const SCHEMA_VERSION = 1

const TutorialProgressSchema = z.object({
  tutorialId: z.string().min(1),
  stepIndex: z.number().int().nonnegative(),
  status: z.enum(TUTORIAL_STATUSES),
})

const TutorialPersistedSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  // Keyed by tutorial id. `.passthrough()`-free — a single
  // malformed entry is dropped on read rather than sinking the
  // whole map (see `readTutorialState`).
  progress: z.record(z.string(), z.unknown()),
})

export interface TutorialState {
  readonly schemaVersion: 1
  readonly progress: Readonly<Record<string, TutorialProgress>>
}

const EMPTY_STATE: TutorialState = { schemaVersion: SCHEMA_VERSION, progress: {} }

export function readTutorialState(): TutorialState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_STATE
    const parsed = TutorialPersistedSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      console.warn('tutorial: state corrupt, falling back to defaults:', parsed.error.message)
      return EMPTY_STATE
    }
    const progress: Record<string, TutorialProgress> = {}
    for (const [id, candidate] of Object.entries(parsed.data.progress)) {
      const result = TutorialProgressSchema.safeParse(candidate)
      if (result.success) progress[id] = result.data
    }
    return { schemaVersion: SCHEMA_VERSION, progress }
  } catch {
    return EMPTY_STATE
  }
}

function writeTutorialState(state: TutorialState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota / private mode — silent no-op, matches the rest of the
    // editor's localStorage layer.
  }
}

export function getTutorialProgress(tutorialId: string): TutorialProgress {
  const state = readTutorialState()
  return state.progress[tutorialId] ?? defaultProgress(tutorialId)
}

function persistProgress(progress: TutorialProgress): TutorialProgress {
  const state = readTutorialState()
  writeTutorialState({
    ...state,
    progress: { ...state.progress, [progress.tutorialId]: progress },
  })
  return progress
}

/** Start a tutorial fresh from step 0. */
export function startTutorial(tutorialId: string): TutorialProgress {
  const current = getTutorialProgress(tutorialId)
  return persistProgress(tutorialReducer(current, { type: 'start' }))
}

/**
 * Resume a tutorial that was mid-progress (survives reload — this
 * is the read side of that guarantee), or start fresh if it was
 * never started, already completed, or skipped. This is what the
 * Help menu entry points call.
 */
export function resumeOrStartTutorial(tutorialId: string): TutorialProgress {
  const current = getTutorialProgress(tutorialId)
  if (current.status === 'in-progress') return current
  return startTutorial(tutorialId)
}

/** Replay — always restarts from step 0 regardless of current status. */
export function restartTutorial(tutorialId: string): TutorialProgress {
  const current = getTutorialProgress(tutorialId)
  return persistProgress(tutorialReducer(current, { type: 'restart' }))
}

/** Advance one step. Completes automatically on the last step. */
export function advanceTutorialStep(tutorialId: string): TutorialProgress {
  const tutorial = getTutorial(tutorialId)
  const stepCount = tutorial?.steps.length ?? 0
  const current = getTutorialProgress(tutorialId)
  return persistProgress(tutorialReducer(current, { type: 'advance', stepCount }))
}

/** Skip — records the skip so the tutorial does not auto-resume. */
export function skipTutorial(tutorialId: string): TutorialProgress {
  const current = getTutorialProgress(tutorialId)
  return persistProgress(tutorialReducer(current, { type: 'skip' }))
}

/**
 * Whether this tutorial should be offered automatically (e.g. a
 * future first-run banner) — true only if the user has never
 * started, completed, or skipped it. This is the persisted signal
 * that satisfies "skipping records the skip and does not show it
 * again": once skipped, this returns `false` forever (until
 * `restartTutorial` is called explicitly, e.g. via a "Replay"
 * button). Morgan-Bevy does not currently wire an automatic prompt
 * — the tutorial is invoked explicitly from the Help menu — but this
 * is the read side a future first-run prompt would use.
 */
export function shouldAutoPrompt(tutorialId: string): boolean {
  return getTutorialProgress(tutorialId).status === 'not-started'
}

/** Test-only: reset all tutorial progress. Not re-exported via a
 *  barrel — only used by the tutorial test suite. */
export function _resetTutorialStateForTests(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
