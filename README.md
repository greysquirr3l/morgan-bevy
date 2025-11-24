# Morgan-Bevy 3D Level Editor

> **🚧 Under Active Development** - Professional 3D level editor for Bevy game engine with procedural generation capabilities.

**Core Philosophy**: *"Generate smart, edit fast, export perfect."*

[![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![Tauri](https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF)](https://tauri.app/)
[![Three.js](https://img.shields.io/badge/threejs-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)

---

## 🎯 Project Overview

Morgan-Bevy is a comprehensive 3D level editor specifically designed for the [Bevy game engine](https://bevyengine.org/). It combines **procedural generation algorithms** (BSP, WFC) with **professional manual editing tools** to enable rapid level design and iteration.

### 🎮 **Target Users**

- **Game Developers** using Bevy engine
- **Level Designers** and 3D environment artists
- **Indie Game Studios** needing rapid prototyping tools
- **Procedural Generation** enthusiasts

---

## ✨ Current Features

### 🎨 **3D Editor Foundation**

- ✅ **Interactive 3D Viewport** - Professional Three.js rendering with orbit camera controls
- ✅ **Transform Gizmos** - Move, rotate, and scale objects with industry-standard controls (W/E/R keys)
- ✅ **Object Selection** - Click selection with multi-select (Ctrl+click) and visual feedback
- ✅ **Grid System** - Configurable snapping (0.1, 0.5, 1.0, 2.0 units) with visual overlay
- ✅ **Professional Resizable UI** - Dynamic panel system with drag handles and constraint boundaries
- ✅ **Advanced Camera Controls** - Reset view and focus selection with bounding box calculations

### �️ **Professional Asset Management**

- ✅ **SQLite Asset Database** - Enterprise-grade database with rusqlite 0.32.1 for scalable asset management
- ✅ **Advanced Asset Browser** - Comprehensive UI with search, filtering, and statistics dashboard
- ✅ **Full-Text Search** - Real-time asset discovery with debounced search and efficient indexing
- ✅ **Collection Management** - Automatic categorization and user-defined asset groups
- ✅ **Asset Metadata System** - File size, checksums, creation dates, and custom metadata storage
- ✅ **Thumbnail Support** - Visual asset previews with caching system
- ✅ **Drag & Drop Integration** - Seamless asset-to-viewport workflow for rapid scene building
- ✅ **Statistics Dashboard** - Total assets, storage usage, collections count, and scan status

### 📁 **File System Integration**

- ✅ **Native File Dialogs** - Browse local and external folders with platform-native interfaces
- ✅ **Asset Type Detection** - Automatic classification of models, textures, materials, and audio files
- ✅ **Parallel Asset Scanning** - High-performance asset discovery with rayon for large libraries
- ✅ **Database Migration System** - Seamless schema updates and version management

### 🎛️ **Professional Menu System**

- ✅ **Complete Menu Bar** - Fully functional File, Edit, View, Generate, Tools, and Help menus
- ✅ **Context-Aware Actions** - Smart enabling/disabling based on current editor state
- ✅ **Keyboard Shortcut Integration** - Professional shortcut system with help documentation
- ✅ **Menu State Synchronization** - Real-time reflection of editor state in menu options

### ⌨️ **Professional Workflow**

- ✅ **Keyboard Shortcuts** - Complete shortcut system for efficient editing
  - `W` / `E` / `R` - Transform modes (translate/rotate/scale)
  - `G` - Toggle grid display
  - `F` - Frame selected objects (focus camera)
  - `Alt+F` - Frame all objects
  - `Ctrl+D` - Duplicate selected objects
  - `Delete` / `Backspace` - Remove selected objects
  - `Esc` - Clear selection
  - Camera controls via toolbar buttons (Reset View, Focus Selection)

### 🏗️ **Scene Management**

- ✅ **Resizable Hierarchy Panel** - Tree view of scene objects with dynamic sizing and selection synchronization
- ✅ **Resizable Inspector Panel** - Object property editing with drag-handle resizing
- ✅ **Object Management** - Create, duplicate, and remove 3D objects
- ✅ **State Management** - Zustand store with real-time viewport synchronization
- ✅ **Collapsible Bottom Panel** - Asset browser with toggle and resize functionality
- ✅ **Layer System** - Organize objects by layers (Walls, Floors, Doors, Lights)

### 🔧 **Technical Foundation**

- ✅ **Cross-Platform** - Windows, macOS, and Linux support via Tauri
- ✅ **Hot Reload** - Development environment with frontend/backend hot reload
- ✅ **Type Safety** - Full TypeScript coverage with strict configuration
- ✅ **Performance** - 60 FPS rendering with optimized Three.js integration

---

## 🚀 **Upcoming Features** (In Development)

### 📦 **Phase 4: Advanced Editing**

- 🔄 **Box Selection** - Multi-object selection with drag rectangles
- 🔄 **Undo/Redo System** - Command pattern with efficient history management
- 🔄 **Copy/Paste** - Full clipboard operations with transform data
- 🔄 **Multi-Object Editing** - Edit multiple selected objects simultaneously
- 🔄 **Advanced Material Editor** - PBR material editing with real-time preview

### 🌱 **Phase 5: Procedural Generation**

- 🔄 **BSP Algorithm** - Binary Space Partitioning for room generation
- 🔄 **WFC Integration** - Wave Function Collapse for detailed layouts
- 🔄 **Theme System** - Office, Dungeon, Sci-Fi architectural styles
- 🔄 **Seed Management** - Reproducible generation with seed control

### 📤 **Phase 6: Export System**

- 🔄 **Multi-Format Export** - JSON, RON (Bevy native), and Rust code generation
- 🔄 **Bevy Integration** - Direct import into Bevy projects
- 🔄 **Collision Data** - Export collision shapes and navigation meshes
- 🔄 **Asset References** - Maintain asset links in exported data

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Desktop App** | [Tauri](https://tauri.app/) v2.9 | Cross-platform native application framework |
| **Frontend** | [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/) | UI framework with type safety |
| **3D Rendering** | [Three.js](https://threejs.org/) + [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | WebGL 3D graphics |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) v5.0.8 + [Immer](https://immerjs.github.io/immer/) | Efficient state management |
| **Database** | [SQLite](https://www.sqlite.org/) + [rusqlite](https://github.com/rusqlite/rusqlite) v0.32.1 | Asset database and metadata storage |
| **Backend** | [Rust](https://www.rust-lang.org/) | High-performance algorithms and file operations |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework |
| **Build System** | [Vite](https://vitejs.dev/) + [Cargo](https://doc.rust-lang.org/cargo/) | Fast development and building |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 22.21.1+ and npm
- [Rust](https://rustup.rs/) 1.70+ with Cargo
- Platform-specific dependencies for Tauri

### Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/greysquirr3l/morgan-bevy.git
   cd morgan-bevy
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start development server**

   ```bash
   npm run tauri dev
   ```

4. **Start editing!**
   - The 3D editor will open with demo objects
   - Use W/E/R to switch transform modes
   - Click objects to select and manipulate
   - Drag assets from the Assets panel to create new objects

### Build for Production

```bash
npm run tauri build
```

---

## 📋 Development Roadmap

| Phase | Timeline | Status | Features |
|-------|----------|--------|----------|
| **Phase 1** | ✅ Complete | **Foundation** | 3D Editor, Transform Gizmos, Basic Asset Management |
| **Phase 2** | ✅ Complete | **UI & Workflow** | Resizable Panels, Camera Controls, Professional UI |
| **Phase 3** | ✅ Complete | **Asset Database** | SQLite Database, Advanced Asset Browser, Search & Collections |
| **Phase 4** | 🔄 In Progress | **Advanced Editing** | Box Selection, Undo/Redo, Enhanced UI |
| **Phase 5** | 📅 Planned | **Procedural Generation** | BSP, WFC, Theme System |
| **Phase 6** | 📅 Planned | **Export & Integration** | Multi-format Export, Bevy Integration |

---

## 🎬 **Demo & Screenshots**

> 📸 *Screenshots and demo videos coming soon as features are completed*

### Current Capabilities

- **Interactive 3D Scene** with real-time object manipulation
- **Professional Transform Gizmos** for precise editing
- **Industry-Standard Resizable Interface** with drag handles and constraints
- **Advanced Camera Controls** with reset view and focus selection
- **Professional Asset Database** with SQLite backend and full-text search
- **Comprehensive Asset Browser** with statistics, filtering, and collections
- **Asset Drag-and-Drop** workflow from database browser to 3D viewport
- **Multi-object Selection** with visual feedback
- **Grid-based Snapping** for precision placement
- **Complete Menu System** with context-aware actions and keyboard shortcuts

---

## 🤝 Contributing

**🚀 We're actively seeking contributors!** Morgan-Bevy is an ambitious open-source project that would benefit greatly from community involvement. Whether you're a Rust developer, TypeScript expert, 3D graphics enthusiast, or UI/UX designer, there are opportunities to make a significant impact.

### 🎯 **Areas Where We Need Help**

- **Rust Backend Development** - Procedural generation algorithms (BSP, WFC), export systems
- **Three.js/WebGL** - 3D rendering optimizations, advanced visual features
- **React/TypeScript** - UI components, state management, performance improvements
- **Game Development** - Bevy engine integration, level design workflows
- **Documentation** - Technical writing, tutorials, examples
- **Testing** - Unit tests, integration tests, performance testing

### 🐛 **Bug Reports & Feature Requests**

- Open an [issue](https://github.com/greysquirr3l/morgan-bevy/issues) with detailed reproduction steps
- Check existing issues before creating new ones
- Include system information and error messages

### 💻 **Development Contributions**

- Fork the repository and create a feature branch
- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation for user-facing changes

### 📚 **Documentation**

- Improve README, code comments, or user guides
- Create tutorials or example projects
- Report unclear or missing documentation

---

## 📄 License

This project is dual-licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0))
- MIT License ([LICENSE-MIT](LICENSE-MIT) or [http://opensource.org/licenses/MIT](http://opensource.org/licenses/MIT))

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

---

## 🙏 Acknowledgments

- **[Bevy Engine](https://bevyengine.org/)** - Target game engine and inspiration
- **[Three.js](https://threejs.org/)** - Powerful 3D graphics foundation
- **[Tauri](https://tauri.app/)** - Modern desktop app framework
- **[React Three Fiber](https://github.com/pmndrs/react-three-fiber)** - React integration for Three.js
- **Open Source Community** - Libraries, tools, and inspiration

---

## 📞 **Contact & Community**

- **Repository**: [github.com/greysquirr3l/morgan-bevy](https://github.com/greysquirr3l/morgan-bevy)
- **Issues**: [Report bugs or request features](https://github.com/greysquirr3l/morgan-bevy/issues)
- **Discussions**: [Community discussions](https://github.com/greysquirr3l/morgan-bevy/discussions)

---

<div align="center">

**⭐ Star this repository if you find it useful!**

**🚧 This project is under active development - watch for updates!**

</div>
