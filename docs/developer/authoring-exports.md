# Authoring Exports

> How to add a new export format. The existing JSON / RON /
> Rust-source / GLTF / FBX exporters are the references. Adding
> a new format is "add a file in this dir + register it in
> main.rs + add a panel UI button."

## What an exporter is, formally

An exporter is a struct with one public method:

```rust
pub trait Exporter {
    /// Write the level to the given output directory. The exporter
    /// decides the filename / format. Returns the absolute paths
    /// of files it wrote so the editor can surface a success
    /// message.
    fn export(&self, level: &LevelData, out_dir: &Path) -> Result<Vec<PathBuf>, String>;
}
```

`LevelData` is the on-disk shape — see
[user/export-formats.md](../user/export-formats.md). Exporter
input is always `&LevelData`; the wire format is a downstream
concern.

## Existing exporters

| Format      | Source                               | Wire format                                                             |
| ----------- | ------------------------------------ | ----------------------------------------------------------------------- |
| Rust source | `src-tauri/src/export/exporters.rs`  | Generated `.rs` file consuming the companion crate. The primary export. |
| JSON        | `src-tauri/src/export/exporters.rs`  | `ExportedLevel` JSON via serde_json.                                    |
| RON         | `src-tauri/src/export/exporters.rs`  | RON via the `ron` crate.                                                |
| GLTF        | `src-tauri/src/export/gltf.rs`       | Standard 3D interchange via the `gltf` crate.                           |
| FBX         | `src-tauri/src/export/binary_fbx.rs` | Hand-written FBX 7.x binary writer.                                     |

All five are dispatched from a single `export_level` Tauri
command that takes a `formats: Vec<String>` and runs the
matching exporters in parallel-ish.

## Adding a new exporter

Example: a CSV exporter for spreadsheet-style data
analysis. A single step per file, no schema migration
required.

### Step 1 — create the file

Create `src-tauri/src/export/csv.rs`:

```rust
use std::path::{Path, PathBuf};

use crate::generation::LevelData;

pub struct CsvExporter;

impl CsvExporter {
    pub fn new() -> Self { Self }

    pub fn export(
        &self,
        level: &LevelData,
        out_dir: &Path,
    ) -> Result<Vec<PathBuf>, String> {
        let mut path = out_dir.to_path_buf();
        path.push(format!("level_{}.csv", level.metadata.seed));
        let mut csv = String::new();
        csv.push_str("id,name,position_x,position_y,position_z,size\n");
        for entity in &level.entities {
            let row = match entity {
                LevelEntity::Floor { position, size, .. } => format!(
                    "f{}_{},floor,{},{},{},{}\n",
                    position[0] as i32, position[2] as i32,
                    position[0], position[1], position[2],
                    size[0],
                ),
                _ => continue,
            };
            csv.push_str(&row);
        }
        std::fs::write(&path, csv)
            .map_err(|e| format!("write {}: {e}", path.display()))?;
        Ok(vec![path])
    }
}
```

### Step 2 — register in the dispatcher

In `src-tauri/src/export/exporters.rs`:

```rust
use super::csv::CsvExporter;

pub fn export_level(
    level: &LevelData,
    format: ExportFormat,
    out_dir: &Path,
) -> Result<Vec<PathBuf>, String> {
    let files = match format {
        ExportFormat::RustSource => rust_source::export(level, out_dir)?,
        ExportFormat::Json => json::export(level, out_dir)?,
        ExportFormat::Ron => ron::export(level, out_dir)?,
        ExportFormat::Gltf => GltfExporter::new().export(level, out_dir)?,
        ExportFormat::Fbx => FbxExporter::new().export(level, out_dir)?,
        // T64 — your new exporter plugs in here.
        ExportFormat::Csv => CsvExporter::new().export(level, out_dir)?,
    };
    Ok(files)
}
```

And add the variant to `ExportFormat`:

```rust
pub enum ExportFormat {
    RustSource,
    Json,
    Ron,
    Gltf,
    Fbx,
    Csv, // T64 — new
}
```

If your exporter takes Cargo-only deps (e.g. a custom
format-specific crate), add them to `Cargo.toml`. The
existing exporters use `serde_json`, `ron`, `gltf`, and a
hand-written FBX encoder — your exporter can be a few
hundred lines of pure Rust without pulling anything in.

### Step 3 — Tauri command surface

The existing `export_level` command takes a `formats: Vec<String>`
and runs each. No changes needed for the backend; the string
mapping lives in the same `exporters.rs`:

```rust
fn format_from_str(s: &str) -> Result<ExportFormat, String> {
    match s {
        "rust" => Ok(ExportFormat::RustSource),
        "json" => Ok(ExportFormat::Json),
        "ron" => Ok(ExportFormat::Ron),
        "gltf" => Ok(ExportFormat::Gltf),
        "fbx" => Ok(ExportFormat::Fbx),
        "csv" => Ok(ExportFormat::Csv), // T64 — new
        other => Err(format!("unsupported format: {other}")),
    }
}
```

The frontend's `ExportPanel` already renders one button per
supported format from a static list. Add a `csv` entry to that
list and the user can pick it.

### Step 4 — write the test

Per the project rule: every new public function gets a test.
Drop `#[cfg(test)] mod tests` at the bottom of
`src-tauri/src/export/csv.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::generation::LevelData;

    fn sample_level() -> LevelData {
        LevelData::sample() // existing helper, or build a tiny one inline
    }

    #[test]
    fn csv_writes_one_row_per_floor_tile() {
        let dir = tempfile::tempdir().expect("tempdir");
        let level = sample_level();
        let files = CsvExporter::new()
            .export(&level, dir.path())
            .expect("export");
        assert_eq!(files.len(), 1);
        let csv = std::fs::read_to_string(&files[0]).expect("read");
        let rows: Vec<&str> = csv.lines().collect();
        assert!(rows.len() >= 2); // header + at least one row
        assert!(rows[0].starts_with("id,name,"));
    }
}
```

### Step 5 — document in `[user/export-formats.md](../user/export-formats.md)`

Add a section under "Export Formats" describing your new
format with a worked example. The user-facing doc is the
contract; if it's not documented, users won't find it.

## What you do NOT need to do

- **Touch the Tauri command surface.** The dispatcher
  already accepts a list of formats.
- **Touch the frontend's ExportPanel** beyond adding a label
  to its format list.
- **Touch the companion crate.** Bevy-side changes are
  only needed if your exporter emits new marker types.
- **Re-export existing levels.** The format is purely
  additive — older projects without it still load.

## Common mistakes

- **Forgetting to add the variant to `ExportFormat`.** The
  dispatcher will fail with a "non-exhaustive match" error
  at compile time. `cargo build` catches it before commit.
- **Using `Instant::now()` for filenames.** Round-trip
  determinism is broken if your exporter writes
  `level_<timestamp>.csv` — same input → different filename.
  Use the seed instead.
- **Touching the source files.** Exporter files go in
  `src-tauri/src/export/<format>.rs`. Don't extend
  `exporters.rs` with your format's logic — it dispatches,
  nothing else.
- **Skipping the test.** Same reason as
  [authoring-generators.md](authoring-generators.md#common-mistakes):
  the determinism test pins the contract.
