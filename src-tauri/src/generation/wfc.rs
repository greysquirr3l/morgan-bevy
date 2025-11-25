// Wave Function Collapse implementation for procedural level generation
use crate::{GameObject, LevelData, Transform3D};
use anyhow::Result;
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct WFCGenerationParams {
    pub width: u32,
    pub height: u32,
    pub depth: u32,
    pub tileset: String,
    pub seed: Option<u64>,
    pub max_iterations: u32,
    pub backtrack_limit: u32,
}

impl Default for WFCGenerationParams {
    fn default() -> Self {
        Self {
            width: 24,
            height: 24,
            depth: 1,
            tileset: "dungeon".to_string(),
            seed: None,
            max_iterations: 10000,
            backtrack_limit: 100,
        }
    }
}

/// Represents a tile type with its constraints
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TileType {
    pub id: String,
    pub name: String,
    pub weight: f32,
    pub rotations: Vec<u32>, // Allowed rotations in degrees
    pub mesh_type: String,   // For 3D representation
}

/// Constraint rules for tile adjacency
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstraintRule {
    pub tile_id: String,
    pub direction: Direction,
    pub allowed_neighbors: HashSet<String>,
}

/// Cardinal directions for 2D WFC
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Direction {
    North,
    East,
    South,
    West,
}

impl Direction {
    pub fn all() -> Vec<Direction> {
        vec![
            Direction::North,
            Direction::East,
            Direction::South,
            Direction::West,
        ]
    }

    #[allow(dead_code)]
    pub fn opposite(&self) -> Direction {
        match self {
            Direction::North => Direction::South,
            Direction::South => Direction::North,
            Direction::East => Direction::West,
            Direction::West => Direction::East,
        }
    }
}

/// Represents a cell in the WFC grid
#[derive(Debug, Clone)]
pub struct WFCCell {
    pub possible_tiles: HashSet<String>,
    pub collapsed: bool,
    pub collapsed_tile: Option<String>,
}

impl WFCCell {
    pub fn new(possible_tiles: HashSet<String>) -> Self {
        Self {
            possible_tiles,
            collapsed: false,
            collapsed_tile: None,
        }
    }

    pub fn entropy(&self) -> usize {
        if self.collapsed {
            0
        } else {
            self.possible_tiles.len()
        }
    }

    pub fn collapse(&mut self, tile_id: String) {
        self.collapsed = true;
        self.collapsed_tile = Some(tile_id.clone());
        self.possible_tiles.clear();
        self.possible_tiles.insert(tile_id);
    }
}

/// Tileset definitions for different themes
pub struct TilesetLibrary;

impl TilesetLibrary {
    pub fn get_tileset(name: &str) -> (Vec<TileType>, Vec<ConstraintRule>) {
        match name {
            "dungeon" => Self::dungeon_tileset(),
            "office" => Self::office_tileset(),
            "scifi" => Self::scifi_tileset(),
            _ => Self::dungeon_tileset(), // Default
        }
    }

    fn dungeon_tileset() -> (Vec<TileType>, Vec<ConstraintRule>) {
        let tiles = vec![
            TileType {
                id: "wall".to_string(),
                name: "Wall".to_string(),
                weight: 1.0,
                rotations: vec![0],
                mesh_type: "cube".to_string(),
            },
            TileType {
                id: "floor".to_string(),
                name: "Floor".to_string(),
                weight: 2.0,
                rotations: vec![0],
                mesh_type: "cube".to_string(),
            },
            TileType {
                id: "door".to_string(),
                name: "Door".to_string(),
                weight: 0.1,
                rotations: vec![0, 90],
                mesh_type: "cube".to_string(),
            },
            TileType {
                id: "corner".to_string(),
                name: "Corner".to_string(),
                weight: 0.5,
                rotations: vec![0, 90, 180, 270],
                mesh_type: "cube".to_string(),
            },
        ];

        let mut constraints = Vec::new();

        // Wall constraints
        for dir in Direction::all() {
            constraints.push(ConstraintRule {
                tile_id: "wall".to_string(),
                direction: dir,
                allowed_neighbors: ["wall", "door", "corner"]
                    .iter()
                    .map(|s| s.to_string())
                    .collect(),
            });
        }

        // Floor constraints
        for dir in Direction::all() {
            constraints.push(ConstraintRule {
                tile_id: "floor".to_string(),
                direction: dir,
                allowed_neighbors: ["floor", "door", "corner"]
                    .iter()
                    .map(|s| s.to_string())
                    .collect(),
            });
        }

        // Door constraints (connects walls and floors)
        for dir in Direction::all() {
            constraints.push(ConstraintRule {
                tile_id: "door".to_string(),
                direction: dir,
                allowed_neighbors: ["wall", "floor", "door"]
                    .iter()
                    .map(|s| s.to_string())
                    .collect(),
            });
        }

        // Corner constraints
        for dir in Direction::all() {
            constraints.push(ConstraintRule {
                tile_id: "corner".to_string(),
                direction: dir,
                allowed_neighbors: ["wall", "floor", "corner"]
                    .iter()
                    .map(|s| s.to_string())
                    .collect(),
            });
        }

        (tiles, constraints)
    }

    fn office_tileset() -> (Vec<TileType>, Vec<ConstraintRule>) {
        // Simplified office tileset
        let tiles = vec![
            TileType {
                id: "carpet".to_string(),
                name: "Carpet".to_string(),
                weight: 2.0,
                rotations: vec![0],
                mesh_type: "cube".to_string(),
            },
            TileType {
                id: "wall".to_string(),
                name: "Office Wall".to_string(),
                weight: 1.0,
                rotations: vec![0],
                mesh_type: "cube".to_string(),
            },
            TileType {
                id: "desk".to_string(),
                name: "Desk".to_string(),
                weight: 0.3,
                rotations: vec![0, 90, 180, 270],
                mesh_type: "cube".to_string(),
            },
        ];

        let mut constraints = Vec::new();
        for dir in Direction::all() {
            constraints.push(ConstraintRule {
                tile_id: "carpet".to_string(),
                direction: dir,
                allowed_neighbors: ["carpet", "desk"].iter().map(|s| s.to_string()).collect(),
            });
        }

        (tiles, constraints)
    }

    fn scifi_tileset() -> (Vec<TileType>, Vec<ConstraintRule>) {
        // Simplified sci-fi tileset
        let tiles = vec![
            TileType {
                id: "metal_floor".to_string(),
                name: "Metal Floor".to_string(),
                weight: 2.0,
                rotations: vec![0],
                mesh_type: "cube".to_string(),
            },
            TileType {
                id: "hull_wall".to_string(),
                name: "Hull Wall".to_string(),
                weight: 1.0,
                rotations: vec![0],
                mesh_type: "cube".to_string(),
            },
            TileType {
                id: "console".to_string(),
                name: "Control Console".to_string(),
                weight: 0.2,
                rotations: vec![0, 90, 180, 270],
                mesh_type: "cube".to_string(),
            },
        ];

        let mut constraints = Vec::new();
        for dir in Direction::all() {
            constraints.push(ConstraintRule {
                tile_id: "metal_floor".to_string(),
                direction: dir,
                allowed_neighbors: ["metal_floor", "console"]
                    .iter()
                    .map(|s| s.to_string())
                    .collect(),
            });
        }

        (tiles, constraints)
    }
}

/// Main WFC Generator
pub struct WFCGenerator {
    rng: StdRng,
    tiles: Vec<TileType>,
    constraints: HashMap<(String, Direction), HashSet<String>>,
    grid: Vec<Vec<WFCCell>>,
    width: usize,
    height: usize,
}

impl WFCGenerator {
    pub fn new() -> Self {
        Self {
            rng: StdRng::seed_from_u64(0),
            tiles: Vec::new(),
            constraints: HashMap::new(),
            grid: Vec::new(),
            width: 0,
            height: 0,
        }
    }

    pub async fn generate(&mut self, params: WFCGenerationParams) -> Result<LevelData> {
        let seed = params.seed.unwrap_or_else(|| {
            use std::time::{SystemTime, UNIX_EPOCH};
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
        });

        self.rng = StdRng::seed_from_u64(seed);
        self.width = params.width as usize;
        self.height = params.height as usize;

        // Load tileset and constraints
        let (tiles, constraint_rules) = TilesetLibrary::get_tileset(&params.tileset);
        self.tiles = tiles;
        self.setup_constraints(constraint_rules);

        // Initialize grid
        self.initialize_grid();

        // Run WFC algorithm
        self.run_wfc(params.max_iterations, params.backtrack_limit)?;

        // Convert to level data
        self.create_level_data(seed, &params.tileset)
    }

    fn setup_constraints(&mut self, constraint_rules: Vec<ConstraintRule>) {
        self.constraints.clear();
        for rule in constraint_rules {
            let key = (rule.tile_id, rule.direction);
            self.constraints.insert(key, rule.allowed_neighbors);
        }
    }

    fn initialize_grid(&mut self) {
        let all_tile_ids: HashSet<String> = self.tiles.iter().map(|t| t.id.clone()).collect();

        self.grid = Vec::new();
        for _y in 0..self.height {
            let mut row = Vec::new();
            for _x in 0..self.width {
                row.push(WFCCell::new(all_tile_ids.clone()));
            }
            self.grid.push(row);
        }
    }

    fn run_wfc(&mut self, max_iterations: u32, backtrack_limit: u32) -> Result<()> {
        let mut iteration = 0;
        let mut backtrack_count = 0;
        let mut backtrack_stack: Vec<(usize, usize, HashSet<String>)> = Vec::new();

        while iteration < max_iterations {
            // Find cell with lowest entropy
            if let Some((x, y)) = self.find_lowest_entropy_cell() {
                // Save state for potential backtracking
                backtrack_stack.push((x, y, self.grid[y][x].possible_tiles.clone()));

                // Collapse the cell
                if let Some(tile_id) = self.choose_tile_for_cell(x, y) {
                    self.grid[y][x].collapse(tile_id);

                    // Propagate constraints
                    if !self.propagate_constraints(x, y) {
                        // Constraint violation - backtrack
                        if backtrack_count < backtrack_limit {
                            self.backtrack(&mut backtrack_stack);
                            backtrack_count += 1;
                            continue;
                        }
                        return Err(anyhow::anyhow!("WFC failed: too many backtracks"));
                    }
                } else {
                    // No valid tiles - backtrack
                    if backtrack_count < backtrack_limit {
                        self.backtrack(&mut backtrack_stack);
                        backtrack_count += 1;
                        continue;
                    }
                    return Err(anyhow::anyhow!("WFC failed: no valid tiles"));
                }
            } else {
                // All cells collapsed - success!
                break;
            }

            iteration += 1;
        }

        if iteration >= max_iterations {
            return Err(anyhow::anyhow!("WFC failed: max iterations exceeded"));
        }

        Ok(())
    }

    fn find_lowest_entropy_cell(&mut self) -> Option<(usize, usize)> {
        let mut min_entropy = usize::MAX;
        let mut candidates = Vec::new();

        for y in 0..self.height {
            for x in 0..self.width {
                let cell = &self.grid[y][x];
                if !cell.collapsed {
                    let entropy = cell.entropy();
                    if entropy > 0 && entropy < min_entropy {
                        min_entropy = entropy;
                        candidates.clear();
                        candidates.push((x, y));
                    } else if entropy == min_entropy {
                        candidates.push((x, y));
                    }
                }
            }
        }

        if candidates.is_empty() {
            None
        } else {
            let idx = self.rng.gen_range(0..candidates.len());
            Some(candidates[idx])
        }
    }

    fn choose_tile_for_cell(&mut self, x: usize, y: usize) -> Option<String> {
        let cell = &self.grid[y][x];
        if cell.possible_tiles.is_empty() {
            return None;
        }

        // Weight-based selection
        let mut weighted_tiles = Vec::new();
        for tile_id in &cell.possible_tiles {
            if let Some(tile) = self.tiles.iter().find(|t| &t.id == tile_id) {
                weighted_tiles.push((tile_id.clone(), tile.weight));
            }
        }

        if weighted_tiles.is_empty() {
            return None;
        }

        // Simple weighted random selection
        let total_weight: f32 = weighted_tiles.iter().map(|(_, w)| w).sum();
        let mut random_value = self.rng.gen::<f32>() * total_weight;

        for (tile_id, weight) in &weighted_tiles {
            random_value -= weight;
            if random_value <= 0.0 {
                return Some(tile_id.clone());
            }
        }

        // Fallback to first tile
        Some(weighted_tiles[0].0.clone())
    }

    fn propagate_constraints(&mut self, start_x: usize, start_y: usize) -> bool {
        let mut queue = VecDeque::new();
        queue.push_back((start_x, start_y));

        while let Some((x, y)) = queue.pop_front() {
            let current_tile = if let Some(ref tile) = self.grid[y][x].collapsed_tile {
                tile.clone()
            } else {
                continue;
            };

            // Check all neighbors
            for direction in Direction::all() {
                if let Some((nx, ny)) = self.get_neighbor_coords(x, y, direction) {
                    if nx < self.width && ny < self.height {
                        let neighbor_cell = &mut self.grid[ny][nx];

                        if !neighbor_cell.collapsed {
                            // Get allowed neighbors for this direction
                            let key = (current_tile.clone(), direction);
                            if let Some(allowed) = self.constraints.get(&key) {
                                // Remove tiles that are not allowed
                                let original_size = neighbor_cell.possible_tiles.len();
                                neighbor_cell.possible_tiles.retain(|t| allowed.contains(t));

                                if neighbor_cell.possible_tiles.is_empty() {
                                    return false; // Constraint violation
                                }

                                // If we reduced possibilities, add to queue
                                if neighbor_cell.possible_tiles.len() < original_size {
                                    queue.push_back((nx, ny));
                                }
                            }
                        }
                    }
                }
            }
        }

        true
    }

    fn get_neighbor_coords(
        &self,
        x: usize,
        y: usize,
        direction: Direction,
    ) -> Option<(usize, usize)> {
        match direction {
            Direction::North => {
                if y > 0 {
                    Some((x, y - 1))
                } else {
                    None
                }
            }
            Direction::South => {
                if y < self.height - 1 {
                    Some((x, y + 1))
                } else {
                    None
                }
            }
            Direction::West => {
                if x > 0 {
                    Some((x - 1, y))
                } else {
                    None
                }
            }
            Direction::East => {
                if x < self.width - 1 {
                    Some((x + 1, y))
                } else {
                    None
                }
            }
        }
    }

    fn backtrack(&mut self, backtrack_stack: &mut Vec<(usize, usize, HashSet<String>)>) {
        if let Some((x, y, possible_tiles)) = backtrack_stack.pop() {
            self.grid[y][x].collapsed = false;
            self.grid[y][x].collapsed_tile = None;
            self.grid[y][x].possible_tiles = possible_tiles;
        }
    }

    fn create_level_data(&self, seed: u64, tileset: &str) -> Result<LevelData> {
        let mut objects = Vec::new();

        for y in 0..self.height {
            for x in 0..self.width {
                if let Some(ref tile_id) = self.grid[y][x].collapsed_tile {
                    if let Some(tile) = self.tiles.iter().find(|t| &t.id == tile_id) {
                        let object = GameObject {
                            id: Uuid::new_v4().to_string(),
                            name: format!("{}_{}_{}_{}", tileset, tile.name, x, y),
                            transform: Transform3D {
                                position: [x as f32, 0.0, y as f32],
                                rotation: [0.0, 0.0, 0.0, 1.0],
                                scale: [1.0, 1.0, 1.0],
                            },
                            material: Some(format!("{}_{}", tileset, tile.id)),
                            mesh: Some(tile.mesh_type.clone()),
                            layer: "Generated".to_string(),
                            tags: vec!["wfc".to_string(), tileset.to_string()],
                            metadata: {
                                let mut map = HashMap::new();
                                map.insert(
                                    "tile_type".to_string(),
                                    serde_json::Value::String(tile.id.clone()),
                                );
                                map.insert(
                                    "algorithm".to_string(),
                                    serde_json::Value::String("WFC".to_string()),
                                );
                                map
                            },
                        };
                        objects.push(object);
                    }
                }
            }
        }

        Ok(LevelData {
            id: Uuid::new_v4().to_string(),
            name: format!("WFC Level {} ({})", seed, tileset),
            objects,
            layers: vec!["Generated".to_string()],
            generation_seed: Some(seed),
            generation_params: Some(serde_json::to_value(self.width)?),
            bounds: crate::spatial::BoundingBox {
                min: [0.0, 0.0, 0.0],
                max: [self.width as f32, 1.0, self.height as f32],
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wfc_generation() {
        tokio_test::block_on(async {
            let params = WFCGenerationParams::default();
            let mut generator = WFCGenerator::new();

            let result = generator.generate(params).await;
            assert!(result.is_ok());

            let level_data = result.unwrap();
            assert!(!level_data.objects.is_empty());
        });
    }

    #[test]
    fn test_tileset_loading() {
        let (tiles, constraints) = TilesetLibrary::get_tileset("dungeon");
        assert!(!tiles.is_empty());
        assert!(!constraints.is_empty());
    }
}
