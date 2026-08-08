// T54 — UV preview/edit mode.
//
// A lightweight per-mesh UV editor: drag to pan the UV offset,
// scroll to scale. It doesn't re-unwrap the mesh (that's a much
// bigger feature) — it edits `SceneObject.uvTransform`, an affine
// offset+scale applied on top of the mesh's existing UVs, rendered
// here as a grid so panning/scaling is visible without requiring a
// texture to be bound.
import { useEditorStore } from '@/store/editorStore'
import type { ObjectId } from '@/types/brand'
import { IDENTITY_UV_TRANSFORM, panUV, zoomUV, type UVTransform } from '@/utils/uvTransform'
import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

const VIEW_SIZE = 256
const GRID_CELL_PX = 32

interface UVEditorProps {
  objectId: ObjectId
  onClose: () => void
}

export default function UVEditor({ objectId, onClose }: UVEditorProps) {
  const { object, updateObjectUVTransform } = useEditorStore(
    useShallow(s => ({
      object: s.sceneObjects.get(objectId),
      updateObjectUVTransform: s.updateObjectUVTransform,
    }))
  )

  const dragOriginRef = useRef<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const transform: UVTransform = object?.uvTransform ?? IDENTITY_UV_TRANSFORM

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragOriginRef.current = { x: event.clientX, y: event.clientY }
    setIsDragging(true)
    // Pointer Capture isn't implemented in every environment (jsdom
    // in tests, some older WebViews) — guard the call so the drag
    // still works via the window-level pointermove fallback below;
    // real browsers get the capture behaviour (keeps tracking the
    // drag even if the cursor leaves the canvas bounds).
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current
    if (!origin) return
    const dx = event.clientX - origin.x
    const dy = event.clientY - origin.y
    dragOriginRef.current = { x: event.clientX, y: event.clientY }
    updateObjectUVTransform(objectId, panUV(transform, dx, dy, VIEW_SIZE))
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragOriginRef.current = null
    setIsDragging(false)
    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    updateObjectUVTransform(objectId, zoomUV(transform, event.deltaY))
  }

  const handleReset = () => updateObjectUVTransform(objectId, IDENTITY_UV_TRANSFORM)

  if (!object) return null

  // The grid cell size shrinks/grows with scale and the grid's
  // background-position tracks the offset — both directly visualise
  // the transform without needing a bound texture.
  const cellPx = GRID_CELL_PX * transform.scaleX
  const offsetPxX = transform.offsetX * VIEW_SIZE
  const offsetPxY = transform.offsetY * VIEW_SIZE

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      data-testid="uv-editor-overlay"
    >
      <div
        className="bg-editor-panel border border-editor-border rounded-lg p-3 shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-white">UV Editor — {object.name}</h4>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10"
            aria-label="Close UV editor"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div
          className="relative border border-editor-border rounded overflow-hidden cursor-move select-none"
          style={{ width: VIEW_SIZE, height: VIEW_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={handleWheel}
          data-testid="uv-editor-canvas"
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(#3f3f46 1px, transparent 1px), linear-gradient(90deg, #3f3f46 1px, transparent 1px)',
              backgroundSize: `${cellPx}px ${cellPx}px`,
              backgroundPosition: `${offsetPxX}px ${offsetPxY}px`,
              backgroundColor: '#18181b',
            }}
          />
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-editor-textMuted">
          <span>
            Offset {transform.offsetX.toFixed(2)}, {transform.offsetY.toFixed(2)} · Scale{' '}
            {transform.scaleX.toFixed(2)}x{isDragging ? ' · dragging…' : ''}
          </span>
          <button
            onClick={handleReset}
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20"
          >
            Reset
          </button>
        </div>
        <p className="mt-1 text-[10px] text-editor-textMuted">
          Drag to offset UVs · Scroll to scale.
        </p>
      </div>
    </div>
  )
}
