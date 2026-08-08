// T33 — texture thumbnail render.
//
// Pure function: read a PNG / JPEG / JPG from disk, scale down to the
// target edge length, drop the alpha (WebP's lossy mode takes RGB),
// and return a `DynamicImage` ready for the queue to encode as WebP.
//
// The `.to_rgb8()` step is non-trivial: textures without alpha
// (e.g. a JPG) end up as `RgbImage`, while PNGs with transparency
// carry `RgbaImage`. The `image` crate's `DynamicImage` enum covers
// both, but the WebP encoder wants a uniform buffer. Flattening the
// alpha against a black background keeps the visual reasonable for
// previews; the editor never shows transparent thumbnails in the
// asset browser where this matters.

use image::{imageops::FilterType, DynamicImage, GenericImageView, RgbaImage};
use std::path::Path;

use super::THUMBNAIL_SIZE;

/// Encode a thumbnail for the given texture source. Returns
/// `Err(image::ImageError)` on a failed read or unsupported format.
pub fn render_texture(source: &Path) -> Result<DynamicImage, image::ImageError> {
    let img = image::open(source)?;
    let (w, h) = img.dimensions();
    let scale = THUMBNAIL_SIZE as f32 / w.max(h) as f32;
    let target_w = (w as f32 * scale).round().max(1.0) as u32;
    let target_h = (h as f32 * scale).round().max(1.0) as u32;
    let resized = img.resize_exact(target_w, target_h, FilterType::Triangle);
    Ok(flatten_alpha(resized))
}

/// Flatten any alpha channel against a black background and convert
/// to `RgbImage`, wrapped in `DynamicImage` for the queue.
fn flatten_alpha(img: DynamicImage) -> DynamicImage {
    if img.color().has_alpha() {
        let rgba = img.to_rgba8();
        let flat = flatten_rgba_against_black(&rgba);
        DynamicImage::ImageRgb8(flat)
    } else {
        // Already RGB / L / etc. — leave as-is, the WebP encoder
        // picks the right channel layout.
        img
    }
}

fn flatten_rgba_against_black(rgba: &RgbaImage) -> image::RgbImage {
    let (w, h) = rgba.dimensions();
    let mut out = image::RgbImage::new(w, h);
    for (x, y, pixel) in rgba.enumerate_pixels() {
        let [r, g, b, a] = pixel.0;
        let alpha = a as f32 / 255.0;
        let r = (r as f32 * alpha).round() as u8;
        let g = (g as f32 * alpha).round() as u8;
        let b = (b as f32 * alpha).round() as u8;
        out.put_pixel(x, y, image::Rgb([r, g, b]));
    }
    out
}
