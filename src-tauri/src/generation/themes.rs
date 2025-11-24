use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialInfo {
    pub diffuse: Option<String>,
    pub normal: Option<String>,
    pub metallic: Option<String>,
    pub roughness: Option<String>,
    pub emission: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub name: String,
    pub description: String,
    pub materials: HashMap<String, MaterialInfo>,
    pub mesh_variants: HashMap<String, Vec<String>>,
}

#[allow(dead_code)]
impl Theme {
    pub fn office() -> Self {
        let mut materials = HashMap::new();
        materials.insert("floor".to_string(), MaterialInfo {
            diffuse: Some("textures/office/carpet_diffuse.png".to_string()),
            normal: Some("textures/office/carpet_normal.png".to_string()),
            metallic: None,
            roughness: Some("textures/office/carpet_roughness.png".to_string()),
            emission: None,
        });
        
        materials.insert("wall".to_string(), MaterialInfo {
            diffuse: Some("textures/office/drywall_diffuse.png".to_string()),
            normal: Some("textures/office/drywall_normal.png".to_string()),
            metallic: None,
            roughness: Some("textures/office/drywall_roughness.png".to_string()),
            emission: None,
        });
        
        materials.insert("door".to_string(), MaterialInfo {
            diffuse: Some("textures/office/door_diffuse.png".to_string()),
            normal: Some("textures/office/door_normal.png".to_string()),
            metallic: Some("textures/office/door_metallic.png".to_string()),
            roughness: Some("textures/office/door_roughness.png".to_string()),
            emission: None,
        });
        
        materials.insert("corridor".to_string(), MaterialInfo {
            diffuse: Some("textures/office/tile_diffuse.png".to_string()),
            normal: Some("textures/office/tile_normal.png".to_string()),
            metallic: None,
            roughness: Some("textures/office/tile_roughness.png".to_string()),
            emission: None,
        });
        
        let mut mesh_variants = HashMap::new();
        mesh_variants.insert("wall".to_string(), vec![
            "meshes/office/wall_basic.mesh".to_string(),
            "meshes/office/wall_window.mesh".to_string(),
            "meshes/office/wall_corner.mesh".to_string(),
        ]);
        
        Self {
            name: "Office".to_string(),
            description: "Modern office environment with carpeted floors and drywall".to_string(),
            materials,
            mesh_variants,
        }
    }
    
    pub fn dungeon() -> Self {
        let mut materials = HashMap::new();
        materials.insert("floor".to_string(), MaterialInfo {
            diffuse: Some("textures/dungeon/stone_floor_diffuse.png".to_string()),
            normal: Some("textures/dungeon/stone_floor_normal.png".to_string()),
            metallic: None,
            roughness: Some("textures/dungeon/stone_floor_roughness.png".to_string()),
            emission: None,
        });
        
        materials.insert("wall".to_string(), MaterialInfo {
            diffuse: Some("textures/dungeon/stone_wall_diffuse.png".to_string()),
            normal: Some("textures/dungeon/stone_wall_normal.png".to_string()),
            metallic: None,
            roughness: Some("textures/dungeon/stone_wall_roughness.png".to_string()),
            emission: None,
        });
        
        materials.insert("door".to_string(), MaterialInfo {
            diffuse: Some("textures/dungeon/wooden_door_diffuse.png".to_string()),
            normal: Some("textures/dungeon/wooden_door_normal.png".to_string()),
            metallic: None,
            roughness: Some("textures/dungeon/wooden_door_roughness.png".to_string()),
            emission: None,
        });
        
        materials.insert("corridor".to_string(), MaterialInfo {
            diffuse: Some("textures/dungeon/cobblestone_diffuse.png".to_string()),
            normal: Some("textures/dungeon/cobblestone_normal.png".to_string()),
            metallic: None,
            roughness: Some("textures/dungeon/cobblestone_roughness.png".to_string()),
            emission: None,
        });
        
        let mut mesh_variants = HashMap::new();
        mesh_variants.insert("wall".to_string(), vec![
            "meshes/dungeon/stone_wall_basic.mesh".to_string(),
            "meshes/dungeon/stone_wall_damaged.mesh".to_string(),
            "meshes/dungeon/stone_wall_corner.mesh".to_string(),
        ]);
        
        Self {
            name: "Dungeon".to_string(),
            description: "Medieval dungeon with stone walls and cobblestone floors".to_string(),
            materials,
            mesh_variants,
        }
    }
    
    pub fn scifi() -> Self {
        let mut materials = HashMap::new();
        materials.insert("floor".to_string(), MaterialInfo {
            diffuse: Some("textures/scifi/metal_floor_diffuse.png".to_string()),
            normal: Some("textures/scifi/metal_floor_normal.png".to_string()),
            metallic: Some("textures/scifi/metal_floor_metallic.png".to_string()),
            roughness: Some("textures/scifi/metal_floor_roughness.png".to_string()),
            emission: Some("textures/scifi/metal_floor_emission.png".to_string()),
        });
        
        materials.insert("wall".to_string(), MaterialInfo {
            diffuse: Some("textures/scifi/panel_wall_diffuse.png".to_string()),
            normal: Some("textures/scifi/panel_wall_normal.png".to_string()),
            metallic: Some("textures/scifi/panel_wall_metallic.png".to_string()),
            roughness: Some("textures/scifi/panel_wall_roughness.png".to_string()),
            emission: Some("textures/scifi/panel_wall_emission.png".to_string()),
        });
        
        materials.insert("door".to_string(), MaterialInfo {
            diffuse: Some("textures/scifi/airlock_door_diffuse.png".to_string()),
            normal: Some("textures/scifi/airlock_door_normal.png".to_string()),
            metallic: Some("textures/scifi/airlock_door_metallic.png".to_string()),
            roughness: Some("textures/scifi/airlock_door_roughness.png".to_string()),
            emission: Some("textures/scifi/airlock_door_emission.png".to_string()),
        });
        
        materials.insert("corridor".to_string(), MaterialInfo {
            diffuse: Some("textures/scifi/grate_floor_diffuse.png".to_string()),
            normal: Some("textures/scifi/grate_floor_normal.png".to_string()),
            metallic: Some("textures/scifi/grate_floor_metallic.png".to_string()),
            roughness: Some("textures/scifi/grate_floor_roughness.png".to_string()),
            emission: None,
        });
        
        let mut mesh_variants = HashMap::new();
        mesh_variants.insert("wall".to_string(), vec![
            "meshes/scifi/panel_wall_basic.mesh".to_string(),
            "meshes/scifi/panel_wall_console.mesh".to_string(),
            "meshes/scifi/panel_wall_vent.mesh".to_string(),
        ]);
        
        Self {
            name: "SciFi".to_string(),
            description: "Futuristic space station with metal panels and glowing accents".to_string(),
            materials,
            mesh_variants,
        }
    }
    
    pub fn castle() -> Self {
        let mut materials = HashMap::new();
        materials.insert("floor".to_string(), MaterialInfo {
            diffuse: Some("textures/castle/stone_tile_diffuse.png".to_string()),
            normal: Some("textures/castle/stone_tile_normal.png".to_string()),
            metallic: None,
            roughness: Some("textures/castle/stone_tile_roughness.png".to_string()),
            emission: None,
        });
        
        materials.insert("wall".to_string(), MaterialInfo {
            diffuse: Some("textures/castle/brick_wall_diffuse.png".to_string()),
            normal: Some("textures/castle/brick_wall_normal.png".to_string()),
            metallic: None,
            roughness: Some("textures/castle/brick_wall_roughness.png".to_string()),
            emission: None,
        });
        
        materials.insert("door".to_string(), MaterialInfo {
            diffuse: Some("textures/castle/heavy_door_diffuse.png".to_string()),
            normal: Some("textures/castle/heavy_door_normal.png".to_string()),
            metallic: Some("textures/castle/heavy_door_metallic.png".to_string()),
            roughness: Some("textures/castle/heavy_door_roughness.png".to_string()),
            emission: None,
        });
        
        materials.insert("corridor".to_string(), MaterialInfo {
            diffuse: Some("textures/castle/flagstone_diffuse.png".to_string()),
            normal: Some("textures/castle/flagstone_normal.png".to_string()),
            metallic: None,
            roughness: Some("textures/castle/flagstone_roughness.png".to_string()),
            emission: None,
        });
        
        let mut mesh_variants = HashMap::new();
        mesh_variants.insert("wall".to_string(), vec![
            "meshes/castle/brick_wall_basic.mesh".to_string(),
            "meshes/castle/brick_wall_torch.mesh".to_string(),
            "meshes/castle/brick_wall_battlement.mesh".to_string(),
        ]);
        
        Self {
            name: "Castle".to_string(),
            description: "Medieval castle with brick walls and stone floors".to_string(),
            materials,
            mesh_variants,
        }
    }
    
    pub fn get_theme(name: &str) -> Option<Theme> {
        match name.to_lowercase().as_str() {
            "office" => Some(Self::office()),
            "dungeon" => Some(Self::dungeon()),
            "scifi" | "sci-fi" => Some(Self::scifi()),
            "castle" => Some(Self::castle()),
            _ => None,
        }
    }
    
    pub fn list_themes() -> Vec<String> {
        vec![
            "office".to_string(),
            "dungeon".to_string(),
            "scifi".to_string(),
            "castle".to_string(),
        ]
    }
}