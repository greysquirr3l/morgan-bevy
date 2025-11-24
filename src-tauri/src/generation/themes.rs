use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents different tile types in the level
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum TileType {
    Empty,
    Floor,
    Wall,
    Door,
    Window,
    Corridor,
    Room,
    Stairs,
    Special,
}

/// Visual representation for 2D grid display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileVisual {
    pub icon: char,
    pub color: String,
    pub background_color: Option<String>,
}

/// 3D mesh information for tile-to-3D conversion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileMesh {
    pub mesh_type: String,
    pub material: String,
    pub scale: (f32, f32, f32),
    pub rotation: (f32, f32, f32),
    pub offset: (f32, f32, f32),
}

/// Complete tile definition combining type, visual, and 3D data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileDefinition {
    pub tile_type: TileType,
    pub name: String,
    pub description: String,
    pub visual: TileVisual,
    pub mesh: TileMesh,
    pub collision: bool,
    pub walkable: bool,
    pub tags: Vec<String>,
}

/// Theme lighting configuration  
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeLighting {
    pub ambient_color: (f32, f32, f32),
    pub ambient_intensity: f32,
    pub directional_color: (f32, f32, f32),
    pub directional_intensity: f32,
    pub directional_direction: (f32, f32, f32),
    pub shadow_enabled: bool,
}

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
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub version: String,
    pub tiles: HashMap<String, TileDefinition>,
    pub default_floor_height: f32,
    pub wall_height: f32,
    pub lighting: ThemeLighting,
    pub materials: HashMap<String, MaterialInfo>,
    pub mesh_variants: HashMap<String, Vec<String>>,
}

#[allow(dead_code)]
impl Theme {
    pub fn office() -> Self {
        let mut materials = HashMap::new();
        materials.insert(
            "floor".to_string(),
            MaterialInfo {
                diffuse: Some("textures/office/carpet_diffuse.png".to_string()),
                normal: Some("textures/office/carpet_normal.png".to_string()),
                metallic: None,
                roughness: Some("textures/office/carpet_roughness.png".to_string()),
                emission: None,
            },
        );

        materials.insert(
            "wall".to_string(),
            MaterialInfo {
                diffuse: Some("textures/office/drywall_diffuse.png".to_string()),
                normal: Some("textures/office/drywall_normal.png".to_string()),
                metallic: None,
                roughness: Some("textures/office/drywall_roughness.png".to_string()),
                emission: None,
            },
        );

        materials.insert(
            "door".to_string(),
            MaterialInfo {
                diffuse: Some("textures/office/door_diffuse.png".to_string()),
                normal: Some("textures/office/door_normal.png".to_string()),
                metallic: Some("textures/office/door_metallic.png".to_string()),
                roughness: Some("textures/office/door_roughness.png".to_string()),
                emission: None,
            },
        );

        materials.insert(
            "corridor".to_string(),
            MaterialInfo {
                diffuse: Some("textures/office/tile_diffuse.png".to_string()),
                normal: Some("textures/office/tile_normal.png".to_string()),
                metallic: None,
                roughness: Some("textures/office/tile_roughness.png".to_string()),
                emission: None,
            },
        );

        let mut mesh_variants = HashMap::new();
        mesh_variants.insert(
            "wall".to_string(),
            vec![
                "meshes/office/wall_basic.mesh".to_string(),
                "meshes/office/wall_window.mesh".to_string(),
                "meshes/office/wall_corner.mesh".to_string(),
            ],
        );

        let mut tiles = HashMap::new();

        // Floor tile
        tiles.insert(
            "floor".to_string(),
            TileDefinition {
                tile_type: TileType::Floor,
                name: "Carpet Floor".to_string(),
                description: "Office carpeted flooring".to_string(),
                visual: TileVisual {
                    icon: '.',
                    color: "#8B7355".to_string(),
                    background_color: Some("#F5F5DC".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "plane".to_string(),
                    material: "floor".to_string(),
                    scale: (1.0, 0.05, 1.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec!["ground".to_string(), "office".to_string()],
            },
        );

        // Wall tile
        tiles.insert(
            "wall".to_string(),
            TileDefinition {
                tile_type: TileType::Wall,
                name: "Drywall".to_string(),
                description: "Standard office drywall partition".to_string(),
                visual: TileVisual {
                    icon: '#',
                    color: "#E6E6E6".to_string(),
                    background_color: Some("#F0F0F0".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "cube".to_string(),
                    material: "wall".to_string(),
                    scale: (1.0, 3.0, 0.2),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 1.5, 0.0),
                },
                collision: true,
                walkable: false,
                tags: vec!["barrier".to_string(), "office".to_string()],
            },
        );

        // Door tile
        tiles.insert(
            "door".to_string(),
            TileDefinition {
                tile_type: TileType::Door,
                name: "Office Door".to_string(),
                description: "Standard office door with frame".to_string(),
                visual: TileVisual {
                    icon: 'D',
                    color: "#8B4513".to_string(),
                    background_color: Some("#DEB887".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "door_frame".to_string(),
                    material: "door".to_string(),
                    scale: (1.0, 3.0, 0.2),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 1.5, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec!["interactive".to_string(), "office".to_string()],
            },
        );

        // Window tile
        tiles.insert(
            "window".to_string(),
            TileDefinition {
                tile_type: TileType::Window,
                name: "Office Window".to_string(),
                description: "Office window with blinds".to_string(),
                visual: TileVisual {
                    icon: 'O',
                    color: "#87CEEB".to_string(),
                    background_color: Some("#E0F6FF".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "window_frame".to_string(),
                    material: "wall".to_string(),
                    scale: (1.0, 2.0, 0.2),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 1.0, 0.0),
                },
                collision: true,
                walkable: false,
                tags: vec![
                    "barrier".to_string(),
                    "transparent".to_string(),
                    "office".to_string(),
                ],
            },
        );

        // Corridor tile
        tiles.insert(
            "corridor".to_string(),
            TileDefinition {
                tile_type: TileType::Corridor,
                name: "Tile Floor".to_string(),
                description: "Office corridor with tile flooring".to_string(),
                visual: TileVisual {
                    icon: ' ',
                    color: "#C0C0C0".to_string(),
                    background_color: Some("#F8F8FF".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "plane".to_string(),
                    material: "corridor".to_string(),
                    scale: (1.0, 0.05, 1.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec![
                    "ground".to_string(),
                    "corridor".to_string(),
                    "office".to_string(),
                ],
            },
        );

        // Empty/void tile
        tiles.insert(
            "empty".to_string(),
            TileDefinition {
                tile_type: TileType::Empty,
                name: "Empty Space".to_string(),
                description: "Unoccupied space".to_string(),
                visual: TileVisual {
                    icon: ' ',
                    color: "#000000".to_string(),
                    background_color: None,
                },
                mesh: TileMesh {
                    mesh_type: "none".to_string(),
                    material: "none".to_string(),
                    scale: (0.0, 0.0, 0.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: false,
                tags: vec!["void".to_string()],
            },
        );

        Self {
            id: "office".to_string(),
            name: "Office".to_string(),
            description: "Modern office environment with carpeted floors and drywall".to_string(),
            author: "Morgan-Bevy".to_string(),
            version: "1.0.0".to_string(),
            tiles,
            default_floor_height: 0.0,
            wall_height: 3.0,
            lighting: ThemeLighting {
                ambient_color: (0.9, 0.9, 1.0),
                ambient_intensity: 0.4,
                directional_color: (1.0, 1.0, 0.9),
                directional_intensity: 0.8,
                directional_direction: (-0.5, -1.0, -0.3),
                shadow_enabled: true,
            },
            materials,
            mesh_variants,
        }
    }

    pub fn dungeon() -> Self {
        let mut materials = HashMap::new();
        materials.insert(
            "floor".to_string(),
            MaterialInfo {
                diffuse: Some("textures/dungeon/stone_floor_diffuse.png".to_string()),
                normal: Some("textures/dungeon/stone_floor_normal.png".to_string()),
                metallic: None,
                roughness: Some("textures/dungeon/stone_floor_roughness.png".to_string()),
                emission: None,
            },
        );

        materials.insert(
            "wall".to_string(),
            MaterialInfo {
                diffuse: Some("textures/dungeon/stone_wall_diffuse.png".to_string()),
                normal: Some("textures/dungeon/stone_wall_normal.png".to_string()),
                metallic: None,
                roughness: Some("textures/dungeon/stone_wall_roughness.png".to_string()),
                emission: None,
            },
        );

        materials.insert(
            "door".to_string(),
            MaterialInfo {
                diffuse: Some("textures/dungeon/wooden_door_diffuse.png".to_string()),
                normal: Some("textures/dungeon/wooden_door_normal.png".to_string()),
                metallic: None,
                roughness: Some("textures/dungeon/wooden_door_roughness.png".to_string()),
                emission: None,
            },
        );

        materials.insert(
            "corridor".to_string(),
            MaterialInfo {
                diffuse: Some("textures/dungeon/cobblestone_diffuse.png".to_string()),
                normal: Some("textures/dungeon/cobblestone_normal.png".to_string()),
                metallic: None,
                roughness: Some("textures/dungeon/cobblestone_roughness.png".to_string()),
                emission: None,
            },
        );

        let mut mesh_variants = HashMap::new();
        mesh_variants.insert(
            "wall".to_string(),
            vec![
                "meshes/dungeon/stone_wall_basic.mesh".to_string(),
                "meshes/dungeon/stone_wall_damaged.mesh".to_string(),
                "meshes/dungeon/stone_wall_corner.mesh".to_string(),
            ],
        );

        let mut tiles = HashMap::new();

        // Floor tile
        tiles.insert(
            "floor".to_string(),
            TileDefinition {
                tile_type: TileType::Floor,
                name: "Stone Floor".to_string(),
                description: "Weathered stone dungeon flooring".to_string(),
                visual: TileVisual {
                    icon: '·',
                    color: "#696969".to_string(),
                    background_color: Some("#2F2F2F".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "plane".to_string(),
                    material: "floor".to_string(),
                    scale: (1.0, 0.1, 1.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec!["ground".to_string(), "dungeon".to_string()],
            },
        );

        // Wall tile
        tiles.insert(
            "wall".to_string(),
            TileDefinition {
                tile_type: TileType::Wall,
                name: "Stone Wall".to_string(),
                description: "Thick stone dungeon wall".to_string(),
                visual: TileVisual {
                    icon: '█',
                    color: "#555555".to_string(),
                    background_color: Some("#1C1C1C".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "cube".to_string(),
                    material: "wall".to_string(),
                    scale: (1.0, 4.0, 0.3),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 2.0, 0.0),
                },
                collision: true,
                walkable: false,
                tags: vec!["barrier".to_string(), "dungeon".to_string()],
            },
        );

        // Door tile
        tiles.insert(
            "door".to_string(),
            TileDefinition {
                tile_type: TileType::Door,
                name: "Iron Gate".to_string(),
                description: "Heavy iron-reinforced wooden door".to_string(),
                visual: TileVisual {
                    icon: '☩',
                    color: "#8B4513".to_string(),
                    background_color: Some("#654321".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "gate_door".to_string(),
                    material: "door".to_string(),
                    scale: (1.0, 4.0, 0.3),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 2.0, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec!["interactive".to_string(), "dungeon".to_string()],
            },
        );

        // Corridor tile
        tiles.insert(
            "corridor".to_string(),
            TileDefinition {
                tile_type: TileType::Corridor,
                name: "Cobblestone".to_string(),
                description: "Uneven cobblestone corridor".to_string(),
                visual: TileVisual {
                    icon: '▓',
                    color: "#808080".to_string(),
                    background_color: Some("#404040".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "plane".to_string(),
                    material: "corridor".to_string(),
                    scale: (1.0, 0.15, 1.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec![
                    "ground".to_string(),
                    "corridor".to_string(),
                    "dungeon".to_string(),
                ],
            },
        );

        // Stairs tile
        tiles.insert(
            "stairs".to_string(),
            TileDefinition {
                tile_type: TileType::Stairs,
                name: "Stone Stairs".to_string(),
                description: "Worn stone staircase".to_string(),
                visual: TileVisual {
                    icon: '≡',
                    color: "#696969".to_string(),
                    background_color: Some("#3C3C3C".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "stairs".to_string(),
                    material: "floor".to_string(),
                    scale: (1.0, 1.0, 1.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.5, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec!["vertical".to_string(), "dungeon".to_string()],
            },
        );

        // Empty/void tile
        tiles.insert(
            "empty".to_string(),
            TileDefinition {
                tile_type: TileType::Empty,
                name: "Void".to_string(),
                description: "Dark emptiness".to_string(),
                visual: TileVisual {
                    icon: ' ',
                    color: "#000000".to_string(),
                    background_color: None,
                },
                mesh: TileMesh {
                    mesh_type: "none".to_string(),
                    material: "none".to_string(),
                    scale: (0.0, 0.0, 0.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: false,
                tags: vec!["void".to_string()],
            },
        );

        Self {
            id: "dungeon".to_string(),
            name: "Dungeon".to_string(),
            description: "Medieval dungeon with stone walls and cobblestone floors".to_string(),
            author: "Morgan-Bevy".to_string(),
            version: "1.0.0".to_string(),
            tiles,
            default_floor_height: 0.0,
            wall_height: 4.0,
            lighting: ThemeLighting {
                ambient_color: (0.3, 0.2, 0.4),
                ambient_intensity: 0.2,
                directional_color: (1.0, 0.8, 0.4),
                directional_intensity: 0.6,
                directional_direction: (-0.3, -1.0, -0.5),
                shadow_enabled: true,
            },
            materials,
            mesh_variants,
        }
    }

    pub fn scifi() -> Self {
        let mut materials = HashMap::new();
        materials.insert(
            "floor".to_string(),
            MaterialInfo {
                diffuse: Some("textures/scifi/metal_floor_diffuse.png".to_string()),
                normal: Some("textures/scifi/metal_floor_normal.png".to_string()),
                metallic: Some("textures/scifi/metal_floor_metallic.png".to_string()),
                roughness: Some("textures/scifi/metal_floor_roughness.png".to_string()),
                emission: Some("textures/scifi/metal_floor_emission.png".to_string()),
            },
        );

        materials.insert(
            "wall".to_string(),
            MaterialInfo {
                diffuse: Some("textures/scifi/panel_wall_diffuse.png".to_string()),
                normal: Some("textures/scifi/panel_wall_normal.png".to_string()),
                metallic: Some("textures/scifi/panel_wall_metallic.png".to_string()),
                roughness: Some("textures/scifi/panel_wall_roughness.png".to_string()),
                emission: Some("textures/scifi/panel_wall_emission.png".to_string()),
            },
        );

        materials.insert(
            "door".to_string(),
            MaterialInfo {
                diffuse: Some("textures/scifi/airlock_door_diffuse.png".to_string()),
                normal: Some("textures/scifi/airlock_door_normal.png".to_string()),
                metallic: Some("textures/scifi/airlock_door_metallic.png".to_string()),
                roughness: Some("textures/scifi/airlock_door_roughness.png".to_string()),
                emission: Some("textures/scifi/airlock_door_emission.png".to_string()),
            },
        );

        materials.insert(
            "corridor".to_string(),
            MaterialInfo {
                diffuse: Some("textures/scifi/grate_floor_diffuse.png".to_string()),
                normal: Some("textures/scifi/grate_floor_normal.png".to_string()),
                metallic: Some("textures/scifi/grate_floor_metallic.png".to_string()),
                roughness: Some("textures/scifi/grate_floor_roughness.png".to_string()),
                emission: None,
            },
        );

        let mut mesh_variants = HashMap::new();
        mesh_variants.insert(
            "wall".to_string(),
            vec![
                "meshes/scifi/panel_wall_basic.mesh".to_string(),
                "meshes/scifi/panel_wall_console.mesh".to_string(),
                "meshes/scifi/panel_wall_vent.mesh".to_string(),
            ],
        );

        let mut tiles = HashMap::new();

        // Floor tile
        tiles.insert(
            "floor".to_string(),
            TileDefinition {
                tile_type: TileType::Floor,
                name: "Metal Deck".to_string(),
                description: "Reinforced metal deck plating".to_string(),
                visual: TileVisual {
                    icon: '░',
                    color: "#C0C0C0".to_string(),
                    background_color: Some("#1E1E2E".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "plane".to_string(),
                    material: "floor".to_string(),
                    scale: (1.0, 0.05, 1.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec!["ground".to_string(), "scifi".to_string()],
            },
        );

        // Wall tile
        tiles.insert(
            "wall".to_string(),
            TileDefinition {
                tile_type: TileType::Wall,
                name: "Panel Wall".to_string(),
                description: "High-tech metal panel wall with circuits".to_string(),
                visual: TileVisual {
                    icon: '▊',
                    color: "#4682B4".to_string(),
                    background_color: Some("#191970".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "cube".to_string(),
                    material: "wall".to_string(),
                    scale: (1.0, 3.5, 0.2),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 1.75, 0.0),
                },
                collision: true,
                walkable: false,
                tags: vec![
                    "barrier".to_string(),
                    "scifi".to_string(),
                    "electronic".to_string(),
                ],
            },
        );

        // Door tile
        tiles.insert(
            "door".to_string(),
            TileDefinition {
                tile_type: TileType::Door,
                name: "Airlock".to_string(),
                description: "Pressurized airlock door".to_string(),
                visual: TileVisual {
                    icon: '◊',
                    color: "#FFD700".to_string(),
                    background_color: Some("#4B0082".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "airlock_door".to_string(),
                    material: "door".to_string(),
                    scale: (1.0, 3.5, 0.2),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 1.75, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec![
                    "interactive".to_string(),
                    "scifi".to_string(),
                    "electronic".to_string(),
                ],
            },
        );

        // Corridor tile
        tiles.insert(
            "corridor".to_string(),
            TileDefinition {
                tile_type: TileType::Corridor,
                name: "Grating".to_string(),
                description: "Metal grating over maintenance areas".to_string(),
                visual: TileVisual {
                    icon: '▒',
                    color: "#B0B0B0".to_string(),
                    background_color: Some("#2F2F4F".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "grating".to_string(),
                    material: "corridor".to_string(),
                    scale: (1.0, 0.1, 1.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec![
                    "ground".to_string(),
                    "corridor".to_string(),
                    "scifi".to_string(),
                ],
            },
        );

        // Console tile
        tiles.insert(
            "console".to_string(),
            TileDefinition {
                tile_type: TileType::Special,
                name: "Control Console".to_string(),
                description: "Interactive control terminal".to_string(),
                visual: TileVisual {
                    icon: '▲',
                    color: "#00FF00".to_string(),
                    background_color: Some("#000080".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "console".to_string(),
                    material: "wall".to_string(),
                    scale: (0.8, 1.5, 0.6),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.75, 0.0),
                },
                collision: true,
                walkable: false,
                tags: vec![
                    "interactive".to_string(),
                    "scifi".to_string(),
                    "electronic".to_string(),
                ],
            },
        );

        // Empty/void tile
        tiles.insert(
            "empty".to_string(),
            TileDefinition {
                tile_type: TileType::Empty,
                name: "Space Void".to_string(),
                description: "Empty space - dangerous vacuum".to_string(),
                visual: TileVisual {
                    icon: ' ',
                    color: "#000000".to_string(),
                    background_color: None,
                },
                mesh: TileMesh {
                    mesh_type: "none".to_string(),
                    material: "none".to_string(),
                    scale: (0.0, 0.0, 0.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: false,
                tags: vec!["void".to_string(), "dangerous".to_string()],
            },
        );

        Self {
            id: "scifi".to_string(),
            name: "SciFi".to_string(),
            description: "Futuristic space station with metal panels and glowing accents"
                .to_string(),
            author: "Morgan-Bevy".to_string(),
            version: "1.0.0".to_string(),
            tiles,
            default_floor_height: 0.0,
            wall_height: 3.5,
            lighting: ThemeLighting {
                ambient_color: (0.1, 0.2, 0.4),
                ambient_intensity: 0.3,
                directional_color: (0.8, 1.0, 1.0),
                directional_intensity: 0.7,
                directional_direction: (0.0, -1.0, -0.2),
                shadow_enabled: true,
            },
            materials,
            mesh_variants,
        }
    }

    pub fn castle() -> Self {
        let mut materials = HashMap::new();
        materials.insert(
            "floor".to_string(),
            MaterialInfo {
                diffuse: Some("textures/castle/stone_tile_diffuse.png".to_string()),
                normal: Some("textures/castle/stone_tile_normal.png".to_string()),
                metallic: None,
                roughness: Some("textures/castle/stone_tile_roughness.png".to_string()),
                emission: None,
            },
        );

        materials.insert(
            "wall".to_string(),
            MaterialInfo {
                diffuse: Some("textures/castle/brick_wall_diffuse.png".to_string()),
                normal: Some("textures/castle/brick_wall_normal.png".to_string()),
                metallic: None,
                roughness: Some("textures/castle/brick_wall_roughness.png".to_string()),
                emission: None,
            },
        );

        materials.insert(
            "door".to_string(),
            MaterialInfo {
                diffuse: Some("textures/castle/heavy_door_diffuse.png".to_string()),
                normal: Some("textures/castle/heavy_door_normal.png".to_string()),
                metallic: Some("textures/castle/heavy_door_metallic.png".to_string()),
                roughness: Some("textures/castle/heavy_door_roughness.png".to_string()),
                emission: None,
            },
        );

        materials.insert(
            "corridor".to_string(),
            MaterialInfo {
                diffuse: Some("textures/castle/flagstone_diffuse.png".to_string()),
                normal: Some("textures/castle/flagstone_normal.png".to_string()),
                metallic: None,
                roughness: Some("textures/castle/flagstone_roughness.png".to_string()),
                emission: None,
            },
        );

        let mut mesh_variants = HashMap::new();
        mesh_variants.insert(
            "wall".to_string(),
            vec![
                "meshes/castle/brick_wall_basic.mesh".to_string(),
                "meshes/castle/brick_wall_torch.mesh".to_string(),
                "meshes/castle/brick_wall_battlement.mesh".to_string(),
            ],
        );

        let mut tiles = HashMap::new();

        // Floor tile
        tiles.insert(
            "floor".to_string(),
            TileDefinition {
                tile_type: TileType::Floor,
                name: "Stone Tiles".to_string(),
                description: "Polished castle stone flooring".to_string(),
                visual: TileVisual {
                    icon: '⬜',
                    color: "#D3D3D3".to_string(),
                    background_color: Some("#708090".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "plane".to_string(),
                    material: "floor".to_string(),
                    scale: (1.0, 0.1, 1.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec!["ground".to_string(), "castle".to_string()],
            },
        );

        // Wall tile
        tiles.insert(
            "wall".to_string(),
            TileDefinition {
                tile_type: TileType::Wall,
                name: "Castle Wall".to_string(),
                description: "Massive stone castle wall".to_string(),
                visual: TileVisual {
                    icon: '▌',
                    color: "#778899".to_string(),
                    background_color: Some("#2F4F4F".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "cube".to_string(),
                    material: "wall".to_string(),
                    scale: (1.0, 5.0, 0.5),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 2.5, 0.0),
                },
                collision: true,
                walkable: false,
                tags: vec!["barrier".to_string(), "castle".to_string()],
            },
        );

        // Door tile
        tiles.insert(
            "door".to_string(),
            TileDefinition {
                tile_type: TileType::Door,
                name: "Great Door".to_string(),
                description: "Heavy wooden door with iron reinforcement".to_string(),
                visual: TileVisual {
                    icon: '⚿',
                    color: "#8B4513".to_string(),
                    background_color: Some("#A0522D".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "great_door".to_string(),
                    material: "door".to_string(),
                    scale: (1.0, 5.0, 0.3),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 2.5, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec!["interactive".to_string(), "castle".to_string()],
            },
        );

        // Window tile
        tiles.insert(
            "window".to_string(),
            TileDefinition {
                tile_type: TileType::Window,
                name: "Arrow Slit".to_string(),
                description: "Narrow defensive window".to_string(),
                visual: TileVisual {
                    icon: '⬦',
                    color: "#87CEEB".to_string(),
                    background_color: Some("#2F4F4F".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "arrow_slit".to_string(),
                    material: "wall".to_string(),
                    scale: (1.0, 3.0, 0.5),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 1.5, 0.0),
                },
                collision: true,
                walkable: false,
                tags: vec![
                    "barrier".to_string(),
                    "defensive".to_string(),
                    "castle".to_string(),
                ],
            },
        );

        // Corridor tile
        tiles.insert(
            "corridor".to_string(),
            TileDefinition {
                tile_type: TileType::Corridor,
                name: "Flagstone".to_string(),
                description: "Large stone slabs forming corridors".to_string(),
                visual: TileVisual {
                    icon: '▥',
                    color: "#A9A9A9".to_string(),
                    background_color: Some("#696969".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "plane".to_string(),
                    material: "corridor".to_string(),
                    scale: (1.0, 0.15, 1.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec![
                    "ground".to_string(),
                    "corridor".to_string(),
                    "castle".to_string(),
                ],
            },
        );

        // Stairs tile
        tiles.insert(
            "stairs".to_string(),
            TileDefinition {
                tile_type: TileType::Stairs,
                name: "Stone Steps".to_string(),
                description: "Grand stone staircase".to_string(),
                visual: TileVisual {
                    icon: '⬌',
                    color: "#D3D3D3".to_string(),
                    background_color: Some("#778899".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "stairs".to_string(),
                    material: "floor".to_string(),
                    scale: (1.0, 1.0, 1.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.5, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec!["vertical".to_string(), "castle".to_string()],
            },
        );

        // Empty/void tile
        tiles.insert(
            "empty".to_string(),
            TileDefinition {
                tile_type: TileType::Empty,
                name: "Courtyard".to_string(),
                description: "Open castle courtyard".to_string(),
                visual: TileVisual {
                    icon: ' ',
                    color: "#228B22".to_string(),
                    background_color: Some("#006400".to_string()),
                },
                mesh: TileMesh {
                    mesh_type: "grass".to_string(),
                    material: "grass".to_string(),
                    scale: (1.0, 0.05, 1.0),
                    rotation: (0.0, 0.0, 0.0),
                    offset: (0.0, 0.0, 0.0),
                },
                collision: false,
                walkable: true,
                tags: vec!["outdoor".to_string(), "castle".to_string()],
            },
        );

        Self {
            id: "castle".to_string(),
            name: "Castle".to_string(),
            description: "Medieval castle with brick walls and stone floors".to_string(),
            author: "Morgan-Bevy".to_string(),
            version: "1.0.0".to_string(),
            tiles,
            default_floor_height: 0.0,
            wall_height: 5.0,
            lighting: ThemeLighting {
                ambient_color: (0.8, 0.7, 0.6),
                ambient_intensity: 0.3,
                directional_color: (1.0, 0.9, 0.7),
                directional_intensity: 0.9,
                directional_direction: (-0.4, -1.0, -0.6),
                shadow_enabled: true,
            },
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

/// Built-in theme library
pub struct ThemeLibrary;

impl ThemeLibrary {
    /// Get all available themes
    pub fn get_all_themes() -> Vec<Theme> {
        vec![
            Theme::office(),
            Theme::dungeon(),
            Theme::scifi(),
            Theme::castle(),
        ]
    }

    /// Get theme by ID
    pub fn get_theme(id: &str) -> Option<Theme> {
        Theme::get_theme(id)
    }
}

/// Convert theme tile to 2D grid character
pub fn tile_to_char(theme: &Theme, tile_key: &str) -> char {
    theme
        .tiles
        .get(tile_key)
        .map(|tile| tile.visual.icon)
        .unwrap_or('?')
}

/// Convert 2D grid character to tile key
pub fn char_to_tile(theme: &Theme, ch: char) -> Option<String> {
    for (key, tile) in &theme.tiles {
        if tile.visual.icon == ch {
            return Some(key.clone());
        }
    }
    None
}

/// Generate a legend for a theme showing all available tiles
pub fn generate_theme_legend(theme: &Theme) -> String {
    let mut legend = format!("Legend for {} Theme:\n", theme.name);

    for (key, tile) in &theme.tiles {
        legend.push_str(&format!(
            "  {} = {} ({})\n",
            tile.visual.icon, tile.name, key
        ));
    }

    legend
}

/// Convert a 2D grid string to tile map using theme
pub fn parse_grid_string(theme: &Theme, grid: &str) -> Vec<Vec<String>> {
    grid.lines()
        .map(|line| {
            line.chars()
                .map(|ch| char_to_tile(theme, ch).unwrap_or_else(|| "empty".to_string()))
                .collect()
        })
        .collect()
}

/// Convert tile map to 2D grid string for display
pub fn render_grid_string(theme: &Theme, tile_map: &[Vec<String>]) -> String {
    tile_map
        .iter()
        .map(|row| {
            row.iter()
                .map(|tile_key| tile_to_char(theme, tile_key))
                .collect::<String>()
        })
        .collect::<Vec<String>>()
        .join("\n")
}
