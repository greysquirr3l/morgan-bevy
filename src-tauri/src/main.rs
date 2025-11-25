//! Morgan-Bevy 3D Level Editor & Procedural Generator
//!
//! A hybrid Rust/TypeScript 3D level editor for Bevy game development that combines
//! procedural generation (BSP, WFC) with professional manual editing capabilities.
//!
//! This crate provides the Tauri backend for the Morgan-Bevy editor, handling:
//! - Asset management and scanning
//! - Spatial indexing for 3D operations  
//! - BSP and WFC procedural generation algorithms
//! - Export system for multiple formats (JSON, RON, Rust code)
//! - File I/O and project management

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::{error, info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

mod assets;
mod export;
mod generation;
mod spatial;

use assets::AssetDatabaseState;
use export::{ExportFormat, LevelExporter};
use generation::bsp::BSPGenerator;
use generation::wfc::{WFCGenerationParams, WFCGenerator};
use spatial::{BoundingBox, SpatialIndex};
use std::path::PathBuf;

use generation::themes::{Theme, ThemeLibrary};

// Core data structures for level editing
/// 3D transformation data for positioning, rotating, and scaling objects in 3D space.
///
/// Uses standard 3D graphics conventions with Y-up coordinate system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transform3D {
    /// Position coordinates in 3D space [x, y, z] in world units
    pub position: [f32; 3],
    /// Rotation as quaternion [x, y, z, w] for smooth interpolation
    pub rotation: [f32; 4], // quaternion [x, y, z, w]
    /// Scale factors [x, y, z] for non-uniform scaling support
    pub scale: [f32; 3],
}

/// Represents a 3D object in the editor with transform, material, and metadata.
///
/// GameObjects are the fundamental building blocks of levels in Morgan-Bevy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameObject {
    /// Unique identifier for the object within the level
    pub id: String,
    /// Human-readable name displayed in the editor hierarchy
    pub name: String,
    /// 3D transformation (position, rotation, scale) data
    pub transform: Transform3D,
    /// Optional material reference for rendering
    pub material: Option<String>,
    /// Optional mesh reference for geometry
    pub mesh: Option<String>,
    /// Layer assignment for organization and visibility control
    pub layer: String,
    /// Tags for categorization and scripting hooks
    pub tags: Vec<String>,
    /// Additional metadata for custom properties and game logic
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Complete level data containing all objects, layers, and generation information.
///
/// This is the main data structure for saving and loading levels in Morgan-Bevy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LevelData {
    /// Unique identifier for the level
    pub id: String,
    /// Human-readable level name
    pub name: String,
    /// All game objects contained in this level
    pub objects: Vec<GameObject>,
    /// Layer names for organization and visibility control
    pub layers: Vec<String>,
    /// Random seed used for procedural generation (if applicable)
    pub generation_seed: Option<u64>,
    /// Parameters used for procedural generation algorithms
    pub generation_params: Option<serde_json::Value>,
    /// 3D bounding box defining the level's spatial extent
    pub bounds: BoundingBox,
}

/// Project data for saving and loading complete editor sessions.
///
/// Contains versioning information and scene state for persistence.
#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectData {
    /// Morgan-Bevy version used to create this project
    pub version: String,
    /// ISO timestamp of when the project was last saved
    pub timestamp: String,
    /// Complete scene data including objects, settings, and editor state
    pub scene: serde_json::Value,
}

/// Parameters for Binary Space Partitioning (BSP) level generation.
///
/// Controls the procedural generation of rooms and corridors using BSP algorithm.
#[derive(Debug, Serialize, Deserialize)]
pub struct BSPGenerationParams {
    /// Level width in grid units
    pub width: u32,
    /// Level height in grid units
    pub height: u32,
    /// Level depth/floors for multi-story generation
    pub depth: u32,
    /// Minimum room size to prevent tiny rooms
    pub min_room_size: u32,
    /// Maximum room size to prevent oversized rooms
    pub max_room_size: u32,
    /// Width of corridors connecting rooms
    pub corridor_width: u32,
    /// Theme name determining tiles, materials, and styling
    pub theme: String,
    /// Optional random seed for reproducible generation
    pub seed: Option<u64>,
}

// Application state
/// Global application state managed by Tauri for the Morgan-Bevy editor.
///
/// Maintains the current level data and spatial indexing for efficient 3D operations.
#[derive(Debug)]
pub struct AppState {
    /// Currently loaded level data, None if no level is open
    pub current_level: Option<LevelData>,
    /// Spatial index for fast 3D queries (selection, collision, etc.)
    pub spatial_index: SpatialIndex,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_level: None,
            spatial_index: SpatialIndex::new(),
        }
    }
}

// Tauri Commands

// Theme System Commands
#[tauri::command]
async fn get_available_themes() -> Result<Vec<Theme>, String> {
    info!("Getting available themes");
    Ok(ThemeLibrary::get_all_themes())
}

#[tauri::command]
async fn get_theme_by_id(theme_id: String) -> Result<Theme, String> {
    info!("Getting theme by ID: {}", theme_id);
    match ThemeLibrary::get_theme(&theme_id) {
        Some(theme) => Ok(theme),
        None => Err(format!("Theme not found: {}", theme_id)),
    }
}

#[tauri::command]
async fn get_theme_legend(theme_id: String) -> Result<String, String> {
    info!("Getting theme legend for: {}", theme_id);
    match ThemeLibrary::get_theme(&theme_id) {
        Some(theme) => Ok(generation::themes::generate_theme_legend(&theme)),
        None => Err(format!("Theme not found: {}", theme_id)),
    }
}

#[tauri::command]
async fn parse_grid_to_tiles(
    theme_id: String,
    grid_string: String,
) -> Result<Vec<Vec<String>>, String> {
    info!("Parsing grid string to tiles for theme: {}", theme_id);
    match ThemeLibrary::get_theme(&theme_id) {
        Some(theme) => Ok(generation::themes::parse_grid_string(&theme, &grid_string)),
        None => Err(format!("Theme not found: {}", theme_id)),
    }
}

#[tauri::command]
async fn render_tiles_to_grid(
    theme_id: String,
    tile_map: Vec<Vec<String>>,
) -> Result<String, String> {
    info!("Rendering tiles to grid string for theme: {}", theme_id);
    match ThemeLibrary::get_theme(&theme_id) {
        Some(theme) => Ok(generation::themes::render_grid_string(&theme, &tile_map)),
        None => Err(format!("Theme not found: {}", theme_id)),
    }
}

// Level Generation Commands

#[tauri::command]
async fn generate_bsp_level(
    params: BSPGenerationParams,
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<LevelData, String> {
    info!("Generating BSP level with params: {:?}", params);

    let generator = BSPGenerator::new();
    match generator.generate(params).await {
        Ok(level_data) => {
            // Update application state
            let mut app_state = state.lock().unwrap();
            app_state.spatial_index.clear();
            for obj in &level_data.objects {
                app_state.spatial_index.insert(&obj.id, &obj.transform);
            }
            app_state.current_level = Some(level_data.clone());

            info!(
                "Successfully generated level with {} objects",
                level_data.objects.len()
            );
            Ok(level_data)
        }
        Err(e) => {
            error!("Failed to generate BSP level: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn generate_wfc_level(
    params: WFCGenerationParams,
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<LevelData, String> {
    info!("Generating WFC level with params: {:?}", params);

    let mut generator = WFCGenerator::new();
    match generator.generate(params).await {
        Ok(level_data) => {
            // Update application state
            let mut app_state = state.lock().unwrap();
            app_state.spatial_index.clear();
            for obj in &level_data.objects {
                app_state.spatial_index.insert(&obj.id, &obj.transform);
            }
            app_state.current_level = Some(level_data.clone());

            info!(
                "Successfully generated WFC level with {} objects",
                level_data.objects.len()
            );
            Ok(level_data)
        }
        Err(e) => {
            error!("Failed to generate WFC level: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn export_level(
    level_data: LevelData,
    formats: Vec<ExportFormat>,
    output_path: String,
) -> Result<export::exporters::ExportResult, String> {
    info!(
        "Exporting level to {:?} formats at path: {}",
        formats, output_path
    );

    let exporter = LevelExporter::new();
    match exporter
        .export_multi_format(&level_data, &formats, &output_path)
        .await
    {
        Ok(export_result) => {
            info!(
                "Successfully exported {} objects in {}ms",
                export_result.total_objects, export_result.export_time_ms
            );
            for file in &export_result.exported_files {
                if file.success {
                    info!(
                        "Exported {:?} to: {} ({} bytes)",
                        file.format, file.file_path, file.file_size
                    );
                }
            }
            Ok(export_result)
        }
        Err(e) => {
            error!("Failed to export level: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn query_objects_in_bounds(
    bounds: BoundingBox,
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<Vec<String>, String> {
    let app_state = state.lock().unwrap();
    let object_ids = app_state.spatial_index.query_bounds(&bounds);
    Ok(object_ids)
}

#[tauri::command]
async fn update_object_transform(
    object_id: String,
    transform: Transform3D,
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let mut app_state = state.lock().unwrap();

    if let Some(ref mut level) = app_state.current_level {
        if let Some(obj) = level.objects.iter_mut().find(|o| o.id == object_id) {
            obj.transform = transform.clone();
            app_state.spatial_index.update(&object_id, &transform);
            info!("Updated transform for object: {}", object_id);
            Ok(())
        } else {
            Err(format!("Object not found: {}", object_id))
        }
    } else {
        Err("No level currently loaded".to_string())
    }
}

#[tauri::command]
async fn get_current_level(
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<Option<LevelData>, String> {
    let app_state = state.lock().unwrap();
    Ok(app_state.current_level.clone())
}

#[tauri::command]
async fn save_level_to_file(level_data: LevelData, file_path: String) -> Result<(), String> {
    info!("Saving level to file: {}", file_path);

    let json_data = serde_json::to_string_pretty(&level_data)
        .map_err(|e| format!("Failed to serialize level data: {}", e))?;

    std::fs::write(&file_path, json_data).map_err(|e| format!("Failed to write file: {}", e))?;

    info!("Successfully saved level to: {}", file_path);
    Ok(())
}

#[tauri::command]
async fn load_level_from_file(
    file_path: String,
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<LevelData, String> {
    info!("Loading level from file: {}", file_path);

    let file_content =
        std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let level_data: LevelData = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse level data: {}", e))?;

    // Update application state
    let mut app_state = state.lock().unwrap();
    app_state.spatial_index.clear();
    for obj in &level_data.objects {
        app_state.spatial_index.insert(&obj.id, &obj.transform);
    }
    app_state.current_level = Some(level_data.clone());

    info!(
        "Successfully loaded level with {} objects",
        level_data.objects.len()
    );
    Ok(level_data)
}

#[tauri::command]
async fn export_level_simple(
    level_data: LevelData,
    format: String,
    output_path: Option<String>,
) -> Result<String, String> {
    info!("Exporting level in format: {}", format);

    let export_format = match format.as_str() {
        "json" => ExportFormat::JSON,
        "ron" => ExportFormat::RON,
        "rust" => ExportFormat::RustCode,
        _ => return Err(format!("Unsupported export format: {}", format)),
    };

    // Use file dialog if no output path provided
    let base_path = if let Some(p) = output_path {
        PathBuf::from(p)
    } else {
        // Show save dialog
        use rfd::FileDialog;
        let extension = export_format.file_extension();

        match FileDialog::new()
            .add_filter(&format!("{} files", format.to_uppercase()), &[extension])
            .set_file_name(&format!("level.{}", extension))
            .save_file()
        {
            Some(path) => path,
            None => return Err("Export cancelled by user".to_string()),
        }
    };

    let exporter = LevelExporter::new();
    match exporter
        .export_multi_format(&level_data, &[export_format], &base_path.to_string_lossy())
        .await
    {
        Ok(result) => {
            if let Some(file) = result.exported_files.first() {
                if file.success {
                    info!("Successfully exported level to: {}", file.file_path);
                    Ok(file.file_path.clone())
                } else {
                    Err("Export failed".to_string())
                }
            } else {
                Err("No files exported".to_string())
            }
        }
        Err(e) => {
            error!("Failed to export level: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn save_project(project_data: ProjectData) -> Result<String, String> {
    info!("Saving project");

    use rfd::FileDialog;
    let path = match FileDialog::new()
        .add_filter("Morgan-Bevy Project", &["mbp"])
        .set_file_name("project.mbp")
        .save_file()
    {
        Some(path) => path,
        None => return Err("Save cancelled by user".to_string()),
    };

    let json_data = serde_json::to_string_pretty(&project_data)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;

    std::fs::write(&path, json_data).map_err(|e| format!("Failed to write project file: {}", e))?;

    info!("Successfully saved project to: {:?}", path);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn load_project() -> Result<ProjectData, String> {
    info!("Loading project");

    use rfd::FileDialog;
    let path = match FileDialog::new()
        .add_filter("Morgan-Bevy Project", &["mbp"])
        .pick_file()
    {
        Some(path) => path,
        None => return Err("Load cancelled by user".to_string()),
    };

    let json_data = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read project file: {}", e))?;

    let project_data: ProjectData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse project file: {}", e))?;

    info!("Successfully loaded project from: {:?}", path);
    Ok(project_data)
}

fn main() {
    env_logger::init();
    info!("Starting Morgan-Bevy Level Editor");

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(std::sync::Mutex::new(AppState::default()))
        .manage(AssetDatabaseState::new())
        .invoke_handler(tauri::generate_handler![
            // Theme System
            get_available_themes,
            get_theme_by_id,
            get_theme_legend,
            parse_grid_to_tiles,
            render_tiles_to_grid,
            // Level Generation
            generate_bsp_level,
            generate_wfc_level,
            // Export System
            export_level,
            export_level_simple,
            // Project Management
            save_project,
            load_project,
            // Spatial Queries
            query_objects_in_bounds,
            update_object_transform,
            get_current_level,
            save_level_to_file,
            load_level_from_file,
            // Legacy Asset System
            assets::scan_assets,
            assets::browse_assets_folder,
            assets::scan_assets_folder,
            // New Asset Database System
            assets::initialize_asset_database,
            assets::scan_assets_database,
            assets::search_assets_database,
            assets::get_asset_database_stats,
            assets::get_asset_collections
        ])
        .setup(|app| {
            info!("Tauri application setup complete");

            // Initialize asset database in the background
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = assets::initialize_asset_database(handle).await {
                    error!("Failed to initialize asset database: {}", e);
                } else {
                    info!("Asset database initialized successfully");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
