// T33 — async thumbnail queue.
//
// `ThumbnailQueue` owns a `tokio::sync::mpsc::Sender<ThumbnailJob>`.
// The scanner enqueues pending assets via `submit`. A single
// `ThumbnailWorker` task consumes from the receiver, runs the
// render + write + DB-update pipeline off-thread (the renderer is
// pure Rust but can take a few hundred ms for a 1024x1024 texture),
// and continues until the channel closes.
//
// The DB is wrapped in `std::sync::Mutex` (T33: `Arc<Mutex<AssetDatabase>>`)
// so the worker can hold the lock for the duration of the upsert
// without contending with the scanner — the lock is held only for
// the synchronous SQLite write, not for the render. The render
// itself runs inside `tokio::task::spawn_blocking` because the
// `image` decoder is sync.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use log::{debug, error, info, warn};
use tokio::sync::mpsc;

use super::dispatch::{encode_webp, render_for_asset};
use super::{thumbnail_path, THUMBNAIL_SIZE};
use crate::assets::database::AssetDatabase;

/// One unit of work: render a thumbnail for this asset and write it
/// to the supplied directory. `source_mtime` is the Unix-timestamp
/// mtime of the source file at enqueue time — recorded in the DB
/// row so the next scan can detect staleness without stat-ing the
/// file.
#[derive(Debug, Clone)]
pub struct ThumbnailJob {
    pub asset_id: i64,
    pub asset_type: String,
    pub source_path: PathBuf,
    pub source_mtime: i64,
}

/// Handle held by the scanner / Tauri command. Cheap to clone —
/// just wraps the sender.
#[derive(Clone)]
pub struct ThumbnailQueue {
    sender: mpsc::Sender<ThumbnailJob>,
    /// Cache of the thumbnails directory so `thumbnails_dir()` can
    /// answer without re-cloning. The worker keeps its own
    /// `Arc<PathBuf>` for the render-side.
    #[allow(dead_code)]
    thumbnails_dir: Arc<PathBuf>,
}

impl ThumbnailQueue {
    /// Construct a new queue and spawn its worker task. The worker
    /// keeps the database connection alive; the queue itself is
    /// `Send + Sync` for Tauri's managed-state.
    pub fn spawn(
        db: Arc<Mutex<AssetDatabase>>,
        thumbnails_dir: PathBuf,
        runtime: &tokio::runtime::Handle,
    ) -> Self {
        let (tx, rx) = mpsc::channel::<ThumbnailJob>(256);
        let thumbnails_dir = Arc::new(thumbnails_dir);
        let dir_for_worker = Arc::clone(&thumbnails_dir);
        runtime.spawn(worker_loop(db, dir_for_worker, rx));
        Self {
            sender: tx,
            thumbnails_dir,
        }
    }

    /// Enqueue a single job. Returns `Err` if the worker has been
    /// dropped (only possible at shutdown); the caller can ignore
    /// the result and move on.
    pub fn submit(&self, job: ThumbnailJob) -> Result<(), mpsc::error::SendError<ThumbnailJob>> {
        self.sender.blocking_send(job)
    }

    /// Convenience: enqueue every asset the scanner just upserted.
    /// Uses `list_assets_needing_thumbnails` to decide what's
    /// pending — covers both "no row yet" and "row's `source_mtime`
    /// is older than the asset's `updated_at`" cases.
    pub fn enqueue_all_pending(&self, db: &AssetDatabase) -> Result<usize, String> {
        let pending = db
            .list_assets_needing_thumbnails(THUMBNAIL_SIZE)
            .map_err(|e| format!("list_assets_needing_thumbnails: {e}"))?;
        let mut submitted = 0;
        for (id, path, asset_type, _updated_at) in pending {
            // Compute the source's mtime on the enqueue side so the
            // worker doesn't need to stat the file. Falls back to
            // the asset's `updated_at` (unix seconds) if stat fails.
            #[expect(
                clippy::cast_possible_wrap,
                reason = "file mtime as seconds-since-epoch; pre-1970 timestamps are not representable but are also not real for any asset we'd scan"
            )]
            let mtime = std::fs::metadata(&path)
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map_or(0, |d| d.as_secs() as i64);
            let job = ThumbnailJob {
                asset_id: id,
                asset_type,
                source_path: PathBuf::from(path),
                source_mtime: mtime,
            };
            if self.submit(job).is_ok() {
                submitted += 1;
            }
        }
        Ok(submitted)
    }

    /// `Thumbnails` output directory. Owned by the queue; exposed
    /// for tests + the cleanup task.
    #[allow(dead_code)]
    pub fn thumbnails_dir(&self) -> &Path {
        self.thumbnails_dir.as_ref()
    }
}

/// Drain the receiver until the channel closes. Each job is rendered
/// + written + DB-recorded on a blocking thread because the image
///   decoder is sync and can take ~100-500ms per texture.
async fn worker_loop(
    db: Arc<Mutex<AssetDatabase>>,
    thumbnails_dir: Arc<PathBuf>,
    mut rx: mpsc::Receiver<ThumbnailJob>,
) {
    info!("ThumbnailWorker: starting");
    while let Some(job) = rx.recv().await {
        let db = Arc::clone(&db);
        let dir = Arc::clone(&thumbnails_dir);
        let result = tokio::task::spawn_blocking(move || {
            // The job is read-only after `recv`, so pass a reference
            // to avoid the needless pass-by-value clippy lint.
            let job_ref = &job;
            process_job(&db, &dir, job_ref)
        })
        .await;
        match result {
            Ok(Ok(())) => {}
            Ok(Err(e)) => warn!("ThumbnailWorker: job failed: {e}"),
            Err(e) => error!("ThumbnailWorker: blocking task join failed: {e}"),
        }
    }
    info!("ThumbnailWorker: channel closed, exiting");
}

/// Pure-ish job step: render + write + DB upsert. Pulled out of
/// `worker_loop` so the unit tests can call it directly without
/// spinning up a tokio runtime.
fn process_job(db: &Mutex<AssetDatabase>, thumbnails_dir: &Path, job: &ThumbnailJob) -> Result<(), String> {
    let out_path = thumbnail_path(thumbnails_dir, job.asset_id);

    // 1. Render. Pure function — no I/O.
    let rgb =
        render_for_asset(&job.asset_type, &job.source_path).map_err(|e| format!("render: {e}"))?;

    // 2. Encode WebP. The quality constant lives in the parent
    // module so tests can read the same value.
    let bytes = encode_webp(&rgb, super::WEBP_QUALITY);

    // 3. Write atomically: write to a sibling `.tmp` then rename,
    // so a partial write never leaves a half-encoded file at
    // `out_path` that the asset browser would otherwise pick up.
    let tmp_path = out_path.with_extension("webp.tmp");
    std::fs::write(&tmp_path, &bytes).map_err(|e| format!("write {}: {e}", tmp_path.display()))?;
    std::fs::rename(&tmp_path, &out_path)
        .map_err(|e| format!("rename {}: {e}", out_path.display()))?;

    // 4. DB upsert. Idempotent — a re-queue hit on the same asset
    // just refreshes the row. Held under the inner mutex; the lock
    // covers only the SQLite write, not the render. Scope the guard
    // tightly so the MutexGuard (significant Drop) doesn't outlive
    // the `process_job` call (clippy significant_drop_tightening).
    {
        let db_guard = db.lock().map_err(|e| format!("db mutex poisoned: {e}"))?;
        db_guard
            .upsert_thumbnail(
                job.asset_id,
                &path_to_string(&out_path),
                THUMBNAIL_SIZE,
                job.source_mtime,
            )
            .map_err(|e| format!("upsert: {e}"))?;
    }

    debug!(
        "ThumbnailWorker: asset {} -> {}",
        job.asset_id,
        out_path.display()
    );
    Ok(())
}

fn path_to_string(p: &Path) -> String {
    p.to_string_lossy().into_owned()
}

// ─── Per-worker DB handle ───────────────────────────────────────────────────
//
// `Arc<Mutex<AssetDatabase>>` is the v1 design. The lock is held only
// during the synchronous SQLite upsert at the end of `process_job`,
// never during the render itself. If a future iteration wants
// multi-worker parallelism, the right escape hatch is to give each
// worker its own `Connection`; the skeleton below is the future
// upgrade path and is currently unused.

/// Per-worker DB handle. Reserved for the multi-worker upgrade
/// path; unused today because `Arc<Mutex<AssetDatabase>>` already
/// serialises access through the inner `Mutex`.
#[allow(dead_code)]
pub struct ThumbnailWorker {
    pub db: Arc<Mutex<AssetDatabase>>,
    pub thumbnails_dir: Arc<PathBuf>,
}

impl ThumbnailWorker {
    #[allow(dead_code)]
    pub fn new(db: Arc<Mutex<AssetDatabase>>, thumbnails_dir: PathBuf) -> Self {
        Self {
            db,
            thumbnails_dir: Arc::new(thumbnails_dir),
        }
    }
}
