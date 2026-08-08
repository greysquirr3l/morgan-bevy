// T35 — Asset import pipeline.
//
// Import settings (per-project, stored on `ProjectData.metadata.importSettings`):
//   - texture_max_size: 0 = no resize, otherwise the longest edge
//     after compression. The spec's "4K → 1K" example maps to 1024.
//   - texture_quality: WebP quality 0..100. Default 80.
//   - skip_invalid: if true, corrupt inputs are skipped rather than
//     aborting the batch. The default is false so a corrupt file
//     halts the import — easier to debug.
//
// v1 scope:
//   - Texture pipeline only: validate by magic-byte, optionally
//     resize, encode as WebP, write to `cache_dir`.
//   - Validation by magic-byte for PNG, JPEG, WebP, and FBX so the
//     "corrupt header → skip" path is exercised end-to-end.
//   - Audio / model conversion deferred (would need a real
//     FBX→GLTF pipeline + audio encoder; bigger lift than T35 v1).
//
// Originals are preserved by design: this pipeline writes to a
// caller-supplied cache directory, never touches the source files
// on disk. The cache directory lives under `.morgana/imports/` per
// project so multiple projects don't collide.
//
// The conversion step is a chain of { extract → transform → validate }
// stages — extract reads the source via the `image` crate (PNG /
// JPEG), transform resizes if a max size was requested, validate
// re-checks the magic byte of the produced WebP.

use std::path::{Path, PathBuf};

use image::{imageops::FilterType, GenericImageView};
use log::{info, warn};
use serde::{Deserialize, Serialize};

/// Per-project import settings, persisted on `ProjectData.metadata`
/// under the key `importSettings`. Empty / missing fields fall back
/// to defaults — backwards-compatible with pre-T35 project files.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSettings {
    /// Longest edge after compression. 0 means "no resize."
    #[serde(default)]
    pub texture_max_size: u32,
    /// WebP quality 0..100. Default 80.
    #[serde(default = "default_texture_quality")]
    pub texture_quality: u8,
    /// If true, invalid files are skipped instead of aborting the
    /// batch. Default false (fail-fast is easier to debug).
    #[serde(default)]
    pub skip_invalid: bool,
}

fn default_texture_quality() -> u8 {
    80
}

impl Default for ImportSettings {
    fn default() -> Self {
        Self {
            texture_max_size: 0,
            texture_quality: default_texture_quality(),
            skip_invalid: false,
        }
    }
}

/// One entry in an import batch result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportEntry {
    /// Source path (as supplied by the caller).
    pub source: String,
    /// Final destination — original source if the file was passed
    /// through, or the cache path if a transform was applied.
    pub destination: String,
    /// Optional validation / conversion error.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Aggregate result of a batch import.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ImportResult {
    pub entries: Vec<ImportEntry>,
    /// Count of entries that ran the transform pipeline (vs. passed
    /// through). Surfaced in the UI so the user can confirm the
    /// import actually did work.
    pub transformed: u32,
}

/// Magic-byte check. Returns `Ok(kind)` if the file's first bytes
/// match a known signature, `Err(_)` otherwise. `kind` is a
/// short human label suitable for surfacing in the error path.
pub fn detect_kind(path: &Path) -> Result<&'static str, String> {
    let bytes = std::fs::read(path)
        .map_err(|e| format!("read {}: {e}", path.display()))?;
    if bytes.len() < 12 {
        return Err(format!("file too short: {} bytes", bytes.len()));
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Ok("png");
    }
    // JPEG: FF D8 FF (with SOI marker)
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Ok("jpeg");
    }
    // WebP: RIFF .... WEBP
    if bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Ok("webp");
    }
    // FBX binary: "Kaydara FBX Binary  \x00\x1a\x00"
    if bytes.starts_with(b"Kaydara FBX Binary") {
        return Ok("fbx");
    }
    // FBX ascii: starts with a comment / version line
    if bytes.starts_with(b"; FBX") {
        return Ok("fbx");
    }
    Err(format!("unrecognised magic bytes ({}...)", hex_prefix(&bytes)))
}

fn hex_prefix(bytes: &[u8]) -> String {
    bytes
        .iter()
        .take(8)
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Run the import pipeline over a list of source paths. Each path is
/// validated, optionally transformed (resize + WebP encode), and
/// written to `cache_dir/<basename>.webp`. The original is never
/// touched — `ImportEntry.destination` is the cache path, the
/// source path is preserved in `ImportEntry.source`.
///
/// `progress_cb` (if supplied) is invoked once per file after the
/// entry is processed. The signature matches `ScanProgress` so the
/// Tauri command can surface import progress over the same event
/// channel the scanner uses.
pub fn run_import<F>(
    sources: &[PathBuf],
    settings: &ImportSettings,
    cache_dir: &Path,
    mut progress_cb: Option<F>,
) -> ImportResult
where
    F: FnMut(&str),
{
    if !cache_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(cache_dir) {
            warn!("import: failed to create cache dir {}: {e}", cache_dir.display());
            return ImportResult {
                entries: sources
                    .iter()
                    .map(|s| ImportEntry {
                        source: path_to_string(s),
                        destination: String::new(),
                        error: Some(format!("cache dir creation failed: {e}")),
                    })
                    .collect(),
                transformed: 0,
            };
        }
    }

    let mut entries = Vec::with_capacity(sources.len());
    let mut transformed = 0u32;
    for src in sources {
        let source_str = path_to_string(src);
        if let Some(cb) = progress_cb.as_mut() {
            cb(&source_str);
        }
        let entry = match process_one(src, settings, cache_dir) {
            Ok((dest, did_transform)) => {
                if did_transform {
                    transformed += 1;
                }
                ImportEntry {
                    source: source_str,
                    destination: path_to_string(&dest),
                    error: None,
                }
            }
            Err(e) => {
                if settings.skip_invalid {
                    warn!("import: skipping invalid source {}: {e}", source_str);
                    ImportEntry {
                        source: source_str,
                        destination: String::new(),
                        error: Some(e),
                    }
                } else {
                    info!("import: failing on invalid source {}: {e}", source_str);
                    entries.push(ImportEntry {
                        source: source_str,
                        destination: String::new(),
                        error: Some(e),
                    });
                    break;
                }
            }
        };
        entries.push(entry);
    }
    ImportResult { entries, transformed }
}

fn process_one(
    src: &Path,
    settings: &ImportSettings,
    cache_dir: &Path,
) -> Result<(PathBuf, bool), String> {
    let kind = detect_kind(src)?;
    match kind {
        "png" | "jpeg" | "webp" => {
            // Texture path: read, optionally resize, encode as WebP.
            let img = image::open(src).map_err(|e| format!("decode {kind}: {e}"))?;
            let (w, h) = img.dimensions();
            let max = settings.texture_max_size.max(1) as u32;
            let needs_resize = settings.texture_max_size > 0 && (w > max || h > max);
            let resized = if needs_resize {
                let scale = max as f32 / w.max(h) as f32;
                let target_w = ((w as f32 * scale).round().max(1.0)) as u32;
                let target_h = ((h as f32 * scale).round().max(1.0)) as u32;
                img.resize_exact(target_w, target_h, FilterType::Triangle)
            } else {
                img
            };
            let rgb = if resized.color().has_alpha() {
                let rgba = resized.to_rgba8();
                let mut flat = image::RgbImage::new(rgba.width(), rgba.height());
                for (x, y, p) in rgba.enumerate_pixels() {
                    let a = p.0[3] as f32 / 255.0;
                    flat.put_pixel(
                        x,
                        y,
                        image::Rgb([
                            (p.0[0] as f32 * a).round() as u8,
                            (p.0[1] as f32 * a).round() as u8,
                            (p.0[2] as f32 * a).round() as u8,
                        ]),
                    );
                }
                flat
            } else {
                resized.into_rgb8()
            };
            let (out_w, out_h) = (rgb.width(), rgb.height());
            let raw = rgb.as_raw();
            let encoder = webp::Encoder::from_rgb(raw, out_w, out_h);
            let memory = encoder.encode(settings.texture_quality as f32);
            let bytes = memory.to_vec();

            let dest = cache_dir.join(format!(
                "{}.webp",
                src.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("imported")
            ));
            std::fs::write(&dest, &bytes)
                .map_err(|e| format!("write {}: {e}", dest.display()))?;

            // Validate the produced file's magic byte to confirm
            // the WebP encoder produced a valid output. Belt and
            // braces — the libwebp encoder is solid, but if a
            // caller hands us a malformed source that decode
            // somehow accepts, this catches it.
            let check = std::fs::read(&dest).map_err(|e| format!("re-read: {e}"))?;
            if !(check.starts_with(b"RIFF") && &check[8..12] == b"WEBP") {
                return Err("produced file failed magic-byte re-check".to_string());
            }
            Ok((dest, needs_resize))
        }
        "fbx" => {
            // v1: FBX is passed through with a magic-byte check.
            // The actual FBX → GLTF conversion is deferred (would
            // need assimp or similar). Copying the source to the
            // cache dir is a no-op for the user — the destination
            // is the cache path so the UI shows a consistent
            // location regardless of asset type.
            let dest = cache_dir.join(format!(
                "{}.fbx",
                src.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("imported")
            ));
            std::fs::copy(src, &dest).map_err(|e| format!("copy fbx: {e}"))?;
            Ok((dest, false))
        }
        other => Err(format!("unsupported kind: {other}")),
    }
}

fn path_to_string(p: &Path) -> String {
    p.to_string_lossy().into_owned()
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
    use image::{ImageBuffer, Rgb};
    use std::sync::{Arc, Mutex};
    use tempfile::tempdir;

    /// Write a 4096x4096 RGB PNG to disk. The spec test
    /// "importing a 4K PNG with compression=enabled produces a 1K
    /// WebP" drives this helper.
    fn make_test_png_4k(path: &Path) {
        let img = ImageBuffer::from_fn(4096u32, 4096u32, |x, y| {
            let r = ((x % 256) as u8).wrapping_add(64);
            let g = ((y % 256) as u8).wrapping_add(32);
            let b = (((x.wrapping_add(y)) % 256) as u8).wrapping_add(16);
            Rgb([r, g, b])
        });
        img.save(path).expect("save 4k png");
    }

    fn make_test_jpeg(path: &Path) {
        let img = ImageBuffer::from_fn(64u32, 64u32, |x, _| Rgb([x as u8, 128, 200]));
        img.save(path).expect("save jpeg");
    }

    fn make_corrupt_png(path: &Path) {
        // Valid length but garbage magic bytes.
        std::fs::write(path, b"NOT A REAL PNG BUT LONG ENOUGH").expect("write");
    }

    fn make_test_fbx(path: &Path) {
        // FBX binary magic: "Kaydara FBX Binary  \x00\x1a\x00".
        let mut bytes = b"Kaydara FBX Binary  ".to_vec();
        bytes.extend_from_slice(&[0x00, 0x1a, 0x00]);
        bytes.extend_from_slice(&[0u8; 32]); // pad
        std::fs::write(path, &bytes).expect("write fbx");
    }

    #[test]
    fn detect_kind_recognises_known_formats() {
        let dir = tempdir().expect("tempdir");
        let png = dir.path().join("a.png");
        let jpeg = dir.path().join("b.jpg");
        let fbx = dir.path().join("c.fbx");
        make_test_png_4k(&png);
        make_test_jpeg(&jpeg);
        make_test_fbx(&fbx);
        assert_eq!(detect_kind(&png).unwrap(), "png");
        assert_eq!(detect_kind(&jpeg).unwrap(), "jpeg");
        assert_eq!(detect_kind(&fbx).unwrap(), "fbx");
    }

    #[test]
    fn detect_kind_rejects_corrupt_files() {
        let dir = tempdir().expect("tempdir");
        let bad = dir.path().join("bad.png");
        make_corrupt_png(&bad);
        assert!(detect_kind(&bad).is_err());
    }

    /// Spec test: "importing a 4K PNG with compression=enabled
    /// produces a 1K WebP."
    #[test]
    fn four_k_png_resizes_to_1k_webp() {
        let dir = tempdir().expect("tempdir");
        let cache = dir.path().join("cache");
        let src = dir.path().join("big.png");
        make_test_png_4k(&src);

        let settings = ImportSettings {
            texture_max_size: 1024,
            ..Default::default()
        };
        let result = run_import(&[src.clone()], &settings, &cache, None::<fn(&str)>);
        assert_eq!(result.entries.len(), 1);
        assert!(result.entries[0].error.is_none());

        let dest = std::path::PathBuf::from(result.entries[0].destination.clone());
        assert!(dest.exists());
        // The produced file is a valid WebP.
        let bytes = std::fs::read(&dest).expect("read webp");
        assert!(bytes.starts_with(b"RIFF"));
        assert_eq!(&bytes[8..12], b"WEBP");

        // The dimensions are at most 1024 on the longest edge.
        // Re-decode via the image crate to confirm.
        let decoded = image::open(&dest).expect("decode produced webp");
        let (w, h) = (decoded.width(), decoded.height());
        assert!(w <= 1024 && h <= 1024);
        assert_eq!(result.transformed, 1);
    }

    #[test]
    fn no_resize_when_max_size_is_zero() {
        let dir = tempdir().expect("tempdir");
        let cache = dir.path().join("cache");
        let src = dir.path().join("any.png");
        make_test_png_4k(&src);

        let settings = ImportSettings::default(); // max_size == 0
        let result = run_import(&[src.clone()], &settings, &cache, None::<fn(&str)>);
        assert_eq!(result.transformed, 0, "no-resize path should not count as transformed");
        assert!(result.entries[0].error.is_none());
        let decoded = image::open(&result.entries[0].destination).expect("decode");
        // Original 4K stays 4K.
        assert!(decoded.width() >= 1024);
    }

    #[test]
    fn skip_invalid_swallows_bad_input_and_continues() {
        let dir = tempdir().expect("tempdir");
        let cache = dir.path().join("cache");
        let good = dir.path().join("good.png");
        let bad = dir.path().join("bad.png");
        make_test_png_4k(&good);
        make_corrupt_png(&bad);

        let settings = ImportSettings {
            texture_max_size: 1024,
            skip_invalid: true,
            ..Default::default()
        };
        let result = run_import(
            &[good.clone(), bad.clone()],
            &settings,
            &cache,
            None::<fn(&str)>,
        );
        assert_eq!(result.entries.len(), 2);
        assert!(result.entries[0].error.is_none());
        assert!(result.entries[1].error.is_some());
    }

    #[test]
    fn fail_fast_aborts_batch_on_invalid_when_skip_invalid_is_false() {
        let dir = tempdir().expect("tempdir");
        let cache = dir.path().join("cache");
        let bad = dir.path().join("bad.png");
        let next = dir.path().join("next.png");
        make_corrupt_png(&bad);
        make_test_png_4k(&next);

        let settings = ImportSettings::default(); // skip_invalid == false
        let result = run_import(
            &[bad.clone(), next.clone()],
            &settings,
            &cache,
            None::<fn(&str)>,
        );
        // The corrupt entry is recorded with an error; the batch
        // is then aborted, so the valid `next` entry is NOT in the
        // result.
        assert_eq!(result.entries.len(), 1);
        assert!(result.entries[0].error.is_some());
    }

    #[test]
    fn progress_callback_fires_once_per_source() {
        let dir = tempdir().expect("tempdir");
        let cache = dir.path().join("cache");
        let src = dir.path().join("a.png");
        make_test_png_4k(&src);

        let counter = Arc::new(Mutex::new(0u32));
        let counter_cb = Arc::clone(&counter);
        let settings = ImportSettings::default();
        run_import(
            &[src.clone()],
            &settings,
            &cache,
            Some(move |_: &str| {
                *counter_cb.lock().unwrap() += 1;
            }),
        );
        assert_eq!(*counter.lock().unwrap(), 1);
    }
}