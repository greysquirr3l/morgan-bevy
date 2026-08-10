// T33 + T93 — audio thumbnail rendering.
//
// T33 shipped WAV-only via the `hound` crate. T93 extends coverage
// to MP3, OGG Vorbis, and FLAC via `symphonia` (pure Rust) and
// routes every audio format through the shared waveform renderer
// in `waveform.rs`. The peak-vs-time plot is byte-identical
// regardless of source format — what changes is the decoder.
//
// Decode failure for any format falls back to the labelled
// placeholder (so an unreadable MP3 doesn't sink the queue).

use std::path::Path;

use symphonia::core::audio::conv::ConvertibleSample;
use symphonia::core::codecs::audio::AudioDecoderOptions;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, TrackType};
use symphonia::core::io::{MediaSourceStream, MediaSourceStreamOptions};
use symphonia::core::meta::MetadataOptions;

use super::placeholder::render_placeholder;
use super::waveform::render_waveform_from_samples;

pub enum AudioRenderResult {
    /// Real waveform PNG ready to encode.
    Waveform(image::RgbImage),
    /// Format unsupported or decode failed — caller should fall
    /// back to `render_placeholder` with a label that names the
    /// format.
    UnsupportedFormat,
}

/// Render an audio file's waveform.
///
/// - WAV: `hound` decode (i16 PCM), downmix to mono, normalise to
///   f32, render.
/// - MP3 / OGG / FLAC: `symphonia` decode (any sample format the
///   decoder supports), downmix to mono, normalise, render.
/// - Anything else: `UnsupportedFormat` so the queue can label it.
pub fn render_audio(source: &Path) -> AudioRenderResult {
    let Some(ext) = source.extension().and_then(|e| e.to_str()) else {
        return AudioRenderResult::UnsupportedFormat;
    };
    match ext.to_ascii_lowercase().as_str() {
        "wav" => render_wav(source),
        "mp3" | "ogg" | "flac" => render_via_symphonia(source),
        _ => AudioRenderResult::UnsupportedFormat,
    }
}

/// Render a WAV file's waveform via `hound`.
fn render_wav(source: &Path) -> AudioRenderResult {
    let Ok(mut reader) = hound::WavReader::open(source) else {
        return AudioRenderResult::UnsupportedFormat;
    };

    let spec = reader.spec();
    let channels = spec.channels.max(1) as usize;
    let bits_raw = i32::from(spec.bits_per_sample);
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

    let mono: Vec<f32> = if channels > 1 {
        samples
            .chunks(channels)
            .map(|c| {
                let sum: i32 = c.iter().map(|s| i32::from(*s)).sum();
                // `channels is spec.channels (typically ≤ 8)`; the
                // usize→i32 narrowing is exact on every realistic
                // WAV file. `cast_possible_truncation` covers
                // 64-bit-pointer targets; `cast_possible_wrap`
                // covers 32-bit-pointer targets. Both are safe at
                // the channel counts a WAV can hold.
                #[expect(
                    clippy::cast_possible_truncation,
                    reason = "channels is spec.channels (typically ≤ 8); the usize→i32 narrowing is safe"
                )]
                #[expect(
                    clippy::cast_possible_wrap,
                    reason = "channels is spec.channels (typically ≤ 8); the usize→i32 narrowing is safe on 32-bit targets"
                )]
                let count = c.len() as i32;
                #[expect(
                    clippy::cast_precision_loss,
                    reason = "sum is the integer sum of i16 samples divided by channel count; f32 mantissa is fine"
                )]
                let avg = (sum as f32 / count as f32) / max;
                avg.clamp(-1.0, 1.0)
            })
            .collect()
    } else {
        samples
            .iter()
            .map(|s| {
                // `f32::from(i16) / max` is exact — both are ≤ 2^15
                // and f32's mantissa covers that range; the
                // `cast_precision_loss` lint doesn't fire here.
                let v = f32::from(*s) / max;
                v.clamp(-1.0, 1.0)
            })
            .collect()
    };

    AudioRenderResult::Waveform(render_waveform_from_samples(&mono))
}

/// Decode MP3 / OGG / FLAC via `symphonia` and render a waveform.
///
/// Symphonia 0.6: `Probe::probe` returns `Result<Box<dyn
/// FormatReader>>` directly (no `ProbeResult` enum). `next_packet`
/// returns `Result<Option<Packet>>` — `Ok(None)` is the EOF
/// signal. `decoder.decode` returns
/// `Result<GenericAudioBufferRef<'_>>`; `copy_to_slice_interleaved`
/// pulls the samples out in interleaved f32 order, handling the
/// sample-format conversion (F32/S16/S24/etc. all → f32).
fn render_via_symphonia(source: &Path) -> AudioRenderResult {
    let Ok(file) = std::fs::File::open(source) else {
        return AudioRenderResult::UnsupportedFormat;
    };
    let mss = MediaSourceStream::new(Box::new(file), MediaSourceStreamOptions::default());
    let mut hint = Hint::new();
    if let Some(ext) = source.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let Ok(mut probed) = symphonia::default::get_probe().probe(
        &hint,
        mss,
        FormatOptions::default(),
        MetadataOptions::default(),
    ) else {
        return AudioRenderResult::UnsupportedFormat;
    };
    let format: &mut Box<dyn symphonia::core::formats::FormatReader> = &mut probed;

    let Some(track) = format.default_track(TrackType::Audio) else {
        return AudioRenderResult::UnsupportedFormat;
    };
    let Some(audio_params) = track.codec_params.as_ref().and_then(|p| p.audio()) else {
        return AudioRenderResult::UnsupportedFormat;
    };

    let Ok(mut decoder) = symphonia::default::get_codecs()
        .make_audio_decoder(audio_params, &AudioDecoderOptions::default())
    else {
        return AudioRenderResult::UnsupportedFormat;
    };

    let track_id = track.id;

    let mut mono: Vec<f32> = Vec::new();
    loop {
        let Ok(packet_opt) = format.next_packet() else {
            return AudioRenderResult::UnsupportedFormat;
        };
        let Some(packet) = packet_opt else { break };
        if packet.track_id != track_id {
            continue;
        }
        let Ok(decoded_buf) = decoder.decode(&packet) else {
            return AudioRenderResult::UnsupportedFormat;
        };
        let frames = decoded_buf.frames();
        if frames == 0 {
            continue;
        }
        let channels = decoded_buf.spec().channels().count();
        let total = frames * channels;
        let mut interleaved: Vec<f32> = vec![0.0_f32; total];
        // `copy_to_slice_interleaved<Sout, Dst>` requires Sout:
        // ConvertibleSample and Dst: AsMut<[Sout]>.
        decoded_buf.copy_to_slice_interleaved::<f32, _>(&mut interleaved[..]);
        // Downmix to mono by averaging channels.
        for frame in interleaved.chunks(channels) {
            let mut sum = 0.0_f32;
            for s in frame {
                sum += *s;
            }
            #[expect(
                clippy::cast_precision_loss,
                reason = "channels is small (≤ 8); f32 mantissa handles the division exactly"
            )]
            let avg = sum / channels as f32;
            mono.push(avg.clamp(-1.0, 1.0));
        }
    }
    if mono.is_empty() {
        return AudioRenderResult::UnsupportedFormat;
    }
    AudioRenderResult::Waveform(render_waveform_from_samples(&mono))
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

// `ConvertibleSample` is re-exported through `audio::conv` for the
// `copy_to_slice_interleaved::<f32, _>(...)` call above. The import
// keeps it visible to `cargo doc` + the wiring audit.
#[allow(unused_imports)]
use ConvertibleSample as _;
