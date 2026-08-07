# Why Morgan-Bevy?

A one-pager aimed at the first 60 seconds of a new visitor's
attention.

## What it is

Morgan-Bevy is a hybrid Rust + React 3D level editor for the Bevy
game engine. You design levels with professional manual editing
tools, optionally seed them with deterministic BSP / WFC generation,
and export JSON / RON / Rust source / GLTF / binary FBX — with the
Rust source compiling against a vanilla Bevy 0.19 project.

## Who it's for

- **Bevy users** who want a real editor instead of editing
  `Scene` files by hand.
- **Procedural-generation enthusiasts** who want reproducible
  layouts (seed echoed in export metadata).
- **Small teams** that need a single-binary cross-platform tool
  without the Electron tax.

## Top 5 features

1. **Bevy 0.19 export contract** — generated Rust source uses
   `Mesh3d` + `MeshMaterial3d` + `Transform` + `Name`; no
   `PbrBundle`, no proprietary runtime.
2. **Deterministic BSP + WFC generation** — same seed, same level.
   Domain logic never calls `Instant::now()`; tests can pin time
   explicitly.
3. **60 FPS with 10,000+ objects** — instanced rendering, LOD,
   frustum culling, adaptive quality, shader-based selection
   outlines. Per-frame data lives in `useRef`, not Zustand.
4. **Native desktop, not Electron** — Tauri 2.11 + Rust + SQLite.
   ~10 MB binary per platform, offline-first.
5. **SQLite asset database** — FTS search, schema-versioned
   migrations, drag-and-drop into viewport, statistics dashboard.

## Install in 30 seconds

```bash
# Pre-built binary (any platform)
gh release download --repo greysquirr3l/morgan-bevy --pattern '*linux*'

# From source (Node 22+, Rust 1.96+)
git clone https://github.com/greysquirr3l/morgan-bevy
cd morgan-bevy && npm install && npm run tauri:dev
```

## Five-minute tour

1. Open the editor — the empty viewport shows the grid.
2. Drop a cube from the **Assets** panel into the scene.
3. Press **W** for translate, **E** for rotate, **R** for scale.
4. Switch to the **Generate** panel, set a seed, click **Run BSP**.
5. Open the **Export** panel, pick **Rust source**, hit **Export**.
6. Drop the generated file into a fresh Bevy project. It compiles.

## When not to use it

- You're already on Unreal / Unity — those editors are richer and
  better integrated with their engines.
- You need real-time multiplayer editing — out of scope today.
- You want a Blender replacement — Morgan-Bevy is a *level*
  editor, not a general 3D modeller.

## Links

- Repo: <https://github.com/greysquirr3l/morgan-bevy>
- Bevy: <https://bevyengine.org>
- Tauri: <https://tauri.app>
- Author: <https://github.com/greysquirr3l>