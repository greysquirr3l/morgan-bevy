/**
 * Tauri runtime detection — shared between components and hooks.
 *
 * `window.__TAURI_INTERNALS__` is the IPC bridge that the
 * `@tauri-apps/api/core` `invoke()` function reads at call time
 * (`window.__TAURI_INTERNALS__.invoke(cmd, args, options)`). It is
 * always set by the Tauri 2.x webview regardless of the
 * `withGlobalTauri` config — so it's the most reliable runtime
 * signal. `window.__TAURI__` (the legacy global) is only set when
 * `withGlobalTauri: true`, which is why earlier versions of this
 * helper (which checked `__TAURI__`) returned `true` in tests but
 * still got "Cannot read properties of undefined (reading 'invoke')"
 * at call time: the test mock set `__TAURI__` but not
 * `__TAURI_INTERNALS__.invoke`.
 *
 * Used by hooks that subscribe to Tauri events (e.g. `useStartupFile`)
 * and components that invoke Tauri commands (e.g. `AssetsPanel`).
 * Calling these in a non-Tauri (dev/web) build throws an unhelpful
 * `TypeError: __TAURI_INTERNALS__ is undefined` — guarding with
 * `isTauriRuntime()` produces a friendly "feature unavailable in
 * web preview" message instead.
 */
export interface TauriInternalsWindow extends Window {
  __TAURI_INTERNALS__?: {
    invoke?: (...args: unknown[]) => unknown
    transformCallback?: (...args: unknown[]) => unknown
  }
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const internals = (window as TauriInternalsWindow).__TAURI_INTERNALS__
  return Boolean(internals && typeof internals.invoke === 'function')
}
