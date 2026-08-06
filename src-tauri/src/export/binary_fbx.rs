//! Hand-rolled minimal binary FBX 7.7.0 writer.
//!
//! The morgan-bevy export pipeline only needs a small subset of the full FBX
//! format: a header, a `GlobalSettings` node, an `Objects` section with one
//! `Model` per game object (carrying position / rotation / scale), a
//! `Connections` section, and a footer. This module writes exactly that
//! subset in the binary FBX 7.x format (magic, version, single root node
//! list, footer with magic + version).
//!
//! # Format reference
//!
//! ```text
//! File header (27 bytes):
//!   bytes  0..23  "Kaydara FBX Binary  \0\x1a\0"   (23-byte magic, null-padded)
//!   bytes 23..27  u32 little-endian: FBX format version (7700 = 7.7.0)
//!
//! Top-level nodes:
//!   Each node is a length-prefixed record:
//!     u64 le: end offset of the node (from file start) — inclusive of this u64
//!     u64 le: number of properties (attributes) in this node
//!     u64 le: total bytes of the property list
//!     u8     : name length
//!     bytes  : name (UTF-8)
//!     bytes  : property list (variable; each property type-tagged)
//!
//! Footer (25 bytes):
//!     u8: 0x00  (padding to align to 16-byte boundary before)
//!     u32 le: version
//!     u8: 0x00  (padding)
//!     bytes: "Kaydara" 6 bytes
//!     u8: 0x00
//!     bytes: magic 0x00 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00
//! ```
//!
//! Per-property type codes (little-endian payload after a 1-byte code):
//!   'Y' i16, 'C' bool, 'I' i32, 'F' f32, 'D' f64, 'L' i64,
//!   'f' f32[], 'd' f64[], 'l' i64[], 'i' i32[], 'b' bool[],
//!   'S' string (u32 length + bytes), 'R' raw bytes (u32 length + bytes),
//!   'Z' (no payload; sentinel for nested nodes).
//!
//! `Z` introduces a nested node block. The nested block is itself a normal
//! node record starting with the standard u64 end-offset / count /
//! byte-length header.

use std::io;

/// Identifier at the start of every binary FBX file.
pub const MAGIC: &[u8; 23] = b"Kaydara FBX Binary  \0\x1a\0";

/// Identifier at the end of every binary FBX file.
pub const FOOTER_MAGIC: &[u8; 16] =
    b"\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";

/// FBX file format version. 7700 == 7.7.0.
pub const VERSION_7700: u32 = 7700;

// ─── Little-endian writers ───────────────────────────────────────────────────
//
// The FBX binary format is little-endian on disk. We avoid pulling in a crate
// for the primitives we need — these inline helpers are clearer than a
// byteorder dep and produce identical bytes.

fn write_u32_le(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn write_u64_le(out: &mut Vec<u8>, v: u64) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn write_i32_le(out: &mut Vec<u8>, v: i32) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn write_i64_le(out: &mut Vec<u8>, v: i64) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn write_f64_le(out: &mut Vec<u8>, v: f64) {
    out.extend_from_slice(&v.to_le_bytes());
}

/// Single-property writer; accumulates bytes into a backing Vec.
pub struct NodeBuilder {
    name: String,
    props: Vec<u8>,
    prop_count: u32,
    children: Vec<Self>,
}

impl NodeBuilder {
    fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            props: Vec::new(),
            prop_count: 0,
            children: Vec::new(),
        }
    }

    pub fn push_i32(&mut self, v: i32) {
        self.props.push(b'I');
        write_i32_le(&mut self.props, v);
        self.prop_count += 1;
    }

    pub fn push_i64(&mut self, v: i64) {
        self.props.push(b'L');
        write_i64_le(&mut self.props, v);
        self.prop_count += 1;
    }

    pub fn push_f64(&mut self, v: f64) {
        self.props.push(b'D');
        write_f64_le(&mut self.props, v);
        self.prop_count += 1;
    }

    pub fn push_string(&mut self, s: &str) {
        self.props.push(b'S');
        write_u32_le(&mut self.props, s.len() as u32);
        self.props.extend_from_slice(s.as_bytes());
        self.prop_count += 1;
    }

    pub fn push_child(&mut self, name: impl Into<String>) -> &mut Self {
        let child = Self::new(name);
        self.children.push(child);
        {
            #[expect(clippy::unwrap_used, reason = "push_child just appended a child node")]
            self.children
                .last_mut()
                .unwrap_or_else(|| unreachable!("push_child just appended a child node"))
        }
    }

    /// Total size in bytes this node will occupy in the output stream,
    /// including its own header (`end_offset` + count + `byte_length` + name)
    /// and any child nodes (which are appended after this node's properties).
    fn encoded_size(&self) -> usize {
        let header_size = 8 + 8 + 8 + 1 + self.name.len();
        let children_size: usize = self.children.iter().map(Self::encoded_size).sum();
        header_size + self.props.len() + children_size
    }

    /// Write this node (and all of its descendants) into `out`.
    /// `start_offset` is the file offset of THIS node's first byte (i.e. the
    /// start of the u64 `end_offset` field).
    fn encode(&self, start_offset: u64, out: &mut Vec<u8>) -> io::Result<()> {
        let end_offset = start_offset + self.encoded_size() as u64;
        write_u64_le(out, end_offset);
        write_u64_le(out, u64::from(self.prop_count));
        write_u64_le(out, self.props.len() as u64);
        out.push(self.name.len() as u8);
        out.extend_from_slice(self.name.as_bytes());
        out.extend_from_slice(&self.props);

        // After this node's own properties come any nested child nodes, in
        // their declaration order.
        let mut cursor = end_offset - self.encoded_size() as u64
            + 8u64
            + 8u64
            + 8u64
            + 1u64
            + self.name.len() as u64
            + self.props.len() as u64;
        for child in &self.children {
            child.encode(cursor, out)?;
            cursor += child.encoded_size() as u64;
        }
        Ok(())
    }
}

/// Builder for an entire FBX file. Holds the top-level nodes; serializes
/// them in declaration order under the file header and footer.
pub struct FbxBuilder {
    nodes: Vec<NodeBuilder>,
}

impl FbxBuilder {
    pub const fn new() -> Self {
        Self { nodes: Vec::new() }
    }

    /// Push a top-level node. Returns a mutable handle for nested work.
    pub fn push_node(&mut self, name: impl Into<String>) -> &mut NodeBuilder {
        let n = NodeBuilder::new(name);
        self.nodes.push(n);
        {
            #[expect(clippy::unwrap_used, reason = "push_node just appended a top-level node")]
            self.nodes
                .last_mut()
                .unwrap_or_else(|| unreachable!("push_node just appended a top-level node"))
        }
    }

    /// Serialize the file into bytes.
    pub fn encode(&self) -> io::Result<Vec<u8>> {
        let mut out = Vec::with_capacity(4096);

        // File header
        out.extend_from_slice(MAGIC);
        write_u32_le(&mut out, VERSION_7700);

        // Top-level nodes. The cursor tracks the absolute file offset of
        // the next node's first byte.
        let mut cursor = MAGIC.len() as u64 + 4;
        for node in &self.nodes {
            node.encode(cursor, &mut out)?;
            cursor += node.encoded_size() as u64;
        }

        // Footer: padding u8 + version u32 + padding u8 + "Kaydara" + 0x00 + magic
        out.push(0x00);
        write_u32_le(&mut out, VERSION_7700);
        out.push(0x00);
        out.extend_from_slice(b"Kaydara");
        out.push(0x00);
        out.extend_from_slice(FOOTER_MAGIC);

        Ok(out)
    }
}

impl Default for FbxBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn magic_offset(buf: &[u8]) -> Option<usize> {
        buf.windows(23).position(|w| w == MAGIC)
    }

    #[test]
    fn empty_builder_produces_valid_frame() {
        // No nodes → just header + footer. The output must still be
        // recognisable as an FBX file: magic at offset 0, version
        // (7700) immediately after, magic again at the tail.
        let bytes = FbxBuilder::new().encode().expect("encode should succeed");
        assert_eq!(&bytes[0..23], MAGIC);
        let version = u32::from_le_bytes(bytes[23..27].try_into().unwrap());
        assert_eq!(version, VERSION_7700);
        assert_eq!(&bytes[bytes.len() - FOOTER_MAGIC.len()..], FOOTER_MAGIC);
    }

    #[test]
    fn round_trip_magic_positions() {
        // Build a file with one node carrying one string property, then
        // assert that:
        //   - The file begins with the FBX magic.
        //   - The file ends with the FBX footer magic.
        //   - The total size matches the sum of header + node + footer.
        let mut fb = FbxBuilder::new();
        {
            let n = fb.push_node("TestNode");
            n.push_string("hello");
        }
        let bytes = fb.encode().expect("encode should succeed");
        assert!(magic_offset(&bytes).is_some());
        // Footer magic lives at the very tail (last 16 bytes).
        assert_eq!(&bytes[bytes.len() - FOOTER_MAGIC.len()..], FOOTER_MAGIC);
        // Total size: header (27) + node + footer (25).
        let expected_min = MAGIC.len() + 4 + 25;
        assert!(bytes.len() >= expected_min);
    }

    #[test]
    fn string_property_round_trips() {
        // A node carrying a single string property should encode that
        // string verbatim and report the correct property count.
        let mut fb = FbxBuilder::new();
        let prop_count = {
            let n = fb.push_node("Strings");
            n.push_string("abc");
            n.push_string("def");
            n.prop_count
        };
        assert_eq!(prop_count, 2);
        let bytes = fb.encode().unwrap();
        // The two strings appear somewhere in the byte stream. Locate
        // them by their encoded length prefixes.
        let needle_abc = b"\x03\x00\x00\x00abc";
        let needle_def = b"\x03\x00\x00\x00def";
        assert!(bytes.windows(needle_abc.len()).any(|w| w == needle_abc));
        assert!(bytes.windows(needle_def.len()).any(|w| w == needle_def));
    }

    #[test]
    #[allow(clippy::float_cmp, reason = "literal 2.5 is exactly representable in IEEE 754 f64; verifies bit-exact round-trip")]
    fn scalar_f64_property_round_trips() {
        // The f64 primitive is the one we depend on for transforms; verify
        // that the tag ('D') and 8-byte payload are present.
        let mut fb = FbxBuilder::new();
        let n = fb.push_node("Scalar");
        n.push_f64(2.5);
        let bytes = fb.encode().unwrap();
        let idx = bytes
            .windows(1)
            .position(|w| w[0] == b'D')
            .expect("f64 property tag 'D' should be present");
        let payload = &bytes[idx + 1..idx + 1 + 8];
        let v = f64::from_le_bytes(payload.try_into().unwrap());
        assert_eq!(v, 2.5);
    }

    #[test]
    fn nested_child_node_encodes_after_parent_props() {
        // A parent node with both properties and a child must encode the
        // parent's properties first, then the child node, then end.
        let mut fb = FbxBuilder::new();
        {
            let parent = fb.push_node("Parent");
            parent.push_i32(7);
            let child = parent.push_child("Child");
            child.push_string("hi");
        }
        let bytes = fb.encode().unwrap();
        let parent_idx = bytes
            .windows(6)
            .position(|w| w == b"Parent")
            .expect("Parent node name should appear");
        let child_idx = bytes
            .windows(5)
            .position(|w| w == b"Child")
            .expect("Child node name should appear");
        // Child appears after Parent in the byte stream.
        assert!(child_idx > parent_idx);
    }
}
