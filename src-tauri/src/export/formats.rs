use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[expect(
    clippy::upper_case_acronyms,
    reason = "JSON, RON, GLTF, FBX are well-known format acronyms; renaming breaks public API"
)]
pub enum ExportFormat {
    JSON,
    RON,
    RustCode,
    GLTF,
    FBX,
}

impl fmt::Display for ExportFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::JSON => "JSON",
            Self::RON => "RON",
            Self::RustCode => "RustCode",
            Self::GLTF => "GLTF",
            Self::FBX => "FBX",
        };
        f.write_str(s)
    }
}

#[allow(dead_code)]
impl ExportFormat {
    pub const fn file_extension(&self) -> &'static str {
        match self {
            Self::JSON => "json",
            Self::RON => "ron",
            Self::RustCode => "rs",
            Self::GLTF => "gltf",
            Self::FBX => "fbx",
        }
    }

    pub const fn description(&self) -> &'static str {
        match self {
            Self::JSON => "Universal JSON format for any engine",
            Self::RON => "Rust Object Notation - native Bevy format",
            Self::RustCode => "Generated Rust code for direct integration",
            Self::GLTF => "glTF 2.0 format with PBR materials",
            Self::FBX => "Autodesk FBX format for 3D software",
        }
    }

    pub const fn supports_materials() -> bool {
        true
    }

    pub const fn supports_animations(&self) -> bool {
        match self {
            Self::GLTF | Self::FBX => true,
            Self::JSON | Self::RON | Self::RustCode => false,
        }
    }
}
