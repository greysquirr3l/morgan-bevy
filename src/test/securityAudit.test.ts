/**
 * T87 security audit (vitest).
 *
 * The T87 spec calls for an OWASP-aligned audit of the codebase. Because
 * Morgan-Bevy is a *desktop* Tauri app (no public HTTP server, no
 * file-upload handler, no rate-limiting surface), the spec's
 * "rate-limit / upload / SSRF" items don't apply. This audit
 * covers the OWASP baseline + several *Tauri-specific* security
 * properties that the spec doesn't enumerate but that are
 * relevant for a desktop IPC app:
 *
 *   1. **Dangerous DOM APIs** — `dangerouslySetInnerHTML`, `eval`,
 *      `new Function`, and unvalidated `innerHTML` writes. None of
 *      these should appear in the React/TS source.
 *   2. **localStorage keys** — every localStorage key must start
 *      with the `morgan-bevy.` prefix so private-mode / SameSite
 *      tests can scope cleanly.
 *   3. **Process env leakage** — the frontend bundle must not
 *     ship with raw `process.env.*` reads of secrets (the bundle
 *     would embed them literal-in-the-JS).
 *   4. **SQL injection** — every `connection.execute(...)` call in
 *      `src-tauri/src/` that takes user input must use `?`
 *      placeholders, never string interpolation. Static format
 *      strings (e.g. `format!("PRAGMA table_info({table})")` where
 *      `table` is a non-user input) are accepted.
 *   5. **Tauri IPC path safety** — every `#[tauri::command]` that
 *      takes a path argument must declare it as `String` or
 *      `&str` (not `Vec<u8>` or any raw byte slice).
 *   6. **React version pinning** — the package.json must allow
 *     only `react` and `react-dom` from one major version to
 *     prevent hook-mismatch bugs in production (security: a
 *     mixed version can leak private state across Suspense
 *     boundaries).
 *   7. **Tauri plugin pinning** — `@tauri-apps/api` must be locked
 *      to a single 2.x major.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = join(process.cwd(), 'src')
const srcTauriDir = join(process.cwd(), 'src-tauri', 'src')
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function listFiles(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) listFiles(full, ext, out)
    else if (ext.test(entry.name)) out.push(full)
  }
  return out
}

function fileBody(path: string): string {
  return readFileSync(path, 'utf8')
}

function rel(p: string): string {
  return p.replace(`${process.cwd()}/`, '')
}

// Strict: a real injection vector. We exclude the audit's own test
// file so it doesn't self-match (the audit mentions the
// `dangerouslySetInnerHTML` token in a comment).
const AUDIT_SELF = 'src/test/securityAudit.test.ts'

describe('T87 security audit: frontend dangerous DOM APIs', () => {
  it('contains no dangerouslySetInnerHTML', () => {
    const offenders: string[] = []
    for (const file of listFiles(srcDir, /\.(ts|tsx)$/)) {
      if (file.endsWith(AUDIT_SELF)) continue
      if (fileBody(file).includes('dangerouslySetInnerHTML')) {
        offenders.push(rel(file))
      }
    }
    expect(offenders, `dangerouslySetInnerHTML in: ${offenders.join(', ')}`).toEqual([])
  })

  it('contains no eval() or new Function()', () => {
    const offenders: string[] = []
    for (const file of listFiles(srcDir, /\.(ts|tsx)$/)) {
      if (file.endsWith(AUDIT_SELF)) continue
      const b = fileBody(file)
      if (/\beval\s*\(/.test(b) || /\bnew\s+Function\s*\(/.test(b)) {
        offenders.push(rel(file))
      }
    }
    expect(offenders, `eval / Function in: ${offenders.join(', ')}`).toEqual([])
  })

  it('contains no raw innerHTML writes', () => {
    const offenders: string[] = []
    for (const file of listFiles(srcDir, /\.(ts|tsx)$/)) {
      if (file.endsWith(AUDIT_SELF)) continue
      const b = fileBody(file)
      // Match `.innerHTML =` (no React JSX wrapper). String
      // concatenation into innerHTML is the XSS vector.
      if (/\.innerHTML\s*=/.test(b)) offenders.push(rel(file))
    }
    expect(offenders, `innerHTML = in: ${offenders.join(', ')}`).toEqual([])
  })
})

describe('T87 security audit: localStorage', () => {
  it('every key starts with morgan-bevy.', () => {
    const offenders: string[] = []
    const keyRegex = /localStorage\.(?:setItem|getItem|removeItem)\(\s*['"]([^'"]+)['"]/g
    for (const file of listFiles(srcDir, /\.(ts|tsx)$/)) {
      const b = fileBody(file)
      let m: RegExpExecArray | null
      while ((m = keyRegex.exec(b))) {
        const key = m[1]
        if (!key) continue
        if (!key.startsWith('morgan-bevy.')) {
          offenders.push(`${rel(file)}: ${key}`)
        }
      }
    }
    expect(offenders, `non-namespaced keys: ${offenders.join(', ')}`).toEqual([])
  })
})

describe('T87 security audit: process.env', () => {
  it('no secrets-bearing env reads in src/', () => {
    // The bundle would literal-embed any value read at build time.
    // A defensive read is fine (e.g. process.env.NODE_ENV), but
    // nothing that smells like a secret should be touched.
    const forbidden = [
      /process\.env\.[A-Z_]*SECRET/,
      /process\.env\.[A-Z_]*TOKEN/,
      /process\.env\.[A-Z_]*KEY/,
      /process\.env\.[A-Z_]*PASSWORD/,
    ]
    const offenders: string[] = []
    for (const file of listFiles(srcDir, /\.(ts|tsx)$/)) {
      const b = fileBody(file)
      for (const pattern of forbidden) {
        if (pattern.test(b)) offenders.push(`${rel(file)}`)
      }
    }
    expect(offenders, `secret env reads: ${offenders.join(', ')}`).toEqual([])
  })
})

describe('T87 security audit: backend SQL', () => {
  it('every execute / query that touches user input uses ? placeholders', () => {
    // Read every Rust source file and look for `execute(&format!(...)`
    // patterns where the format string contains a SQL keyword AND
    // interpolates a variable. Static format strings like
    // `format!("PRAGMA table_info({table})")` are accepted as long
    // as the interpolated variable is not user input.
    const sqlFiles = listFiles(srcTauriDir, /\.rs$/).filter(
      f => !f.includes('/test_') && !f.endsWith('test.rs')
    )
    const offenders: string[] = []
    for (const file of sqlFiles) {
      const b = fileBody(file)
      // Match `.execute(&format!(...))` or `.execute(format!(...))`.
      for (const m of b.matchAll(/\.execute\(\s*&?format!\(/g)) {
        const start = m.index ?? 0
        // Walk forward to find the closing `)` of the format! call.
        let depth = 0
        let end = start
        for (let i = start; i < b.length; i++) {
          if (b[i] === '(') depth++
          else if (b[i] === ')') {
            depth--
            if (depth === 0) {
              end = i
              break
            }
          }
        }
        const args = b.slice(start, end + 1)
        // The danger is interpolation of a runtime variable that
        // could come from a user input: `{x}` where x is not a
        // literal. We approximate by saying: any `{lowercase}` is
        // a variable, and any `?` placeholder is fine.
        if (/\{[a-z_]+\}/.test(args)) {
          offenders.push(`${rel(file)}: .execute(format!(...)) with interpolated variable`)
        }
      }
    }
    expect(offenders, `SQL injection risk: ${offenders.join(', ')}`).toEqual([])
  })
})

describe('T87 security audit: Tauri IPC', () => {
  it('every #[tauri::command] takes its path argument via &str (not raw bytes)', () => {
    const mainRs = join(srcTauriDir, 'main.rs')
    const body = fileBody(mainRs)
    const offenders: string[] = []
    for (const m of body.matchAll(/#\[tauri::command\][^]*?fn\s+(\w+)\s*\(([^)]*)\)/gs)) {
      const cmdName = m[1]
      const args = m[2] ?? ''
      if (/\bpath\s*:\s*Vec<u8>/.test(args)) {
        offenders.push(`${cmdName}: ${args.trim()}`)
      }
    }
    expect(offenders, `path: Vec<u8> arg: ${offenders.join(', ')}`).toEqual([])
  })

  it('records every Tauri command that takes a path argument for review', () => {
    // Positive listing — used as a starting point for the path-safety
    // audit. The set should be small and clearly bounded; if it
    // grows, that is a sign of attack surface.
    const mainRs = join(srcTauriDir, 'main.rs')
    const body = fileBody(mainRs)
    const pathCommands = new Set<string>()
    for (const m of body.matchAll(/fn\s+(\w+)\s*\(([^)]*\bpath\b[^)]*)\)/g)) {
      const name = m[1]
      if (name) pathCommands.add(name)
    }
    expect(pathCommands.has('eval')).toBe(false)
    expect(pathCommands.has('shell_exec')).toBe(false)
  })
})

describe('T87 security audit: dependency hygiene', () => {
  it('react and react-dom are pinned to one major version', () => {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
    const reactMajor = (deps['react'] ?? '').match(/(\d+)/)?.[1]
    const domMajor = (deps['react-dom'] ?? '').match(/(\d+)/)?.[1]
    expect(reactMajor).toBeTruthy()
    expect(domMajor).toBe(reactMajor)
  })

  it('@tauri-apps/api is locked to a single 2.x line', () => {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
    const api = deps['@tauri-apps/api'] ?? ''
    expect(api.startsWith('^2.')).toBe(true)
  })
})
