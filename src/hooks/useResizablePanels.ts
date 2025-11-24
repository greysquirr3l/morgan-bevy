import { useCallback, useEffect, useRef, useState } from 'react'

interface ResizablePanelsState {
  leftWidth: number
  rightWidth: number
  bottomHeight: number
  isBottomCollapsed: boolean
}

export const useResizablePanels = () => {
  const [panels, setPanels] = useState<ResizablePanelsState>({
    leftWidth: 300,
    rightWidth: 320,
    bottomHeight: 120,
    isBottomCollapsed: false
  })

  const isDragging = useRef<'left' | 'right' | 'bottom' | null>(null)
  const dragStart = useRef({ x: 0, y: 0, initialWidth: 0, initialHeight: 0 })

  const handleMouseDown = useCallback((type: 'left' | 'right' | 'bottom') => (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = type
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      initialWidth: type === 'left' ? panels.leftWidth : panels.rightWidth,
      initialHeight: panels.bottomHeight
    }
  }, [panels])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return

    const deltaX = e.clientX - dragStart.current.x
    const deltaY = e.clientY - dragStart.current.y

    setPanels(prev => {
      const newState = { ...prev }

      switch (isDragging.current) {
        case 'left':
          newState.leftWidth = Math.max(200, Math.min(500, dragStart.current.initialWidth + deltaX))
          break
        case 'right':
          newState.rightWidth = Math.max(250, Math.min(600, dragStart.current.initialWidth - deltaX))
          break
        case 'bottom':
          newState.bottomHeight = Math.max(80, Math.min(300, dragStart.current.initialHeight - deltaY))
          break
      }

      return newState
    })
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = null
  }, [])

  const toggleBottomPanel = useCallback(() => {
    setPanels(prev => ({
      ...prev,
      isBottomCollapsed: !prev.isBottomCollapsed
    }))
  }, [])

  useEffect(() => {
    if (isDragging.current) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = isDragging.current === 'bottom' ? 'row-resize' : 'col-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [handleMouseMove, handleMouseUp])

  return {
    panels,
    handleMouseDown,
    toggleBottomPanel,
    isDragging: isDragging.current !== null
  }
}