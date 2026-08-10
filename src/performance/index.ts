// Performance optimization exports
export {
  DEFAULT_LOD_LEVELS,
  LODBoxGeometry,
  LODConeGeometry,
  LODSphereGeometry,
  useLOD,
} from './LevelOfDetail'

export {
  useBoundingBoxCulling,
  useFrustumCulling,
  usePerformanceCulling,
  useSpatialIndexQuery,
} from './FrustumCulling'

export {
  InstancedCones,
  InstancedCubes,
  InstancedObjectManager,
  InstancedSpheres,
  useInstancedRendering,
} from './InstancedRendering'

export {
  SelectionHighlight,
  useSelectionHighlight,
  useSelectionManager,
} from './SelectionOptimization'

export {
  useAdaptiveQuality,
  usePerformanceDebug,
  usePerformanceManager,
} from './PerformanceManager'

export type { LODLevel } from './LevelOfDetail'

export type { InstancedObjectData } from './InstancedRendering'

export type { PerformanceObject } from './PerformanceManager'
