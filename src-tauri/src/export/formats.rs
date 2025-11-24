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
    pub fn file_extension(&self) -> &'static str {
        match self {
            ExportFormat::JSON => "json",
            ExportFormat::RON => "ron",
            ExportFormat::RustCode => "rs",
            ExportFormat::GLTF => "gltf",
            ExportFormat::FBX => "fbx",
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            ExportFormat::JSON => "Universal JSON format for any engine",
            ExportFormat::RON => "Rust Object Notation - native Bevy format",
            ExportFormat::RustCode => "Generated Rust code for direct integration",
            ExportFormat::GLTF => "glTF 2.0 format with PBR materials",
            ExportFormat::FBX => "Autodesk FBX format for 3D software",
        }
    }

    pub fn supports_materials(&self) -> bool {
        match self {
            ExportFormat::JSON => true,
            ExportFormat::RON => true,
            ExportFormat::RustCode => true,
            ExportFormat::GLTF => true,
            ExportFormat::FBX => true,
        }
    }

    pub fn supports_animations(&self) -> bool {
        match self {
            ExportFormat::JSON => false,
            ExportFormat::RON => false,
            ExportFormat::RustCode => false,
            ExportFormat::GLTF => true,
            ExportFormat::FBX => true,
        }
    }
}
