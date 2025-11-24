# Morgan-Bevy: Visual 3D Level Editor & Procedural Generator

## 🎯 Project Vision

Morgan-Bevy is a **comprehensive 3D level editor** for Bevy game development that combines the power of procedural generation (BSP, WFC) with full manual editing capabilities. Think "Unity Editor meets Procedural Generation" - start with algorithmic generation, then refine with professional 3D editing tools.

**Core Philosophy**: "Generate smart, edit fast, export perfect."

## 📋 Project Overview

### What It Does

Morgan-Bevy is a hybrid Rust/TypeScript application that:

1. **Generates levels procedurally** using BSP and WFC algorithms
2. **Provides full 3D editing** with mouse selection, transform gizmos, and grid snapping
3. **Enables real-time manipulation** - move, rotate, scale, duplicate any element
4. **Supports multi-selection** and bulk operations
5. **Exports multiple formats** optimized for Bevy integration (JSON, RON, Text, Rust code)
6. **Manages complex scenes** with hierarchy, layers, and prefabs

### Target Users

- **Game Developers** building Bevy games who need professional level editing tools
- **Level Designers** who want procedural generation as a starting point, not an endpoint
- **Technical Artists** creating modular building systems
- **Indie Developers** needing a free, powerful alternative to commercial editors

## 🏗️ Technical Architecture

### Technology Stack

**Frontend (3D Editor Interface)**

- **Tauri + React** for desktop application framework
- **Three.js** or **Babylon.js** for 3D rendering and manipulation
- **TypeScript** for type-safe UI logic
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Three Fiber** (if using Three.js) for React integration

**Backend (Generation & Export Engine)**

- **Rust** core algorithms (BSP, WFC, spatial queries)
- **Rapier3D** for physics/collision detection (optional)
- **Serde** for serialization
- **Native binary** via Tauri with full file system access

**3D Interaction System**

- **Raycasting** for mouse picking in 3D space
- **Transform gizmos** for object manipulation
- **Grid snapping** with configurable resolution
- **Multi-selection** with bounding box visualization
- **Camera system** with multiple modes (orbit, fly, top-down)

### Why Tauri + Three.js/Babylon.js?

**Tauri Benefits:**

- Native performance with Rust backend
- Small binary size (~3-5 MB)
- Direct file system access
- Cross-platform (Windows, Mac, Linux)
- Auto-updater built-in

**Three.js Benefits:**

- Mature, well-documented 3D library
- Extensive community and examples
- React Three Fiber for component-based 3D
- Built-in raycasting and selection
- Transform controls included

**Babylon.js Alternative:**

- More game-focused than Three.js
- Better performance for complex scenes
- Built-in physics integration
- More complete out-of-box editor features

**Recommendation**: Start with **Three.js + React Three Fiber** for faster MVP, consider Babylon.js for performance-critical scenarios.

## ✨ Core Features

### 1. Procedural Generation (Starting Point)

#### Binary Space Partitioning (BSP)

- Recursive subdivision into rooms
- L-shaped corridor generation
- Configurable parameters:
  - Split iterations (depth)
  - Min/max room sizes
  - Corridor width
  - Large room probability
  - Wall thickness

#### Wave Function Collapse (WFC)

- Constraint-based generation
- Theme-based rulesets
- Local similarity patterns
- Configurable entropy and backtracking

#### Generation Modes (Themes)

- **Office Buildings** - Cubicles, conference rooms, lobbies
- **Fantasy Dungeons** - Chambers, secret passages, treasure rooms
- **Medieval Castles** - Towers, courtyards, battlements
- **Sci-Fi Facilities** - Labs, airlocks, maintenance tunnels
- **Multi-Building Complexes** - Connected structures
- **Custom** - User-defined tile sets

### 2. 3D Editor Features (Core Functionality)

#### Selection System

**Mouse Selection:**

- Left Click: Select single object
- Ctrl+Click: Add to selection
- Shift+Click: Select range (in hierarchy)
- Click+Drag: Box selection (2D screen space)
- Alt+Click+Drag: Lasso selection

**Keyboard Selection:**

- Ctrl+A: Select all
- Ctrl+D: Deselect all
- Ctrl+I: Invert selection
- H: Hide selected
- Shift+H: Unhide all

#### Transform Controls

**Gizmo Modes:**

- W: Translate (move)
- E: Rotate
- R: Scale
- T: Toggle local/world space

**Grid Snapping:**

- Hold Ctrl while transforming
- Configurable snap increments:
  - Position: 0.1, 0.5, 1.0, 2.0 units
  - Rotation: 5°, 15°, 45°, 90°
  - Scale: 0.1, 0.25, 0.5, 1.0x

**Surface Snapping:**

- Hold Shift+Ctrl: Snap to surface
- Align normals automatically

#### Camera Controls

**Orbit Mode (Default):**

- Middle Mouse: Pan
- Right Mouse: Rotate
- Scroll: Zoom
- F: Frame selected object
- Alt+F: Frame all

**Fly Mode (F key to toggle):**

- WASD: Move camera
- Q/E: Up/down
- Right Mouse Hold: Look around
- Shift: Fast movement
- Ctrl: Slow movement

**Top-Down Mode (T key):**

- Orthographic projection
- Ideal for precise placement
- Grid always visible

#### Object Manipulation

**Duplicate & Copy:**

- Ctrl+D: Duplicate selected
- Ctrl+C: Copy
- Ctrl+V: Paste
- Alt+Drag: Duplicate while moving

**Alignment Tools:**

- Align to grid
- Align to other objects (snap points)
- Distribute evenly
- Center in parent

**Boolean Operations:**

- Union: Combine meshes
- Subtract: Cut holes
- Intersect: Keep overlap

### 3. Scene Management

#### Hierarchy Panel

```text
┌─────────────────────────────┐
│ 🏢 Level_Office_01          │
├─────────────────────────────┤
│ └─ 🏗️ Floor_1               │
│    ├─ 📦 Walls               │
│    │  ├─ Wall_001 👁️         │
│    │  ├─ Wall_002 👁️         │
│    │  └─ Wall_003 👁️🔒       │
│    ├─ 🚪 Doors               │
│    │  ├─ Door_Main 👁️        │
│    │  └─ Door_Office_A 👁️   │
│    ├─ 💡 Lights              │
│    │  ├─ MainLight 👁️        │
│    │  └─ AmbientLight 👁️    │
│    └─ 🎯 Special             │
│       ├─ Elevator 👁️         │
│       └─ Lobby 👁️            │
└─────────────────────────────┘
```

**Controls:**

- Drag to reorder/reparent
- Right-click for context menu
- 👁️ = Toggle visibility
- 🔒 = Lock from selection/editing
- Double-click to rename

#### Inspector Panel

```text
┌─────────────────────────────┐
│ Wall_001                    │
├─────────────────────────────┤
│ Transform                   │
│ Position                    │
│   X: [2.0]  Y: [0.0]  Z: [5.0] │
│ Rotation                    │
│   X: [0°]   Y: [90°]  Z: [0°] │
│ Scale                       │
│   X: [1.0]  Y: [3.5]  Z: [0.2] │
│                             │
│ Mesh                        │
│ ▼ Wall_Standard             │
│                             │
│ Material                    │
│ ▼ Concrete_Gray             │
│   Base Color: [#808080]    │
│   Metallic: [0.0] ━━●━━━   │
│   Roughness: [0.8] ━━━━●━  │
│                             │
│ Tile Properties             │
│ Type: WALL (4)              │
│ ☑ Blocks Movement           │
│ ☑ Blocks Vision             │
│ ☐ Destructible              │
│                             │
│ Tags: [structure, exterior] │
└─────────────────────────────┘
```

#### Layers System

```text
┌─────────────────────────────┐
│ Layers                      │
├─────────────────────────────┤
│ ☑ 👁️ Default         🔒      │
│ ☑ 👁️ Walls                  │
│ ☑ 👁️ Floors                 │
│ ☑ 👁️ Furniture              │
│ ☐ 👁️ Collision (hidden)     │
│ ☑ 👁️ Lights                 │
│ ☐ 👁️ Debug (hidden)         │
│                             │
│ [+ New Layer]               │
└─────────────────────────────┘
```

**Features:**

- Toggle visibility per layer
- Lock layers to prevent editing
- Color-coded in viewport
- Layer-based selection filter

### 4. Main Interface Layout

```text
╔═══════════════════════════════════════════════════════════════════╗
║ File  Edit  View  Generate  Tools  Window  Help          [_][□][X]║
╠═══════════════════════════════════════════════════════════════════╣
║ [Select] [Move] [Rotate] [Scale] | [Snap: 1.0] [Local▼] [Layers▼]║
╠══════════╦════════════════════════════════════════════╦═══════════╣
║          ║                                            ║           ║
║ Hierarchy║            3D Viewport                     ║ Inspector ║
║          ║                                            ║           ║
║ 🏢 Level ║   ┌──────────────────────────────────┐   ║ Transform ║
║  └─Floor1║   │                                  │   ║ Position  ║
║    ├─Walls║  │         [3D Scene]              │   ║ X: 0.0    ║
║    ├─Doors║  │                                  │   ║ Y: 0.0    ║
║    └─Lights║ │      📦 ← Selected Object       │   ║ Z: 0.0    ║
║          ║   │                                  │   ║           ║
║ [Filter] ║   └──────────────────────────────────┘   ║ Rotation  ║
║ [Search] ║                                            ║ [details] ║
║          ║   Orbit | Fly | Top                      ║           ║
║          ║   [X: 10] [Y: 5] [Z: 15]                 ║ Material  ║
╠══════════╩════════════════════════════════════════════╩═══════════╣
║ Generation Panel                                   Console Output ║
║ Algorithm: [BSP▼]  Theme: [Office▼]              ║ > Generated   ║
║ [Generate] [Refine] [Clear]                       ║   48x36 level ║
╚═══════════════════════════════════════════════════════════════════╝
```

### 5. Advanced Editor Features

#### Prefab System

**Create Prefabs:**

- Select objects
- Right-click → "Save as Prefab"
- Store in prefab library
- Drag into scene to instantiate

**Prefab Library:**

- Office Door (with frame)
- Window Unit (with glass)
- Desk Setup (desk + chair + lamp)
- Corridor Section (2x6 units)
- Room Template (furnished)
- Stairwell Unit (multi-floor)

**Prefab Updates:**

- Edit prefab instance
- Apply changes to prefab (updates all)
- Break prefab connection for unique edits

#### Material Editor

```text
┌─────────────────────────────┐
│ Material: Concrete_Gray     │
├─────────────────────────────┤
│ Base Color                  │
│ [🎨] #808080  [📁Load]      │
│                             │
│ Metallic    [0.0] ━━●━━━━  │
│ Roughness   [0.8] ━━━━●━━  │
│ Emissive    [0.0] ●━━━━━━  │
│                             │
│ Textures                    │
│ Albedo:    [📁 Load]        │
│ Normal:    [📁 Load]        │
│ Roughness: [📁 Load]        │
│ Metallic:  [📁 Load]        │
│                             │
│ Preview: [sphere render]    │
│                             │
│ [Apply] [Save As] [Reset]   │
└─────────────────────────────┘
```

#### Snap Points System

**Define Snap Points on objects:**

- Door frame edges
- Wall corners
- Floor tiles edges
- Window centers

**When dragging near snap point:**

- Visual indicator appears
- Object snaps automatically
- Maintains alignment

**Example: Door Prefab**

- Snap Points:
  - Bottom center (floor alignment)
  - Left/right edges (wall alignment)
  - Top center (ceiling alignment)

#### Measurement Tools

**Measure Tool (M key):**

- Click two points
- Shows distance in units
- Display in overlay
- Copy to clipboard

**Ruler Overlay:**

- Toggle with R key
- Shows grid measurements
- Customizable units (m, ft, units)
- Distance from origin

**Area Calculator:**

- Select floor tiles
- Shows total area
- Export measurements

### 6. Generation Integration

#### Hybrid Workflow

**Workflow 1: Generate → Edit**

1. Configure BSP parameters
2. Generate initial layout
3. Switch to 3D view
4. Select and modify elements
5. Add custom objects
6. Export final level

**Workflow 2: Manual → Auto-fill**

1. Create room boundaries manually
2. Select empty space
3. Auto-fill with theme objects
4. Procedural furniture placement
5. Automatic lighting
6. Export

**Workflow 3: Template-based**

1. Load prefab template room
2. Duplicate and arrange
3. Connect with corridors (auto-generated)
4. Polish manually
5. Export

#### Generation Controls (Docked Panel)

```text
┌─────────────────────────────────────┐
│ Procedural Generation               │
├─────────────────────────────────────┤
│ Algorithm                           │
│ ○ BSP  ○ WFC  ○ Manual              │
│                                     │
│ Target Area                         │
│ ○ Entire Scene                      │
│ ○ Selected Region                   │
│ ○ Empty Spaces Only                 │
│                                     │
│ Theme: [Office Building ▼]          │
│                                     │
│ Dimensions                          │
│ Width:  [48] Height: [36] Floors: 3│
│                                     │
│ BSP Parameters                      │
│ Split Iterations: [4]     ━━━━●━━  │
│ Min Room Size:    [6]     ━━━●━━━  │
│ Max Room Size:    [16]    ━━━━━●━  │
│ Corridor Width:   [2]     ━●━━━━━  │
│ Large Room %:     [40]    ━━━━●━━  │
│                                     │
│ Advanced                            │
│ ☑ Generate Furniture                │
│ ☑ Auto-place Lights                 │
│ ☑ Add Details (decorations)         │
│ ☐ Destructible Walls                │
│                                     │
│ Seed: [12345] [🎲 Random]          │
│                                     │
│ [Generate] [Refine] [Clear All]     │
│                                     │
│ Recent Seeds                        │
│ • 98765 (good layout)               │
│ • 54321 (open spaces)               │
│ • 11111 (compact)                   │
└─────────────────────────────────────┘
```

### 7. Export System

#### Multi-Format Export

```text
┌─────────────────────────────────────┐
│ Export Level                        │
├─────────────────────────────────────┤
│ Formats                             │
│ ☑ JSON (.json) - Universal          │
│ ☑ RON (.ron) - Bevy Native          │
│ ☑ Text (.txt) - ASCII Map           │
│ ☑ Rust Code (.rs) - Direct Import  │
│ ☐ GLTF (.gltf) - 3D Model           │
│ ☐ FBX (.fbx) - Generic 3D           │
│                                     │
│ Export Options                      │
│ Geometry                            │
│ ☑ Meshes                            │
│ ☑ Materials                         │
│ ☑ Textures (embed/reference)        │
│ ☐ Animations                        │
│                                     │
│ Game Data                           │
│ ☑ Collision Shapes                  │
│ ☑ Spawn Points                      │
│ ☑ Trigger Volumes                   │
│ ☑ Navigation Mesh                   │
│ ☐ AI Waypoints                      │
│                                     │
│ Optimization                        │
│ ☑ Merge Static Meshes               │
│ ☑ Generate LODs                     │
│ ☑ Compress Textures                 │
│ ☐ Bake Lighting                     │
│                                     │
│ Preview                             │
│ ☑ Generate Thumbnail (PNG)          │
│ ☑ Include Top-down Map              │
│ ☑ Bundle All Formats (.zip)         │
│                                     │
│ Export Path                         │
│ [assets/levels/office_01/] [📁]     │
│                                     │
│ [Export Selected] [Export All]      │
└─────────────────────────────────────┘
```

#### Export Format Details

**RON Format (Enhanced)**

```ron
// Morgan-Bevy Generated Level
// Theme: Office Building | Algorithm: BSP + Manual Edit
// Seed: 12345 | Edited: 2025-11-23

LevelData(
    metadata: Metadata(
        generator: "Morgan-Bevy",
        version: "1.0.0",
        algorithm: BSP,
        theme: OfficeBuilding,
        seed: Some(12345),
        manual_edits: true,
        edit_count: 47,
    ),
    
    dimensions: Dimensions(
        width: 48.0,
        height: 36.0,
        depth: 3,
        units: Meters,
    ),
    
    // Tile-based data (for top-down reference)
    tile_map: TileMap(
        floors: [ /* ... */ ],
    ),
    
    // Full 3D geometry (from editor)
    entities: [
        Entity(
            id: "wall_001",
            name: "Wall_North_Main",
            transform: Transform(
                position: Vec3(2.0, 0.0, 5.0),
                rotation: Quat::from_euler(0.0, 1.57, 0.0),
                scale: Vec3(1.0, 3.5, 0.2),
            ),
            mesh: MeshRef("models/wall_standard.gltf"),
            material: MaterialRef("materials/concrete_gray.ron"),
            tile_type: Some(WALL),
            collision: BoxCollider(
                half_extents: Vec3(1.0, 1.75, 0.1),
            ),
            layers: ["Walls", "Collision"],
            tags: ["structure", "exterior"],
        ),
        
        Entity(
            id: "door_001",
            name: "Door_Main_Entrance",
            transform: Transform(
                position: Vec3(5.0, 0.0, 2.0),
                rotation: Quat::IDENTITY,
                scale: Vec3::ONE,
            ),
            prefab: PrefabRef("prefabs/door_standard.ron"),
            material: MaterialRef("materials/wood_oak.ron"),
            tile_type: Some(ENTRANCE),
            components: [
                Door(
                    is_open: false,
                    open_angle: 90.0,
                    open_duration: 1.0,
                ),
                Interactable(
                    prompt: "Open Door",
                    key: KeyCode::E,
                ),
            ],
            layers: ["Doors", "Interactable"],
            tags: ["entrance", "interactive"],
        ),
        
        // ... more entities
    ],
    
    // Lighting
    lights: [
        Light(
            id: "light_main",
            light_type: Directional(
                direction: Vec3(-0.5, -1.0, -0.5),
                illuminance: 10000.0,
                shadows: true,
            ),
        ),
        Light(
            id: "light_ambient",
            light_type: Ambient(
                color: Color::WHITE,
                brightness: 400.0,
            ),
        ),
    ],
    
    // Spawn points
    spawn_points: [
        SpawnPoint(
            position: Vec3(5.0, 1.0, 5.0),
            rotation: Quat::IDENTITY,
            spawn_type: PlayerStart,
        ),
    ],
    
    // Navigation mesh
    navmesh: Some(NavMesh(
        vertices: [ /* ... */ ],
        triangles: [ /* ... */ ],
    )),
)
```

**Rust Code Export (Enhanced)**

```rust
// Generated by Morgan-Bevy v1.0.0
// Theme: Office Building | BSP + Manual Edit
// Seed: 12345 | 47 manual edits

use bevy::prelude::*;

pub struct OfficeLevel {
    pub dimensions: Vec3,
    pub entities: Vec<LevelEntity>,
    pub lights: Vec<LevelLight>,
    pub spawn_points: Vec<SpawnPoint>,
}

#[derive(Clone)]
pub struct LevelEntity {
    pub name: String,
    pub transform: Transform,
    pub mesh_path: String,
    pub material_path: String,
    pub tile_type: Option<u32>,
    pub collision: CollisionShape,
    pub components: Vec<ComponentType>,
}

#[derive(Clone)]
pub enum CollisionShape {
    Box { half_extents: Vec3 },
    Sphere { radius: f32 },
    Capsule { radius: f32, height: f32 },
}

#[derive(Clone)]
pub enum ComponentType {
    Door { open_angle: f32 },
    Interactable { prompt: String },
    Collectible { item_type: String },
}

impl OfficeLevel {
    pub fn load() -> Self {
        Self {
            dimensions: Vec3::new(48.0, 36.0, 3.0),
            entities: vec![
                LevelEntity {
                    name: "Wall_North_Main".to_string(),
                    transform: Transform::from_xyz(2.0, 0.0, 5.0)
                        .with_rotation(Quat::from_rotation_y(1.57)),
                    mesh_path: "models/wall_standard.gltf".to_string(),
                    material_path: "materials/concrete_gray.ron".to_string(),
                    tile_type: Some(4), // WALL
                    collision: CollisionShape::Box {
                        half_extents: Vec3::new(1.0, 1.75, 0.1),
                    },
                    components: vec![],
                },
                // ... more entities
            ],
            lights: vec![],
            spawn_points: vec![],
        }
    }
}

// Spawn system for Bevy
pub fn spawn_level(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
) {
    let level = OfficeLevel::load();
    
    for entity in level.entities {
        let mut entity_commands = commands.spawn((
            SceneBundle {
                scene: asset_server.load(&entity.mesh_path),
                transform: entity.transform,
                ..default()
            },
            Name::new(entity.name.clone()),
        ));
        
        // Add collision
        match entity.collision {
            CollisionShape::Box { half_extents } => {
                entity_commands.insert(Collider::cuboid(
                    half_extents.x,
                    half_extents.y,
                    half_extents.z,
                ));
            },
            _ => {}
        }
        
        // Add components
        for component in entity.components {
            match component {
                ComponentType::Door { open_angle } => {
                    entity_commands.insert(DoorComponent {
                        is_open: false,
                        open_angle,
                        current_angle: 0.0,
                    });
                },
                _ => {}
            }
        }
    }
}
```

### 8. Keyboard Shortcuts

**File Operations:**

- `Ctrl+N` - New Level
- `Ctrl+O` - Open Level
- `Ctrl+S` - Save
- `Ctrl+Shift+S` - Save As
- `Ctrl+E` - Export

**Edit Operations:**

- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo
- `Ctrl+C` - Copy
- `Ctrl+V` - Paste
- `Ctrl+X` - Cut
- `Ctrl+D` - Duplicate
- `Delete` - Delete Selected
- `Ctrl+A` - Select All

**Transform:**

- `W` - Translate Mode
- `E` - Rotate Mode
- `R` - Scale Mode
- `T` - Toggle Local/World Space
- `F` - Frame Selected
- `Alt+F` - Frame All

**View:**

- `1-9` - Switch Camera Presets
- `Numpad 1` - Front View
- `Numpad 3` - Right View
- `Numpad 7` - Top View
- `Numpad 0` - Camera View
- `Alt+LMB` - Orbit
- `Alt+MMB` - Pan
- `Alt+RMB` - Zoom

**Grid/Snap:**

- `Ctrl (hold)` - Enable Snapping
- `G` - Toggle Grid
- `X/Y/Z` - Lock to Axis
- `Shift+S` - Snap Menu

**Generation:**

- `Ctrl+G` - Generate
- `Ctrl+R` - Regenerate
- `Ctrl+Shift+G` - Generation Settings

**Display:**

- `Z` - Shading Mode
- `Alt+Z` - X-Ray Mode
- `H` - Hide Selected
- `Shift+H` - Unhide All
- `Ctrl+H` - Hide Unselected

**Tools:**

- `Q` - Select Tool
- `M` - Measure Tool
- `P` - Paint Tool
- `B` - Box Select
- `C` - Circle Select

## 🔧 Implementation Phases

### Phase 1: Core 3D Editor (Week 1-3)

- [ ] Set up Tauri + React + Three.js
- [ ] Implement basic 3D viewport
- [ ] Create camera controls (orbit, fly, top-down)
- [ ] Implement raycasting for object selection
- [ ] Add transform gizmos (move, rotate, scale)
- [ ] Implement grid snapping
- [ ] Basic hierarchy panel

### Phase 2: Selection & Manipulation (Week 3-4)

- [ ] Multi-selection with box select
- [ ] Selection outlines and highlighting
- [ ] Copy/paste/duplicate functionality
- [ ] Undo/redo system
- [ ] Object grouping/parenting
- [ ] Transform constraints (axis locking)

### Phase 3: Scene Management (Week 4-5)

- [ ] Inspector panel with properties
- [ ] Layer system
- [ ] Material editor
- [ ] Prefab system
- [ ] Asset browser
- [ ] Save/load project files

### Phase 4: Procedural Generation (Week 5-6)

- [ ] Implement BSP algorithm
- [ ] Create generation panel UI
- [ ] Theme system
- [ ] Integration with 3D editor
- [ ] Generation to editable objects
- [ ] Seed management

### Phase 5: Export System (Week 6-7)

- [ ] JSON export
- [ ] RON export with full scene data
- [ ] Rust code generation
- [ ] GLTF export
- [ ] Collision mesh generation
- [ ] Preview image generation

### Phase 6: Advanced Features (Week 7-8)

- [ ] Snap points system
- [ ] Surface snapping
- [ ] Measurement tools
- [ ] Paint/texture tools
- [ ] Lighting tools
- [ ] Navigation mesh generation

### Phase 7: Polish & Optimization (Week 8-9)

- [ ] Performance optimization
- [ ] Keyboard shortcuts
- [ ] Tutorial system
- [ ] Example levels
- [ ] Documentation
- [ ] Video tutorials

### Phase 8: Distribution (Week 9-10)

- [ ] Build pipeline
- [ ] Auto-updater
- [ ] Crash reporting
- [ ] Analytics (optional)
- [ ] Package for distribution
- [ ] Create marketing materials

## 📊 Success Metrics

**Performance Targets:**

- Editor runs at 60 FPS with 10,000+ objects
- Selection response < 16ms
- Undo/redo < 10ms
- Generation < 200ms for 48x36x3 level
- Export < 2 seconds

**Usability Goals:**

- New user creates edited level in < 10 minutes
- Transform operations feel native (like Unity/Blender)
- No learning curve for users familiar with 3D editors
- One-click export to Bevy

**Quality Standards:**

- Zero data loss on save/load
- Exports import into Bevy without errors
- No editor crashes during normal use
- Professional-grade output quality

## 🎨 Design Principles

1. **Familiar UX** - Keyboard shortcuts and workflows match industry standards (Unity, Blender, Unreal)
2. **Non-Destructive** - Always preserve original generation data
3. **Real-time** - All operations update viewport immediately
4. **Professional Output** - Generated files are production-ready
5. **Extensible** - Plugin system for custom tools and generators

## 🚀 Future Enhancements (Post-MVP)

**Editor Features:**

- Terrain editing tools
- Vertex editing mode
- UV unwrapping
- Animation timeline
- Visual scripting (node-based logic)
- Multiplayer preview mode

**Generation Features:**

- WFC algorithm
- Custom algorithm plugins
- AI-assisted generation
- Style transfer from images
- Procedural texturing
- Automated furniture placement

**Collaboration:**

- Cloud project sync
- Multi-user editing
- Asset marketplace
- Community template library
- Version control integration

**Advanced Export:**

- Unreal Engine format
- Unity format
- Godot format
- Custom game engine formats

## 📚 Technical References

**3D Editors:**

- [Three.js Editor](https://threejs.org/editor/)
- [Babylon.js Editor](https://doc.babylonjs.com/editor)
- [Blender API](https://docs.blender.org/api/current/)

**Transform Controls:**

- [Three.js TransformControls](https://threejs.org/docs/#examples/en/controls/TransformControls)
- [GIZMO.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/TransformControls.js)

**Raycasting:**

- [Three.js Raycasting](https://threejs.org/docs/#api/en/core/Raycaster)
- [Selection in 3D](https://www.redblobgames.com/articles/visibility/)

## 🎯 MVP Feature Set

For initial release:

**Must Have:**

- ✅ 3D viewport with orbit camera
- ✅ Object selection (single & multi)
- ✅ Transform gizmos (move, rotate, scale)
- ✅ Grid snapping
- ✅ Hierarchy panel
- ✅ Basic inspector
- ✅ BSP generation
- ✅ JSON + RON export

**Should Have:**

- 🔄 Undo/redo
- 🔄 Copy/paste/duplicate
- 🔄 Layer system
- 🔄 Material editor
- 🔄 Prefab system
- 🔄 Multiple camera modes
- 🔄 ASCII text export

**Nice to Have:**

- ⏳ WFC algorithm
- ⏳ Snap points
- ⏳ Measurement tools
- ⏳ GLTF export
- ⏳ Navigation mesh
- ⏳ Tutorial system

## 📝 Development Stack

```text
Morgan-Bevy/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── generation/     # BSP, WFC algorithms
│   │   ├── export/         # Format converters
│   │   └── spatial/        # Spatial queries
│   └── Cargo.toml
│
├── src/                    # React frontend
│   ├── components/
│   │   ├── Viewport3D/     # Three.js integration
│   │   ├── Hierarchy/
│   │   ├── Inspector/
│   │   ├── Generation/
│   │   └── Export/
│   ├── hooks/
│   │   ├── useSelection.ts
│   │   ├── useTransform.ts
│   │   └── useUndo.ts
│   ├── store/
│   │   └── editorStore.ts  # Zustand store
│   └── App.tsx
│
├── assets/
│   ├── models/             # Built-in meshes
│   ├── materials/          # Material presets
│   └── themes/             # Generation themes
│
└── examples/
    └── generated_levels/   # Example exports
```

**Key Dependencies:**

- `tauri` - Desktop app framework
- `three` / `@react-three/fiber` - 3D rendering
- `@react-three/drei` - Three.js helpers
- `zustand` - State management
- `immer` - Immutable updates
- `serde` - Rust serialization
- `rand` - Random generation

## 🎬 Getting Started

Once development begins:

```bash
# Install dependencies
npm install
cd src-tauri && cargo build

# Run in development
npm run tauri dev

# Open example project
# File → Open → examples/office_building.funky

# Generate your first level
# 1. Click "Generate" in Generation Panel
# 2. Select objects in 3D view
# 3. Move with W key + drag
# 4. Export with Ctrl+E
```

## 📖 Example Usage Scenarios

### Scenario 1: Quick Procedural Level

```text
1. Launch Morgan-Bevy
2. Generate → Algorithm: BSP, Theme: Office Building
3. Click "Generate" (takes ~100ms)
4. Review 3D preview
5. Adjust a few walls manually
6. Export → RON format
7. Drop into Bevy game project
Total time: 3 minutes
```

### Scenario 2: Detailed Custom Level

```text
1. Generate base layout with BSP
2. Select walls, adjust positions with snap
3. Add custom prefabs (furniture, decorations)
4. Create special rooms manually
5. Place spawn points and triggers
6. Configure lighting
7. Export with full game data
Total time: 30-60 minutes
```

### Scenario 3: Template Reuse

```text
1. Load existing level template
2. Duplicate room sections
3. Rearrange with grid snapping
4. Auto-connect with corridor generation
5. Apply different material theme
6. Export variations
Total time: 10 minutes per variation
```

---

**Project Goal**: Create the **definitive 3D level editor for Bevy** that combines the power of procedural generation with professional manual editing tools. "Generate smart, edit fast, ship perfect."
