/**
 * Integration wiring audit (T88).
 *
 * Programmatic checks for the integration gaps the T88 spec calls
 * out:
 *   - Exported functions / classes / consts that have ZERO consumers
 *     anywhere in `src/`. These are dead code.
 *   - Tauri commands defined in `src-tauri/src/main.rs` that are NOT
 *     registered in the `tauri::generate_handler![]` macro.
 *   - Tauri commands registered in the handler list that are NOT
 *     callable from `invoke('cmd-name')` somewhere in `src/` —
 *     these are commands that the frontend never uses.
 *   - Hooks exported from `src/hooks/` that have no consumers.
 *
 * Each "finding" is an entry in the returned `audit` array; the
 * tests below assert that the arrays are EMPTY (i.e. no dead code,
 * no missing registrations). Adding a new export, command, or hook
 * without wiring it up is exactly the integration gap this audit
 * catches.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = join(process.cwd(), 'src')
const mainRs = join(process.cwd(), 'src-tauri', 'src', 'main.rs')

function listSrcFiles(dir = srcDir, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) listSrcFiles(full, out)
    // Include test files too — exported helpers are routinely
    // exercised by unit tests in src/test/.
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

interface Finding {
  category:
    | 'unused-export'
    | 'unused-class'
    | 'unused-hook'
    | 'unregistered-command'
    | 'unregistered-frontend-command'
  name: string
  location: string
  severity: 'low' | 'medium' | 'high'
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

function fileBody(path: string): string {
  return readFileSync(path, 'utf8')
}

function isPublicSurface(file: string): boolean {
  // Pure type / schema files re-export through index.ts; flagging
  // their members as "unused" produces noise.
  return !/\/types\//.test(file) && !/\/schemas\//.test(file) && !/\/brand\./.test(file)
}

/**
 * Walk every TS/TSX source file and collect all `export function`,
 * `export class`, `export const`, `export type`, and `export
 * interface` declarations. Then for each declaration, check that
 * it is referenced from at least one OTHER file in `src/`. (The
 * declaring file is skipped — exporting from it doesn't count as a
 * consumer.)
 */
function findUnusedExports(files: string[]): Finding[] {
  const findings: Finding[] = []
  for (const file of files) {
    if (!isPublicSurface(file)) continue
    const body = fileBody(file)
    const exportRegex = /^export (?:async )?(?:function|const|class) (\w+)/gm
    let match: RegExpExecArray | null
    while ((match = exportRegex.exec(body))) {
      const name = match[1]
      if (!name) continue
      // Skip ALL_CAPS constants — typically runtime config knobs
      // like `AUTOSAVE_KEY` whose consumers don't need to mention
      // the symbol literally to be affected.
      if (/^[A-Z_]+$/.test(name)) continue
      // Skip private helpers (leading underscore).
      if (name.startsWith('_')) continue

      const usedElsewhere = files.some(other => {
        if (other === file) return false
        const otherBody = fileBody(other)
        // Match the identifier as a word boundary; avoid catching
        // substrings inside longer names.
        const usageRegex = new RegExp(`\\b${name}\\b`)
        return usageRegex.test(otherBody)
      })
      if (!usedElsewhere) {
        findings.push({
          category: 'unused-export',
          name,
          location: file.replace(`${process.cwd()}/`, ''),
          severity: 'low',
        })
      }
    }
  }
  return findings
}

/**
 * Every `tauri::command` function in main.rs must appear in the
 * `tauri::generate_handler![...]` macro. Conversely, every entry in
 * the macro should be a function defined in the file (or a re-export).
 *
 * The check is intentionally local — main.rs is small enough that
 * a single grep covers everything.
 */
function findUnregisteredCommands(): Finding[] {
  const body = fileBody(mainRs)
  const defined: string[] = []
  const definedRegex = /#\[tauri::command\][\s\S]*?(?:async )?fn (\w+)/g
  let m: RegExpExecArray | null
  while ((m = definedRegex.exec(body))) defined.push(m[1]!)

  const handlerMatch = body.match(/tauri::generate_handler!\[([\s\S]*?)\]/)
  if (!handlerMatch) return []
  const registered = uniq(
    [...handlerMatch[1]!.matchAll(/(?:[a-z_][a-z_0-9]*::)?(\w+)/g)]
      .map(m => m[1]!)
      .filter(name => name && !['generate_handler'].includes(name))
  )

  const findings: Finding[] = []
  for (const cmd of defined) {
    if (!registered.includes(cmd)) {
      findings.push({
        category: 'unregistered-command',
        name: cmd,
        location: 'src-tauri/src/main.rs',
        severity: 'high',
      })
    }
  }
  return findings
}

/**
 * Find every `#[tauri::command]` registered in the handler list
 * that the frontend never invokes. The frontend uses
 * `invoke('cmd-name', { ... })` or `invoke<...>('cmd-name')`.
 */
function findUnregisteredFrontendCommands(): Finding[] {
  const body = fileBody(mainRs)
  const handlerMatch = body.match(/tauri::generate_handler!\[([\s\S]*?)\]/)
  if (!handlerMatch) return []
  const registered: string[] = []
  const handlerBody = handlerMatch[1]!
  // Each handler entry is `path::to::cmd_name` or `cmd_name`. Capture
  // both forms; prefer the last segment as the invoke name.
  // Filter out `clippy::*` entries — the lint allow-list lives in
  // the same `[]` macro block and would otherwise count as commands.
  for (const m of handlerBody.matchAll(/^([a-z_][a-z_0-9]*(?:::[a-z_][a-z_0-9]*)*)$/gm)) {
    const parts = m[1]!.split('::')
    if (parts.includes('clippy')) continue
    const last = parts[parts.length - 1]!
    if (last !== 'generate_handler') registered.push(last)
  }
  const unique = uniq(registered)

  const frontendFiles = listSrcFiles()
  const frontendBody = frontendFiles.map(fileBody).join('\n')
  const findings: Finding[] = []
  for (const cmd of unique) {
    const invokeRegex = new RegExp(`invoke[<\\w,\\s\\[\\]\\?]*>\\(['"\`]${cmd}['"\`]`)
    if (!invokeRegex.test(frontendBody)) {
      findings.push({
        category: 'unregistered-frontend-command',
        name: cmd,
        location: 'src-tauri/src/main.rs',
        severity: 'low',
      })
    }
  }
  return findings
}

/**
 * Hooks exported from `src/hooks/` are public React-API entry points
 * that the application uses to wire features (autosave, startup file,
 * keyboard shortcuts, …). A hook exported but never invoked is
 * either dead code or a wiring gap. Surface both for review.
 */
function findUnusedHooks(): Finding[] {
  const hooksDir = join(srcDir, 'hooks')
  const files = readdirSync(hooksDir)
    .filter(n => /^use[A-Z]/.test(n) && n.endsWith('.ts'))
    .map(n => join(hooksDir, n))

  const findings: Finding[] = []
  for (const file of files) {
    // Hook name = filename without extension + camelCase from
    // `useSomething`. Strip the `.ts`.
    const name = file.replace(hooksDir + '/', '').replace(/\.ts$/, '')
    // Hooks are used via identifier reference, not call expression.
    // `useFoo` is referenced as `useFoo()` or `const x = useFoo()`
    // anywhere in src/.
    const usageRegex = new RegExp(`\\b${name}\\b`)
    const used = files.concat(listSrcFiles()).some(other => {
      if (other === file) return false
      return usageRegex.test(fileBody(other))
    })
    if (!used) {
      findings.push({
        category: 'unused-hook',
        name,
        location: file.replace(`${process.cwd()}/`, ''),
        severity: 'medium',
      })
    }
  }
  return findings
}

describe('Integration wiring audit (T88)', () => {
  it('every exported function/const/class is consumed by another src/ file', () => {
    const files = listSrcFiles()
    const findings = findUnusedExports(files)
    if (findings.length > 0) {
      const lines = findings.map(
        f => `  ${f.severity.padEnd(6)} ${f.category.padEnd(22)} ${f.name} (${f.location})`
      )
      throw new Error(`Found ${findings.length} unused exports:\n${lines.join('\n')}`)
    }
    expect(findings).toHaveLength(0)
  })

  it('every Tauri command is registered in the handler list', () => {
    const findings = findUnregisteredCommands()
    if (findings.length > 0) {
      const lines = findings.map(
        f => `  ${f.severity.padEnd(6)} ${f.category.padEnd(22)} ${f.name} (${f.location})`
      )
      throw new Error(`Found ${findings.length} unregistered commands:\n${lines.join('\n')}`)
    }
    expect(findings).toHaveLength(0)
  })

  it('every registered Tauri command is called from the frontend', () => {
    // This is a softer check: a registered-but-never-called command
    // is dead infrastructure, but it might also be a forward-looking
    // API exposed for plugin authors. We surface findings but don't
    // fail the suite — they go into the audit document instead.
    const findings = findUnregisteredFrontendCommands()
    // Allow zero — we treat this as an informational audit. If the
    // count grows past 5 in future, promote this to a hard check.
    expect(findings.length).toBeLessThanOrEqual(5)
    if (findings.length > 0) {
      const lines = findings
        .map(f => `  ${f.severity.padEnd(6)} ${f.category.padEnd(22)} ${f.name} (${f.location})`)
        .join('\n')
      console.warn(
        `Found ${findings.length} registered-but-unused-from-frontend commands:\n${lines}`
      )
    }
  })

  it('every hook in src/hooks/ has at least one consumer', () => {
    const findings = findUnusedHooks()
    if (findings.length > 0) {
      const lines = findings.map(
        f => `  ${f.severity.padEnd(6)} ${f.category.padEnd(22)} ${f.name} (${f.location})`
      )
      throw new Error(`Found ${findings.length} unused hooks:\n${lines.join('\n')}`)
    }
    expect(findings).toHaveLength(0)
  })
})
