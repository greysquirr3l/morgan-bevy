// Performance optimization exports
export { 
  useLOD, 
  LODSphereGeometry, 
  LODBoxGeometry, 
  LODConeGeometry,
  DEFAULT_LOD_LEVELS 
} from './LevelOfDetail'

export { 
  useFrustumCulling, 
  useBoundingBoxCulling, 
  usePerformanceCulling 
} from './FrustumCulling'

export { 
  useInstancedRendering,
  InstancedCubes,
  InstancedSpheres, 
  InstancedCones,
  InstancedObjectManager 
} from './InstancedRendering'

export { 
  useSelectionHighlight,
  SelectionHighlight,
  useSelectionManager 
} from './SelectionOptimization'

export { 
  usePerformanceManager,
  useAdaptiveQuality,
  usePerformanceDebug 
} from './PerformanceManager'

export type { 
  LODLevel 
} from './LevelOfDetail'

export type { 
  InstancedObjectData 
} from './InstancedRendering'

export type { 
  PerformanceObject 
} from './PerformanceManager'