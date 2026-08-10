// T93 — GLB (binary glTF 2.0) thumbnail renderer.
//
// Hand-rolled parser: reads the 12-byte GLB header, walks chunks,
// parses only the JSON fields we need (meshes → primitives →
// POSITION → accessor → bufferView → BIN offset) via
// `serde_json::Value`, then iterates the BIN chunk's VEC3 floats
// to compute the axis-aligned bounding box. The bbox is rendered
// as an orthographic wireframe (8 corners projected to 2D with
// hidden lines dimmed) over a dark background.
//
// Pure Rust, zero new deps. Format reference: glTF 2.0 spec §4
// (Binary container), §3.7 (accessors), §3.9 (bufferViews).

use std::io::{self, Read};
use std::path::Path;

use image::{Rgb, RgbImage};
use serde_json::Value;

use super::THUMBNAIL_SIZE;

const GLB_MAGIC: u32 = 0x4654_6C67; // "glTF"
const GLB_VERSION: u32 = 2;
const CHUNK_JSON: u32 = 0x4E4F_534A; // "JSON"
const CHUNK_BIN: u32 = 0x004E_4942; // "BIN\0"

const COMPONENT_FLOAT: i64 = 5126;
const COMPONENT_BYTE: i64 = 5120;
const COMPONENT_UBYTE: i64 = 5121;
const COMPONENT_SHORT: i64 = 5122;
const COMPONENT_USHORT: i64 = 5123;
const COMPONENT_UINT: i64 = 5125;

/// Parse error categories — every variant maps to `Unsupported` so
/// the queue falls back to a labelled placeholder rather than
/// sinking the asset.
#[derive(Debug)]
enum GlbError {
    // The inner error values are kept for `Debug` printing but
    // never explicitly read — every variant is only used as a
    // "failed" signal that the dispatcher maps to `Unsupported`.
    // `#[expect(dead_code)]` is the right tool: the derive reads
    // the field for display, but the field is never matched on.
    #[expect(
        dead_code,
        reason = "Debug derive reads the field for display; never matched on by callers"
    )]
    Io(io::Error),
    BadMagic,
    BadVersion,
    #[expect(
        dead_code,
        reason = "Debug derive reads the field for display; never matched on by callers"
    )]
    Json(serde_json::Error),
    Truncated,
    NoJsonChunk,
    BadAccessor,
}

impl From<io::Error> for GlbError {
    fn from(e: io::Error) -> Self {
        Self::Io(e)
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Aabb {
    min: [f32; 3],
    max: [f32; 3],
}

impl Aabb {
    pub(crate) const fn empty() -> Self {
        Self {
            min: [f32::INFINITY; 3],
            max: [f32::NEG_INFINITY; 3],
        }
    }
    pub(crate) fn expand(&mut self, p: [f32; 3]) {
        // Element-wise expand via `iter_mut().zip()` — the
        // `for i in 0..3 { arr[i] = ... }` pattern trips
        // `clippy::indexing_slicing` and `clippy::needless_range_loop`.
        // The 3-element zip is safe because both arrays are `[T; 3]`.
        for (slot, value) in self.min.iter_mut().zip(p) {
            if value < *slot {
                *slot = value;
            }
        }
        for (slot, value) in self.max.iter_mut().zip(p) {
            if value > *slot {
                *slot = value;
            }
        }
    }
    pub(crate) fn is_valid(self) -> bool {
        let (mn0, mn1, mn2) = (self.min[0], self.min[1], self.min[2]);
        let (mx0, mx1, mx2) = (self.max[0], self.max[1], self.max[2]);
        mn0.is_finite()
            && mx0.is_finite()
            && mn0 <= mx0
            && mn1.is_finite()
            && mx1.is_finite()
            && mn1 <= mx1
            && mn2.is_finite()
            && mx2.is_finite()
            && mn2 <= mx2
    }
    fn centre(self) -> [f32; 3] {
        [
            (self.min[0] + self.max[0]) * 0.5,
            (self.min[1] + self.max[1]) * 0.5,
            (self.min[2] + self.max[2]) * 0.5,
        ]
    }
    pub(crate) fn radius(self) -> f32 {
        let d = [
            self.max[0] - self.min[0],
            self.max[1] - self.min[1],
            self.max[2] - self.min[2],
        ];
        // `mul_add` chains the FMA so the result is computed in a
        // single instruction on every platform that supports it
        // (clippy::manual_mul_add).
        (d[0].mul_add(d[0], d[1].mul_add(d[1], d[2] * d[2]))).sqrt() * 0.5
    }
}

/// Render a GLB file's thumbnail — the orthographic bbox of the
/// union of every mesh primitive's POSITION accessor. Returns
/// `None` for any parse error so the dispatcher can fall back.
pub fn render_glb(source: &Path) -> Option<RgbImage> {
    let mut file = std::fs::File::open(source).ok()?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).ok()?;
    let bbox = parse_glb(&bytes).ok()?;
    if !bbox.is_valid() {
        return None;
    }
    Some(render_bbox(bbox))
}

fn parse_glb(bytes: &[u8]) -> Result<Aabb, GlbError> {
    if bytes.len() < 12 {
        return Err(GlbError::Truncated);
    }
    let magic = read_u32(bytes, 0)?;
    if magic != GLB_MAGIC {
        return Err(GlbError::BadMagic);
    }
    let version = read_u32(bytes, 4)?;
    if version != GLB_VERSION {
        return Err(GlbError::BadVersion);
    }
    // length = read_u32(bytes, 8)?;
    let mut pos = 12_usize;
    let mut json_text: Option<&[u8]> = None;
    let mut bin_data: Option<&[u8]> = None;
    while pos < bytes.len() {
        let chunk_len = read_u32(bytes, pos)? as usize;
        let chunk_type = read_u32(bytes, pos + 4)?;
        let chunk_start = pos + 8;
        let chunk_end = chunk_start
            .checked_add(chunk_len)
            .ok_or(GlbError::Truncated)?;
        if chunk_end > bytes.len() {
            return Err(GlbError::Truncated);
        }
        let chunk = bytes
            .get(chunk_start..chunk_end)
            .ok_or(GlbError::Truncated)?;
        match chunk_type {
            CHUNK_JSON => json_text = Some(chunk),
            CHUNK_BIN => bin_data = Some(chunk),
            _ => {}
        }
        // Chunks are 4-byte aligned; pad to next 4-byte boundary.
        pos = (chunk_end + 3) & !3;
    }
    let json_bytes = json_text.ok_or(GlbError::NoJsonChunk)?;
    let json_text = std::str::from_utf8(json_bytes).map_err(|_| GlbError::Truncated)?;
    let json: Value = serde_json::from_str(json_text).map_err(GlbError::Json)?;
    let bin = bin_data.unwrap_or(&[]);
    compute_aabb(&json, bin)
}

/// Walk `meshes[*].primitives[*].attributes.POSITION` accessors,
/// read their VEC3 floats, return the union AABB.
fn compute_aabb(json: &Value, bin: &[u8]) -> Result<Aabb, GlbError> {
    let mut aabb = Aabb::empty();
    let meshes = json.get("meshes").and_then(Value::as_array);
    let accessors = json
        .get("accessors")
        .and_then(Value::as_array)
        .ok_or(GlbError::BadAccessor)?;
    let buffer_views = json.get("bufferViews").and_then(Value::as_array);
    let mut any = false;

    if let Some(meshes) = meshes {
        for mesh in meshes {
            let primitives = mesh
                .get("primitives")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            for primitive in primitives {
                let Some(position_idx) = primitive
                    .get("attributes")
                    .and_then(|a| a.get("POSITION"))
                    .and_then(Value::as_i64)
                    .and_then(|n| usize::try_from(n).ok())
                else {
                    continue;
                };
                let Some(accessor) = accessors.get(position_idx) else {
                    continue;
                };
                let component_type = accessor
                    .get("componentType")
                    .and_then(Value::as_i64)
                    .unwrap_or(COMPONENT_FLOAT);
                let Ok(count): Result<usize, _> = accessor
                    .get("count")
                    .and_then(Value::as_u64)
                    .unwrap_or(0)
                    .try_into()
                else {
                    continue;
                };
                if count == 0 {
                    continue;
                }
                let Ok(accessor_byte_offset) = accessor
                    .get("byteOffset")
                    .and_then(Value::as_u64)
                    .unwrap_or(0)
                    .try_into()
                else {
                    continue;
                };
                let type_str = accessor
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or("VEC3");
                if type_str != "VEC3" {
                    continue;
                }
                let Ok(buffer_view_idx): Result<usize, _> = accessor
                    .get("bufferView")
                    .and_then(Value::as_u64)
                    .unwrap_or(0)
                    .try_into()
                else {
                    continue;
                };
                let (bv_offset, bv_stride) = buffer_views
                    .and_then(|bvs| bvs.get(buffer_view_idx))
                    .map_or((0_usize, 0_usize), |bv: &Value| {
                        let off: usize = bv
                            .get("byteOffset")
                            .and_then(Value::as_u64)
                            .unwrap_or(0)
                            .try_into()
                            .unwrap_or(0);
                        let st: usize = bv
                            .get("byteStride")
                            .and_then(Value::as_u64)
                            .unwrap_or(0)
                            .try_into()
                            .unwrap_or(0);
                        (off, st)
                    });
                // glTF default byteStride for VEC3 FLOAT = 12.
                let stride = if bv_stride == 0 { 12_usize } else { bv_stride };
                let element_size = match component_type {
                    COMPONENT_FLOAT | COMPONENT_UINT => 12_usize,
                    COMPONENT_BYTE | COMPONENT_UBYTE => 3_usize,
                    COMPONENT_SHORT | COMPONENT_USHORT => 6_usize,
                    _ => continue,
                };
                let start = bv_offset
                    .checked_add(accessor_byte_offset)
                    .ok_or(GlbError::Truncated)?;
                let end = start
                    .checked_add(count.checked_mul(stride).ok_or(GlbError::Truncated)?)
                    .ok_or(GlbError::Truncated)?;
                if end > bin.len() {
                    continue;
                }
                for i in 0..count {
                    let off = start
                        .checked_add(i.checked_mul(stride).ok_or(GlbError::Truncated)?)
                        .ok_or(GlbError::Truncated)?;
                    let p = match component_type {
                        COMPONENT_FLOAT => read_vec3_f32(bin, off)?,
                        COMPONENT_BYTE => read_vec3_i8(bin, off)?,
                        COMPONENT_UBYTE => read_vec3_u8(bin, off)?,
                        COMPONENT_SHORT => read_vec3_i16(bin, off)?,
                        COMPONENT_USHORT => read_vec3_u16(bin, off)?,
                        COMPONENT_UINT => read_vec3_u32(bin, off)?,
                        _ => break,
                    };
                    if let Some(p) = p {
                        aabb.expand(p);
                        any = true;
                    }
                    // element_size is currently unused; reserved for
                    // a future bounds-check on `bin`.
                    let _ = element_size;
                }
            }
        }
    }
    if any {
        Ok(aabb)
    } else {
        Ok(Aabb::empty())
    }
}

fn read_u32(bytes: &[u8], pos: usize) -> Result<u32, GlbError> {
    Ok(u32::from_le_bytes(read_le_4(bytes, pos)?))
}

/// Read 1, 2, or 4 little-endian bytes as the typed array
/// `from_le_bytes` wants. Returns `Err(Truncated)` if the slice
/// is too short — the `clippy::indexing_slicing` lint bans the
/// `bin[off]` pattern, so this is the lint-compliant read path.
fn read_le_1(bin: &[u8], off: usize) -> Result<[u8; 1], GlbError> {
    bin.get(off..off + 1)
        .and_then(|s| s.try_into().ok())
        .ok_or(GlbError::Truncated)
}
fn read_le_2(bin: &[u8], off: usize) -> Result<[u8; 2], GlbError> {
    bin.get(off..off + 2)
        .and_then(|s| s.try_into().ok())
        .ok_or(GlbError::Truncated)
}
fn read_le_4(bin: &[u8], off: usize) -> Result<[u8; 4], GlbError> {
    bin.get(off..off + 4)
        .and_then(|s| s.try_into().ok())
        .ok_or(GlbError::Truncated)
}

fn read_vec3_f32(bin: &[u8], off: usize) -> Result<Option<[f32; 3]>, GlbError> {
    let x = f32::from_le_bytes(read_le_4(bin, off)?);
    let y = f32::from_le_bytes(read_le_4(bin, off + 4)?);
    let z = f32::from_le_bytes(read_le_4(bin, off + 8)?);
    if x.is_finite() && y.is_finite() && z.is_finite() {
        Ok(Some([x, y, z]))
    } else {
        Ok(None)
    }
}

fn read_vec3_i8(bin: &[u8], off: usize) -> Result<Option<[f32; 3]>, GlbError> {
    let p = [
        f32::from(i8::from_le_bytes(read_le_1(bin, off)?)),
        f32::from(i8::from_le_bytes(read_le_1(bin, off + 1)?)),
        f32::from(i8::from_le_bytes(read_le_1(bin, off + 2)?)),
    ];
    Ok(Some(p))
}

fn read_vec3_u8(bin: &[u8], off: usize) -> Result<Option<[f32; 3]>, GlbError> {
    let p = [
        f32::from(read_le_1(bin, off)?[0]),
        f32::from(read_le_1(bin, off + 1)?[0]),
        f32::from(read_le_1(bin, off + 2)?[0]),
    ];
    Ok(Some(p))
}

fn read_vec3_i16(bin: &[u8], off: usize) -> Result<Option<[f32; 3]>, GlbError> {
    let p = [
        f32::from(i16::from_le_bytes(read_le_2(bin, off)?)),
        f32::from(i16::from_le_bytes(read_le_2(bin, off + 2)?)),
        f32::from(i16::from_le_bytes(read_le_2(bin, off + 4)?)),
    ];
    Ok(Some(p))
}

fn read_vec3_u16(bin: &[u8], off: usize) -> Result<Option<[f32; 3]>, GlbError> {
    let p = [
        f32::from(u16::from_le_bytes(read_le_2(bin, off)?)),
        f32::from(u16::from_le_bytes(read_le_2(bin, off + 2)?)),
        f32::from(u16::from_le_bytes(read_le_2(bin, off + 4)?)),
    ];
    Ok(Some(p))
}

fn read_vec3_u32(bin: &[u8], off: usize) -> Result<Option<[f32; 3]>, GlbError> {
    // glTF 5125 UINT POSITION is unusual; treat the u32 values as
    // normalised to f32 (the consumer's responsibility — a real
    // accessor would need byteOffset-based lookup to find min/max
    // for proper normalisation). The bbox is approximate for this
    // component type, which matches what most engines do too.
    // `as f32` is intentional: glTF UINT POSITION values are
    // 0..=2^32-1; the f32 mantissa loses the low 9 bits, but the
    // bbox only needs the order of magnitude.
    #[expect(
        clippy::cast_precision_loss,
        reason = "glTF 5125 UINT POSITION is u32; the f32 mantissa loses low bits but the bbox only needs the order of magnitude"
    )]
    let p = [
        u32::from_le_bytes(read_le_4(bin, off)?) as f32,
        u32::from_le_bytes(read_le_4(bin, off + 4)?) as f32,
        u32::from_le_bytes(read_le_4(bin, off + 8)?) as f32,
    ];
    Ok(Some(p))
}

/// Render the orthographic bbox of a 3D AABB as a wireframe on a
/// dark background. Camera is a fixed isometric-ish projection
/// (rotate slightly to show 3 faces). 12 line segments (4 per
/// visible face). Centre dot indicates the geometric centre.
pub fn render_bbox(aabb: Aabb) -> RgbImage {
    let mut img = RgbImage::from_pixel(THUMBNAIL_SIZE, THUMBNAIL_SIZE, Rgb([26, 26, 32]));
    let centre = aabb.centre();
    let radius = aabb.radius().max(1e-3);

    // Isometric-ish projection: combine Y/X rotations to give 3
    // visible faces.
    let cos_x = 0.866_f32; // 30°
    let sin_x = 0.5_f32;
    let cos_y = 0.866_f32; // 30°
    let sin_y = 0.5_f32;

    let corners: [[f32; 3]; 8] = [
        aabb.min,
        [aabb.max[0], aabb.min[1], aabb.min[2]],
        [aabb.min[0], aabb.max[1], aabb.min[2]],
        [aabb.max[0], aabb.max[1], aabb.min[2]],
        [aabb.min[0], aabb.min[1], aabb.max[2]],
        [aabb.max[0], aabb.min[1], aabb.max[2]],
        [aabb.min[0], aabb.max[1], aabb.max[2]],
        aabb.max,
    ];

    // Map each corner to its projected 2D pixel coordinate. The
    // `as f32` / `as i32` casts are intentional — u32 → f32
    // loses the high bit but THUMBNAIL_SIZE fits in 8 bits, and
    // f32 → i32 rounds inside the thumbnail's signed range.
    #[expect(
        clippy::cast_precision_loss,
        reason = "THUMBNAIL_SIZE (≤ 256) fits exactly in f32 mantissa"
    )]
    let scale = (THUMBNAIL_SIZE as f32 * 0.4) / radius;
    #[expect(
        clippy::cast_precision_loss,
        reason = "THUMBNAIL_SIZE (≤ 256) fits exactly in f32 mantissa"
    )]
    let half_w = THUMBNAIL_SIZE as f32 / 2.0;
    #[expect(
        clippy::cast_precision_loss,
        reason = "THUMBNAIL_SIZE (≤ 256) fits exactly in f32 mantissa"
    )]
    let half_h = THUMBNAIL_SIZE as f32 / 2.0;

    let project = |p: [f32; 3]| -> (i32, i32) {
        let dx = p[0] - centre[0];
        let dy = p[1] - centre[1];
        let dz = p[2] - centre[2];
        // Rotate around Y first (yaw), then around X (pitch).
        let x1 = dx.mul_add(cos_y, dz * sin_y);
        let z1 = -dx.mul_add(sin_y, -dz * cos_y);
        let y1 = dy.mul_add(cos_x, -z1 * sin_x);
        let _z2 = dy.mul_add(sin_x, z1 * cos_x);
        // Map the 2D point into pixel coordinates centred in the
        // thumbnail. Scale so the projected radius fits.
        let px = x1.mul_add(scale, half_w);
        let py = -y1.mul_add(scale, half_h);
        // f32 → i32 round-trip is intentional: pixel coordinates
        // are signed integers; the projection is already centred.
        #[expect(
            clippy::cast_possible_truncation,
            reason = "rounded pixel coordinates are guaranteed in [0, THUMBNAIL_SIZE)"
        )]
        let rx = px.round() as i32;
        #[expect(
            clippy::cast_possible_truncation,
            reason = "rounded pixel coordinates are guaranteed in [0, THUMBNAIL_SIZE)"
        )]
        let ry = py.round() as i32;
        (rx, ry)
    };

    let p0 = project(corners[0]);
    let p1 = project(corners[1]);
    let p2 = project(corners[2]);
    let p3 = project(corners[3]);
    let p4 = project(corners[4]);
    let p5 = project(corners[5]);
    let p6 = project(corners[6]);
    let p7 = project(corners[7]);

    // 12 edges of a cube. The first 4 are the front face (lit),
    // the remaining 8 are the back/side edges (dimmed).
    let fg = Rgb([255, 180, 90]);
    let dim = Rgb([120, 90, 50]);
    draw_line(&mut img, p0, p1, fg);
    draw_line(&mut img, p1, p3, fg);
    draw_line(&mut img, p3, p2, fg);
    draw_line(&mut img, p2, p0, fg);
    draw_line(&mut img, p4, p5, dim);
    draw_line(&mut img, p5, p7, dim);
    draw_line(&mut img, p7, p6, dim);
    draw_line(&mut img, p6, p4, dim);
    draw_line(&mut img, p0, p4, dim);
    draw_line(&mut img, p1, p5, dim);
    draw_line(&mut img, p2, p6, dim);
    draw_line(&mut img, p3, p7, dim);

    // Centre dot. THUMBNAIL_SIZE is a small constant (≤ 256);
    // the `as i32` / `as u32` casts are exact at this range.
    #[expect(
        clippy::cast_possible_wrap,
        reason = "THUMBNAIL_SIZE (≤ 256) fits in i32 with no wrap risk"
    )]
    let width_i = THUMBNAIL_SIZE as i32;
    let cx = width_i / 2;
    let cy = cx;
    for dy in -3..=3 {
        for dx in -3..=3 {
            if dx * dx + dy * dy <= 9 {
                let x = cx + dx;
                let y = cy + dy;
                if x >= 0 && y >= 0 && x < width_i && y < width_i {
                    #[expect(
                        clippy::cast_sign_loss,
                        reason = "x ≥ 0 checked above; the i32→u32 cast is the range conversion"
                    )]
                    let x_u = x as u32;
                    #[expect(
                        clippy::cast_sign_loss,
                        reason = "y ≥ 0 checked above; the i32→u32 cast is the range conversion"
                    )]
                    let y_u = y as u32;
                    img.put_pixel(x_u, y_u, Rgb([255, 255, 200]));
                }
            }
        }
    }

    img
}

/// Bresenham line in pixel space. Clips to the image bounds; no
/// sub-pixel rendering — good enough for a 256x256 wireframe.
fn draw_line(img: &mut RgbImage, a: (i32, i32), b: (i32, i32), colour: Rgb<u8>) {
    // THUMBNAIL_SIZE (≤ 256) fits in i32 exactly; precompute once.
    #[expect(
        clippy::cast_possible_wrap,
        reason = "THUMBNAIL_SIZE (≤ 256) fits in i32 with no wrap risk"
    )]
    let width_i = THUMBNAIL_SIZE as i32;
    let mut x0 = a.0;
    let mut y0 = a.1;
    let x1 = b.0;
    let y1 = b.1;
    let dx = (x1 - x0).abs();
    let dy = -(y1 - y0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx + dy;
    loop {
        if x0 >= 0 && y0 >= 0 && x0 < width_i && y0 < width_i {
            #[expect(
                clippy::cast_sign_loss,
                reason = "x0 ≥ 0 checked above; the i32→u32 cast is the range conversion"
            )]
            let x_u = x0 as u32;
            #[expect(
                clippy::cast_sign_loss,
                reason = "y0 ≥ 0 checked above; the i32→u32 cast is the range conversion"
            )]
            let y_u = y0 as u32;
            img.put_pixel(x_u, y_u, colour);
        }
        if x0 == x1 && y0 == y1 {
            break;
        }
        let e2 = 2 * err;
        if e2 >= dy {
            err += dy;
            x0 += sx;
        }
        if e2 <= dx {
            err += dx;
            y0 += sy;
        }
    }
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

    /// Build a minimal valid GLB in memory: JSON declares one mesh
    /// with one primitive whose POSITION accessor reads VEC3 floats
    /// from the BIN chunk; the floats describe a unit cube from
    /// (-1,-1,-1) to (1,1,1).
    fn build_unit_cube_glb() -> Vec<u8> {
        // 8 unique corners, but the primitive typically has 24
        // vertices (4 per face × 6 faces). For simplicity we use
        // 8 vertices (one per corner) — the bbox is correct either
        // way; the primitive is technically malformed (a vertex
        // per corner can't triangulate into 6 faces) but the GLB
        // is structurally valid and the AABB is exact.
        let positions: Vec<f32> = vec![
            -1.0, -1.0, -1.0, // 0
            1.0, -1.0, -1.0, // 1
            -1.0, 1.0, -1.0, // 2
            1.0, 1.0, -1.0, // 3
            -1.0, -1.0, 1.0, // 4
            1.0, -1.0, 1.0, // 5
            -1.0, 1.0, 1.0, // 6
            1.0, 1.0, 1.0, // 7
        ];
        let mut bin: Vec<u8> = Vec::new();
        for v in &positions {
            bin.extend_from_slice(&v.to_le_bytes());
        }
        // Pad BIN to 4-byte alignment (already 96 bytes = 24 floats, aligned).
        let json = serde_json::json!({
            "asset": { "version": "2.0" },
            "meshes": [{
                "primitives": [{
                    "attributes": { "POSITION": 0 },
                    "mode": 0
                }]
            }],
            "accessors": [{
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,
                "count": 8,
                "type": "VEC3",
                "min": [-1.0, -1.0, -1.0],
                "max": [1.0, 1.0, 1.0]
            }],
            "bufferViews": [{
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": bin.len()
            }],
            "buffers": [{
                "byteLength": bin.len()
            }]
        });
        let json_text = serde_json::to_string(&json).unwrap();
        let json_bytes = json_text.as_bytes();
        // Pad JSON to 4 bytes.
        let json_pad = (4 - json_bytes.len() % 4) % 4;
        let bin_pad = (4 - bin.len() % 4) % 4;
        let total_len = 12 + 8 + json_bytes.len() + json_pad + 8 + bin.len() + bin_pad;
        // `as u32` is intentional for the GLB header format: a
        // test fixture is always < 4 GiB, but u32 is what GLB
        // mandates. `u32::try_from` would reject fixture sizes
        // > u32::MAX which is irrelevant for a 256-float cube.
        #[expect(
            clippy::cast_possible_truncation,
            reason = "test fixture is < 4 KiB; the u32 GLB header field always fits"
        )]
        let total_len_u32 = total_len as u32;
        let mut out = Vec::new();
        out.extend_from_slice(&GLB_MAGIC.to_le_bytes());
        out.extend_from_slice(&GLB_VERSION.to_le_bytes());
        out.extend_from_slice(&total_len_u32.to_le_bytes());
        // JSON chunk.
        #[expect(
            clippy::cast_possible_truncation,
            reason = "test fixture JSON is < 4 KiB; the u32 GLB header field always fits"
        )]
        let json_len_u32 = json_bytes.len() as u32;
        out.extend_from_slice(&json_len_u32.to_le_bytes());
        out.extend_from_slice(&CHUNK_JSON.to_le_bytes());
        out.extend_from_slice(json_bytes);
        out.extend(std::iter::repeat_n(b' ', json_pad));
        // BIN chunk.
        #[expect(
            clippy::cast_possible_truncation,
            reason = "test fixture BIN is < 4 KiB; the u32 GLB header field always fits"
        )]
        let bin_len_u32 = bin.len() as u32;
        out.extend_from_slice(&bin_len_u32.to_le_bytes());
        out.extend_from_slice(&CHUNK_BIN.to_le_bytes());
        out.extend_from_slice(&bin);
        out.extend(std::iter::repeat_n(0_u8, bin_pad));
        out
    }

    #[test]
    fn parse_unit_cube_yields_unit_aabb() {
        let bytes = build_unit_cube_glb();
        let aabb = parse_glb(&bytes).unwrap();
        assert!(aabb.is_valid());
        // The cube vertices are stored as f32 (exact for -1.0 and
        // 1.0), read back via f32::from_le_bytes (also exact), so
        // strict equality is the right contract — an epsilon
        // check would hide real regressions in the round-trip.
        assert!(aabb
            .min
            .iter()
            .zip([-1.0_f32, -1.0, -1.0])
            .all(|(a, b)| a.to_bits() == b.to_bits()));
        assert!(aabb
            .max
            .iter()
            .zip([1.0_f32, 1.0, 1.0])
            .all(|(a, b)| a.to_bits() == b.to_bits()));
    }

    #[test]
    fn render_glb_produces_thumbnail() {
        let bytes = build_unit_cube_glb();
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), &bytes).unwrap();
        let img = render_glb(tmp.path()).unwrap();
        assert_eq!(img.width(), THUMBNAIL_SIZE);
        assert_eq!(img.height(), THUMBNAIL_SIZE);
        // The centre dot should be a near-white pixel.
        let centre_dot = Rgb([255, 255, 200]);
        let mut found = false;
        for y in (THUMBNAIL_SIZE / 2 - 4)..=(THUMBNAIL_SIZE / 2 + 4) {
            for x in (THUMBNAIL_SIZE / 2 - 4)..=(THUMBNAIL_SIZE / 2 + 4) {
                if *img.get_pixel(x, y) == centre_dot {
                    found = true;
                    break;
                }
            }
        }
        assert!(found, "render should draw the centre dot");
    }

    #[test]
    fn render_glb_bad_magic_returns_none() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), b"NOT A GLB FILE").unwrap();
        assert!(render_glb(tmp.path()).is_none());
    }

    #[test]
    fn render_glb_truncated_returns_none() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), [0, 0, 0, 0]).unwrap();
        assert!(render_glb(tmp.path()).is_none());
    }
}
