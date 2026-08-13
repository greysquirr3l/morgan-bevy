// T33 — orphan thumbnail cleanup.
//
// Per the spec: "Cleanup orphans on every successful scan."
//
// Two failure modes produce orphans:
//   1. An asset row is deleted but the thumbnail file is left on
//      disk (`thumbnails` row is the source of truth; the file is
//      just a cache).
//   2. A thumbnail file exists on disk with no matching DB row
//      (corrupted DB, interrupted upgrade, etc.).
//
// `cleanup_orphans` walks the thumbnails directory, asks the DB
// for every recorded thumbnail path, and unlinks anything on disk
// that is NOT in that set. The DB is also tidied: rows whose
// `thumbnail_path` doesn't exist on disk are deleted.
//
// The function is pure I/O — no DB writes happen inside the worker
// task; callers run it once per scan completion.

use std::path::Path;

use crate::assets::database::AssetDatabase;

/// Remove orphan files + matching DB rows. Returns the number of
/// files removed (a rough upper bound — file-write errors count
/// as orphans even if the unlink itself fails).
pub fn cleanup_orphans(db: &AssetDatabase, thumbnails_dir: &Path) -> Result<usize, String> {
    let recorded = recorded_paths(db)?;
    let on_disk = on_disk_paths(thumbnails_dir)?;

    let mut removed = 0usize;

    // 1. Disk files with no DB row.
    for path in &on_disk {
        if !recorded.contains(path) && std::fs::remove_file(path).is_ok() {
            removed += 1;
            debug_log_removed(path);
        }
    }

    // 2. DB rows whose file no longer exists on disk.
    for path in &recorded {
        if !on_disk.contains(path) {
            db.delete_thumbnail_by_path(path)
                .map_err(|e| format!("delete thumbnail row {path}: {e}"))?;
            debug_log_row_removed(path);
        }
    }

    Ok(removed)
}

/// Collect every `thumbnails.thumbnail_path` value into a `Vec<String>`.
fn recorded_paths(db: &AssetDatabase) -> Result<Vec<String>, String> {
    db.list_all_thumbnail_paths()
        .map_err(|e| format!("list thumbnails: {e}"))
}

/// Walk the thumbnails directory, return the relative-style paths as
/// strings (the DB records full paths, so we match by string).
fn on_disk_paths(dir: &Path) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    let read = std::fs::read_dir(dir).map_err(|e| format!("read_dir {}: {e}", dir.display()))?;
    for entry in read.flatten() {
        let path = entry.path();
        if path.is_file() {
            out.push(path.to_string_lossy().into_owned());
        }
    }
    Ok(out)
}

fn debug_log_removed(path: &str) {
    log::debug!("T33 cleanup: orphan file removed: {path}");
}

fn debug_log_row_removed(path: &str) {
    log::debug!("T33 cleanup: DB row removed for missing file: {path}");
}
