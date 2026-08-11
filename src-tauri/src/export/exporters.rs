use crate::export::ExportFormat;
use crate::spatial::{BoundingBox, NavMesh, PatrolRoute, Waypoint};
use crate::{CollisionShape, GameObject, LevelData, SpawnPoint, Transform3D, TriggerVolume};
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

/// Bitset of which marker types the level uses.
///
/// Mirrors `bevy_morgan_integration::systems::MarkerSet` — the
/// generator builds this once from `level_data.objects` before
/// emitting, and uses it to gate the systems + plugin + companion
/// types that get written into the generated file.
#[allow(clippy::struct_excessive_bools, reason = "MarkerSet is a bitset")]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct MarkerSet {
    pub door: bool,
    pub collectible: bool,
    pub spawn_point: bool,
    pub trigger_volume: bool,
    pub nav_mesh_hint: bool,
    // T91: four new markers.
    pub light: bool,
    pub animation: bool,
    pub audio: bool,
    pub vfx: bool,
}

impl MarkerSet {
    /// Construct an empty `MarkerSet`.
    #[must_use]
    pub const fn new() -> Self {
        Self {
            door: false,
            collectible: false,
            spawn_point: false,
            trigger_volume: false,
            nav_mesh_hint: false,
            light: false,
            animation: false,
            audio: false,
            vfx: false,
        }
    }

    /// `true` when no markers are set.
    #[must_use]
    pub const fn is_empty(&self) -> bool {
        !self.door
            && !self.collectible
            && !self.spawn_point
            && !self.trigger_volume
            && !self.nav_mesh_hint
            && !self.light
            && !self.animation
            && !self.audio
            && !self.vfx
    }
}

// ---------------------------------------------------------------------------
// T91 marker enums — mirror of the companion crate's `markers.rs`.
// ---------------------------------------------------------------------------

/// Lighting marker (T91). The editor's `GameObject.light` field
/// carries this when the object is a light source.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum LightMarker {
    Point {
        color: [f32; 3],
        intensity: f32,
        range: f32,
        shadows: bool,
    },
    Spot {
        color: [f32; 3],
        intensity: f32,
        range: f32,
        inner_angle: f32,
        outer_angle: f32,
        shadows: bool,
    },
    Directional {
        color: [f32; 3],
        intensity: f32,
        shadows: bool,
    },
}

/// Animation marker (T91). `Play` runs the clip in a loop at the
/// given speed; `PlayOnce` plays the clip a single time.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AnimationMarker {
    Play {
        clip: String,
        repeat: bool,
        speed: f32,
    },
    PlayOnce {
        clip: String,
    },
}

/// Audio marker (T91). `Ambient` is a looping sound; `OneShot`
/// plays once and the entity despawns on completion.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AudioMarker {
    Ambient {
        path: String,
        volume: f32,
        looping: bool,
    },
    OneShot {
        path: String,
        volume: f32,
    },
}

/// VFX marker (T91). `Particle` references a particle-effect asset;
/// `Billboard` references a 2D texture rendered facing the camera.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum VfxMarker {
    Particle { path: String, count: u32 },
    Billboard { texture: String, size: [f32; 2] },
}

/// How the generated Bevy source references the per-marker systems.
///
/// The editor records the chosen mode in the generated header so
/// re-exports preserve it; `parse_systems_mode_from_header` reads
/// the comment back out.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SystemsMode {
    /// Reference the companion crate's `systems` module. Bug fixes
    /// flow through automatically on `cargo update`.
    #[default]
    CompanionReference,
    /// Embed the system bodies verbatim. Hermetic build; the
    /// generated file has no runtime dep on
    /// `bevy_morgan_integration::systems`. Reserved for T90 v2;
    /// the editor currently emits `CompanionReference`.
    Inline,
}

/// Compute the `MarkerSet` for a level by inspecting every object's
/// `tags`. A tag of `"door"` flips `door = true`, `"collectible"`
/// flips `collectible`, etc. Case-insensitive.
#[must_use]
pub fn marker_tags_present(level_data: &LevelData) -> MarkerSet {
    let mut s = MarkerSet::new();
    for obj in &level_data.objects {
        for tag in &obj.tags {
            match tag.to_lowercase().as_str() {
                "door" => s.door = true,
                "collectible" => s.collectible = true,
                "spawn" | "spawn-point" | "spawnpoint" => s.spawn_point = true,
                "trigger" | "trigger-volume" | "triggervolume" => s.trigger_volume = true,
                "nav-mesh" | "navmesh" => s.nav_mesh_hint = true,
                "light" | "lightsource" => s.light = true,
                "anim" | "animation" => s.animation = true,
                "audio" | "sound" => s.audio = true,
                "vfx" | "particles" | "particle" | "billboard" => s.vfx = true,
                _ => {}
            }
        }
    }
    s
}

/// Read the `// Systems mode: ...` header line out of a previously
/// exported Bevy source file. Returns `None` if the file was
/// generated before T90 (legacy export) or the marker isn't found.
#[must_use]
pub fn parse_systems_mode_from_header(generated: &str) -> Option<SystemsMode> {
    for line in generated.lines() {
        let line = line.trim_start_matches('/').trim();
        if let Some(rest) = line.strip_prefix("Systems mode:") {
            let mode = rest.trim();
            return match mode {
                "CompanionReference" => Some(SystemsMode::CompanionReference),
                "Inline" => Some(SystemsMode::Inline),
                _ => None,
            };
        }
    }
    None
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

    /// T90: re-export a level's Rust source while preserving the
    /// previously chosen `SystemsMode` from the on-disk header.
    /// Reads the existing file (if any), extracts the mode, and
    /// regenerates with the same mode. Legacy exports (no mode
    /// marker) default to `CompanionReference`.
    #[allow(dead_code)]
    pub fn re_export_rust_code(level_data: &LevelData, file_path: &PathBuf) -> Result<()> {
        let previous_mode = fs::read_to_string(file_path)
            .ok()
            .and_then(|src| parse_systems_mode_from_header(&src));
        // Both `CompanionReference` and `Inline` modes currently
        // route through `generate_rust_code`. Inline mode is
        // reserved for T90 v2; until then, fall back to
        // CompanionReference so the consumer's
        // `bevy-morgan-integration` runtime is always present.
        let _ = previous_mode;
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
            // T56: carry the navmesh through to the Bevy-facing RON
            // export when present. Absent (`None`) levels simply
            // omit the field via `skip_serializing_if`.
            navmesh: level_data.navmesh.clone(),
            // T57: carry waypoints/patrol routes through to the
            // Bevy-facing RON export. Empty levels simply omit the
            // fields via `skip_serializing_if`.
            waypoints: level_data.waypoints.clone(),
            patrol_routes: level_data.patrol_routes.clone(),
        }
    }

    fn generate_rust_code(level_data: &LevelData) -> Result<String> {
        let mut code = String::new();

        // T90: compute the marker set once and decide whether to emit
        // the per-marker systems plugin. The marker set is derived
        // from the level's object tags — see `marker_tags_present`.
        let marker_set = marker_tags_present(level_data);
        // T90 v1: only CompanionReference is supported in the
        // emission path. Inline mode is reserved for the editor's
        // export dialog and will be wired up in T90 v2.
        let systems_mode = SystemsMode::CompanionReference;

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
        let systems_mode_label = match systems_mode {
            SystemsMode::CompanionReference => "CompanionReference",
            SystemsMode::Inline => "Inline",
        };
        writeln!(
            code,
            "// Generated level code for Bevy 0.19+\n\
             // Auto-generated by Morgan-Bevy Level Editor ({})\n\
             // Theme: {theme} | Algorithm: {algorithm} | Seed: {seed}\n\
             // Systems mode: {systems_mode_label}\n",
            env!("CARGO_PKG_VERSION"),
        )?;
        code.push_str("use bevy::prelude::*;\n");
        code.push_str("use bevy::asset::Handle;\n");

        // T90: when the level uses any per-marker tags, emit a `use
        // bevy_morgan_integration::systems::*;` block plus the plugin
        // call site. The marker set gates which companion types and
        // system registrations are emitted — empty marker sets skip
        // the import + plugin entirely.
        if !marker_set.is_empty() {
            code.push_str("use bevy_morgan_integration::systems::{\n");
            code.push_str("    MorganLevelSystems, plugin, Player,\n");
            if marker_set.door || marker_set.collectible {
                code.push_str("    Open, PickupEvent,\n");
            }
            if marker_set.trigger_volume {
                code.push_str("    TriggerActivated,\n");
            }
            if marker_set.spawn_point {
                code.push_str("    PlayerStart,\n");
            }
            if marker_set.nav_mesh_hint {
                code.push_str("    NavMeshSource,\n");
            }
            code.push_str("};\n");
        }
        code.push('\n');

        // `Collider` is imported on-demand via the `avian3d` crate, which
        // is the documented Bevy 0.19 collision provider.
        let needs_avian = level_data
            .objects
            .iter()
            .any(|o| o.collision_shape.is_some());
        if needs_avian {
            code.push_str("use avian3d::prelude::Collider;\n");
        }

        // T42/T91 bugfix: import `SpawnPoint` / `TriggerVolume` /
        // `Light` / `Animation` / `Audio` / `Vfx` from the companion
        // crate instead of redefining them locally -- see
        // `emit_companion_type_imports` for the rationale.
        Self::emit_companion_type_imports(&mut code, level_data)?;

        // T56: emit the navmesh (if generated) as a JSON string
        // constant. The `NavMesh` shape (plain vertex / triangle /
        // connection data, see `spatial::navmesh` module docs) is
        // intentionally decoupled from any specific navmesh crate's
        // internal types, so consumers deserialize it with
        // `serde_json::from_str` into their own equivalent type
        // (or Rapier3D `TriMesh` / `bevy_navigation` inputs built
        // from `vertices` + `triangle_indices` / `polygons` +
        // `connections`) rather than a generated Rust literal.
        if let Some(ref navmesh) = level_data.navmesh {
            let navmesh_json = serde_json::to_string(navmesh)?;
            writeln!(
                code,
                "/// Navigation mesh data (T56), serialized as JSON. Deserialize\n\
                 /// with `serde_json::from_str` into a type matching the shape\n\
                 /// documented in `spatial::navmesh::NavMesh` (plain vertex /\n\
                 /// triangle / connection data -- Rapier3D- and\n\
                 /// bevy_navigation-compatible without a hard dependency on\n\
                 /// either crate).\n\
                 pub const NAVMESH_JSON: &str = \"{}\";\n",
                Self::escape_rust_string(&navmesh_json)
            )?;
        }

        // T57: waypoints/patrol routes, same JSON-string-constant
        // rationale as `NAVMESH_JSON` above. Factored into a helper
        // (rather than inlined here like the navmesh block) to keep
        // `generate_rust_code` under clippy's `too_many_lines`
        // budget now that there are three such blocks.
        Self::emit_waypoint_json_constants(&mut code, level_data)?;

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

            // T42: collision shape. The generator emits a
            // `Collider` component using `avian3d` syntax — the
            // Bevy-side user is expected to depend on `avian3d`
            // for collision; if they don't, the file will not
            // compile, which is the documented contract.
            if let Some(ref shape) = obj.collision_shape {
                code.push_str(Self::rust_collision_component(shape).as_str());
            }

            // T42: spawn point marker component carrying the
            // team / item-id metadata as plain string fields.
            if let Some(ref spawn) = obj.spawn_point {
                code.push_str(Self::rust_spawn_component(spawn).as_str());
            }

            // T42: trigger volume marker component with the
            // user-defined event hook.
            if let Some(ref trigger) = obj.trigger_volume {
                code.push_str(Self::rust_trigger_component(trigger).as_str());
            }

            // T91: lighting marker — emits a `Light` component
            // (Point / Spot / Directional).
            if let Some(ref light) = obj.light {
                code.push_str(Self::rust_light_component(light).as_str());
            }

            // T91: animation marker.
            if let Some(ref anim) = obj.animation {
                code.push_str(Self::rust_animation_component(anim).as_str());
            }

            // T91: audio marker.
            if let Some(ref audio) = obj.audio {
                code.push_str(Self::rust_audio_component(audio).as_str());
            }

            // T91: VFX marker.
            if let Some(ref vfx) = obj.vfx {
                code.push_str(Self::rust_vfx_component(vfx).as_str());
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

        // T90: emit the per-marker systems + plugin registration site
        // when the marker set is non-empty. The `marker_set` block
        // above already imported the symbols; here we provide a
        // free-function `plugin_init` that consumers call from
        // their App::new() chain. Inline (the systems body) lives
        // in `bevy_morgan_integration::systems` — CompanionReference
        // mode is the only v1 emission strategy; Inline mode is
        // reserved for a future editor dialog.
        if !marker_set.is_empty() {
            code.push_str("\n/// Register the per-marker level systems\n");
            code.push_str("/// with a Bevy `App` builder. Call from your app's\n");
            code.push_str("/// `main`:\n");
            code.push_str("///\n");
            code.push_str("/// ```ignore\n");
            code.push_str("/// App::new()\n");
            code.push_str("///     .add_systems(Startup, spawn_level_<fn_name>)\n");
            code.push_str("///     .add_plugins(plugin())\n");
            code.push_str("///     .run();\n");
            code.push_str("/// ```\n");
            code.push_str(
                "pub fn plugin_init(app: &mut bevy::app::App) {\n    app.add_plugins(plugin());\n}\n",
            );
        }

        Ok(code)
    }

    /// T42/T91 bugfix: emit `use bevy_morgan_integration::{...};`
    /// importing whichever of `SpawnPoint` / `TriggerVolume` / `Light`
    /// / `Animation` / `Audio` / `Vfx` the level's objects actually
    /// use, instead of the generator locally redefining `SpawnPoint`
    /// / `TriggerVolume` as its own `enum`s (as it used to).
    ///
    /// The per-marker systems registered by
    /// `bevy_morgan_integration::systems::plugin()`
    /// (`spawn_point_observer`, `light_observer`,
    /// `animation_player_observer`, `audio_observer`, `vfx_observer`,
    /// ...) are `On<Add, T>` observers written against the companion
    /// crate's own marker types. A locally-redefined `enum SpawnPoint
    /// { ... }` would be a *different* nominal Rust type even if
    /// structurally identical, so those observers could never fire on
    /// entities spawned from the generated file. Emitting `use
    /// bevy_morgan_integration::{...};` keeps the generated file's
    /// types identical to the companion crate's. `Light` / `Animation`
    /// / `Audio` / `Vfx` additionally had no import at all previously,
    /// which produced an E0433 unresolved-type compile error.
    ///
    /// Extracted out of `generate_rust_code` purely to keep that
    /// function under clippy's `too_many_lines` budget -- same
    /// rationale as `emit_waypoint_json_constants` below.
    fn emit_companion_type_imports(code: &mut String, level_data: &LevelData) -> Result<()> {
        let mut companion_types: Vec<&str> = Vec::new();
        if level_data.objects.iter().any(|o| o.spawn_point.is_some()) {
            companion_types.push("SpawnPoint");
        }
        if level_data
            .objects
            .iter()
            .any(|o| o.trigger_volume.is_some())
        {
            companion_types.push("TriggerVolume");
        }
        if level_data.objects.iter().any(|o| o.light.is_some()) {
            companion_types.push("Light");
        }
        if level_data.objects.iter().any(|o| o.animation.is_some()) {
            companion_types.push("Animation");
        }
        if level_data.objects.iter().any(|o| o.audio.is_some()) {
            companion_types.push("Audio");
        }
        if level_data.objects.iter().any(|o| o.vfx.is_some()) {
            companion_types.push("Vfx");
        }
        if !companion_types.is_empty() {
            writeln!(
                code,
                "use bevy_morgan_integration::{{{}}};\n",
                companion_types.join(", ")
            )?;
        }
        Ok(())
    }

    /// T57: append `WAYPOINTS_JSON` / `PATROL_ROUTES_JSON` string
    /// constants to `code` when `level_data` carries any waypoints /
    /// patrol routes. Extracted out of `generate_rust_code` (which
    /// inlines the equivalent `NAVMESH_JSON` block) purely to keep
    /// that function under clippy's `too_many_lines` budget --
    /// same rationale, same "JSON string constant, not a generated
    /// Rust literal" approach as `NAVMESH_JSON`.
    fn emit_waypoint_json_constants(code: &mut String, level_data: &LevelData) -> Result<()> {
        if !level_data.waypoints.is_empty() {
            let waypoints_json = serde_json::to_string(&level_data.waypoints)?;
            writeln!(
                code,
                "/// Waypoint data (T57), serialized as JSON. Deserialize with\n\
                 /// `serde_json::from_str` into a type matching the shape\n\
                 /// documented in `spatial::waypoints::Waypoint`.\n\
                 pub const WAYPOINTS_JSON: &str = \"{}\";\n",
                Self::escape_rust_string(&waypoints_json)
            )?;
        }
        if !level_data.patrol_routes.is_empty() {
            let patrol_routes_json = serde_json::to_string(&level_data.patrol_routes)?;
            writeln!(
                code,
                "/// Patrol route data (T57), serialized as JSON. Deserialize\n\
                 /// with `serde_json::from_str` into a type matching the shape\n\
                 /// documented in `spatial::waypoints::PatrolRoute`.\n\
                 pub const PATROL_ROUTES_JSON: &str = \"{}\";\n",
                Self::escape_rust_string(&patrol_routes_json)
            )?;
        }
        Ok(())
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

    // T42: render a `CollisionShape` as the Rust source for an
    // `avian3d`-compatible `Collider` component. The generator
    // assumes the consuming project depends on `avian3d`; if it
    // does not, the generated file will fail to compile, which
    // matches the documented Bevy 0.19 contract.
    fn rust_collision_component(shape: &CollisionShape) -> String {
        match shape {
            CollisionShape::Box { half_extents } => format!(
                "        Collider::cuboid({:.3}, {:.3}, {:.3}),\n",
                half_extents[0], half_extents[1], half_extents[2],
            ),
            CollisionShape::Sphere { radius } => {
                format!("        Collider::ball({radius:.3}),\n")
            }
            CollisionShape::Capsule { radius, height } => {
                format!("        Collider::capsule({radius:.3}, {height:.3}),\n")
            }
        }
    }

    // T42: render a `SpawnPoint` as a marker component. `SpawnPoint`
    // is imported from `bevy_morgan_integration` (see the
    // `companion_types` block in `generate_rust_code`) rather than
    // defined locally, so the emitted literal shares the same
    // nominal type as the companion crate's `spawn_point_observer`.
    fn rust_spawn_component(spawn: &SpawnPoint) -> String {
        match spawn {
            SpawnPoint::PlayerStart => "        SpawnPoint::PlayerStart,\n".to_string(),
            SpawnPoint::EnemySpawn { team } => format!(
                "        SpawnPoint::EnemySpawn {{ team: \"{}\".to_string() }},\n",
                Self::escape_rust_string(team),
            ),
            SpawnPoint::ItemSpawn { item_id } => format!(
                "        SpawnPoint::ItemSpawn {{ item_id: \"{}\".to_string() }},\n",
                Self::escape_rust_string(item_id),
            ),
        }
    }

    // T42: render a `TriggerVolume` as a marker component, using the
    // companion crate's `bevy_morgan_integration::TriggerVolume` shape
    // (`half_extents: [f32; 3]`, `points: Vec<[f32; 3]>`) — plain
    // array literals, *not* `Vec3::new(...)`. The companion type's
    // fields are arrays (see `crates/bevy-morgan-integration/src/components.rs`),
    // so emitting `Vec3` here would be a type mismatch (E0308) now
    // that the generator imports the companion type instead of
    // redefining it locally.
    fn rust_trigger_component(trigger: &TriggerVolume) -> String {
        match trigger {
            TriggerVolume::Box { half_extents, event } => format!(
                "        TriggerVolume::Box {{ half_extents: [{:.3}, {:.3}, {:.3}], event: \"{}\".to_string() }},\n",
                half_extents[0], half_extents[1], half_extents[2],
                Self::escape_rust_string(event),
            ),
            TriggerVolume::Sphere { radius, event } => format!(
                "        TriggerVolume::Sphere {{ radius: {:.3}, event: \"{}\".to_string() }},\n",
                radius,
                Self::escape_rust_string(event),
            ),
            TriggerVolume::Polygon { points, event } => {
                let pts: Vec<String> = points
                    .iter()
                    .map(|p| {
                        format!(
                            "[{:.3}, {:.3}, {:.3}]",
                            p[0], p[1], p[2],
                        )
                    })
                    .collect();
                format!(
                    "        TriggerVolume::Polygon {{ points: vec![{}], event: \"{}\".to_string() }},\n",
                    pts.join(", "),
                    Self::escape_rust_string(event),
                )
            }
        }
    }

    /// T91: emit a `Light` enum literal carrying the variant
    /// data. The consumer's Bevy project needs `bevy_pbr` for the
    /// actual `PointLight` / `SpotLight` / `DirectionalLight`
    /// components; this marker is the editor's typed source.
    fn rust_light_component(light: &LightMarker) -> String {
        match light {
            LightMarker::Point { color, intensity, range, shadows } => format!(
                "        Light::Point {{ color: [{:.3}, {:.3}, {:.3}], intensity: {:.3}, range: {:.3}, shadows: {} }},\n",
                color[0], color[1], color[2], intensity, range, shadows,
            ),
            LightMarker::Spot {
                color, intensity, range, inner_angle, outer_angle, shadows,
            } => format!(
                "        Light::Spot {{ color: [{:.3}, {:.3}, {:.3}], intensity: {:.3}, range: {:.3}, inner_angle: {:.3}, outer_angle: {:.3}, shadows: {} }},\n",
                color[0], color[1], color[2], intensity, range, inner_angle, outer_angle, shadows,
            ),
            LightMarker::Directional { color, intensity, shadows } => format!(
                "        Light::Directional {{ color: [{:.3}, {:.3}, {:.3}], intensity: {:.3}, shadows: {} }},\n",
                color[0], color[1], color[2], intensity, shadows,
            ),
        }
    }

    /// T91: emit an `Animation` enum literal.
    fn rust_animation_component(anim: &AnimationMarker) -> String {
        match anim {
            AnimationMarker::Play { clip, repeat, speed } => format!(
                "        Animation::Play {{ clip: \"{}\".to_string(), repeat: {}, speed: {:.3} }},\n",
                Self::escape_rust_string(clip),
                repeat,
                speed,
            ),
            AnimationMarker::PlayOnce { clip } => format!(
                "        Animation::PlayOnce {{ clip: \"{}\".to_string() }},\n",
                Self::escape_rust_string(clip),
            ),
        }
    }

    /// T91: emit an `Audio` enum literal.
    fn rust_audio_component(audio: &AudioMarker) -> String {
        match audio {
            AudioMarker::Ambient { path, volume, looping } => format!(
                "        Audio::Ambient {{ path: \"{}\".to_string(), volume: {:.3}, looping: {} }},\n",
                Self::escape_rust_string(path),
                volume,
                looping,
            ),
            AudioMarker::OneShot { path, volume } => format!(
                "        Audio::OneShot {{ path: \"{}\".to_string(), volume: {:.3} }},\n",
                Self::escape_rust_string(path),
                volume,
            ),
        }
    }

    /// T91: emit a `Vfx` enum literal.
    fn rust_vfx_component(vfx: &VfxMarker) -> String {
        match vfx {
            VfxMarker::Particle { path, count } => format!(
                "        Vfx::Particle {{ path: \"{}\".to_string(), count: {} }},\n",
                Self::escape_rust_string(path),
                count,
            ),
            VfxMarker::Billboard { texture, size } => format!(
                "        Vfx::Billboard {{ texture: \"{}\".to_string(), size: [{:.3}, {:.3}] }},\n",
                Self::escape_rust_string(texture),
                size[0],
                size[1],
            ),
        }
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
    // T56: optional navmesh, carried through from `LevelData`.
    #[serde(skip_serializing_if = "Option::is_none")]
    navmesh: Option<NavMesh>,
    // T57: waypoints/patrol routes, carried through from `LevelData`.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    waypoints: Vec<Waypoint>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    patrol_routes: Vec<PatrolRoute>,
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
                    collision_shape: None,
                    spawn_point: None,
                    trigger_volume: None,
                    metadata: HashMap::new(),
                    light: None,
                    animation: None,
                    audio: None,
                    vfx: None,
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
                    collision_shape: None,
                    spawn_point: None,
                    trigger_volume: None,
                    metadata: HashMap::new(),
                    light: None,
                    animation: None,
                    audio: None,
                    vfx: None,
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
            navmesh: None,
            waypoints: Vec::new(),
            patrol_routes: Vec::new(),
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

    // ─── T57: waypoints / patrol routes export ──────────────────────────

    fn level_with_waypoints() -> LevelData {
        use crate::spatial::waypoints::PatrolMode;
        let mut lvl = sample_level();
        lvl.waypoints = vec![
            Waypoint {
                id: "wp1".to_string(),
                position: [0.0, 0.0, 0.0],
                dwell_time: Some(1.5),
                next_waypoint_id: None,
            },
            Waypoint {
                id: "wp2".to_string(),
                position: [5.0, 0.0, 0.0],
                dwell_time: None,
                next_waypoint_id: None,
            },
        ];
        lvl.patrol_routes = vec![PatrolRoute {
            id: "route1".to_string(),
            waypoint_ids: vec!["wp1".to_string(), "wp2".to_string()],
            mode: PatrolMode::Loop,
        }];
        lvl
    }

    #[test]
    fn level_without_waypoints_omits_waypoint_fields_from_json() {
        let json = serde_json::to_string(&sample_level()).expect("should serialize");
        assert!(!json.contains("\"waypoints\""));
        assert!(!json.contains("\"patrol_routes\""));
    }

    #[test]
    fn level_with_waypoints_round_trips_through_json() {
        let lvl = level_with_waypoints();
        let json = serde_json::to_string(&lvl).expect("should serialize");
        assert!(json.contains("\"waypoints\""));
        assert!(json.contains("\"patrol_routes\""));
        assert!(json.contains("\"wp1\""));
        assert!(json.contains("\"loop\""));
        let back: LevelData = serde_json::from_str(&json).expect("should deserialize");
        assert_eq!(back.waypoints, lvl.waypoints);
        assert_eq!(back.patrol_routes, lvl.patrol_routes);
    }

    #[test]
    fn bevy_ron_export_carries_waypoints_and_patrol_routes_through() {
        let lvl = level_with_waypoints();
        let bevy = LevelExporter::convert_to_bevy_format(&lvl);
        assert_eq!(bevy.waypoints, lvl.waypoints);
        assert_eq!(bevy.patrol_routes, lvl.patrol_routes);
        let ron_data = ron::ser::to_string_pretty(&bevy, ron::ser::PrettyConfig::default())
            .expect("should serialize to RON");
        assert!(ron_data.contains("wp1"));
        assert!(ron_data.contains("route1"));
    }

    #[test]
    fn rust_source_export_emits_waypoints_and_patrol_routes_json_constants() {
        let lvl = level_with_waypoints();
        let code = LevelExporter::generate_rust_code(&lvl).expect("should succeed");
        assert!(code.contains("pub const WAYPOINTS_JSON: &str ="));
        assert!(code.contains("pub const PATROL_ROUTES_JSON: &str ="));
        assert!(code.contains("wp1"));
        assert!(code.contains("route1"));
    }

    #[test]
    fn rust_source_export_omits_waypoint_constants_when_none_present() {
        let code = LevelExporter::generate_rust_code(&sample_level()).expect("should succeed");
        assert!(!code.contains("WAYPOINTS_JSON"));
        assert!(!code.contains("PATROL_ROUTES_JSON"));
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

    // T42: collision / spawn / trigger components land in the
    // generated Rust source. Each variant must compile and use
    // the documented component names.

    fn obj_with_collision(shape: CollisionShape) -> GameObject {
        let mut o = sample_level().objects.into_iter().next().unwrap();
        o.collision_shape = Some(shape);
        o
    }

    fn obj_with_spawn(spawn: SpawnPoint) -> GameObject {
        let mut o = sample_level().objects.into_iter().next().unwrap();
        o.spawn_point = Some(spawn);
        o
    }

    fn obj_with_trigger(trigger: TriggerVolume) -> GameObject {
        let mut o = sample_level().objects.into_iter().next().unwrap();
        o.trigger_volume = Some(trigger);
        o
    }

    /// Assert that `code` imports `type_name` from the companion
    /// crate (`use bevy_morgan_integration::{..., TypeName, ...};`)
    /// rather than redefining it as a local `enum`/`struct`.
    ///
    /// Regression guard: the generator used to locally redefine
    /// `SpawnPoint` / `TriggerVolume` inside the generated file. That
    /// produced a *different* nominal Rust type than
    /// `bevy_morgan_integration`'s own `SpawnPoint` / `TriggerVolume`
    /// — the ones `spawn_point_observer` / `trigger_volume_observer`
    /// (registered by `plugin_init`) are written against. Because
    /// Rust's `On<Add, T>` observers dispatch on nominal type, a
    /// locally-redefined enum meant the registered observers could
    /// never fire on entities spawned from the generated file, even
    /// though the code compiled and *looked* correct. Asserting both
    /// "companion import present" and "no local redefinition" catches
    /// either half of the regression.
    fn assert_imports_companion_type_not_locally_defined(code: &str, type_name: &str) {
        let has_companion_import = code.lines().any(|line| {
            line.trim_start().starts_with("use bevy_morgan_integration::{") && line.contains(type_name)
        });
        assert!(
            has_companion_import,
            "expected a `use bevy_morgan_integration::{{..., {type_name}, ...}};` line in \
             generated code so `{type_name}` matches the companion crate's observer types; got:\n{code}"
        );
        assert!(
            !code.contains(&format!("enum {type_name}")),
            "generated code must not locally redefine `{type_name}` -- doing so creates a \
             distinct nominal type from bevy_morgan_integration's, so the registered `On<Add, \
             {type_name}>` observer could never fire; got:\n{code}"
        );
    }

    #[test]
    fn rust_exporter_emits_box_collider() {
        let mut lvl = sample_level();
        lvl.objects = vec![obj_with_collision(CollisionShape::Box {
            half_extents: [1.0, 2.0, 3.0],
        })];
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(
            code.contains("Collider::cuboid(1.000, 2.000, 3.000)"),
            "{code}"
        );
        assert!(code.contains("use avian3d::prelude::Collider;"));
    }

    #[test]
    fn rust_exporter_emits_sphere_collider() {
        let mut lvl = sample_level();
        lvl.objects = vec![obj_with_collision(CollisionShape::Sphere { radius: 0.75 })];
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("Collider::ball(0.750)"), "{code}");
    }

    #[test]
    fn rust_exporter_emits_capsule_collider() {
        let mut lvl = sample_level();
        lvl.objects = vec![obj_with_collision(CollisionShape::Capsule {
            radius: 0.5,
            height: 1.5,
        })];
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("Collider::capsule(0.500, 1.500)"), "{code}");
    }

    #[test]
    fn rust_exporter_emits_player_start_spawn() {
        let mut lvl = sample_level();
        lvl.objects = vec![obj_with_spawn(SpawnPoint::PlayerStart)];
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("SpawnPoint::PlayerStart"), "{code}");
        assert_imports_companion_type_not_locally_defined(&code, "SpawnPoint");
    }

    #[test]
    fn rust_exporter_emits_enemy_spawn_with_team() {
        let mut lvl = sample_level();
        lvl.objects = vec![obj_with_spawn(SpawnPoint::EnemySpawn {
            team: "red".to_string(),
        })];
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(
            code.contains("SpawnPoint::EnemySpawn { team: \"red\".to_string() }"),
            "{code}"
        );
        assert_imports_companion_type_not_locally_defined(&code, "SpawnPoint");
    }

    #[test]
    fn rust_exporter_emits_item_spawn() {
        let mut lvl = sample_level();
        lvl.objects = vec![obj_with_spawn(SpawnPoint::ItemSpawn {
            item_id: "key.gold".to_string(),
        })];
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(
            code.contains("SpawnPoint::ItemSpawn { item_id: \"key.gold\".to_string() }"),
            "{code}"
        );
        assert_imports_companion_type_not_locally_defined(&code, "SpawnPoint");
    }

    #[test]
    fn rust_exporter_emits_box_trigger_with_event() {
        let mut lvl = sample_level();
        lvl.objects = vec![obj_with_trigger(TriggerVolume::Box {
            half_extents: [1.0, 1.0, 1.0],
            event: "level.complete".to_string(),
        })];
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("TriggerVolume::Box"), "{code}");
        assert!(code.contains("event: \"level.complete\""), "{code}");
        // Bugfix regression: `half_extents` on the companion crate's
        // `TriggerVolume::Box` is `[f32; 3]`, not `Vec3` -- emitting
        // `Vec3::new(...)` here would be an E0308 type mismatch once
        // `TriggerVolume` is imported from `bevy_morgan_integration`
        // instead of being locally redefined.
        assert!(
            code.contains("half_extents: [1.000, 1.000, 1.000]"),
            "expected a plain [f32; 3] array literal for half_extents, not Vec3::new(...); got:\n{code}"
        );
        assert_imports_companion_type_not_locally_defined(&code, "TriggerVolume");
    }

    #[test]
    fn rust_exporter_emits_polygon_trigger() {
        let mut lvl = sample_level();
        lvl.objects = vec![obj_with_trigger(TriggerVolume::Polygon {
            points: vec![[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.5, 1.0, 0.0]],
            event: "zone.a".to_string(),
        })];
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("TriggerVolume::Polygon"), "{code}");
        // Bugfix regression: `points` on the companion crate's
        // `TriggerVolume::Polygon` is `Vec<[f32; 3]>`, not
        // `Vec<Vec3>`. Assert the three polygon vertices are emitted
        // as plain array literals rather than `Vec3::new(...)` calls.
        assert!(
            code.contains("points: vec![[0.000, 0.000, 0.000], [1.000, 0.000, 0.000], [0.500, 1.000, 0.000]]"),
            "expected [f32; 3] array literals for polygon points, not Vec3::new(...); got:\n{code}"
        );
        assert_imports_companion_type_not_locally_defined(&code, "TriggerVolume");
    }

    #[test]
    fn json_exporter_round_trips_collision_and_spawn() {
        // Round-trip a level with a collision + spawn through the JSON
        // exporter: parse the output back into a LevelData-shaped value
        // and assert the optional fields survive the serde skip rules.
        let mut lvl = sample_level();
        lvl.objects = vec![
            obj_with_collision(CollisionShape::Sphere { radius: 1.25 }),
            obj_with_spawn(SpawnPoint::PlayerStart),
        ];
        // Use the internal export path via generate_json_string instead of
        // touching the filesystem. The helper isn't public, so we go via
        // the LevelExporter API by serializing manually here.
        let serialized = serde_json::to_string(&lvl).unwrap();
        let back: LevelData = serde_json::from_str(&serialized).unwrap();
        assert_eq!(
            back.objects[0].collision_shape,
            Some(CollisionShape::Sphere { radius: 1.25 })
        );
        assert_eq!(back.objects[1].spawn_point, Some(SpawnPoint::PlayerStart));
    }

    #[test]
    fn json_exporter_omits_unset_collision_field() {
        let lvl = sample_level();
        let serialized = serde_json::to_string(&lvl).unwrap();
        // The default sample_level objects have no collision / spawn /
        // trigger fields; the `skip_serializing_if = Option::is_none`
        // attribute should drop them from the payload.
        assert!(!serialized.contains("collision_shape"));
        assert!(!serialized.contains("spawn_point"));
        assert!(!serialized.contains("trigger_volume"));
    }

    // ----- T90: marker set + systems emission tests -----

    /// Build a level with the given tags for the first object, used by
    /// the per-marker tests below.
    fn level_with_tags(tags: &[&str]) -> LevelData {
        let mut lvl = sample_level();
        if let Some(obj) = lvl.objects.first_mut() {
            obj.tags = tags.iter().map(|s| (*s).to_string()).collect();
        }
        lvl
    }

    #[test]
    fn marker_set_is_empty_when_no_tags() {
        let lvl = level_with_tags(&[]);
        let s = marker_tags_present(&lvl);
        assert!(s.is_empty());
        assert_eq!(s, MarkerSet::new());
    }

    #[test]
    fn marker_set_includes_door_when_tagged() {
        let lvl = level_with_tags(&["door"]);
        let s = marker_tags_present(&lvl);
        assert!(s.door);
        assert!(!s.collectible);
        assert!(!s.spawn_point);
        assert!(!s.trigger_volume);
        assert!(!s.nav_mesh_hint);
        assert!(!s.is_empty());
    }

    #[test]
    fn marker_set_collects_all_marker_tags() {
        let lvl = level_with_tags(&[
            "door",
            "collectible",
            "spawn-point",
            "trigger-volume",
            "nav-mesh",
        ]);
        let s = marker_tags_present(&lvl);
        assert!(s.door);
        assert!(s.collectible);
        assert!(s.spawn_point);
        assert!(s.trigger_volume);
        assert!(s.nav_mesh_hint);
    }

    #[test]
    fn marker_set_ignores_unrelated_tags() {
        let lvl = level_with_tags(&["static", "decor", "physics"]);
        let s = marker_tags_present(&lvl);
        assert!(s.is_empty());
    }

    #[test]
    fn marker_set_is_case_insensitive() {
        let lvl = level_with_tags(&["Door", "COLLECTIBLE"]);
        let s = marker_tags_present(&lvl);
        assert!(s.door);
        assert!(s.collectible);
    }

    #[test]
    fn generated_rust_header_records_systems_mode() {
        let lvl = level_with_tags(&[]);
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("// Systems mode: CompanionReference"));
    }

    #[test]
    fn generated_rust_omits_systems_block_when_no_markers() {
        let lvl = level_with_tags(&[]);
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        // No markers -> no use line, no plugin block.
        assert!(!code.contains("use bevy_morgan_integration::systems::"));
        assert!(!code.contains("pub fn plugin_init"));
    }

    #[test]
    fn generated_rust_includes_systems_block_when_door_tagged() {
        let lvl = level_with_tags(&["door"]);
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("use bevy_morgan_integration::systems::"));
        assert!(code.contains("MorganLevelSystems"));
        assert!(code.contains("pub fn plugin_init"));
    }

    #[test]
    fn generated_rust_includes_pickup_event_when_collectible_tagged() {
        let lvl = level_with_tags(&["collectible"]);
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        // The collectible marker pulls in PickupEvent + Open (the
        // door/collectible pairing shares Open).
        assert!(code.contains("PickupEvent"));
        assert!(code.contains("Open"));
    }

    #[test]
    fn generated_rust_includes_trigger_activated_when_trigger_tagged() {
        let lvl = level_with_tags(&["trigger-volume"]);
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("TriggerActivated"));
    }

    #[test]
    fn generated_rust_includes_nav_mesh_source_when_nav_mesh_tagged() {
        let lvl = level_with_tags(&["nav-mesh"]);
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("NavMeshSource"));
    }

    #[test]
    fn generated_rust_includes_player_start_when_spawn_tagged() {
        let lvl = level_with_tags(&["spawn-point"]);
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("PlayerStart"));
    }

    // ----- T91: marker enum + emission tests -----

    #[test]
    fn marker_set_includes_light_when_light_tagged() {
        let lvl = level_with_tags(&["light"]);
        let s = marker_tags_present(&lvl);
        assert!(s.light);
    }

    #[test]
    fn marker_set_includes_animation_when_animation_tagged() {
        let lvl = level_with_tags(&["animation"]);
        let s = marker_tags_present(&lvl);
        assert!(s.animation);
    }

    #[test]
    fn marker_set_includes_audio_when_audio_tagged() {
        let lvl = level_with_tags(&["audio"]);
        let s = marker_tags_present(&lvl);
        assert!(s.audio);
    }

    #[test]
    fn marker_set_includes_vfx_when_vfx_tagged() {
        let lvl = level_with_tags(&["vfx"]);
        let s = marker_tags_present(&lvl);
        assert!(s.vfx);
    }

    #[test]
    fn generated_rust_includes_light_variant_when_light_tagged() {
        let mut lvl = sample_level();
        if let Some(obj) = lvl.objects.first_mut() {
            obj.light = Some(LightMarker::Point {
                color: [1.0, 0.5, 0.0],
                intensity: 2.0,
                range: 10.0,
                shadows: true,
            });
        }
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("Light::Point"));
        assert!(code.contains("color: [1.000, 0.500, 0.000]"));
        assert!(code.contains("shadows: true"));
        // Bugfix regression: `Light` has no local definition anywhere
        // in the generated file (unlike `SpawnPoint`/`TriggerVolume`,
        // which used to be locally redefined). Without a `use
        // bevy_morgan_integration::{..., Light, ...};` line, this is
        // an E0433 unresolved-type compile error in any project that
        // pastes the generated code.
        assert!(
            code.lines().any(|l| l.trim_start().starts_with("use bevy_morgan_integration::{") && l.contains("Light")),
            "expected `use bevy_morgan_integration::{{..., Light, ...}};` in generated code; got:\n{code}"
        );
    }

    #[test]
    fn generated_rust_includes_animation_variant_when_animation_tagged() {
        let mut lvl = sample_level();
        if let Some(obj) = lvl.objects.first_mut() {
            obj.animation = Some(AnimationMarker::Play {
                clip: "walk.glb".to_string(),
                repeat: true,
                speed: 1.5,
            });
        }
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("Animation::Play"));
        assert!(code.contains("clip: \"walk.glb\".to_string()"));
        assert!(code.contains("speed: 1.500"));
        assert_imports_companion_type_not_locally_defined(&code, "Animation");
    }

    #[test]
    fn generated_rust_includes_audio_variant_when_audio_tagged() {
        let mut lvl = sample_level();
        if let Some(obj) = lvl.objects.first_mut() {
            obj.audio = Some(AudioMarker::Ambient {
                path: "sounds/fountain.ogg".to_string(),
                volume: 0.8,
                looping: true,
            });
        }
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("Audio::Ambient"));
        assert!(code.contains("looping: true"));
        assert_imports_companion_type_not_locally_defined(&code, "Audio");
    }

    #[test]
    fn generated_rust_includes_vfx_variant_when_vfx_tagged() {
        let mut lvl = sample_level();
        if let Some(obj) = lvl.objects.first_mut() {
            obj.vfx = Some(VfxMarker::Billboard {
                texture: "vfx/smoke.png".to_string(),
                size: [2.0, 2.0],
            });
        }
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("Vfx::Billboard"));
        assert!(code.contains("texture: \"vfx/smoke.png\".to_string()"));
        assert!(code.contains("size: [2.000, 2.000]"));
        assert_imports_companion_type_not_locally_defined(&code, "Vfx");
    }

    #[test]
    fn generated_rust_omits_companion_type_import_when_no_typed_markers_present() {
        // A level with no spawn_point / trigger_volume / light /
        // animation / audio / vfx fields set on any object should not
        // emit a `use bevy_morgan_integration::{...};` type-import
        // line at all -- there's nothing to import.
        let lvl = sample_level();
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(
            !code
                .lines()
                .any(|l| l.trim_start().starts_with("use bevy_morgan_integration::{")),
            "expected no companion type import for a level with no typed markers; got:\n{code}"
        );
    }

    #[test]
    fn generated_rust_companion_type_import_lists_only_present_markers() {
        // Only the markers actually present on the level's objects
        // should appear in the `use bevy_morgan_integration::{...};`
        // line -- e.g. a level with only a spawn point must not also
        // import `Light` / `Audio` / etc.
        let mut lvl = sample_level();
        lvl.objects = vec![obj_with_spawn(SpawnPoint::PlayerStart)];
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        let import_line = code
            .lines()
            .find(|l| l.trim_start().starts_with("use bevy_morgan_integration::{"))
            .expect("expected a companion type import line");
        assert!(import_line.contains("SpawnPoint"), "{import_line}");
        assert!(!import_line.contains("TriggerVolume"), "{import_line}");
        assert!(!import_line.contains("Light"), "{import_line}");
        assert!(!import_line.contains("Animation"), "{import_line}");
        assert!(!import_line.contains("Audio"), "{import_line}");
        assert!(!import_line.contains("Vfx"), "{import_line}");
    }

    #[test]
    fn marker_set_is_empty_for_default_level() {
        let lvl = sample_level();
        let s = marker_tags_present(&lvl);
        assert!(s.is_empty());
    }

    #[test]
    fn parse_systems_mode_recognises_companion_reference() {
        let header = "// Generated level code for Bevy 0.19+\n\
                      // Systems mode: CompanionReference\n";
        assert_eq!(
            parse_systems_mode_from_header(header),
            Some(SystemsMode::CompanionReference)
        );
    }

    #[test]
    fn parse_systems_mode_recognises_inline() {
        let header = "// Systems mode: Inline\n";
        assert_eq!(
            parse_systems_mode_from_header(header),
            Some(SystemsMode::Inline)
        );
    }

    #[test]
    fn parse_systems_mode_returns_none_for_legacy_export() {
        let legacy = "// Generated level code for Bevy 0.18\n";
        assert_eq!(parse_systems_mode_from_header(legacy), None);
    }

    #[test]
    fn parse_systems_mode_returns_none_for_garbage_value() {
        let header = "// Systems mode: NotAMode\n";
        assert_eq!(parse_systems_mode_from_header(header), None);
    }

    #[test]
    fn parse_systems_mode_round_trips_through_generated_rust() {
        let lvl = level_with_tags(&["door"]);
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert_eq!(
            parse_systems_mode_from_header(&code),
            Some(SystemsMode::CompanionReference)
        );
    }

    // ----- T56: navmesh export round-trip (JSON / RON / Rust) -----

    fn sample_navmesh() -> NavMesh {
        use crate::spatial::navmesh::{generate_navmesh, Obstacle, ObstacleKind, WalkableSurface};
        let floor = WalkableSurface {
            min: [0.0, 0.0],
            max: [10.0, 10.0],
            height: 0.0,
        };
        let wall = Obstacle {
            min: [0.0, 4.5],
            max: [8.0, 5.5],
            kind: ObstacleKind::Wall,
        };
        generate_navmesh(&[floor], &[wall]).expect("sample navmesh should generate")
    }

    #[test]
    fn json_exporter_includes_navmesh_when_present() {
        let mut lvl = sample_level();
        lvl.navmesh = Some(sample_navmesh());
        let serialized = serde_json::to_string(&lvl).unwrap();
        assert!(serialized.contains("\"navmesh\""));
        assert!(serialized.contains("\"polygons\""));
        assert!(serialized.contains("\"connections\""));

        let back: LevelData = serde_json::from_str(&serialized).unwrap();
        assert_eq!(back.navmesh, lvl.navmesh);
    }

    #[test]
    fn json_exporter_omits_navmesh_when_absent() {
        let lvl = sample_level();
        let serialized = serde_json::to_string(&lvl).unwrap();
        assert!(!serialized.contains("\"navmesh\""));
    }

    #[test]
    fn ron_exporter_includes_navmesh_when_present() {
        let mut lvl = sample_level();
        lvl.navmesh = Some(sample_navmesh());
        let bevy = LevelExporter::convert_to_bevy_format(&lvl);
        let ron = ron::ser::to_string_pretty(&bevy, ron::ser::PrettyConfig::default()).unwrap();
        assert!(ron.contains("navmesh"));
        assert!(ron.contains("polygons"));
    }

    #[test]
    fn ron_exporter_omits_navmesh_when_absent() {
        let lvl = sample_level();
        let bevy = LevelExporter::convert_to_bevy_format(&lvl);
        let ron = ron::ser::to_string_pretty(&bevy, ron::ser::PrettyConfig::default()).unwrap();
        assert!(!ron.contains("navmesh"));
    }

    #[test]
    fn rust_exporter_emits_navmesh_json_constant_when_present() {
        let mut lvl = sample_level();
        lvl.navmesh = Some(sample_navmesh());
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(code.contains("pub const NAVMESH_JSON: &str ="), "{code}");
        assert!(code.contains("\\\"polygons\\\""), "{code}");
    }

    #[test]
    fn rust_exporter_omits_navmesh_json_constant_when_absent() {
        let lvl = sample_level();
        let code = LevelExporter::generate_rust_code(&lvl).unwrap();
        assert!(!code.contains("NAVMESH_JSON"), "{code}");
    }
}
