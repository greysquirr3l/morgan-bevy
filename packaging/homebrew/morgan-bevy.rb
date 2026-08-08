# T72 — Homebrew Cask formula for morgan-bevy.
#
# Drop this file into the `Casks` directory of a Homebrew tap (typically
# `homebrew-cask` for community contributions, or your own tap at
# `github.com/<user>/homebrew-tap`). Users then install with:
#
#   brew install --cask morgan-bevy
#
# The cask lives here in `packaging/homebrew/` rather than being submitted
# upstream to homebrew-cask because:
#   1. The project is not yet at a stable version; homebrew-cask rejects
#      pre-1.0 releases for desktop apps.
#   2. The maintainer flow for cask submissions lives in a separate tap.
#
# When the project is ready for the official cask, copy this file to
# `homebrew/homebrew-cask/Casks/m/morgan-bevy.rb` and open a PR.

cask "morgan-bevy" do
  version "0.4.0"

  # SHA256s for every supported binary — Homebrew rejects casks with
  # a `livecheck`-style URL until you've published a tag with a
  # stable download URL. The release workflow in
  # `.github/workflows/release.yml` uploads a tagged `.dmg` whose
  # sha256 is published in the GitHub Release notes; pin the values
  # below after each release.
  on_macos do
    on_arm do
      url "https://github.com/greysquirr3l/morgan-bevy/releases/download/v#{version}/Morgan-Bevy_#{version}_aarch64.dmg"
      sha256 "REPLACE_WITH_RELEASE_SHA256_AARCH64"
    end
    on_intel do
      url "https://github.com/greysquirr3l/morgan-bevy/releases/download/v#{version}/Morgan-Bevy_#{version}_x64.dmg"
      sha256 "REPLACE_WITH_RELEASE_SHA256_X64"
    end
  end

  name "Morgan-Bevy"
  desc "3D level editor for the Bevy game engine with procedural generation and multi-format export"
  homepage "https://github.com/greysquirr3l/morgan-bevy"

  # The .app bundle is the only thing inside the .dmg.
  app "Morgan-Bevy.app"

  # zap removes the app's sandboxed prefs on uninstall — keeps
  # the user's asset library cleanup consistent with `rm -rf
  # ~/.morgana`.
  zap trash: [
    "~/Library/Application Support/Morgan-Bevy",
    "~/Library/Preferences/com.morgan-bevy.app.plist",
    "~/Library/Caches/com.morgan-bevy.app",
  ]

  caveats <<~EOS
    Morgan-Bevy stores its asset database and thumbnail cache under
    `~/.morgana/`. The cask only removes the app bundle on uninstall;
    the `~/.morgana/` directory is preserved so your projects survive
    a reinstall.
  EOS
end