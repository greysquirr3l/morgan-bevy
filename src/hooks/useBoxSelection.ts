import { useState, useCallback } from 'react'
import * as THREE from 'three'

interface BoxSelectionState {
  isSelecting: boolean
  startPoint: THREE.Vector2
  currentPoint: THREE.Vector2
}

export function useBoxSelection() {
  const [boxState, setBoxState] = useState<BoxSelectionState>({
    isSelecting: false,
    startPoint: new THREE.Vector2(),
    currentPoint: new THREE.Vector2(),
  })

  const startSelection = useCallback((x: number, y: number) => {
    setBoxState({
      isSelecting: true,
      startPoint: new THREE.Vector2(x, y),
      currentPoint: new THREE.Vector2(x, y),
    })
  }, [])

  const updateSelection = useCallback((x: number, y: number) => {
    setBoxState(prev => ({
      ...prev,
      currentPoint: new THREE.Vector2(x, y),
    }))
  }, [])

  const endSelection = useCallback(() => {
    setBoxState({
      isSelecting: false,
      startPoint: new THREE.Vector2(),
      currentPoint: new THREE.Vector2(),
    })
  }, [])

  return {
    boxState,
    startSelection,
    updateSelection,
    endSelection,
  }
}