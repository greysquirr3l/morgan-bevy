/**
 * Frontend crash handler — captures uncaught errors and unhandled promise
 * rejections, logs them via the standard console, and writes them to a
 * frontend log file via the Tauri fs plugin (when available).
 *
 * Privacy: log-only by default. No off-device submission. See
 * `docs/dev/crash-reporting.md` for the full design and the planned opt-in
 * submission path.
 *
 * Install once at app boot:
 *   ```ts
 *   installFrontendCrashHandler()
 *   ```
 */
import { invoke } from '@tauri-apps/api/core'

const FRONTEND_LOG_FILENAME = 'frontend-crash.log'

/** A short, single-line summary suitable for the developer console. */
function formatErrorLine(label: string, error: unknown): string {
  const timestamp = new Date().toISOString()
  let detail = '<unknown>'
  if (error instanceof Error) {
    detail = `${error.name}: ${error.message}`
    if (error.stack) {
      // Truncate to the first three lines to keep console output readable.
      detail += `\n${error.stack.split('\n').slice(0, 3).join('\n')}`
    }
  } else if (typeof error === 'string') {
    detail = error
  } else {
    try {
      detail = JSON.stringify(error)
    } catch {
      detail = String(error)
    }
  }
  return `[${timestamp}] ${label}: ${detail}`
}

/**
 * Try to append the formatted line to `{app_data_dir}/logs/frontend-crash.log`
 * via Tauri. If Tauri is not available (e.g. during unit tests) or the write
 * fails, silently fall back to `console.error` — never throw from the crash
 * handler.
 */
async function tryAppendToFile(line: string): Promise<void> {
  try {
    await invoke<void>('append_frontend_crash_log', { line })
  } catch {
    // Silently fall through — frontend crash handler must not throw.
  }
}

let installed = false

/**
 * Install listeners for `window.error` and `unhandledrejection`. Safe to
 * call multiple times — subsequent calls are no-ops.
 */
export function installFrontendCrashHandler(): void {
  if (installed) return
  if (typeof window === 'undefined') return // SSR / non-browser
  installed = true

  window.addEventListener('error', event => {
    const line = formatErrorLine('window.error', event.error ?? event.message)
    console.error(line)
    void tryAppendToFile(line)
  })

  window.addEventListener('unhandledrejection', event => {
    const line = formatErrorLine('unhandledrejection', event.reason)
    console.error(line)
    void tryAppendToFile(line)
  })
}

/**
 * Reset the installed flag. Test-only helper.
 */
export function _resetFrontendCrashHandlerForTesting(): void {
  installed = false
}

/** Re-export the filename so a Tauri command can append to the same file. */
export const FRONTEND_CRASH_LOG_FILENAME_EXPORT = FRONTEND_LOG_FILENAME
