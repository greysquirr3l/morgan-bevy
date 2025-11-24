# Morgan-Bevy Implementation TODO

> **Core Philosophy**: "Generate smart, edit fast, export perfect."

A comprehensive 3D level editor for Bevy that combines procedural generation (BSP, WFC) with professional manual editing capabilities.

## 📋 Project Overview

- **Frontend**: Tauri + React + Three.js + TypeScript
- **Backend**: Rust (BSP/WFC algorithms, export system)
- **Target**: 60 FPS with 10K+ objects, <16ms selection response
- **MVP Goal**: Professional 3D editor with BSP generation and multi-format export

### 🎉 Current Status (Nov 24, 2025)

**✅ TAURI APPLICATION RUNNING SUCCESSFULLY!**

**Completed Features:**

- ✅ Full Tauri + React + Three.js development environment
- ✅ Interactive 3D viewport with orbit camera controls and lighting
- ✅ Complete object selection system with click and Ctrl+multi-select
- ✅ **Transform Gizmos** - Full Three.js TransformControls integration for move/rotate/scale
- ✅ **Assets Panel** - Drag-and-drop asset management with local and external folder browsing
- ✅ **Professional Resizable UI** - Dynamic panel system with refined 1px resize handles and fixed layout constraints
- ✅ **Camera Controls** - Reset view and focus selection with Three.js integration
- ✅ **Refined UI/UX** - Eliminated duplicate headers, improved resize functionality, and enhanced visual design
- ✅ Professional dark-themed UI layout (hierarchy, viewport, inspector, assets)
- ✅ Complete keyboard shortcuts (W/E/R transform modes, G grid toggle, Delete, Esc, Ctrl+D duplicate, Ctrl+Z/Y undo/redo, Ctrl+C/V copy/paste)
- ✅ Zustand state management with full transform and selection tracking
- ✅ Rust backend with file system access and asset scanning capabilities
- ✅ Demo scene with selectable and transformable objects (cube, sphere, pyramid)
- ✅ Grid system with snapping and visual overlay
- ✅ **Clean Build Pipeline** - All TypeScript errors resolved with production-ready compilation
- ✅ **Code Quality** - Removed unused imports and resolved deprecation warnings
- ✅ **Updated Dependencies** - All npm packages updated to newer versions with compatibility fixes
- ✅ **TypeScript Compilation** - All type errors resolved with successful production build
- ✅ **Box Selection** - Full box selection with drag rectangles and frustum-based selection
- ✅ **Undo/Redo System** - Complete command pattern with Ctrl+Z/Y keyboard shortcuts
- ✅ **Copy/Paste Operations** - Full clipboard integration with Ctrl+C/V support
- ✅ **Transform Constraints** - X/Y/Z axis locking during transforms with visual indicators
- ✅ **Object Grouping** - Full grouping/ungrouping with Ctrl+G/Ctrl+Shift+G support
- ✅ **2D Grid View** - Complete 2D level editing with ASCII-style tiles and theme integration
- ✅ **BSP & WFC Algorithms** - Full procedural generation system with comprehensive theme support
- ✅ **Panel Management** - Collapsible and resizable panels with improved UX and visual design
- ✅ **Generation Panel Debug** - Fixed object creation logic with comprehensive debugging infrastructure

**Current Capabilities:** Professional 3D editor with comprehensive object manipulation, asset management, scene editing, layer system, save/load functionality, material editor, prefab system, 2D grid view for level design, complete BSP/WFC procedural generation with debugging infrastructure, and refined resizable UI with clean build pipeline

**Major Milestones Achieved:**

- 🎯 **Phase 1 Complete** - Core 3D editor foundation with working transform gizmos
- 📁 **Asset Pipeline** - Drag-and-drop asset integration with file system browsing  
- 🎮 **Interactive Scene** - Real-time object manipulation with visual feedback
- ⌨️ **Professional UX** - Complete keyboard shortcuts and refined UI workflow
- ✅ **Phase 2 Complete** - Advanced selection, undo/redo, copy/paste, and transform systems
- 🎉 **Phase 3 Complete** - Save/load system, layer management, material editor, and prefab system
- 🌱 **Phase 4 Complete** - BSP/WFC procedural generation with 2D grid editing and theme system
- 🎨 **UI/UX Polish Complete** - Refined resize handles, fixed duplicate headers, improved panel management
- 🔧 **Code Quality Complete** - Clean builds, resolved TypeScript errors, removed unused code

**Next Priority:** Advanced export system implementation (Phase 5)

**Recent Fixes (Nov 24, 2025):**

- Fixed TypeScript baseUrl deprecation warning
- Cleaned up unused imports in GenerationPanel
- Enhanced procedural generation debugging
- Resolved all compilation errors

---

## 🚀 Phase 1: Core 3D Editor Foundation (Week 1-3)

### Project Setup

- [x] Initialize Tauri + React + TypeScript project
  - [x] Configure `package.json` with required dependencies
  - [x] Update dependencies to newer versions (Nov 24, 2025)
  - [x] Configure Tauri permissions and file system access
- [x] Set up development environment
  - [x] Configure hot reload for frontend/backend
  - [x] Resolve all TypeScript compilation errors and type issues
  - [ ] Configure linting (ESLint, Clippy)
  - [ ] Configure linting (ESLint, Clippy)

### 3D Viewport Foundation

- [x] Install and configure Three.js + React Three Fiber
  - [x] Add dependencies: `three`, `@react-three/fiber`, `@react-three/drei`
  - [x] Create basic `Viewport3D` component with canvas setup
  - [x] Configure renderer settings (antialias, shadows, tone mapping)
- [x] Implement camera system
  - [x] **Orbit Camera** (default) - Middle mouse pan, right mouse rotate, scroll zoom
  - [ ] **Fly Camera** (F key toggle) - WASD movement, mouse look
  - [ ] **Top-down Camera** (T key) - Orthographic projection for precision
  - [ ] Frame selected objects (F key) and frame all (Alt+F)

### Object Selection System

- [x] Implement raycasting for mouse picking
  - [x] Set up `useThree` hook for raycaster access
  - [x] Handle click events in 3D space
  - [x] Visual feedback for hover states
- [x] Single and multi-selection
  - [x] Left click: Select single object
  - [x] Ctrl+Click: Add to selection
  - [ ] Click+Drag: Box selection (2D screen space)
  - [x] Selection highlighting with outlines/wireframes

### Transform Gizmos

- [x] Integrate Three.js `TransformControls`
  - [x] W key: Translate mode with full 3D manipulation
  - [x] E key: Rotate mode with full 3D manipulation
  - [x] R key: Scale mode with full 3D manipulation
  - [x] Real-time transform updates to store and scene
  - [x] Visual gizmo rendering and interaction
  - [ ] T key: Toggle local/world space
- [x] Grid snapping system
  - [x] Hold Ctrl for snap activation
  - [x] Configurable increments: 0.1, 0.5, 1.0, 2.0 units
  - [ ] Rotation snapping: 5°, 15°, 45°, 90°
  - [x] Visual grid overlay

### Assets Panel

- [x] Create collapsible `AssetsPanel` component
  - [x] Local Assets folder scanning and display
  - [x] External folder browsing with native file dialogs
  - [x] Asset type detection (model, texture, material, audio)
  - [x] Grid layout with file icons and names
- [x] Drag and drop integration
  - [x] Drag assets from panel to 3D viewport
  - [x] Visual drop indicators and feedback
  - [x] Automatic object creation based on asset type
  - [x] Position calculation from drop coordinates
- [x] File system integration
  - [x] Rust backend commands for file scanning
  - [x] Asset metadata extraction (size, modified date)
  - [x] Error handling with fallback mock data

### Basic Hierarchy Panel

- [x] Create `Hierarchy` component with tree view
  - [x] Display scene objects in hierarchical structure
  - [x] Show object names and types
  - [x] Selection synchronization with 3D viewport
  - [ ] Drag and drop for reparenting
  - [ ] Right-click context menu (duplicate, delete, rename)
  - [ ] Visibility toggles (👁️) and lock states (🔒)

### Scene Management Foundation

- [x] Object creation and management system
  - [x] Primitive shape creation (cube, sphere, pyramid)
  - [x] Unique ID generation and naming
  - [x] Transform data storage (position, rotation, scale)
  - [x] Layer assignment and organization
- [x] Real-time scene rendering
  - [x] Three.js mesh creation from store objects
  - [x] Material assignment with selection highlighting
  - [x] Visibility and interaction states
  - [x] Demo objects for immediate testing
- [x] Store synchronization
  - [x] Transform changes update both store and scene
  - [x] Selection state management
  - [x] Object lifecycle (create, update, delete)

---

## 🎯 Phase 2: Selection & Manipulation (Week 3-4)

### Advanced Selection

- [x] Box selection implementation
  - [x] Visual selection rectangle on mouse drag
  - [x] Frustum-based object culling
  - [x] Additive selection with Ctrl modifier
- [x] Selection management
  - [x] ESC: Clear selection
  - [x] Delete/Backspace: Remove selected objects
  - [x] Multi-object selection with Ctrl+Click
  - [ ] Ctrl+A: Select all
  - [ ] H: Hide selected, Shift+H: Unhide all
  - [x] Selection persistence across operations

### Copy/Paste/Duplicate System

- [x] Object duplication
  - [x] Ctrl+D: Duplicate selected objects with offset
  - [x] Unique ID generation for duplicated objects
  - [x] Transform offset to avoid overlap
  - [ ] Alt+Drag: Duplicate while moving
  - [ ] Maintain hierarchy relationships
- [x] Clipboard operations
  - [x] Ctrl+C/V: Copy and paste with transform data
  - [x] Cross-session clipboard (serialize to temp file)
  - [x] Paste at cursor position or original location

### Undo/Redo System

- [x] Command pattern implementation
  - [x] Abstract `Command` interface for all operations
  - [x] Commands: Move, Rotate, Scale, Duplicate, Delete
  - [x] Efficient diff-based storage for large scenes
- [x] Undo stack management
  - [x] Ctrl+Z: Undo, Ctrl+Y: Redo
  - [x] Configurable history limit (default 50 operations)
  - [x] Memory-efficient storage for transform data

### Transform Constraints

- [x] Axis locking during transforms
  - [x] X/Y/Z keys during transform to lock to axis
  - [x] Visual indicators for active constraints
  - [x] Plane constraints (XY, XZ, YZ)
- [x] Object grouping and parenting
  - [x] Group selected objects (Ctrl+G)
  - [x] Ungroup (Ctrl+Shift+G)
  - [x] Parent-child transform inheritance

---

## 🏗️ Phase 3: Scene Management (Week 4-5)

### Inspector Panel

- [x] Create `Inspector` component for object properties
  - [x] Basic inspector panel layout and structure
  - [x] Integration with editor state and selection
  - [x] Transform controls (position, rotation, scale inputs)
  - [x] Multi-object editing with mixed value indicators
  - [x] Undoable transform operations using command system
  - [ ] Mesh and material references
  - [ ] Tile properties (type, collision, tags)
- [ ] Property validation and constraints
  - [ ] Numeric input validation
  - [ ] Transform limits and warnings
  - [ ] Real-time updates to 3D viewport

### Layer System

- [x] Implement `Layers` component
  - [x] Layer creation, deletion, renaming
  - [x] Object assignment to layers
  - [x] Layer visibility toggles with 3D viewport integration
  - [x] Layer-based selection filtering
  - [x] Color coding in viewport

### Material Editor

- [x] Basic material editing interface
  - [x] PBR properties: base color, metallic, roughness
  - [x] Texture loading and preview
  - [x] Material presets and library
  - [x] Real-time preview sphere
- [ ] Material assignment and management
  - [ ] Drag-and-drop material application
  - [ ] Multi-object material changes
  - [ ] Material instance creation

### Prefab System Foundation

- [x] Prefab creation and storage
  - [x] Select objects → "Save as Prefab" functionality
  - [x] Serialize hierarchy with transform data
  - [x] Store in localStorage with export capabilities
- [x] Prefab instantiation
  - [x] Click to add prefab instances to scene
  - [x] Automatic positioning and command system integration
  - [x] Prefab library management (create, delete, export)

### Save/Load System

- [x] Project file format design
  - [x] JSON-based scene serialization
  - [x] Include generation metadata and manual edits
  - [x] Asset reference management
- [x] File operations
  - [x] Ctrl+N: New project
  - [x] Ctrl+O: Open project
  - [x] Ctrl+S: Save, Ctrl+Shift+S: Save As
  - [x] Functional File Menu with save/load/export
  - [x] Auto-save functionality with localStorage backup

---

## 🌱 Phase 4: Procedural Generation (Week 5-6) ✅ COMPLETE

### BSP Algorithm Implementation

- [x] Core BSP algorithm in Rust (`src-tauri/src/generation/bsp.rs`)
  - [x] Recursive room subdivision
  - [x] L-shaped corridor generation  
  - [x] Configurable parameters (split iterations, room sizes)
  - [x] Large room probability system
- [x] Tauri command interface
  - [x] `#[tauri::command] generate_bsp_level(params: BSPParams)`
  - [x] Error handling and progress reporting
  - [x] Seed-based reproducible generation

### Generation Panel UI

- [x] Create `Generation` component
  - [x] Algorithm selection: BSP, WFC
  - [x] Comprehensive parameter controls with real-time validation
  - [x] BSP parameter controls with input fields and constraints
  - [x] Seed management (input, random, recent seeds)
- [x] Real-time parameter preview
  - [x] Generation status and object count display
  - [x] Generation progress indicator with loading states
  - [x] Error handling with user-friendly messages

### Theme System

- [x] Theme data structure and storage
  - [x] Office Building theme (cubicles, conference rooms)
  - [x] Fantasy Dungeon theme (chambers, passages)  
  - [x] Sci-Fi Facility theme (labs, airlocks)
  - [x] Castle theme (stone walls, wooden elements)
  - [x] Tile-to-3D mapping rules with ASCII representation
- [x] Theme application
  - [x] Material assignment per theme
  - [x] Complete tile definition system with constraints
  - [x] WFC constraint propagation for theme consistency

### 2D Grid View for Level Design

- [x] Create 2D Grid View Component
  - [x] Grid-based level representation with ASCII-style tiles
  - [x] Theme-aware tile rendering with proper symbols
  - [x] Interactive grid view with click navigation
  - [x] Viewport toggle between 3D and 2D views
- [x] 2D Grid Editing Tools
  - [x] Click-to-place tiles with brush selection
  - [x] Paint mode for quick area filling and tile placement
  - [x] Copy/paste operations with rectangular selection
  - [x] Select mode for multi-tile operations
  - [x] Fill mode for area completion
- [x] 2D-3D Synchronization
  - [x] Real-time sync between 2D grid and 3D viewport
  - [x] Grid changes automatically update 3D objects
  - [x] Theme integration with consistent visual representation
  - [x] Grid state management and persistence

### Generation to 3D Editor Integration

- [x] Convert tile data to 3D objects
  - [x] Tile-to-mesh mapping system
  - [x] Transform calculation from tile positions
  - [x] Hierarchy creation (Generated layer assignment)
- [x] Editable generated content
  - [x] Generated objects become fully editable
  - [x] Integration with existing selection and transform systems
  - [x] Hybrid manual + procedural workflow

### Seed Management

- [x] Seed storage and retrieval
  - [x] Recent seeds list with descriptions
  - [x] Seed persistence across sessions
  - [x] One-click seed loading with parameter restoration

---

## 📦 Phase 5: Export System (Week 6-7)

### Multi-Format Export Architecture

- [ ] Export system design (`src-tauri/src/export/`)
  - [ ] Trait-based format implementation
  - [ ] Parallel export processing
  - [ ] Progress reporting to UI
- [ ] Export UI component
  - [ ] Format selection checkboxes
  - [ ] Export options configuration
  - [ ] Preview and validation

### JSON Export Format

- [ ] Universal JSON exporter
  - [ ] Complete scene hierarchy
  - [ ] Transform data, materials, metadata
  - [ ] Asset reference management
  - [ ] Human-readable formatting

### RON Export (Bevy Native)

- [ ] RON format implementation
  - [ ] Bevy-compatible data structures
  - [ ] Component serialization
  - [ ] Collision shape export
  - [ ] Navigation mesh data

### Rust Code Generation

- [ ] Direct import code generator
  - [ ] Spawn system generation
  - [ ] Level struct definitions  
  - [ ] Component setup code
  - [ ] Asset loading integration

### GLTF 3D Model Export

- [ ] GLTF exporter implementation
  - [ ] Mesh combining and optimization
  - [ ] Material embedding or referencing
  - [ ] Animation data (if applicable)

### Collision and Game Data

- [ ] Collision shape generation
  - [ ] Box, sphere, capsule colliders
  - [ ] Mesh collider creation
  - [ ] Rapier3D compatibility
- [ ] Spawn points and triggers
  - [ ] Player spawn point export
  - [ ] Trigger volume definitions
  - [ ] Interactive object data

### Preview Generation

- [ ] Thumbnail and preview images
  - [ ] Top-down map generation
  - [ ] 3D viewport screenshots
  - [ ] Minimap creation for game integration

---

## ⚡ Phase 6: Advanced Features (Week 7-8)

### Snap Points System

- [ ] Define snap points on objects
  - [ ] Door frame edges, wall corners, floor edges
  - [ ] Visual indicators during drag operations
  - [ ] Automatic alignment and snapping
- [ ] Snap point editor
  - [ ] Add/remove snap points on prefabs
  - [ ] Preview snap zones during placement
  - [ ] Snap point categories (structural, decorative)

### Surface Snapping

- [ ] Advanced snapping mechanics
  - [ ] Shift+Ctrl: Snap to surface with normal alignment
  - [ ] Raycast-based surface detection
  - [ ] Maintain object orientation during snaps

### Measurement Tools

- [ ] Measurement tool implementation
  - [ ] M key: Activate measure tool
  - [ ] Click two points for distance
  - [ ] Unit conversion (meters, feet, grid units)
- [ ] Area calculation
  - [ ] Select floor tiles for area calculation
  - [ ] Export measurements to clipboard
  - [ ] Ruler overlay toggle (R key)

### Paint/Texture Tools

- [ ] Material painting system
  - [ ] P key: Activate paint tool
  - [ ] Brush-based material application
  - [ ] Material palette and selection
- [ ] Texture coordinate editing
  - [ ] UV preview and editing
  - [ ] Texture tiling and offset controls

### Lighting Tools

- [ ] Advanced lighting setup
  - [ ] Light placement and configuration
  - [ ] Shadow quality settings
  - [ ] Baked lighting options
- [ ] Automatic lighting
  - [ ] Theme-based light placement
  - [ ] Ambient lighting calculation
  - [ ] Performance optimization

### Navigation Mesh Generation

- [ ] NavMesh generation system
  - [ ] Walkable surface detection
  - [ ] Obstacle avoidance mesh
  - [ ] Export for Bevy navigation
- [ ] AI waypoint system
  - [ ] Manual waypoint placement
  - [ ] Automatic path generation
  - [ ] Patrol route creation

---

## 🎨 Phase 7: Polish & Optimization (Week 8-9)

### Performance Optimization

- [ ] 3D rendering optimization
  - [ ] Level-of-detail (LOD) system
  - [ ] Frustum culling implementation
  - [ ] Instanced rendering for repeated objects
- [ ] Memory management
  - [ ] Asset streaming and caching
  - [ ] Undo history optimization
  - [ ] Garbage collection tuning

### Keyboard Shortcuts Implementation

- [x] Complete shortcut system
  - [x] Transform modes (W, E, R for translate/rotate/scale)
  - [x] Selection operations (ESC clear, Delete/Backspace remove)
  - [x] Edit operations (Ctrl+D duplicate)
  - [x] View controls (G grid toggle, 1/2/3 camera modes)
  - [x] File operations (Ctrl+N, O, S, Ctrl+Shift+E)
  - [x] Undo/redo (Ctrl+Z, Y)
  - [x] Copy/paste (Ctrl+C, V)
  - [x] Group/ungroup (Ctrl+G, Ctrl+Shift+G)
  - [x] Transform constraints (X/Y/Z axis locking)
- [x] Input handling system
  - [x] Keyboard event capture with input field filtering
  - [x] Modifier key combinations (Ctrl, Shift)
  - [x] Context-aware shortcuts
- [ ] Shortcut customization
  - [ ] User-configurable key bindings
  - [ ] Shortcut help overlay
  - [ ] Context-sensitive shortcuts

### Tutorial System

- [ ] Interactive tutorial implementation
  - [ ] Step-by-step guided tour
  - [ ] Highlight UI elements during tutorial
  - [ ] Practice exercises with validation
- [ ] Help documentation
  - [ ] In-app help panel
  - [ ] Contextual tooltips
  - [ ] Video tutorial integration

### Example Levels and Templates

- [ ] Curated example projects
  - [ ] Office building showcase
  - [ ] Fantasy dungeon example
  - [ ] Sci-fi facility demo
  - [ ] Custom template creation guide
- [ ] Template library
  - [ ] Room templates (office, meeting, lab)
  - [ ] Corridor templates (straight, L-shaped, T-junction)
  - [ ] Complete level templates

### Documentation

- [ ] User documentation
  - [ ] Getting started guide
  - [ ] Feature reference manual
  - [ ] Export format documentation
  - [ ] Bevy integration guide
- [ ] Developer documentation
  - [ ] API reference
  - [ ] Plugin development guide
  - [ ] Customization examples

---

## 📱 Phase 8: Distribution (Week 9-10)

### Build Pipeline

- [ ] Production build configuration
  - [ ] Optimize bundle size
  - [ ] Code splitting and lazy loading
  - [ ] Asset optimization pipeline
- [ ] Cross-platform builds
  - [ ] Windows, macOS, Linux builds
  - [ ] Platform-specific optimizations
  - [ ] Dependency bundling

### Auto-updater System

- [ ] Tauri updater integration
  - [ ] Update server setup
  - [ ] Version checking and notification
  - [ ] Background download and installation
- [ ] Release management
  - [ ] Semantic versioning
  - [ ] Release notes generation
  - [ ] Rollback capability

### Quality Assurance

- [ ] Crash reporting system
  - [ ] Error tracking and logging
  - [ ] Anonymous crash reports
  - [ ] Performance monitoring
- [ ] Testing suite
  - [ ] Unit tests for core algorithms
  - [ ] Integration tests for export formats
  - [ ] UI automation tests

### Analytics (Optional)

- [ ] Usage analytics implementation
  - [ ] Feature usage tracking
  - [ ] Performance metrics
  - [ ] User behavior insights
- [ ] Privacy-focused analytics
  - [ ] Opt-in analytics
  - [ ] Data anonymization
  - [ ] GDPR compliance

### Package and Distribution

- [ ] Distribution channels
  - [ ] GitHub releases
  - [ ] Platform-specific stores (if applicable)
  - [ ] Direct download setup
- [ ] Installation experience
  - [ ] Installer creation
  - [ ] File association setup
  - [ ] Desktop integration

### Marketing Materials

- [ ] Promotional content
  - [ ] Feature demonstration videos
  - [ ] Screenshot gallery
  - [ ] Use case examples
- [ ] Community resources
  - [ ] Discord/forum setup
  - [ ] Issue tracking
  - [ ] Contribution guidelines

---

## 📊 Success Metrics & Testing

### Performance Targets

- [ ] **60 FPS** with 10,000+ objects in viewport
- [ ] **Selection response < 16ms** for interactive editing
- [ ] **Generation < 200ms** for 48x36x3 level
- [ ] **Undo/redo < 10ms** for smooth workflow
- [ ] **Export < 2 seconds** for complete scene

### Quality Standards

- [ ] **Zero data loss** on save/load operations
- [ ] **Bevy compatibility** - exports load without errors
- [ ] **Crash resistance** during normal use
- [ ] **Professional output** quality matching commercial tools

### User Experience Goals

- [ ] **10 minutes** for new user to create and edit level
- [ ] **Native feel** for users familiar with Unity/Blender
- [ ] **One-click export** to Bevy integration
- [ ] **Professional workflow** efficiency

---

## 🔧 Development Tools & Dependencies

### Frontend Dependencies

```json
{
  "three": "^0.158.0",
  "@react-three/fiber": "^8.15.0",
  "@react-three/drei": "^9.88.0",
  "zustand": "^4.4.0",
  "immer": "^10.0.0",
  "tailwindcss": "^3.3.0"
}
```

### Backend Dependencies

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
rand = "0.8"
tauri = { version = "1.0", features = ["fs-all", "shell-all"] }
```

### Development Commands

```bash
# Development
npm run tauri dev              # Hot reload development
cargo test --manifest-path src-tauri/Cargo.toml  # Backend tests  
npm test                       # Frontend tests

# Build
npm run tauri build           # Production build
cargo build --release         # Optimized Rust build

# Validation
cd examples/test_import && cargo run  # Test Bevy integration
```

---

## 📝 Notes

- **Architecture**: Prioritize modularity for easy extension and testing
- **Performance**: Profile early and often, especially 3D operations
- **UX**: User test each phase with target developers
- **Documentation**: Write docs alongside implementation, not after
- **Testing**: Export format validation is critical for Bevy integration

**Target Launch**: 10 weeks from start to distributable MVP
**Post-MVP**: Community feedback → WFC algorithm → Advanced features
