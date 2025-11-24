#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::{info, error};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use tauri::State;

mod generation;
mod export;
mod spatial;

use generation::bsp::BSPGenerator;
use export::{ExportFormat, LevelExporter};
use spatial::{SpatialIndex, BoundingBox};

// Core data structures for level editing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transform3D {
    pub position: [f32; 3],
    pub rotation: [f32; 4], // quaternion [x, y, z, w]
    pub scale: [f32; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameObject {
    pub id: String,
    pub name: String,
    pub transform: Transform3D,
    pub material: Option<String>,
    pub mesh: Option<String>,
    pub layer: String,
    pub tags: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LevelData {
    pub id: String,
    pub name: String,
    pub objects: Vec<GameObject>,
    pub layers: Vec<String>,
    pub generation_seed: Option<u64>,
    pub generation_params: Option<serde_json::Value>,
    pub bounds: BoundingBox,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BSPGenerationParams {
    pub width: u32,
    pub height: u32,
    pub depth: u32,
    pub min_room_size: u32,
    pub max_room_size: u32,
    pub corridor_width: u32,
    pub theme: String,
    pub seed: Option<u64>,
}

// Application state
#[derive(Default)]
pub struct AppState {
    pub current_level: Option<LevelData>,
    pub spatial_index: SpatialIndex,
}

// Tauri Commands

#[tauri::command]
async fn generate_bsp_level(
    params: BSPGenerationParams,
    state: State<'_, std::sync::Mutex<AppState>>
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
            
            info!("Successfully generated level with {} objects", level_data.objects.len());
            Ok(level_data)
        }
        Err(e) => {
            error!("Failed to generate BSP level: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn export_level(
    level_data: LevelData,
    formats: Vec<ExportFormat>,
    output_path: String
) -> Result<String, String> {
    info!("Exporting level to {:?} formats at path: {}", formats, output_path);
    
    let exporter = LevelExporter::new();
    match exporter.export_multi_format(&level_data, &formats, &output_path).await {
        Ok(export_paths) => {
            let paths_str = export_paths.join(", ");
            info!("Successfully exported to: {}", paths_str);
            Ok(paths_str)
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
    state: State<'_, std::sync::Mutex<AppState>>
) -> Result<Vec<String>, String> {
    let app_state = state.lock().unwrap();
    let object_ids = app_state.spatial_index.query_bounds(&bounds);
    Ok(object_ids)
}

#[tauri::command]
async fn update_object_transform(
    object_id: String,
    transform: Transform3D,
    state: State<'_, std::sync::Mutex<AppState>>
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
    state: State<'_, std::sync::Mutex<AppState>>
) -> Result<Option<LevelData>, String> {
    let app_state = state.lock().unwrap();
    Ok(app_state.current_level.clone())
}

#[tauri::command]
async fn save_level_to_file(
    level_data: LevelData,
    file_path: String
) -> Result<(), String> {
    info!("Saving level to file: {}", file_path);
    
    let json_data = serde_json::to_string_pretty(&level_data)
        .map_err(|e| format!("Failed to serialize level data: {}", e))?;
    
    std::fs::write(&file_path, json_data)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    info!("Successfully saved level to: {}", file_path);
    Ok(())
}

#[tauri::command]
async fn load_level_from_file(
    file_path: String,
    state: State<'_, std::sync::Mutex<AppState>>
) -> Result<LevelData, String> {
    info!("Loading level from file: {}", file_path);
    
    let file_content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let level_data: LevelData = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse level data: {}", e))?;
    
    // Update application state
    let mut app_state = state.lock().unwrap();
    app_state.spatial_index.clear();
    for obj in &level_data.objects {
        app_state.spatial_index.insert(&obj.id, &obj.transform);
    }
    app_state.current_level = Some(level_data.clone());
    
    info!("Successfully loaded level with {} objects", level_data.objects.len());
    Ok(level_data)
}

fn main() {
    env_logger::init();
    info!("Starting Morgan-Bevy Level Editor");

    tauri::Builder::default()
        .manage(std::sync::Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            generate_bsp_level,
            export_level,
            query_objects_in_bounds,
            update_object_transform,
            get_current_level,
            save_level_to_file,
            load_level_from_file
        ])
        .setup(|_app| {
            info!("Tauri application setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}