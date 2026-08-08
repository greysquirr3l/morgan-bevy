# Interactive Tutorial (T58)

Morgan-Bevy ships an in-app, interactive tutorial that walks a new
user through the editor's core workflow directly in the running app
— no external docs required for the guided steps themselves.

## Starting a tutorial

Open **Help → Getting Started Tutorial** or **Help → Procedural
Generation Tutorial**. Each launches a spotlight overlay that dims
the rest of the editor and highlights one UI element at a time.

- **Getting Started** (5 steps): place a cube, select it in the
  Hierarchy, open the Inspector, move it with **W** + drag, and
  save with **Ctrl+S**. Every step maps to a real, already-shipped
  feature — nothing in the tutorial is a simulation.
- **Procedural Generation** (3 steps): a short walkthrough of the
  Generation panel — open it, pick BSP or WFC, and generate a level.

## How a step is validated

Each step defines a **practice action** the user must actually
perform before the tutorial advances:

- `click` — click the highlighted element.
- `keypress` — press a specific key (or key combo, e.g. Ctrl+S).
- `observe` — no action needed; the step auto-advances after a
  short delay (used for "look at this panel" steps).

Input outside the highlighted element is blocked: the overlay dims
everything except a cutout around the current target, so a new user
can't wander off-script mid-step. If a step's target element can't
be found on screen (e.g. its panel is collapsed), the overlay
degrades gracefully — it shows a "couldn't find this step's target"
notice and a manual **Next** button instead of blocking forever or
crashing.

## Controls

- **Skip tutorial** — dismisses the tutorial and records the skip
  (see persistence below).
- **Replay** — restarts the current tutorial from step 1.
- **Escape** — pauses (closes the overlay without recording a
  skip); progress is preserved and resumes next time the same
  tutorial is opened. This matches the Escape-closes convention
  used by the Help modal.
- **Tab / Shift+Tab** — cycles focus within the tutorial card only
  (a minimal focus trap), so keyboard users can't tab out into the
  dimmed editor behind the overlay.

## Persistence

Tutorial progress is stored in `localStorage` under the namespaced
key `morgan-bevy.tutorial`, one entry per tutorial id
(`getting-started`, `procedural-generation`, …). It survives a
reload: closing the editor (or the tab, for local dev) mid-tutorial
and reopening the same tutorial from the Help menu resumes at the
step you left off, rather than restarting from step 1. A completed
or skipped tutorial starts fresh (step 1) the next time it's opened
explicitly.

The storage read path is corruption-tolerant: malformed JSON, or a
malformed entry for one tutorial, falls back to that tutorial's
defaults instead of throwing or corrupting the other tutorials'
progress.

## Architecture

- `src/state/tutorial.ts` — pure step data (`GETTING_STARTED_TUTORIAL`,
  `PROCEDURAL_GENERATION_TUTORIAL`), the state machine
  (`tutorialReducer`, statuses `not-started` / `in-progress` /
  `completed` / `skipped`), and localStorage persistence. No React
  dependency — fully unit-testable.
- `src/components/Tutorial/TutorialOverlay.tsx` — the portal-rendered
  (`ReactDOM.createPortal` into `document.body`) spotlight overlay,
  step card, and Skip/Replay/Next controls.
- `src/components/Tutorial/useTutorialStepValidation.ts` — wires the
  `click` / `keypress` / `observe` practice-action validation via a
  single hook, rather than scattering listeners across app
  components.
- `src/components/Tutorial/useFocusTrap.ts` — the minimal hand-rolled
  focus trap (no new dependency — the project doesn't ship a
  focus-trap-capable primitive today).
- `src/components/Tutorial/spotlightGeometry.ts` — pure geometry
  helper that resolves a `targetSelector` to a padded bounding rect,
  or `null` if the target can't be found (never throws).

Target elements are marked with a `data-tutorial-target="..."`
attribute (see `ActionsPanel`, `Hierarchy`, `Inspector`,
`GenerationPanel`, and the File menu trigger in `App.tsx`) or, where
one already exists and is stable, an existing class (`.viewport-3d`).

## Manual QA note

The task's "a new user can complete the getting-started tutorial
without external docs" criterion is a **manual QA check**, not
something automated tests can verify — it requires an actual human
unfamiliar with the editor. To run it: hand a fresh install to
someone who has never used Morgan-Bevy, point them at **Help →
Getting Started Tutorial**, and confirm they complete all 5 steps
without asking a question or opening this document. File a note in
the release checklist if this hasn't been run against the current
build.

## Scope notes

- Only the getting-started + procedural-generation tutorials ship in
  this pass. Adding another per-feature tutorial (e.g. export, or
  markers) means adding a new `Tutorial` entry to `TUTORIALS` in
  `src/state/tutorial.ts` and a Help-menu entry in `App.tsx` — no
  other changes are needed.
- The tutorial is invoked explicitly from the Help menu; it does not
  auto-launch on first run. `shouldAutoPrompt()` in
  `src/state/tutorial.ts` is the persisted signal a future
  first-run banner could read (true only if the tutorial has never
  been started, completed, or skipped) — wiring an actual banner is
  left for a follow-up task.
