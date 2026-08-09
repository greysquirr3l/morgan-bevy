/**
 * T97 — Front-end wiring audit
 *
 * Complements `wiringAudit.test.ts` (which checks unused exports and
 * Tauri command registration) with the front-end–specific checks
 * that show up in real bugs:
 *
 * 1. **Tauri invoke → Rust command cross-check** — every `invoke('xxx')`
 *    call in `src/` must have a matching `#[tauri::command] fn xxx`
 *    defined in `src-tauri/src/`. Catches typos and commands that
 *    were renamed/deleted on one side without updating the other.
 *
 * 2. **Tauri event cross-check (emit ↔ listen)** — every
 *    `app_handle.emit('xxx', ...)` in Rust should have a
 *    `listen('xxx', ...)` consumer in the front-end, and vice
 *    versa. Orphan listeners silently never fire; orphan emitters
 *    are dead code.
 *
 * 3. **localStorage key pairing** — every `setItem('key', ...)`
 *    should have a corresponding `getItem('key')` consumer and
 *    vice versa. Orphan keys are either dead state or a missed
 *    read path.
 *
 * 4. **Theme tokens (Tailwind)** — every `editor-*` class used
 *    must be defined in `tailwind.config.js`. Undefined classes
 *    compile to nothing and silently break the UI.
 *
 * 5. **Zustand store actions** — every action defined on the
 *    editor store should be invoked from a non-test file. Catches
 *    dead actions and shows which actions are wired.
 *
 * Each "finding" surfaces with a category + location. Findings are
 * collected but only the highest-priority checks fail the suite;
 * the rest log as warnings so they show up in CI without blocking
 * unrelated work.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const cwd = process.cwd()
const srcDir = join(cwd, 'src')
const srcTauriDir = join(cwd, 'src-tauri', 'src')
const tailwindConfig = join(cwd, 'tailwind.config.js')

interface Finding {
  category: string
  name: string
  detail?: string
  location: string
  severity: 'low' | 'medium' | 'high'
}

function listSrcFiles(dir: string, out: string[] = []): string[] {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) listSrcFiles(full, out)
      else if (/\.(ts|tsx|rs)$/.test(entry.name)) out.push(full)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`listSrcFiles(${dir}) failed:`, e)
  }
  return out
}

function fileBody(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

// ────────────────────────────────────────────────────────────────────
// 1. Tauri invoke → Rust command cross-check
// ────────────────────────────────────────────────────────────────────

/**
 * Collect every `invoke('cmd', ...)` call in `src/` (excluding
 * `node_modules` and tests). Match the first argument as a string
 * literal: `'cmd'`, `"cmd"`, or `` `cmd` ``.
 */
function findFrontendInvokes(): string[] {
  const files = listSrcFiles(srcDir).filter(f => !/\.test\./.test(f) && !/\/test\//.test(f))
  const body = files.map(fileBody).join('\n')
  // Match `invoke('cmd', ...)`, `invoke<T>('cmd', ...)`, and
  // `invoke < T > ( 'cmd' , ...)` (any whitespace). The optional
  // `<[^>]+>` consumes the generic type parameter so the closing
  // quote is reachable; `[^>]+` (not `[^()]*?`) is intentional —
  // the older regex failed to bridge across `<string>` because the
  // lazy `[^()]*?` couldn't satisfy the `s` lookahead until it had
  // consumed the entire `string` token, which then didn't match
  // the `save_project` string literal.
  const matches = [
    ...body.matchAll(/invoke(?:\s*<[^>]+>)?\s*\(\s*['"`]([a-z_][a-z0-9_]*)['"`]/g),
  ]
  return uniq(matches.map(m => m[1]!))
}

/**
 * Collect every `#[tauri::command]` function name across
 * `src-tauri/src/`. Reads only the line(s) immediately after the
 * attribute.
 */
function findRustCommands(): string[] {
  const files = listSrcFiles(srcTauriDir).filter(f => f.endsWith('.rs'))
  const names: string[] = []
  for (const file of files) {
    const body = fileBody(file)
    const matches = [...body.matchAll(/#\[tauri::command\][\s\S]{0,200}?\bfn ([a-z_][a-z0-9_]*)/g)]
    for (const m of matches) names.push(m[1]!)
  }
  return uniq(names)
}

function auditInvokeCrossCheck(): Finding[] {
  const invokes = findFrontendInvokes()
  const commands = findRustCommands()
  const findings: Finding[] = []
  // Frontend invokes that have no Rust command
  for (const cmd of invokes) {
    if (!commands.includes(cmd)) {
      findings.push({
        category: 'unregistered-frontend-invoke',
        name: cmd,
        location: 'src/**',
        severity: 'high',
      })
    }
  }
  // Rust commands registered as Tauri commands (via #[tauri::command])
  // that the frontend never calls — soft finding, often plugin
  // authors expose forward-looking APIs.
  for (const cmd of commands) {
    if (!invokes.includes(cmd)) {
      findings.push({
        category: 'unused-frontend-rust-command',
        name: cmd,
        location: 'src-tauri/src/**',
        severity: 'low',
      })
    }
  }
  return findings
}

// ────────────────────────────────────────────────────────────────────
// Suite
// ────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────
// 2. Tauri event cross-check (emit ↔ listen)
// ────────────────────────────────────────────────────────────────────

function findRustEmits(): string[] {
  const files = listSrcFiles(srcTauriDir).filter(f => f.endsWith('.rs'))
  const body = files.map(fileBody).join('\n')
  // .emit("xxx", ...) or handle.emit("xxx", ...)
  const matches = [...body.matchAll(/\.emit\(\s*['"`]([a-zA-Z0-9_:/-]+)['"`]/g)]
  return uniq(matches.map(m => m[1]!))
}

function findFrontendListens(): string[] {
  const files = listSrcFiles(srcDir).filter(f => !/\.test\./.test(f) && !/\/test\//.test(f))
  const body = files.map(fileBody).join('\n')
  // Match `listen('xxx', ...)` and `listen<T>('xxx', ...)` — the
  // generic type parameter breaks the naive `listen\(` pattern, so
  // we accept an optional `<...>` between `listen` and `(`.
  const matches = [...body.matchAll(/listen(?:\s*<[^>]+>)?\(\s*['"`]([a-zA-Z0-9_:/-]+)['"`]/g)]
  return uniq(matches.map(m => m[1]!))
}

function auditEvents(): Finding[] {
  const emits = findRustEmits()
  const listens = findFrontendListens()
  const findings: Finding[] = []
  for (const ev of emits) {
    if (!listens.includes(ev)) {
      findings.push({
        category: 'orphan-emit',
        name: ev,
        location: 'src-tauri/src/** (no frontend listen)',
        severity: 'medium',
      })
    }
  }
  for (const ev of listens) {
    if (!emits.includes(ev)) {
      findings.push({
        category: 'orphan-listen',
        name: ev,
        location: 'src/** (no Rust emit)',
        severity: 'medium',
      })
    }
  }
  return findings
}

// ────────────────────────────────────────────────────────────────────
// 3. localStorage key pairing
// ────────────────────────────────────────────────────────────────────

function findLocalStorageKeys(): { set: string[]; get: string[] } {
  const files = listSrcFiles(srcDir).filter(f => !/\.test\./.test(f) && !/\/test\//.test(f))
  const body = files.map(fileBody).join('\n')
  const setMatches = [...body.matchAll(/localStorage\.setItem\(\s*['"`]([^'"`]+)['"`]/g)]
  const getMatches = [...body.matchAll(/localStorage\.getItem\(\s*['"`]([^'"`]+)['"`]/g)]
  const removeMatches = [...body.matchAll(/localStorage\.removeItem\(\s*['"`]([^'"`]+)['"`]/g)]
  return {
    set: uniq([...setMatches, ...removeMatches].map(m => m[1]!)),
    get: uniq(getMatches.map(m => m[1]!)),
  }
}

function auditLocalStorage(): Finding[] {
  const { set, get } = findLocalStorageKeys()
  const findings: Finding[] = []
  for (const key of set) {
    if (!get.includes(key)) {
      findings.push({
        category: 'orphan-set',
        name: key,
        location: 'src/** (set without read)',
        severity: 'medium',
      })
    }
  }
  for (const key of get) {
    if (!set.includes(key)) {
      findings.push({
        category: 'orphan-get',
        name: key,
        location: 'src/** (read without set)',
        severity: 'medium',
      })
    }
  }
  return findings
}

// ────────────────────────────────────────────────────────────────────
// 4. Theme tokens (Tailwind editor-* classes)
// ────────────────────────────────────────────────────────────────────

function findDefinedEditorTokens(): string[] {
  const body = fileBody(tailwindConfig)
  const match = body.match(/editor:\s*\{([^}]+)\}/)
  if (!match) return []
  return uniq([...match[1]!.matchAll(/\b([a-z][a-zA-Z]*)\s*:/g)].map(m => `editor-${m[1]!}`))
}

function findUsedEditorTokens(): string[] {
  const files = listSrcFiles(srcDir)
  const body = files.map(fileBody).join('\n')
  // Match `editor-<name>` only inside `className="..."` or `class={...}` /
  // `className={...}` attributes. This skips (a) comments like
  // `// editor-authored entities`, (b) `data-testid="uv-editor-canvas"`,
  // (c) TypeScript identifiers, etc. — all of which a bare regex
  // over `editor-[\w]+` would falsely catch.
  const classAttrRegex = /class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|\{([^}]*)\})/g
  const tokens = new Set<string>()
  for (const m of body.matchAll(classAttrRegex)) {
    const classBody = m[1] ?? m[2] ?? m[3] ?? m[4] ?? ''
    for (const tok of classBody.matchAll(/\beditor-([a-z][a-zA-Z]*)\b/g)) {
      tokens.add(`editor-${tok[1]!}`)
    }
  }
  return [...tokens]
}

function auditThemeTokens(): Finding[] {
  const defined = findDefinedEditorTokens()
  const used = findUsedEditorTokens()
  const findings: Finding[] = []
  for (const tok of used) {
    if (!defined.includes(tok)) {
      findings.push({
        category: 'undefined-theme-token',
        name: tok,
        location: 'src/** (used in className but not in tailwind.config.js)',
        severity: 'high',
      })
    }
  }
  for (const tok of defined) {
    if (!used.includes(tok)) {
      findings.push({
        category: 'unused-theme-token',
        name: tok,
        location: 'tailwind.config.js',
        severity: 'low',
      })
    }
  }
  return findings
}

// ────────────────────────────────────────────────────────────────────
// 5. Zustand store actions
// ────────────────────────────────────────────────────────────────────

function findStoreActions(): string[] {
  const body = fileBody(join(srcDir, 'store', 'editorStore.ts'))
  // Action methods are defined inside `actions: (set, get) => ({...})`
  // Each line is `name: (...) => { ... }` or `name: (...) => set(...)`.
  const matches = [
    ...body.matchAll(/^\s{6}([a-z][a-zA-Z0-9]*)\s*:\s*(?:\([^)]*\)|async\s*\([^)]*\))\s*=>/gm),
  ]
  return uniq(matches.map(m => m[1]!))
}

function findStoreActionCallers(actions: string[]): Set<string> {
  const files = listSrcFiles(srcDir)
  const used = new Set<string>()
  for (const file of files) {
    if (/editorStore\.ts/.test(file)) continue
    const body = fileBody(file)
    for (const action of actions) {
      // Match `useEditorStore.getState().action` or `getState().action`
      // or destructured `action` after a `useEditorStore(...)` call.
      const re = new RegExp(`\\b${action}\\b`)
      if (re.test(body)) used.add(action)
    }
  }
  return used
}

function auditStoreActions(): Finding[] {
  const actions = findStoreActions()
  const used = findStoreActionCallers(actions)
  const findings: Finding[] = []
  for (const action of actions) {
    if (!used.has(action)) {
      findings.push({
        category: 'unused-store-action',
        name: action,
        location: 'src/store/editorStore.ts',
        severity: 'low',
      })
    }
  }
  return findings
}

// ────────────────────────────────────────────────────────────────────
// Suite
// ────────────────────────────────────────────────────────────────────

function formatFindings(findings: Finding[]): string {
  return findings
    .map(
      f =>
        `  ${f.severity.padEnd(6)} ${f.category.padEnd(28)} ${f.name}${f.detail ? ` — ${f.detail}` : ''} (${f.location})`
    )
    .join('\n')
}

describe('Front-end wiring audit (T97)', () => {
  it('every invoke() in the frontend has a matching #[tauri::command] in Rust', () => {
    const findings = auditInvokeCrossCheck().filter(
      f => f.category === 'unregistered-frontend-invoke'
    )
    if (findings.length > 0) {
      throw new Error(
        `Found ${findings.length} invoke() calls with no Rust command:\n${formatFindings(findings)}`
      )
    }
    expect(findings).toHaveLength(0)
  })

  it('every Rust #[tauri::command] is reachable from the frontend (soft)', () => {
    // Soft check — register-only commands might be forward-looking
    // APIs for plugin authors. We log but don't fail.
    const findings = auditInvokeCrossCheck().filter(
      f => f.category === 'unused-frontend-rust-command'
    )
    if (findings.length > 0) {
      console.warn(
        `Found ${findings.length} Rust commands with no frontend caller:\n${formatFindings(findings)}`
      )
    }
    // Hard cap — if the count explodes, something is wrong. 15 is a
    // loose threshold that catches accidental regressions (e.g. a
    // rename on one side without the other) without failing on the
    // project-specific surface area.
    expect(findings.length).toBeLessThanOrEqual(15)
  })

  it('Tauri events emitted in Rust have a matching listen() in the frontend', () => {
    const findings = auditEvents()
    if (findings.length > 0) {
      throw new Error(
        `Found ${findings.length} Tauri event mismatches:\n${formatFindings(findings)}`
      )
    }
    expect(findings).toHaveLength(0)
  })

  it('every localStorage key is paired (set+get)', () => {
    const findings = auditLocalStorage()
    if (findings.length > 0) {
      throw new Error(
        `Found ${findings.length} localStorage key mismatches:\n${formatFindings(findings)}`
      )
    }
    expect(findings).toHaveLength(0)
  })

  it('every editor-* Tailwind token used in src/ is defined in tailwind.config.js', () => {
    const findings = auditThemeTokens().filter(f => f.category === 'undefined-theme-token')
    if (findings.length > 0) {
      throw new Error(
        `Found ${findings.length} undefined theme tokens:\n${formatFindings(findings)}`
      )
    }
    expect(findings).toHaveLength(0)
  })

  it('every defined theme token is actually used (soft)', () => {
    const findings = auditThemeTokens().filter(f => f.category === 'unused-theme-token')
    if (findings.length > 0) {
      console.warn(`Found ${findings.length} unused theme tokens:\n${formatFindings(findings)}`)
    }
    // Theme tokens are cheap to keep; warn-only is fine.
    expect(findings.length).toBeLessThanOrEqual(10)
  })

  it('store actions are wired to at least one consumer (soft)', () => {
    const findings = auditStoreActions()
    if (findings.length > 0) {
      console.warn(`Found ${findings.length} unused store actions:\n${formatFindings(findings)}`)
    }
    expect(findings.length).toBeLessThanOrEqual(20)
  })
})
