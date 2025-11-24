# Morgan-Bevy AI Coding Instructions

## Project Overview
Morgan-Bevy is a hybrid Rust/TypeScript 3D level editor for Bevy game development that combines procedural generation (BSP, WFC) with professional manual editing capabilities. Think "Unity Editor meets Procedural Generation."

## Architecture & Tech Stack

### Frontend (3D Editor Interface)
- **Tauri + React + TypeScript** - Desktop application framework
- **Three.js + React Three Fiber** - 3D rendering and manipulation
- **Zustand** - State management (avoid Redux patterns)
- **Tailwind CSS** - Styling (component-based approach)

### Backend (Generation & Export Engine)
- **Rust** - Core algorithms (BSP, WFC, spatial queries)
- **Serde** - Serialization for all data formats
- **Tauri APIs** - File system access and native integration

### Key Directory Structure
```
src-tauri/src/
├── generation/     # BSP & WFC procedural algorithms
├── export/         # Multi-format exporters (JSON, RON, Rust code)
└── spatial/        # 3D spatial queries and collision

src/components/
├── Viewport3D/     # Three.js integration & 3D interaction
├── Hierarchy/      # Scene tree management
├── Inspector/      # Property editing panels
├── Generation/     # Procedural generation controls
└── Export/         # Export format options
```

## Critical Patterns & Conventions

### 3D Editor Interaction Model
- **Transform gizmos** use Three.js TransformControls for move/rotate/scale
- **Multi-selection** with box select and Ctrl+click additive selection
- **Grid snapping** with configurable increments (0.1, 0.5, 1.0, 2.0 units)
- **Raycasting** for object picking - all 3D interactions go through centralized selection system

### State Management (Zustand Store)
```typescript
// Core editor state pattern
interface EditorStore {
  selectedObjects: string[];
  transformMode: 'translate' | 'rotate' | 'scale';
  gridSnapEnabled: boolean;
  activeLayer: string;
  // Use immer for nested updates
}
```

### Procedural Generation Integration
- **BSP Algorithm** - Recursive room subdivision with L-shaped corridors
- **Theme System** - Office, Dungeon, Castle, SciFi with tile-based rulesets
- **Generation to 3D** - Convert tile maps to editable 3D entities with full transform data
- **Seed Management** - Always preserve generation seeds for reproducibility

### Export System Philosophy
- **Multi-format simultaneously** - JSON (universal), RON (Bevy native), Rust code (direct import)
- **Non-destructive metadata** - Preserve original generation data + manual edits
- **Production-ready output** - Include collision, spawn points, navigation mesh

### Performance Requirements
- **60 FPS** with 10,000+ objects in viewport
- **Selection response < 16ms** - optimize raycasting and highlighting
- **Generation < 200ms** for 48x36x3 level
- **Undo/redo < 10ms** - use command pattern with efficient diffs

## Development Workflows

### Tauri Development
```bash
# Standard development cycle
npm run tauri dev           # Hot reload frontend + Rust backend
cargo test --manifest-path src-tauri/Cargo.toml  # Backend tests
npm test                   # Frontend tests
```

### 3D Scene Debugging
- Use Three.js scene graph inspector in dev tools
- Enable wireframe mode for mesh debugging
- Grid overlay always visible during development

### Export Testing
```bash
# Validate exports against Bevy
cd examples/test_import && cargo run  # Test generated levels load correctly
```

## Key Integration Points

### Tauri Commands (Rust ↔ TypeScript)
```rust
// Pattern: All generation and file I/O through Tauri commands
#[tauri::command]
fn generate_bsp_level(params: BSPParams) -> Result<LevelData, String>

#[tauri::command]  
fn export_level(data: LevelData, formats: Vec<ExportFormat>) -> Result<(), String>
```

### Three.js ↔ React Integration
- Use `useThree` hook for direct Three.js access
- Custom hooks: `useSelection`, `useTransform`, `useUndo`
- Event system for 3D interactions bubbling to React state

### Bevy Integration (Export Targets)
- RON format matches Bevy's native serialization
- Generated Rust code provides direct spawn systems
- Collision shapes use Rapier3D-compatible formats

## Project-Specific Conventions

### Entity Naming
- Hierarchical IDs: `wall_001`, `door_main_entrance`  
- Layer-based organization: `Walls`, `Floors`, `Furniture`, `Collision`
- Prefab references: `prefabs/door_standard.ron`

### Material System
- PBR materials with metallic/roughness workflow
- Texture references, not embedded data
- Theme-based material libraries

### Transform Constraints
- Grid units in meters (not arbitrary units)
- Y-up coordinate system (Three.js standard)
- Local vs world space toggle for transform operations

## MVP Implementation Priority
1. **3D Viewport** - Camera controls, raycasting, basic selection
2. **Transform System** - Gizmos, grid snapping, multi-object transforms  
3. **Scene Management** - Hierarchy, inspector, undo/redo
4. **BSP Generation** - Core algorithm + UI integration
5. **Export System** - JSON/RON formats with metadata preservation

## Critical Files to Reference
- `INITIAL_PROMPT.md` - Complete feature specifications and UI mockups
- Focus on Phase 1-3 implementations for core editor functionality
- Export format examples show expected data structures