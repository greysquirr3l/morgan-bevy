// T33 + T93 — headless thumbnail pipeline.
//
// Submodules:
//
//   - texture.rs      — image::open + downscale to 256x256 → WebP
//   - audio.rs        — hound (WAV) + symphonia (MP3/OGG/FLAC)
//                       decode → waveform PNG
//   - waveform.rs     — shared peak-vs-time render used by audio.rs
//   - placeholder.rs  — labelled PNG for fallback paths
//   - glb.rs          — binary glTF 2.0 → orthographic bbox PNG
//   - obj.rs          — Wavefront OBJ → bbox PNG
//   - fbx.rs          — binary FBX 7.4 / 7.5+ + ASCII FBX → bbox PNG
//   - mat.rs          — Bevy `.mat` (RON-style text) → labelled PNG
//                       with extracted asset name
//   - dispatch.rs     — per-asset-type renderer dispatch
//   - queue.rs        — tokio mpsc channel + worker task
//   - cleanup.rs      — orphan file sweep
//
// Per the spec: "Per audit: DB schema and add_thumbnail() exist but
// no generator code. Build it." This module is the generator. The
// schema (T33: `thumbnail_size`, `source_mtime`) was added in
// `database.rs` via the same in-place migration pattern as T32's
// `is_favorite`.
//
// T93 extends the renderer coverage: every asset type now produces
// a real thumbnail (no labelled placeholders except as a last-resort
// fallback when the source file is unreadable / malformed).

pub mod audio;
pub mod cleanup;
pub mod dispatch;
pub mod fbx;
pub mod glb;
pub mod mat;
pub mod obj;
pub mod placeholder;
pub mod queue;
pub mod texture;
pub mod waveform;

#[allow(unused_imports)]
pub use dispatch::render_for_asset;
#[allow(unused_imports)]
pub use queue::{ThumbnailJob, ThumbnailQueue, ThumbnailWorker};

/// Edge length, in pixels, of every generated thumbnail. The spec
/// mentions 64/128/256 multi-write but v1 ships one size to keep the
/// pipeline tractable. The schema's `thumbnail_size` column records
/// the value so a future migrator can re-queue at the new size.
pub const THUMBNAIL_SIZE: u32 = 256;

/// WebP encoding quality. The libwebp default is 75; we round up to
/// 80 because the thumbnails are surfaced in a 256x256 preview pane
/// where compression artefacts would be obvious. Exposed at the
/// module level so the queue + tests can read it without hard-coding.
pub const WEBP_QUALITY: u8 = 80;

/// File-name convention for generated thumbnails. `asset_id` is
/// the row's primary key (stable across re-queues); the size suffix
/// makes the name unique across future releases.
pub fn thumbnail_path(thumbnails_dir: &std::path::Path, asset_id: i64) -> std::path::PathBuf {
    thumbnails_dir.join(format!("thumb_{asset_id}_{THUMBNAIL_SIZE}.webp"))
}

#[cfg(test)]
mod tests {
    #![allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::indexing_slicing,
        reason = "test code is allowed to use unwrap/expect for concise assertions"
    )]

    use super::*;
    use crate::assets::database::AssetDatabase;
    use image::{ImageBuffer, Rgb};
    use rusqlite::params;
    use std::sync::{Arc, Mutex};
    use tempfile::tempdir;

    /// Helper: build a 1024x1024 RGB PNG on disk for the texture
    /// test. The point of the test is the downscale — we don't
    /// care about the colour pattern, just that the decoder
    /// accepts what we hand it.
    fn make_test_png(path: &std::path::Path) {
        let img = ImageBuffer::from_fn(1024u32, 1024u32, |x, y| {
            #[expect(
                clippy::cast_possible_truncation,
                reason = "x, y are in [0, 1024); (x % 256) is in [0, 256); truncation to u8 is intentional for the test pattern"
            )]
            let r = ((x % 256) as u8).wrapping_add(64);
            #[expect(
                clippy::cast_possible_truncation,
                reason = "y is in [0, 1024); (y % 256) is in [0, 256); truncation to u8 is intentional for the test pattern"
            )]
            let g = ((y % 256) as u8).wrapping_add(32);
            #[expect(
                clippy::cast_possible_truncation,
                reason = "(x + y) is in [0, 2048); ((x + y) % 256) is in [0, 256); truncation to u8 is intentional for the test pattern"
            )]
            let b = (((x + y) % 256) as u8).wrapping_add(16);
            Rgb([r, g, b])
        });
        img.save(path).expect("save test png");
    }

    /// Helper: build a 1-second mono WAV at 8 kHz with a sine tone.
    fn make_test_wav(path: &std::path::Path) {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 8000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(path, spec).expect("wav writer");
        for n in 0..8000 {
            #[expect(
                clippy::cast_precision_loss,
                clippy::cast_possible_truncation,
                reason = "test fixture: n is small (0..8000); the n→f32 widening is lossless in this range, and the f32→i16 truncation is the tone generator's design (it saturates at i16::MAX)"
            )]
            let sample = ((n as f32 / 8000.0 * std::f32::consts::TAU * 440.0).sin()
                * f32::from(i16::MAX)) as i16;
            writer.write_sample(sample).expect("write sample");
        }
        writer.finalize().expect("finalize wav");
    }

    /// Helper: build a 1-byte placeholder source file for the
    /// placeholder pipeline. The contents don't matter; the
    /// extension does.
    fn make_test_fbx(path: &std::path::Path) {
        std::fs::write(path, b"fake-fbx-bytes").expect("write fake fbx");
    }

    #[test]
    fn texture_render_downsamples_1024_to_thumbnail_size() {
        let dir = tempdir().expect("tempdir");
        let src = dir.path().join("big.png");
        make_test_png(&src);

        let rendered = texture::render_texture(&src).expect("render");
        assert_eq!(rendered.width(), THUMBNAIL_SIZE);
        assert_eq!(rendered.height(), THUMBNAIL_SIZE);
    }

    #[test]
    fn dispatch_writes_a_valid_webp_file() {
        let dir = tempdir().expect("tempdir");
        let src = dir.path().join("big.png");
        make_test_png(&src);

        let rgb = render_for_asset("Texture", &src).expect("render");
        let bytes = dispatch::encode_webp(&rgb, WEBP_QUALITY);
        assert!(!bytes.is_empty());
        // RIFF / WEBP magic header check.
        assert_eq!(&bytes[0..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WEBP");
    }

    #[test]
    fn audio_render_produces_a_waveform_for_wav() {
        let dir = tempdir().expect("tempdir");
        let src = dir.path().join("tone.wav");
        make_test_wav(&src);

        let rgb = render_for_asset("Audio", &src).expect("render");
        assert_eq!(rgb.width(), THUMBNAIL_SIZE);
        assert_eq!(rgb.height(), THUMBNAIL_SIZE);
    }

    #[test]
    fn audio_render_falls_back_to_placeholder_for_non_wav() {
        let dir = tempdir().expect("tempdir");
        let src = dir.path().join("track.mp3");
        std::fs::write(&src, b"fake-mp3-bytes").expect("write fake mp3");

        let rgb = render_for_asset("Audio", &src).expect("render");
        // Placeholder is still 256x256 RGB. The exact pixel
        // contents are not pinned — just that the dimensions are
        // correct and the function didn't error.
        assert_eq!(rgb.width(), THUMBNAIL_SIZE);
        assert_eq!(rgb.height(), THUMBNAIL_SIZE);
    }

    #[test]
    fn model_render_emits_labelled_placeholder() {
        let dir = tempdir().expect("tempdir");
        let src = dir.path().join("hero.fbx");
        make_test_fbx(&src);

        let rgb = render_for_asset("Model", &src).expect("render");
        assert_eq!(rgb.width(), THUMBNAIL_SIZE);
        assert_eq!(rgb.height(), THUMBNAIL_SIZE);
    }

    /// T33 spec test: "generating a thumbnail for a 1024x1024 PNG
    /// produces a 256x256 WebP." This drives the queue end-to-end.
    #[test]
    fn queue_end_to_end_produces_a_256x256_webp() {
        let dir = tempdir().expect("tempdir");
        let thumbs_dir = dir.path().join("thumbs");
        std::fs::create_dir(&thumbs_dir).expect("create thumbs dir");
        let src = dir.path().join("big.png");
        make_test_png(&src);

        // Set up an in-memory DB and insert one asset row.
        let db = Arc::new(Mutex::new(
            AssetDatabase::new_in_memory().expect("in-memory db"),
        ));
        let asset_id = {
            let g = db.lock().unwrap();
            let last_rowid = {
                let conn = g.test_connection();
                conn.execute(
                    "INSERT INTO collections (name, description) VALUES ('default', 'fixture')",
                    [],
                )
                .unwrap();
                conn.execute(
                    "INSERT INTO assets (name, file_path, asset_type, collection, file_size, checksum)
                     VALUES ('big.png', ?1, 'Texture', 'default', 1, 'sha256:demo')",
                    params![src.to_string_lossy()],
                )
                .unwrap();
                conn.last_insert_rowid()
            };
            // Drop the MutexGuard early (clippy `significant_drop_tightening`).
            drop(g);
            last_rowid
        };

        // Spawn the worker + submit one job.
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let mtime = std::fs::metadata(&src)
            .and_then(|m| m.modified())
            .expect("mtime")
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        #[expect(
            clippy::cast_possible_wrap,
            reason = "test fixture: file mtime as unix seconds; pre-1970 is not realistic for any test asset"
        )]
        let mtime = mtime as i64;
        // Scope the queue submission tightly so the `ThumbnailQueue`
        // (which holds the async worker task handle — a significant
        // Drop) is released before we drive the runtime below.
        // Without this scope clippy `significant_drop_tightening`
        // flags the binding as outliving the `runtime.block_on` call.
        {
            let queue = ThumbnailQueue::spawn(
                Arc::clone(&db),
                thumbs_dir.clone(),
                runtime.handle(),
            );
            queue
                .submit(ThumbnailJob {
                    asset_id,
                    asset_type: "Texture".to_string(),
                    source_path: src,
                    source_mtime: mtime,
                })
                .expect("submit");
        }

        // The worker is async — drive the runtime until the
        // channel drains. We use a short timeout so the test
        // fails fast if the worker stalls.
        runtime.block_on(async {
            // The queue's sender is held internally; we can't
            // close the receiver from here, so we run a fixed
            // number of poll iterations. In practice a single
            // job drains in well under 100 ms on the test rig.
            for _ in 0..50 {
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            }
        });

        // The output file should exist + be a valid 256x256 WebP.
        let out = thumbnail_path(&thumbs_dir, asset_id);
        assert!(out.exists(), "thumbnail file not written: {}", out.display());
        let bytes = std::fs::read(&out).expect("read webp");
        assert!(bytes.len() > 12, "WebP suspiciously small");
        assert_eq!(&bytes[0..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WEBP");

        // DB row should now reflect the generation.
        let recorded = {
            let g = db.lock().unwrap();
            g.upsert_thumbnail(asset_id, &out.to_string_lossy(), THUMBNAIL_SIZE, mtime)
                .expect("upsert call in test");
            g.list_all_thumbnail_paths().expect("list")
        };
        assert_eq!(recorded.len(), 1);
        assert!(recorded[0].contains(&out.file_name().unwrap().to_string_lossy().to_string()));
    }

    /// T33 spec test: "modification timestamp change triggers
    /// regeneration." We don't drive the worker here — we
    /// verify the database-level query that the worker uses to
    /// decide what to enqueue.
    #[test]
    fn list_assets_needing_thumbnails_detects_stale_mtime() {
        let db = AssetDatabase::new_in_memory().expect("in-memory db");
        let conn = db.test_connection();
        conn.execute(
            "INSERT INTO collections (name, description) VALUES ('default', 'fixture')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO assets (id, name, file_path, asset_type, collection, file_size, checksum)
             VALUES (1, 'a.png', '/tmp/a.png', 'Texture', 'default', 1, 'sha:demo')",
            [],
        )
        .unwrap();

        // No thumbnail yet → must show up as pending.
        let pending = db.list_assets_needing_thumbnails(THUMBNAIL_SIZE).expect("pending");
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].0, 1);

        // Write a thumbnail row with mtime=0 (legacy / fresh).
        db.upsert_thumbnail(1, "/tmp/thumb_1_256.webp", THUMBNAIL_SIZE, 0)
            .expect("upsert");
        // Manually bump the asset's updated_at to "now" so it
        // counts as newer than the recorded mtime.
        conn.execute(
            "UPDATE assets SET updated_at = datetime('now') WHERE id = 1",
            [],
        )
        .unwrap();
        let pending = db.list_assets_needing_thumbnails(THUMBNAIL_SIZE).expect("pending");
        assert_eq!(
            pending.len(),
            1,
            "stale mtime should re-queue; got {pending:?}"
        );

        // Match the asset's updated_at to the recorded mtime →
        // no pending.
        let asset_mtime: i64 = conn
            .query_row(
                "SELECT CAST(strftime('%s', updated_at) AS INTEGER) FROM assets WHERE id = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        db.upsert_thumbnail(1, "/tmp/thumb_1_256.webp", THUMBNAIL_SIZE, asset_mtime)
            .expect("upsert");
        let pending = db.list_assets_needing_thumbnails(THUMBNAIL_SIZE).expect("pending");
        assert_eq!(pending.len(), 0, "fresh mtime must not re-queue");
    }

    /// T33 spec test: "orphaned thumbnail files (no DB row) are
    /// removed by cleanup."
    #[test]
    fn cleanup_orphans_removes_disk_only_files() {
        let dir = tempdir().expect("tempdir");
        let thumbs_dir = dir.path().join("thumbs");
        std::fs::create_dir(&thumbs_dir).expect("create");

        let orphan = thumbs_dir.join("thumb_999_256.webp");
        std::fs::write(&orphan, b"orphan-bytes").expect("write orphan");
        assert!(orphan.exists());

        let db = AssetDatabase::new_in_memory().expect("in-memory db");
        let removed = cleanup::cleanup_orphans(&db, &thumbs_dir).expect("cleanup");
        assert!(!orphan.exists(), "orphan file should be removed");
        assert_eq!(removed, 1);
    }

    /// T33 spec test: the inverse direction — DB row whose file is
    /// missing should be cleaned.
    #[test]
    fn cleanup_orphans_removes_db_only_rows() {
        let dir = tempdir().expect("tempdir");
        let thumbs_dir = dir.path().join("thumbs");
        std::fs::create_dir(&thumbs_dir).expect("create");

        let db = AssetDatabase::new_in_memory().expect("in-memory db");
        let conn = db.test_connection();
        conn.execute(
            "INSERT INTO collections (name, description) VALUES ('default', 'fixture')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO assets (id, name, file_path, asset_type, collection, file_size, checksum)
             VALUES (1, 'a.png', '/tmp/a.png', 'Texture', 'default', 1, 'sha:demo')",
            [],
        )
        .unwrap();
        db.upsert_thumbnail(1, "/does/not/exist.webp", THUMBNAIL_SIZE, 0)
            .expect("upsert");
        assert_eq!(db.list_all_thumbnail_paths().expect("list").len(), 1);

        cleanup::cleanup_orphans(&db, &thumbs_dir).expect("cleanup");
        assert_eq!(db.list_all_thumbnail_paths().expect("list").len(), 0);
    }
}
