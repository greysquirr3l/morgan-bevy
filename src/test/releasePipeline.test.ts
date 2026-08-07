/**
 * Smoke tests for the release / auto-tag workflows (T67).
 *
 * Mirrors src/test/ciWorkflow.test.ts: parses both YAML files
 * and asserts the structural invariants the spec calls out —
 *   - workflow_run chain (auto-tag after ci, release after auto-tag)
 *   - 3-OS × 4-target build matrix
 *   - tauri-action usage (per nick.md, that's the official entry)
 *   - greysquirr3l identity in any job that creates commits
 *   - resolve-tag job handles both workflow_run AND workflow_dispatch
 *
 * Combined with src/test/release.test.ts (next-tag.sh) this gives
 * end-to-end coverage of the auto-tag → release chain without
 * needing live GitHub credentials.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'

const root = join(process.cwd(), '.github', 'workflows')
const release = parseYaml(readFileSync(join(root, 'release.yml'), 'utf8')) as Record<
  string,
  unknown
>
const autoTag = parseYaml(readFileSync(join(root, 'auto-tag.yml'), 'utf8')) as Record<
  string,
  unknown
>

function collectUses(wf: Record<string, unknown>): string[] {
  const out: string[] = []
  const jobs = wf.jobs as Record<string, { steps?: Array<{ uses?: string }> }>
  for (const job of Object.values(jobs)) {
    for (const step of job.steps ?? []) {
      if (typeof step.uses === 'string') out.push(step.uses)
    }
  }
  return out
}

function collectRuns(wf: Record<string, unknown>): string[] {
  const out: string[] = []
  const jobs = wf.jobs as Record<string, { steps?: Array<{ run?: string }> }>
  for (const job of Object.values(jobs)) {
    for (const step of job.steps ?? []) {
      if (typeof step.run === 'string') out.push(step.run)
    }
  }
  return out
}

describe('auto-tag.yml', () => {
  it('triggers off ci.yml via workflow_run', () => {
    const on = autoTag.on as { workflow_run?: { workflows?: string[]; types?: string[] } }
    expect(on.workflow_run?.workflows).toContain('ci')
    expect(on.workflow_run?.types).toContain('completed')
  })

  it('only auto-tags when CI is green and on main', () => {
    const jobs = autoTag.jobs as Record<string, { if?: string; steps?: Array<{ run?: string }> }>
    const job = jobs['auto-tag']
    expect(job?.if).toMatch(/conclusion.*success/)
    expect(job?.if).toMatch(/head_branch.*main/)
    const runs = (job.steps ?? []).map(s => s.run ?? '').join('\n')
    // Set up git author before any commit; never leave github-actions[bot].
    expect(runs).toMatch(/git config user\.name 'greysquirr3l'/)
    expect(runs).toMatch(/git config user\.email '\[email protected\]'/)
  })

  it('computes the next tag via scripts/next-tag.sh', () => {
    const runs = collectRuns(autoTag).join('\n')
    expect(runs).toMatch(/scripts\/next-tag\.sh/)
  })

  it('never uses on: push: tags (would never fire under GITHUB_TOKEN)', () => {
    const on = autoTag.on as Record<string, unknown>
    expect(on.push).toBeUndefined()
    expect(on['push.tags']).toBeUndefined()
  })
})

describe('release.yml', () => {
  it('triggers off auto-tag via workflow_run AND supports manual dispatch', () => {
    const on = release.on as {
      workflow_run?: { workflows?: string[]; types?: string[] }
      workflow_dispatch?: { inputs?: Record<string, unknown> }
    }
    expect(on.workflow_run?.workflows).toContain('auto-tag')
    expect(on.workflow_run?.types).toContain('completed')
    expect(on.workflow_dispatch).toBeDefined()
  })

  it('resolve-tag job handles BOTH workflow_run and workflow_dispatch', () => {
    const runs = collectRuns(release).join('\n')
    expect(runs).toMatch(/DISPATCH_TAG/)
    expect(runs).toMatch(/gh api "repos\/\$GITHUB_REPOSITORY\/git\/refs\/tags"/)
  })

  it('build matrix covers linux + macOS (x86_64 + aarch64) + windows', () => {
    const jobs = release.jobs as Record<
      string,
      {
        strategy?: { matrix?: { include?: Array<{ target: string; os: string }> } }
      }
    >
    const matrix = jobs.build?.strategy?.matrix?.include ?? []
    const targets = new Set(matrix.map(m => m.target))
    expect(targets.has('x86_64-unknown-linux-gnu')).toBe(true)
    expect(targets.has('x86_64-apple-darwin')).toBe(true)
    expect(targets.has('aarch64-apple-darwin')).toBe(true)
    expect(targets.has('x86_64-pc-windows-msvc')).toBe(true)
  })

  it('uses tauri-action for the build step (per nick.md the official entry)', () => {
    const uses = collectUses(release)
    expect(uses.some(u => u.startsWith('tauri-apps/tauri-action@'))).toBe(true)
  })

  it('declares code-sign / notarisation secrets so a single change here covers all platforms', () => {
    // The Tauri action reads these via env; declaring them as job-level
    // env means a maintainer who adds a new secret doesn't have to
    // touch every matrix leg. We can't introspect env blocks via the
    // run-script, but the tauri-action step has its env declared in
    // the YAML — parse it directly.
    const jobs = release.jobs as Record<
      string,
      {
        steps?: Array<{ name?: string; env?: Record<string, string> }>
      }
    >
    const buildStep = (jobs.build?.steps ?? []).find(s => s.name?.includes('Build tauri app'))
    expect(buildStep?.env).toBeDefined()
    expect(buildStep?.env?.APPLE_ID).toBe('${{ secrets.APPLE_ID }}')
    expect(buildStep?.env?.WINDOWS_CERTIFICATE).toBe('${{ secrets.WINDOWS_CERTIFICATE }}')
  })

  it('publishes a draft release (no auto-publish of unreviewed binaries)', () => {
    const jobs = release.jobs as Record<
      string,
      {
        steps?: Array<{ with?: Record<string, unknown> }>
      }
    >
    const buildStep = (jobs.build?.steps ?? []).find(s => s.with?.tagName !== undefined)
    expect(buildStep?.with?.releaseDraft).toBe(true)
  })

  it('upserts the CHANGELOG section into the release body', () => {
    const runs = collectRuns(release).join('\n')
    expect(runs).toMatch(/gh release edit/)
    expect(runs).toMatch(/CHANGELOG/)
  })

  it('uses Node 22 (matches CI)', () => {
    const uses = collectUses(release)
    expect(uses.some(u => u.startsWith('actions/setup-node@'))).toBe(true)
    // `node-version` is a `with:` block, not a `run:`, so it doesn't
    // appear in collectRuns. Read it directly off the parsed YAML —
    // YAML preserves kebab-case keys verbatim.
    const jobs = release.jobs as Record<
      string,
      {
        steps?: Array<{ with?: Record<string, unknown> }>
      }
    >
    const node = (jobs.build?.steps ?? []).find(s => s.with?.['node-version'] !== undefined)
    expect(node?.with?.['node-version']).toBe('22')
  })

  it('grants contents: write so the publish job can edit the release', () => {
    const perms = release.permissions as { contents?: string }
    expect(perms.contents).toBe('write')
  })

  it('chains on auto-tag rather than on: push: tags (loop-prevention guard)', () => {
    const on = release.on as Record<string, unknown>
    expect(on.push).toBeUndefined()
    expect(on['push.tags']).toBeUndefined()
  })
})
