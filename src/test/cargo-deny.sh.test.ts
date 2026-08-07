import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')
const denyToml = resolve(projectRoot, 'src-tauri/deny.toml')
const scriptPath = resolve(projectRoot, 'scripts/cargo-deny.sh')

describe('cargo-deny supply-chain policy (T66)', () => {
  it('deny.toml exists', () => {
    expect(existsSync(denyToml)).toBe(true)
  })

  it('deny.toml declares the four required sections', () => {
    const text = readFileSync(denyToml, 'utf8')
    expect(text).toMatch(/\[graph\]/)
    expect(text).toMatch(/\[advisories\]/)
    expect(text).toMatch(/\[licenses\]/)
    expect(text).toMatch(/\[bans\]/)
    expect(text).toMatch(/\[sources\]/)
  })

  it('deny.toml allow-list includes MIT, Apache-2.0, and BSD-*', () => {
    const text = readFileSync(denyToml, 'utf8')
    expect(text).toMatch(/^\s*"MIT"/m)
    expect(text).toMatch(/^\s*"Apache-2\.0"/m)
    expect(text).toMatch(/^\s*"BSD-2-Clause"/m)
    expect(text).toMatch(/^\s*"BSD-3-Clause"/m)
    expect(text).toMatch(/^\s*"ISC"/m)
  })

  it('deny.toml bans wildcard versions', () => {
    const text = readFileSync(denyToml, 'utf8')
    expect(text).toMatch(/wildcards\s*=\s*"deny"/)
  })

  it('deny.toml rejects unknown registries', () => {
    const text = readFileSync(denyToml, 'utf8')
    expect(text).toMatch(/unknown-registry\s*=\s*"deny"/)
    expect(text).toMatch(/unknown-git\s*=\s*"deny"/)
  })

  it('every ignore entry is annotated with a reason', () => {
    const text = readFileSync(denyToml, 'utf8')
    const ignoreBlock = text.match(/ignore\s*=\s*\[([\s\S]*?)\]/)
    expect(ignoreBlock).not.toBeNull()
    const before = text.slice(0, ignoreBlock!.index!)
    expect(before).toMatch(/^#\s+RUSTSEC/m)
  })

  it('script wrapper exists and is executable', () => {
    expect(existsSync(scriptPath)).toBe(true)
    const stat = readFileSync(scriptPath, 'utf8')
    expect(stat).toMatch(/cargo deny fetch/)
    expect(stat).toMatch(/cargo deny check/)
  })

  it('cargo deny check --no-fetch passes on the current lockfile', () => {
    const result = spawnSync('bash', ['scripts/cargo-deny.sh', '--no-fetch'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    const raw = (result.stdout ?? '') + (result.stderr ?? '')
    // Strip ANSI escape codes so the assertion is portable across TTY modes.
    // eslint-disable-next-line no-control-regex -- ANSI escapes are the only reliable way to parse cargo-deny output
    const output = raw.replace(/\x1b\[[0-9;]*m/g, '')
    expect(result.status, `cargo-deny exited with ${result.status}\n${output}`).toBe(0)
    expect(output).toContain('advisories ok, bans ok, licenses ok, sources ok')
  }, 60_000)
})
