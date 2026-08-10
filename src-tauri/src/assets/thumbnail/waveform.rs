// T93 — shared waveform renderer.
//
// Extracted from `audio.rs` so every audio format (WAV via hound,
// MP3/OGG/FLAC via symphonia) feeds the same peak-vs-time render.
// The function takes a normalised `&[f32]` in `[-1, 1]` — callers
// are responsible for downmix + normalise before calling.
//
// Pure: no I/O, no allocation outside the returned `RgbImage`.

use image::{Rgb, RgbImage};

use super::THUMBNAIL_SIZE;

/// Render a peak-vs-time waveform from normalised mono samples in
/// `[-1, 1]`. The output is a `THUMBNAIL_SIZE` square dark-grey
/// image with a saturated teal waveform drawn bilaterally around the
/// vertical midline. Empty input produces a flat dark-grey square.
pub fn render_waveform_from_samples(samples: &[f32]) -> RgbImage {
    let img_width = THUMBNAIL_SIZE;
    let img_height = THUMBNAIL_SIZE;
    let bg = Rgb([33, 33, 33]);
    let bar = Rgb([0, 200, 200]);

    let mut img = RgbImage::from_pixel(img_width, img_height, bg);

    if samples.is_empty() {
        return img;
    }

    let samples_per_pixel = (samples.len() / img_width as usize).max(1);
    #[expect(
        clippy::cast_possible_wrap,
        reason = "img_height is THUMBNAIL_SIZE (≤ 256); the u32→i32 down-cast is lossless"
    )]
    let mid = (img_height / 2) as i32;
    #[expect(
        clippy::cast_possible_wrap,
        reason = "img_height is THUMBNAIL_SIZE (≤ 256); the u32→i32 down-cast is lossless"
    )]
    let height_i32 = img_height as i32;

    for x in 0..img_width as usize {
        #[expect(
            clippy::cast_possible_truncation,
            reason = "x is in [0, img_width) where img_width ≤ THUMBNAIL_SIZE; the usize→u32 narrowing is safe"
        )]
        let x_u = x as u32;
        let start = x * samples_per_pixel;
        let end = ((x + 1) * samples_per_pixel).min(samples.len());
        if start >= end {
            continue;
        }
        let mut peak = 0f32;
        for s in samples.get(start..end).unwrap_or(&[]) {
            if s.abs() > peak.abs() {
                peak = *s;
            }
        }
        // mid ≤ 128 and peak.abs() ≤ 1.0; the f32→i32 round-trip
        // gives the integer y-offset for the waveform.
        #[expect(
            clippy::cast_possible_truncation,
            clippy::cast_precision_loss,
            reason = "mid ≤ 128 and peak.abs() ≤ 1.0; the f32→i32 narrowing is intentional (pixel offset)"
        )]
        let h = (peak.abs() * (mid as f32 - 1.0)).round() as i32;
        for dy in -h..=h {
            let y = mid + dy;
            if y >= 0 && y < height_i32 {
                #[expect(
                    clippy::cast_sign_loss,
                    reason = "y is bounded to [0, height_i32) by the if-check above"
                )]
                let y_u32 = y as u32;
                img.put_pixel(x_u, y_u32, bar);
            }
        }
    }
    img
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

    #[test]
    fn empty_input_produces_flat_square() {
        let img = render_waveform_from_samples(&[]);
        assert_eq!(img.width(), THUMBNAIL_SIZE);
        assert_eq!(img.height(), THUMBNAIL_SIZE);
        // All pixels are the background colour.
        let bg = Rgb([33, 33, 33]);
        assert!(img.pixels().all(|p| *p == bg));
    }

    #[test]
    fn silence_produces_only_midline() {
        // All-zero samples: peak.abs() == 0, so only y == mid gets
        // a waveform pixel; everything else is background.
        let samples = vec![0.0_f32; THUMBNAIL_SIZE as usize * 4];
        let img = render_waveform_from_samples(&samples);
        let bg = Rgb([33, 33, 33]);
        let bar = Rgb([0, 200, 200]);
        // The midline row at y = 128 should have waveform pixels.
        let mid = THUMBNAIL_SIZE / 2;
        let mut has_bar = false;
        for x in 0..img.width() {
            if *img.get_pixel(x, mid) == bar {
                has_bar = true;
                break;
            }
        }
        assert!(has_bar, "silence should still draw the midline");
        // The corner should be background.
        assert_eq!(*img.get_pixel(0, 0), bg);
    }

    #[test]
    fn loud_signal_fills_vertical_range() {
        // Full-scale square wave: every column should have a tall
        // waveform extending well above and below the midline.
        let samples = vec![1.0_f32; THUMBNAIL_SIZE as usize * 4];
        let img = render_waveform_from_samples(&samples);
        let bar = Rgb([0, 200, 200]);
        // At x = THUMBNAIL_SIZE / 2, the bar should span at least
        // half the image vertically (loud signal → wide peak).
        let x = THUMBNAIL_SIZE / 2;
        let mut bar_rows = 0_u32;
        for y in 0..img.height() {
            if *img.get_pixel(x, y) == bar {
                bar_rows = bar_rows.saturating_add(1);
            }
        }
        assert!(
            bar_rows > THUMBNAIL_SIZE / 4,
            "loud signal should span >25% of vertical range; got {bar_rows} rows"
        );
    }
}
