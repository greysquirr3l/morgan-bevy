use chrono::{DateTime, Utc};
use log::info;
use rusqlite::{params, Connection, Result as SqlResult, Transaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

/// Filter definition for a smart folder. All fields are optional
/// and combine with AND semantics. `tags` matches an asset that
/// carries *every* listed tag; pass an empty array to skip the tag
/// constraint. Stored verbatim in the `smart_folders.filter_json`
/// column so the schema can evolve independently of the Rust type.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct SmartFolderFilter {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asset_type: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(default)]
    pub favorite_only: bool,
}

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
    /// T32: in-memory variant used by unit tests. Calls
    /// `initialize_schema` so callers get a fully-initialised
    /// database without touching the filesystem.
    #[cfg(test)]
    pub fn new_in_memory() -> SqlResult<Self> {
        let connection = Connection::open_in_memory()?;
        let db = Self { connection };
        db.initialize_schema()?;
        Ok(db)
    }

    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self, Box<dyn std::error::Error>> {
        // Ensure the directory exists
        if let Some(parent) = db_path.as_ref().parent() {
            fs::create_dir_all(parent)?;
        }

        let connection = Connection::open(db_path)?;
        let db = Self { connection };
        db.initialize_schema()?;
        Ok(db)
    }

    fn initialize_schema(&self) -> SqlResult<()> {
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

        // T32: favorites flag on each asset. New column added via
        // ALTER TABLE in `apply_migrations` for backward compat with
        // older databases — see the bottom of `initialize_schema`.
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS smart_folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                filter_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Create indexes for performance
        self.create_indexes()?;

        // Insert default collections
        self.insert_default_collections()?;

        // T32: in-place migrations for older databases. ALTER TABLE
        // ADD COLUMN accepts 0 for booleans so this is a no-op when
        // the column already exists.
        if !self.column_exists("assets", "is_favorite")? {
            self.connection.execute(
                "ALTER TABLE assets ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
        }

        info!("Asset database schema initialized successfully");
        Ok(())
    }

    /// T32: cheap schema-introspection helper used by the migration
    /// above. Wraps `PRAGMA table_info` so we don't have to hand-
    /// roll a `sqlite_master` parser.
    fn column_exists(&self, table: &str, column: &str) -> SqlResult<bool> {
        let mut stmt = self
            .connection
            .prepare(&format!("PRAGMA table_info({table})"))?;
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let name: String = row.get(1)?;
            if name == column {
                return Ok(true);
            }
        }
        Ok(false)
    }

    fn create_indexes(&self) -> SqlResult<()> {
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

    fn insert_default_collections(&self) -> SqlResult<()> {
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
        &self,
        asset_path: &Path,
        collection: &str,
    ) -> Result<i64, Box<dyn std::error::Error>> {
        let metadata = fs::metadata(asset_path)?;
        let file_size = metadata.len().cast_signed();

        // Calculate checksum
        let checksum = Self::calculate_file_checksum(asset_path)?;

        let file_name = asset_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid filename")?;

        let asset_type = Self::determine_asset_type(asset_path);
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

        info!("Inserted asset: {file_name} (ID: {asset_id})");
        Ok(asset_id)
    }

    fn calculate_file_checksum(file_path: &Path) -> Result<String, Box<dyn std::error::Error>> {
        let contents = fs::read(file_path)?;
        let mut hasher = Sha256::new();
        hasher.update(&contents);
        Ok(format!("{:x}", hasher.finalize()))
    }

    pub fn determine_asset_type(file_path: &Path) -> String {
        match file_path.extension().and_then(|ext| ext.to_str()) {
            Some("fbx" | "FBX") => "Model",
            Some("png" | "PNG" | "jpg" | "JPG" | "jpeg" | "JPEG") => "Texture",
            Some("wav" | "WAV" | "mp3" | "MP3" | "ogg" | "OGG") => "Audio",
            Some("mat" | "MAT") => "Material",
            _ => "Unknown",
        }
        .to_string()
    }

    fn extract_and_store_metadata(
        &self,
        asset_id: i64,
        asset_path: &Path,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let asset_type = Self::determine_asset_type(asset_path);

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

    fn insert_metadata(&self, asset_id: i64, key: &str, value: &str) -> SqlResult<()> {
        self.connection.execute(
            "INSERT OR REPLACE INTO asset_metadata (asset_id, key, value) VALUES (?1, ?2, ?3)",
            params![asset_id, key, value],
        )?;
        Ok(())
    }

    fn update_collection_count(&self, collection_name: &str) -> SqlResult<()> {
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
            params.push(format!("%{query}%"));
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
    pub fn add_thumbnail(&self, asset_id: i64, thumbnail_path: &str) -> SqlResult<()> {
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

    // ─── T32: tags, favorites, smart folders ────────────────────────────────

    /// T32: attach `tag_name` to `asset_id`. Idempotent — repeating the
    /// call with the same arguments is a no-op (UNIQUE constraint).
    pub fn add_asset_tag(&self, asset_id: i64, tag_name: &str) -> SqlResult<()> {
        let trimmed = tag_name.trim();
        if trimmed.is_empty() {
            return Ok(());
        }
        self.connection.execute(
            "INSERT OR IGNORE INTO asset_tags (asset_id, tag_name) VALUES (?1, ?2)",
            params![asset_id, trimmed],
        )?;
        Ok(())
    }

    /// T32: detach `tag_name` from `asset_id`.
    pub fn remove_asset_tag(&self, asset_id: i64, tag_name: &str) -> SqlResult<()> {
        self.connection.execute(
            "DELETE FROM asset_tags WHERE asset_id = ?1 AND tag_name = ?2",
            params![asset_id, tag_name],
        )?;
        Ok(())
    }

    /// T32: distinct tag names attached to `asset_id`, in lexical order.
    #[allow(dead_code)]
    pub fn list_tags_for_asset(&self, asset_id: i64) -> SqlResult<Vec<String>> {
        let mut stmt = self
            .connection
            .prepare("SELECT tag_name FROM asset_tags WHERE asset_id = ?1 ORDER BY tag_name")?;
        let rows = stmt.query_map(params![asset_id], |row| row.get::<_, String>(0))?;
        rows.collect()
    }

    /// T32: every distinct tag, with the number of assets carrying it,
    /// ordered most-used first. Used to power the tag-autocomplete UI.
    pub fn list_all_tags(&self) -> SqlResult<Vec<(String, i64)>> {
        let mut stmt = self.connection.prepare(
            "SELECT tag_name, COUNT(asset_id) AS uses \
             FROM asset_tags GROUP BY tag_name ORDER BY uses DESC, tag_name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        rows.collect()
    }

    /// T32: asset IDs that carry *every* tag in `tags`. AND semantics,
    /// not OR. Returns IDs in reverse-insertion order.
    #[allow(dead_code)]
    pub fn search_by_tags(&self, tags: &[String]) -> SqlResult<Vec<i64>> {
        if tags.is_empty() {
            return Ok(vec![]);
        }
        let placeholders = std::iter::repeat_n("?", tags.len())
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT asset_id FROM asset_tags \
             WHERE tag_name IN ({placeholders}) \
             GROUP BY asset_id \
             HAVING COUNT(DISTINCT tag_name) = ? \
             ORDER BY asset_id DESC"
        );
        let mut stmt = self.connection.prepare(&sql)?;
        let mut params_vec: Vec<&dyn rusqlite::ToSql> =
            tags.iter().map(|t| t as &dyn rusqlite::ToSql).collect();
        // The count fits in i64 on any practical target — tag count
        // never approaches 2^53 — so the wrap is theoretical only.
        let expected = i64::try_from(tags.len())
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        params_vec.push(&expected);
        let rows = stmt.query_map(params_vec.as_slice(), |row| row.get::<_, i64>(0))?;
        rows.collect()
    }

    /// T32: flip the favorite flag on an asset. Returns the new value.
    pub fn toggle_asset_favorite(&self, asset_id: i64) -> SqlResult<bool> {
        self.connection.execute(
            "UPDATE assets SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END \
             WHERE id = ?1",
            params![asset_id],
        )?;
        let new: i64 = self.connection.query_row(
            "SELECT is_favorite FROM assets WHERE id = ?1",
            params![asset_id],
            |row| row.get(0),
        )?;
        Ok(new != 0)
    }

    /// T32: every asset marked as a favorite, newest first.
    #[allow(dead_code)]
    pub fn list_favorites(&self) -> SqlResult<Vec<AssetRecord>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, name, file_path, asset_type, collection, file_size, checksum, \
             created_at, updated_at FROM assets \
             WHERE is_favorite = 1 \
             ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], Self::row_to_asset_record)?;
        rows.collect()
    }

    fn row_to_asset_record(row: &rusqlite::Row<'_>) -> SqlResult<AssetRecord> {
        Ok(AssetRecord {
            id: row.get(0)?,
            name: row.get(1)?,
            file_path: row.get(2)?,
            asset_type: row.get(3)?,
            collection: row.get(4)?,
            file_size: row.get(5)?,
            checksum: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }

    /// T32: persist a smart folder. If a row with the same name
    /// already exists, update the filter. Returns the row id.
    pub fn save_smart_folder(&self, name: &str, filter: &SmartFolderFilter) -> SqlResult<i64> {
        let json = serde_json::to_string(filter).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
        })?;
        self.connection.execute(
            "INSERT INTO smart_folders (name, filter_json) VALUES (?1, ?2) \
             ON CONFLICT(name) DO UPDATE SET filter_json = excluded.filter_json, \
                                            updated_at = CURRENT_TIMESTAMP",
            params![name, json],
        )?;
        let id: i64 = self.connection.query_row(
            "SELECT id FROM smart_folders WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )?;
        Ok(id)
    }

    /// T32: every saved smart folder (filter deserialised back to
    /// the typed `SmartFolderFilter`).
    #[allow(dead_code)]
    pub fn list_smart_folders(&self) -> SqlResult<Vec<(i64, String, SmartFolderFilter)>> {
        let mut stmt = self
            .connection
            .prepare("SELECT id, name, filter_json FROM smart_folders ORDER BY name")?;
        let rows = stmt.query_map([], |row| {
            let id: i64 = row.get(0)?;
            let name: String = row.get(1)?;
            let json: String = row.get(2)?;
            let filter: SmartFolderFilter = serde_json::from_str(&json).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    2,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })?;
            Ok((id, name, filter))
        })?;
        rows.collect()
    }

    /// T32: evaluate a smart folder and return the matching asset
    /// records. AND semantics across fields: every constraint that
    /// is set must match.
    pub fn evaluate_smart_folder(&self, filter: &SmartFolderFilter) -> SqlResult<Vec<AssetRecord>> {
        let mut sql = String::from(
            "SELECT DISTINCT a.id, a.name, a.file_path, a.asset_type, a.collection, \
             a.file_size, a.checksum, a.created_at, a.updated_at \
             FROM assets a WHERE 1 = 1",
        );
        let mut binds: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref asset_type) = filter.asset_type {
            sql.push_str(" AND a.asset_type = ?");
            binds.push(Box::new(asset_type.clone()));
        }
        if filter.favorite_only {
            sql.push_str(" AND a.is_favorite = 1");
        }
        if !filter.tags.is_empty() {
            // Subquery: assets that carry every listed tag (same
            // COUNT(DISTINCT) = N trick used by `search_by_tags`).
            let placeholders = std::iter::repeat_n("?", filter.tags.len())
                .collect::<Vec<_>>()
                .join(",");
            // Building SQL incrementally; `use std::fmt::Write` would
            // be marginally faster but the readability win of
            // `write!` chains isn't worth it for two appends.
            #[allow(clippy::format_push_string)]
            sql.push_str(&format!(
                " AND a.id IN (SELECT asset_id FROM asset_tags \
                 WHERE tag_name IN ({placeholders}) \
                 GROUP BY asset_id \
                 HAVING COUNT(DISTINCT tag_name) = ?)"
            ));
            for tag in &filter.tags {
                binds.push(Box::new(tag.clone()));
            }
            binds.push(Box::new(i64::try_from(filter.tags.len()).map_err(|e| {
                rusqlite::Error::ToSqlConversionFailure(Box::new(e))
            })?));
        }
        sql.push_str(" ORDER BY a.updated_at DESC");

        let bind_refs: Vec<&dyn rusqlite::ToSql> = binds
            .iter()
            .map(|b| b.as_ref() as &dyn rusqlite::ToSql)
            .collect();
        let mut stmt = self.connection.prepare(&sql)?;
        let rows = stmt.query_map(bind_refs.as_slice(), Self::row_to_asset_record)?;
        rows.collect()
    }
}

#[cfg(test)]
mod t32_tests {
    #![allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::indexing_slicing,
        reason = "test code is allowed to use unwrap/expect for concise assertions"
    )]

    use super::*;

    /// Build an in-memory database and seed three assets so the
    /// tests don't have to plumb path / collection fixtures.
    /// `:memory:` is the fastest `SQLite` lifecycle for unit tests.
    fn fixture() -> AssetDatabase {
        let db = AssetDatabase::new_in_memory().expect("in-memory db");
        // The default collections are auto-inserted by
        // `initialize_schema`, but tests need a plain `default`
        // collection to satisfy the FK on `assets.collection`.
        db.connection
            .execute(
                "INSERT OR IGNORE INTO collections (name, description) VALUES ('default', 'fixture')",
                [],
            )
            .unwrap();
        for (id, name, asset_type) in [
            (1, "wall.png", "texture"),
            (2, "floor.png", "texture"),
            (3, "enemy.gltf", "model"),
        ] {
            db.connection
                .execute(
                    "INSERT INTO assets (id, name, file_path, asset_type, collection, file_size, checksum) \
                     VALUES (?1, ?2, ?3, ?4, 'default', 1, 'sha256:demo')",
                    rusqlite::params![id, name, format!("/tmp/{name}"), asset_type],
                )
                .unwrap();
        }
        db
    }

    #[test]
    fn add_and_list_tags() {
        let db = fixture();
        db.add_asset_tag(1, "wall").unwrap();
        db.add_asset_tag(1, "stone").unwrap();
        db.add_asset_tag(2, "floor").unwrap();
        // Idempotent: re-adding is a no-op.
        db.add_asset_tag(1, "wall").unwrap();
        let tags = db.list_tags_for_asset(1).unwrap();
        assert_eq!(tags, vec!["stone".to_string(), "wall".to_string()]);
    }

    #[test]
    fn remove_tag_drops_only_named_row() {
        let db = fixture();
        db.add_asset_tag(1, "wall").unwrap();
        db.add_asset_tag(1, "stone").unwrap();
        db.remove_asset_tag(1, "wall").unwrap();
        assert_eq!(
            db.list_tags_for_asset(1).unwrap(),
            vec!["stone".to_string()]
        );
    }

    #[test]
    fn list_all_tags_orders_by_use_count() {
        let db = fixture();
        db.add_asset_tag(1, "common").unwrap();
        db.add_asset_tag(2, "common").unwrap();
        db.add_asset_tag(1, "rare").unwrap();
        let all = db.list_all_tags().unwrap();
        // "common" has 2 uses, "rare" has 1.
        assert_eq!(all.first().unwrap().0, "common");
        assert_eq!(all.first().unwrap().1, 2);
    }

    #[test]
    fn search_by_tags_uses_and_semantics() {
        let db = fixture();
        db.add_asset_tag(1, "wall").unwrap();
        db.add_asset_tag(1, "stone").unwrap();
        db.add_asset_tag(2, "floor").unwrap();
        // Asset 1 has both "wall" and "stone" — should match.
        let matches = db
            .search_by_tags(&["wall".to_string(), "stone".to_string()])
            .unwrap();
        assert_eq!(matches, vec![1]);
        // No asset has both wall + missing → empty.
        let none = db
            .search_by_tags(&["wall".to_string(), "missing".to_string()])
            .unwrap();
        assert!(none.is_empty());
    }

    #[test]
    fn toggle_favorite_flips_state() {
        let db = fixture();
        assert!(db.toggle_asset_favorite(1).unwrap());
        assert!(!db.toggle_asset_favorite(1).unwrap());
        assert!(db.toggle_asset_favorite(1).unwrap());
    }

    #[test]
    fn list_favorites_returns_only_favourited_assets() {
        let db = fixture();
        db.toggle_asset_favorite(2).unwrap();
        let favs = db.list_favorites().unwrap();
        assert_eq!(favs.len(), 1);
        assert_eq!(favs[0].id, 2);
    }

    #[test]
    fn smart_folder_round_trips_filter() {
        let db = fixture();
        let filter = SmartFolderFilter {
            asset_type: Some("texture".to_string()),
            tags: vec!["wall".to_string()],
            favorite_only: false,
        };
        let id = db.save_smart_folder("walls", &filter).unwrap();
        assert!(id > 0);
        let folders = db.list_smart_folders().unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].1, "walls");
        assert_eq!(folders[0].2, filter);
    }

    #[test]
    fn evaluate_smart_folder_combines_filters_with_and_semantics() {
        let db = fixture();
        db.add_asset_tag(1, "wall").unwrap();
        db.add_asset_tag(1, "stone").unwrap();
        db.add_asset_tag(2, "floor").unwrap();
        // asset_type=texture AND tag=wall → only asset 1.
        let filter = SmartFolderFilter {
            asset_type: Some("texture".to_string()),
            tags: vec!["wall".to_string()],
            favorite_only: false,
        };
        let matches = db.evaluate_smart_folder(&filter).unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].id, 1);

        // favourite_only=true with no favourites → empty.
        let filter = SmartFolderFilter {
            asset_type: None,
            tags: vec![],
            favorite_only: true,
        };
        assert!(db.evaluate_smart_folder(&filter).unwrap().is_empty());

        // Mark asset 1 as favourite, then favourite_only returns it.
        db.toggle_asset_favorite(1).unwrap();
        let matches = db.evaluate_smart_folder(&filter).unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].id, 1);
    }
}
