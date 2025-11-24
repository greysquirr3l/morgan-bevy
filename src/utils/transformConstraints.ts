// Transform constraints system for axis locking during transforms
import React from 'react'
import * as THREE from 'three'
import { useEditorStore } from '@/store/editorStore'

export type AxisConstraint = 'none' | 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz'

interface TransformConstraintState {
  activeConstraint: AxisConstraint
  isConstraintActive: boolean
}

class TransformConstraintManager {
  private static instance: TransformConstraintManager
  private state: TransformConstraintState = {
    activeConstraint: 'none',
    isConstraintActive: false
  }
  private listeners: Array<(state: TransformConstraintState) => void> = []
  
  static getInstance(): TransformConstraintManager {
    if (!TransformConstraintManager.instance) {
      TransformConstraintManager.instance = new TransformConstraintManager()
    }
    return TransformConstraintManager.instance
  }

  // Set axis constraint
  setConstraint(constraint: AxisConstraint): void {
    this.state = {
      activeConstraint: constraint,
      isConstraintActive: constraint !== 'none'
    }
    this.notifyListeners()
  }

  // Clear all constraints
  clearConstraint(): void {
    this.state = {
      activeConstraint: 'none',
      isConstraintActive: false
    }
    this.notifyListeners()
  }

  // Get current constraint state
  getState(): TransformConstraintState {
    return { ...this.state }
  }

  // Subscribe to constraint changes
  subscribe(listener: (state: TransformConstraintState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state))
  }

  // Apply constraint to a vector
  applyConstraint(vector: THREE.Vector3, constraint?: AxisConstraint): THREE.Vector3 {
    const activeConstraint = constraint || this.state.activeConstraint
    
    if (activeConstraint === 'none' || !this.state.isConstraintActive) {
      return vector
    }

    const constrained = vector.clone()

    switch (activeConstraint) {
      case 'x':
        constrained.y = 0
        constrained.z = 0
        break
      case 'y':
        constrained.x = 0
        constrained.z = 0
        break
      case 'z':
        constrained.x = 0
        constrained.y = 0
        break
      case 'xy':
        constrained.z = 0
        break
      case 'xz':
        constrained.y = 0
        break
      case 'yz':
        constrained.x = 0
        break
    }

    return constrained
  }

  // Apply constraint to euler rotation
  applyRotationConstraint(euler: THREE.Euler, constraint?: AxisConstraint): THREE.Euler {
    const activeConstraint = constraint || this.state.activeConstraint
    
    if (activeConstraint === 'none' || !this.state.isConstraintActive) {
      return euler
    }

    const constrained = euler.clone()

    switch (activeConstraint) {
      case 'x':
        constrained.y = 0
        constrained.z = 0
        break
      case 'y':
        constrained.x = 0
        constrained.z = 0
        break
      case 'z':
        constrained.x = 0
        constrained.y = 0
        break
      // For rotation, plane constraints (xy, xz, yz) work differently
      case 'xy':
        constrained.z = 0 // No Z rotation
        break
      case 'xz':
        constrained.y = 0 // No Y rotation
        break
      case 'yz':
        constrained.x = 0 // No X rotation
        break
    }

    return constrained
  }

  // Handle keyboard input for constraints
  handleKeyInput(key: string, isPressed: boolean): boolean {
    const { transformMode } = useEditorStore.getState()
    
    // Only handle constraints during transform operations
    if (transformMode === 'select') {
      return false
    }

    if (isPressed) {
      switch (key.toLowerCase()) {
        case 'x':
          this.setConstraint('x')
          return true
        case 'y':
          this.setConstraint('y')
          return true
        case 'z':
          this.setConstraint('z')
          return true
        case 'shift+x':
          this.setConstraint('yz') // Constrain to YZ plane (exclude X)
          return true
        case 'shift+y':
          this.setConstraint('xz') // Constrain to XZ plane (exclude Y)
          return true
        case 'shift+z':
          this.setConstraint('xy') // Constrain to XY plane (exclude Z)
          return true
        case 'escape':
          this.clearConstraint()
          return true
      }
    } else {
      // Key released - for now, keep constraints active until escape or mode change
      return false
    }

    return false
  }

  // Get visual indicators for current constraint
  getVisualIndicator(): { text: string; color: string } | null {
    if (!this.state.isConstraintActive) {
      return null
    }

    const colors = {
      x: '#ff4444', // Red
      y: '#44ff44', // Green
      z: '#4444ff', // Blue
      xy: '#ffff44', // Yellow
      xz: '#ff44ff', // Magenta
      yz: '#44ffff'  // Cyan
    }

    const labels = {
      x: 'X-Axis',
      y: 'Y-Axis', 
      z: 'Z-Axis',
      xy: 'XY-Plane',
      xz: 'XZ-Plane',
      yz: 'YZ-Plane'
    }

    return {
      text: labels[this.state.activeConstraint as keyof typeof labels] || 'Unknown',
      color: colors[this.state.activeConstraint as keyof typeof colors] || '#ffffff'
    }
  }
}

export const transformConstraints = TransformConstraintManager.getInstance()

// React hook for using transform constraints
export function useTransformConstraints() {
  const [state, setState] = React.useState(transformConstraints.getState())

  React.useEffect(() => {
    return transformConstraints.subscribe(setState)
  }, [])

  return {
    constraint: state.activeConstraint,
    isActive: state.isConstraintActive,
    setConstraint: transformConstraints.setConstraint.bind(transformConstraints),
    clearConstraint: transformConstraints.clearConstraint.bind(transformConstraints),
    applyConstraint: transformConstraints.applyConstraint.bind(transformConstraints),
    getVisualIndicator: transformConstraints.getVisualIndicator.bind(transformConstraints)
  }
}

// Add to keyboard shortcuts
export function addConstraintKeyHandlers(): void {
  const handleKeyDown = (event: KeyboardEvent) => {
    const key = event.shiftKey ? `shift+${event.key.toLowerCase()}` : event.key.toLowerCase()
    if (transformConstraints.handleKeyInput(key, true)) {
      event.preventDefault()
    }
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    const key = event.shiftKey ? `shift+${event.key.toLowerCase()}` : event.key.toLowerCase()
    transformConstraints.handleKeyInput(key, false)
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  return () => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  }
}