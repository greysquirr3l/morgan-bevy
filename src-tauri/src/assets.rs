pub mod database;
pub mod scanner;

use database::AssetSearchResult;
use log::info;
use scanner::{AssetScanner, DatabaseStats, ScanProgress, ScanResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetFile {
    pub id: String,
    pub name: String,
    pub path: String,
    pub asset_type: String,
    pub size: u64,
    pub last_modified: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetSearchParams {
    pub query: String,
    pub asset_type: Option<String>,
    pub collection: Option<String>,
    pub limit: Option<usize>,
}

// Asset database state for Tauri
pub struct AssetDatabaseState {
    pub scanner: Arc<Mutex<Option<AssetScanner>>>,
}

impl AssetDatabaseState {
    pub fn new() -> Self {
        Self {
            scanner: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub async fn initialize_asset_database(app_handle: tauri::AppHandle) -> Result<(), String> {
    info!("Initializing asset database");

    // Get app data directory
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Ensure .morgana directory exists
    let morgana_dir = app_data_dir.join(".morgana");
    if !morgana_dir.exists() {
        fs::create_dir_all(&morgana_dir)
            .map_err(|e| format!("Failed to create .morgana directory: {}", e))?;
    }

    // Create database path
    let db_path = morgana_dir.join("assets.db");

    // Initialize scanner with database
    let scanner = AssetScanner::new(&db_path)
        .map_err(|e| format!("Failed to initialize asset scanner: {}", e))?;

    // Store scanner in app state
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let mut scanner_lock = state.scanner.lock().unwrap();
    *scanner_lock = Some(scanner);

    info!("Asset database initialized successfully");
    Ok(())
}

#[tauri::command]
pub async fn scan_assets_database(app_handle: tauri::AppHandle) -> Result<ScanResult, String> {
    info!("Starting comprehensive asset database scan");

    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let mut scanner_guard = state.scanner.lock().unwrap();

    let scanner = scanner_guard
        .as_mut()
        .ok_or("Asset database not initialized")?;

    // Find Assets directory
    let assets_dir = find_assets_directory().ok_or("Assets directory not found")?;

    // Create progress callback
    let progress_callback = {
        let handle = app_handle.clone();
        Box::new(move |progress: ScanProgress| {
            let _ = handle.emit("asset_scan_progress", &progress);
        })
    };

    // Perform scan
    let result = scanner
        .scan_directory(&assets_dir, Some(progress_callback))
        .map_err(|e| format!("Asset scan failed: {}", e))?;

    info!(
        "Asset scan completed: {} assets processed",
        result.total_assets
    );
    Ok(result)
}

#[tauri::command]
pub async fn search_assets_database(
    params: AssetSearchParams,
    app_handle: tauri::AppHandle,
) -> Result<Vec<AssetSearchResult>, String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let scanner_guard = state.scanner.lock().unwrap();

    let scanner = scanner_guard
        .as_ref()
        .ok_or("Asset database not initialized")?;

    let results = scanner
        .database()
        .search_assets(
            &params.query,
            params.asset_type.as_deref(),
            params.collection.as_deref(),
        )
        .map_err(|e| format!("Search failed: {}", e))?;

    Ok(results)
}

#[tauri::command]
pub async fn get_asset_database_stats(
    app_handle: tauri::AppHandle,
) -> Result<DatabaseStats, String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let scanner_guard = state.scanner.lock().unwrap();

    let scanner = scanner_guard
        .as_ref()
        .ok_or("Asset database not initialized")?;

    scanner
        .get_stats()
        .map_err(|e| format!("Failed to get stats: {}", e))
}

#[tauri::command]
pub async fn get_asset_collections(
    app_handle: tauri::AppHandle,
) -> Result<Vec<database::Collection>, String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let scanner_guard = state.scanner.lock().unwrap();

    let scanner = scanner_guard
        .as_ref()
        .ok_or("Asset database not initialized")?;

    scanner
        .database()
        .get_collections()
        .map_err(|e| format!("Failed to get collections: {}", e))
}

fn find_assets_directory() -> Option<PathBuf> {
    let possible_paths = vec![
        PathBuf::from("Assets"),       // Relative to current working directory
        PathBuf::from("../Assets"),    // One level up (if running from src-tauri)
        PathBuf::from("../../Assets"), // Two levels up
    ];

    possible_paths
        .into_iter()
        .find(|path| path.exists() && path.is_dir())
}

// Legacy functions for compatibility
#[tauri::command]
pub fn scan_assets() -> Result<Vec<AssetFile>, String> {
    let assets_dir = find_assets_directory()
        .ok_or_else(|| {
            let current_dir = std::env::current_dir()
                .map(|p| p.display().to_string())
                .unwrap_or_else(|_| "unknown".to_string());
            format!(
                "Assets directory not found. Please create an 'Assets' folder in the project root. Current working directory: {}",
                current_dir
            )
        })?;

    let mut assets = Vec::new();
    scan_directory_recursive(&assets_dir, &mut assets)?;
    Ok(assets)
}

#[tauri::command]
pub fn browse_assets_folder() -> Result<String, String> {
    use rfd::FileDialog;

    let folder = FileDialog::new()
        .set_title("Select Assets Folder")
        .pick_folder();

    match folder {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("No folder selected".to_string()),
    }
}

#[tauri::command]
pub fn scan_assets_folder(folder_path: String) -> Result<Vec<AssetFile>, String> {
    let path = Path::new(&folder_path);

    if !path.exists() || !path.is_dir() {
        return Err("Invalid folder path".to_string());
    }

    let mut assets = Vec::new();
    scan_directory_recursive(path, &mut assets)?;
    Ok(assets)
}

// Legacy helper functions for compatibility
const MODEL_EXTENSIONS: &[&str] = &["fbx", "obj", "gltf", "glb", "dae", "3ds", "blend"];
const TEXTURE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "tga", "bmp", "hdr", "exr"];
const MATERIAL_EXTENSIONS: &[&str] = &["mtl", "mat"];
const AUDIO_EXTENSIONS: &[&str] = &["wav", "mp3", "ogg", "flac"];

fn get_asset_type(extension: &str) -> String {
    let ext = extension.to_lowercase();

    if MODEL_EXTENSIONS.contains(&ext.as_str()) {
        "model".to_string()
    } else if TEXTURE_EXTENSIONS.contains(&ext.as_str()) {
        "texture".to_string()
    } else if MATERIAL_EXTENSIONS.contains(&ext.as_str()) {
        "material".to_string()
    } else if AUDIO_EXTENSIONS.contains(&ext.as_str()) {
        "audio".to_string()
    } else {
        "other".to_string()
    }
}

fn scan_directory_recursive(dir: &Path, assets: &mut Vec<AssetFile>) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            // Recursively scan subdirectories
            scan_directory_recursive(&path, assets)?;
        } else if path.is_file() {
            // Skip README files and hidden files
            if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                if filename.starts_with('.') || filename.to_lowercase() == "readme.md" {
                    continue;
                }
            }

            if let Some(asset) = create_asset_from_file(&path)? {
                assets.push(asset);
            }
        }
    }

    Ok(())
}

fn create_asset_from_file(path: &Path) -> Result<Option<AssetFile>, String> {
    let metadata =
        fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename")?;

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let asset_type = get_asset_type(&extension);

    // Only include supported asset types (skip "other")
    if asset_type == "other" {
        return Ok(None);
    }

    // Generate a simple ID based on the file path
    let path_str = path.to_string_lossy().replace('\\', "/");
    let id = md5::compute(path_str.as_bytes());

    let last_modified = metadata
        .modified()
        .map_err(|e| format!("Failed to get modification time: {}", e))?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Invalid modification time: {}", e))?
        .as_secs();

    Ok(Some(AssetFile {
        id: format!("{:x}", id),
        name: filename.to_string(),
        path: path_str.to_string(),
        asset_type,
        size: metadata.len(),
        last_modified,
    }))
}
