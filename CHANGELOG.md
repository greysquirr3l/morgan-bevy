# Changelog

All notable changes to the Morgan-Bevy 3D Level Editor project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2025-11-24

### Added

- **Complete Assets Panel System**
  - Collapsible asset browser with local and external folder support
  - Drag-and-drop integration from assets panel to 3D viewport
  - File system integration via Rust backend with `scan_assets`, `browse_assets_folder`, and `scan_assets_folder` Tauri commands
  - Asset type detection (model, texture, material, audio, other) with appropriate icons
  - Grid layout displaying file names, types, and metadata
  - Visual drop indicators and feedback during drag operations
  - Automatic 3D object creation based on dropped asset types
  - Error handling with fallback mock data for development
  - Demo assets folder with sample 3D models

- **Fully Functional Transform Gizmos**
  - Complete Three.js TransformControls integration for translate/rotate/scale operations
  - Real-time transform updates synchronized between 3D viewport and editor store
  - Proper scene object naming system for gizmo attachment (`scene.getObjectByName()`)
  - Transform mode switching via toolbar buttons and keyboard shortcuts (W/E/R)
  - Visual gizmo rendering with world/local space support
  - Multi-object transform capability through selection system

- **Enhanced Scene Management**
  - Demo scene objects (cube, sphere, pyramid) with full interactivity
  - Real-time scene rendering with Three.js mesh creation from store objects
  - Selection highlighting with color-coded materials (blue=selected, yellow=hovered)
  - Object lifecycle management (create, update, delete) with proper cleanup
  - Transform data storage and synchronization between store and Three.js objects
  - Visibility and interaction state management

- **Advanced Keyboard Shortcuts System**
  - Transform mode shortcuts: W (translate), E (rotate), R (scale)
  - Selection operations: Escape (clear selection), Delete/Backspace (remove objects)
  - Edit operations: Ctrl+D (duplicate selected objects)
  - View controls: G (toggle grid), 1/2/3 (camera modes)
  - Input handling system with modifier key support (Ctrl, Shift)
  - Context-aware shortcuts that ignore input fields
  - Professional workflow efficiency matching industry standards

- **Rust Backend Enhancements**
  - Asset scanning module (`src-tauri/src/assets.rs`) with file system operations
  - File type detection and metadata extraction (size, modified date)
  - Native file dialog integration using `rfd` crate
  - MD5 hashing for asset identification and caching
  - Cross-platform file path handling and error management
  - Tauri command registration and frontend integration

### Enhanced

- **Editor Store Improvements**
  - Added demo objects with proper transform data for immediate testing
  - Enhanced object duplication with unique ID generation and spatial offset
  - Improved transform update system with partial transform support
  - Extended state management for asset integration and scene lifecycle

- **UI/UX Polish**
  - Professional transform mode toolbar with active state indicators
  - Grid snapping controls with configurable increments (0.1, 0.5, 1.0, 2.0)
  - Camera mode switcher with orbit/fly/top-down options
  - Viewport coordinate display and status indicators
  - Consistent dark theme styling across all panels

- **Three.js Integration Optimizations**
  - Proper mesh naming for transform gizmo attachment
  - Improved raycasting and object picking performance
  - Enhanced material management with state-based coloring
  - Optimized scene graph structure for large object counts

### Fixed

- **Compilation and Build Issues**
  - Resolved all Rust compilation warnings with `#[allow(dead_code)]` attributes
  - Fixed unused code warnings in procedural generation modules (BSP, WFC, themes, formats)
  - Corrected Tauri command registration in main.rs for asset management
  - Updated Cargo.toml dependencies for file dialog and hashing support

- **Three.js Integration Bugs**
  - Fixed transform gizmos not attaching to selected objects
  - Corrected scene object naming for proper gizmo-object association
  - Resolved selection highlighting and material update issues
  - Fixed transform synchronization between gizmos and editor store

- **State Management Fixes**
  - Corrected object selection persistence across operations
  - Fixed multi-object selection with Ctrl+click additive behavior
  - Resolved transform state updates not propagating to 3D scene
  - Fixed object removal not clearing from selection state

### Technical Debt Addressed

- Cleaned up unused procedural generation code with proper allow directives
- Improved error handling in asset scanning with graceful degradation
- Enhanced type safety in transform operations and object management
- Standardized file naming conventions and module organization

---

## [0.1.0] - 2025-11-23 - "Foundation Release"

### Added

- **Complete Project Foundation**
  - Tauri + React + TypeScript + Three.js development environment
  - Hot reload configuration for both frontend and backend development
  - Complete build pipeline with cross-platform support
  - Professional project structure with component organization

- **Core 3D Viewport System**
  - Three.js integration with React Three Fiber
  - Interactive 3D canvas with orbit camera controls
  - Professional lighting setup (ambient, directional, point lights)
  - Shadow mapping and anti-aliasing configuration
  - Grid overlay system with infinite grid and section markers
  - World coordinate axes for spatial reference

- **Object Selection Framework**
  - Raycasting-based mouse picking for 3D objects
  - Single-click selection with visual feedback
  - Multi-selection with Ctrl+click additive behavior
  - Hover state detection and highlighting
  - Selection highlighting with outline effects
  - Ground plane interaction for selection clearing

- **Editor State Management**
  - Zustand store with Immer middleware for immutable updates
  - Complete editor state interface covering all editor aspects
  - Selection state tracking (selected objects, hover state)
  - Transform mode management (select, translate, rotate, scale)
  - Camera mode switching (orbit, fly, top-down)
  - Grid and UI state management (visibility, snapping, statistics)

- **UI Component Architecture**
  - **Viewport3D** - Main 3D rendering canvas with controls
  - **Hierarchy** - Scene object tree view with selection integration
  - **Inspector** - Object property panel (foundation)
  - **ActionsPanel** - Tool palette and quick actions
  - **App.tsx** - Professional layout with menu bar and toolbar
  - Consistent dark theme with custom CSS variables

- **Keyboard Shortcuts Foundation**
  - Basic shortcut system with key event handling
  - Transform mode switching (W, E, R keys)
  - Grid toggle and view controls
  - Escape for selection clearing
  - Input field filtering to avoid conflicts

- **Rust Backend Foundation**
  - **Procedural Generation Framework**
    - BSP (Binary Space Partitioning) algorithm implementation
    - WFC (Wave Function Collapse) foundation
    - Theme system for different architectural styles
    - Room subdivision and corridor generation logic
  
  - **Export System Architecture**
    - Multi-format export trait system
    - JSON exporter for universal compatibility
    - RON (Rusty Object Notation) exporter for Bevy integration
    - Rust code generation for direct game integration
    - Export format validation and error handling

  - **Spatial Systems**
    - 3D bounding box calculations
    - Spatial indexing structures
    - Collision detection foundations
    - Coordinate transformation utilities

- **Development Tooling**
  - ESLint configuration for code quality
  - TypeScript configuration with strict type checking
  - Tailwind CSS for consistent styling
  - Vite build configuration with optimization
  - Git configuration with appropriate ignores

### Initial Project Structure

```
morgan-bevy/
├── src/                          # React frontend
│   ├── components/               # UI components
│   │   ├── Viewport3D/          # 3D rendering system
│   │   ├── Hierarchy/           # Scene tree management
│   │   ├── Inspector/           # Property editing
│   │   └── ActionsPanel/        # Tool palette
│   ├── store/                   # Zustand state management
│   ├── hooks/                   # Custom React hooks
│   └── main.tsx                 # Application entry point
│
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── generation/          # Procedural algorithms
│   │   ├── export/              # Multi-format export
│   │   ├── spatial.rs           # 3D math and indexing
│   │   └── main.rs              # Tauri application
│   └── Cargo.toml               # Rust dependencies
│
└── Assets/                      # Sample 3D models and textures
```

### Development Environment Features

- **Cross-platform Support** - Windows, macOS, Linux compatibility
- **Hot Reload** - Frontend and backend changes reload automatically  
- **Type Safety** - Full TypeScript coverage with strict configuration
- **Performance Monitoring** - Three.js stats integration
- **Professional Tooling** - ESLint, Prettier, Tailwind CSS

### Architecture Decisions

- **Zustand over Redux** - Simpler state management with Immer integration
- **Three.js over WebGL** - Mature 3D ecosystem with React integration
- **Tauri over Electron** - Better performance and smaller bundle size
- **RON over JSON** - Native Bevy serialization format support
- **Component Composition** - Modular UI architecture for extensibility

### Performance Targets Established

- 60 FPS with 10,000+ objects in viewport
- Selection response < 16ms for interactive editing
- Generation < 200ms for 48x36x3 levels
- Professional workflow efficiency matching Unity/Blender

---

## Project Information

**Repository**: [Morgan-Bevy](https://github.com/user/morgan-bevy)  
**License**: MIT  
**Author**: Nick Campbell  
**Started**: November 23, 2025  

**Core Philosophy**: "Generate smart, edit fast, export perfect."

### Technology Stack

- **Frontend**: Tauri + React + Three.js + TypeScript + Tailwind CSS
- **Backend**: Rust + Serde + Tauri APIs
- **3D Rendering**: Three.js + React Three Fiber + Drei
- **State Management**: Zustand + Immer
- **Build System**: Vite + Cargo

### Target Audience

- Game developers using the Bevy engine
- Level designers and 3D environment artists  
- Procedural generation enthusiasts
- Indie game studios needing rapid prototyping tools

### Project Goals

1. **Professional 3D Level Editor** - Industry-standard editing capabilities
2. **Procedural Generation** - BSP and WFC algorithms for rapid content creation
3. **Bevy Integration** - Native export formats for seamless game integration
4. **Performance** - 60 FPS editing with thousands of objects
5. **Extensibility** - Plugin system for custom tools and generators
