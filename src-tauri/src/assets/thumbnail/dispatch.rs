// T33 + T93 — per-asset-type renderer dispatch.
//
// `render_for_asset` picks the right render function based on the
// asset type the scanner assigned. The result is an `RgbImage` ready
// to encode as WebP. Pure function — no I/O, no DB — so the worker
// task can call it inside `tokio::task::spawn_blocking`.

use image::{DynamicImage, RgbImage};
use std::path::Path;

use super::audio::{render_audio, render_audio_or_placeholder, AudioRenderResult};
use super::fbx::render_fbx;
use super::glb::render_glb;
use super::mat::render_mat;
use super::obj::render_obj;
use super::placeholder::render_placeholder;
use super::texture::render_texture;
use super::THUMBNAIL_SIZE;

/// Render the given asset into a `THUMBNAIL_SIZE` square RGB image.
/// The dispatcher does not perform I/O — the caller has already
/// resolved the source path. Returns `Err` only if the texture
/// decoder reports a hard failure; every other path either
/// succeeds (real render) or falls back to a labelled placeholder.
pub fn render_for_asset(asset_type: &str, source: &Path) -> Result<RgbImage, image::ImageError> {
    let rgb: RgbImage = match asset_type {
        "Texture" => {
            let img = render_texture(source)?;
            img.into_rgb8()
        }
        "Audio" => match render_audio(source) {
            AudioRenderResult::Waveform(img) => img,
            AudioRenderResult::UnsupportedFormat => render_audio_or_placeholder(source),
        },
        // T93: every Model subtype now produces a real bbox
        // preview. The fallback to a labelled placeholder kicks in
        // only when the model file is unreadable / malformed —
        // never by default.
        "Model" => model_renderer(source)
            .unwrap_or_else(|| render_placeholder(&label_for(source), "model")),
        // T93: `.mat` files render a labelled preview that
        // surfaces the asset's identifier. Falls back to a generic
        // "MAT" label if the file is unreadable.
        "Material" => render_mat(source),
        // Anything unknown gets a placeholder with its extension
        // surfaced — better than nothing, surfaces bugs.
        _ => render_placeholder(&label_for(source), "asset"),
    };
    debug_assert_eq!(rgb.width(), THUMBNAIL_SIZE);
    debug_assert_eq!(rgb.height(), THUMBNAIL_SIZE);
    Ok(rgb)
}

/// Pick the model renderer by file extension. Returns `None` on
/// parse failure so the dispatcher can fall back to a placeholder.
fn model_renderer(source: &Path) -> Option<RgbImage> {
    let ext = source.extension().and_then(|e| e.to_str())?;
    match ext.to_ascii_lowercase().as_str() {
        "glb" => render_glb(source),
        "obj" => render_obj(source),
        "fbx" => render_fbx(source),
        // Unknown model extension: no renderer, let the dispatcher
        // label it.
        _ => None,
    }
}

/// The file extension (uppercased) for the placeholder label.
fn label_for(source: &Path) -> String {
    source
        .extension()
        .and_then(|e| e.to_str())
        .map_or_else(|| "?".to_string(), str::to_ascii_uppercase)
}

/// Encode an `RgbImage` as a WebP at the given quality (0..100).
/// The underlying `webp` crate's `encode` is infallible (it always
/// succeeds for valid RGB input — the libwebp FFI returns a
/// `MemoryWriter`, never a `Result`), so this wrapper doesn't need
/// to thread an error type either.
pub fn encode_webp(img: &RgbImage, quality: u8) -> Vec<u8> {
    let (w, h) = (img.width(), img.height());
    let raw = img.as_raw();
    let encoder = webp::Encoder::from_rgb(raw, w, h);
    let memory = encoder.encode(f32::from(quality));
    memory.to_vec()
}

/// Build the wrapped `DynamicImage` for callers that want the
/// higher-level `image` type rather than `RgbImage`. Useful for
/// tests that need to call `DynamicImage::save`.
#[allow(dead_code)]
pub const fn as_dynamic(rgb: RgbImage) -> DynamicImage {
    DynamicImage::ImageRgb8(rgb)
}
