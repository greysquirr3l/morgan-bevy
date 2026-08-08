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
    match source.extension().and_then(|e| e.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("wav") => {}
        _ => return AudioRenderResult::UnsupportedFormat,
    }

    let mut reader = match hound::WavReader::open(source) {
        Ok(r) => r,
        Err(_) => return AudioRenderResult::UnsupportedFormat,
    };

    let spec = reader.spec();
    let channels = spec.channels.max(1) as usize;
    let bits = spec.bits_per_sample as i32;
    let max = (1i32 << (bits - 1).max(0)) as f32;

    let samples: Vec<i16> = match reader.samples::<i16>().collect::<Result<Vec<_>, _>>() {
        Ok(s) => s,
        Err(_) => return AudioRenderResult::UnsupportedFormat,
    };
    if samples.is_empty() {
        return AudioRenderResult::UnsupportedFormat;
    }

    let samples = if channels > 1 {
        // Downmix to mono by averaging the channels.
        samples
            .chunks(channels)
            .map(|c| {
                let sum: i32 = c.iter().map(|s| *s as i32).sum();
                (sum / c.len() as i32) as i16
            })
            .collect()
    } else {
        samples
    };

    let width = THUMBNAIL_SIZE;
    let height = THUMBNAIL_SIZE;
    let samples_per_pixel = (samples.len() / width as usize).max(1);
    let mid = (height / 2) as i32;

    let mut img = image::RgbImage::new(width, height);
    let bg = image::Rgb([33, 33, 33]);
    let bar = image::Rgb([0, 200, 200]);

    for (x, _) in (0..width).enumerate() {
        let x_u = x as u32;
        let start = x * samples_per_pixel;
        let end = ((x + 1) * samples_per_pixel).min(samples.len());
        if start >= end {
            continue;
        }
        let mut peak = 0f32;
        for s in &samples[start..end] {
            let v = (*s as f32) / max;
            if v.abs() > peak.abs() {
                peak = v;
            }
        }
        let h = (peak.abs() * (mid as f32 - 1.0)).round() as i32;
        for dy in -h..=h {
            let y = mid + dy;
            if y >= 0 && y < height as i32 {
                img.put_pixel(x_u, y as u32, bar);
            }
        }
    }
    // Background fill — drawn after the waveform so every pixel is
    // defined, which the WebP encoder prefers.
    for y in 0..height {
        for x in 0..width {
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
                .map(|e| e.to_ascii_uppercase())
                .unwrap_or_else(|| "Audio".to_string());
            render_placeholder(&label, "audio")
        }
    }
}
