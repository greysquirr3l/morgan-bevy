import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: false,
    // .claude/worktrees holds nested checkouts (each with its own node_modules) used by
    // isolated subagent runs — without this exclude, vitest's default glob picks up their
    // test files too and mounts two copies of React in the same process.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/.claude/**'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/', 'src-tauri/'],
    },
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})