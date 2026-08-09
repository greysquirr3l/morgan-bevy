pub mod database;
pub mod import;
pub mod scanner;
pub mod thumbnail;

use database::{AssetDatabase, AssetRecord, AssetSearchResult, SmartFolderFilter};
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

// Asset database state for Tauri.
//
// `thumbnail_queue` is owned alongside the scanner so the Tauri
// command surface can submit jobs from anywhere in the app. The
// queue spawns its worker task lazily in `initialize_asset_database`
// once we have a path to the on-disk DB.
pub struct AssetDatabaseState {
    pub scanner: Arc<Mutex<Option<AssetScanner>>>,
    pub thumbnail_queue: Arc<Mutex<Option<thumbnail::ThumbnailQueue>>>,
}

impl AssetDatabaseState {
    pub fn new() -> Self {
        Self {
            scanner: Arc::new(Mutex::new(None)),
            thumbnail_queue: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; lock_result binding is intentional"
)]
pub async fn initialize_asset_database(app_handle: tauri::AppHandle) -> Result<(), String> {
    info!("Initializing asset database");

    // Get app data directory
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;

    // Ensure .morgana directory exists
    let morgana_dir = app_data_dir.join(".morgana");
    if !morgana_dir.exists() {
        fs::create_dir_all(&morgana_dir)
            .map_err(|e| format!("Failed to create .morgana directory: {e}"))?;
    }

    // T33: ensure the thumbnails directory exists.
    let thumbnails_dir = morgana_dir.join("thumbnails");
    if !thumbnails_dir.exists() {
        fs::create_dir_all(&thumbnails_dir)
            .map_err(|e| format!("Failed to create thumbnails directory: {e}"))?;
    }

    // Create database path
    let db_path = morgana_dir.join("assets.db");

    // Initialize scanner with database
    let scanner = AssetScanner::new(&db_path)
        .map_err(|e| format!("Failed to initialize asset scanner: {e}"))?;

    // Store scanner in app state
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let __lock_result = state.scanner.lock();
    let mut scanner_lock = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    *scanner_lock = Some(scanner);
    drop(scanner_lock);

    // T33: spawn the thumbnail worker. The DB handle is shared
    // with the scanner via `Arc<Mutex<AssetDatabase>>` — both
    // sides lock briefly, never concurrently with each other for
    // long. The worker pulls from the channel until the app exits.
    let db_for_queue = Arc::new(Mutex::new(
        AssetDatabase::new(&db_path)
            .map_err(|e| format!("Failed to open DB for thumbnail queue: {e}"))?,
    ));
    let queue = thumbnail::ThumbnailQueue::spawn(
        Arc::clone(&db_for_queue),
        thumbnails_dir,
        &tokio::runtime::Handle::current(),
    );
    let __lock_result = state.thumbnail_queue.lock();
    let mut queue_lock = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    *queue_lock = Some(queue);
    drop(queue_lock);

    info!("Asset database initialized successfully");
    Ok(())
}

#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; lock_result binding is intentional"
)]
pub async fn scan_assets_database(app_handle: tauri::AppHandle) -> Result<ScanResult, String> {
    info!("Starting comprehensive asset database scan");

    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let __lock_result = state.scanner.lock();
    let mut scanner_guard = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };

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
        .map_err(|e| format!("Asset scan failed: {e}"))?;
    drop(scanner_guard);

    // T33: clean orphan thumbnails + enqueue pending regeneration
    // now that the scan has populated the DB. Both ops are
    // best-effort; a failure does not fail the scan.
    if let Some(state) = app_handle.try_state::<AssetDatabaseState>() {
        // Cleanup: walk the thumbnails dir, drop orphans. We open a
        // separate connection so we don't share the lock with the
        // worker (which holds its own Arc<Mutex<AssetDatabase>>).
        if let Ok(db) = AssetDatabase::new(
            app_handle
                .path()
                .app_data_dir().map_or_else(|_| PathBuf::from("assets.db"), |p| p.join(".morgana").join("assets.db")),
        ) {
            let app_data_dir = app_handle
                .path()
                .app_data_dir().map_or_else(|_| PathBuf::from("thumbnails"), |p| p.join(".morgana").join("thumbnails"));
            if let Err(e) = thumbnail::cleanup::cleanup_orphans(&db, &app_data_dir) {
                log::warn!("T33 cleanup_orphans failed: {e}");
            }
        }

        // Enqueue every pending asset for regeneration.
        let __lock_result = state.thumbnail_queue.lock();
        let mut queue_guard = match __lock_result {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };
        if let Some(queue) = queue_guard.as_mut() {
            // The DB connection inside the worker is the source of
            // truth for staleness; build a fresh `AssetDatabase`
            // handle here for the read.
            if let Ok(db) = AssetDatabase::new(
                app_handle
                    .path()
                    .app_data_dir().map_or_else(|_| PathBuf::from("assets.db"), |p| p.join(".morgana").join("assets.db")),
            ) {
                if let Err(e) = queue.enqueue_all_pending(&db) {
                    log::warn!("T33 enqueue_all_pending failed: {e}");
                }
            }
        }
    }

    info!(
        "Asset scan completed: {} assets processed",
        result.total_assets
    );
    Ok(result)
}

#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; lock_result binding is intentional"
)]
pub async fn search_assets_database(
    params: AssetSearchParams,
    app_handle: tauri::AppHandle,
) -> Result<Vec<AssetSearchResult>, String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let __lock_result = state.scanner.lock();
    let scanner_guard = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };

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
        .map_err(|e| format!("Search failed: {e}"))?;

    Ok(results)
}

#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; lock_result binding is intentional"
)]
pub async fn get_asset_database_stats(
    app_handle: tauri::AppHandle,
) -> Result<DatabaseStats, String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let __lock_result = state.scanner.lock();
    let scanner_guard = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };

    let scanner = scanner_guard
        .as_ref()
        .ok_or("Asset database not initialized")?;

    scanner
        .get_stats()
        .map_err(|e| format!("Failed to get stats: {e}"))
}

#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; lock_result binding is intentional"
)]
pub async fn get_asset_collections(
    app_handle: tauri::AppHandle,
) -> Result<Vec<database::Collection>, String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let __lock_result = state.scanner.lock();
    let scanner_guard = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };

    let scanner = scanner_guard
        .as_ref()
        .ok_or("Asset database not initialized")?;

    scanner
        .database()
        .get_collections()
        .map_err(|e| format!("Failed to get collections: {e}"))
}

// ─── T32: tags, favorites, smart folders ────────────────────────────────

/// T32: attach a tag to an asset. Empty / whitespace tags are no-ops.
#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; matches existing scan_assets_database pattern"
)]
pub async fn add_asset_tag(
    asset_id: i64,
    tag_name: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let __lock_result = state.scanner.lock();
    let scanner_guard = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    let scanner = scanner_guard
        .as_ref()
        .ok_or("Asset database not initialized")?;
    scanner
        .database()
        .add_asset_tag(asset_id, &tag_name)
        .map_err(|e| format!("Failed to add tag: {e}"))
}

/// T32: detach a tag from an asset.
#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; matches existing scan_assets_database pattern"
)]
pub async fn remove_asset_tag(
    asset_id: i64,
    tag_name: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let __lock_result = state.scanner.lock();
    let scanner_guard = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    let scanner = scanner_guard
        .as_ref()
        .ok_or("Asset database not initialized")?;
    scanner
        .database()
        .remove_asset_tag(asset_id, &tag_name)
        .map_err(|e| format!("Failed to remove tag: {e}"))
}

/// T32: every distinct tag with a use count, ordered most-used first.
/// Used to power the autocomplete UI in the asset browser.
#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; matches existing scan_assets_database pattern"
)]
pub async fn list_all_asset_tags(
    app_handle: tauri::AppHandle,
) -> Result<Vec<(String, i64)>, String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let __lock_result = state.scanner.lock();
    let scanner_guard = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    let scanner = scanner_guard
        .as_ref()
        .ok_or("Asset database not initialized")?;
    scanner
        .database()
        .list_all_tags()
        .map_err(|e| format!("Failed to list tags: {e}"))
}

/// T32: flip the favorite flag on an asset; returns the new value.
#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; matches existing scan_assets_database pattern"
)]
pub async fn toggle_asset_favorite(
    asset_id: i64,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let __lock_result = state.scanner.lock();
    let scanner_guard = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    let scanner = scanner_guard
        .as_ref()
        .ok_or("Asset database not initialized")?;
    scanner
        .database()
        .toggle_asset_favorite(asset_id)
        .map_err(|e| format!("Failed to toggle favorite: {e}"))
}

/// T32: save (create or update) a named smart folder. The filter is
/// serialized as JSON in the `SQLite` row, so adding fields to
/// `SmartFolderFilter` is a non-breaking change for old databases.
#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; matches existing scan_assets_database pattern"
)]
pub async fn save_smart_folder(
    name: String,
    filter: SmartFolderFilter,
    app_handle: tauri::AppHandle,
) -> Result<i64, String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let __lock_result = state.scanner.lock();
    let scanner_guard = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    let scanner = scanner_guard
        .as_ref()
        .ok_or("Asset database not initialized")?;
    scanner
        .database()
        .save_smart_folder(&name, &filter)
        .map_err(|e| format!("Failed to save smart folder: {e}"))
}

/// T32: evaluate a smart folder's filter and return the matching
/// asset records. Computed at query time (no materialised view).
#[tauri::command]
#[expect(
    clippy::significant_drop_tightening,
    reason = "MutexGuard held across async Tauri command; matches existing scan_assets_database pattern"
)]
pub async fn evaluate_smart_folder(
    filter: SmartFolderFilter,
    app_handle: tauri::AppHandle,
) -> Result<Vec<AssetRecord>, String> {
    let state: tauri::State<AssetDatabaseState> = app_handle.state();
    let __lock_result = state.scanner.lock();
    let scanner_guard = match __lock_result {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    let scanner = scanner_guard
        .as_ref()
        .ok_or("Asset database not initialized")?;
    scanner
        .database()
        .evaluate_smart_folder(&filter)
        .map_err(|e| format!("Failed to evaluate smart folder: {e}"))
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
            let current_dir = std::env::current_dir().map_or_else(|_| "unknown".to_string(), |p| p.display().to_string());
            format!(
                "Assets directory not found. Please create an 'Assets' folder in the project root. Current working directory: {current_dir}"
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

    folder.map_or_else(
        || Err("No folder selected".to_string()),
        |path| Ok(path.to_string_lossy().to_string()),
    )
}

#[tauri::command]
pub fn scan_assets_folder(folder_path: &str) -> Result<Vec<AssetFile>, String> {
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
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
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
    let metadata = fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {e}"))?;

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
        .map_err(|e| format!("Failed to get modification time: {e}"))?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Invalid modification time: {e}"))?
        .as_secs();

    Ok(Some(AssetFile {
        id: format!("{id:x}"),
        name: filename.to_string(),
        path: path_str,
        asset_type,
        size: metadata.len(),
        last_modified,
    }))
}

// ─── T33 — Thumbnail commands ────────────────────────────────────────────────

/// T33: enqueue every pending asset for thumbnail generation. Used
/// as the manual escape hatch — typically called once per scan by
/// `scan_assets_database`; a caller can also invoke it from the
/// front-end to force-rebuild every thumbnail.
#[tauri::command]
pub async fn generate_thumbnails(app_handle: tauri::AppHandle) -> Result<usize, String> {
    // Lock the thumbnail queue inside an inner scope so the
    // MutexGuard (which holds the queue's worker state — a
    // significant Drop) is released as early as possible
    // (clippy `significant_drop_tightening`).
    let db_path = app_handle.path().app_data_dir().map_or_else(
        |_| PathBuf::from("assets.db"),
        |p| p.join(".morgana").join("assets.db"),
    );
    let db = AssetDatabase::new(db_path).map_err(|e| format!("Failed to open DB: {e}"))?;
    let submitted = {
        let state: tauri::State<AssetDatabaseState> = app_handle.state();
        let mut queue_guard = match state.thumbnail_queue.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        let result = {
            let queue = queue_guard
                .as_mut()
                .ok_or("Thumbnail queue not initialized")?;
            queue
                .enqueue_all_pending(&db)
                .map_err(|e| format!("enqueue_all_pending: {e}"))?
        };
        // Drop the MutexGuard early (clippy `significant_drop_tightening`):
        // the guard wraps the queue's worker state, a significant Drop, and
        // we no longer need it after `enqueue_all_pending` returns.
        drop(queue_guard);
        result
    };
    Ok(submitted)
}

/// T33: orphan cleanup. Unlinks files on disk that no longer have a
/// matching DB row, and deletes DB rows whose file is missing.
#[tauri::command]
pub async fn cleanup_thumbnails(app_handle: tauri::AppHandle) -> Result<usize, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map(|p| p.join(".morgana"))
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;
    let thumbnails_dir = app_data_dir.join("thumbnails");
    let db = AssetDatabase::new(app_data_dir.join("assets.db"))
        .map_err(|e| format!("Failed to open DB: {e}"))?;
    thumbnail::cleanup::cleanup_orphans(&db, &thumbnails_dir)
}

// ─── T35 — Asset import pipeline ───────────────────────────────────────────────

use import::{run_import, ImportResult, ImportSettings};

/// T35: batch-import a list of source paths through the texture
/// compression + magic-byte validation pipeline. The original
/// files are never modified — outputs land in the per-project
/// `.morgana/imports/` cache directory.
#[tauri::command]
pub async fn import_assets(
    sources: Vec<String>,
    settings: ImportSettings,
    cache_dir: Option<String>,
) -> Result<ImportResult, String> {
    let cache = match cache_dir {
        Some(p) => PathBuf::from(p),
        None => default_import_cache_dir()?,
    };
    let paths: Vec<PathBuf> = sources.into_iter().map(PathBuf::from).collect();
    Ok(run_import(&paths, &settings, &cache, None::<fn(&str)>))
}

fn default_import_cache_dir() -> Result<PathBuf, String> {
    let app_data = std::env::var("MORGANA_APP_DATA")
        .ok()
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var("HOME")
                .ok()
                .map(|h| PathBuf::from(h).join(".morgana").join("imports"))
        })
        .ok_or_else(|| "could not resolve app data directory".to_string())?;
    Ok(app_data)
}
