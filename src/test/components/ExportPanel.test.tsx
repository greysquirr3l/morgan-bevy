/**
 * T78 regression — `ExportPanel` built its payload and object counter
 * with `Object.values`/`Object.keys(sceneObjects)`, both of which
 * return `[]`/`{}` for a `Map`. That meant: the export payload always
 * contained zero objects, the on-screen counter always read 0, and
 * the "Export Level" button — disabled via
 * `Object.keys(sceneObjects).length === 0` — was permanently
 * disabled the moment the store migrated to a Map, regardless of
 * scene content.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

import ExportPanel from '@/components/ExportPanel/ExportPanel'
import { useEditorStore, type SceneObject } from '@/store/editorStore'
import { LayerId, ObjectId } from '@/types/brand'

function makeObject(id: ObjectId): SceneObject {
  return {
    id,
    name: id,
    type: 'mesh',
    meshType: 'cube',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    layerId: LayerId('default'),
    children: [],
  }
}

describe('ExportPanel', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockInvoke.mockResolvedValue({
      exported_files: [],
      total_objects: 0,
      export_time_ms: 0,
      errors: [],
      warnings: [],
    })
    useEditorStore.setState({ sceneObjects: new Map() })
  })

  it('shows a zero count and a disabled export button for an empty scene', () => {
    render(<ExportPanel />)
    expect(screen.getByText('Objects: 0')).toBeInTheDocument()
    expect(screen.getByText('Export Level').closest('button')).toBeDisabled()
  })

  it('reflects the real object count and enables export once the scene has objects', () => {
    useEditorStore.setState(state => {
      state.sceneObjects.set(ObjectId('count_one'), makeObject(ObjectId('count_one')))
      state.sceneObjects.set(ObjectId('count_two'), makeObject(ObjectId('count_two')))
    })
    render(<ExportPanel />)
    expect(screen.getByText('Objects: 2')).toBeInTheDocument()
    expect(screen.getByText('Export Level').closest('button')).not.toBeDisabled()
  })

  it('the export payload contains every scene object, not zero', async () => {
    const ids = [ObjectId('exp_one'), ObjectId('exp_two'), ObjectId('exp_three')]
    useEditorStore.setState(state => {
      for (const id of ids) state.sceneObjects.set(id, makeObject(id))
    })

    render(<ExportPanel />)
    fireEvent.change(screen.getByPlaceholderText('Select output directory...'), {
      target: { value: '/tmp/export-out' },
    })
    fireEvent.click(screen.getByText('Export Level'))

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('export_level', expect.anything()))

    const [, args] = mockInvoke.mock.calls[0] as [string, { levelData: { objects: Array<{ id: string }> } }]
    expect(args.levelData.objects).toHaveLength(ids.length)
    expect(args.levelData.objects.map(o => o.id).sort()).toEqual([...ids].sort())
  })
})
