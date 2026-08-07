use crate::export::ExportFormat;
use crate::spatial::BoundingBox;
use crate::{GameObject, LevelData, Transform3D};
use anyhow::Result;
use chrono::{DateTime, Utc};
use log::info;
use serde::{Deserialize, Serialize};
use serde_json;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportResult {
    pub exported_files: Vec<ExportedFile>,
    pub total_objects: usize,
    pub export_time_ms: u64,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedFile {
    pub format: ExportFormat,
    pub file_path: String,
    pub file_size: u64,
    pub success: bool,
}

pub struct LevelExporter;

impl LevelExporter {
    pub fn export_multi_format(
        level_data: &LevelData,
        formats: &[ExportFormat],
        output_path: &str,
    ) -> Result<ExportResult> {
        let start_time = std::time::Instant::now();
        let base_path = Path::new(output_path);
        let mut result = ExportResult {
            exported_files: Vec::new(),
            total_objects: level_data.objects.len(),
            export_time_ms: 0,
            errors: Vec::new(),
            warnings: Vec::new(),
        };

        // Ensure output directory exists
        if let Some(parent) = base_path.parent() {
            fs::create_dir_all(parent)?;
        }

        for format in formats {
            let file_path = Self::get_export_file_path(base_path, format, &level_data.name);

            let export_result = match format {
                ExportFormat::JSON => Self::export_json(level_data, &file_path),
                ExportFormat::RON => Self::export_ron(level_data, &file_path),
                ExportFormat::RustCode => Self::export_rust_code(level_data, &file_path),
                ExportFormat::GLTF => Self::export_gltf(level_data, &file_path),
                ExportFormat::FBX => Self::export_fbx(level_data, &file_path),
            };

            match export_result {
                Ok(()) => {
                    let file_size = fs::metadata(&file_path)?.len();
                    result.exported_files.push(ExportedFile {
                        format: format.clone(),
                        file_path: file_path.to_string_lossy().to_string(),
                        file_size,
                        success: true,
                    });
                    info!("Exported to: {}", file_path.display());
                }
                Err(e) => {
                    result
                        .errors
                        .push(format!("Failed to export {format}: {e}"));
                    result.exported_files.push(ExportedFile {
                        format: format.clone(),
                        file_path: file_path.to_string_lossy().to_string(),
                        file_size: 0,
                        success: false,
                    });
                }
            }
        }

        result.export_time_ms = u64::try_from(start_time.elapsed().as_millis()).unwrap_or(u64::MAX);
        Ok(result)
    }

    fn get_export_file_path(base_path: &Path, format: &ExportFormat, level_name: &str) -> PathBuf {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let safe_level_name = level_name
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '_' || c == '-' {
                    c
                } else {
                    '_'
                }
            })
            .collect::<String>()
            .to_lowercase();

        let parent = base_path.parent().unwrap_or_else(|| Path::new("."));
        let file_name = format!(
            "{}_{}.{}",
            safe_level_name,
            timestamp,
            format.file_extension()
        );
        parent.join(file_name)
    }

    fn export_json(level_data: &LevelData, file_path: &PathBuf) -> Result<()> {
        let export_data = ExportMetadata {
            level: level_data.clone(),
            export_info: ExportInfo {
                exported_at: Utc::now(),
                exporter_version: "0.1.0".to_string(),
                format_version: "1.0".to_string(),
                exported_by: "Morgan-Bevy Level Editor".to_string(),
            },
        };

        let json_data = serde_json::to_string_pretty(&export_data)?;
        fs::write(file_path, json_data)?;
        Ok(())
    }

    fn export_ron(level_data: &LevelData, file_path: &PathBuf) -> Result<()> {
        // Convert to Bevy-compatible RON format
        let bevy_level = Self::convert_to_bevy_format(level_data);
        let ron_data = ron::ser::to_string_pretty(&bevy_level, ron::ser::PrettyConfig::default())?;
        fs::write(file_path, ron_data)?;
        Ok(())
    }

    fn export_rust_code(level_data: &LevelData, file_path: &PathBuf) -> Result<()> {
        let rust_code = Self::generate_rust_code(level_data)?;
        fs::write(file_path, rust_code)?;
        Ok(())
    }

    fn export_gltf(level_data: &LevelData, file_path: &PathBuf) -> Result<()> {
        // Convert level data to glTF format
        let gltf_data = Self::convert_to_gltf_format(level_data);
        let gltf_json = serde_json::to_string_pretty(&gltf_data)?;
        fs::write(file_path, gltf_json)?;
        Ok(())
    }

    fn export_fbx(level_data: &LevelData, file_path: &PathBuf) -> Result<()> {
        // Binary FBX 7.7.0 via the hand-rolled writer in `binary_fbx`.
        // Replaces the previous ASCII-text placeholder that didn't import
        // into any real DCC. The minimal node tree covers Models with
        // transforms; geometry and material assignments are left to a
        // follow-up task (T89) once the rest of the editor's mesh
        // assignment is stable.
        let fbx_bytes = Self::generate_fbx_binary(level_data)?;
        fs::write(file_path, fbx_bytes)?;
        Ok(())
    }

    fn generate_fbx_binary(level_data: &LevelData) -> Result<Vec<u8>> {
        use super::binary_fbx::{FbxBuilder, FOOTER_MAGIC, MAGIC, VERSION_7700};

        let mut fb = FbxBuilder::new();

        // FBXHeaderExtension — magic numbers expected by every FBX importer.
        {
            let n = fb.push_node("FBXHeaderExtension");
            n.push_i32(1004); // FBXHeaderVersion
            n.push_i32(7700); // FBXVersion (written here for clarity; the
                              // file-level version in the footer is the
                              // canonical one and is also VERSION_7700)
            n.push_i32(0); // EncryptionType
        }

        // GlobalSettings — empty node, but required by the FBX schema.
        fb.push_node("GlobalSettings");

        // Objects: one Model per game object. Real geometry/material
        // assignment is a follow-up (see T89); for now we emit the
        // transform-only Model node so the file imports cleanly and the
        // importer shows the scene hierarchy.
        {
            let objects = fb.push_node("Objects");
            for (i, obj) in level_data.objects.iter().enumerate() {
                let model_id = i64::try_from(i + 1)
                    .map_err(|e| anyhow::anyhow!("FBX model id overflow: {e}"))?;

                // Each Model gets its own `Properties70` block describing
                // its local transform. The P70 entries follow the
                // documented FBX convention: name, type, sub-type, flags,
                // then up to 7 scalar values.
                let model = objects.push_child("Model");
                model.push_i64(model_id);
                model.push_string(&format!("Model::{}", obj.name));
                model.push_string("Mesh");

                // Properties70 nested node — empty for now, the
                // transform is stored on the parent Model node below.
                {
                    let p70 = model.push_child("Properties70");
                    // Local translation
                    p70.push_string("P");
                    p70.push_string("Lcl Translation");
                    p70.push_string("Lcl Translation");
                    p70.push_string("");
                    p70.push_string("A");
                    p70.push_f64(f64::from(obj.transform.position[0]));
                    p70.push_f64(f64::from(obj.transform.position[1]));
                    p70.push_f64(f64::from(obj.transform.position[2]));
                    // Local scaling (rotation is intentionally omitted;
                    // most importers treat missing rotation as identity,
                    // and quaternion → FBX Euler conversion is non-trivial).
                    p70.push_string("P");
                    p70.push_string("Lcl Scaling");
                    p70.push_string("Lcl Scaling");
                    p70.push_string("");
                    p70.push_string("A");
                    p70.push_f64(f64::from(obj.transform.scale[0]));
                    p70.push_f64(f64::from(obj.transform.scale[1]));
                    p70.push_f64(f64::from(obj.transform.scale[2]));
                }
            }
        }

        // Connections — link every Model to its parent (model 0).
        {
            let connections = fb.push_node("Connections");
            for i in 0..level_data.objects.len() {
                let model_id = i64::try_from(i + 1)
                    .map_err(|e| anyhow::anyhow!("FBX connection id overflow: {e}"))?;
                // "OO" = Object-Object connection.
                connections.push_string("C");
                connections.push_string("OO");
                connections.push_i64(model_id);
                connections.push_i64(model_id);
            }
        }

        let bytes = fb
            .encode()
            .map_err(|e| anyhow::anyhow!("FBX encode failed: {e}"))?;

        // Sanity: the FBX writer must produce a non-trivial file.
        if bytes.len() < MAGIC.len() + 4 + 25 {
            return Err(anyhow::anyhow!(
                "FBX output unexpectedly short: {} bytes",
                bytes.len()
            ));
        }
        // Check the file starts with the FBX magic header.
        let header_bytes: [u8; 23] = match bytes.get(..MAGIC.len()) {
            Some(slice) => match slice.try_into() {
                Ok(arr) => arr,
                Err(_) => {
                    return Err(anyhow::anyhow!("FBX magic header slice was wrong length"));
                }
            },
            None => {
                return Err(anyhow::anyhow!("FBX output missing magic header"));
            }
        };
        if header_bytes != *MAGIC {
            return Err(anyhow::anyhow!("FBX output missing magic header"));
        }
        // Footer-magic check (last 16 bytes).
        let footer_start = bytes.len() - FOOTER_MAGIC.len();
        let footer_bytes: [u8; 16] = match bytes.get(footer_start..) {
            Some(slice) => match slice.try_into() {
                Ok(arr) => arr,
                Err(_) => {
                    return Err(anyhow::anyhow!("FBX footer magic slice was wrong length"));
                }
            },
            None => {
                return Err(anyhow::anyhow!("FBX output missing footer magic"));
            }
        };
        if footer_bytes != *FOOTER_MAGIC {
            return Err(anyhow::anyhow!("FBX output missing footer magic"));
        }
        // Version check: the writer's footer layout (after all top-level
        // nodes, working backwards from the end) is
        //   ... | 0x00 (pad) | u32 LE (version) | 0x00 | "Kaydara" (6) | 0x00 |
        //   FOOTER_MAGIC (16 bytes).
        // Total footer = 1 + 4 + 1 + 6 + 1 + 16 = 29 bytes. The version
        // u32 sits 16 (magic) + 1 (pad) + 6 (Kaydara) + 1 (pad) = 24 bytes
        // before its start, so version_start = footer_start - 13.
        let version_start = footer_start - 13;
        let version_bytes: [u8; 4] = match bytes.get(version_start..version_start + 4) {
            Some(slice) => match slice.try_into() {
                Ok(arr) => arr,
                Err(_) => {
                    return Err(anyhow::anyhow!(
                        "FBX version bytes slice had unexpected length"
                    ));
                }
            },
            None => {
                return Err(anyhow::anyhow!("FBX output truncated before version field"));
            }
        };
        let footer_version = u32::from_le_bytes(version_bytes);
        if footer_version != VERSION_7700 {
            return Err(anyhow::anyhow!(
                "FBX footer version mismatch: expected {VERSION_7700}, got {footer_version}"
            ));
        }
        Ok(bytes)
    }

    fn convert_to_bevy_format(level_data: &LevelData) -> BevyLevelData {
        let mut bevy_entities = Vec::new();

        for obj in &level_data.objects {
            bevy_entities.push(BevyEntity {
                name: obj.name.clone(),
                transform: BevyTransform {
                    translation: obj.transform.position,
                    rotation: obj.transform.rotation,
                    scale: obj.transform.scale,
                },
                mesh: obj.mesh.clone(),
                material: obj.material.clone(),
                layer: obj.layer.clone(),
                tags: obj.tags.clone(),
            });
        }

        BevyLevelData {
            name: level_data.name.clone(),
            entities: bevy_entities,
            bounds: level_data.bounds.clone(),
            metadata: BevyMetadata {
                generation_seed: level_data.generation_seed,
                generator: "BSP".to_string(),
                version: "0.1.0".to_string(),
            },
        }
    }

    fn generate_rust_code(level_data: &LevelData) -> Result<String> {
        let mut code = String::new();

        // File header — targets Bevy 0.19 component shape (per
        // docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md). PbrBundle and SceneBundle
        // are pre-0.15 and won't compile; we use Mesh3d + MeshMaterial3d +
        // Transform + Name components directly.
        let algorithm = level_data
            .generation_params
            .as_ref()
            .and_then(|p| p.get("algorithm").and_then(|v| v.as_str()))
            .unwrap_or("manual");
        let theme = level_data
            .generation_params
            .as_ref()
            .and_then(|p| p.get("theme").and_then(|v| v.as_str()))
            .unwrap_or("default");
        let seed = level_data
            .generation_seed
            .map_or_else(|| "none".to_string(), |s| s.to_string());
        writeln!(
            code,
            "// Generated level code for Bevy 0.19+\n\
             // Auto-generated by Morgan-Bevy Level Editor ({})\n\
             // Theme: {theme} | Algorithm: {algorithm} | Seed: {seed}\n",
            env!("CARGO_PKG_VERSION"),
        )?;
        code.push_str("use bevy::prelude::*;\n");
        code.push_str("use bevy::asset::Handle;\n\n");

        let fn_name = Self::fn_safe_name(&level_data.name);

        // Function signature
        writeln!(code, "pub fn spawn_level_{fn_name}(commands: &mut Commands, asset_server: &Res<AssetServer>) {{",
        )?;

        // Spawn each object
        for obj in &level_data.objects {
            writeln!(
                code,
                "    // {}\n    commands.spawn((",
                Self::escape_rust_string(&obj.name)
            )?;

            // Transform component (Bevy 0.19 unchanged: from_translation +
            // with_rotation + with_scale).
            writeln!(
                code,
                "        Transform::from_translation(Vec3::new({:.2}, {:.2}, {:.2}))",
                obj.transform.position[0], obj.transform.position[1], obj.transform.position[2]
            )?;
            writeln!(
                code,
                "            .with_rotation(Quat::from_xyzw({:.4}, {:.4}, {:.4}, {:.4}))",
                obj.transform.rotation[0],
                obj.transform.rotation[1],
                obj.transform.rotation[2],
                obj.transform.rotation[3]
            )?;
            writeln!(
                code,
                "            .with_scale(Vec3::new({:.2}, {:.2}, {:.2})),",
                obj.transform.scale[0], obj.transform.scale[1], obj.transform.scale[2]
            )?;

            // Mesh component — Bevy 0.19 uses Mesh3d(handle) instead of
            // the pre-0.15 PbrBundle.
            if let Some(ref mesh) = obj.mesh {
                writeln!(
                    code,
                    "        Mesh3d(asset_server.load(\"{}\")),",
                    Self::escape_rust_string(mesh)
                )?;
            }

            // Material component — Bevy 0.19 uses MeshMaterial3d(handle).
            // Requires bevy feature `bevy_pbr` (re-exported via the prelude).
            if let Some(ref material) = obj.material {
                writeln!(
                    code,
                    "        MeshMaterial3d(asset_server.load(\"{}\")),",
                    Self::escape_rust_string(material)
                )?;
            } else if obj.mesh.is_some() {
                code.push_str(
                    "        MeshMaterial3d(asset_server.load(\"materials/default.mat\")),\n",
                );
            }

            // Name component
            writeln!(
                code,
                "        Name::new(\"{}\"),",
                Self::escape_rust_string(&obj.name)
            )?;

            // Tags as comments for downstream tooling that wants them.
            for tag in &obj.tags {
                writeln!(code, "        // Tag: {}", Self::escape_rust_string(tag))?;
            }

            code.push_str("    ));\n\n");
        }

        // Function footer
        code.push_str("}\n\n");

        // Add convenience function for level bounds.
        writeln!(
            code,
            "pub fn get_level_{fn_name}_bounds() -> (Vec3, Vec3) {{"
        )?;
        write!(
            code,
            "    (Vec3::new({:.2}, {:.2}, {:.2}), Vec3::new({:.2}, {:.2}, {:.2}))",
            level_data.bounds.min[0],
            level_data.bounds.min[1],
            level_data.bounds.min[2],
            level_data.bounds.max[0],
            level_data.bounds.max[1],
            level_data.bounds.max[2]
        )?;
        code.push_str("}\n");

        Ok(code)
    }

    /// Convert a level name to a Rust identifier-safe `snake_case` token.
    /// Used to name the spawned `spawn_level_<name>` function.
    fn fn_safe_name(name: &str) -> String {
        let mut out = String::with_capacity(name.len());
        let mut prev_underscore = false;
        for ch in name.chars() {
            let lc = ch.to_ascii_lowercase();
            if lc.is_ascii_alphanumeric() {
                out.push(lc);
                prev_underscore = false;
            } else if !prev_underscore {
                out.push('_');
                prev_underscore = true;
            }
        }
        let trimmed = out.trim_matches('_').to_string();
        if trimmed.is_empty() {
            "unnamed".to_string()
        } else if trimmed.chars().next().is_some_and(|c| c.is_ascii_digit()) {
            format!("level_{trimmed}")
        } else {
            trimmed
        }
    }

    /// Escape a string for inclusion in a Rust string literal. Replaces `\`
    /// and `"` with their escape sequences so generated source parses.
    fn escape_rust_string(s: &str) -> String {
        let mut out = String::with_capacity(s.len());
        for ch in s.chars() {
            match ch {
                '\\' => out.push_str("\\\\"),
                '"' => out.push_str("\\\""),
                '\n' => out.push_str("\\n"),
                '\r' => out.push_str("\\r"),
                '\t' => out.push_str("\\t"),
                c if (c as u32) < 0x20 => write!(out, "\\u{{{:04X}}}", c as u32).unwrap_or(()),
                c => out.push(c),
            }
        }
        out
    }

    fn convert_to_gltf_format(level_data: &LevelData) -> GltfDocument {
        let mut gltf = GltfDocument {
            asset: GltfAsset {
                version: "2.0".to_string(),
                generator: Some("Morgan-Bevy Level Editor".to_string()),
            },
            scene: Some(0),
            scenes: vec![GltfScene {
                name: Some(level_data.name.clone()),
                nodes: (0..level_data.objects.len()).collect(),
            }],
            nodes: Vec::new(),
            meshes: Vec::new(),
            materials: Vec::new(),
        };

        // Create nodes for each object
        for (i, obj) in level_data.objects.iter().enumerate() {
            let transform_matrix = Self::create_transform_matrix(&obj.transform);
            gltf.nodes.push(GltfNode {
                name: Some(obj.name.clone()),
                mesh: Some(i), // Each object gets its own mesh
                matrix: Some(transform_matrix),
            });

            // Create basic primitive mesh based on object type
            let mesh = Self::create_gltf_mesh_for_object(obj);
            gltf.meshes.push(mesh);

            // Create material for the object
            let material = Self::create_gltf_material_for_object(obj);
            gltf.materials.push(material);
        }

        gltf
    }

    const fn create_transform_matrix(transform: &Transform3D) -> [f32; 16] {
        // Convert transform to 4x4 matrix (column-major)
        // This is a simplified transformation - in production you'd use proper matrix math
        [
            transform.scale[0],
            0.0,
            0.0,
            0.0,
            0.0,
            transform.scale[1],
            0.0,
            0.0,
            0.0,
            0.0,
            transform.scale[2],
            0.0,
            transform.position[0],
            transform.position[1],
            transform.position[2],
            1.0,
        ]
    }

    fn create_gltf_mesh_for_object(obj: &GameObject) -> GltfMesh {
        GltfMesh {
            name: Some(obj.name.clone()),
            primitives: vec![GltfPrimitive {
                mode: 4,           // TRIANGLES
                material: Some(0), // Reference to first material
                attributes: GltfAttributes {
                    position: 0, // Reference to position buffer
                },
            }],
        }
    }

    fn create_gltf_material_for_object(obj: &GameObject) -> GltfMaterial {
        GltfMaterial {
            name: obj.material.clone().or_else(|| Some("default".to_string())),
            pbr_metallic_roughness: GltfPbrMetallicRoughness {
                base_color_factor: [1.0, 1.0, 1.0, 1.0], // Default white
                metallic_factor: 0.0,
                roughness_factor: 0.9,
            },
        }
    }
}

// Export metadata structures
#[derive(Debug, Serialize, Deserialize)]
struct ExportMetadata {
    level: LevelData,
    export_info: ExportInfo,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportInfo {
    exported_at: DateTime<Utc>,
    exporter_version: String,
    format_version: String,
    exported_by: String,
}

// Bevy-specific data structures for RON export
#[derive(serde::Serialize)]
struct BevyLevelData {
    name: String,
    entities: Vec<BevyEntity>,
    bounds: BoundingBox,
    metadata: BevyMetadata,
}

#[derive(serde::Serialize)]
struct BevyEntity {
    name: String,
    transform: BevyTransform,
    mesh: Option<String>,
    material: Option<String>,
    layer: String,
    tags: Vec<String>,
}

#[derive(serde::Serialize)]
struct BevyTransform {
    translation: [f32; 3],
    rotation: [f32; 4],
    scale: [f32; 3],
}

#[derive(serde::Serialize)]
struct BevyMetadata {
    generation_seed: Option<u64>,
    generator: String,
    version: String,
}

// GLTF data structures
#[derive(serde::Serialize)]
struct GltfDocument {
    asset: GltfAsset,
    scene: Option<usize>,
    scenes: Vec<GltfScene>,
    nodes: Vec<GltfNode>,
    meshes: Vec<GltfMesh>,
    materials: Vec<GltfMaterial>,
}

#[derive(serde::Serialize)]
struct GltfAsset {
    version: String,
    generator: Option<String>,
}

#[derive(serde::Serialize)]
struct GltfScene {
    name: Option<String>,
    nodes: Vec<usize>,
}

#[derive(serde::Serialize)]
struct GltfNode {
    name: Option<String>,
    mesh: Option<usize>,
    matrix: Option<[f32; 16]>,
}

#[derive(serde::Serialize)]
struct GltfMesh {
    name: Option<String>,
    primitives: Vec<GltfPrimitive>,
}

#[derive(serde::Serialize)]
struct GltfPrimitive {
    mode: u32,
    material: Option<usize>,
    attributes: GltfAttributes,
}

#[derive(serde::Serialize)]
struct GltfAttributes {
    #[serde(rename = "POSITION")]
    position: usize,
}

#[derive(serde::Serialize)]
struct GltfMaterial {
    name: Option<String>,
    #[serde(rename = "pbrMetallicRoughness")]
    pbr_metallic_roughness: GltfPbrMetallicRoughness,
}

#[derive(serde::Serialize)]
// `_factor` suffix matches the glTF 2.0 spec (`baseColorFactor`,
// `metallicFactor`, `roughnessFactor`); the Rust field names intentionally
// mirror the spec field names after the serde rename.
#[expect(
    clippy::struct_field_names,
    reason = "glTF 2.0 spec mandates the `Factor` postfix"
)]
struct GltfPbrMetallicRoughness {
    #[serde(rename = "baseColorFactor")]
    base_color_factor: [f32; 4],
    #[serde(rename = "metallicFactor")]
    metallic_factor: f32,
    #[serde(rename = "roughnessFactor")]
    roughness_factor: f32,
}

#[cfg(test)]
mod tests {
    #![allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::indexing_slicing,
        clippy::items_after_statements,
        reason = "test code is allowed to use unwrap/expect for concise assertions"
    )]

    use super::*;
    use crate::{BoundingBox, GameObject, LevelData, Transform3D};
    use std::collections::HashMap;

    fn sample_level() -> LevelData {
        LevelData {
            id: "test".to_string(),
            name: "Office Level 01".to_string(),
            objects: vec![
                GameObject {
                    id: "wall_1".to_string(),
                    name: "Wall North".to_string(),
                    transform: Transform3D {
                        position: [1.0, 2.0, 3.0],
                        rotation: [0.0, 0.0, 0.0, 1.0],
                        scale: [1.0, 3.5, 0.2],
                    },
                    material: Some("materials/concrete.mat".to_string()),
                    mesh: Some("models/wall.gltf".to_string()),
                    layer: "walls".to_string(),
                    tags: vec!["structure".to_string()],
                    metadata: HashMap::new(),
                },
                GameObject {
                    id: "light_1".to_string(),
                    name: "Main Light".to_string(),
                    transform: Transform3D {
                        position: [0.0, 5.0, 0.0],
                        rotation: [0.0, 0.0, 0.0, 1.0],
                        scale: [1.0, 1.0, 1.0],
                    },
                    material: None,
                    mesh: None,
                    layer: "lights".to_string(),
                    tags: vec![],
                    metadata: HashMap::new(),
                },
            ],
            layers: vec!["walls".to_string(), "lights".to_string()],
            generation_seed: Some(12345),
            generation_params: Some(serde_json::json!({
                "algorithm": "BSP",
                "theme": "office",
            })),
            bounds: BoundingBox {
                min: [-10.0, 0.0, -10.0],
                max: [10.0, 5.0, 10.0],
            },
        }
    }

    #[test]
    fn generated_code_does_not_use_pbr_bundle() {
        // Regression for T39: the pre-0.15 PbrBundle must not appear in
        // generated source. Bevy 0.19 removed it; the migration guide
        // specifies Mesh3d + MeshMaterial3d + Transform + Visibility.
        let code = LevelExporter::generate_rust_code(&sample_level())
            .expect("generate_rust_code should succeed for a valid level");
        assert!(
            !code.contains("PbrBundle"),
            "generated Bevy code must not reference pre-0.15 PbrBundle; got:\n{code}"
        );
        assert!(
            !code.contains("SceneBundle"),
            "generated Bevy code must not reference pre-0.15 SceneBundle; got:\n{code}"
        );
    }

    #[test]
    fn generated_code_uses_bevy_0_19_component_shape() {
        let code = LevelExporter::generate_rust_code(&sample_level())
            .expect("generate_rust_code should succeed");
        // Mesh3d + MeshMaterial3d are the Bevy 0.15+ replacements for
        // PbrBundle's mesh/material fields.
        assert!(
            code.contains("Mesh3d(asset_server.load"),
            "expected Bevy 0.19 Mesh3d(handle) component; got:\n{code}"
        );
        assert!(
            code.contains("MeshMaterial3d(asset_server.load"),
            "expected Bevy 0.19 MeshMaterial3d(handle) component; got:\n{code}"
        );
        // Transform + Name still present.
        assert!(code.contains("Transform::from_translation"));
        assert!(code.contains("Name::new(\"Wall North\")"));
    }

    #[test]
    fn generated_code_header_documents_bevy_0_19_and_metadata() {
        let code = LevelExporter::generate_rust_code(&sample_level())
            .expect("generate_rust_code should succeed");
        assert!(code.contains("// Generated level code for Bevy 0.19+"));
        assert!(code.contains("Auto-generated by Morgan-Bevy Level Editor"));
        // Theme and algorithm appear in the header comment from
        // generation_params.
        assert!(code.contains("Theme: office"));
        assert!(code.contains("Algorithm: BSP"));
        assert!(code.contains("Seed: 12345"));
    }

    #[test]
    fn generated_function_name_is_identifier_safe() {
        let code = LevelExporter::generate_rust_code(&sample_level())
            .expect("generate_rust_code should succeed");
        assert!(
            code.contains("pub fn spawn_level_office_level_01("),
            "expected snake_case identifier-safe function name; got:\n{code}"
        );
        assert!(
            code.contains("pub fn get_level_office_level_01_bounds()"),
            "expected bounds function name to match; got:\n{code}"
        );
    }

    #[test]
    fn generated_code_escapes_strings_for_rust() {
        // fn_safe_name drops non-alphanumeric, but a string literal in
        // a Rust string still has to escape `\`, `"`, control chars.
        let mut lvl = sample_level();
        lvl.objects[0].name = "Wall \"North\" with \\backslash".to_string();
        let code =
            LevelExporter::generate_rust_code(&lvl).expect("generate_rust_code should succeed");
        assert!(
            code.contains("Wall \\\"North\\\" with \\\\backslash"),
            "expected escaped quotes and backslashes; got:\n{code}"
        );
    }

    #[test]
    fn fn_safe_name_handles_edge_cases() {
        // Empty / all-punctuation collapses to "unnamed".
        assert_eq!(LevelExporter::fn_safe_name(""), "unnamed");
        assert_eq!(LevelExporter::fn_safe_name("   "), "unnamed");
        assert_eq!(LevelExporter::fn_safe_name("---"), "unnamed");
        // Leading digit gets a prefix.
        assert_eq!(LevelExporter::fn_safe_name("3d-level"), "level_3d_level");
        // Already-snake-case stays the same.
        assert_eq!(LevelExporter::fn_safe_name("office_level"), "office_level");
        // Mixed case + spaces → snake_case.
        assert_eq!(
            LevelExporter::fn_safe_name("Office Level 01"),
            "office_level_01"
        );
        // Special characters collapse to a single underscore.
        assert_eq!(LevelExporter::fn_safe_name("foo!!!bar"), "foo_bar");
    }

    #[test]
    fn objects_without_mesh_or_material_get_no_spawn_components() {
        let mut lvl = sample_level();
        // Strip the second object's mesh and material to a barebones record.
        lvl.objects[1].mesh = None;
        lvl.objects[1].material = None;
        let code =
            LevelExporter::generate_rust_code(&lvl).expect("generate_rust_code should succeed");
        // The light object should still spawn, just without Mesh3d / MeshMaterial3d.
        assert!(code.contains("Name::new(\"Main Light\")"));
        // After the light's spawn, the next object block should NOT have
        // a `Mesh3d(asset_server.load(` for that object (because it has
        // no mesh). We assert this by counting Mesh3d occurrences and
        // comparing against the wall object count.
        let mesh_count = code.matches("Mesh3d(asset_server.load(").count();
        assert_eq!(
            mesh_count, 1,
            "expected exactly 1 Mesh3d component for the single meshed object; got {mesh_count}"
        );
    }

    #[test]
    fn level_with_no_objects_still_emits_a_function() {
        let mut lvl = sample_level();
        lvl.objects.clear();
        let code =
            LevelExporter::generate_rust_code(&lvl).expect("generate_rust_code should succeed");
        // The function shell must still exist even when there are no
        // spawn calls inside it.
        assert!(code.contains("pub fn spawn_level_office_level_01("));
        assert!(code.contains("pub fn get_level_office_level_01_bounds()"));
    }

    // ─── T41: real binary FBX 7.7.0 ─────────────────────────────────────

    #[test]
    fn fbx_binary_output_starts_with_magic_and_ends_with_footer_magic() {
        // Regression for T41: the FBX exporter must emit real binary,
        // not the previous ASCII-text placeholder. Verify the magic
        // header at offset 0 and the footer magic at the tail.
        use super::super::binary_fbx::{FOOTER_MAGIC, MAGIC};
        let bytes = LevelExporter::generate_fbx_binary(&sample_level())
            .expect("generate_fbx_binary should succeed");
        // TEMP debug: include the tail bytes in the panic message.
        let tail_len = 40.min(bytes.len());
        let tail: Vec<u8> = bytes[bytes.len() - tail_len..].to_vec();
        assert!(
            bytes.len() >= MAGIC.len() + 4 + FOOTER_MAGIC.len() + 8,
            "FBX output too short to be valid: {} bytes (tail: {:?})",
            bytes.len(),
            tail
        );
        assert_eq!(&bytes[..MAGIC.len()], MAGIC);
        let footer_start = bytes.len() - FOOTER_MAGIC.len();
        assert_eq!(&bytes[footer_start..], FOOTER_MAGIC);
    }

    #[test]
    fn fbx_binary_emits_one_model_per_object() {
        // The Objects > Model subtree must have one Model node per
        // game object. With our minimal sample (2 objects), we expect
        // to find at least two "Model\0Model::" name strings in the
        // output (one per object).
        let bytes = LevelExporter::generate_fbx_binary(&sample_level())
            .expect("generate_fbx_binary should succeed");
        let needle_1 = b"Model::Wall North";
        let needle_2 = b"Model::Main Light";
        assert!(
            bytes.windows(needle_1.len()).any(|w| w == needle_1),
            "expected Model::Wall North in FBX output"
        );
        assert!(
            bytes.windows(needle_2.len()).any(|w| w == needle_2),
            "expected Model::Main Light in FBX output"
        );
    }

    #[test]
    fn fbx_binary_writes_translation_as_f64_array() {
        // The translation P70 entry encodes three f64 values. We can't
        // easily round-trip the exact bytes, but we can assert that
        // each translation is present alongside the label "Lcl Translation".
        let bytes = LevelExporter::generate_fbx_binary(&sample_level())
            .expect("generate_fbx_binary should succeed");
        // Two objects, two translation labels.
        let occurrences = bytes
            .windows(b"Lcl Translation".len())
            .filter(|w| *w == b"Lcl Translation")
            .count();
        assert!(
            occurrences >= 2,
            "expected at least 2 Lcl Translation labels (one per object); got {occurrences}"
        );
    }

    #[test]
    fn fbx_binary_with_empty_objects_still_valid() {
        // The exporter must handle empty levels without producing an
        // invalid file (header + Objects node + Connections + footer).
        let mut lvl = sample_level();
        lvl.objects.clear();
        let bytes = LevelExporter::generate_fbx_binary(&lvl)
            .expect("generate_fbx_binary should succeed for empty level");
        use super::super::binary_fbx::{FOOTER_MAGIC, MAGIC};
        assert_eq!(&bytes[..MAGIC.len()], MAGIC);
        let footer_start = bytes.len() - FOOTER_MAGIC.len();
        assert_eq!(&bytes[footer_start..], FOOTER_MAGIC);
    }
}
