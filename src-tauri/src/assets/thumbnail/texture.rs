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
    // Integer-math scale: target = max(1, round(w * THUMBNAIL_SIZE / max(w,h))).
    // Widening to u64 keeps the multiplication from overflowing even for
    // 32-bit-dimension source images; the final u32 conversion uses
    // `try_from` and propagates a `Result`-shaped error.
    let max_dim = u64::from(w.max(h));
    let target_w = u32::try_from((u64::from(w) * u64::from(THUMBNAIL_SIZE) / max_dim).max(1))
        .map_err(|_| {
            image::ImageError::Parameter(image::error::ParameterError::from_kind(
                image::error::ParameterErrorKind::DimensionMismatch,
            ))
        })?;
    let target_h = u32::try_from((u64::from(h) * u64::from(THUMBNAIL_SIZE) / max_dim).max(1))
        .map_err(|_| {
            image::ImageError::Parameter(image::error::ParameterError::from_kind(
                image::error::ParameterErrorKind::DimensionMismatch,
            ))
        })?;
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
    let (width_px, height_px) = rgba.dimensions();
    let mut out = image::RgbImage::new(width_px, height_px);
    for (col, row, pixel) in rgba.enumerate_pixels() {
        let [red, green, blue, alpha] = pixel.0;
        // Alpha-blend each channel against black using integer math:
        // round(channel * alpha / 255). The `* 255 + 127) / 255 / 255`
        // idiom rounds without going through f32 — `u32::from(u8)` is
        // lossless. The trailing `as u8` is the genuinely-unavoidable
        // integer-narrowing cast (the input is u32 in [0, 65025]).
        let blend_channel = |channel: u8, alpha: u8| -> u8 {
            #[expect(
                clippy::cast_possible_truncation,
                reason = "channel is u8 0..=255 and alpha is u8 0..=255; the numerator fits in u32 (≤65,025), the divisor is 65,025; result is u8 by construction"
            )]
            let result: u8 =
                ((u32::from(channel) * u32::from(alpha) * 255 + 127) / 255 / 255) as u8;
            result
        };
        out.put_pixel(
            col,
            row,
            image::Rgb([
                blend_channel(red, alpha),
                blend_channel(green, alpha),
                blend_channel(blue, alpha),
            ]),
        );
    }
    out
}
