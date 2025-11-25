use super::database::AssetDatabase;
use log::{info, warn};

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub current_file: String,
    pub processed: usize,
    pub total: usize,
    pub current_collection: String,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub total_assets: usize,
    pub collections_found: Vec<String>,
    pub assets_by_type: std::collections::HashMap<String, usize>,
    pub scan_duration_ms: u64,
    pub errors: Vec<String>,
}

pub struct AssetScanner {
    database: AssetDatabase,
}

impl AssetScanner {
    pub fn new(db_path: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let database = AssetDatabase::new(db_path)?;
        Ok(Self { database })
    }

    /// Scan a directory for assets and populate the database
    pub fn scan_directory<P: AsRef<Path>>(
        &mut self,
        assets_dir: P,
        progress_callback: Option<Box<dyn Fn(ScanProgress) + Send + Sync>>,
    ) -> Result<ScanResult, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        let assets_path = assets_dir.as_ref();

        info!("Starting asset scan of directory: {:?}", assets_path);

        if !assets_path.exists() {
            return Err(format!("Assets directory does not exist: {:?}", assets_path).into());
        }

        // Discover all asset files first
        let discovered_assets = self.discover_assets(assets_path)?;
        let total_assets = discovered_assets.len();

        info!("Discovered {} potential assets", total_assets);

        let mut scan_result = ScanResult {
            total_assets,
            collections_found: Vec::new(),
            assets_by_type: std::collections::HashMap::new(),
            scan_duration_ms: 0,
            errors: Vec::new(),
        };

        // Group assets by collection (based on top-level directory)
        let mut assets_by_collection: std::collections::HashMap<String, Vec<PathBuf>> =
            std::collections::HashMap::new();

        for asset_path in discovered_assets {
            let collection = self.determine_collection(&asset_path, assets_path);
            assets_by_collection
                .entry(collection)
                .or_default()
                .push(asset_path);
        }

        let mut processed = 0;

        // Process each collection
        for (collection_name, asset_paths) in assets_by_collection {
            info!("Processing collection: {}", collection_name);
            scan_result.collections_found.push(collection_name.clone());

            // Process assets in this collection
            for asset_path in asset_paths {
                if let Some(ref callback) = progress_callback {
                    let progress = ScanProgress {
                        current_file: asset_path
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string(),
                        processed,
                        total: total_assets,
                        current_collection: collection_name.clone(),
                        errors: scan_result.errors.clone(),
                    };
                    callback(progress);
                }

                match self.process_asset(&asset_path, &collection_name) {
                    Ok(_) => {
                        let asset_type = self.database.determine_asset_type(&asset_path);
                        *scan_result.assets_by_type.entry(asset_type).or_insert(0) += 1;
                    }
                    Err(e) => {
                        let error_msg =
                            format!("Failed to process {}: {}", asset_path.display(), e);
                        warn!("{}", error_msg);
                        scan_result.errors.push(error_msg);
                    }
                }

                processed += 1;
            }
        }

        scan_result.scan_duration_ms = start_time.elapsed().as_millis() as u64;

        info!(
            "Asset scan completed in {}ms. Processed {} assets with {} errors",
            scan_result.scan_duration_ms,
            processed,
            scan_result.errors.len()
        );

        Ok(scan_result)
    }

    /// Discover all asset files in a directory tree
    fn discover_assets<P: AsRef<Path>>(
        &self,
        root_path: P,
    ) -> Result<Vec<PathBuf>, Box<dyn std::error::Error>> {
        let mut assets = Vec::new();
        self.walk_directory(root_path.as_ref(), &mut assets)?;
        Ok(assets)
    }

    /// Recursively walk directory and collect asset files
    fn walk_directory(
        &self,
        dir: &Path,
        assets: &mut Vec<PathBuf>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if !dir.is_dir() {
            return Ok(());
        }

        let entries = fs::read_dir(dir)?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                // Skip hidden directories and known artifact directories
                if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                    if dir_name.starts_with('.')
                        || dir_name == "node_modules"
                        || dir_name == "target"
                    {
                        continue;
                    }
                }
                self.walk_directory(&path, assets)?;
            } else if self.is_asset_file(&path) {
                assets.push(path);
            }
        }

        Ok(())
    }

    /// Determine if a file is an asset we should track
    fn is_asset_file(&self, path: &Path) -> bool {
        // Skip hidden files and known non-assets
        if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
            if file_name.starts_with('.')
                || file_name.ends_with(".meta")
                || file_name.ends_with(".import")
                || file_name == "Thumbs.db"
                || file_name == ".DS_Store"
            {
                return false;
            }
        }

        match path.extension().and_then(|ext| ext.to_str()) {
            Some(
                "fbx" | "FBX" | "png" | "PNG" | "jpg" | "JPG" | "jpeg" | "JPEG" | "wav" | "WAV"
                | "mp3" | "MP3" | "ogg" | "OGG" | "mat" | "MAT",
            ) => true,
            _ => false,
        }
    }

    /// Determine collection name based on file path
    fn determine_collection(&self, asset_path: &Path, assets_root: &Path) -> String {
        if let Ok(relative_path) = asset_path.strip_prefix(assets_root) {
            if let Some(first_component) = relative_path.components().next() {
                return first_component.as_os_str().to_string_lossy().to_string();
            }
        }
        "Unknown".to_string()
    }

    /// Process a single asset file
    fn process_asset(
        &mut self,
        asset_path: &Path,
        collection: &str,
    ) -> Result<i64, Box<dyn std::error::Error>> {
        // Check if asset already exists (by file path)
        if let Ok(existing_assets) = self.database.search_assets("", None, None) {
            let file_path_str = asset_path.to_string_lossy().to_string();
            if existing_assets
                .iter()
                .any(|a| a.asset.file_path == file_path_str)
            {
                // Asset already exists, could check if it needs updating based on modification time
                return Ok(0); // Return 0 to indicate no new asset was added
            }
        }

        // Insert new asset
        self.database.insert_asset(asset_path, collection)
    }

    /// Get database reference for direct operations
    pub fn database(&self) -> &AssetDatabase {
        &self.database
    }

    /// Get mutable database reference
    #[allow(dead_code)]
    pub fn database_mut(&mut self) -> &mut AssetDatabase {
        &mut self.database
    }

    /// Rescan a specific collection
    #[allow(dead_code)]
    pub fn rescan_collection<P: AsRef<Path>>(
        &mut self,
        assets_dir: P,
        collection_name: &str,
        progress_callback: Option<Box<dyn Fn(ScanProgress) + Send + Sync>>,
    ) -> Result<ScanResult, Box<dyn std::error::Error>> {
        let collection_path = assets_dir.as_ref().join(collection_name);

        if !collection_path.exists() {
            return Err(
                format!("Collection directory does not exist: {:?}", collection_path).into(),
            );
        }

        info!("Rescanning collection: {}", collection_name);

        // For now, we'll just scan the collection directory
        // In a more advanced implementation, we might want to:
        // 1. Remove assets from this collection that no longer exist
        // 2. Update assets that have changed
        // 3. Add new assets

        self.scan_directory(collection_path, progress_callback)
    }

    /// Get database statistics
    pub fn get_stats(&self) -> Result<DatabaseStats, Box<dyn std::error::Error>> {
        let collections = self.database.get_collections()?;
        let all_assets = self.database.search_assets("", None, None)?;

        let mut assets_by_type = std::collections::HashMap::new();
        let mut total_size = 0i64;

        for asset_result in &all_assets {
            let asset_type = &asset_result.asset.asset_type;
            *assets_by_type.entry(asset_type.clone()).or_insert(0) += 1;
            total_size += asset_result.asset.file_size;
        }

        Ok(DatabaseStats {
            total_assets: all_assets.len(),
            total_collections: collections.len(),
            assets_by_type,
            total_size_bytes: total_size,
            collections: collections
                .into_iter()
                .map(|c| (c.name, c.asset_count as usize))
                .collect(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseStats {
    pub total_assets: usize,
    pub total_collections: usize,
    pub assets_by_type: std::collections::HashMap<String, usize>,
    pub total_size_bytes: i64,
    pub collections: std::collections::HashMap<String, usize>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_asset_scanner_creation() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_assets.db");

        let scanner = AssetScanner::new(&db_path);
        assert!(scanner.is_ok());
    }

    #[test]
    fn test_is_asset_file() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_assets.db");
        let scanner = AssetScanner::new(&db_path).unwrap();

        assert!(scanner.is_asset_file(Path::new("test.fbx")));
        assert!(scanner.is_asset_file(Path::new("texture.png")));
        assert!(scanner.is_asset_file(Path::new("audio.wav")));
        assert!(!scanner.is_asset_file(Path::new("script.cs")));
        assert!(!scanner.is_asset_file(Path::new("model.fbx.meta")));
        assert!(!scanner.is_asset_file(Path::new(".hidden")));
    }
}
