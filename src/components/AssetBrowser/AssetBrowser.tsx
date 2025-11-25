import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Search,
  Filter,
  RefreshCw,
  Folder,
  FileText,
  Image,
  Volume2,
  Box,
  BarChart3,
  Database,
  Clock,
  HardDrive,
  Users,
  Hash
} from 'lucide-react';

// Types based on Rust backend structures
interface AssetRecord {
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

interface AssetMetadata {
  asset_id: number;
  key: string;
  value: string;
}

interface AssetSearchResult {
  asset: AssetRecord;
  metadata: AssetMetadata[];
  has_thumbnail: boolean;
}

interface Collection {
  id: number;
  name: string;
  description?: string;
  license_info?: string;
  asset_count: number;
}

interface DatabaseStats {
  total_assets: number;
  assets_by_type: Record<string, number>;
  collections: Record<string, number>;
  total_size_bytes: number;
  last_scan?: string;
}

interface ScanProgress {
  current_file: string;
  processed: number;
  total: number;
  current_collection: string;
  errors: string[];
}

interface ScanResult {
  total_assets: number;
  collections_found: string[];
  assets_by_type: Record<string, number>;
  scan_duration_ms: number;
  errors: string[];
}

interface AssetSearchParams {
  query: string;
  asset_type?: string;
  collection?: string;
  limit?: number;
}

type SortMode = 'name' | 'type' | 'size' | 'date';

interface AssetBrowserProps {
  hideHeader?: boolean;
}

export default function AssetBrowser({ hideHeader = false }: AssetBrowserProps) {
  // State management
  const [assets, setAssets] = useState<AssetSearchResult[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [searchParams, setSearchParams] = useState<AssetSearchParams>({
    query: '',
    asset_type: undefined,
    collection: undefined,
    limit: 100
  });
  
  // UI state
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [selectedAssets, setSelectedAssets] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(true);

  // Initialize database and load initial data
  useEffect(() => {
    initializeDatabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeDatabase = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Initialize the database
      await invoke('initialize_asset_database');
      
      // Load initial data
      await Promise.all([
        loadAssets(),
        loadCollections(),
        loadStats()
      ]);
      
    } catch (error) {
      console.error('Failed to initialize asset database:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize database');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAssets = useCallback(async () => {
    try {
      setError(null);
      const results: AssetSearchResult[] = await invoke('search_assets_database', {
        params: searchParams
      });
      
      // Sort results
      const sortedResults = [...results].sort((a, b) => {
        switch (sortMode) {
          case 'name':
            return a.asset.name.localeCompare(b.asset.name);
          case 'type':
            return a.asset.asset_type.localeCompare(b.asset.asset_type);
          case 'size':
            return b.asset.file_size - a.asset.file_size;
          case 'date':
            return new Date(b.asset.updated_at).getTime() - new Date(a.asset.updated_at).getTime();
          default:
            return 0;
        }
      });
      
      setAssets(sortedResults);
    } catch (error) {
      console.error('Failed to load assets:', error);
      setError(error instanceof Error ? error.message : 'Failed to load assets');
    }
  }, [searchParams, sortMode]);

  const loadCollections = async () => {
    try {
      const collections: Collection[] = await invoke('get_asset_collections');
      setCollections(collections);
    } catch (error) {
      console.error('Failed to load collections:', error);
    }
  };

  const loadStats = async () => {
    try {
      const stats: DatabaseStats = await invoke('get_asset_database_stats');
      setStats(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const scanAssets = async () => {
    try {
      setIsScanning(true);
      setError(null);
      setScanProgress(null);
      
      // Listen for progress updates
      // In a real implementation, you'd set up event listeners for scan progress
      
      const result: ScanResult = await invoke('scan_assets_database');
      
      // Refresh data after scan
      await Promise.all([
        loadAssets(),
        loadCollections(),
        loadStats()
      ]);
      
      console.log('Scan completed:', result);
    } catch (error) {
      console.error('Asset scan failed:', error);
      setError(error instanceof Error ? error.message : 'Asset scan failed');
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  // Update search when parameters change
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleSearch = (query: string) => {
    setSearchParams(prev => ({ ...prev, query }));
  };

  const handleFilterChange = (key: keyof AssetSearchParams, value: any) => {
    setSearchParams(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setSearchParams({
      query: '',
      asset_type: undefined,
      collection: undefined,
      limit: 100
    });
  };

  const handleAssetSelection = (assetId: number, multiSelect: boolean = false) => {
    setSelectedAssets(prev => {
      const newSelection = new Set(prev);
      
      if (multiSelect) {
        if (newSelection.has(assetId)) {
          newSelection.delete(assetId);
        } else {
          newSelection.add(assetId);
        }
      } else {
        newSelection.clear();
        newSelection.add(assetId);
      }
      
      return newSelection;
    });
  };

  const handleAssetDragStart = (asset: AssetRecord, event: React.DragEvent) => {
    const dragData = {
      id: asset.id,
      name: asset.name,
      path: asset.file_path,
      type: asset.asset_type,
      isAsset: true,
      meshPath: asset.file_path,
      defaultMaterial: 'default'
    };
    
    event.dataTransfer.setData('application/json', JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = 'copy';
  };

  const getAssetIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'model':
        return <Box className="w-5 h-5" />;
      case 'texture':
        return <Image className="w-5 h-5" />;
      case 'audio':
        return <Volume2 className="w-5 h-5" />;
      case 'material':
        return <FileText className="w-5 h-5" />;
      default:
        return <Folder className="w-5 h-5" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(size < 100 ? 1 : 0)} ${units[unitIndex]}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'model':
        return 'text-blue-400';
      case 'texture':
        return 'text-green-400';
      case 'audio':
        return 'text-purple-400';
      case 'material':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const assetTypes = ['Model', 'Texture', 'Audio', 'Material'];

  return (
    <div className="flex flex-col h-full bg-editor-panel text-editor-text">
      {/* Header with stats and controls - only show if not hiding header */}
      {!hideHeader && (
        <div className="border-b border-editor-border">
          {/* Main toolbar */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold flex items-center">
                <Database className="w-5 h-5 mr-2" />
                Assets
              </h2>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowStats(!showStats)}
                className="p-2 hover:bg-editor-hover rounded text-editor-textMuted"
                title="Toggle Statistics"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 hover:bg-editor-hover rounded text-editor-textMuted"
                title="Toggle Filters"
              >
                <Filter className="w-4 h-4" />
              </button>
              <button
                onClick={scanAssets}
                disabled={isScanning}
                className="p-2 bg-editor-accent hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white flex items-center"
                title="Rescan Assets"
              >
                <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Statistics panel */}
          {showStats && stats && (
            <div className="px-4 py-3 bg-editor-bg border-t border-editor-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-1" title="Total number of assets in the database">
                  <Hash className="w-4 h-4 text-blue-400" />
                  <span className="font-medium">{stats.total_assets.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-1" title="Total storage space used by all assets">
                  <HardDrive className="w-4 h-4 text-green-400" />
                  <span className="font-medium">{formatFileSize(stats.total_size_bytes)}</span>
                </div>
                <div className="flex items-center space-x-1" title="Number of asset collections available">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span className="font-medium">{Object.keys(stats.collections).length}</span>
                </div>
                <div className="flex items-center space-x-1" title="When the asset database was last scanned">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="font-medium">
                    {stats.last_scan ? formatDate(stats.last_scan) : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Search and filters */}
          <div className="px-4 py-3">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-editor-textMuted" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchParams.query}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-editor-bg border border-editor-border rounded text-editor-text placeholder-editor-textMuted focus:outline-none focus:border-editor-accent"
              />
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {/* Type filter */}
                <select
                  value={searchParams.asset_type || ''}
                  onChange={(e) => handleFilterChange('asset_type', e.target.value || undefined)}
                  className="px-3 py-1 bg-editor-bg border border-editor-border rounded text-sm text-editor-text"
                >
                  <option value="">All Types</option>
                  {assetTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>

                {/* Collection filter */}
                <select
                  value={searchParams.collection || ''}
                  onChange={(e) => handleFilterChange('collection', e.target.value || undefined)}
                  className="px-3 py-1 bg-editor-bg border border-editor-border rounded text-sm text-editor-text"
                >
                  <option value="">All Collections</option>
                  {collections.map(collection => (
                    <option key={collection.id} value={collection.name}>
                      {collection.name} ({collection.asset_count})
                    </option>
                  ))}
                </select>

                {/* Sort */}
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="px-3 py-1 bg-editor-bg border border-editor-border rounded text-sm text-editor-text"
                >
                  <option value="name">Sort by Name</option>
                  <option value="type">Sort by Type</option>
                  <option value="size">Sort by Size</option>
                  <option value="date">Sort by Date</option>
                </select>

                {/* Clear filters */}
                <button
                  onClick={clearFilters}
                  className="px-3 py-1 text-sm text-editor-textMuted hover:text-editor-text"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scan progress */}
      {isScanning && scanProgress && (
        <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <div className="text-sm">
            <div className="flex justify-between mb-1">
              <span>Scanning: {scanProgress.current_collection}</span>
              <span>{scanProgress.processed} / {scanProgress.total}</span>
            </div>
            <div className="w-full bg-editor-border rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full transition-all"
                style={{ width: `${(scanProgress.processed / scanProgress.total) * 100}%` }}
              />
            </div>
            <div className="text-xs text-editor-textMuted mt-1 truncate">
              {scanProgress.current_file}
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* Asset grid/list */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-editor-textMuted" />
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Database className="w-12 h-12 mb-4 text-editor-textMuted" />
            <div className="text-lg font-medium mb-2">No Assets Found</div>
            <div className="text-editor-textMuted mb-4">
              {searchParams.query || searchParams.asset_type || searchParams.collection
                ? 'Try adjusting your search or filters'
                : 'Scan your asset directory to get started'
              }
            </div>
            <button
              onClick={scanAssets}
              className="px-4 py-2 bg-editor-accent hover:bg-blue-600 rounded text-white"
            >
              Scan Assets
            </button>
          </div>
        ) : (
          <div className="p-2">
            {/* Compact list view optimized for panels */}
            <div className="space-y-1">
              {assets.map(result => (
                <div
                  key={result.asset.id}
                  draggable
                  onDragStart={(e) => handleAssetDragStart(result.asset, e)}
                  onClick={(e) => handleAssetSelection(result.asset.id, e.ctrlKey || e.metaKey)}
                  className={[
                    'p-2 rounded cursor-grab hover:bg-editor-hover flex items-center space-x-2 text-sm',
                    selectedAssets.has(result.asset.id) 
                      ? 'bg-editor-accent/20 border border-editor-accent' 
                      : 'border border-transparent hover:border-editor-border',
                    'transition-all duration-150'
                  ].join(' ')}
                  title={`${result.asset.name}\nPath: ${result.asset.file_path}\nSize: ${formatFileSize(result.asset.file_size)}\nType: ${result.asset.asset_type}\nCollection: ${result.asset.collection}`}
                >
                  {/* Asset icon */}
                  <div className={`flex-shrink-0 ${getTypeColor(result.asset.asset_type)}`}>
                    {getAssetIcon(result.asset.asset_type)}
                  </div>
                  
                  {/* Asset info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-editor-text">
                      {result.asset.name}
                    </div>
                    <div className="text-xs text-editor-textMuted truncate flex items-center space-x-2">
                      <span className={`px-1 py-0.5 rounded text-xs ${getTypeColor(result.asset.asset_type)} bg-current/10`}>
                        {result.asset.asset_type}
                      </span>
                      <span>•</span>
                      <span>{formatFileSize(result.asset.file_size)}</span>
                    </div>
                  </div>
                  
                  {/* Quick info */}
                  <div className="flex-shrink-0 text-xs text-editor-textMuted">
                    {result.asset.collection}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selection info */}
      {selectedAssets.size > 0 && (
        <div className="px-4 py-2 bg-editor-bg border-t border-editor-border text-sm">
          {selectedAssets.size} asset{selectedAssets.size !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}