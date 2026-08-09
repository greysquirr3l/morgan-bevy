/**
 * Tauri runtime detection — shared between components and hooks.
 *
 * `window.__TAURI__` is injected by the Tauri webview shell at
 * runtime. It is not part of the DOM lib types. We narrow here
 * instead of `as any` so the check stays a real (if minimal) type.
 *
 * Used by hooks that subscribe to Tauri events (e.g. `useStartupFile`)
 * and components that invoke Tauri commands (e.g. `AssetsPanel`).
 * Calling these in a non-Tauri (dev/web) build throws an unhelpful
 * `TypeError: __TAURI_INTERNALS__ is undefined` — guarding with
 * `isTauriRuntime()` produces a friendly "feature unavailable in
 * web preview" message instead.
 */
export interface TauriWindow extends Window {
  __TAURI__?: unknown
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI__)
}
