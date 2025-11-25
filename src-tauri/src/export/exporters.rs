use crate::export::ExportFormat;
use crate::spatial::BoundingBox;
use crate::{GameObject, LevelData, Transform3D};
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
                ExportFormat::GLTF => self.export_gltf(level_data, &file_path).await,
                ExportFormat::FBX => self.export_fbx(level_data, &file_path).await,
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

    async fn export_gltf(&self, level_data: &LevelData, file_path: &PathBuf) -> Result<()> {
        // Convert level data to glTF format
        let gltf_data = self.convert_to_gltf_format(level_data)?;
        let gltf_json = serde_json::to_string_pretty(&gltf_data)?;
        fs::write(file_path, gltf_json)?;
        Ok(())
    }

    async fn export_fbx(&self, level_data: &LevelData, file_path: &PathBuf) -> Result<()> {
        // For FBX, we'll create a text-based FBX format as a placeholder
        // In production, you'd use an FBX SDK library
        let fbx_text = self.generate_fbx_ascii(level_data)?;
        fs::write(file_path, fbx_text)?;
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

    fn convert_to_gltf_format(&self, level_data: &LevelData) -> Result<GltfDocument> {
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
            let transform_matrix = self.create_transform_matrix(&obj.transform);
            gltf.nodes.push(GltfNode {
                name: Some(obj.name.clone()),
                mesh: Some(i), // Each object gets its own mesh
                matrix: Some(transform_matrix),
            });

            // Create basic primitive mesh based on object type
            let mesh = self.create_gltf_mesh_for_object(obj)?;
            gltf.meshes.push(mesh);

            // Create material for the object
            let material = self.create_gltf_material_for_object(obj)?;
            gltf.materials.push(material);
        }

        Ok(gltf)
    }

    fn create_transform_matrix(&self, transform: &Transform3D) -> [f32; 16] {
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

    fn create_gltf_mesh_for_object(&self, obj: &GameObject) -> Result<GltfMesh> {
        Ok(GltfMesh {
            name: Some(obj.name.clone()),
            primitives: vec![GltfPrimitive {
                mode: 4,           // TRIANGLES
                material: Some(0), // Reference to first material
                attributes: GltfAttributes {
                    position: 0, // Reference to position buffer
                },
            }],
        })
    }

    fn create_gltf_material_for_object(&self, obj: &GameObject) -> Result<GltfMaterial> {
        Ok(GltfMaterial {
            name: obj.material.clone().or_else(|| Some("default".to_string())),
            pbr_metallic_roughness: GltfPbrMetallicRoughness {
                base_color_factor: [1.0, 1.0, 1.0, 1.0], // Default white
                metallic_factor: 0.0,
                roughness_factor: 0.9,
            },
        })
    }

    fn generate_fbx_ascii(&self, level_data: &LevelData) -> Result<String> {
        let mut fbx_content = String::new();

        // FBX ASCII header
        fbx_content.push_str("; FBX 7.7.0 project file\n");
        fbx_content.push_str("; Generated by Morgan-Bevy Level Editor\n\n");

        fbx_content.push_str("FBXHeaderExtension:  {\n");
        fbx_content.push_str("    FBXHeaderVersion: 1004\n");
        fbx_content.push_str("    FBXVersion: 7700\n");
        fbx_content.push_str("    EncryptionType: 0\n");
        fbx_content.push_str("}\n\n");

        // Creation time
        fbx_content.push_str("CreationTime: \"2025-11-24 00:00:00:000\"\n");
        fbx_content.push_str(&format!(
            "Creator: \"Morgan-Bevy Level Editor - {}\"\n\n",
            level_data.name
        ));

        // Objects section
        fbx_content.push_str("Objects:  {\n");

        for (id, obj) in level_data.objects.iter().enumerate() {
            // Model object
            fbx_content.push_str(&format!(
                "    Model: {}, \"Model::{}\", \"Mesh\" {{\n",
                id * 3 + 1,
                obj.name
            ));
            fbx_content.push_str("        Version: 232\n");
            fbx_content.push_str("        Properties70:  {\n");
            fbx_content.push_str(&format!(
                "            P: \"Lcl Translation\", \"Lcl Translation\", \"\", \"A\",{},{},{}\n",
                obj.transform.position[0], obj.transform.position[1], obj.transform.position[2]
            ));
            fbx_content.push_str(&format!(
                "            P: \"Lcl Scaling\", \"Lcl Scaling\", \"\", \"A\",{},{},{}\n",
                obj.transform.scale[0], obj.transform.scale[1], obj.transform.scale[2]
            ));
            fbx_content.push_str("        }\n");
            fbx_content.push_str("        MultiLayer: 0\n");
            fbx_content.push_str("        MultiTake: 0\n");
            fbx_content.push_str("        Shading: T\n");
            fbx_content.push_str("        Culling: \"CullingOff\"\n");
            fbx_content.push_str("    }\n");

            // Geometry object (simplified cube for demonstration)
            fbx_content.push_str(&format!(
                "    Geometry: {}, \"Geometry::{}_Geometry\", \"Mesh\" {{\n",
                id * 3 + 2,
                obj.name
            ));
            fbx_content.push_str("        Vertices: *24 {\n");
            fbx_content.push_str(
                "            a: -1,-1,-1,1,-1,-1,1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,1,1,-1,1,1\n",
            );
            fbx_content.push_str("        }\n");
            fbx_content.push_str("        PolygonVertexIndex: *24 {\n");
            fbx_content
                .push_str("            a: 0,1,2,-4,4,7,6,-6,0,4,5,-2,2,6,7,-4,0,3,7,-5,2,1,5,-7\n");
            fbx_content.push_str("        }\n");
            fbx_content.push_str("    }\n");

            // Material object
            fbx_content.push_str(&format!(
                "    Material: {}, \"Material::{}_Material\", \"\" {{\n",
                id * 3 + 3,
                obj.name
            ));
            fbx_content.push_str("        Version: 102\n");
            fbx_content.push_str("        ShadingModel: \"lambert\"\n");
            fbx_content.push_str("        MultiLayer: 0\n");
            fbx_content.push_str("        Properties70:  {\n");
            fbx_content.push_str("            P: \"DiffuseColor\", \"Color\", \"\", \"A\",1,1,1\n");
            fbx_content.push_str("        }\n");
            fbx_content.push_str("    }\n");
        }

        fbx_content.push_str("}\n\n");

        // Connections section
        fbx_content.push_str("Connections:  {\n");
        for (id, _obj) in level_data.objects.iter().enumerate() {
            fbx_content.push_str(&format!("    C: \"OO\",{},0\n", id * 3 + 1)); // Model to Scene
            fbx_content.push_str(&format!("    C: \"OO\",{},{}\n", id * 3 + 2, id * 3 + 1)); // Geometry to Model
            fbx_content.push_str(&format!("    C: \"OO\",{},{}\n", id * 3 + 3, id * 3 + 1));
            // Material to Model
        }
        fbx_content.push_str("}\n");

        Ok(fbx_content)
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
struct GltfPbrMetallicRoughness {
    #[serde(rename = "baseColorFactor")]
    base_color_factor: [f32; 4],
    #[serde(rename = "metallicFactor")]
    metallic_factor: f32,
    #[serde(rename = "roughnessFactor")]
    roughness_factor: f32,
}
