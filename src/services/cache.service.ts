import { Injectable } from '@angular/core';

export interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // milliseconds
}

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private readonly CACHE_PREFIX = 'alpr_cache_';

  constructor() {}

  /**
   * Set data in cache with expiration time
   * @param key Cache key
   * @param data Data to cache
   * @param expiresInMinutes Expiration time in minutes (default: 30 minutes)
   */
  set<T>(key: string, data: T, expiresInMinutes: number = 30): void {
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresIn: expiresInMinutes * 60 * 1000 // convert to milliseconds
    };

    try {
      localStorage.setItem(this.CACHE_PREFIX + key, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  /**
   * Get data from cache if not expired
   * @param key Cache key
   * @returns Cached data or null if not found/expired
   */
  get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(this.CACHE_PREFIX + key);
      if (!cached) return null;

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache has expired
      if (now - cacheItem.timestamp > cacheItem.expiresIn) {
        this.remove(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return null;
    }
  }

  /**
   * Remove item from cache
   * @param key Cache key
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(this.CACHE_PREFIX + key);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }

  /**
   * Clear all cache items
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.CACHE_PREFIX));
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }

  /**
   * Check if cache key exists and is not expired
   * @param key Cache key
   * @returns true if cache exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get cache info (for debugging)
   * @param key Cache key
   * @returns Cache metadata or null
   */
  getCacheInfo(key: string): { timestamp: number; expiresAt: number; isExpired: boolean } | null {
    try {
      const cached = localStorage.getItem(this.CACHE_PREFIX + key);
      if (!cached) return null;

      const cacheItem: CacheItem<any> = JSON.parse(cached);
      const now = Date.now();
      const expiresAt = cacheItem.timestamp + cacheItem.expiresIn;
      
      return {
        timestamp: cacheItem.timestamp,
        expiresAt,
        isExpired: now > expiresAt
      };
    } catch (error) {
      return null;
    }
  }
}
