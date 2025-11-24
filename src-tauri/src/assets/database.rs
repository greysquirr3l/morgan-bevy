use chrono::{DateTime, Utc};
use log::info;
use rusqlite::{params, Connection, Result as SqlResult, Transaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetRecord {
    pub id: i64,
    pub name: String,
    pub file_path: String,
    pub asset_type: String,
    pub collection: String,
    pub file_size: i64,
    pub checksum: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetMetadata {
    pub asset_id: i64,
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub license_info: Option<String>,
    pub asset_count: i64,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailRecord {
    pub asset_id: i64,
    pub thumbnail_path: String,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetSearchResult {
    pub asset: AssetRecord,
    pub metadata: Vec<AssetMetadata>,
    pub has_thumbnail: bool,
}

pub struct AssetDatabase {
    connection: Connection,
}

impl AssetDatabase {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self, Box<dyn std::error::Error>> {
        // Ensure the directory exists
        if let Some(parent) = db_path.as_ref().parent() {
            fs::create_dir_all(parent)?;
        }

        let connection = Connection::open(db_path)?;
        let mut db = Self { connection };
        db.initialize_schema()?;
        Ok(db)
    }

    fn initialize_schema(&mut self) -> SqlResult<()> {
        info!("Initializing asset database schema");

        // Enable foreign keys
        self.connection.execute("PRAGMA foreign_keys = ON", [])?;

        // Collections table
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                license_info TEXT,
                asset_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Assets table
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                file_path TEXT UNIQUE NOT NULL,
                asset_type TEXT NOT NULL,
                collection TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                checksum TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (collection) REFERENCES collections (name)
            )",
            [],
        )?;

        // Asset metadata table (key-value pairs)
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS asset_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE,
                UNIQUE(asset_id, key)
            )",
            [],
        )?;

        // Thumbnails table
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS thumbnails (
                asset_id INTEGER PRIMARY KEY,
                thumbnail_path TEXT NOT NULL,
                generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Asset tags table (many-to-many)
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS asset_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER NOT NULL,
                tag_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE,
                UNIQUE(asset_id, tag_name)
            )",
            [],
        )?;

        // Create indexes for performance
        self.create_indexes()?;

        // Insert default collections
        self.insert_default_collections()?;

        info!("Asset database schema initialized successfully");
        Ok(())
    }

    fn create_indexes(&mut self) -> SqlResult<()> {
        // Search optimization indexes
        self.connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(name)",
            [],
        )?;

        self.connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type)",
            [],
        )?;

        self.connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_assets_collection ON assets(collection)",
            [],
        )?;

        self.connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_assets_search ON assets(name, asset_type, collection)",
            [],
        )?;

        // Metadata search index
        self.connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_metadata_key ON asset_metadata(key)",
            [],
        )?;

        // Tags search index
        self.connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_tags_name ON asset_tags(tag_name)",
            [],
        )?;

        Ok(())
    }

    fn insert_default_collections(&mut self) -> SqlResult<()> {
        let collections = [
            (
                "Kenney",
                "Kenney Game Assets - Free Collection",
                Some("CC0 - Creative Commons Zero"),
            ),
            (
                "KenneyPremium",
                "Kenney Game Assets - Premium Collection",
                Some("CC0 - Creative Commons Zero"),
            ),
            (
                "TopDownEngine",
                "TopDown Engine Assets by More Mountains",
                Some("More Mountains License - Demo Only"),
            ),
        ];

        for (name, description, license) in &collections {
            self.connection.execute(
                "INSERT OR IGNORE INTO collections (name, description, license_info) VALUES (?1, ?2, ?3)",
                params![name, description, license],
            )?;
        }

        Ok(())
    }

    pub fn insert_asset(
        &mut self,
        asset_path: &Path,
        collection: &str,
    ) -> Result<i64, Box<dyn std::error::Error>> {
        let metadata = fs::metadata(asset_path)?;
        let file_size = metadata.len() as i64;

        // Calculate checksum
        let checksum = self.calculate_file_checksum(asset_path)?;

        let file_name = asset_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid filename")?;

        let asset_type = self.determine_asset_type(asset_path);
        let file_path_str = asset_path.to_string_lossy().to_string();

        let _asset_id = self.connection.execute(
            "INSERT INTO assets (name, file_path, asset_type, collection, file_size, checksum) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                file_name,
                file_path_str,
                asset_type,
                collection,
                file_size,
                checksum
            ],
        )?;

        let asset_id = self.connection.last_insert_rowid();

        // Extract and store metadata based on file type
        self.extract_and_store_metadata(asset_id, asset_path)?;

        // Update collection asset count
        self.update_collection_count(collection)?;

        info!("Inserted asset: {} (ID: {})", file_name, asset_id);
        Ok(asset_id)
    }

    fn calculate_file_checksum(
        &self,
        file_path: &Path,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let contents = fs::read(file_path)?;
        let mut hasher = Sha256::new();
        hasher.update(&contents);
        Ok(format!("{:x}", hasher.finalize()))
    }

    pub fn determine_asset_type(&self, file_path: &Path) -> String {
        match file_path.extension().and_then(|ext| ext.to_str()) {
            Some("fbx") | Some("FBX") => "Model",
            Some("png") | Some("PNG") | Some("jpg") | Some("JPG") | Some("jpeg") | Some("JPEG") => {
                "Texture"
            }
            Some("wav") | Some("WAV") | Some("mp3") | Some("MP3") | Some("ogg") | Some("OGG") => {
                "Audio"
            }
            Some("mat") | Some("MAT") => "Material",
            _ => "Unknown",
        }
        .to_string()
    }

    fn extract_and_store_metadata(
        &mut self,
        asset_id: i64,
        asset_path: &Path,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let asset_type = self.determine_asset_type(asset_path);

        match asset_type.as_str() {
            "Texture" => {
                // For images, we could use an image library to extract dimensions
                // For now, just store file extension
                if let Some(ext) = asset_path.extension() {
                    self.insert_metadata(asset_id, "format", ext.to_string_lossy().as_ref())?;
                }
            }
            "Audio" => {
                // For audio files, we could extract duration, sample rate, etc.
                if let Some(ext) = asset_path.extension() {
                    self.insert_metadata(asset_id, "format", ext.to_string_lossy().as_ref())?;
                }
            }
            "Model" => {
                // For FBX files, we could extract vertex count, material info, etc.
                // This would require an FBX parser library
                self.insert_metadata(asset_id, "format", "fbx")?;
            }
            _ => {}
        }

        Ok(())
    }

    fn insert_metadata(&mut self, asset_id: i64, key: &str, value: &str) -> SqlResult<()> {
        self.connection.execute(
            "INSERT OR REPLACE INTO asset_metadata (asset_id, key, value) VALUES (?1, ?2, ?3)",
            params![asset_id, key, value],
        )?;
        Ok(())
    }

    fn update_collection_count(&mut self, collection_name: &str) -> SqlResult<()> {
        self.connection.execute(
            "UPDATE collections SET 
             asset_count = (SELECT COUNT(*) FROM assets WHERE collection = ?1),
             updated_at = CURRENT_TIMESTAMP 
             WHERE name = ?1",
            params![collection_name],
        )?;
        Ok(())
    }

    pub fn search_assets(
        &self,
        query: &str,
        asset_type: Option<&str>,
        collection: Option<&str>,
    ) -> Result<Vec<AssetSearchResult>, Box<dyn std::error::Error>> {
        let mut sql = String::from(
            "SELECT a.id, a.name, a.file_path, a.asset_type, a.collection, 
                    a.file_size, a.checksum, a.created_at, a.updated_at,
                    CASE WHEN t.asset_id IS NOT NULL THEN 1 ELSE 0 END as has_thumbnail
             FROM assets a
             LEFT JOIN thumbnails t ON a.id = t.asset_id
             WHERE 1=1",
        );

        let mut params = Vec::new();

        if !query.is_empty() {
            sql.push_str(" AND a.name LIKE ?");
            params.push(format!("%{}%", query));
        }

        if let Some(asset_type) = asset_type {
            sql.push_str(" AND a.asset_type = ?");
            params.push(asset_type.to_string());
        }

        if let Some(collection) = collection {
            sql.push_str(" AND a.collection = ?");
            params.push(collection.to_string());
        }

        sql.push_str(" ORDER BY a.name ASC LIMIT 1000");

        let mut stmt = self.connection.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> =
            params.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

        let asset_iter = stmt.query_map(param_refs.as_slice(), |row| {
            Ok((
                AssetRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    file_path: row.get(2)?,
                    asset_type: row.get(3)?,
                    collection: row.get(4)?,
                    file_size: row.get(5)?,
                    checksum: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                },
                row.get::<usize, i32>(9)? == 1, // has_thumbnail
            ))
        })?;

        let mut results = Vec::new();
        for asset_result in asset_iter {
            let (asset, has_thumbnail) = asset_result?;
            let metadata = self.get_asset_metadata(asset.id)?;

            results.push(AssetSearchResult {
                asset,
                metadata,
                has_thumbnail,
            });
        }

        Ok(results)
    }

    fn get_asset_metadata(&self, asset_id: i64) -> SqlResult<Vec<AssetMetadata>> {
        let mut stmt = self
            .connection
            .prepare("SELECT asset_id, key, value FROM asset_metadata WHERE asset_id = ?")?;

        let metadata_iter = stmt.query_map([asset_id], |row| {
            Ok(AssetMetadata {
                asset_id: row.get(0)?,
                key: row.get(1)?,
                value: row.get(2)?,
            })
        })?;

        let mut metadata = Vec::new();
        for meta in metadata_iter {
            metadata.push(meta?);
        }

        Ok(metadata)
    }

    pub fn get_collections(&self) -> SqlResult<Vec<Collection>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, name, description, license_info, asset_count FROM collections ORDER BY name"
        )?;

        let collection_iter = stmt.query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                license_info: row.get(3)?,
                asset_count: row.get(4)?,
            })
        })?;

        let mut collections = Vec::new();
        for collection in collection_iter {
            collections.push(collection?);
        }

        Ok(collections)
    }

    #[allow(dead_code)]
    pub fn add_thumbnail(&mut self, asset_id: i64, thumbnail_path: &str) -> SqlResult<()> {
        self.connection.execute(
            "INSERT OR REPLACE INTO thumbnails (asset_id, thumbnail_path) VALUES (?1, ?2)",
            params![asset_id, thumbnail_path],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_asset_by_id(
        &self,
        asset_id: i64,
    ) -> Result<Option<AssetSearchResult>, Box<dyn std::error::Error>> {
        let mut stmt = self.connection.prepare(
            "SELECT a.id, a.name, a.file_path, a.asset_type, a.collection, 
                    a.file_size, a.checksum, a.created_at, a.updated_at,
                    CASE WHEN t.asset_id IS NOT NULL THEN 1 ELSE 0 END as has_thumbnail
             FROM assets a
             LEFT JOIN thumbnails t ON a.id = t.asset_id
             WHERE a.id = ?",
        )?;

        let mut rows = stmt.query_map([asset_id], |row| {
            Ok((
                AssetRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    file_path: row.get(2)?,
                    asset_type: row.get(3)?,
                    collection: row.get(4)?,
                    file_size: row.get(5)?,
                    checksum: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                },
                row.get::<usize, i32>(9)? == 1, // has_thumbnail
            ))
        })?;

        if let Some(row) = rows.next() {
            let (asset, has_thumbnail) = row?;
            let metadata = self.get_asset_metadata(asset.id)?;

            Ok(Some(AssetSearchResult {
                asset,
                metadata,
                has_thumbnail,
            }))
        } else {
            Ok(None)
        }
    }

    #[allow(dead_code)]
    pub fn begin_transaction(&mut self) -> Result<Transaction<'_>, rusqlite::Error> {
        self.connection.transaction()
    }

    #[allow(dead_code)]
    pub fn vacuum(&self) -> SqlResult<()> {
        info!("Performing database vacuum operation");
        self.connection.execute("VACUUM", [])?;
        Ok(())
    }
}
