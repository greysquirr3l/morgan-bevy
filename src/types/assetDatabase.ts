// Asset Database Types for Frontend Integration

export interface AssetRecord {
  id: number;
  name: string;
  file_path: string;
  asset_type: string;
  collection: string;
  file_size: number;
  checksum: string;
  created_at: string;
  updated_at: string;
}

export interface AssetMetadata {
  asset_id: number;
  key: string;
  value: string;
}

export interface Collection {
  id: number;
  name: string;
  description?: string;
  license_info?: string;
  asset_count: number;
}

export interface ThumbnailRecord {
  asset_id: number;
  thumbnail_path: string;
  generated_at: string;
}

export interface AssetSearchResult {
  asset: AssetRecord;
  metadata: AssetMetadata[];
  has_thumbnail: boolean;
}

export interface AssetSearchParams {
  query: string;
  asset_type?: string;
  collection?: string;
  limit?: number;
}

export interface ScanProgress {
  current_file: string;
  processed: number;
  total: number;
  current_collection: string;
  errors: string[];
}

export interface ScanResult {
  total_assets: number;
  collections_found: string[];
  assets_by_type: Record<string, number>;
  scan_duration_ms: number;
  errors: string[];
}

export interface DatabaseStats {
  total_assets: number;
  total_collections: number;
  assets_by_type: Record<string, number>;
  total_size_bytes: number;
  collections: Record<string, number>;
}

// Asset Database Service Class
export class AssetDatabaseService {
  static async initialize(): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('initialize_asset_database');
  }

  static async scanAssets(): Promise<ScanResult> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('scan_assets_database');
  }

  static async searchAssets(params: AssetSearchParams): Promise<AssetSearchResult[]> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('search_assets_database', { params });
  }

  static async getStats(): Promise<DatabaseStats> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('get_asset_database_stats');
  }

  static async getCollections(): Promise<Collection[]> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('get_asset_collections');
  }

  static async listen<T>(event: string, handler: (event: T) => void) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen(event, (event) => {
      handler(event.payload as T);
    });
  }

  // Listen for scan progress updates
  static async onScanProgress(handler: (progress: ScanProgress) => void) {
    return this.listen('asset_scan_progress', handler);
  }
}

// Utility Functions
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function getAssetTypeIcon(assetType: string): string {
  switch (assetType.toLowerCase()) {
    case 'model':
      return '🎮'; // or use a proper icon component
    case 'texture':
      return '🖼️';
    case 'audio':
      return '🔊';
    case 'material':
      return '⚡';
    default:
      return '📄';
  }
}

export function getCollectionDisplayName(collection: string): string {
  const displayNames: Record<string, string> = {
    'Kenney': 'Kenney Free',
    'KenneyPremium': 'Kenney Premium',
    'TopDownEngine': 'TopDown Engine',
  };
  
  return displayNames[collection] || collection;
}

export function getCollectionColor(collection: string): string {
  const colors: Record<string, string> = {
    'Kenney': 'bg-green-100 text-green-800 border-green-200',
    'KenneyPremium': 'bg-purple-100 text-purple-800 border-purple-200',
    'TopDownEngine': 'bg-blue-100 text-blue-800 border-blue-200',
  };
  
  return colors[collection] || 'bg-gray-100 text-gray-800 border-gray-200';
}

export type AssetType = 'Model' | 'Texture' | 'Audio' | 'Material' | 'Unknown';

export interface AssetFilter {
  types: AssetType[];
  collections: string[];
  query: string;
}

export const ASSET_TYPES: AssetType[] = ['Model', 'Texture', 'Audio', 'Material'];