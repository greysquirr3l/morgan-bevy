// T33 — placeholder thumbnail render.
//
// Used for asset types the pipeline can't decode: mp3 / ogg audio,
// FBX models, MAT materials. The output is a 256x256 PNG with a dark
// background, a label naming the format, and a hint ("audio" /
// "model" / "material") so the asset browser still gives the user a
// visual cue without spending a Node child process on a real model
// render.

use image::{Rgb, RgbImage};

use super::THUMBNAIL_SIZE;

/// Render a labelled placeholder thumbnail. `label` is the format
/// extension (e.g. "FBX", "MP3"); `kind` is the larger category
/// ("audio", "model", "material").
pub fn render_placeholder(label: &str, kind: &str) -> RgbImage {
    let mut img = RgbImage::new(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    let bg = Rgb([40, 40, 50]);
    let fg = Rgb([220, 220, 220]);
    let dim = Rgb([140, 140, 160]);

    // Solid background.
    for y in 0..THUMBNAIL_SIZE {
        for x in 0..THUMBNAIL_SIZE {
            img.put_pixel(x, y, bg);
        }
    }

    // Light border frame so the placeholder is visually distinct
    // from a real thumbnail.
    draw_border(&mut img, 4, dim);

    // Two centred text lines: label (large) and kind (small).
    draw_text(&mut img, label, THUMBNAIL_SIZE / 2, 110, 8, fg);
    draw_text(&mut img, kind, THUMBNAIL_SIZE / 2, 140, 4, dim);

    img
}

/// Draw a 1-pixel-wide rectangle border around the image.
fn draw_border(img: &mut RgbImage, thickness: u32, color: Rgb<u8>) {
    for t in 0..thickness {
        for coord in 0..THUMBNAIL_SIZE {
            img.put_pixel(coord, t, color);
            img.put_pixel(coord, THUMBNAIL_SIZE - 1 - t, color);
            img.put_pixel(t, coord, color);
            img.put_pixel(THUMBNAIL_SIZE - 1 - t, coord, color);
        }
    }
}

/// Render a 5x7 bitmap font for the 26 uppercase letters + digits +
/// a handful of punctuation. Hand-authored rather than pulling in a
/// font crate to keep the placeholder pipeline zero-dep.
/// Each glyph is a 5-wide x 7-tall bitmap; rows are stored as 5-bit
/// numbers, LSB-left.
fn draw_text(img: &mut RgbImage, text: &str, cx: u32, cy: u32, scale: u32, color: Rgb<u8>) {
    let chars: Vec<char> = text.to_ascii_uppercase().chars().collect();
    let glyph_w = 5 * scale + scale; // 5 columns + 1 column spacing
    let glyph_h = 7 * scale;
    let total_w = chars.len() as u32 * glyph_w;
    let start_x = cx.saturating_sub(total_w / 2);
    let start_y = cy.saturating_sub(glyph_h / 2);

    for (i, ch) in chars.iter().enumerate() {
        let bitmap = glyph(*ch);
        for (row, &bits) in bitmap.iter().enumerate() {
            for col in 0..5 {
                if (bits >> (4 - col)) & 1 == 1 {
                    for dy in 0..scale {
                        for dx in 0..scale {
                            let x = start_x + i as u32 * glyph_w + col * scale + dx;
                            let y = start_y + row as u32 * scale + dy;
                            if x < THUMBNAIL_SIZE && y < THUMBNAIL_SIZE {
                                img.put_pixel(x, y, color);
                            }
                        }
                    }
                }
            }
        }
    }
}

fn glyph(ch: char) -> [u8; 7] {
    match ch {
        'A' => [
            0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001,
        ],
        'B' => [
            0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110,
        ],
        'C' => [
            0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110,
        ],
        'D' => [
            0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100,
        ],
        'E' => [
            0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111,
        ],
        'F' => [
            0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000,
        ],
        'G' => [
            0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110,
        ],
        'H' => [
            0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001,
        ],
        'I' => [
            0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111,
        ],
        'J' => [
            0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100,
        ],
        'K' => [
            0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001,
        ],
        'L' => [
            0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111,
        ],
        'M' => [
            0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001,
        ],
        'N' => [
            0b10001, 0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001,
        ],
        'O' => [
            0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110,
        ],
        'P' => [
            0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000,
        ],
        'Q' => [
            0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101,
        ],
        'R' => [
            0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001,
        ],
        'S' => [
            0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110,
        ],
        'T' => [
            0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100,
        ],
        'U' => [
            0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110,
        ],
        'V' => [
            0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100,
        ],
        'W' => [
            0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010,
        ],
        'X' => [
            0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001,
        ],
        'Y' => [
            0b10001, 0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100,
        ],
        'Z' => [
            0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111,
        ],
        '0' => [
            0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110,
        ],
        '1' => [
            0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110,
        ],
        '2' => [
            0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111,
        ],
        '3' => [
            0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110,
        ],
        '4' => [
            0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010,
        ],
        '5' => [
            0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110,
        ],
        '6' => [
            0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110,
        ],
        '7' => [
            0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000,
        ],
        '8' => [
            0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110,
        ],
        '9' => [
            0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100,
        ],
        '_' => [0, 0, 0, 0, 0, 0, 0b11111],
        '.' => [0, 0, 0, 0, 0, 0, 0b00100],
        '/' => [
            0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000,
        ],
        ' ' => [0, 0, 0, 0, 0, 0, 0],
        _ => [
            0b11111, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11111,
        ],
    }
}
