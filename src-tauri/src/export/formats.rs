use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    JSON,
    RON,
    RustCode,
    GLTF,
    FBX,
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

    pub const fn supports_materials(&self) -> bool {
        match self {
            Self::JSON => true,
            Self::RON => true,
            Self::RustCode => true,
            Self::GLTF => true,
            Self::FBX => true,
        }
    }

    pub const fn supports_animations(&self) -> bool {
        match self {
            Self::JSON => false,
            Self::RON => false,
            Self::RustCode => false,
            Self::GLTF => true,
            Self::FBX => true,
        }
    }
}
