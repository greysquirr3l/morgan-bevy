/**
 * T61 — bundled example projects.
 *
 * Each example deserialises successfully, has the expected
 * metadata fields, and survives a `ProjectDataSchema.parse` round
 * trip. Drops of malformed entries are covered indirectly: the
 * loader's happy path returns at least one entry, so a regression
 * that breaks the loader (no entries returned) would fail these
 * assertions.
 */
import { describe, expect, it } from 'vitest'

import { loadExampleLevels, parseExampleProject } from '@/utils/exampleLevels'

describe('T61 loadExampleLevels', () => {
  it('returns the four expected example ids (Office, Dungeon, Castle, SciFi)', () => {
    const examples = loadExampleLevels()
    const ids = examples.map(e => e.id).sort()
    expect(ids).toContain('office')
    expect(ids).toContain('dungeon')
    expect(ids).toContain('castle')
    expect(ids).toContain('scifi')
  })

  it('every example has a non-empty name + description', () => {
    const examples = loadExampleLevels()
    for (const eg of examples) {
      expect(eg.name.length).toBeGreaterThan(0)
      expect(eg.description.length).toBeGreaterThan(0)
    }
  })

  it('every example has schemaVersion 1 and a scene object', () => {
    const examples = loadExampleLevels()
    for (const eg of examples) {
      expect(eg.projectData.schemaVersion).toBe(1)
      expect(typeof eg.projectData.scene).toBe('object')
      expect(eg.projectData.scene).not.toBeNull()
    }
  })

  it('every example deserialises successfully through ProjectDataSchema', () => {
    const examples = loadExampleLevels()
    for (const eg of examples) {
      const result = parseExampleProject(eg.projectData)
      expect(result).not.toBeNull()
      expect(result?.schemaVersion).toBe(1)
    }
  })

  it('results are returned in a stable order (sorted by id)', () => {
    const a = loadExampleLevels()
    const b = loadExampleLevels()
    expect(a.map(e => e.id)).toEqual(b.map(e => e.id))
    // Sorted alphabetically — verifiable by string compare.
    const ids = a.map(e => e.id)
    const sorted = [...ids].sort()
    expect(ids).toEqual(sorted)
  })

  it('Office has at least 10 objects (room + walls + meeting table + desks)', () => {
    const office = loadExampleLevels().find(e => e.id === 'office')
    expect(office).toBeDefined()
    const objects = (office?.projectData.scene as { objects?: unknown }).objects
    expect(Array.isArray(objects)).toBe(true)
    expect((objects as unknown[]).length).toBeGreaterThanOrEqual(10)
  })

  it('Castle has at least 4 towers + 4 walls', () => {
    const castle = loadExampleLevels().find(e => e.id === 'castle')
    expect(castle).toBeDefined()
    const objects = (castle?.projectData.scene as { objects?: unknown }).objects
    expect(Array.isArray(objects)).toBe(true)
    expect((objects as unknown[]).length).toBeGreaterThanOrEqual(9)
  })

  it('SciFi example includes a light marker on the light tower (T91 demo)', () => {
    const scifi = loadExampleLevels().find(e => e.id === 'scifi')
    expect(scifi).toBeDefined()
    const objects = (
      scifi?.projectData.scene as { objects?: Array<[string, Record<string, unknown>]> }
    ).objects
    expect(objects).toBeDefined()
    const tower = objects?.find(([id]) => id === 'tower_light')?.[1]
    expect(tower).toBeDefined()
    expect(tower?.light).toBeDefined()
    // Light marker should be a point light with shadows on.
    const light = tower?.light as { kind?: string; shadows?: boolean } | undefined
    expect(light?.kind).toBe('point')
    expect(light?.shadows).toBe(true)
  })
})

describe('T61 parseExampleProject', () => {
  it('accepts a valid payload', () => {
    const result = parseExampleProject({
      schemaVersion: 1,
      scene: { objects: [], layers: [], activeLayer: 'default' },
    })
    expect(result).not.toBeNull()
    expect(result?.schemaVersion).toBe(1)
  })

  it('rejects a payload with invalid schemaVersion', () => {
    const result = parseExampleProject({
      schemaVersion: 0,
      scene: { objects: [], layers: [], activeLayer: 'default' },
    })
    expect(result).toBeNull()
  })

  it('rejects a payload with no scene', () => {
    const result = parseExampleProject({
      schemaVersion: 1,
    })
    expect(result).toBeNull()
  })
})
