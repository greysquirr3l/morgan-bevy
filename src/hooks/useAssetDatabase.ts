import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AssetDatabaseService,
  AssetSearchResult,
  AssetSearchParams,
  DatabaseStats,
  Collection,
  ScanProgress,
  ScanResult,
  AssetFilter,
} from '../types/assetDatabase';

interface AssetDatabaseState {
  // Database status
  initialized: boolean;
  scanning: boolean;
  error: string | null;
  
  // Search and results
  searchQuery: string;
  searchResults: AssetSearchResult[];
  filter: AssetFilter;
  
  // Database info
  stats: DatabaseStats | null;
  collections: Collection[];
  
  // Scan progress
  scanProgress: ScanProgress | null;
  lastScanResult: ScanResult | null;
}

const initialState: AssetDatabaseState = {
  initialized: false,
  scanning: false,
  error: null,
  searchQuery: '',
  searchResults: [],
  filter: {
    types: [],
    collections: [],
    query: '',
  },
  stats: null,
  collections: [],
  scanProgress: null,
  lastScanResult: null,
};

export function useAssetDatabase() {
  const [state, setState] = useState<AssetDatabaseState>(initialState);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize database
  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      await AssetDatabaseService.initialize();
      setState(prev => ({ ...prev, initialized: true }));
      
      // Load initial data
      const [collections, stats] = await Promise.all([
        AssetDatabaseService.getCollections(),
        AssetDatabaseService.getStats(),
      ]);
      
      setState(prev => ({ 
        ...prev, 
        collections, 
        stats,
      }));
      
    } catch (error) {
      console.error('Failed to initialize asset database:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to initialize database',
      }));
    }
  }, []);

  // Scan assets
  const scanAssets = useCallback(async () => {
    try {
      setState(prev => ({ 
        ...prev, 
        scanning: true, 
        error: null,
        scanProgress: null,
      }));
      
      const result = await AssetDatabaseService.scanAssets();
      
      setState(prev => ({ 
        ...prev, 
        scanning: false,
        lastScanResult: result,
      }));
      
      // Refresh stats and collections
      const [collections, stats] = await Promise.all([
        AssetDatabaseService.getCollections(),
        AssetDatabaseService.getStats(),
      ]);
      
      setState(prev => ({ 
        ...prev, 
        collections, 
        stats,
      }));
      
    } catch (error) {
      console.error('Asset scan failed:', error);
      setState(prev => ({ 
        ...prev, 
        scanning: false,
        error: error instanceof Error ? error.message : 'Asset scan failed',
      }));
    }
  }, []);

  // Search assets with debouncing
  const searchAssets = useCallback(async (params?: Partial<AssetSearchParams>) => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const searchParams: AssetSearchParams = {
        query: state.searchQuery,
        asset_type: state.filter.types.length > 0 ? state.filter.types[0] : undefined,
        collection: state.filter.collections.length > 0 ? state.filter.collections[0] : undefined,
        limit: 100,
        ...params,
      };
      
      const results = await AssetDatabaseService.searchAssets(searchParams);
      setState(prev => ({ ...prev, searchResults: results }));
      
    } catch (error) {
      console.error('Asset search failed:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Asset search failed',
      }));
    }
  }, [state.searchQuery, state.filter]);

  // Debounced search
  const debouncedSearch = useCallback((params?: Partial<AssetSearchParams>) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchAssets(params);
    }, 300);
  }, [searchAssets]);

  // Set search query
  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query, filter: { ...prev.filter, query } }));
    debouncedSearch({ query });
  }, [debouncedSearch]);

  // Set filter
  const setFilter = useCallback((newFilter: Partial<AssetFilter>) => {
    setState(prev => {
      const updatedFilter = { ...prev.filter, ...newFilter };
      return { ...prev, filter: updatedFilter };
    });
    
    debouncedSearch({
      asset_type: newFilter.types?.[0],
      collection: newFilter.collections?.[0],
    });
  }, [debouncedSearch]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      searchQuery: '',
      filter: { types: [], collections: [], query: '' },
    }));
    searchAssets({ query: '', asset_type: undefined, collection: undefined });
  }, [searchAssets]);

  // Refresh data
  const refresh = useCallback(async () => {
    try {
      const [collections, stats] = await Promise.all([
        AssetDatabaseService.getCollections(),
        AssetDatabaseService.getStats(),
      ]);
      
      setState(prev => ({ ...prev, collections, stats }));
      
      // Re-run current search
      await searchAssets();
      
    } catch (error) {
      console.error('Failed to refresh data:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to refresh data',
      }));
    }
  }, [searchAssets]);

  // Setup event listeners
  useEffect(() => {
    let unlistenScanProgress: (() => void) | null = null;

    const setupListeners = async () => {
      // Listen for scan progress
      unlistenScanProgress = await AssetDatabaseService.onScanProgress((progress) => {
        setState(prev => ({ ...prev, scanProgress: progress }));
      });
    };

    if (state.initialized) {
      setupListeners();
    }

    return () => {
      if (unlistenScanProgress) {
        unlistenScanProgress();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [state.initialized]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Initial search when initialized
  useEffect(() => {
    if (state.initialized && state.searchResults.length === 0) {
      searchAssets({ query: '' }); // Load all assets initially
    }
  }, [state.initialized, state.searchResults.length, searchAssets]);

  return {
    // State
    ...state,
    
    // Actions
    initialize,
    scanAssets,
    searchAssets: debouncedSearch,
    setSearchQuery,
    setFilter,
    clearFilters,
    refresh,
    
    // Computed values
    isReady: state.initialized && !state.scanning,
    hasResults: state.searchResults.length > 0,
    totalAssets: state.stats?.total_assets || 0,
    filteredCount: state.searchResults.length,
    
    // Helpers
    getAssetsByType: (type: string) => 
      state.searchResults.filter(result => result.asset.asset_type === type),
    
    getAssetsByCollection: (collection: string) =>
      state.searchResults.filter(result => result.asset.collection === collection),
      
    getCollectionStats: (collectionName: string) => {
      const collection = state.collections.find(c => c.name === collectionName);
      return {
        name: collection?.name || collectionName,
        count: state.stats?.collections[collectionName] || 0,
        description: collection?.description,
        license: collection?.license_info,
      };
    },
  };
}

// Hook for individual asset operations
export function useAsset(assetId: number | null) {
  const [asset, setAsset] = useState<AssetSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assetId === null) {
      setAsset(null);
      return;
    }

    setLoading(true);
    setError(null);

    // For now, we'll search by ID in the search results
    // In a more complete implementation, we might have a dedicated getAssetById command
    AssetDatabaseService.searchAssets({ query: '', limit: 10000 })
      .then(results => {
        const found = results.find(result => result.asset.id === assetId);
        setAsset(found || null);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load asset');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [assetId]);

  return { asset, loading, error };
}