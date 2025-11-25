import { useState, ReactNode, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface CollapsiblePanelProps {
  title: string
  children: ReactNode
  defaultExpanded?: boolean
  className?: string
  maxHeight?: string
  enableScrollbarlessScrolling?: boolean
}

export default function CollapsiblePanel({ 
  title, 
  children, 
  defaultExpanded = true, 
  className = '',
  maxHeight = '200px',
  enableScrollbarlessScrolling = false
}: CollapsiblePanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)

  // Scrollbarless scrolling implementation
  useEffect(() => {
    if (!enableScrollbarlessScrolling || !scrollRef.current) return

    let isMouseDown = false
    let startY = 0
    let scrollTop = 0

    const handleMouseDown = (e: MouseEvent) => {
      if (e.target !== scrollRef.current) return
      isMouseDown = true
      startY = e.clientY - (scrollRef.current?.offsetTop || 0)
      scrollTop = scrollRef.current?.scrollTop || 0
      setIsScrolling(true)
      e.preventDefault()
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown || !scrollRef.current) return
      e.preventDefault()
      const y = e.clientY - (scrollRef.current.offsetTop || 0)
      const deltaY = (y - startY) * 2 // Scroll speed multiplier
      scrollRef.current.scrollTop = scrollTop - deltaY
    }

    const handleMouseUp = () => {
      isMouseDown = false
      setIsScrolling(false)
    }

    const handleWheel = (e: WheelEvent) => {
      if (!scrollRef.current) return
      e.preventDefault()
      scrollRef.current.scrollTop += e.deltaY
    }

    const element = scrollRef.current
    element.addEventListener('mousedown', handleMouseDown)
    element.addEventListener('wheel', handleWheel, { passive: false })
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      element?.removeEventListener('mousedown', handleMouseDown)
      element?.removeEventListener('wheel', handleWheel)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [enableScrollbarlessScrolling])

  if (!isExpanded) {
    return (
      <div className={`bg-editor-panel border-b border-editor-border ${className}`}>
        <div className="px-4 py-2 flex justify-between items-center hover:bg-editor-border/50 cursor-pointer" onClick={() => setIsExpanded(true)}>
        <div className="text-sm font-semibold text-editor-accent">{title}</div>
          <ChevronDown className="w-4 h-4 text-editor-textMuted" />
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-editor-panel border-b border-editor-border ${className}`}>
      <div className="px-4 py-2 flex justify-between items-center hover:bg-editor-border/50 cursor-pointer" onClick={() => setIsExpanded(false)}>
        <div className="text-sm font-semibold text-editor-accent">{title}</div>
        <ChevronUp className="w-4 h-4 text-editor-textMuted" />
      </div>
      <div 
        ref={scrollRef}
        className={`${enableScrollbarlessScrolling ? 'cursor-grab' : 'overflow-y-auto scrollbar-hide'} ${isScrolling ? 'cursor-grabbing' : ''}`}
        style={{ 
          maxHeight,
          overflowY: enableScrollbarlessScrolling ? 'hidden' : 'auto'
        }}
      >
        {children}
      </div>
    </div>
  )
}