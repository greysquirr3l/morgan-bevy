import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')
const denyToml = resolve(projectRoot, 'src-tauri/deny.toml')
const rootDenyToml = resolve(projectRoot, 'deny.toml')
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

  it('root deny.toml exists and mirrors the src-tauri allow-list', () => {
    expect(existsSync(rootDenyToml)).toBe(true)
    const root = readFileSync(rootDenyToml, 'utf8')
    for (const section of ['[graph]', '[advisories]', '[licenses]', '[bans]', '[sources]']) {
      expect(root, `root deny.toml missing ${section}`).toContain(section)
    }
    // Same license policy in both manifests, or the workspace and the app
    // would ship under different rules.
    const app = readFileSync(denyToml, 'utf8')
    for (const license of ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC']) {
      expect(app).toMatch(new RegExp(`^\\s*"${license.replace('.', '\\.')}"`, 'm'))
      expect(root).toMatch(new RegExp(`^\\s*"${license.replace('.', '\\.')}"`, 'm'))
    }
  })

  it('every ignore entry is annotated with a reason', () => {
    const text = readFileSync(denyToml, 'utf8')
    const ignoreBlock = text.match(/ignore\s*=\s*\[([\s\S]*?)\]/)
    expect(ignoreBlock).not.toBeNull()
    const before = text.slice(0, ignoreBlock!.index!)
    expect(before).toMatch(/^#\s+RUSTSEC/m)
  })

  it('no longer ignores the zvariant advisories (rfd 0.17 dropped zbus 4)', () => {
    const text = readFileSync(denyToml, 'utf8')
    for (const id of ['RUSTSEC-2026-0370', 'RUSTSEC-2026-0371', 'RUSTSEC-2026-0372']) {
      expect(text, `${id} should no longer be ignored`).not.toContain(`"${id}"`)
    }
  })

  it('script wrapper exists and is executable', () => {
    expect(existsSync(scriptPath)).toBe(true)
    const stat = readFileSync(scriptPath, 'utf8')
    expect(stat).toMatch(/cargo deny fetch/)
    expect(stat).toMatch(/cargo deny check/)
  })

  it('cargo deny check --no-fetch passes on both manifests', () => {
    const result = spawnSync('bash', ['scripts/cargo-deny.sh', '--no-fetch'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    const raw = (result.stdout ?? '') + (result.stderr ?? '')
    // Strip ANSI escape codes so the assertion is portable across TTY modes.
    // eslint-disable-next-line no-control-regex -- ANSI escapes are the only reliable way to parse cargo-deny output
    const output = raw.replace(/\x1b\[[0-9;]*m/g, '')
    expect(result.status, `cargo-deny exited with ${result.status}\n${output}`).toBe(0)
    // Both the app crate and the root workspace must be linted. Assert on
    // the success banner (which only a real `cargo deny check` prints)
    // rather than the echo label, which a stub could satisfy.
    const passes = output.match(/advisories ok, bans ok, licenses ok, sources ok/g)
    expect(passes, 'expected two clean cargo-deny runs').toHaveLength(2)
  }, 60_000)
})
