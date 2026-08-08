# Distribution channels

> How the three package manager formulas (Homebrew Cask, AUR,
> Scoop) get published after each release. **This is maintainer
> documentation** — contributors don't need to touch any of this.

The formulas themselves live in `packaging/`. They are
versioned alongside the editor: any change to the formula
goes in the same PR as the change that requires it (a new
dependency, a renamed binary, a new icon, etc.).

## Release flow

```text
1. tag push            → auto-tag.yml computes the next semver
2. release.yml          → builds installers for 4 targets
                          (linux deb / macOS x86_64 / macOS aarch64
                          / windows msi)
3. GitHub Release       → publishes installers + checksums
                          in the release notes
4. formula update      → REPLACE_WITH_RELEASE_SHA256_* tokens
                          are filled with the actual checksums
5. cask / AUR / scoop  → PR to upstream or push to personal bucket
```

Step 4 is the only manual step. Steps 1–3 are automated via
`.github/workflows/auto-tag.yml` + `.github/workflows/release.yml`.

## Per-channel details

### Homebrew Cask

**File:** `packaging/homebrew/morgan-bevy.rb`

**Where it goes:** copy to a Homebrew tap. Either:

- **`homebrew/homebrew-cask/Casks/m/morgan-bevy.rb`** — the
  upstream cask repo. Acceptable only after v1.0; pre-1.0
  releases get rejected.
- **`<your-username>/homebrew-tap/Casks/morgan-bevy.rb`** —
  personal tap. Faster path while the project is pre-1.0.

**Install command:** `brew install --cask morgan-bevy`

**Post-release checklist:**

1. Compute the new SHA256s of the uploaded `.dmg` files (the
   GitHub Release UI shows them; `shasum -a 256 <file>` works
   locally on a downloaded copy).
2. Replace the `REPLACE_WITH_RELEASE_SHA256_*` tokens in
   `morgan-bevy.rb`.
3. Bump the `version` field.
4. Run `brew audit --new --online morgan-bevy` locally.
5. Submit the PR.

### AUR

**File:** `packaging/aur/PKGBUILD`

**Where it goes:** a new AUR repo `morgan-bevy-bin` at
<https://aur.archlinux.org/submit/>.

**Install command:** `yay -S morgan-bevy-bin`

**Post-release checklist:**

1. Update `pkgver` in the PKGBUILD.
2. Run `updpkgsums` against the new release artifacts to
   update the SHA256s.
3. Run `makepkg -si` to test locally — `namcap PKGBUILD` flags
   common policy violations.
4. `git add PKGBUILD .SRCINFO && git commit && git push`.

### Scoop

**File:** `packaging/scoop/morgan-bevy.json`

**Where it goes:** a Scoop bucket. The simplest setup is a
personal bucket — `ScoopInstaller/Scoop` extras bucket is curated
and rarely accepts new apps without an established user base.

**Install command:** `scoop install morgan-bevy`

**Post-release checklist:**

1. Update `version` and `architecture.*.hash`.
2. Run `scoop checkurl` and `scoop validate morgan-bevy.json`.
3. Commit + push.

## Why three separate places?

Each package manager has its own conventions, file formats,
and submission flow. Trying to "share" a formula across all
three would force one of them into a least-common-denominator
that satisfies none well. Three independent formulas is the
upstream-standard pattern (e.g. Rust's `rustup` does the same).

The formulas share **content** (the same SHA256s, the same
changelog notes) but not **file format**. `updpkgsums` /
manual edits update the SHA256s separately per channel — this
is a real maintenance burden, but a small one because releases
are monthly, not daily.

## Future: Chocolatey / winget / Flatpak

Same pattern — drop a `<tool>.yaml` in `packaging/<tool>/`
following that tool's format. Add a section here with the
submission flow. No code changes; the binaries are the same.

## When does the maintainer flip the v1.0 switch?

- All `[]` tasks in `PROGRESS.md` are `[x]`.
- The `release.yml` workflow has run green on at least three
  releases without manual intervention.
- The `deny.toml` policy is current.
- The T72 maintainer runbook above is current (no `TBD`s).

After that, submit the cask to `homebrew/homebrew-cask` and
promote the formula locations to "official." The repo's
distribution channel story becomes:

> Install with `brew install --cask morgan-bevy`,
> `scoop install morgan-bevy`, `yay -S morgan-bevy-bin`, or
> download the installers from the GitHub Release page.
