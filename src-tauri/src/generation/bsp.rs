use crate::{BSPGenerationParams, LevelData, GameObject, Transform3D};
use crate::spatial::BoundingBox;
use anyhow::Result;
use log::info;
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TileType {
    Empty,
    Wall,
    Floor,
    Door,
    Corridor,
}

#[derive(Debug, Clone)]
pub struct Room {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub id: String,
}

#[derive(Debug, Clone)]
pub struct BSPNode {
    pub bounds: Room,
    pub left: Option<Box<BSPNode>>,
    pub right: Option<Box<BSPNode>>,
    pub room: Option<Room>,
}

pub struct BSPGenerator {
    rng: Option<StdRng>,
    grid: Vec<Vec<TileType>>,
    width: u32,
    height: u32,
    depth: u32,
}

impl BSPGenerator {
    pub fn new() -> Self {
        Self {
            rng: None,
            grid: Vec::new(),
            width: 0,
            height: 0,
            depth: 0,
        }
    }

    pub async fn generate(&self, params: BSPGenerationParams) -> Result<LevelData> {
        info!("Starting BSP generation with dimensions: {}x{}x{}", params.width, params.height, params.depth);
        
        let seed = params.seed.unwrap_or_else(|| {
            use std::time::{SystemTime, UNIX_EPOCH};
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
        });
        
        let mut generator = Self::new();
        generator.rng = Some(StdRng::seed_from_u64(seed));
        generator.width = params.width;
        generator.height = params.height;
        generator.depth = params.depth;
        
        // Initialize empty grid
        generator.grid = vec![vec![TileType::Empty; params.width as usize]; params.height as usize];
        
        // Generate BSP tree
        let root_room = Room {
            x: 0,
            y: 0,
            width: params.width,
            height: params.height,
            id: Uuid::new_v4().to_string(),
        };
        
        let bsp_tree = generator.generate_bsp_tree(root_room, &params)?;
        
        // Convert BSP tree to rooms and corridors
        generator.place_rooms(&bsp_tree, &params)?;
        generator.create_corridors(&bsp_tree, &params)?;
        
        // Convert grid to 3D objects
        let objects = generator.grid_to_objects(&params)?;
        
        let level_data = LevelData {
            id: Uuid::new_v4().to_string(),
            name: format!("BSP Level {}", seed),
            objects,
            layers: vec![
                "Walls".to_string(),
                "Floors".to_string(),
                "Doors".to_string(),
                "Collision".to_string(),
            ],
            generation_seed: Some(seed),
            generation_params: Some(serde_json::to_value(&params)?),
            bounds: BoundingBox {
                min: [0.0, 0.0, 0.0],
                max: [params.width as f32, params.depth as f32, params.height as f32],
            },
        };
        
        info!("BSP generation complete. Created {} objects", level_data.objects.len());
        Ok(level_data)
    }
    
    fn generate_bsp_tree(&mut self, room: Room, params: &BSPGenerationParams) -> Result<BSPNode> {
        let mut node = BSPNode {
            bounds: room.clone(),
            left: None,
            right: None,
            room: None,
        };
        
        // Stop subdividing if room is too small
        if room.width <= params.max_room_size && room.height <= params.max_room_size {
            if room.width >= params.min_room_size && room.height >= params.min_room_size {
                node.room = Some(room);
            }
            return Ok(node);
        }
        
        let rng = self.rng.as_mut().unwrap();
        
        // Decide whether to split horizontally or vertically
        let split_horizontal = if room.width > room.height {
            rng.gen_bool(0.8) // Prefer vertical split when width > height
        } else if room.height > room.width {
            rng.gen_bool(0.2) // Prefer horizontal split when height > width  
        } else {
            rng.gen_bool(0.5) // Random when square
        };
        
        if split_horizontal && room.height >= params.min_room_size * 2 {
            // Horizontal split
            let split_point = rng.gen_range(params.min_room_size..=(room.height - params.min_room_size));
            
            let left_room = Room {
                x: room.x,
                y: room.y,
                width: room.width,
                height: split_point,
                id: Uuid::new_v4().to_string(),
            };
            
            let right_room = Room {
                x: room.x,
                y: room.y + split_point,
                width: room.width,
                height: room.height - split_point,
                id: Uuid::new_v4().to_string(),
            };
            
            node.left = Some(Box::new(self.generate_bsp_tree(left_room, params)?));
            node.right = Some(Box::new(self.generate_bsp_tree(right_room, params)?));
            
        } else if !split_horizontal && room.width >= params.min_room_size * 2 {
            // Vertical split
            let split_point = rng.gen_range(params.min_room_size..=(room.width - params.min_room_size));
            
            let left_room = Room {
                x: room.x,
                y: room.y,
                width: split_point,
                height: room.height,
                id: Uuid::new_v4().to_string(),
            };
            
            let right_room = Room {
                x: room.x + split_point,
                y: room.y,
                width: room.width - split_point,
                height: room.height,
                id: Uuid::new_v4().to_string(),
            };
            
            node.left = Some(Box::new(self.generate_bsp_tree(left_room, params)?));
            node.right = Some(Box::new(self.generate_bsp_tree(right_room, params)?));
        } else {
            // Can't split further, make this a room
            if room.width >= params.min_room_size && room.height >= params.min_room_size {
                node.room = Some(room);
            }
        }
        
        Ok(node)
    }
    
    fn place_rooms(&mut self, node: &BSPNode, _params: &BSPGenerationParams) -> Result<()> {
        if let Some(ref room) = node.room {
            // Place floor tiles
            for y in room.y..room.y + room.height {
                for x in room.x..room.x + room.width {
                    if x < self.width && y < self.height {
                        self.grid[y as usize][x as usize] = TileType::Floor;
                    }
                }
            }
            
            // Place wall tiles around the room
            for y in room.y..room.y + room.height {
                for x in room.x..room.x + room.width {
                    if x < self.width && y < self.height {
                        // Check if this is a border tile
                        if x == room.x || x == room.x + room.width - 1 || 
                           y == room.y || y == room.y + room.height - 1 {
                            if self.grid[y as usize][x as usize] != TileType::Floor {
                                self.grid[y as usize][x as usize] = TileType::Wall;
                            }
                        }
                    }
                }
            }
        }
        
        // Recursively process children
        if let Some(ref left) = node.left {
            self.place_rooms(left, _params)?;
        }
        if let Some(ref right) = node.right {
            self.place_rooms(right, _params)?;
        }
        
        Ok(())
    }
    
    fn create_corridors(&mut self, node: &BSPNode, params: &BSPGenerationParams) -> Result<()> {
        // Connect child rooms with corridors
        if let (Some(ref left), Some(ref right)) = (&node.left, &node.right) {
            self.create_corridors(left, params)?;
            self.create_corridors(right, params)?;
            
            // Connect the two sides
            if let (Some(left_room), Some(right_room)) = (self.find_room(left), self.find_room(right)) {
                self.connect_rooms(&left_room, &right_room, params)?;
            }
        }
        
        Ok(())
    }
    
    fn find_room(&self, node: &BSPNode) -> Option<Room> {
        if let Some(ref room) = node.room {
            Some(room.clone())
        } else {
            // Look for first available room in children
            if let Some(ref left) = node.left {
                if let Some(room) = self.find_room(left) {
                    return Some(room);
                }
            }
            if let Some(ref right) = node.right {
                if let Some(room) = self.find_room(right) {
                    return Some(room);
                }
            }
            None
        }
    }
    
    fn connect_rooms(&mut self, room1: &Room, room2: &Room, params: &BSPGenerationParams) -> Result<()> {
        let rng = self.rng.as_mut().unwrap();
        
        // Find connection points (random points on room edges)
        let point1_x = rng.gen_range(room1.x + 1..room1.x + room1.width - 1);
        let point1_y = rng.gen_range(room1.y + 1..room1.y + room1.height - 1);
        
        let point2_x = rng.gen_range(room2.x + 1..room2.x + room2.width - 1);
        let point2_y = rng.gen_range(room2.y + 1..room2.y + room2.height - 1);
        
        // Create L-shaped corridor
        self.create_l_corridor(point1_x, point1_y, point2_x, point2_y, params.corridor_width)?;
        
        Ok(())
    }
    
    fn create_l_corridor(&mut self, x1: u32, y1: u32, x2: u32, y2: u32, width: u32) -> Result<()> {
        let rng = self.rng.as_mut().unwrap();
        
        // Choose corner point randomly
        let corner_x = if rng.gen_bool(0.5) { x1 } else { x2 };
        let corner_y = if corner_x == x1 { y2 } else { y1 };
        
        // Draw horizontal segment
        let (start_x, end_x) = if x1 < corner_x { (x1, corner_x) } else { (corner_x, x1) };
        for x in start_x..=end_x {
            for w in 0..width {
                let y = if corner_x == x1 { y1 + w } else { y2 + w };
                if x < self.width && y < self.height {
                    self.grid[y as usize][x as usize] = TileType::Corridor;
                }
            }
        }
        
        // Draw vertical segment
        let (start_y, end_y) = if y1 < corner_y { (y1, corner_y) } else { (corner_y, y1) };
        for y in start_y..=end_y {
            for w in 0..width {
                let x = if corner_x == x1 { x2 + w } else { x1 + w };
                if x < self.width && y < self.height {
                    self.grid[y as usize][x as usize] = TileType::Corridor;
                }
            }
        }
        
        Ok(())
    }
    
    fn grid_to_objects(&self, params: &BSPGenerationParams) -> Result<Vec<GameObject>> {
        let mut objects = Vec::new();
        
        for (y, row) in self.grid.iter().enumerate() {
            for (x, &tile) in row.iter().enumerate() {
                match tile {
                    TileType::Floor => {
                        objects.push(self.create_floor_object(x as f32, y as f32, &params.theme)?);
                    }
                    TileType::Wall => {
                        objects.push(self.create_wall_object(x as f32, y as f32, &params.theme)?);
                    }
                    TileType::Corridor => {
                        objects.push(self.create_corridor_object(x as f32, y as f32, &params.theme)?);
                    }
                    TileType::Door => {
                        objects.push(self.create_door_object(x as f32, y as f32, &params.theme)?);
                    }
                    TileType::Empty => {} // Skip empty tiles
                }
            }
        }
        
        Ok(objects)
    }
    
    fn create_floor_object(&self, x: f32, y: f32, theme: &str) -> Result<GameObject> {
        Ok(GameObject {
            id: Uuid::new_v4().to_string(),
            name: format!("floor_{}_{}", x as u32, y as u32),
            transform: Transform3D {
                position: [x, 0.0, y],
                rotation: [0.0, 0.0, 0.0, 1.0], // Identity quaternion
                scale: [1.0, 0.1, 1.0],
            },
            material: Some(format!("materials/{}/floor.mat", theme)),
            mesh: Some("meshes/cube.mesh".to_string()),
            layer: "Floors".to_string(),
            tags: vec!["floor".to_string(), theme.to_string()],
            metadata: HashMap::new(),
        })
    }
    
    fn create_wall_object(&self, x: f32, y: f32, theme: &str) -> Result<GameObject> {
        Ok(GameObject {
            id: Uuid::new_v4().to_string(),
            name: format!("wall_{}_{}", x as u32, y as u32),
            transform: Transform3D {
                position: [x, 1.0, y],
                rotation: [0.0, 0.0, 0.0, 1.0],
                scale: [1.0, 2.0, 1.0],
            },
            material: Some(format!("materials/{}/wall.mat", theme)),
            mesh: Some("meshes/cube.mesh".to_string()),
            layer: "Walls".to_string(),
            tags: vec!["wall".to_string(), "collision".to_string(), theme.to_string()],
            metadata: HashMap::new(),
        })
    }
    
    fn create_corridor_object(&self, x: f32, y: f32, theme: &str) -> Result<GameObject> {
        Ok(GameObject {
            id: Uuid::new_v4().to_string(),
            name: format!("corridor_{}_{}", x as u32, y as u32),
            transform: Transform3D {
                position: [x, 0.0, y],
                rotation: [0.0, 0.0, 0.0, 1.0],
                scale: [1.0, 0.1, 1.0],
            },
            material: Some(format!("materials/{}/corridor.mat", theme)),
            mesh: Some("meshes/cube.mesh".to_string()),
            layer: "Floors".to_string(),
            tags: vec!["corridor".to_string(), theme.to_string()],
            metadata: HashMap::new(),
        })
    }
    
    fn create_door_object(&self, x: f32, y: f32, theme: &str) -> Result<GameObject> {
        Ok(GameObject {
            id: Uuid::new_v4().to_string(),
            name: format!("door_{}_{}", x as u32, y as u32),
            transform: Transform3D {
                position: [x, 1.0, y],
                rotation: [0.0, 0.0, 0.0, 1.0],
                scale: [1.0, 2.0, 0.2],
            },
            material: Some(format!("materials/{}/door.mat", theme)),
            mesh: Some("meshes/door.mesh".to_string()),
            layer: "Doors".to_string(),
            tags: vec!["door".to_string(), "interactive".to_string(), theme.to_string()],
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("interactive".to_string(), serde_json::Value::Bool(true));
                meta.insert("opens".to_string(), serde_json::Value::String("both".to_string()));
                meta
            },
        })
    }
}