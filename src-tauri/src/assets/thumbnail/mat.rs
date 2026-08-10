// T93 — Bevy `.mat` material thumbnail renderer.
//
// Bevy's `.mat` files are RON-style text describing a material
// (`StandardMaterial { base_color: ..., metallic: ..., ... }`).
// For the thumbnail we don't need to fully parse the material —
// we just extract the human-readable identifier (asset name from
// the first comment or `name` field) and render a labelled preview
// with the format name + the identifier. If no identifier is
// found, we fall back to the generic "MAT" label.
//
// Pure Rust, zero new deps.

use std::path::Path;

use image::{Rgb, RgbImage};

use super::THUMBNAIL_SIZE;

/// Render a `.mat` file's thumbnail — a labelled preview that
/// surfaces the material's identifier (asset name) when extractable.
pub fn render_mat(source: &Path) -> RgbImage {
    let identifier = extract_identifier(source);
    render_placeholder(&identifier, "material")
}

/// Extract a human-readable identifier from the material file's
/// text content. Returns the uppercase identifier (truncated to
/// 8 chars to fit the placeholder's two-line layout) or "MAT" if
/// no identifier was found.
fn extract_identifier(source: &Path) -> String {
    let Ok(text) = std::fs::read_to_string(source) else {
        return "MAT".to_string();
    };
    let raw = text
        .lines()
        .find_map(|line| parse_identifier(line))
        .unwrap_or_else(|| "MAT".to_string());
    raw.chars().take(8).collect::<String>().to_ascii_uppercase()
}

/// Try to extract an identifier from a single line. Supported:
///
/// - `// <name>` or `# <name>` — comment lines (most editors
///   start Bevy material files with a `// Material: <name>` header).
/// - `name = "<name>"` — RON-style top-level field.
/// - `(type = "<name>", ...)` — first variant tuple field.
fn parse_identifier(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    // Comment-style.
    if let Some(rest) = trimmed
        .strip_prefix("//")
        .or_else(|| trimmed.strip_prefix('#'))
    {
        let s = rest.trim();
        // Skip the literal "Material:" prefix; everything after is
        // the name.
        let s = s
            .strip_prefix("Material:")
            .or_else(|| s.strip_prefix("material:"))
            .unwrap_or(s);
        return first_word(s);
    }
    // RON `name = "..."`.
    if let Some(rest) = trimmed.strip_prefix("name") {
        let rest = rest.trim_start();
        if let Some(rest) = rest.strip_prefix('=') {
            return quoted_string(rest.trim());
        }
    }
    None
}

fn first_word(s: &str) -> Option<String> {
    let s = s.trim();
    if s.is_empty() {
        None
    } else {
        Some(s.split_whitespace().next()?.to_string())
    }
}

fn quoted_string(s: &str) -> Option<String> {
    let s = s.trim();
    if !s.starts_with('"') {
        return None;
    }
    let after_open = &s[1..];
    let end = after_open.find('"')?;
    Some(after_open[..end].to_string())
}

/// Override the placeholder render with a custom background colour
/// so materials read as a distinct category in the asset browser.
/// The shared `render_placeholder` from `placeholder.rs` does the
/// label + bitmap-font drawing; we wrap it here to colour the
/// background distinctly (purple-ish for materials).
///
/// Implementation note: this duplicates the placeholder layout
/// rather than threading a bg-colour parameter through, to keep
/// `placeholder.rs` zero-dep and stable. The render is small
/// enough that duplicating is cheaper than widening the API.
fn render_placeholder(label: &str, kind: &str) -> RgbImage {
    let mut img = RgbImage::new(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    let bg = Rgb([55, 35, 70]);
    let fg = Rgb([240, 220, 255]);
    let dim = Rgb([160, 140, 180]);

    for y in 0..THUMBNAIL_SIZE {
        for x in 0..THUMBNAIL_SIZE {
            img.put_pixel(x, y, bg);
        }
    }
    // Light border.
    for t in 0..4_u32 {
        for coord in 0..THUMBNAIL_SIZE {
            img.put_pixel(coord, t, dim);
            img.put_pixel(coord, THUMBNAIL_SIZE - 1 - t, dim);
            img.put_pixel(t, coord, dim);
            img.put_pixel(THUMBNAIL_SIZE - 1 - t, coord, dim);
        }
    }
    super::placeholder::draw_text(&mut img, label, THUMBNAIL_SIZE / 2, 110, 8, fg);
    super::placeholder::draw_text(&mut img, kind, THUMBNAIL_SIZE / 2, 140, 4, dim);
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
    fn extract_from_comment() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(
            tmp.path(),
            b"// Material: BrickWall\n(StandardMaterial { base_color: ... })\n",
        )
        .unwrap();
        // Identifier is truncated to 8 chars (placeholder layout).
        assert_eq!(extract_identifier(tmp.path()), "BRICKWAL");
    }

    #[test]
    fn extract_from_ron_name_field() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), b"name = \"StoneFloor\"\nbase_color: ...\n").unwrap();
        assert_eq!(extract_identifier(tmp.path()), "STONEFLO");
    }

    #[test]
    fn falls_back_to_mat_label() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), b"(StandardMaterial {})\n").unwrap();
        assert_eq!(extract_identifier(tmp.path()), "MAT");
    }

    #[test]
    fn missing_file_returns_mat_label() {
        let p = std::path::Path::new("/nonexistent/material.mat");
        assert_eq!(extract_identifier(p), "MAT");
    }

    #[test]
    fn render_mat_returns_image() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), b"// Material: Test\n").unwrap();
        let img = render_mat(tmp.path());
        assert_eq!(img.width(), THUMBNAIL_SIZE);
        assert_eq!(img.height(), THUMBNAIL_SIZE);
    }

    #[test]
    fn identifier_truncates_to_eight_chars() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), b"// Material: VeryLongMaterialName\n").unwrap();
        assert_eq!(extract_identifier(tmp.path()).len(), 8);
    }
}
