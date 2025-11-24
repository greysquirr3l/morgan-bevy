import { useCallback, useEffect, useRef, useState } from 'react'

interface ResizablePanelsState {
  leftWidth: number
  rightWidth: number
  leftVisible: boolean
  rightVisible: boolean
}

export const useResizablePanels = () => {
  const [panels, setPanels] = useState<ResizablePanelsState>({
    leftWidth: 300,
    rightWidth: 300,
    leftVisible: true,
    rightVisible: true
  })

  const isDragging = useRef<'left' | 'right' | null>(null)
  const dragStart = useRef({ x: 0, y: 0, initialWidth: 0, initialHeight: 0 })

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return

    const deltaX = e.clientX - dragStart.current.x
    const screenWidth = window.innerWidth

    setPanels(prev => {
      const newState = { ...prev }

      switch (isDragging.current) {
        case 'left': {
          const maxLeftWidth = screenWidth - (prev.rightVisible ? prev.rightWidth + 1 : 0) - 400 // Reserve 400px for center
          newState.leftWidth = Math.max(180, Math.min(maxLeftWidth, dragStart.current.initialWidth + deltaX))
          break
        }
        case 'right': {
          const maxRightWidth = screenWidth - (prev.leftVisible ? prev.leftWidth + 1 : 0) - 400 // Reserve 400px for center
          newState.rightWidth = Math.max(250, Math.min(maxRightWidth, dragStart.current.initialWidth - deltaX))
          break
        }
      }

      return newState
    })
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = null
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [handleMouseMove])

  const handleMouseDown = useCallback((type: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = type
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      initialWidth: type === 'left' ? panels.leftWidth : panels.rightWidth,
      initialHeight: 0
    }
    
    // Immediately add event listeners to ensure proper capture
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [panels, handleMouseMove, handleMouseUp])

  const toggleLeftPanel = useCallback(() => {
    setPanels(prev => ({ ...prev, leftVisible: !prev.leftVisible }))
  }, [])

  const toggleRightPanel = useCallback(() => {
    setPanels(prev => ({ ...prev, rightVisible: !prev.rightVisible }))
  }, [])

  // Calculate center width based on screen and panel visibility
  const getCenterWidth = useCallback(() => {
    const screenWidth = window.innerWidth
    const leftWidth = panels.leftVisible ? panels.leftWidth + 1 : 0 // +1 for handle
    const rightWidth = panels.rightVisible ? panels.rightWidth + 1 : 0 // +1 for handle
    return Math.max(400, screenWidth - leftWidth - rightWidth) // Ensure minimum center width
  }, [panels.leftVisible, panels.leftWidth, panels.rightVisible, panels.rightWidth])

  // Handle window resize to recalculate layout
  useEffect(() => {
    const handleWindowResize = () => {
      // Force a re-render when window resizes
      setPanels(prev => ({ ...prev }))
    }
    
    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [])

  return {
    panels,
    handleMouseDown,
    toggleLeftPanel,
    toggleRightPanel,
    getCenterWidth,
    isDragging: isDragging.current !== null
  }
}