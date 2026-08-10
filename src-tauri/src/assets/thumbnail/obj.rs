// T93 — Wavefront OBJ thumbnail renderer.
//
// Hand-rolled minimal parser: scans lines for `v x y z` (vertex
// position) and computes the AABB. Faces (`f ...`), normals
// (`vn ...`), UVs (`vt ...`), groups, materials, etc. are all
// ignored — for a thumbnail we only need the position range.
//
// Lines starting with `#` are comments. Vertex count can be in
// the millions for high-poly meshes, but we only need to scan
// once and the bbox is O(n) over vertices.
//
// Pure Rust, zero new deps.

use std::io::{BufRead, BufReader};
use std::path::Path;

use image::RgbImage;

use super::glb::{render_bbox as render_bbox_from_aabb, Aabb};

/// Render an OBJ file's thumbnail — the AABB of all `v` lines.
/// Returns `None` for any I/O error so the dispatcher can fall
/// back to a labelled placeholder.
pub fn render_obj(source: &Path) -> Option<RgbImage> {
    let file = std::fs::File::open(source).ok()?;
    let reader = BufReader::new(file);
    let mut aabb = Aabb::empty();
    let mut any = false;
    for line in reader.lines() {
        let Ok(line) = line else { continue };
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        // Vertex line: `v x y z [w]`. We split on whitespace; the
        // first token must be exactly "v".
        let mut tokens = trimmed.split_ascii_whitespace();
        match tokens.next() {
            Some("v") => {
                let x = tokens.next().and_then(|s| s.parse::<f32>().ok());
                let y = tokens.next().and_then(|s| s.parse::<f32>().ok());
                let z = tokens.next().and_then(|s| s.parse::<f32>().ok());
                if let (Some(x), Some(y), Some(z)) = (x, y, z) {
                    if x.is_finite() && y.is_finite() && z.is_finite() {
                        aabb.expand([x, y, z]);
                        any = true;
                    }
                }
            }
            _ => {}
        }
    }
    if !any || !aabb.is_valid() {
        return None;
    }
    Some(render_bbox_from_aabb(aabb))
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
    fn render_obj_unit_cube() {
        let obj = b"\
# unit cube
v -1 -1 -1
v 1 -1 -1
v -1 1 -1
v 1 1 -1
v -1 -1 1
v 1 -1 1
v -1 1 1
v 1 1 1
f 1 2 4 3
f 5 6 8 7
f 1 2 6 5
f 3 4 8 7
f 1 3 7 5
f 2 4 8 6
";
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), obj).unwrap();
        let img = render_obj(tmp.path()).unwrap();
        assert_eq!(img.width(), 256);
        assert_eq!(img.height(), 256);
    }

    #[test]
    fn render_obj_skips_non_vertex_lines() {
        // vn / vt / f / o / g / mtllib should not affect bbox.
        let obj = b"\
# a triangle with normals and UVs
vn 0 0 1
vt 0 0
vt 1 0
vt 0 1
v 0 0 0
v 2 0 0
v 0 3 0
f 1/1/1 2/2/1 3/3/1
o triangle
g group1
mtllib none.mtl
usemtl default
s 1
";
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), obj).unwrap();
        let img = render_obj(tmp.path()).unwrap();
        assert!(img.width() > 0);
    }

    #[test]
    fn render_obj_no_vertices_returns_none() {
        let obj = b"# comment only\n# nothing here\n";
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), obj).unwrap();
        assert!(render_obj(tmp.path()).is_none());
    }

    #[test]
    fn render_obj_nan_vertex_is_ignored() {
        // NaN vertex should be skipped (otherwise bbox becomes
        // poisoned). The other two vertices still produce a valid
        // bbox from (0,0,0) to (1,1,1).
        let obj = b"v 0 0 0\nv 1 1 1\nv nan nan nan\n";
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), obj).unwrap();
        let img = render_obj(tmp.path()).unwrap();
        assert_eq!(img.width(), 256);
    }

    #[test]
    fn render_obj_missing_file_returns_none() {
        let p = std::path::Path::new("/nonexistent/file.obj");
        assert!(render_obj(p).is_none());
    }
}
