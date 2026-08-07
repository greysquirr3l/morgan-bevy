# Image assets

The release-tagging workflow (T67) and the README's "Demo &
Screenshots" section link into this directory. Files listed below
are the ones we intend to ship — drop them in at 1080p / 1440p and
let the docs reference them.

| Filename | Source |
|---|---|
| `screenshot-viewport-3d.png` | Orbit camera, one cube selected |
| `screenshot-viewport-fly.png` | Fly camera, grid visible |
| `screenshot-viewport-ortho.png` | Ortho top-down, two cubes |
| `screenshot-generation-panel.png` | BSP seed `7C3F` output |
| `screenshot-export-panel.png` | Rust-source export modal |
| `screenshot-asset-browser.png` | FTS search "stone wall" |
| `screenshot-performance-panel.png` | 10K-object stress test |
| `demo-60s.gif` | 60-second screen recording (gifski) |

## Regenerating locally

1. `npm run tauri:dev` to boot the editor.
2. Capture each scene via the OS screenshot tool.
3. For the GIF, run the editor, walk the workflow, and pipe the
   recording through `gifski --fps 30 --quality 90 input.mov > demo-60s.gif`.
4. Commit the resulting files into this directory.