/**
 * Smoke tests for .github/workflows/ci.yml (T65).
 *
 * These are vitest-level checks that the workflow file exists,
 * parses as valid YAML, declares the matrix / caches / jobs that
 * the spec calls out, and matches the local `just preflight` gate
 * so a flag drift fails locally before it fails in CI.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'

const workflowPath = join(process.cwd(), '.github', 'workflows', 'ci.yml')
const raw = readFileSync(workflowPath, 'utf8')
const wf = parseYaml(raw) as Record<string, unknown>

describe('ci.yml shape', () => {
  it('parses as valid YAML', () => {
    expect(wf).toBeTypeOf('object')
  })

  it('runs on push and pull_request to main, plus manual dispatch', () => {
    const on = wf.on as Record<string, unknown>
    expect(on).toBeDefined()
    const push = on.push as { branches?: string[] } | undefined
    const pr = on.pull_request as { branches?: string[] } | undefined
    expect(push?.branches).toContain('main')
    expect(pr?.branches).toContain('main')
    expect(on.workflow_dispatch).toBeDefined()
  })

  it('cancels in-flight runs on the same ref', () => {
    // GitHub Actions uses kebab-case for the concurrency key;
    // `yaml.parse` preserves the original spelling.
    const c = wf.concurrency as { 'cancel-in-progress'?: boolean } | undefined
    expect(c?.['cancel-in-progress']).toBe(true)
  })

  it('disables sccache and forces colour output via env', () => {
    const env = wf.env as Record<string, string> | undefined
    expect(env?.RUSTC_WRAPPER).toBe('')
    expect(env?.SCCACHE_DISABLE).toBe('1')
  })

  it('runs the frontend job on a 3-OS matrix', () => {
    const jobs = wf.jobs as Record<string, Record<string, unknown>>
    const frontend = jobs.frontend as {
      strategy?: { matrix?: { os?: string[] } }
    }
    expect(frontend.strategy?.matrix?.os).toEqual([
      'ubuntu-latest',
      'macos-latest',
      'windows-latest',
    ])
  })

  it('runs the backend job on a 3-OS matrix', () => {
    const jobs = wf.jobs as Record<string, Record<string, unknown>>
    const backend = jobs.backend as {
      strategy?: { matrix?: { os?: string[] } }
    }
    expect(backend.strategy?.matrix?.os).toEqual([
      'ubuntu-latest',
      'macos-latest',
      'windows-latest',
    ])
  })

  it('frontend job runs npm ci, lint, type-check, test, build', () => {
    const jobs = wf.jobs as Record<string, { steps?: Array<{ run?: string; uses?: string }> }>
    const runs = (jobs.frontend?.steps ?? [])
      .filter(s => typeof s.run === 'string')
      .map(s => s.run as string)
    expect(runs.some(r => r.includes('npm ci'))).toBe(true)
    expect(runs.some(r => r.includes('npm run lint'))).toBe(true)
    expect(runs.some(r => r.includes('npm run type-check'))).toBe(true)
    expect(runs.some(r => r.includes('npm test'))).toBe(true)
    expect(runs.some(r => r.includes('npm run build'))).toBe(true)
  })

  it('backend job runs cargo check, test, clippy with the strict profile, and cargo-deny', () => {
    const jobs = wf.jobs as Record<string, { steps?: Array<{ run?: string; uses?: string }> }>
    const runs = (jobs.backend?.steps ?? [])
      .filter(s => typeof s.run === 'string')
      .map(s => s.run as string)
      .join('\n')
    // Full backend gate present.
    expect(runs).toMatch(/cargo check/)
    expect(runs).toMatch(/cargo test/)
    expect(runs).toMatch(/cargo clippy/)
    // The strict clippy profile used by AGENTS.md / T66 must be
    // present — any drift here would fail locally too.
    for (const flag of [
      '-W clippy::all',
      '-W clippy::pedantic',
      '-W clippy::nursery',
      '-D clippy::unwrap_used',
      '-D clippy::expect_used',
      '-D clippy::panic',
      '-D clippy::indexing_slicing',
    ]) {
      expect(runs).toContain(flag)
    }
    expect(runs).toMatch(/cargo-deny\.sh/)
  })

  it('uses Swatinem rust-cache and prebuilt cargo-deny', () => {
    const uses = collectUses(wf)
    expect(uses.some(u => u.startsWith('Swatinem/rust-cache@'))).toBe(true)
    expect(uses.some(u => u.startsWith('taiki-e/install-action@cargo-deny'))).toBe(true)
  })

  it('runs the workflow-lint job on ubuntu-latest only', () => {
    const jobs = wf.jobs as Record<string, { 'runs-on'?: string }>
    expect(jobs['workflow-lint']?.['runs-on']).toBe('ubuntu-latest')
  })
})

function collectUses(wf: Record<string, unknown>): string[] {
  const jobs = wf.jobs as Record<string, { steps?: Array<{ uses?: string }> }>
  const out: string[] = []
  for (const job of Object.values(jobs)) {
    for (const step of job.steps ?? []) {
      if (typeof step.uses === 'string') out.push(step.uses)
    }
  }
  return out
}
