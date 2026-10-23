import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards the Tauri updater configuration.
 *
 * v0.6.0 shipped with `"active": true` and a literal placeholder pubkey
 * (`REPLACE_WITH_YOUR_TAURI_UPDATER_PUBLIC_KEY`). Any user who chose
 * "Check for updates" got a signature-verification failure against a key
 * that does not exist, and release.yml never uploaded the `latest.json`
 * manifest the endpoint points at.
 *
 * These assertions make that combination unshippable by accident.
 */
const projectRoot = process.cwd()
const confPath = resolve(projectRoot, 'src-tauri/tauri.conf.json')
const releaseWorkflow = readFileSync(resolve(projectRoot, '.github/workflows/release.yml'), 'utf8')

interface UpdaterConf {
  active?: boolean
  pubkey?: string
  endpoints?: string[]
}

const readConf = (): UpdaterConf => {
  // tauri.conf.json permits "//key" comment entries; strip them so JSON.parse
  // is not confused by them being interleaved in the object.
  const raw = readFileSync(confPath, 'utf8')
  const conf = JSON.parse(raw) as { plugins?: { updater?: UpdaterConf } }
  return conf.plugins?.updater ?? {}
}

describe('tauri updater config', () => {
  it('is never active while the pubkey is still a placeholder', () => {
    const updater = readConf()
    const isPlaceholder = (updater.pubkey ?? '').startsWith('REPLACE_WITH')
    if (isPlaceholder) {
      expect(
        updater.active,
        'updater.active is true with a placeholder pubkey — every update check would fail signature verification',
      ).toBe(false)
    }
  })

  it('has a non-placeholder pubkey when active', () => {
    const updater = readConf()
    if (updater.active === true) {
      expect(updater.pubkey ?? '', 'active updater needs a real public key').not.toMatch(
        /REPLACE_WITH/,
      )
    }
  })

  it('release.yml uploads latest.json when the updater is active', () => {
    const updater = readConf()
    if (updater.active === true) {
      expect(
        releaseWorkflow,
        'an active updater needs `includeUpdaterJson: true` or the endpoint 404s',
      ).toMatch(/includeUpdaterJson:\s*true/)
    }
  })

  it('documents why the updater is off and how to re-enable it', () => {
    const updater = readConf()
    if (updater.active === false) {
      expect(readFileSync(confPath, 'utf8')).toMatch(/DISABLED until a signing keypair exists/)
      expect(readFileSync(confPath, 'utf8')).toMatch(/signer generate/)
    }
  })

  it('the updater endpoint points at this repository', () => {
    const updater = readConf()
    for (const endpoint of updater.endpoints ?? []) {
      // Anchored, and https-only: an unanchored `/github.com\/.../` matches
      // anywhere in the string, so `https://evil.example/github.com/...`
      // would pass it (CodeQL js/missing-regexp-anchor). The updater would
      // then fetch a manifest from a host we do not control.
      expect(endpoint).toMatch(
        /^https:\/\/github\.com\/greysquirr3l\/morgan-bevy\/(?:releases|.*)/,
      )
      expect(new URL(endpoint).host).toBe('github.com')
      expect(new URL(endpoint).pathname.startsWith('/greysquirr3l/morgan-bevy')).toBe(true)
    }
  })
})
