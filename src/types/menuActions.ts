/**
 * Menu-action discriminated unions (T82).
 *
 * Each menu in the top bar dispatches a string action identifier.
 * The handlers in `App.tsx` previously accepted a bare `string`,
 * which meant TypeScript could not warn on typos or unhandled
 * variants. These unions replace the bare strings with a closed
 * set of literal types so every `switch` can use a `never`-asserted
 * default for compile-time exhaustiveness.
 *
 * Adding a new action means adding a literal to the corresponding
 * tuple below — TypeScript will then flag every unhandled switch
 * site that needs updating.
 *
 * Note: the `Command` pattern in `src/utils/commands.ts` is
 * deliberately retained. Each command class captures its own
 * `previousState` so undo/redo can replay the inverse action
 * without an external state-snapshot service. Replacing it with a
 * pure-function reducer would require a different undo architecture
 * (e.g. immer patches, command/event sourcing) and is out of scope
 * for T82.
 */

export const EDIT_ACTIONS = [
  'undo',
  'redo',
  'select-all',
  'deselect-all',
  'delete',
  'duplicate',
] as const
export type EditAction = (typeof EDIT_ACTIONS)[number]

export const VIEW_ACTIONS = [
  'show-left-panel',
  'show-right-panel',
  'hide-left-panel',
  'hide-right-panel',
  'toggle-grid',
  'reset-camera',
  'focus-selection',
  'switch-3d',
  'switch-2d',
] as const
export type ViewAction = (typeof VIEW_ACTIONS)[number]

export const GENERATE_ACTIONS = ['run-bsp', 'run-wfc', 'reroll-seed', 'focus-generation'] as const
export type GenerateAction = (typeof GENERATE_ACTIONS)[number]

export const TOOLS_ACTIONS = [
  'transform-select',
  'transform-move',
  'transform-rotate',
  'transform-scale',
  'toggle-snap',
  'grid-size',
] as const
export type ToolsAction = (typeof TOOLS_ACTIONS)[number]

export const HELP_ACTIONS = [
  'keyboard-shortcuts',
  'help',
  'about',
  'tutorial-getting-started',
  'tutorial-procedural-generation',
] as const
export type HelpAction = (typeof HELP_ACTIONS)[number]

/**
 * Helper for the `default` arm of a `switch (action.type)` over a
 * closed union. The compiler will type-error this assignment if any
 * literal in the source union is unhandled — that is the point.
 *
 * Usage:
 * ```ts
 * switch (action) {
 *   case 'undo': ...
 *   case 'redo': ...
 *   default: assertNeverAction(action, EDIT_ACTIONS)
 * }
 * ```
 */
export function assertNeverAction<T extends string>(value: never, _allowed: readonly T[]): never {
  throw new Error(
    `Unhandled menu action: ${String(value)}. ` +
      'Add the new literal to the relevant *_ACTIONS tuple in src/types/menuActions.ts ' +
      'and handle it in the corresponding switch in src/App.tsx.'
  )
}
