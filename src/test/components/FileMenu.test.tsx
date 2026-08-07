/**
 * FileMenu tests — verify the recent-projects list rendering, clear
 * button, and integration with `addRecentProject`/`pruneMissingRecents`.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FileMenu from '../../components/FileMenu/FileMenu'
import {
  addRecentProject,
  clearRecentProjects,
  getRecentProjects,
} from '../../utils/recentProjects'

// Mock Tauri invoke to control project save/load.
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

// Mock the Zustand store to provide a minimal API. We do not exercise
// the editor through FileMenu — only the project save/load paths and
// the recent-projects list.
const { mockExecuteCommand, mockStore } = vi.hoisted(() => {
  const executeCommand = vi.fn()
  const state = () => ({
    executeCommand,
    sceneObjects: new Map(),
    layers: [],
    activeLayer: 'default',
    selectedObjects: [],
    gridSize: 1,
    snapToGrid: false,
    transformMode: 'select',
    coordinateSpace: 'world',
  })
  return { mockExecuteCommand: executeCommand, mockStore: state }
})
vi.mock('@/store/editorStore', () => ({
  useEditorStore: Object.assign(mockStore, {
    getState: () => mockStore(),
    setState: vi.fn(),
  }),
}))

describe('FileMenu recent-projects list', () => {
  beforeEach(() => {
    clearRecentProjects()
    mockInvoke.mockReset()
    mockExecuteCommand.mockReset()
  })

  it('does not render the recent-projects section when the list is empty', () => {
    render(<FileMenu isOpen onClose={() => {}} position={{ x: 0, y: 0 }} />)
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
  })

  it('renders a recent entry when one is present', () => {
    addRecentProject('/tmp/office.mbp', 'office.mbp')
    render(<FileMenu isOpen onClose={() => {}} position={{ x: 0, y: 0 }} />)
    expect(screen.getByText('office.mbp')).toBeInTheDocument()
  })

  it('renders multiple recent entries in order', () => {
    addRecentProject('/tmp/a.mbp', 'a.mbp')
    addRecentProject('/tmp/b.mbp', 'b.mbp')
    addRecentProject('/tmp/c.mbp', 'c.mbp')
    render(<FileMenu isOpen onClose={() => {}} position={{ x: 0, y: 0 }} />)
    const buttons = screen.getAllByText(/\.mbp$/)
    expect(buttons.map(b => b.textContent)).toEqual(['c.mbp', 'b.mbp', 'a.mbp'])
  })

  it('clear-recent button empties the list', () => {
    addRecentProject('/tmp/office.mbp', 'office.mbp')
    render(<FileMenu isOpen onClose={() => {}} position={{ x: 0, y: 0 }} />)
    expect(getRecentProjects()).toHaveLength(1)
    const clearButton = screen.getByLabelText('Clear recent projects')
    fireEvent.click(clearButton)
    expect(getRecentProjects()).toEqual([])
    expect(screen.queryByText('office.mbp')).not.toBeInTheDocument()
  })

  it('clicking a recent entry calls the load_project_from_path command', () => {
    addRecentProject('/tmp/office.mbp', 'office.mbp')
    const projectPayload = {
      schemaVersion: 1,
      scene: { objects: [], layers: [], activeLayer: 'default' },
      metadata: { name: 'office' },
    }
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'path_exists') return true
      if (cmd === 'load_project_from_path') return projectPayload
      return undefined
    })

    render(<FileMenu isOpen onClose={() => {}} position={{ x: 0, y: 0 }} />)
    fireEvent.click(screen.getByText('office.mbp'))

    // invoke is async; wait for it.
    return vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('load_project_from_path', {
        path: '/tmp/office.mbp',
      })
      expect(mockExecuteCommand).toHaveBeenCalled() // LoadCommand
    })
  })
})
