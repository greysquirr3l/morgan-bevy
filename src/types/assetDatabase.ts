// Asset Database — types and Tauri command wrappers.
//
// Types here are derived from zod schemas in ./schemas so the runtime boundary
// matches the TypeScript declaration (see docs/dev/typescript-counterintuitive-patterns.md §17).

import { z } from 'zod'
import {
  AssetSearchResultSchema,
  CollectionSchema,
  DatabaseStatsSchema,
  ScanResultSchema,
  parseInvoke,
} from './schemas'

export type AssetSearchResult = z.infer<typeof AssetSearchResultSchema>
export type Collection = z.infer<typeof CollectionSchema>
export type DatabaseStats = z.infer<typeof DatabaseStatsSchema>
export type ScanResult = z.infer<typeof ScanResultSchema>

export const AssetSearchParamsSchema = z.object({
  query: z.string(),
  asset_type: z.string().optional(),
  collection: z.string().optional(),
  limit: z.number().int().positive().optional(),
})
export type AssetSearchParams = z.infer<typeof AssetSearchParamsSchema>

export const ScanProgressSchema = z.object({
  current_file: z.string(),
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  current_collection: z.string(),
  errors: z.array(z.string()),
})
export type ScanProgress = z.infer<typeof ScanProgressSchema>

// Asset Database Service Class — every Tauri invoke result is validated via zod.
export class AssetDatabaseService {
  static async initialize(): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke('initialize_asset_database')
  }

  static async scanAssets(): Promise<ScanResult> {
    const { invoke } = await import('@tauri-apps/api/core')
    const raw = await invoke('scan_assets_database')
    return parseInvoke(ScanResultSchema, raw, 'scan_assets_database')
  }

  static async searchAssets(params: AssetSearchParams): Promise<AssetSearchResult[]> {
    const { invoke } = await import('@tauri-apps/api/core')
    AssetSearchParamsSchema.parse(params)
    const raw = await invoke('search_assets_database', { params })
    const parsed = z.array(AssetSearchResultSchema).safeParse(raw)
    if (!parsed.success) {
      throw new Error(
        `Tauri command "search_assets_database" returned an unexpected shape: ${parsed.error.message}`
      )
    }
    return parsed.data
  }

  static async getStats(): Promise<DatabaseStats> {
    const { invoke } = await import('@tauri-apps/api/core')
    const raw = await invoke('get_asset_database_stats')
    return parseInvoke(DatabaseStatsSchema, raw, 'get_asset_database_stats')
  }

  static async getCollections(): Promise<Collection[]> {
    const { invoke } = await import('@tauri-apps/api/core')
    const raw = await invoke('get_asset_collections')
    const parsed = z.array(CollectionSchema).safeParse(raw)
    if (!parsed.success) {
      throw new Error(
        `Tauri command "get_asset_collections" returned an unexpected shape: ${parsed.error.message}`
      )
    }
    return parsed.data
  }

  static async listen<T>(event: string, handler: (event: T) => void) {
    const { listen } = await import('@tauri-apps/api/event')
    return listen(event, event => {
      handler(event.payload as T)
    })
  }

  // Listen for scan progress updates
  static async onScanProgress(handler: (progress: ScanProgress) => void) {
    return this.listen('asset_scan_progress', handler)
  }
}

// Utility Functions
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

export function getAssetTypeIcon(assetType: string): string {
  switch (assetType.toLowerCase()) {
    case 'model':
      return '🎮' // or use a proper icon component
    case 'texture':
      return '🖼️'
    case 'audio':
      return '🔊'
    case 'material':
      return '⚡'
    default:
      return '📄'
  }
}

export function getCollectionDisplayName(collection: string): string {
  const displayNames: Record<string, string> = {
    Kenney: 'Kenney Free',
    KenneyPremium: 'Kenney Premium',
    TopDownEngine: 'TopDown Engine',
  }

  return displayNames[collection] || collection
}

export function getCollectionColor(collection: string): string {
  const colors: Record<string, string> = {
    Kenney: 'bg-green-100 text-green-800 border-green-200',
    KenneyPremium: 'bg-purple-100 text-purple-800 border-purple-200',
    TopDownEngine: 'bg-blue-100 text-blue-800 border-blue-200',
  }

  return colors[collection] || 'bg-gray-100 text-gray-800 border-gray-200'
}

export type AssetType = 'Model' | 'Texture' | 'Audio' | 'Material' | 'Unknown'

export interface AssetFilter {
  types: AssetType[]
  collections: string[]
  query: string
}

export const ASSET_TYPES: AssetType[] = ['Model', 'Texture', 'Audio', 'Material']
