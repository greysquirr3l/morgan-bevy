import React from 'react'
import { useTransformConstraints } from '@/utils/transformConstraints'
import { Lock } from 'lucide-react'

export default function TransformConstraintIndicator() {
  const { isActive, getVisualIndicator } = useTransformConstraints()
  
  if (!isActive) {
    return null
  }

  const indicator = getVisualIndicator()
  if (!indicator) {
    return null
  }

  return (
    <div 
      className="absolute top-2 right-2 px-3 py-1 rounded-md text-sm font-medium z-30"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: indicator.color,
        border: `1px solid ${indicator.color}`,
        backdropFilter: 'blur(4px)'
      }}
    >
      <Lock className="w-3 h-3 mr-1" /> {indicator.text}
    </div>
  )
}