// T60 — Built-in keyboard shortcut defaults.
//
// The full binding table. Each entry is JSON-serialisable — no
// closures, no React refs — so the same shape round-trips through
// the user-overrides store and through the localStorage JSON blob
// the editor uses for prefs.
//
// The hook dispatches by `action`; the data here only describes the
// keys. A future UI lists the table by `label` / `description` and
// rebinds by mutating the `key` / `modifiers` fields.

export type Modifier = 'ctrl' | 'shift' | 'alt' | 'meta'

/**
 * One built-in shortcut. `action` is the dispatch key the hook
 * looks up; `label` / `description` are user-facing strings for the
 * future rebind UI. `requiresSelection` and `requiresTransformMode`
 * are guard predicates so the data file can describe "fire only when
 * objects are selected" without baking the predicate into the hook.
 */
export interface ShortcutBinding {
  /** Stable action id (e.g. `transform.translate`). The hook
   *  dispatches on this string. */
  readonly action: string
  /** Human-readable name (e.g. `Move`). */
  readonly label: string
  /** Single-key key name (lowercase). Modifiers go in `modifiers`. */
  readonly key: string
  /** Held modifier keys. Order-independent at match time. */
  readonly modifiers: readonly Modifier[]
  /** Tooltip / help text. */
  readonly description: string
  /** True if the action only fires while at least one scene
   *  object is selected. */
  readonly requiresSelection?: boolean
  /** True if the action only fires while in a non-select transform
   *  mode (translate / rotate / scale). The hook skips the action
   *  when the store reports `transformMode === 'select'`. */
  readonly requiresTransformMode?: boolean
  /** Category for UI grouping (e.g. `Transform`, `Camera`, `File`). */
  readonly category: string
}

/**
 * Canonical built-in shortcut table. Order is intentional — it
 * drives the menu display order in the future rebind UI.
 *
 * The action IDs mirror the existing hard-coded switch cases in
 * `useKeyboardShortcuts.ts` so the refactor doesn't change behaviour.
 */
export const DEFAULT_SHORTCUTS: readonly ShortcutBinding[] = [
  // ─── Transform modes (Q / W / E / R) ─────────────────────────────────
  {
    action: 'transform.select',
    label: 'Select',
    key: 'q',
    modifiers: [],
    category: 'Transform',
    description: 'Switch to select mode (no gizmo).',
  },
  {
    action: 'transform.translate',
    label: 'Move',
    key: 'w',
    modifiers: [],
    category: 'Transform',
    description: 'Switch to translate mode.',
  },
  {
    action: 'transform.rotate',
    label: 'Rotate',
    key: 'e',
    modifiers: [],
    category: 'Transform',
    description: 'Switch to rotate mode.',
  },
  {
    action: 'transform.scale',
    label: 'Scale',
    key: 'r',
    modifiers: [],
    category: 'Transform',
    description: 'Switch to scale mode.',
  },

  // ─── View toggles ───────────────────────────────────────────────────
  {
    action: 'toggle.grid',
    label: 'Toggle Grid',
    key: 'g',
    modifiers: [],
    category: 'View',
    description: 'Toggle the grid overlay.',
  },
  {
    action: 'toggle.stats',
    label: 'Toggle Stats',
    key: 'f',
    modifiers: ['shift'],
    category: 'View',
    description: 'Toggle the FPS / object-count stats overlay.',
  },
  {
    action: 'viewport.toggle',
    label: 'Toggle 2D/3D View',
    key: 'v',
    modifiers: [],
    category: 'View',
    description: 'Toggle between the 3D viewport and the 2D grid view.',
  },
  {
    action: 'camera.reset',
    label: 'Reset Camera',
    key: 'home',
    modifiers: [],
    category: 'View',
    description: 'Reset the camera to its default position.',
  },

  // ─── Tools (P) ──────────────────────────────────────────────────────
  {
    action: 'tool.paint',
    label: 'Paint Tool',
    key: 'p',
    modifiers: [],
    category: 'Tools',
    description:
      'Toggle the material paint tool: brush a target material onto surfaces under the cursor.',
  },

  // ─── Camera modes (1 / 2 / 3) ────────────────────────────────────────
  {
    action: 'camera.orbit',
    label: 'Orbit Camera',
    key: '1',
    modifiers: [],
    category: 'Camera',
    description: 'Switch to orbit camera.',
  },
  {
    action: 'camera.fly',
    label: 'Fly Camera',
    key: '2',
    modifiers: [],
    category: 'Camera',
    description: 'Switch to fly camera.',
  },
  {
    action: 'camera.orthographic',
    label: 'Ortho Camera',
    key: '3',
    modifiers: [],
    category: 'Camera',
    description: 'Switch to orthographic camera.',
  },
  {
    action: 'camera.frameAll',
    label: 'Frame All',
    key: 'f',
    modifiers: ['alt'],
    category: 'Camera',
    description: 'Frame the entire scene in the viewport.',
  },
  {
    action: 'camera.focusSelection',
    label: 'Focus Selection',
    key: 'f',
    modifiers: [],
    category: 'Camera',
    description: 'Frame the current selection in the viewport.',
  },
  {
    action: 'camera.toggleCoordinateSpace',
    label: 'Toggle Local/World',
    key: 't',
    modifiers: [],
    category: 'Camera',
    description: 'Toggle local/world coordinate space for the gizmo.',
  },

  // ─── Transform constraints (X / Y / Z, with Shift for planes) ────
  {
    action: 'constraint.x',
    label: 'Constrain X',
    key: 'x',
    modifiers: [],
    category: 'Constraint',
    requiresTransformMode: true,
    description: 'Constrain transform to X axis.',
  },
  {
    action: 'constraint.y',
    label: 'Constrain Y',
    key: 'y',
    modifiers: [],
    category: 'Constraint',
    requiresTransformMode: true,
    description: 'Constrain transform to Y axis.',
  },
  {
    action: 'constraint.z',
    label: 'Constrain Z',
    key: 'z',
    modifiers: [],
    category: 'Constraint',
    requiresTransformMode: true,
    description: 'Constrain transform to Z axis.',
  },
  {
    action: 'constraint.yz',
    label: 'Constrain YZ Plane',
    key: 'x',
    modifiers: ['shift'],
    category: 'Constraint',
    requiresTransformMode: true,
    description: 'Constrain transform to YZ plane.',
  },
  {
    action: 'constraint.xz',
    label: 'Constrain XZ Plane',
    key: 'y',
    modifiers: ['shift'],
    category: 'Constraint',
    requiresTransformMode: true,
    description: 'Constrain transform to XZ plane.',
  },
  {
    action: 'constraint.xy',
    label: 'Constrain XY Plane',
    key: 'z',
    modifiers: ['shift'],
    category: 'Constraint',
    requiresTransformMode: true,
    description: 'Constrain transform to XY plane.',
  },

  // ─── Selection (Escape / Delete) ───────────────────────────────────
  {
    action: 'selection.clear',
    label: 'Clear Selection',
    key: 'escape',
    modifiers: [],
    category: 'Selection',
    description: 'Deselect all objects and clear transform constraints.',
  },
  {
    action: 'selection.delete',
    label: 'Delete Selection',
    key: 'delete',
    modifiers: [],
    category: 'Selection',
    requiresSelection: true,
    description: 'Delete the selected objects.',
  },

  // ─── Clipboard (Ctrl+C / Ctrl+V) ───────────────────────────────────
  {
    action: 'clipboard.copy',
    label: 'Copy',
    key: 'c',
    modifiers: ['ctrl'],
    category: 'Clipboard',
    requiresSelection: true,
    description: 'Copy selected objects to clipboard.',
  },
  {
    action: 'clipboard.paste',
    label: 'Paste',
    key: 'v',
    modifiers: ['ctrl'],
    category: 'Clipboard',
    description: 'Paste clipboard contents into the scene.',
  },

  // ─── Undo / Redo (Ctrl+Z / Ctrl+Y) ─────────────────────────────────
  {
    action: 'undo',
    label: 'Undo',
    key: 'z',
    modifiers: ['ctrl'],
    category: 'History',
    description: 'Undo the last command.',
  },
  {
    action: 'redo',
    label: 'Redo',
    key: 'y',
    modifiers: ['ctrl'],
    category: 'History',
    description: 'Redo the last undone command.',
  },

  // ─── Selection (Ctrl+A) ────────────────────────────────────────────
  {
    action: 'selection.selectAll',
    label: 'Select All',
    key: 'a',
    modifiers: ['ctrl'],
    category: 'Selection',
    description: 'Select every object in the scene.',
  },

  // ─── Scene operations ─────────────────────────────────────────────
  {
    action: 'scene.duplicate',
    label: 'Duplicate Selection',
    key: 'd',
    modifiers: ['ctrl'],
    category: 'Scene',
    requiresSelection: true,
    description: 'Duplicate the selected objects.',
  },
  {
    action: 'scene.new',
    label: 'New Scene',
    key: 'n',
    modifiers: ['ctrl'],
    category: 'Scene',
    description: 'Start a fresh scene (clears everything after confirm).',
  },
  {
    action: 'scene.save',
    label: 'Save Scene',
    key: 's',
    modifiers: ['ctrl'],
    category: 'Scene',
    description: 'Save the current scene to a file.',
  },
  {
    action: 'scene.open',
    label: 'Open Scene',
    key: 'o',
    modifiers: ['ctrl'],
    category: 'Scene',
    description: 'Open a scene file.',
  },
  {
    action: 'scene.export',
    label: 'Export Scene',
    key: 'e',
    modifiers: ['ctrl', 'shift'],
    category: 'Scene',
    description: 'Export the current scene as JSON.',
  },
]

/**
 * The action IDs the hook is allowed to dispatch. Kept as a string
 * literal union so the dispatcher in `useKeyboardShortcuts.ts` is
 * exhaustively typed — adding a new action without wiring a handler
 * becomes a compile error.
 */
export type ShortcutAction = (typeof DEFAULT_SHORTCUTS)[number]['action']
