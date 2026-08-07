/**
 * HelpModal — feature reference + FAQ + quick links.
 *
 * Companion to KeyboardShortcutsModal. Both are opened from the
 * Help menu. This modal is the in-app documentation entry point
 * (per T59).
 */
import { BookOpen, Bug, FileText, Github, X } from 'lucide-react'
import { useEffect } from 'react'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      {
        q: 'How do I create a new object?',
        a: 'Use the "Add" actions in the left Actions panel. Cube, Sphere, and Pyramid primitives are available, plus Lights and Groups.',
      },
      {
        q: 'How do I save my work?',
        a: 'Ctrl+S for the local-storage snapshot (auto-restored on next launch), File > Save Project for a .mbp file, or File > Export Level for JSON/RON/Rust source.',
      },
      {
        q: 'How do I undo?',
        a: 'Ctrl+Z / Ctrl+Y (or Edit > Undo / Redo). Undo/Redo history is per-session.',
      },
    ],
  },
  {
    id: 'procedural',
    title: 'Procedural Generation',
    items: [
      {
        q: 'How do I run BSP?',
        a: 'Open the Generation panel (Generate menu > Open Generation Panel), pick "BSP" as the algorithm, choose a theme (Office / Dungeon / Castle / SciFi), and click Generate.',
      },
      {
        q: 'How do I run WFC?',
        a: 'Same flow as BSP — pick "WFC" as the algorithm. WFC produces tile-grid patterns from the same themes.',
      },
      {
        q: 'Where do I get themes?',
        a: 'Themes are defined in `src-tauri/src/generation/themes.rs` — 4 built-in themes (Office, Dungeon, Castle, SciFi) with full tile/adjacency data.',
      },
    ],
  },
  {
    id: 'export',
    title: 'Export & Integration',
    items: [
      {
        q: 'What export formats are supported?',
        a: 'JSON (universal), RON (Bevy-native), Rust source code (Bevy 0.19 component shape: Mesh3d + MeshMaterial3d + Transform + Name), GLTF, and binary FBX 7.7.0.',
      },
      {
        q: 'How do I export for Bevy?',
        a: 'Use the Export panel on the right side, or File > Export Level. The Rust source code generator produces a `spawn_level_<name>` function that compiles against Bevy 0.19 — see `docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md`.',
      },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    items: [
      {
        q: 'Where is the full shortcut list?',
        a: 'Click the "?" button in the top toolbar (or press ?) to open the Keyboard Shortcuts modal.',
      },
    ],
  },
] as const

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        className="bg-editor-panel border border-editor-border rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] mx-4 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-editor-border px-6 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-editor-accent" />
            <h2 id="help-modal-title" className="text-lg font-semibold">
              Help &amp; Documentation
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="p-1 rounded hover:bg-editor-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-6 flex-1">
          {/* Table of contents */}
          <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#help-${s.id}`}
                className="px-3 py-2 bg-editor-bg hover:bg-editor-border rounded text-center"
              >
                {s.title}
              </a>
            ))}
          </nav>

          {/* Sections */}
          {SECTIONS.map(s => (
            <section key={s.id} id={`help-${s.id}`} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-editor-accent">
                {s.title}
              </h3>
              <ul className="space-y-2">
                {s.items.map((item, i) => (
                  <li key={i} className="bg-editor-bg rounded p-3 border border-editor-border">
                    <p className="text-sm font-medium mb-1">{item.q}</p>
                    <p className="text-xs text-editor-textMuted leading-relaxed">{item.a}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {/* External links */}
          <section className="space-y-2 pt-2 border-t border-editor-border">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-editor-accent">
              Resources
            </h3>
            <ul className="space-y-1 text-sm">
              <li>
                <a
                  href="docs/dev/typescript-counterintuitive-patterns.md"
                  className="text-editor-accent hover:underline inline-flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" />
                  TypeScript patterns cheat sheet
                </a>
              </li>
              <li>
                <a
                  href="docs/dev/rust-counterintuitive-patterns.md"
                  className="text-editor-accent hover:underline inline-flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Rust patterns cheat sheet
                </a>
              </li>
              <li>
                <a
                  href="docs/dev/BEVY_0.18_TO_0.19_MIGRATION.md"
                  className="text-editor-accent hover:underline inline-flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Bevy 0.19 export migration
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/greysquirr3l/morgan-bevy/issues"
                  className="text-editor-accent hover:underline inline-flex items-center gap-2"
                >
                  <Bug className="w-3.5 h-3.5" />
                  Report a bug on GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/greysquirr3l/morgan-bevy"
                  className="text-editor-accent hover:underline inline-flex items-center gap-2"
                >
                  <Github className="w-3.5 h-3.5" />
                  Source on GitHub
                </a>
              </li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-editor-border px-6 py-3 text-xs text-editor-textMuted">
          Press{' '}
          <kbd className="px-1.5 py-0.5 bg-editor-bg rounded border border-editor-border">Esc</kbd>{' '}
          to close.
        </div>
      </div>
    </div>
  )
}
