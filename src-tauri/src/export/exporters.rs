use crate::export::ExportFormat;
use crate::spatial::BoundingBox;
use crate::LevelData;
use anyhow::Result;
use chrono::{DateTime, Utc};
use log::info;
use serde::{Deserialize, Serialize};
use serde_json;
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
    pub fn new() -> Self {
        Self
    }

    pub async fn export_multi_format(
        &self,
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
            let file_path = self.get_export_file_path(base_path, format, &level_data.name)?;

            let export_result = match format {
                ExportFormat::JSON => self.export_json(level_data, &file_path).await,
                ExportFormat::RON => self.export_ron(level_data, &file_path).await,
                ExportFormat::RustCode => self.export_rust_code(level_data, &file_path).await,
                ExportFormat::GLTF => {
                    result
                        .warnings
                        .push("GLTF export not yet implemented".to_string());
                    continue;
                }
                ExportFormat::FBX => {
                    result
                        .warnings
                        .push("FBX export not yet implemented".to_string());
                    continue;
                }
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
                    info!("Exported to: {:?}", file_path);
                }
                Err(e) => {
                    result
                        .errors
                        .push(format!("Failed to export {:?}: {}", format, e));
                    result.exported_files.push(ExportedFile {
                        format: format.clone(),
                        file_path: file_path.to_string_lossy().to_string(),
                        file_size: 0,
                        success: false,
                    });
                }
            }
        }

        result.export_time_ms = start_time.elapsed().as_millis() as u64;
        Ok(result)
    }

    fn get_export_file_path(
        &self,
        base_path: &Path,
        format: &ExportFormat,
        level_name: &str,
    ) -> Result<PathBuf> {
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
        Ok(parent.join(file_name))
    }

    async fn export_json(&self, level_data: &LevelData, file_path: &PathBuf) -> Result<()> {
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

    async fn export_ron(&self, level_data: &LevelData, file_path: &PathBuf) -> Result<()> {
        // Convert to Bevy-compatible RON format
        let bevy_level = self.convert_to_bevy_format(level_data)?;
        let ron_data = ron::ser::to_string_pretty(&bevy_level, ron::ser::PrettyConfig::default())?;
        fs::write(file_path, ron_data)?;
        Ok(())
    }

    async fn export_rust_code(&self, level_data: &LevelData, file_path: &PathBuf) -> Result<()> {
        let rust_code = self.generate_rust_code(level_data)?;
        fs::write(file_path, rust_code)?;
        Ok(())
    }

    fn convert_to_bevy_format(&self, level_data: &LevelData) -> Result<BevyLevelData> {
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

        Ok(BevyLevelData {
            name: level_data.name.clone(),
            entities: bevy_entities,
            bounds: level_data.bounds.clone(),
            metadata: BevyMetadata {
                generation_seed: level_data.generation_seed,
                generator: "BSP".to_string(),
                version: "0.1.0".to_string(),
            },
        })
    }

    fn generate_rust_code(&self, level_data: &LevelData) -> Result<String> {
        let mut code = String::new();

        // File header
        code.push_str("// Generated level code for Bevy\n");
        code.push_str("// This file was auto-generated by Morgan-Bevy Level Editor\n\n");
        code.push_str("use bevy::prelude::*;\n");
        code.push_str("use bevy::asset::Handle;\n\n");

        // Function signature
        code.push_str(&format!(
            "pub fn spawn_level_{}(commands: &mut Commands, asset_server: &Res<AssetServer>) {{\n",
            level_data.name.to_lowercase().replace(' ', "_")
        ));

        // Spawn each object
        for obj in &level_data.objects {
            code.push_str(&format!("    // {}\n    commands.spawn((\n", obj.name));

            // Transform component
            code.push_str(&format!(
                "        Transform::from_translation(Vec3::new({:.2}, {:.2}, {:.2}))\n",
                obj.transform.position[0], obj.transform.position[1], obj.transform.position[2]
            ));
            code.push_str(&format!(
                "            .with_rotation(Quat::from_xyzw({:.4}, {:.4}, {:.4}, {:.4}))\n",
                obj.transform.rotation[0],
                obj.transform.rotation[1],
                obj.transform.rotation[2],
                obj.transform.rotation[3]
            ));
            code.push_str(&format!(
                "            .with_scale(Vec3::new({:.2}, {:.2}, {:.2})),\n",
                obj.transform.scale[0], obj.transform.scale[1], obj.transform.scale[2]
            ));

            // Mesh component
            if let Some(ref mesh) = obj.mesh {
                code.push_str(&format!(
                    "        PbrBundle {{\n            mesh: asset_server.load(\"{}\"),\n",
                    mesh
                ));

                // Material component
                if let Some(ref material) = obj.material {
                    code.push_str(&format!(
                        "            material: asset_server.load(\"{}\"),\n",
                        material
                    ));
                } else {
                    code.push_str(
                        "            material: asset_server.load(\"materials/default.mat\"),\n",
                    );
                }

                code.push_str("            ..default()\n        },\n");
            }

            // Name component
            code.push_str(&format!("        Name::new(\"{}\"),\n", obj.name));

            // Tags/layers as custom components could be added here
            for tag in &obj.tags {
                code.push_str(&format!("        // Tag: {}\n", tag));
            }

            code.push_str("    ));\n\n");
        }

        // Function footer
        code.push_str("}\n\n");

        // Add convenience function for level bounds
        code.push_str(&format!(
            "pub fn get_level_{}_bounds() -> (Vec3, Vec3) {{\n",
            level_data.name.to_lowercase().replace(' ', "_")
        ));
        code.push_str(&format!(
            "    (Vec3::new({:.2}, {:.2}, {:.2}), Vec3::new({:.2}, {:.2}, {:.2}))\n",
            level_data.bounds.min[0],
            level_data.bounds.min[1],
            level_data.bounds.min[2],
            level_data.bounds.max[0],
            level_data.bounds.max[1],
            level_data.bounds.max[2]
        ));
        code.push_str("}\n");

        Ok(code)
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
