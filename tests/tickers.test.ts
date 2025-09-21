import request from 'supertest';
import { Express } from 'express';
import { jest } from '@jest/globals';
import { registerRoutes } from '../routes';
import express from 'express';
import { storage } from '../storage';

// Mock storage
jest.mock('../storage', () => ({
  storage: {
    getAllTickers: jest.fn(),
    getEnabledTickers: jest.fn()
  }
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

describe('Available Tickers API - GET /api/tickers', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerRoutes(app);
    jest.clearAllMocks();
  });

  const mockTickers = [
    {
      id: '1',
      symbol: 'BTCUSDT',
      description: 'Bitcoin / USD Tether',
      category: 'Major',
      isEnabled: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: '2',
      symbol: 'ETHUSDT',
      description: 'Ethereum / USD Tether',
      category: 'Major', 
      isEnabled: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: '3',
      symbol: 'ADAUSDT',
      description: 'Cardano / USD Tether',
      category: 'Layer 1',
      isEnabled: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: '4',
      symbol: 'SOLUSDT',
      description: 'Solana / USD Tether',
      category: 'Layer 1',
      isEnabled: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: '5',
      symbol: 'UNIUSDT',
      description: 'Uniswap / USD Tether',
      category: 'DeFi',
      isEnabled: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  ];

  describe('Basic Functionality', () => {
    it('should return all enabled tickers by default', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers')
        .expect(200);

      expect(response.body.data).toHaveLength(4); // Only enabled tickers
      expect(response.body.data.every((ticker: any) => ticker.isEnabled)).toBe(true);
      expect(response.body.count).toBe(4);
      expect(response.body.filtered_count).toBe(4);
    });

    it('should return all tickers when enabled=false', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?enabled=false')
        .expect(200);

      expect(response.body.data).toHaveLength(5); // All tickers
      expect(response.body.count).toBe(5);
      expect(response.body.filtered_count).toBe(5);
    });

    it('should include proper Supabase-style response structure', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('filtered_count');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('search');
      expect(response.body).toHaveProperty('filters');
      expect(response.body).toHaveProperty('meta');

      // Check pagination structure
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('offset');
      expect(response.body.pagination).toHaveProperty('has_more');
      expect(response.body.pagination).toHaveProperty('total_pages');
      expect(response.body.pagination).toHaveProperty('current_page');

      // Check search structure
      expect(response.body.search).toHaveProperty('term');
      expect(response.body.search).toHaveProperty('suggestions');
      expect(response.body.search).toHaveProperty('autocomplete');

      // Check meta structure
      expect(response.body.meta).toHaveProperty('timestamp');
      expect(response.body.meta).toHaveProperty('cached');
      expect(response.body.meta).toHaveProperty('processing_time_ms');
    });

    it('should set proper response headers', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers')
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=300');
      expect(response.headers['x-api-version']).toBe('1.0');
      expect(response.headers['x-total-count']).toBe('4');
      expect(response.headers['x-filtered-count']).toBe('4');
    });
  });

  describe('Search and Autocomplete', () => {
    it('should filter tickers by symbol search', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?search=BTC')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].symbol).toBe('BTCUSDT');
      expect(response.body.search.term).toBe('BTC');
      expect(response.body.search.suggestions).toHaveLength(1);
      expect(response.body.search.autocomplete).toContain('BTCUSDT');
    });

    it('should filter tickers by description search', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?search=Ethereum')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].symbol).toBe('ETHUSDT');
      expect(response.body.search.term).toBe('Ethereum');
    });

    it('should perform case-insensitive search', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?search=bitcoin')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].symbol).toBe('BTCUSDT');
    });

    it('should return suggestions and autocomplete for search terms', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?search=USD')
        .expect(200);

      expect(response.body.search.suggestions).toBeInstanceOf(Array);
      expect(response.body.search.autocomplete).toBeInstanceOf(Array);
      expect(response.body.search.suggestions.length).toBeGreaterThan(0);
      expect(response.body.search.autocomplete.length).toBeGreaterThan(0);
      
      // Verify suggestions contain expected fields
      if (response.body.search.suggestions.length > 0) {
        const suggestion = response.body.search.suggestions[0];
        expect(suggestion).toHaveProperty('symbol');
        expect(suggestion).toHaveProperty('description');
        expect(suggestion).toHaveProperty('category');
      }
    });

    it('should limit suggestions to top 10 results', async () => {
      const manyTickers = Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}`,
        symbol: `TICKER${i + 1}USDT`,
        description: `Test Token ${i + 1} / USD Tether`,
        category: 'Test',
        isEnabled: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      }));

      mockStorage.getAllTickers.mockResolvedValue(manyTickers);

      const response = await request(app)
        .get('/api/tickers?search=TICKER')
        .expect(200);

      expect(response.body.search.suggestions.length).toBeLessThanOrEqual(10);
      expect(response.body.search.autocomplete.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Category Filtering', () => {
    it('should filter tickers by category', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?category=Major')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((ticker: any) => ticker.category === 'Major')).toBe(true);
      expect(response.body.filters.category).toBe('Major');
    });

    it('should perform case-insensitive category filtering', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?category=major')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((ticker: any) => ticker.category === 'Major')).toBe(true);
    });
  });

  describe('Sorting and Ordering', () => {
    it('should sort tickers by symbol ascending by default', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers')
        .expect(200);

      const symbols = response.body.data.map((ticker: any) => ticker.symbol);
      const sortedSymbols = [...symbols].sort();
      expect(symbols).toEqual(sortedSymbols);
      expect(response.body.filters.sort).toBe('symbol');
      expect(response.body.filters.order).toBe('asc');
    });

    it('should sort tickers by symbol descending', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?sort=symbol&order=desc')
        .expect(200);

      const symbols = response.body.data.map((ticker: any) => ticker.symbol);
      const sortedSymbols = [...symbols].sort().reverse();
      expect(symbols).toEqual(sortedSymbols);
      expect(response.body.filters.order).toBe('desc');
    });

    it('should sort tickers by description', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?sort=description')
        .expect(200);

      const descriptions = response.body.data.map((ticker: any) => ticker.description);
      const sortedDescriptions = [...descriptions].sort();
      expect(descriptions).toEqual(sortedDescriptions);
      expect(response.body.filters.sort).toBe('description');
    });

    it('should fallback to symbol sorting for invalid sort fields', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?sort=invalid_field')
        .expect(200);

      expect(response.body.filters.sort).toBe('symbol');
    });
  });

  describe('Pagination', () => {
    it('should implement proper pagination with limit and offset', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?limit=2&offset=0')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.offset).toBe(0);
      expect(response.body.pagination.has_more).toBe(true);
      expect(response.body.pagination.total_pages).toBe(2);
      expect(response.body.pagination.current_page).toBe(1);
    });

    it('should handle second page pagination', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?limit=2&offset=2')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.offset).toBe(2);
      expect(response.body.pagination.current_page).toBe(2);
      expect(response.body.pagination.has_more).toBe(false);
    });

    it('should enforce maximum limit of 1000', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?limit=2000')
        .expect(200);

      expect(response.body.pagination.limit).toBe(1000);
    });

    it('should default to limit 100 and offset 0', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers')
        .expect(200);

      expect(response.body.pagination.limit).toBe(100);
      expect(response.body.pagination.offset).toBe(0);
    });
  });

  describe('Combined Filters', () => {
    it('should apply multiple filters simultaneously', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?search=USD&category=Major&limit=1')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].category).toBe('Major');
      expect(response.body.data[0].description).toContain('USD');
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.search.term).toBe('USD');
      expect(response.body.filters.category).toBe('Major');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockStorage.getAllTickers.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/tickers')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBe('Failed to fetch tickers');
    });

    it('should handle invalid parameters gracefully', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?limit=invalid&offset=also_invalid')
        .expect(200);

      // Should fallback to defaults
      expect(response.body.pagination.limit).toBe(100);
      expect(response.body.pagination.offset).toBe(0);
    });
  });

  describe('Empty Results', () => {
    it('should handle empty ticker list', async () => {
      mockStorage.getAllTickers.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/tickers')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.count).toBe(0);
      expect(response.body.filtered_count).toBe(0);
      expect(response.body.pagination.total_pages).toBe(0);
      expect(response.body.search.suggestions).toHaveLength(0);
      expect(response.body.search.autocomplete).toHaveLength(0);
    });

    it('should handle search with no results', async () => {
      mockStorage.getAllTickers.mockResolvedValue(mockTickers);

      const response = await request(app)
        .get('/api/tickers?search=NONEXISTENT')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.count).toBe(0);
      expect(response.body.search.term).toBe('NONEXISTENT');
      expect(response.body.search.suggestions).toHaveLength(0);
      expect(response.body.search.autocomplete).toHaveLength(0);
    });
  });

  describe('Legacy Endpoint Compatibility', () => {
    it('should maintain backward compatibility with /api/tickers/enabled', async () => {
      const enabledTickers = mockTickers.filter(t => t.isEnabled);
      mockStorage.getEnabledTickers.mockResolvedValue(enabledTickers);

      const response = await request(app)
        .get('/api/tickers/enabled')
        .expect(200);

      expect(response.body).toHaveLength(4);
      expect(response.body.every((ticker: any) => ticker.isEnabled)).toBe(true);
    });
  });
});

describe('Available Tickers API Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerRoutes(app);
  });

  it('should work with real storage implementation', async () => {
    // This test uses the actual storage implementation
    const response = await request(app)
      .get('/api/tickers')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('count');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body).toHaveProperty('search');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should handle search with real data', async () => {
    const response = await request(app)
      .get('/api/tickers?search=BTC')
      .expect(200);

    expect(response.body.search.term).toBe('BTC');
    if (response.body.data.length > 0) {
      expect(response.body.data.some((ticker: any) => 
        ticker.symbol.includes('BTC') || ticker.description.includes('Bitcoin')
      )).toBe(true);
    }
  });
});