# Getting Started

> Install Morgan-Bevy, build your first level, and export it to a
> Bevy project. Plan: ten minutes from download to a running Bevy
> scene with your level loaded.

## Install

Pick the build that matches your OS. The editor is a native desktop
app (Tauri), not Electron.

### macOS

1. Download the `.dmg` from the [Releases page](https://github.com/greysquirr3l/morgan-bevy/releases).
2. Drag `Morgan-Bevy.app` to your Applications folder.
3. Open it. The first launch creates `~/.morgana/` for the SQLite
   asset database and the thumbnail cache.

### Linux

The `.deb` and `.AppImage` builds are in the same Releases page.
The `.deb` registers an XDG menu entry; the `.AppImage` is a
single-file portable build.

```bash
sudo dpkg -i morgan-bevy_*.deb  # or chmod +x morgan-bevy_*.AppImage && ./morgan-bevy_*.AppImage
```

### Windows

The `.msi` installer handles PATH registration and the Start Menu
entry. The `.exe` portable build is also in Releases.

## First launch

When the editor opens, you'll see the default layout:

- **Hierarchy** (left): the scene's object tree, grouped by layer.
- **Viewport** (centre): the 3D scene with an orbit camera.
- **Inspector** (right): the properties of the selected object.
- **Assets** (bottom-left): the scanned asset library.
- **Generation / Export** (bottom-centre): BSP / WFC generation and
  export to JSON / RON / Rust source / GLTF / FBX.

A fresh scene starts empty. The Templates menu in the FileMenu
ships four curated starting points (Office, Dungeon, Castle,
SciFi) so you don't have to build a level from a blank canvas.
Pick **File → Open Template → Office** to get a 12×12 office
shell with a meeting table and four desks.

## Place your first object

Pick an object from the **Add** menu in the Inspector — a Cube,
Sphere, or Pyramid. The new object lands at the world origin.
Press **W** to switch to translate mode (the gizmo shows arrows),
**E** for rotate, **R** for scale.

- **Click** an object to select it.
- **Shift+Click** to add to the selection.
- **Ctrl+A** selects everything.
- **Delete** removes the selection.
- **Ctrl+D** duplicates it.
- **Ctrl+Z / Ctrl+Y** undo / redo (every action is undoable).

Snap with **X / Y / Z** (constrains the gizmo to that axis) or
**Shift+X / Shift+Y / Shift+Z** (constrains to the other two
planes). The snap only fires in a non-select transform mode.

## Save your work

`Ctrl+S` saves a `.morgan` JSON project file. **File → Save Project As…**
lets you pick a new path. Every project also gets autosaved to
`~/.morgana/autosave` on every change; on launch the editor offers
to restore the autosave if the project file is newer.

## Export to Bevy

Open **File → Export Scene…** (or `Ctrl+Shift+E`). The export panel
shows five formats:

| Format          | Use case                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Rust source** | The primary path. Generated Rust code compiles against your Bevy project; the companion crate provides every marker component. |
| **JSON**        | A portable, engine-agnostic snapshot. Good for diffing or sharing previews.                                                    |
| **RON**         | Like JSON but Rusty. Round-trips through `serde`.                                                                              |
| **GLTF**        | Standard 3D interchange. Loads in any 3D tool.                                                                                 |
| **FBX**         | Legacy interchange. Use only if a downstream tool requires it.                                                                 |

Pick **Rust source**, point at your Bevy project's `src/levels/`
directory, and the editor writes `level_<name>.rs`. See
[Hello Bevy tutorial](hello-bevy.md) for the full end-to-end.

## Export settings

The import settings live on the project file under
`metadata.importSettings`. Open **File → Project → Export
Settings** (planned UI; until then, edit the JSON directly) to
control:

- `texture_max_size` — longest edge after compression. 0 disables
  resize. The import pipeline keeps the originals on disk and
  writes the compressed copy to the cache directory.
- `texture_quality` — WebP quality 0..100. Default 80.
- `skip_invalid` — if true, corrupt source files are skipped
  rather than aborting the batch.

## Asset library

The editor auto-scans a configured **Assets** directory on every
launch. Drop textures, audio, and FBX / GLB models into that
folder and they'll show up in the **Assets** panel. The pipeline
also generates 256×256 WebP thumbnails for each (see [markers.md](markers.md)
for the runtime-side breakdown).

**Important:** a project's `metadata.assetRefs` array lists every
asset it depends on. On load, the editor cross-checks that list
against the live asset database and surfaces the missing ones in
the **Broken Links** banner at the top of the Assets panel.

## Next steps

- [Interactive tutorial](tutorial.md) — the same first-object →
  select → inspect → move → save flow above, but guided step by
  step inside the editor itself. Open **Help → Getting Started
  Tutorial**.
- [Features reference](features.md) — every major feature in one
  page, with links to the detailed guide for each.
- [Markers](markers.md) — the 10 runtime markers the editor can
  attach to scene objects, and what they compile to in Bevy.
- [Bevy integration](bevy-integration.md) — how to wire the
  companion crate into a Bevy project and load an exported level.
- [Export formats](export-formats.md) — the schema of every
  output format, with examples.
- [Hello Bevy tutorial](hello-bevy.md) — generate → export →
  load in Bevy → add Rapier collision → spawn the player, end
  to end.
