/**
 * Caching Utilities
 * Memory-based caching for API responses and market data
 */

/**
 * Cache interface for typed caching
 */
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface Cache {
  [key: string]: CacheEntry;
}

// Cache instances
export const priceCache: Cache = {};
export const ohlcCache: Cache = {};

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  PRICE: 30 * 1000,        // 30 seconds
  OHLC: 60 * 1000,         // 1 minute
  USER_DATA: 5 * 60 * 1000, // 5 minutes
  MARKET_DATA: 15 * 1000    // 15 seconds
};

/**
 * Generic cache operations
 */
export class CacheManager {
  private cache: Cache = {};
  
  /**
   * Set cache entry with TTL
   */
  set<T>(key: string, data: T, ttl: number = CACHE_TTL.PRICE): void {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      ttl
    };
  }
  
  /**
   * Get cache entry if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache[key];
    
    if (!entry) {
      return null;
    }
    
    const isExpired = (Date.now() - entry.timestamp) > entry.ttl;
    
    if (isExpired) {
      delete this.cache[key];
      return null;
    }
    
    return entry.data as T;
  }
  
  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    if (this.cache[key]) {
      delete this.cache[key];
      return true;
    }
    return false;
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache = {};
  }
  
  /**
   * Get cache statistics
   */
  stats() {
    const entries = Object.keys(this.cache);
    const expired = entries.filter(key => {
      const entry = this.cache[key];
      return (Date.now() - entry.timestamp) > entry.ttl;
    });
    
    return {
      total: entries.length,
      expired: expired.length,
      active: entries.length - expired.length
    };
  }
  
  /**
   * Clean expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    Object.keys(this.cache).forEach(key => {
      const entry = this.cache[key];
      if ((now - entry.timestamp) > entry.ttl) {
        delete this.cache[key];
        cleaned++;
      }
    });
    
    return cleaned;
  }
}

// Specialized cache functions for price data
export function cachePrice(symbol: string, data: any): void {
  priceCache[symbol] = {
    data,
    timestamp: Date.now(),
    ttl: CACHE_TTL.PRICE
  };
}

export function getCachedPrice(symbol: string): any | null {
  const entry = priceCache[symbol];
  
  if (!entry) {
    return null;
  }
  
  const isExpired = (Date.now() - entry.timestamp) > entry.ttl;
  
  if (isExpired) {
    delete priceCache[symbol];
    return null;
  }
  
  return entry.data;
}

// Specialized cache functions for OHLC data  
export function cacheOHLC(key: string, data: any): void {
  ohlcCache[key] = {
    data,
    timestamp: Date.now(),
    ttl: CACHE_TTL.OHLC
  };
}

export function getCachedOHLC(key: string): any | null {
  const entry = ohlcCache[key];
  
  if (!entry) {
    return null;
  }
  
  const isExpired = (Date.now() - entry.timestamp) > entry.ttl;
  
  if (isExpired) {
    delete ohlcCache[key];
    return null;
  }
  
  return entry.data;
}

// Periodic cleanup (run every 5 minutes)
setInterval(() => {
  const now = Date.now();
  
  // Clean price cache
  Object.keys(priceCache).forEach(key => {
    const entry = priceCache[key];
    if ((now - entry.timestamp) > entry.ttl) {
      delete priceCache[key];
    }
  });
  
  // Clean OHLC cache  
  Object.keys(ohlcCache).forEach(key => {
    const entry = ohlcCache[key];
    if ((now - entry.timestamp) > entry.ttl) {
      delete ohlcCache[key];
    }
  });
}, 5 * 60 * 1000);