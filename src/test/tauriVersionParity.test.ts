import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')
const scriptPath = resolve(projectRoot, 'scripts/check-tauri-version-parity.sh')
const manifestPath = resolve(projectRoot, 'src-tauri/Cargo.toml')
const ciPath = resolve(projectRoot, '.github/workflows/ci.yml')

const runParity = (): { status: number | null; stdout: string; stderr: string } => {
  const r = spawnSync('bash', [scriptPath], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

describe('tauri version parity check', () => {
  it('the script exists and is wired into CI', () => {
    expect(existsSync(scriptPath)).toBe(true)
    const ci = readFileSync(ciPath, 'utf8')
    expect(ci).toMatch(/check-tauri-version-parity\.sh/)
  })

  it('passes against the current manifests', () => {
    const { status, stdout } = runParity()
    // Guard against the check silently passing by finding nothing to
    // compare — it must actually verify tauri and tauri-plugin-sql.
    expect(stdout).toMatch(/tauri 2\.\d+ ~ api 2\.\d+/)
    expect(stdout).toMatch(/tauri-plugin-sql 2\.\d+ ~ plugin-sql 2\.\d+/)
    expect(status).toBe(0)
  })

  it('detects a mismatch, reproducing the bug that broke the release build', () => {
    // The historical failure was `tauri-plugin-sql = { version = "2.3.1" }`
    // against npm 2.4.0. The Tauri CLI compares the *manifest requirement*
    // against npm when no Cargo.lock exists, so it only fails in CI.
    const original = readFileSync(manifestPath, 'utf8')
    try {
      const broken = original.replace(
        /tauri-plugin-sql = \{ version = "2\.\d+"/,
        'tauri-plugin-sql = { version = "2.3.1"',
      )
      expect(broken, 'regex must match the plugin-sql dependency line').not.toBe(original)

      const { writeFileSync } = require('node:fs') as typeof import('node:fs')
      writeFileSync(manifestPath, broken)

      const { status, stdout, stderr } = runParity()
      // The mismatch is reported on stderr; stdout still lists the checks
      // that did pass, so assert both.
      expect(stderr).toMatch(/MISMATCH: tauri-plugin-sql "2\.3\.1" vs plugin-sql 2\.4\.0/)
      expect(stdout).toMatch(/tauri 2\.11 ~ api 2\.11\.1/)
      expect(status).toBe(1)
    } finally {
      const { writeFileSync } = require('node:fs') as typeof import('node:fs')
      writeFileSync(manifestPath, original)
    }
  })
})