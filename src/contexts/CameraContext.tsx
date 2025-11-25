import React, { createContext, useContext, useRef, RefObject } from 'react'
import { CameraControlsRef } from '@/components/Viewport3D/Viewport3D'

interface CameraContextType {
  cameraControlsRef: RefObject<CameraControlsRef>
}

const CameraContext = createContext<CameraContextType | null>(null)

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const cameraControlsRef = useRef<CameraControlsRef>(null)

  return (
    <CameraContext.Provider value={{ cameraControlsRef }}>
      {children}
    </CameraContext.Provider>
  )
}

export function useCameraContext() {
  const context = useContext(CameraContext)
  if (!context) {
    throw new Error('useCameraContext must be used within a CameraProvider')
  }
  return context
}