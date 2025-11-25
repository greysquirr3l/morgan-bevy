# Changelog

All notable changes to the Morgan-Bevy 3D Level Editor project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-11-24 - "Testing Infrastructure & Enhanced UI Release"

### Added

- **Comprehensive Testing Infrastructure**
  - Complete Vitest testing framework with jsdom environment for React component testing
  - Professional test setup with Tauri API mocking, localStorage, and clipboard mocking
  - Three.js WebGL context mocking for headless testing environment
  - Lucide React icon mocking system for component isolation
  - 30+ passing tests covering utilities, store management, and UI components
  - MaterialEditor component test suite with user interaction testing
  - Editor store test suite covering object management, selection, and transforms
  - Automated test execution with npm test script integration

- **Enhanced Inspector Panel System**
  - Advanced tile properties management with comprehensive metadata support
  - Emoji icon integration for tile types (🟫🚪🪟🧱📦🌟🎯⚡) with visual categorization
  - ASCII character mapping system for tile representation
  - Movement and vision property controls with checkbox interfaces
  - Tag preset system for rapid tile configuration
  - Grid position tracking with coordinate display
  - Metadata persistence and synchronization with editor store

- **Professional Material Editor Component**
  - Complete PBR material property editing with metallic/roughness workflow
  - Material preset library with basic materials (Metal, Plastic, Wood, Glass, Concrete)
  - Advanced material presets with emissive properties (Neon, LED, Gold, Copper, Chrome)
  - Texture browsing and management with file system integration
  - Material preview system with visual representation
  - Copy/paste material functionality with clipboard integration
  - Custom material saving and preset management with localStorage persistence
  - Multi-object material application with batch editing support

### Enhanced

- **Editor Store Architecture**
  - Enhanced metadata support in object properties for complex tile data
  - Improved type safety with explicit parameter annotations
  - Fixed Zustand 5.0.8 compatibility issues with proper type inference
  - Better state management for complex UI interactions
  - Resolved compilation errors and warnings across all store methods

- **Component Testing Framework**
  - Complete mock infrastructure for isolated component testing
  - Testing utilities for user interactions and state verification
  - Professional test organization with describe/it structure
  - Coverage for critical UI workflows and edge cases

- **Code Quality Improvements**
  - Fixed all TypeScript compilation errors and warnings
  - Resolved 21+ compilation errors in MaterialEditor tests
  - Enhanced import management and dependency resolution
  - Improved error handling and debugging infrastructure
  - Professional logging and development workflow optimization

### Fixed

- **Testing Infrastructure Issues**
  - Resolved MaterialEditor test compilation errors with proper mock setup
  - Fixed localStorage and clipboard mocking for component tests
  - Corrected Three.js WebGL context mocking for headless environments
  - Fixed Lucide React icon mocking with comprehensive icon coverage
  - Resolved store test issues with proper state management verification

- **Component Architecture Fixes**
  - Fixed Inspector Panel integration with enhanced metadata support
  - Corrected MaterialEditor component rendering and interaction issues
  - Resolved prop passing and component composition problems
  - Fixed test setup and configuration for reliable test execution

- **Build and Development Issues**
  - Resolved all npm test execution errors and failures
  - Fixed import statements and dependency management
  - Corrected TypeScript configuration for testing environment
  - Enhanced development workflow with reliable testing pipeline

### Technical Achievements

- **Test Coverage**: 30 tests passing across 3 test suites (utilities, store, components)
- **Code Quality**: Zero compilation errors and warnings in test environment
- **Component Reliability**: Comprehensive testing for critical UI components
- **Development Workflow**: Robust testing infrastructure for continued development
- **User Experience**: Enhanced Inspector Panel and Material Editor for professional workflows

## [0.3.5] - 2025-11-24 - "Professional Asset Management Release"

### Added

- **Professional SQLite Asset Database System**
  - Complete SQLite backend with rusqlite 0.32.1 for enterprise-grade asset management
  - Comprehensive database schema: assets, metadata, collections, thumbnails, and tags tables
  - Full-text search capabilities with efficient indexing for rapid asset discovery
  - Asset metadata extraction and storage (file size, checksums, creation/modification dates)
  - Collection management with automatic categorization and user-defined groups
  - Thumbnail generation and caching system for visual asset browsing
  - Database migration system for seamless schema updates

- **Advanced Asset Browser UI**
  - Professional asset browser component with comprehensive database integration
  - Real-time search with debounced input for optimal performance
  - Advanced filtering by asset type, collection, and custom metadata
  - Statistics dashboard showing total assets, storage usage, collections count, and last scan time
  - Drag-and-drop asset integration with 3D viewport (preserved from previous versions)
  - Virtual scrolling for handling thousands of assets efficiently
  - Asset preview capabilities with thumbnail support
  - Bulk operations and multi-select functionality
  - Complete JSX component structure with proper conditional rendering and hideHeader prop support

- **Comprehensive Menu System**
  - Fully functional File, Edit, View, Generate, Tools, and Help menus
  - Context-aware menu actions with proper state management
  - Keyboard shortcut integration and help system
  - Menu state synchronization with editor functionality
  - Professional menu styling with hover states and visual feedback

- **Enhanced UI Component System**
  - Streamlined component architecture with reduced redundancy
  - Improved CollapsiblePanel system with better header management
  - Professional tooltip system for asset statistics and UI elements
  - Consistent visual design language across all panels
  - Enhanced responsive design for various screen sizes

### Updated

- **Dependency Management and Compatibility**
  - Upgraded core dependencies for better performance and security
  - rusqlite updated to 0.32.1 with bundled SQLite and chrono features
  - Tauri v2.9 with enhanced plugin system integration
  - Updated @tauri-apps/api to v2.9.0 for frontend compatibility
  - Added sha2 0.10 for enhanced asset fingerprinting
  - Added rayon 1.8 for parallel asset scanning operations
  - Added tempfile 3.8 for comprehensive testing support

- **Code Quality and Architecture**
  - TypeScript configuration improvements with ignoreDeprecations for cleaner builds
  - Comprehensive error handling throughout asset management system
  - Professional logging and debugging infrastructure
  - Modular component architecture for better maintainability
  - Enhanced type safety across all TypeScript components

- **Performance Optimizations**
  - Efficient database queries with proper indexing strategies
  - Optimized asset scanning with parallel processing capabilities
  - Reduced UI redundancy for improved rendering performance
  - Enhanced state management with Zustand 5.0.8 integration
  - Memory-efficient asset loading and caching mechanisms

### Fixed

- **UI/UX Improvements**
  - Resolved duplicate header issues in panel components
  - Fixed critical JSX compilation errors in AssetBrowser preventing component rendering
  - Corrected JSX element balance and conditional rendering structure
  - Fixed resize handle functionality across all panels
  - Corrected menu state management and visual feedback
  - Enhanced component prop patterns for better reusability
  - Improved keyboard shortcut handling and conflicts resolution

- **Build and Compilation Issues**
  - Resolved all TypeScript compilation errors and warnings
  - Fixed critical JSX compilation errors in AssetBrowser component preventing build
  - Corrected JSX element structure and conditional rendering syntax issues
  - Fixed Rust compilation issues with updated dependencies
  - Corrected import statements and unused code cleanup
  - Enhanced build pipeline stability and reliability
  - Proper error handling in asset database operations

### Technical Debt Addressed

- **Component Architecture Cleanup**
  - Eliminated redundant component headers and improved prop interfaces
  - Standardized component patterns across the entire application
  - Enhanced component composition for better maintainability
  - Improved separation of concerns in UI components

- **Database Architecture**
  - Professional database design with proper normalization
  - Comprehensive indexing strategy for optimal query performance
  - Transaction management for data integrity
  - Error handling and recovery mechanisms
  - Scalable schema design for future enhancements

### Infrastructure Improvements

- **Development Environment**
  - Enhanced debugging capabilities with comprehensive logging
  - Improved hot reload functionality for faster development cycles
  - Better error reporting and troubleshooting tools
  - Enhanced testing framework with database testing support

- **Build System**
  - Optimized build pipeline with dependency caching
  - Enhanced cross-platform compatibility testing
  - Improved bundle size optimization
  - Better development vs. production configuration management

## [Unreleased] - 2025-11-24

### Updated

- **Code Quality and Error Resolution (November 24, 2025)**
  - **TypeScript Configuration** - Added `ignoreDeprecations: "6.0"` to resolve baseUrl deprecation warning
  - **GenerationPanel Cleanup** - Removed unused imports (`CreateObjectCommand`, `executeCommand`) for cleaner code
  - **Build Pipeline** - Resolved all compilation errors and warnings for production-ready builds
  - **Procedural Generation Fixes** - Fixed object creation logic and state management in GenerationPanel
  - **Debugging Infrastructure** - Added comprehensive logging for generation process troubleshooting

- **UI/UX Improvements (November 24, 2025)**
  - **Thinner Resize Bars** - Reduced resize handle width from 2px to 1px for more subtle interface
  - **Improved Resize Handles** - Enhanced visual feedback with better hover states and z-index layering
  - **Fixed Duplicate Headers** - Eliminated duplicate "Inspector" and "Layers" headers between CollapsiblePanel and component titles
  - **Enhanced Panel Management** - Added hideHeader prop to Layers component for cleaner integration with CollapsiblePanel
  - **Refined Visual Design** - More professional appearance with consistent styling across all panels
  - **Fixed Resize Functionality** - Resolved 3-column layout locking issue preventing proper panel resizing
  - **Improved Layout Calculations** - Better center width calculation with proper handle width accounting
  - **Window Resize Support** - Added window resize listener to maintain proper layout proportions

- **Dependency Management (November 24, 2025)**
  - Updated all npm packages to newer, compatible versions
  - **Zustand** - Upgraded from 4.5.7 to 5.0.8 to resolve major type inference issues
  - Fixed type inference problem where `selectedObjects` was incorrectly inferred as `never[]` instead of `string[]`
  - Added explicit type annotations throughout codebase for strict TypeScript compliance
  - Resolved 25+ TypeScript compilation errors systematically
  - Achieved successful production build with `npm run build`

### Fixed

- **Code Quality and Compilation Issues (November 24, 2025)**
  - **TypeScript Configuration** - Resolved baseUrl deprecation warning by adding ignoreDeprecations setting
  - **Unused Import Cleanup** - Removed unused CreateObjectCommand and executeCommand imports from GenerationPanel
  - **Build Process** - Eliminated all compilation errors for clean production builds
  - **GenerationPanel Debugging** - Fixed object creation logic and added comprehensive debugging logs
  - **State Management** - Improved Zustand store integration with direct addObject calls for bulk operations
  - Resolved Zustand type inference problems with array initialization and object properties
  - Added explicit parameter types to all callback functions and store methods
  - Fixed array spread type issues in TransformGizmos with explicit tuple typing
  - Corrected state parameter types in setState callbacks across all components
  - Eliminated unused variable warnings in command pattern implementations
  - Fixed parameter type annotations in component callbacks (ActionsPanel, Inspector, Scene, etc.)

### Added

- **Professional Resizable UI System**
  - Dynamic panel resizing with drag handles for left sidebar (hierarchy), right sidebar (inspector), and bottom panel (assets)
  - Custom useResizablePanels hook managing resize state with mouse event handlers and collision boundaries
  - Min/max width constraints (200px-600px) and height constraints (150px-400px) for optimal UX
  - Visual resize indicators with hover effects and proper cursor styling
  - Smooth drag interactions with real-time panel size updates
  - Collapsible bottom panel with toggle button and minimal collapsed state

- **Advanced Camera Control System**
  - Custom useCameraControls hook for Three.js camera manipulation within React context
  - Reset view functionality returning camera to default position (10, 10, 10) with smooth transitions
  - Focus selection feature calculating bounding boxes of selected objects for optimal framing
  - Camera control buttons integrated into viewport toolbar with professional styling
  - Proper Three.js OrbitControls integration with programmatic camera positioning
  - forwardRef pattern in Viewport3D component enabling external camera control access

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
  - **Industry-Standard Resizable Panels** - Drag handles with visual feedback and constraint boundaries
  - **Professional Camera Navigation** - Reset and focus controls matching Unity/Blender workflows
  - Consistent dark theme styling across all panels with enhanced interaction states

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

```text
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

**Repository**: [Morgan-Bevy](https://github.com/greysquirr3l/morgan-bevy)  
**License**: MIT OR Apache-2.0  
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
