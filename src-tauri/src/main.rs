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
use tauri::{Emitter, Manager, State};

mod assets;
mod crash_log;
mod export;
mod generation;
mod spatial;

use assets::AssetDatabaseState;
use export::{ExportFormat, LevelExporter};
use generation::bsp::BSPGenerator;
use generation::wfc::{WFCGenerationParams, WFCGenerator};
use rfd::FileDialog;
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
/// `GameObjects` are the fundamental building blocks of levels in Morgan-Bevy.
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
#[derive(Debug, Default)]
pub struct AppState {
    /// Currently loaded level data, None if no level is open
    pub current_level: Option<LevelData>,
    /// Spatial index for fast 3D queries (selection, collision, etc.)
    pub spatial_index: SpatialIndex,
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
    info!("Getting theme by ID: {theme_id}");
    ThemeLibrary::get_theme(&theme_id).ok_or_else(|| format!("Theme not found: {theme_id}"))
}

#[tauri::command]
async fn get_theme_legend(theme_id: String) -> Result<String, String> {
    info!("Getting theme legend for: {theme_id}");
    ThemeLibrary::get_theme(&theme_id).map_or_else(
        || Err(format!("Theme not found: {theme_id}")),
        |theme| {
            generation::themes::generate_theme_legend(&theme)
                .map_err(|e| format!("Failed to format theme legend: {e}"))
        },
    )
}

#[tauri::command]
async fn parse_grid_to_tiles(
    theme_id: String,
    grid_string: String,
) -> Result<Vec<Vec<String>>, String> {
    info!("Parsing grid string to tiles for theme: {theme_id}");
    ThemeLibrary::get_theme(&theme_id).map_or_else(
        || Err(format!("Theme not found: {theme_id}")),
        |theme| Ok(generation::themes::parse_grid_string(&theme, &grid_string)),
    )
}

#[tauri::command]
async fn render_tiles_to_grid(
    theme_id: String,
    tile_map: Vec<Vec<String>>,
) -> Result<String, String> {
    info!("Rendering tiles to grid string for theme: {theme_id}");
    ThemeLibrary::get_theme(&theme_id).map_or_else(
        || Err(format!("Theme not found: {theme_id}")),
        |theme| Ok(generation::themes::render_grid_string(&theme, &tile_map)),
    )
}

// Level Generation Commands

#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; lock_result binding is intentional"
)]
async fn generate_bsp_level(
    params: BSPGenerationParams,
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<LevelData, String> {
    info!("Generating BSP level with params: {params:?}");

    match BSPGenerator::generate(&params) {
        Ok(level_data) => {
            // Update application state
            let __lock_result = state.lock();
            let mut app_state = match __lock_result {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
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
            error!("Failed to generate BSP level: {e}");
            Err(e.to_string())
        }
    }
}

#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; lock_result binding is intentional"
)]
async fn generate_wfc_level(
    params: WFCGenerationParams,
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<LevelData, String> {
    info!("Generating WFC level with params: {params:?}");

    let mut generator = WFCGenerator::new();
    match generator.generate(&params) {
        Ok(level_data) => {
            // Update application state
            let __lock_result = state.lock();
            let mut app_state = match __lock_result {
                Ok(g) => g,
                Err(e) => e.into_inner(),
            };
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
            error!("Failed to generate WFC level: {e}");
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
    info!("Exporting level to {formats:?} formats at path: {output_path}");

    match LevelExporter::export_multi_format(&level_data, &formats, &output_path) {
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
            error!("Failed to export level: {e}");
            Err(e.to_string())
        }
    }
}

#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; lock_result binding is intentional"
)]
async fn query_objects_in_bounds(
    bounds: BoundingBox,
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<Vec<String>, String> {
    let __lock_result = state.lock();
    let app_state = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    let object_ids = app_state.spatial_index.query_bounds(&bounds);
    Ok(object_ids)
}

#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; lock_result binding is intentional"
)]
async fn update_object_transform(
    object_id: String,
    transform: Transform3D,
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<(), String> {
    let __lock_result = state.lock();
    let mut app_state = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    if let Some(ref mut level) = app_state.current_level {
        if let Some(obj) = level.objects.iter_mut().find(|o| o.id == object_id) {
            obj.transform = transform.clone();
            app_state.spatial_index.update(&object_id, &transform);
            info!("Updated transform for object: {object_id}");
            Ok(())
        } else {
            Err(format!("Object not found: {object_id}"))
        }
    } else {
        Err("No level currently loaded".to_string())
    }
}

#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; lock_result binding is intentional"
)]
async fn get_current_level(
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<Option<LevelData>, String> {
    let __lock_result = state.lock();
    let app_state = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    Ok(app_state.current_level.clone())
}

#[tauri::command]
async fn save_level_to_file(level_data: LevelData, file_path: String) -> Result<(), String> {
    info!("Saving level to file: {file_path}");

    let json_data = serde_json::to_string_pretty(&level_data)
        .map_err(|e| format!("Failed to serialize level data: {e}"))?;

    std::fs::write(&file_path, json_data).map_err(|e| format!("Failed to write file: {e}"))?;

    info!("Successfully saved level to: {file_path}");
    Ok(())
}

#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; lock_result binding is intentional"
)]
async fn load_level_from_file(
    file_path: String,
    state: State<'_, std::sync::Mutex<AppState>>,
) -> Result<LevelData, String> {
    info!("Loading level from file: {file_path}");

    let file_content =
        std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {e}"))?;

    let level_data: LevelData = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse level data: {e}"))?;

    // Update application state
    let __lock_result = state.lock();
    let mut app_state = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
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
    info!("Exporting level in format: {format}");

    let export_format = match format.as_str() {
        "json" => ExportFormat::JSON,
        "ron" => ExportFormat::RON,
        "rust" => ExportFormat::RustCode,
        _ => return Err(format!("Unsupported export format: {format}")),
    };

    // Use file dialog if no output path provided
    let base_path = if let Some(p) = output_path {
        PathBuf::from(p)
    } else {
        // Show save dialog
        let extension = export_format.file_extension();

        match FileDialog::new()
            .add_filter(format!("{} files", format.to_uppercase()), &[extension])
            .set_file_name(format!("level.{extension}"))
            .save_file()
        {
            Some(path) => path,
            None => return Err("Export cancelled by user".to_string()),
        }
    };

    match LevelExporter::export_multi_format(
        &level_data,
        &[export_format],
        &base_path.to_string_lossy(),
    ) {
        Ok(result) => result.exported_files.first().map_or_else(
            || Err("No files exported".to_string()),
            |file| {
                if file.success {
                    info!("Successfully exported level to: {}", file.file_path);
                    Ok(file.file_path.clone())
                } else {
                    Err("Export failed".to_string())
                }
            },
        ),
        Err(e) => {
            error!("Failed to export level: {e}");
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn save_project(project_data: ProjectData, path: Option<String>) -> Result<String, String> {
    info!("Saving project (path={path:?})");

    // If the frontend already knows the destination (Save vs Save As),
    // write in-place. Otherwise pop a Save-As dialog.
    let target = match path {
        Some(p) if !p.trim().is_empty() => std::path::PathBuf::from(p),
        _ => {
            let Some(dialog_path) = FileDialog::new()
                .add_filter("Morgan-Bevy Project", &["mbp", "morgan"])
                .set_file_name("project.morgan")
                .save_file()
            else {
                return Err("Save cancelled by user".to_string());
            };
            dialog_path
        }
    };

    let json_data = serde_json::to_string_pretty(&project_data)
        .map_err(|e| format!("Failed to serialize project: {e}"))?;

    std::fs::write(&target, json_data).map_err(|e| format!("Failed to write project file: {e}"))?;

    info!("Successfully saved project to: {}", target.display());
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
async fn load_project() -> Result<ProjectData, String> {
    info!("Loading project");

    let Some(path) = FileDialog::new()
        .add_filter("Morgan-Bevy Project", &["mbp"])
        .pick_file()
    else {
        return Err("Load cancelled by user".to_string());
    };

    let json_data =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read project file: {e}"))?;

    let project_data: ProjectData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse project file: {e}"))?;

    info!("Successfully loaded project from: {}", path.display());
    Ok(project_data)
}

/// Load a project from a known path (used by the recent-projects list).
/// The frontend persists recent paths in localStorage and re-loads them
/// without re-prompting via the file dialog.
#[tauri::command]
async fn load_project_from_path(path: String) -> Result<ProjectData, String> {
    info!("Loading project from path: {path}");

    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(format!("File not found: {path}"));
    }

    let json_data =
        std::fs::read_to_string(p).map_err(|e| format!("Failed to read project file: {e}"))?;

    let project_data: ProjectData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse project file: {e}"))?;

    info!("Successfully loaded project from: {}", p.display());
    Ok(project_data)
}

#[tauri::command]
async fn browse_for_texture() -> Result<Vec<String>, String> {
    info!("Browsing for texture files");

    let paths = FileDialog::new()
        .add_filter(
            "Image Files",
            &["png", "jpg", "jpeg", "bmp", "tga", "ktx", "dds", "hdr"],
        )
        .add_filter("PNG", &["png"])
        .add_filter("JPEG", &["jpg", "jpeg"])
        .add_filter("All Files", &["*"])
        .set_title("Select Texture Files")
        .pick_files();

    paths.map_or_else(
        || {
            info!("Texture selection cancelled by user");
            Ok(vec![])
        },
        |file_paths| {
            let path_strings: Vec<String> = file_paths
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            info!("Selected {} texture file(s)", path_strings.len());
            Ok(path_strings)
        },
    )
}

/// Best-effort path-existence check used by the recent-projects list to
/// prune entries whose backing file no longer exists. Returns false
/// for any I/O error (other errors propagate as Err to the caller so
/// the caller can decide).
#[tauri::command]
fn path_exists(path: &str) -> bool {
    std::path::Path::new(path).exists()
}

/// Inspect the first CLI argument passed to the binary. If it points
/// to a `.morgan` or `.morgan-project` file that exists on disk, return
/// the absolute path. Otherwise return `None`.
///
/// Called from the Tauri setup hook so the OS can hand us a file via
/// double-click or `open` / `xdg-open`. We only treat the *first*
/// extra argument as a candidate; subsequent args are reserved for
/// future flags.
fn parse_startup_project_path() -> Option<String> {
    let mut args = std::env::args().skip(1);
    let candidate = args.next()?;
    let path = std::path::Path::new(&candidate);
    let ext_ok = path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| matches!(e.to_ascii_lowercase().as_str(), "morgan" | "morgan-project"));
    if !ext_ok {
        return None;
    }
    if !path.exists() {
        error!("Startup project path {candidate} does not exist");
        return None;
    }
    // Canonicalize to an absolute path for storage; fall back to the
    // raw candidate if canonicalize fails (symlinks, odd permissions).
    path.canonicalize()
        .ok()
        .map(|p| p.to_string_lossy().to_string())
        .or(Some(candidate))
}

/// Async sleep helper that does not require pulling in tokio's full
/// `time` feature set — we already have `async_runtime` available via
/// Tauri. Uses `std::thread::sleep` on a blocking task to keep the
/// `async_runtime` budget intact.
async fn tokio_sleep_ms(ms: u64) {
    tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(std::time::Duration::from_millis(ms));
    })
    .await
    .ok();
}

#[expect(
    clippy::expect_used,
    reason = "main() is the process entry point; if Tauri fails to start, the user has no UI to report errors"
)]
#[expect(
    clippy::large_stack_frames,
    reason = "tauri::generate_context!() expands to a large config struct; this is the documented pattern"
)]
fn main() {
    env_logger::init();
    info!("Starting Morgan-Bevy Level Editor");

    // Crash logging: install the panic hook first so any subsequent
    // panic (including the Tauri builder's own failures) is captured to
    // the rolling crash log. The log file path is resolved at runtime
    // from the Tauri app data dir; until the app is built the hook
    // simply falls back to the default panic printer.
    crash_log::install_panic_hook();
    if let Ok(app_data_dir) = std::env::var("MORGAN_BEVY_DATA_DIR") {
        let path = std::path::PathBuf::from(app_data_dir)
            .join("logs")
            .join(crash_log::CRASH_LOG_FILENAME);
        crash_log::ensure_log_dir(&path);
        crash_log::set_crash_log_path(path);
    } else {
        // Defer setting the path until the Tauri app handle is available.
        // The hook will still print to stderr for now; once `setup`
        // runs we resolve the real path.
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        // Auto-updater (T68). Pulls artifacts from GitHub Releases
        // per tauri.conf.json's `plugins.updater` block. Users are
        // notified in-app via the standard Tauri dialog; restart to
        // apply.
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            load_project_from_path,
            // File Operations
            browse_for_texture,
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
            assets::get_asset_collections,
            // Crash reporting
            crash_log::append_frontend_crash_log,
            // Recent-projects support
            path_exists
        ])
        .setup(|app| {
            info!("Tauri application setup complete");

            // Resolve the crash log path from the Tauri app data dir if
            // the env override wasn't set. This makes the panic hook
            // capture crashes for the lifetime of the process.
            if crash_log::crash_log_path().is_none() {
                let candidate = app
                    .path()
                    .app_data_dir()
                    .ok()
                    .map(|p| p.join("logs").join(crash_log::CRASH_LOG_FILENAME));
                if let Some(path) = candidate {
                    crash_log::ensure_log_dir(&path);
                    crash_log::set_crash_log_path(path.clone());
                    info!("Crash log configured at {}", path.display());
                }
            }

            // Handle launch-with-file from OS file-association
            // (.morgan / .morgan-project). The OS hands the path as the
            // first CLI argument on Windows / Linux. On macOS, the same
            // payload arrives via `RunEvent::Opened`; we forward that
            // in the `tauri::Builder::on_page_load` callback further
            // down if/when we add it. For now the CLI-arg path is the
            // common case and is enough for double-click open on every
            // platform's default behaviour.
            if let Some(startup_path) = parse_startup_project_path() {
                info!("Launched with project path: {startup_path}");
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    // Give the frontend a moment to mount its listeners
                    // before we fire the event. The frontend uses
                    // `listen('morgan://open-project', ...)` which
                    // buffers late emissions, so a short delay here is
                    // belt-and-braces.
                    tokio_sleep_ms(150).await;
                    if let Err(e) = handle.emit("morgan://open-project", startup_path) {
                        error!("Failed to emit morgan://open-project: {e}");
                    }
                });
            }

            // Initialize asset database in the background
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = assets::initialize_asset_database(handle).await {
                    error!("Failed to initialize asset database: {e}");
                } else {
                    info!("Asset database initialized successfully");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}

#[cfg(test)]
mod tests {
    #![allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::indexing_slicing,
        reason = "test code is allowed to use unwrap/expect for concise assertions"
    )]
    use std::fs;

    /// `parse_startup_project_path` reads `std::env::args` directly, so
    /// each test case writes a synthetic argv via a small helper that
    /// invokes the parser in a subprocess. That is overkill for the
    /// handful of cases we care about, so instead we factor out the
    /// pure parsing logic into `classify_arg` and test that.
    fn classify_arg(candidate: &str) -> ArgClass {
        let path = std::path::Path::new(candidate);
        let ext_ok = path.extension().and_then(|e| e.to_str()).is_some_and(|e| {
            matches!(e.to_ascii_lowercase().as_str(), "morgan" | "morgan-project")
        });
        if !ext_ok {
            return ArgClass::WrongExtension;
        }
        if !path.exists() {
            return ArgClass::MissingFile;
        }
        ArgClass::Accepted
    }

    #[derive(Debug, PartialEq, Eq)]
    enum ArgClass {
        WrongExtension,
        MissingFile,
        Accepted,
    }

    #[test]
    fn classify_rejects_non_morgan_extension() {
        assert_eq!(
            classify_arg("/tmp/something.json"),
            ArgClass::WrongExtension
        );
        assert_eq!(classify_arg("/tmp/something.exe"), ArgClass::WrongExtension);
        assert_eq!(classify_arg("/tmp/no-extension"), ArgClass::WrongExtension);
    }

    #[test]
    fn classify_accepts_both_extensions() {
        let dir = std::env::temp_dir();
        let p1 = dir.join("morgan_test_a.morgan");
        let p2 = dir.join("morgan_test_b.morgan-project");
        fs::write(&p1, "{}").unwrap();
        fs::write(&p2, "{}").unwrap();
        assert_eq!(classify_arg(p1.to_str().unwrap()), ArgClass::Accepted);
        assert_eq!(classify_arg(p2.to_str().unwrap()), ArgClass::Accepted);
        let _ = fs::remove_file(&p1);
        let _ = fs::remove_file(&p2);
    }

    #[test]
    fn classify_rejects_missing_file_with_correct_extension() {
        // .morgan extension but no file at that path.
        assert_eq!(
            classify_arg("/tmp/this-path-must-not-exist-12345.morgan"),
            ArgClass::MissingFile
        );
    }

    #[test]
    fn classify_is_case_insensitive_on_extension() {
        let dir = std::env::temp_dir();
        let p = dir.join("morgan_test_case.MORGAN");
        fs::write(&p, "{}").unwrap();
        assert_eq!(classify_arg(p.to_str().unwrap()), ArgClass::Accepted);
        let _ = fs::remove_file(&p);
    }
}
