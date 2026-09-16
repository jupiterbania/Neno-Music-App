import type { DataSource } from "../datasource/DataSource";
import type { SearchResults, Track } from "../datasource/types";

interface CachedEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class SearchController {
  private memorySearchCache = new Map<string, CachedEntry<SearchResults>>();
  private inFlightSearches = new Map<string, Promise<SearchResults>>();

  constructor(private readonly dataSource: DataSource) {}

  async search(
    query: string,
    onUpdate?: (results: SearchResults) => void,
  ): Promise<SearchResults> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return { artists: [], tracks: [], albums: [], playlists: [] };
    }

    const cacheKey = normalizedQuery.toLowerCase();
    const cached = this.memorySearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      onUpdate?.(cached.data);
      return cached.data;
    }

    const inFlight = this.inFlightSearches.get(cacheKey);
    if (inFlight) {
      const results = await inFlight;
      onUpdate?.(results);
      return results;
    }

    const searchPromise = (async () => {
      try {
        let results: SearchResults;
        if (this.dataSource.search) {
          results = await this.dataSource.search(normalizedQuery, (updated) => {
            this.memorySearchCache.set(cacheKey, { data: updated, timestamp: Date.now() });
            onUpdate?.(updated);
          });
        } else {
          const tracks = await this.searchTracks(normalizedQuery, (items) => {
            const partial: SearchResults = { artists: [], tracks: items, albums: [], playlists: [] };
            this.memorySearchCache.set(cacheKey, { data: partial, timestamp: Date.now() });
            onUpdate?.(partial);
          });
          results = { artists: [], tracks, albums: [], playlists: [] };
        }

        this.memorySearchCache.set(cacheKey, { data: results, timestamp: Date.now() });
        return results;
      } finally {
        this.inFlightSearches.delete(cacheKey);
      }
    })();

    this.inFlightSearches.set(cacheKey, searchPromise);
    return searchPromise;
  }

  async searchTracks(query: string, onUpdate?: (tracks: Track[]) => void): Promise<Track[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || !this.dataSource.searchTracks) return [];
    return this.dataSource.searchTracks(normalizedQuery, onUpdate);
  }

  async getSearchSuggestions(
    query: string,
    onUpdate?: (suggestions: string[]) => void,
  ): Promise<string[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || !this.dataSource.getSearchSuggestions) return [];
    return this.dataSource.getSearchSuggestions(normalizedQuery, onUpdate);
  }
}
