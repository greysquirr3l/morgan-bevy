// T93 — FBX (binary 7.4 / 7.7+ and ASCII) thumbnail renderer.
//
// Hand-rolled parser that handles both binary FBX 7.4 / 7.5+ and
// the human-readable ASCII variant. The strategy:
//
// - Binary FBX: validate the 23-byte header, walk top-level nodes
//   using the nested `(end_offset, num_children, name, properties,
//   children, sentinel)` structure, descend into `Objects`,
//   descend into each `Geometry` node, read the `Vertices` property
//   (a typed double array), and compute the AABB across every
//   mesh's vertex array. `PolygonVertexIndex` is not needed for
//   the thumbnail — we only want positions.
// - ASCII FBX: scan lines for `Vertices: *N { a: ..., b: ..., ...}`
//   or `Vertices: *N { a: x, b: y, c: z }` patterns and parse the
//   flat list.
//
// Pure Rust, zero new deps. The format reference is the FBX SDK
// help docs (binary layout) and the de-facto ASCII grammar used
// by every DCC tool.

use std::io::Read;
use std::path::Path;

use image::RgbImage;

use super::glb::{render_bbox as render_bbox_from_aabb, Aabb};

/// FBX binary header magic: 20 ASCII bytes (`Kaydara FBX Binary`
/// + two trailing spaces) + 4 zero bytes (per the FBX SDK docs).
const BINARY_HEADER_MAGIC: &[u8; 24] = b"Kaydara FBX Binary  \x00\x00\x00\x00";

/// Render an FBX file's thumbnail — the AABB of every mesh's
/// `Vertices` property. Format is auto-detected from the first
/// byte: `K` (0x4B) is binary; anything else is treated as ASCII.
/// Returns `None` for any parse error so the dispatcher can fall
/// back.
pub fn render_fbx(source: &Path) -> Option<RgbImage> {
    // Read the whole file. The first byte tells us binary vs ASCII.
    let mut bytes = Vec::new();
    std::fs::File::open(source)
        .ok()?
        .read_to_end(&mut bytes)
        .ok()?;
    let aabb = if bytes.first().copied() == Some(b'K') {
        parse_binary(&bytes).ok().unwrap_or_else(Aabb::empty)
    } else {
        parse_ascii(std::str::from_utf8(&bytes).unwrap_or(""))
    };
    if !aabb.is_valid() {
        return None;
    }
    Some(render_bbox_from_aabb(aabb))
}

// ─── Binary FBX ─────────────────────────────────────────────────

#[derive(Debug)]
enum FbxError {
    BadHeader,
    Truncated,
    UnsupportedVersion,
}

struct Cursor<'a> {
    bytes: &'a [u8],
    pos: usize,
    version: u32,
}

impl<'a> Cursor<'a> {
    fn new(bytes: &'a [u8], version: u32) -> Self {
        Self {
            bytes,
            pos: 0,
            version,
        }
    }
    fn remaining(&self) -> usize {
        self.bytes.len().saturating_sub(self.pos)
    }
    fn take(&mut self, n: usize) -> Option<&'a [u8]> {
        let end = self.pos.checked_add(n)?;
        if end > self.bytes.len() {
            return None;
        }
        let slice = &self.bytes[self.pos..end];
        self.pos = end;
        Some(slice)
    }
    fn read_u8(&mut self) -> Option<u8> {
        self.take(1).map(|s| s[0])
    }
    fn read_u32(&mut self) -> Option<u32> {
        let s = self.take(4)?;
        Some(u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
    }
    fn read_u64(&mut self) -> Option<u64> {
        let s = self.take(8)?;
        Some(u64::from_le_bytes([
            s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7],
        ]))
    }
    fn read_offset(&mut self) -> Option<usize> {
        if self.version >= 7500 {
            self.read_u64().map(|v| v as usize)
        } else {
            self.read_u32().map(|v| v as usize)
        }
    }
    fn read_count(&mut self) -> Option<usize> {
        if self.version >= 7500 {
            self.read_u64().map(|v| v as usize)
        } else {
            self.read_u32().map(|v| v as usize)
        }
    }
    fn read_name(&mut self) -> Option<&'a [u8]> {
        let start = self.pos;
        loop {
            let b = self.read_u8()?;
            if b == 0 {
                return Some(&self.bytes[start..self.pos - 1]);
            }
        }
    }
}

fn parse_binary(bytes: &[u8]) -> Result<Aabb, FbxError> {
    if bytes.len() < BINARY_HEADER_MAGIC.len() + 4 {
        return Err(FbxError::Truncated);
    }
    if bytes.len() < BINARY_HEADER_MAGIC.len()
        || &bytes[..BINARY_HEADER_MAGIC.len()] != BINARY_HEADER_MAGIC
    {
        return Err(FbxError::BadHeader);
    }
    let version_offset = BINARY_HEADER_MAGIC.len();
    let version = u32::from_le_bytes([
        bytes[version_offset],
        bytes[version_offset + 1],
        bytes[version_offset + 2],
        bytes[version_offset + 3],
    ]);
    if !(7400..=7999).contains(&version) {
        return Err(FbxError::UnsupportedVersion);
    }
    let mut cur = Cursor::new(bytes, version);
    cur.pos = version_offset + 4;
    let mut aabb = Aabb::empty();
    // Walk top-level nodes until end of file. Each node has an
    // end offset relative to the start of its own end-offset field.
    while cur.remaining() > 0 {
        let node_start = cur.pos;
        let Some(end_offset_rel) = cur.read_offset() else {
            break;
        };
        let Some(num_children) = cur.read_count() else {
            break;
        };
        let Some(_property_len) = cur.read_count() else {
            break;
        };
        let Some(name) = cur.read_name() else {
            break;
        };
        // Compute absolute end: the end_offset is measured from
        // the start of this node's end_offset field (node_start).
        let abs_end = node_start
            .checked_add(end_offset_rel)
            .ok_or(FbxError::Truncated)?;
        if abs_end > bytes.len() {
            // Truncated — bail rather than risk a bogus read.
            break;
        }
        let name_str = std::str::from_utf8(name).unwrap_or("");
        let _ = num_children; // We walk via end-offset, not by count.

        // If this is the `Objects` top-level node, descend and
        // harvest every Geometry's Vertices property.
        if name_str == "Objects" {
            walk_objects_for_vertices(&mut cur, abs_end, &mut aabb)?;
        } else {
            // Skip to end without recursing into properties — we
            // only care about Geometry's Vertices.
            cur.pos = abs_end;
        }
        // FBX 7.4 sentinel is 13 null bytes; 7.5+ is 25. The
        // end_offset already accounts for these; pos should equal
        // abs_end. If it doesn't, fast-forward.
        if cur.pos < abs_end {
            cur.pos = abs_end;
        }
        if cur.pos <= node_start {
            break;
        }
    }
    Ok(aabb)
}

/// Inside the `Objects` node, walk each child; when we find a
/// `Geometry` node, scan its children for `Vertices` and harvest
/// the double array.
fn walk_objects_for_vertices(
    cur: &mut Cursor<'_>,
    objects_end: usize,
    aabb: &mut Aabb,
) -> Result<(), FbxError> {
    while cur.pos < objects_end {
        let node_start = cur.pos;
        let Some(end_offset_rel) = cur.read_offset() else {
            break;
        };
        let Some(num_children) = cur.read_count() else {
            break;
        };
        let Some(property_len) = cur.read_count() else {
            break;
        };
        let Some(name) = cur.read_name() else {
            break;
        };
        let abs_end = node_start
            .checked_add(end_offset_rel)
            .ok_or(FbxError::Truncated)?;
        let name_str = std::str::from_utf8(name).unwrap_or("");
        let _ = num_children;

        if name_str == "Geometry" {
            // Properties (skip — they describe the geometry's type).
            // Property_len is the byte length; skip ahead.
            if cur.pos + property_len > cur.bytes.len() {
                break;
            }
            cur.pos += property_len;
            // Walk this Geometry's children; the one we want is
            // named `Vertices`.
            harvest_vertices_in_subtree(cur, abs_end, aabb)?;
        } else {
            // Skip past this node's content.
            cur.pos = abs_end;
        }
        if cur.pos < abs_end {
            cur.pos = abs_end;
        }
        if cur.pos <= node_start {
            break;
        }
    }
    Ok(())
}

/// Walk a Geometry node's children, looking for `Vertices`. The
/// Vertices property is a typed array of doubles (type code 'd').
fn harvest_vertices_in_subtree(
    cur: &mut Cursor<'_>,
    subtree_end: usize,
    aabb: &mut Aabb,
) -> Result<(), FbxError> {
    while cur.pos < subtree_end {
        let node_start = cur.pos;
        let Some(end_offset_rel) = cur.read_offset() else {
            break;
        };
        let Some(num_children) = cur.read_count() else {
            break;
        };
        let Some(property_len) = cur.read_count() else {
            break;
        };
        let Some(name) = cur.read_name() else {
            break;
        };
        let abs_end = node_start
            .checked_add(end_offset_rel)
            .ok_or(FbxError::Truncated)?;
        let name_str = std::str::from_utf8(name).unwrap_or("");
        let _ = num_children;

        if name_str == "Vertices" {
            // Read the typed-array header. FBX typed arrays begin
            // with a single ASCII char for the element type:
            // 'd' = f64, 'f' = f32, 'i' = i32, 'l' = i64.
            if property_len == 0 {
                cur.pos = abs_end;
                continue;
            }
            if cur.pos + property_len > cur.bytes.len() {
                break;
            }
            // Type code + u32 array length + payload.
            let type_code = cur.read_u8().ok_or(FbxError::Truncated)?;
            let _array_len = cur.read_u32().ok_or(FbxError::Truncated)?;
            // The remaining bytes of the property are the data.
            let data_start = cur.pos;
            let data_end = node_start
                .checked_add(8 + 8 + 8)
                .and_then(|p| p.checked_add(property_len))
                .ok_or(FbxError::Truncated)?;
            if data_end > cur.bytes.len() {
                break;
            }
            let data = &cur.bytes[data_start..data_end];
            if type_code == b'd' {
                expand_aabb_from_doubles(aabb, data);
            }
            // Type codes we don't handle are skipped silently — the
            // AABB stays whatever the other meshes contributed.
            cur.pos = abs_end;
        } else {
            cur.pos = abs_end;
        }
        if cur.pos < abs_end {
            cur.pos = abs_end;
        }
        if cur.pos <= node_start {
            break;
        }
    }
    Ok(())
}

fn expand_aabb_from_doubles(aabb: &mut Aabb, data: &[u8]) {
    // FBX stores Vertices as a flat `x, y, z, x, y, z, ...` array
    // of doubles. We iterate in groups of three doubles (24 bytes).
    // A trailing partial group (corrupt / odd-length buffer) is
    // skipped — better than poisoning the bbox with a NaN.
    let mut i = 0;
    while i + 24 <= data.len() {
        let x = f64::from_le_bytes([
            data[i],
            data[i + 1],
            data[i + 2],
            data[i + 3],
            data[i + 4],
            data[i + 5],
            data[i + 6],
            data[i + 7],
        ]);
        let y = f64::from_le_bytes([
            data[i + 8],
            data[i + 9],
            data[i + 10],
            data[i + 11],
            data[i + 12],
            data[i + 13],
            data[i + 14],
            data[i + 15],
        ]);
        let z = f64::from_le_bytes([
            data[i + 16],
            data[i + 17],
            data[i + 18],
            data[i + 19],
            data[i + 20],
            data[i + 21],
            data[i + 22],
            data[i + 23],
        ]);
        if x.is_finite() && y.is_finite() && z.is_finite() {
            aabb.expand([x as f32, y as f32, z as f32]);
        }
        i += 24;
    }
}

// ─── ASCII FBX ─────────────────────────────────────────────────

fn parse_ascii(text: &str) -> Aabb {
    let mut aabb = Aabb::empty();
    let mut in_vertices = false;
    let mut depth = 0_i32;
    // FBX ASCII Vertices bodies are a flat list of doubles in
    // `x, y, z` triplets. We accumulate scalars into a buffer and
    // pop a triplet whenever the count hits 3.
    let mut vertex_buf: Vec<f32> = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with(';') {
            continue;
        }
        // Detect a `Vertices: *N {` line — opens a flat array.
        // The `strip_prefix` is also the entry point for the
        // inline tuple form `Vertices: a: x, b: y, c: z`.
        if let Some(rest) = trimmed.strip_prefix("Vertices:") {
            let rest = rest.trim();
            if rest.starts_with('*') || rest.contains('{') {
                in_vertices = true;
                depth = 0;
                vertex_buf.clear();
                for ch in rest.chars() {
                    if ch == '{' {
                        depth += 1;
                    } else if ch == '}' {
                        depth -= 1;
                    }
                }
                continue;
            }
            // Inline tuple form: `a: 1.0, b: 2.0, c: 3.0`. The
            // prefix is already stripped, so we feed `rest` to
            // the parser.
            if let Some(p) = parse_inline_vertex(rest) {
                aabb.expand(p);
            }
            continue;
        }
        if in_vertices {
            for ch in trimmed.chars() {
                if ch == '{' {
                    depth += 1;
                } else if ch == '}' {
                    depth -= 1;
                    if depth <= 0 {
                        in_vertices = false;
                        break;
                    }
                }
            }
            for part in trimmed.split(|c: char| c == ',' || c.is_whitespace()) {
                let part = part.trim().trim_end_matches(',');
                if part.is_empty() {
                    continue;
                }
                if let Ok(v) = part.parse::<f64>() {
                    if v.is_finite() {
                        vertex_buf.push(v as f32);
                        if vertex_buf.len() == 3 {
                            let p = [vertex_buf[0], vertex_buf[1], vertex_buf[2]];
                            aabb.expand(p);
                            vertex_buf.clear();
                        }
                    }
                }
            }
            if !in_vertices {
                vertex_buf.clear();
                depth = 0;
            }
        }
    }
    aabb
}

fn parse_inline_vertex(line: &str) -> Option<[f32; 3]> {
    // `Vertices: a: 1.0, b: 2.0, c: 3.0` form. Extract a, b, c.
    let mut a = None;
    let mut b = None;
    let mut c = None;
    for part in line.split(',') {
        let part = part.trim();
        let Some((k, v)) = part.split_once(':') else {
            continue;
        };
        let Ok(v) = v.trim().parse::<f64>() else {
            continue;
        };
        let v = v as f32;
        match k.trim() {
            "a" => a = Some(v),
            "b" => b = Some(v),
            "c" => c = Some(v),
            _ => {}
        }
    }
    match (a, b, c) {
        (Some(a), Some(b), Some(c)) => Some([a, b, c]),
        _ => None,
    }
}

// ─── tests ─────────────────────────────────────────────────────

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
    fn ascii_parse_inline_tuple() {
        let text = "Vertices: a: 1.0, b: 2.0, c: 3.0\n";
        let aabb = parse_ascii(text);
        assert!(aabb.is_valid());
    }

    #[test]
    fn ascii_parse_flat_array() {
        // The flat-array form uses a single Vertices block with
        // three doubles — this matches the typical FBX ASCII export
        // for a single vertex (which is then duplicated per face).
        let text = "Vertices: *3 {\n\ta: 1.0,\n\tb: 2.0,\n\tc: 3.0\n}\n";
        let aabb = parse_ascii(text);
        assert!(aabb.is_valid());
    }

    #[test]
    fn ascii_skips_non_vertices_lines() {
        let text = "; FBX 7.7.0 project file\n\
                    Objects:  {\n\
                        Geometry: 1234567890, \"Geometry::Cube\", \"Mesh\" {\n\
                            Vertices: *3 {\n\
                                a: 0.0,\n\
                                b: 0.0,\n\
                                c: 0.0\n\
                            }\n\
                        }\n\
                    }\n";
        let aabb = parse_ascii(text);
        assert!(aabb.is_valid());
    }

    #[test]
    fn render_fbx_missing_returns_none() {
        let p = std::path::Path::new("/nonexistent/cube.fbx");
        assert!(render_fbx(p).is_none());
    }

    #[test]
    fn render_fbx_ascii_inline() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), b"Vertices: a: 1, b: 2, c: 3\n").unwrap();
        let img = render_fbx(tmp.path()).unwrap();
        assert_eq!(img.width(), 256);
    }

    #[test]
    fn render_fbx_truncated_binary_returns_none() {
        // Only the magic + a partial version — must not panic.
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), &BINARY_HEADER_MAGIC[..]).unwrap();
        assert!(render_fbx(tmp.path()).is_none());
    }
}
