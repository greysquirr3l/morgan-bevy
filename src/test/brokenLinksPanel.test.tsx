/**
 * T34 — Broken Links panel.
 *
 * The panel reads `missingAssetRefs` from the editor store and
 * renders one row per missing ref, with dismiss-all + per-row
 * dismiss. It returns `null` when the list is empty so the Assets
 * panel doesn't show a permanent banner.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BrokenLinksPanel from '@/components/AssetsPanel/BrokenLinksPanel'
import { useEditorStore } from '@/store/editorStore'
import { AssetId } from '@/types/brand'

function resetStore(): void {
  useEditorStore.setState({
    missingAssetRefs: [],
  })
}

beforeEach(resetStore)

describe('T34 BrokenLinksPanel', () => {
  it('renders nothing when missingAssetRefs is empty', () => {
    useEditorStore.setState({ missingAssetRefs: [] })
    const { container } = render(<BrokenLinksPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one row per missing ref with the count', () => {
    useEditorStore.setState({
      missingAssetRefs: [AssetId('wall.png'), AssetId('floor.png')],
    })
    render(<BrokenLinksPanel />)
    expect(screen.getByTestId('broken-links-panel')).toBeInTheDocument()
    expect(screen.getByText(/Broken Links \(2\)/)).toBeInTheDocument()
    const rows = screen.getAllByTestId('broken-link-row')
    expect(rows).toHaveLength(2)
  })

  it('dismissing a single row calls setMissingAssetRefs with the filtered list', () => {
    useEditorStore.setState({
      missingAssetRefs: [AssetId('wall.png'), AssetId('floor.png')],
    })
    render(<BrokenLinksPanel />)
    // The per-row buttons carry aria-label="Dismiss <ref>"; the
    // "Dismiss all" button is plain text. Filter to the row
    // buttons specifically.
    const rowButtons = screen
      .getAllByRole('button')
      .filter(b => b.getAttribute('aria-label')?.startsWith('Dismiss '))
    expect(rowButtons).toHaveLength(2)
    fireEvent.click(rowButtons[0])
    expect(useEditorStore.getState().missingAssetRefs).toEqual([AssetId('floor.png')])
  })

  it('dismissing all clears the list', () => {
    useEditorStore.setState({
      missingAssetRefs: [AssetId('a.png'), AssetId('b.png'), AssetId('c.png')],
    })
    render(<BrokenLinksPanel />)
    fireEvent.click(screen.getByText('Dismiss all'))
    expect(useEditorStore.getState().missingAssetRefs).toEqual([])
  })

  it('prop overrides bypass the store (used by tests)', () => {
    const onDismiss = vi.fn()
    const onDismissAll = vi.fn()
    render(
      <BrokenLinksPanel
        missingRefs={[AssetId('x.png')]}
        onDismiss={onDismiss}
        onDismissAll={onDismissAll}
      />
    )
    fireEvent.click(screen.getByText('Dismiss all'))
    expect(onDismissAll).toHaveBeenCalledOnce()
    expect(useEditorStore.getState().missingAssetRefs).toEqual([])

    const row = screen.getByTestId('broken-link-row')
    const button = row.querySelector('button')!
    fireEvent.click(button)
    expect(onDismiss).toHaveBeenCalledWith(AssetId('x.png'))
  })
})
