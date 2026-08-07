import { beforeEach, describe, expect, it } from 'vitest'
import {
  addRecentProject,
  clearRecentProjects,
  formatRecentTimestamp,
  getRecentProjects,
  MAX_RECENT,
} from '../utils/recentProjects'

const STORAGE_KEY = 'morgan-bevy.recent-projects'

describe('recent-projects list', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  it('starts empty', () => {
    expect(getRecentProjects()).toEqual([])
  })

  it('adds a project to the top', () => {
    addRecentProject('/tmp/a.mbp', 'a.mbp')
    const list = getRecentProjects()
    expect(list).toHaveLength(1)
    expect(list[0]?.path).toBe('/tmp/a.mbp')
    expect(list[0]?.name).toBe('a.mbp')
  })

  it('dedupes by path — re-adding moves to the top', () => {
    addRecentProject('/tmp/a.mbp', 'a.mbp')
    addRecentProject('/tmp/b.mbp', 'b.mbp')
    addRecentProject('/tmp/a.mbp', 'a.mbp')
    const list = getRecentProjects()
    expect(list.map(e => e.path)).toEqual(['/tmp/a.mbp', '/tmp/b.mbp'])
  })

  it('caps the list at MAX_RECENT entries', () => {
    for (let i = 0; i < MAX_RECENT + 5; i += 1) {
      addRecentProject(`/tmp/p${i}.mbp`, `p${i}.mbp`)
    }
    const list = getRecentProjects()
    expect(list).toHaveLength(MAX_RECENT)
    // Most-recent first
    expect(list[0]?.path).toBe(`/tmp/p${MAX_RECENT + 4}.mbp`)
  })

  it('clearRecentProjects wipes the storage', () => {
    addRecentProject('/tmp/a.mbp', 'a.mbp')
    clearRecentProjects()
    expect(getRecentProjects()).toEqual([])
  })

  it('tolerates corrupted JSON in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(getRecentProjects()).toEqual([])
  })

  it('tolerates non-array JSON in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '{"foo": "bar"}')
    expect(getRecentProjects()).toEqual([])
  })

  it('filters out malformed entries', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { path: '/tmp/a.mbp', name: 'a.mbp', openedAt: '2026-08-06T00:00:00Z' },
        { path: 42, name: 'oops' },
        'not an object',
        null,
        {
          path: '/tmp/b.mbp',
          name: 'b.mbp',
          openedAt: '2026-08-06T00:00:00Z',
        },
      ])
    )
    const list = getRecentProjects()
    expect(list).toHaveLength(2)
    expect(list[0]?.path).toBe('/tmp/a.mbp')
    expect(list[1]?.path).toBe('/tmp/b.mbp')
  })
})

describe('formatRecentTimestamp', () => {
  it('returns empty string for invalid input', () => {
    expect(formatRecentTimestamp('not-a-date')).toBe('')
  })

  it('returns "Xs ago" for sub-minute', () => {
    const iso = new Date(Date.now() - 5_000).toISOString()
    expect(formatRecentTimestamp(iso)).toBe('5s ago')
  })

  it('returns "Xm ago" for sub-hour', () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(formatRecentTimestamp(iso)).toBe('5m ago')
  })

  it('returns "Xh ago" for sub-day', () => {
    const iso = new Date(Date.now() - 3 * 60 * 60_000).toISOString()
    expect(formatRecentTimestamp(iso)).toBe('3h ago')
  })

  it('returns "Xd ago" for sub-week', () => {
    const iso = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString()
    expect(formatRecentTimestamp(iso)).toBe('2d ago')
  })
})
