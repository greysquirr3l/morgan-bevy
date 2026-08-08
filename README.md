# Morgan-Bevy 3D Level Editor

> Hybrid Rust + React 3D level editor for the Bevy game engine with
> procedural generation (BSP, WFC) and professional manual editing tools.

**Core Philosophy**: _"Generate smart, edit fast, export perfect."_

[![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![Tauri](https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF)](https://tauri.app/)
[![Three.js](https://img.shields.io/badge/threejs-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE-MIT)

## Why Morgan-Bevy?

Most level editors either lock you into a single engine or treat
procedural generation as an afterthought. Morgan-Bevy does both:

- **First-class Bevy 0.19 exporter.** Generated Rust source compiles
  against a vanilla Bevy project — no proprietary runtime, no
  schema-drift patches. See `docs/dev/bevy-compat.md` for the contract.
- **Deterministic BSP + WFC generation.** Same seed, same level. No
  `Instant::now()` calls in the domain layer.
- **Manual editing that doesn't fight you.** 60 FPS with 10K+ objects,
  keyboard-driven transforms (W/E/R), command-pattern undo/redo, layer
  system, and a Zustand store that stays out of your per-frame render
  loop.
- **Native desktop, not Electron.** Tauri 2.11 + Rust backend + SQLite
  asset database, ~10 MB binary per platform.

For the full pitch see [`docs/why-morgan-bevy.md`](docs/why-morgan-bevy.md).

## Install

Pre-built binaries for the latest release are published on
[GitHub Releases](https://github.com/greysquirr3l/morgan-bevy/releases).
Double-click a `.morgan` project file to launch the editor with that
level loaded (file associations registered by the installer).

```bash
# Linux (deb)
sudo dpkg -i morgan-bevy_0.4.0_amd64.deb
# macOS (drag-and-drop the .dmg)
# Windows (run the .msi installer)
```

Homebrew, scoop, and AUR formulas are tracked in `T72`.

---

## 🎯 Project Overview

Morgan-Bevy is a hybrid Rust + React 3D level editor for the
[Bevy game engine](https://bevyengine.org/). It combines **procedural
generation algorithms** (BSP, WFC) with **professional manual editing
tools** to enable rapid level design and iteration.

### 🎮 **Target Users**

- **Game Developers** using Bevy 0.19
- **Level Designers** and 3D environment artists
- **Indie Game Studios** needing rapid prototyping tools
- **Procedural Generation** enthusiasts

---

## ✨ Current Features

### 🎨 **3D Editor Foundation**

- ✅ **Interactive 3D Viewport** - Three.js + React Three Fiber, orbit / fly / ortho cameras
- ✅ **Transform Gizmos** - Move / rotate / scale with W/E/R keys and axis-locking constraints
- ✅ **Selection** - Click + box + multi-select with shader-based outline highlights
- ✅ **Grid Snapping** - Configurable 0.1 / 0.5 / 1.0 / 2.0 units with visual overlay
- ✅ **Resizable Panels** - Hierarchy, Inspector, Viewport, Assets with drag handles
- ✅ **Camera Controls** - Reset, focus selection, frame all (F / Alt+F)

### 🌱 **Procedural Generation**

- ✅ **BSP Algorithm** - Binary Space Partitioning with theme-driven room templates
- ✅ **WFC Integration** - Wave Function Collapse with backtracking, deterministic seeds
- ✅ **Theme System** - Office, Dungeon, Castle, Sci-Fi presets (`docs/dev/themes.md`)
- ✅ **Seed Management** - Reproducible generation; seed echoed in export metadata
- ✅ **Generation Panel** - GUI for parameters, live preview, regenerate, lock seed

### 📤 **Export Pipeline**

- ✅ **JSON / RON / Rust source / GLTF / binary FBX 7.7** - five formats, one manifest
- ✅ **Bevy 0.19 contract** - Generated code uses `Mesh3d` + `MeshMaterial3d` + `Transform` + `Name` (no `PbrBundle`)
- ✅ **Bevy-compatible texture handles** - emitted with the right `Image` loaders
- ✅ **Export panel** - format toggles, live previews, target-directory picker

### 🛡️ **Asset Management**

- ✅ **SQLite Asset Database** - rusqlite-backed, schema-versioned migrations
- ✅ **Asset Browser** - search, filter, drag-and-drop into viewport
- ✅ **FTS Search** - Real-time full-text indexing with debounced query
- ✅ **Asset Scanner** - Recursive folder scan with parallel I/O
- ✅ **Statistics Dashboard** - counts, storage usage, scan status

### 📁 **Project Workflow**

- ✅ **File menu** - New / Open / Save / Save As with native dialogs
- ✅ **Recent projects** - localStorage-backed list, deduped, auto-pruned on missing file
- ✅ **Auto-save** - 60-second snapshot to localStorage with 5s debounce
- ✅ **File associations** - `.morgan` double-click launches editor with the project loaded
- ✅ **Crash logging** - Rolling 256 KiB panic log under app data dir; frontend errors forwarded

### 🎛️ **UI & Interaction**

- ✅ **Theme** - Dark / Light via Tailwind
- ✅ **In-app help modal** - 4 sections + resources, Escape-to-close (T59)
- ✅ **Context-aware menus** - File / Edit / View / Generate / Tools / Help
- ✅ **Keyboard shortcuts** - W/E/R/T/G/F/V/D/C/V/Y/Z, full list in the Help modal
- ✅ **Coordinate space** - Local / World toggle (T key)

### ⚡ **Performance**

- ✅ **60 FPS at 10K+ objects** - Instanced rendering + LOD + frustum culling + adaptive quality
- ✅ **Selection optimization** - Shader-based outlines bypass per-mesh updates
- ✅ **Performance panel** - Live FPS / draw-call / triangle counters, 1K/5K/10K benchmarks
- ✅ **Cross-platform** - Windows / macOS / Linux via Tauri 2.11
- ✅ **Strict TypeScript** - `strict: true`, no `any`, zod-validated Tauri IPC
- ✅ **Crash-safe** - Panic hook + rolling crash log + frontend error capture

### 📚 User documentation

- [Getting Started](docs/user/getting-started.md) — install, first scene, export in ten minutes.
- [Features Reference](docs/user/features.md) — every major feature in one page.
- [Markers](docs/user/markers.md) — the ten runtime markers + their Bevy-side mirrors.
- [Bevy Integration](docs/user/bevy-integration.md) — how to wire the companion crate into a Bevy project.
- [Export Formats](docs/user/export-formats.md) — Rust source, JSON, RON, GLTF, FBX wire shapes.
- [Hello Bevy Tutorial](docs/user/hello-bevy.md) — generate → export → load in Bevy → Rapier collision → player spawn.

### 🛠️ Developer documentation

- [Architecture](docs/developer/architecture.md) — Tauri / React / Three.js / Rust layout, anti-corruption boundaries, the store-vs-Map-vs-Ref rule.
- [Authoring Generators](docs/developer/authoring-generators.md) — add a new procedural algorithm end-to-end (worked Voronoi example).
- [Authoring Exports](docs/developer/authoring-exports.md) — add a new export format with one file + one dispatcher line.
- [Customisation FAQ](docs/developer/customisation-faq.md) — the common "I just want to change X" recipes.

---

## 🚧 Upcoming

The remaining work is tracked per-task in [`PROGRESS.md`](PROGRESS.md).
Headline items:

- **Lighting tools** (T55) — placement, configuration, theme presets
- **Snap points & surface snapping** (T51 / T52) — door frames, wall corners, Shift+Ctrl
- **Measurement tool** (T53) — distance, area, ruler overlay
- **Material/texture paint** (T54) — P-key brush with UV editor
- **Tags, collections, smart folders** (T32) — asset library curation
- **Collision/spawn/trigger export** (T42) — across JSON / RON / Rust / GLTF / FBX
- **CI matrix** (T65) — ubuntu / macOS / windows GitHub Actions
- **Cross-platform release pipeline** (T67) — Tauri bundler + `gh release` + `greysquirr3l` identity
- **Auto-updater** (T68) — already plumbed, release-channel wiring remains
- **Distribution channels** (T72) — Homebrew / AUR / scoop formulas

The Bevy 0.19 export contract is the only stability promise we make;
see [`docs/dev/bevy-compat.md`](docs/dev/bevy-compat.md).

---

## 🛠️ Technology Stack

| Layer                | Technology                                                                                                | Purpose                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Desktop App**      | [Tauri](https://tauri.app/) 2.11.5                                                                        | Cross-platform native shell (Rust + system webview)    |
| **Frontend**         | [React](https://reactjs.org/) 18 + [TypeScript](https://www.typescriptlang.org/) 5.9                      | Strict-mode UI; zod-validated Tauri IPC                |
| **3D Rendering**     | [Three.js](https://threejs.org/) 0.168 + [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | WebGL viewport with LOD / frustum culling / instancing |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) 5.0.8 + [Immer](https://immerjs.github.io/immer/)                | Per-frame data stays in `useRef`, never the store      |
| **Database**         | [SQLite](https://www.sqlite.org/) + [rusqlite](https://github.com/rusqlite/rusqlite)                      | Asset database with schema-versioned migrations        |
| **Generation**       | Rust (`bsp`, `wfc` modules)                                                                               | Deterministic; no `Instant::now()` in domain logic     |
| **Export Targets**   | JSON, RON, Rust source, GLTF, binary FBX 7.7                                                              | Each emits a manifest alongside the data               |
| **Styling**          | [Tailwind CSS](https://tailwindcss.com/) 3 + CSS variables for theme tokens                               | Dark / Light                                           |
| **Build System**     | [Vite](https://vitejs.dev/) 5 + [Cargo](https://doc.rust-lang.org/cargo/)                                 | Hot-reload dev server; release build via `tauri build` |
| **Quality Gates**    | Vitest · ESLint · Cargo Clippy (pedantic + nursery) · cargo-deny                                          | All six preflight checks run in CI                     |

The Bevy 0.19 export contract is the only stability promise we make;
see [`docs/dev/bevy-compat.md`](docs/dev/bevy-compat.md).

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 22.21.1+ and npm
- [Rust](https://rustup.rs/) 1.70+ with Cargo
- Platform-specific dependencies for Tauri

### Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/greysquirr3l/morgan-bevy.git
   cd morgan-bevy
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start development server**

   ```bash
   npm run tauri dev
   ```

4. **Start editing!**
   - The 3D editor will open with demo objects
   - Use W/E/R to switch transform modes
   - Click objects to select and manipulate
   - Drag assets from the Assets panel to create new objects

### Build for Production

```bash
npm run tauri build
```

---

## 📋 Development Roadmap

| Phase        | Timeline       | Status                    | Features                                                      |
| ------------ | -------------- | ------------------------- | ------------------------------------------------------------- |
| **Phase 1**  | ✅ Complete    | **Foundation**            | 3D Editor, Transform Gizmos, Basic Asset Management           |
| **Phase 2**  | ✅ Complete    | **UI & Workflow**         | Resizable Panels, Camera Controls, Professional UI            |
| **Phase 3**  | ✅ Complete    | **Asset Database**        | SQLite Database, Advanced Asset Browser, Search & Collections |
| **Phase 4**  | ✅ Complete    | **Advanced Editing**      | Box Selection, Undo/Redo, Enhanced UI                         |
| **Phase 5**  | ✅ Complete    | **Procedural Generation** | BSP, WFC, Theme System, Seed Management                       |
| **Phase 6**  | ✅ Complete    | **Export & Integration**  | JSON / RON / Rust / GLTF / FBX + Bevy 0.19 contract           |
| **Phase 7**  | ✅ Complete    | **Performance**           | LOD, frustum culling, instancing, 60 FPS @ 10K+ objects       |
| **Phase 8**  | 🔄 In Progress | **Advanced Tools**        | Snap points, surface snapping, lighting, paint                |
| **Phase 9**  | 🔄 In Progress | **Polish**                | Examples, docs, in-app help, marketing                        |
| **Phase 10** | 🔄 In Progress | **Distribution**          | cargo-deny (✅), CI matrix, release pipeline, auto-updater    |

See [`PROGRESS.md`](PROGRESS.md) for the per-task status table.

---

## 🎬 **Demo & Screenshots**

Visual assets land under [`docs/img/`](docs/img). The folder is
checked in as a placeholder; the gallery is filled in by the
release-tagging workflow (T67) once the binaries ship. Files we
intend to ship:

- `docs/img/screenshot-viewport-3d.png` — orbit camera, selected cube
- `docs/img/screenshot-viewport-fly.png` — fly camera with grid
- `docs/img/screenshot-viewport-ortho.png` — ortho top-down
- `docs/img/screenshot-generation-panel.png` — BSP seed 7C3F output
- `docs/img/screenshot-export-panel.png` — Rust-source export modal
- `docs/img/screenshot-asset-browser.png` — FTS search "stone wall"
- `docs/img/screenshot-performance-panel.png` — 10K-object stress test
- `docs/img/demo-60s.gif` — 1080p / 60-second screen recording

To regenerate locally, run the editor, capture each scene via
`Share → Save Image` (macOS) / `Win+PrtScn` (Windows) / `gnome-screenshot`
(Linux), and `gifski` the demo sequence.

---

## 🤝 Contributing

**🚀 We're actively seeking contributors!** Morgan-Bevy is an ambitious open-source project that would benefit greatly from community involvement. Whether you're a Rust developer, TypeScript expert, 3D graphics enthusiast, or UI/UX designer, there are opportunities to make a significant impact.

### 🎯 **Areas Where We Need Help**

- **Rust Backend Development** - Procedural generation algorithms (BSP, WFC), export systems
- **Three.js/WebGL** - 3D rendering optimizations, advanced visual features
- **React/TypeScript** - UI components, state management, performance improvements
- **Game Development** - Bevy engine integration, level design workflows
- **Documentation** - Technical writing, tutorials, examples
- **Testing** - Unit tests, integration tests, performance testing

### 🐛 **Bug Reports & Feature Requests**

- Open an [issue](https://github.com/greysquirr3l/morgan-bevy/issues) with detailed reproduction steps
- Check existing issues before creating new ones
- Include system information and error messages

### 💻 **Development Contributions**

- Fork the repository and create a feature branch
- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation for user-facing changes

### 📚 **Documentation**

- Improve README, code comments, or user guides
- Create tutorials or example projects
- Report unclear or missing documentation

---

## 📄 License

This project is dual-licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0))
- MIT License ([LICENSE-MIT](LICENSE-MIT) or [http://opensource.org/licenses/MIT](http://opensource.org/licenses/MIT))

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

---

## 🙏 Acknowledgments

- **[Bevy Engine](https://bevyengine.org/)** - Target game engine and inspiration
- **[Three.js](https://threejs.org/)** - Powerful 3D graphics foundation
- **[Tauri](https://tauri.app/)** - Modern desktop app framework
- **[React Three Fiber](https://github.com/pmndrs/react-three-fiber)** - React integration for Three.js
- **Open Source Community** - Libraries, tools, and inspiration

---

## 📞 **Contact & Community**

- **Repository**: [github.com/greysquirr3l/morgan-bevy](https://github.com/greysquirr3l/morgan-bevy)
- **Issues**: [Report bugs or request features](https://github.com/greysquirr3l/morgan-bevy/issues)
- **Discussions**: [Community discussions](https://github.com/greysquirr3l/morgan-bevy/discussions)

---

<div align="center">

**⭐ Star this repository if you find it useful!**

**🚧 This project is under active development - watch for updates!**

</div>
