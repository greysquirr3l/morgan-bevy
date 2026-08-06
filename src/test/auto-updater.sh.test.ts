import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')
const cargoToml = resolve(projectRoot, 'src-tauri/Cargo.toml')
const tauriConf = resolve(projectRoot, 'src-tauri/tauri.conf.json')
const mainRs = resolve(projectRoot, 'src-tauri/src/main.rs')

describe('tauri-plugin-updater (T68)', () => {
  it('declares the dependency in src-tauri/Cargo.toml', () => {
    const toml = readFileSync(cargoToml, 'utf8')
    expect(toml).toMatch(/^tauri-plugin-updater\s*=\s*"2"/m)
  })

  it('configures the updater plugin in tauri.conf.json', () => {
    const conf = readFileSync(tauriConf, 'utf8')
    const parsed = JSON.parse(conf) as { plugins?: Record<string, unknown> }
    expect(parsed.plugins).toBeDefined()
    const updater = parsed.plugins?.updater as Record<string, unknown>
    expect(updater).toBeDefined()
    expect(updater.active).toBe(true)
    expect(Array.isArray(updater.endpoints)).toBe(true)
    const endpoints = updater.endpoints as string[]
    expect(endpoints[0]).toMatch(/^https:\/\/github\.com\//)
    expect(endpoints[0]).toMatch(/latest\.json$/)
    expect(typeof updater.pubkey).toBe('string')
    expect((updater.pubkey as string).length).toBeGreaterThan(0)
  })

  it('registers the plugin in main.rs', () => {
    const rs = readFileSync(mainRs, 'utf8')
    expect(rs).toMatch(/tauri_plugin_updater::Builder::new\(\)/)
  })

  it('endpoints point at the project repo', () => {
    const conf = JSON.parse(readFileSync(tauriConf, 'utf8')) as {
      plugins: { updater: { endpoints: string[] } }
    }
    const ep = conf.plugins.updater.endpoints[0]
    expect(ep).toContain('greysquirr3l/morgan-bevy')
  })

  it('uses passive install mode on Windows (no UAC prompt)', () => {
    const conf = JSON.parse(readFileSync(tauriConf, 'utf8')) as {
      plugins: {
        updater: { windows?: { installMode?: string } }
      }
    }
    expect(conf.plugins.updater.windows?.installMode).toBe('passive')
  })
})
