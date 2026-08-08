# Customisation FAQ

> Common "I just want to change X" recipes. Most are short; each
> links to the file you need to edit.

## Editor

### How do I add a new keyboard shortcut?

Edit `src/shortcuts/defaults.ts`. Add a new `ShortcutBinding`
to `DEFAULT_SHORTCUTS`:

```ts
{
  action: 'my.action',
  label: 'My Action',
  key: 'j',
  modifiers: [],
  description: 'What it does.',
  category: 'My Category',
}
```

Then wire the action into the dispatch switch in
`src/hooks/useKeyboardShortcuts.ts`. Adding a new `case` is
required by the exhaustive switch on `ShortcutAction`.

### How do I change a built-in shortcut?

In the future UI: open **Settings → Keyboard**, click the
binding, press the new combo. Under the hood this writes to
`localStorage` via `setShortcutOverride` in
`src/utils/shortcutStore.ts`.

Without the UI: edit `src/shortcuts/defaults.ts` directly
(the consumer side reads defaults on first run; user
overrides land in localStorage).

### How do I add a new menu item to the FileMenu?

Edit `src/components/FileMenu/FileMenu.tsx` near the other
buttons. The pattern is:

```tsx
<button
  className="w-full px-3 py-2 text-left text-sm hover:bg-editor-border flex items-center space-x-2"
  onClick={handleMyAction}
>
  <FileText className="w-4 h-4" />
  <span>My Action</span>
  <span className="ml-auto text-xs text-editor-textMuted">Ctrl+Shift+X</span>
</button>
```

The shortcut shown is **display only** — the actual keybinding
lives in `src/shortcuts/defaults.ts`. The `Ctrl+Shift+X`
display is a hint, not a handler.

### How do I add a new Inspector section?

The Inspector is split per-marker (T91c). For non-marker
sections, create a focused component
(`src/components/Inspector/<MySection>.tsx`) and import it
in `Inspector.tsx`:

```tsx
import MySection from './MySection'

// inside the render:
;<MySection object={primaryObject} />
```

The anti-godfile rule: do NOT add the section inline to
`Inspector.tsx` if the file is already >500 lines. Inspector
is already 591; new sections go in their own file.

### How do I change the editor's colour palette?

Edit `tailwind.config.js`. The palette keys are
`editor-bg`, `editor-panel`, `editor-border`,
`editor-text`, `editor-textMuted`, `editor-accent`.
Components consume these via `className="bg-editor-bg"` etc.

After changing the palette: `npm run lint && npm test` — the
palette names are referenced as string literals throughout
the components, and a typo would surface as a missing
class.

### How do I add a new example project?

Drop your `<name>.example.json` in `src/data/examples/`. The
Vite glob picks it up at build time. Add an entry to the
template menu in `FileMenu.tsx` if you want it surfaced in the
**Open Template** submenu (currently sorted alphabetically).

The schema is `ProjectDataSchema` in
`src/types/schemas/index.ts`. Use the existing examples as
references — `scifi.example.json` is the one with marker
fields.

## Generation

### How do I tune BSP room count / corridor width?

`GenerationParams` in `src-tauri/src/generation/bsp.rs`. The
fields are:

```rust
pub struct GenerationParams {
    pub width: i32,
    pub height: i32,
    pub floors: i32,
    pub room_count: Option<i32>,
    pub corridor_width: Option<i32>,
    pub theme: Option<String>,
}
```

Pass via the **Generate** panel — the form is rendered from
the same struct.

### How do I add a new theme?

Drop a `theme_<name>.json` in the editor's project assets
directory (resolved at runtime via `find_themes_directory`).
The schema is in `src-tauri/src/generation/themes.rs`. The
existing `Office` / `Dungeon` / `Castle` / `SciFi` themes are
the references; they map tile characters (`'.'` for floor,
`'#'` for wall, etc.) to material colours.

## Export

### How do I change the generated Rust code's prefix?

The exporter emits `pub fn spawn_level_<name>(commands:
&mut Commands, asset_server: &Res<AssetServer>)`. The
`<name>` comes from the project filename (e.g. `hello.morgan`
→ `spawn_level_hello`). To change the prefix globally, edit
`src-tauri/src/export/exporters.rs::rust_source_export`.

### How do I add a marker field to the generated Bevy source?

The exporter reads `SceneObject.light` / `.animation` / `.audio`
/ `.vfx` directly. To add a new field end-to-end:

1. Add the Rust struct + serde tag in `src-tauri/src/main.rs`'s
   `GameObject`.
2. Add a T91 mirror in `src-tauri/src/export/exporters.rs`.
3. Add a TS type in `src/types/markers.ts`.
4. Add a panel in `src/components/Inspector/`.
5. Add the dispatch in `src/hooks/useKeyboardShortcuts.ts`
   if you want a keyboard binding.

See the **Light** marker in `crates/bevy-morgan-integration/`
as the worked example end-to-end.

## Persistence

### Where does the project file live?

`~/.morgana/` on Linux / macOS, `%APPDATA%/Morgan-Bevy/` on
Windows. Subdirectories:

| Path                     | Contents                         |
| ------------------------ | -------------------------------- |
| `~/.morgana/assets.db`   | The SQLite asset database (T29). |
| `~/.morgana/thumbnails/` | 256x256 WebP thumbnails (T33).   |
| `~/.morgana/autosave`    | Single autosave snapshot, JSON.  |
| `~/.morgana/imports/`    | Import pipeline cache (T35).     |

The app data dir is resolved via Tauri's `path.app_data_dir()`.

### How do I change where autosaves go?

Edit `src/hooks/useAutoSave.ts`. The path is currently
`autosave` (under the app data dir) and the write interval is
`2000` ms in `useEditorStore.debouncedAutoSave`. Both are
hard-coded constants — change them to taste, but the
`autosave` filename is referenced from `loadFromLocalStorage`
so update both.

### How do I clear the SQLite asset database?

Delete `~/.morgana/assets.db`. The editor rebuilds the schema
on the next launch via `AssetDatabase::initialize_schema`.
**This wipes every scanned asset**, so don't do it lightly.

## Tests

### How do I run a single test?

```bash
# vitest (frontend)
npx vitest run src/test/exampleLevels.test.ts

# cargo (Rust backend)
cargo test --manifest-path src-tauri/Cargo.toml -- assets::import::tests
```

### How do I add a test for a function I just wrote?

Per the project rule: every public function gets at least one
test. For Vitest, the convention is `src/test/<name>.test.ts`
or `src/test/components/<Name>.test.tsx`. For Cargo,
`#[cfg(test)] mod tests` at the bottom of the source file.

### The wiring audit complains about my export — what now?

`src/test/wiringAudit.test.ts` flags exported functions / classes
/ consts with zero consumers. Three options:

1. **Use it** — wire the export into the codebase properly.
2. **Drop it** — remove the export. Use `pub(crate)` for
   internal-only items.
3. **Annotate it** — `#[allow(dead_code)]` for Rust,
   `// eslint-disable-next-line` for TS. Last resort — the
   audit is correct that nothing uses it.

## Gotchas

### I added a new Tauri command but the frontend can't call it

Three checks:

1. Is the command in `tauri::generate_handler![...]` in
   `src-tauri/src/main.rs`?
2. Is there a zod schema in `src/types/schemas/index.ts`
   for the request + response shapes?
3. Is the invoke wrapper in `src/...` consuming the
   schema, not bypassing it? (The wiring audit catches
   untyped invokes.)

### I edited a Rust file but nothing changed in the editor

`cargo build` only runs when `npm run build` is invoked (via
the Tauri beforeBuildCommand). For incremental Rust work,
run `cargo build --manifest-path src-tauri/Cargo.toml` directly
to catch errors before `npm run build` does.

### My new Rust function passes cargo build but cargo clippy complains

The project enforces clippy pedantic + nursery with hard
denies on `unwrap_used` / `expect_used` / `panic` /
`indexing_slicing`. The clippy lints are listed in
`Cargo.toml [lints.clippy]`. Add `#[expect(clippy::..., reason
= "...")]` per call site rather than `#[allow(...)]`.
