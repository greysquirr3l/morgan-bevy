use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetFile {
    pub id: String,
    pub name: String,
    pub path: String,
    pub asset_type: String, // 'model', 'texture', 'material', 'audio', 'other'
    pub size: u64,
    pub last_modified: u64,
}

// Supported asset file extensions
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

#[tauri::command]
pub fn scan_assets() -> Result<Vec<AssetFile>, String> {
    let assets_dir = Path::new("Assets");
    
    if !assets_dir.exists() {
        return Err("Assets directory not found. Please create an 'Assets' folder in the project root.".to_string());
    }
    
    let mut assets = Vec::new();
    scan_directory_recursive(assets_dir, &mut assets)?;
    
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

fn scan_directory_recursive(dir: &Path, assets: &mut Vec<AssetFile>) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;
    
    for entry in entries {
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
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
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename")?;
    
    let extension = path.extension()
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
    
    let last_modified = metadata.modified()
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