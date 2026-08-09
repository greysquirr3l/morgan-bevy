// T33 — audio waveform thumbnail render.
//
// WAV-only. The `hound` crate decodes standard PCM WAV files; mp3
// and ogg require a Rust decoder (e.g. `minimp3` / `lewton`) which
// we deliberately do not pull in for v1 — those formats get a
// labelled placeholder image from `placeholder.rs` instead, signed
// via `render_audio_placeholder`.
//
// The waveform is a centered peak-vs-time plot: every sample's
// amplitude is the height of a vertical bar, drawn bilaterally
// around the vertical midline. Background is dark grey; the bars
// are a saturated teal so an empty section of the asset browser
// still reads as "audio".

use std::path::Path;

use super::placeholder::render_placeholder;
use super::THUMBNAIL_SIZE;

pub enum AudioRenderResult {
    /// Real waveform PNG ready to encode.
    Waveform(image::RgbImage),
    /// Format unsupported (mp3 / ogg) — caller should fall back to
    /// `render_placeholder` with a label that names the format.
    UnsupportedFormat,
}

/// Render a WAV file's waveform. Returns `UnsupportedFormat` for any
/// non-WAV extension so the queue can fall back to a placeholder.
pub fn render_audio(source: &Path) -> AudioRenderResult {
    let Some(ext) = source.extension().and_then(|e| e.to_str()) else {
        return AudioRenderResult::UnsupportedFormat;
    };
    if !ext.eq_ignore_ascii_case("wav") {
        return AudioRenderResult::UnsupportedFormat;
    }

    let Ok(mut reader) = hound::WavReader::open(source) else {
        return AudioRenderResult::UnsupportedFormat;
    };

    let spec = reader.spec();
    let channels = spec.channels.max(1) as usize;
    let bits_raw = i32::from(spec.bits_per_sample);
    // WAV sample values are signed i16 with the magnitude scale 2^(bits-1);
    // we clamp bits to a sane upper bound (i16 range) before shifting so a
    // malformed header claiming 256 bits cannot shift UB. Anything outside
    // [1, 16] is rejected as an unsupported format rather than silently
    // producing a mis-scaled waveform.
    let safe_bits = if (1..=16).contains(&bits_raw) {
        bits_raw
    } else {
        return AudioRenderResult::UnsupportedFormat;
    };
    #[expect(
        clippy::cast_precision_loss,
        reason = "max is in the range 2^0..=2^15 (≤32768); f32 mantissa (24 bits) handles these exactly"
    )]
    let max = (1i32 << (safe_bits - 1)) as f32;

    let samples: Vec<i16> = match reader.samples::<i16>().collect::<Result<Vec<_>, _>>() {
        Ok(s) => s,
        Err(_) => return AudioRenderResult::UnsupportedFormat,
    };
    if samples.is_empty() {
        return AudioRenderResult::UnsupportedFormat;
    }

    let samples = if channels > 1 {
        // Downmix to mono by averaging the channels. i32 arithmetic
        // guards against i16 overflow on summation; the result is
        // truncated back to i16 by the per-channel count divisor.
        samples
            .chunks(channels)
            .map(|c| {
                let sum: i32 = c.iter().map(|s| i32::from(*s)).sum();
                #[expect(
                    clippy::cast_possible_truncation,
                    clippy::cast_possible_wrap,
                    reason = "channels is spec.channels (typically ≤ 8 for stereo WAV); the usize→i32 narrowing is safe on 32+ bit targets"
                )]
                let count = c.len() as i32;
                let avg = sum / count;
                #[expect(
                    clippy::cast_possible_truncation,
                    reason = "avg is the mean of i16 samples divided by their count, so it fits in i16 by construction"
                )]
                let result = avg as i16;
                result
            })
            .collect()
    } else {
        samples
    };

    let img_width = THUMBNAIL_SIZE;
    let img_height = THUMBNAIL_SIZE;
    let samples_per_pixel = (samples.len() / img_width as usize).max(1);
    #[expect(
        clippy::cast_possible_wrap,
        reason = "img_height is THUMBNAIL_SIZE (small u32, e.g. 256); the u32→i32 down-cast is lossless for values ≤ i32::MAX"
    )]
    let mid = (img_height / 2) as i32;
    #[expect(
        clippy::cast_possible_wrap,
        reason = "img_height is THUMBNAIL_SIZE (small u32, e.g. 256); the u32→i32 down-cast is lossless for values ≤ i32::MAX"
    )]
    let height_i32 = img_height as i32;

    let mut img = image::RgbImage::new(img_width, img_height);
    let bg = image::Rgb([33, 33, 33]);
    let bar = image::Rgb([0, 200, 200]);

    for x in 0..img_width as usize {
        #[expect(
            clippy::cast_possible_truncation,
            reason = "x is in [0, img_width) where img_width ≤ THUMBNAIL_SIZE (small); the usize→u32 narrowing is safe on 32+ bit targets"
        )]
        let x_u = x as u32;
        let start = x * samples_per_pixel;
        let end = ((x + 1) * samples_per_pixel).min(samples.len());
        if start >= end {
            continue;
        }
        let mut peak = 0f32;
        let window = samples.get(start..end).unwrap_or(&[]);
        for s in window {
            let v = f32::from(*s) / max;
            if v.abs() > peak.abs() {
                peak = v;
            }
        }
        // mid ≤ 32 and peak is a normalised amplitude in [-1, 1];
        // the truncated i32 is the integer y-offset for the waveform.
        #[expect(
            clippy::cast_possible_truncation,
            clippy::cast_precision_loss,
            reason = "mid ≤ 32 and peak.abs() ≤ 1.0; the i32→f32 widening is lossless at this range, and the f32→i32 round-trip is intentional (pixel offset)"
        )]
        let h = (peak.abs() * (mid as f32 - 1.0)).round() as i32;
        for dy in -h..=h {
            let y = mid + dy;
            if y >= 0 && y < height_i32 {
                #[expect(
                    clippy::cast_sign_loss,
                    reason = "y is bounded to [0, height_i32) by the if-check above; the i32→u32 cast is the range conversion"
                )]
                let y_u32 = y as u32;
                img.put_pixel(x_u, y_u32, bar);
            }
        }
    }
    // Background fill — drawn after the waveform so every pixel is
    // defined, which the WebP encoder prefers.
    for y in 0..img_height {
        for x in 0..img_width {
            if img.get_pixel(x, y) == &image::Rgb([0, 0, 0]) {
                img.put_pixel(x, y, bg);
            }
        }
    }
    AudioRenderResult::Waveform(img)
}

/// Convenience for the dispatch layer: render or fall back to a
/// labelled placeholder.
pub fn render_audio_or_placeholder(source: &Path) -> image::RgbImage {
    match render_audio(source) {
        AudioRenderResult::Waveform(img) => img,
        AudioRenderResult::UnsupportedFormat => {
            let label = source
                .extension()
                .and_then(|e| e.to_str())
                .map_or_else(|| "Audio".to_string(), str::to_ascii_uppercase);
            render_placeholder(&label, "audio")
        }
    }
}
