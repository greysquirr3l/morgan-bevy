import { beforeEach, describe, expect, it } from 'vitest'
import {
  AUTOSAVE_KEY,
  AUTOSAVE_SCHEMA_VERSION,
  clearAutosave,
  readAutosave,
} from '../hooks/useAutoSave'

describe('auto-save snapshot helpers', () => {
  beforeEach(() => {
    localStorage.removeItem(AUTOSAVE_KEY)
  })

  it('returns null when no snapshot is present', () => {
    expect(readAutosave()).toBeNull()
  })

  it('round-trips a snapshot through localStorage', () => {
    const snapshot = {
      schemaVersion: AUTOSAVE_SCHEMA_VERSION,
      savedAt: '2026-08-06T00:00:00Z',
      scene: {
        objects: new Map([['a', { id: 'a' }]]),
        layers: [{ id: 'default', name: 'Default' }],
        activeLayer: 'default',
        selectedObjects: ['a'],
      },
    }
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot))
    const read = readAutosave()
    expect(read).not.toBeNull()
    expect(read?.schemaVersion).toBe(AUTOSAVE_SCHEMA_VERSION)
  })

  it('clearAutosave removes the snapshot', () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ foo: 'bar' }))
    clearAutosave()
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
  })

  it('returns null for non-object JSON', () => {
    localStorage.setItem(AUTOSAVE_KEY, '"a string"')
    expect(readAutosave()).toBeNull()
  })

  it('returns null for null JSON', () => {
    localStorage.setItem(AUTOSAVE_KEY, 'null')
    expect(readAutosave()).toBeNull()
  })

  it('returns null for corrupted JSON', () => {
    localStorage.setItem(AUTOSAVE_KEY, '{not-json')
    expect(readAutosave()).toBeNull()
  })
})
