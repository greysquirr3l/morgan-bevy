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
- ✅ **Professional UI** - Dark-themed interface with hierarchy, inspector, and asset panels

### 📁 **Asset Management**
- ✅ **Assets Panel** - Collapsible asset browser with drag-and-drop functionality
- ✅ **File System Integration** - Browse local and external folders with native file dialogs
- ✅ **Asset Types** - Support for models, textures, materials, and audio files
- ✅ **Drag & Drop Workflow** - Drop assets directly into 3D viewport to create objects
- ✅ **Metadata Display** - File size, type, and modification date information

### ⌨️ **Professional Workflow**
- ✅ **Keyboard Shortcuts** - Complete shortcut system for efficient editing
  - `W` / `E` / `R` - Transform modes (translate/rotate/scale)
  - `G` - Toggle grid display
  - `Ctrl+D` - Duplicate selected objects
  - `Delete` / `Backspace` - Remove selected objects
  - `Esc` - Clear selection
  - `1` / `2` / `3` - Camera mode switching

### 🏗️ **Scene Management**
- ✅ **Hierarchy Panel** - Tree view of scene objects with selection synchronization
- ✅ **Object Management** - Create, duplicate, and remove 3D objects
- ✅ **State Management** - Zustand store with real-time viewport synchronization
- ✅ **Layer System** - Organize objects by layers (Walls, Floors, Doors, Lights)

### 🔧 **Technical Foundation**
- ✅ **Cross-Platform** - Windows, macOS, and Linux support via Tauri
- ✅ **Hot Reload** - Development environment with frontend/backend hot reload
- ✅ **Type Safety** - Full TypeScript coverage with strict configuration
- ✅ **Performance** - 60 FPS rendering with optimized Three.js integration

---

## 🚀 **Upcoming Features** (In Development)

### 📦 **Phase 2: Advanced Editing**
- 🔄 **Box Selection** - Multi-object selection with drag rectangles
- 🔄 **Undo/Redo System** - Command pattern with efficient history management
- 🔄 **Copy/Paste** - Full clipboard operations with transform data
- 🔄 **Inspector Panel** - Detailed property editing for selected objects

### 🌱 **Phase 3: Procedural Generation**
- 🔄 **BSP Algorithm** - Binary Space Partitioning for room generation
- 🔄 **WFC Integration** - Wave Function Collapse for detailed layouts
- 🔄 **Theme System** - Office, Dungeon, Sci-Fi architectural styles
- 🔄 **Seed Management** - Reproducible generation with seed control

### 📤 **Phase 4: Export System**
- 🔄 **Multi-Format Export** - JSON, RON (Bevy native), and Rust code generation
- 🔄 **Bevy Integration** - Direct import into Bevy projects
- 🔄 **Collision Data** - Export collision shapes and navigation meshes
- 🔄 **Asset References** - Maintain asset links in exported data

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Desktop App** | [Tauri](https://tauri.app/) | Cross-platform native application framework |
| **Frontend** | [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/) | UI framework with type safety |
| **3D Rendering** | [Three.js](https://threejs.org/) + [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | WebGL 3D graphics |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) + [Immer](https://immerjs.github.io/immer/) | Efficient state management |
| **Backend** | [Rust](https://www.rust-lang.org/) | High-performance algorithms and file operations |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework |
| **Build System** | [Vite](https://vitejs.dev/) + [Cargo](https://doc.rust-lang.org/cargo/) | Fast development and building |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ and npm
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
| **Phase 1** | ✅ Complete | **Foundation** | 3D Editor, Transform Gizmos, Asset Management |
| **Phase 2** | 🔄 In Progress | **Advanced Editing** | Box Selection, Undo/Redo, Enhanced UI |
| **Phase 3** | 📅 Planned | **Procedural Generation** | BSP, WFC, Theme System |
| **Phase 4** | 📅 Planned | **Export & Integration** | Multi-format Export, Bevy Integration |
| **Phase 5** | 📅 Future | **Professional Tools** | Advanced Features, Plugin System |

---

## 🎬 **Demo & Screenshots**

> 📸 *Screenshots and demo videos coming soon as features are completed*

### Current Capabilities
- **Interactive 3D Scene** with real-time object manipulation
- **Professional Transform Gizmos** for precise editing
- **Asset Drag-and-Drop** workflow from file browser to 3D viewport
- **Multi-object Selection** with visual feedback
- **Grid-based Snapping** for precision placement

---

## 🤝 Contributing

Morgan-Bevy is under active development and welcomes contributions!

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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

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