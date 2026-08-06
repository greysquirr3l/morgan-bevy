import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')
const scriptPath = resolve(projectRoot, 'scripts/next-tag.sh')

function nextTag(args: { latest?: string; bump?: string } = {}): string {
  const env = {
    ...process.env,
    ...(args.latest !== undefined ? { LATEST_TAG: args.latest } : {}),
    ...(args.bump !== undefined ? { NEXT_TAG_BUMP: args.bump } : {}),
  }
  const result = spawnSync('bash', [scriptPath], {
    cwd: projectRoot,
    env,
    encoding: 'utf8',
  })
  const raw = (result.stdout ?? '') + (result.stderr ?? '')
  expect(result.status, `next-tag.sh exited ${result.status}\n${raw}`).toBe(0)
  return raw.trim()
}

describe('release tag bumping (T67)', () => {
  it('bumps PATCH on the default strategy', () => {
    expect(nextTag({ latest: 'v0.4.0' })).toBe('v0.4.1')
    expect(nextTag({ latest: 'v1.2.3' })).toBe('v1.2.4')
    expect(nextTag({ latest: 'v0.0.9' })).toBe('v0.0.10')
  })

  it('bumps MINOR when NEXT_TAG_BUMP=minor', () => {
    expect(nextTag({ latest: 'v0.4.0', bump: 'minor' })).toBe('v0.5.0')
    expect(nextTag({ latest: 'v1.2.3', bump: 'minor' })).toBe('v1.3.0')
  })

  it('bumps MAJOR when NEXT_TAG_BUMP=major', () => {
    expect(nextTag({ latest: 'v0.4.0', bump: 'major' })).toBe('v1.0.0')
    expect(nextTag({ latest: 'v1.2.3', bump: 'major' })).toBe('v2.0.0')
  })

  it('handles missing leading v', () => {
    expect(nextTag({ latest: '0.4.0' })).toBe('v0.4.1')
  })

  it('falls back to v0.0.1 when no tag exists', () => {
    expect(nextTag({ latest: '' })).toBe('v0.0.1')
  })

  it('handles invalid latest tag', () => {
    // A non-numeric latest tag is treated as "no tag" and falls back to
    // v0.0.1. This is defensive: bash arithmetic on non-numbers would
    // otherwise error out the workflow.
    expect(nextTag({ latest: 'banana' })).toBe('v0.0.1')
  })
})
