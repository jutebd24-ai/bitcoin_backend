import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import { storage } from '../storage';

// Mock the storage module
jest.mock('../storage');

describe('GET /api/ohlc Edge Function', () => {
  let app: Express;
  
  beforeEach(() => {
    // Setup would initialize your Express app
    // app = createTestApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Parameter Validation', () => {
    it('should return 400 when symbol parameter is missing', async () => {
      const response = await request(app)
        .get('/api/ohlc')
        .expect(400);

      expect(response.body.message).toBe('Symbol parameter is required');
      expect(response.body.example).toBeDefined();
    });

    it('should return 400 for invalid ticker symbol', async () => {
      // Mock storage to return empty tickers
      (storage.getAllTickers as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/ohlc?symbol=INVALIDTICKER')
        .expect(400);

      expect(response.body.message).toContain('Invalid or disabled ticker');
    });

    it('should validate against available_tickers table', async () => {
      const mockTickers = [
        { symbol: 'BTCUSDT', enabled: true, category: 'Major' },
        { symbol: 'ETHUSDT', enabled: false, category: 'Major' }
      ];
      
      (storage.getAllTickers as jest.Mock).mockResolvedValue(mockTickers);

      // Valid enabled ticker
      const validResponse = await request(app)
        .get('/api/ohlc?symbol=BTCUSDT')
        .expect(200);

      // Invalid disabled ticker
      const invalidResponse = await request(app)
        .get('/api/ohlc?symbol=ETHUSDT')
        .expect(400);

      expect(invalidResponse.body.message).toContain('Invalid or disabled ticker');
    });
  });

  describe('Cache Lookup Logic', () => {
    beforeEach(() => {
      const mockTickers = [
        { symbol: 'BTCUSDT', enabled: true, category: 'Major' }
      ];
      (storage.getAllTickers as jest.Mock).mockResolvedValue(mockTickers);
    });

    it('should return cached data when available and fresh', async () => {
      const mockCachedData = [
        {
          id: '1',
          tickerSymbol: 'BTCUSDT',
          interval: '1h',
          time: new Date(),
          open: '67000',
          high: '67500',
          low: '66800',
          close: '67200',
          volume: '100',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (storage.getOhlcData as jest.Mock).mockResolvedValue(mockCachedData);

      const response = await request(app)
        .get('/api/ohlc?symbol=BTCUSDT&interval=1h&limit=100')
        .expect(200);

      expect(response.body.symbol).toBe('BTCUSDT');
      expect(response.body.cached).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].source).toBe('cache');
    });

    it('should fetch from Binance when cache is empty', async () => {
      (storage.getOhlcData as jest.Mock).mockResolvedValue([]);
      (storage.createOhlcData as jest.Mock).mockResolvedValue({});

      // Mock successful Binance API response
      const mockBinanceData = [[
        1640995200000, // openTime
        '67000.00',    // open
        '67500.00',    // high
        '66800.00',    // low
        '67200.00',    // close
        '100.50',      // volume
        1640998799999, // closeTime
        '6720000.00',  // quoteAssetVolume
        1000,          // numberOfTrades
        '50.25',       // takerBuyBaseAssetVolume
        '3360000.00',  // takerBuyQuoteAssetVolume
        '0'            // ignore
      ]];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBinanceData)
      });

      const response = await request(app)
        .get('/api/ohlc?symbol=BTCUSDT&interval=1h&limit=100')
        .expect(200);

      expect(response.body.external).toBe(true);
      expect(storage.createOhlcData).toHaveBeenCalled();
    });

    it('should handle Binance API failures gracefully', async () => {
      (storage.getOhlcData as jest.Mock).mockResolvedValue([]);

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/api/ohlc?symbol=BTCUSDT&interval=1h&limit=100')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('Data Normalization', () => {
    it('should normalize Binance kline format correctly', async () => {
      const mockTickers = [
        { symbol: 'BTCUSDT', enabled: true, category: 'Major' }
      ];
      (storage.getAllTickers as jest.Mock).mockResolvedValue(mockTickers);
      (storage.getOhlcData as jest.Mock).mockResolvedValue([]);
      (storage.createOhlcData as jest.Mock).mockResolvedValue({});

      const mockBinanceKline = [
        1640995200000, // openTime
        '67000.00',    // open
        '67500.00',    // high
        '66800.00',    // low
        '67200.00',    // close
        '100.50',      // volume
        1640998799999, // closeTime
        '6720000.00',  // quoteAssetVolume
        1000,          // numberOfTrades
        '50.25',       // takerBuyBaseAssetVolume
        '3360000.00',  // takerBuyQuoteAssetVolume
        '0'            // ignore
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([mockBinanceKline])
      });

      const response = await request(app)
        .get('/api/ohlc?symbol=BTCUSDT&interval=1h&limit=1')
        .expect(200);

      const candle = response.body.data[0];
      expect(candle.open).toBe(67000);
      expect(candle.high).toBe(67500);
      expect(candle.low).toBe(66800);
      expect(candle.close).toBe(67200);
      expect(candle.volume).toBe(100.5);
      expect(candle.source).toBe('binance');
    });
  });

  describe('Query Parameters', () => {
    beforeEach(() => {
      const mockTickers = [
        { symbol: 'BTCUSDT', enabled: true, category: 'Major' }
      ];
      (storage.getAllTickers as jest.Mock).mockResolvedValue(mockTickers);
      (storage.getOhlcData as jest.Mock).mockResolvedValue([]);
    });

    it('should handle interval parameter', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      await request(app)
        .get('/api/ohlc?symbol=BTCUSDT&interval=4h')
        .expect(200);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('interval=4h'),
        expect.any(Object)
      );
    });

    it('should handle limit parameter with maximum constraint', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      await request(app)
        .get('/api/ohlc?symbol=BTCUSDT&limit=10000')
        .expect(200);

      // Should cap at 5000
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=5000'),
        expect.any(Object)
      );
    });

    it('should handle startTime and endTime parameters', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-02T00:00:00Z';

      await request(app)
        .get(`/api/ohlc?symbol=BTCUSDT&startTime=${startTime}&endTime=${endTime}`)
        .expect(200);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('startTime='),
        expect.any(Object)
      );
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted response with metadata', async () => {
      const mockTickers = [
        { symbol: 'BTCUSDT', enabled: true, category: 'Major' }
      ];
      (storage.getAllTickers as jest.Mock).mockResolvedValue(mockTickers);

      const mockData = [
        {
          tickerSymbol: 'BTCUSDT',
          interval: '1h',
          time: new Date('2024-01-01T00:00:00Z'),
          open: '67000',
          high: '67500',
          low: '66800',
          close: '67200',
          volume: '100'
        }
      ];
      (storage.getOhlcData as jest.Mock).mockResolvedValue(mockData);

      const response = await request(app)
        .get('/api/ohlc?symbol=BTCUSDT&interval=1h&limit=100')
        .expect(200);

      expect(response.body).toMatchObject({
        symbol: 'BTCUSDT',
        interval: '1h',
        count: 1,
        cached: true,
        external: false,
        data: expect.arrayContaining([
          expect.objectContaining({
            time: expect.any(String),
            open: expect.any(Number),
            high: expect.any(Number),
            low: expect.any(Number),
            close: expect.any(Number),
            volume: expect.any(Number),
            source: expect.any(String)
          })
        ])
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      (storage.getAllTickers as jest.Mock).mockRejectedValue(new Error('DB Connection failed'));

      const response = await request(app)
        .get('/api/ohlc?symbol=BTCUSDT')
        .expect(500);

      expect(response.body.message).toBe('Historical OHLC service error');
      expect(response.body.error).toBeDefined();
    });

    it('should handle timeout errors from Binance API', async () => {
      const mockTickers = [
        { symbol: 'BTCUSDT', enabled: true, category: 'Major' }
      ];
      (storage.getAllTickers as jest.Mock).mockResolvedValue(mockTickers);
      (storage.getOhlcData as jest.Mock).mockResolvedValue([]);

      global.fetch = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const response = await request(app)
        .get('/api/ohlc?symbol=BTCUSDT')
        .expect(200);

      // Should still return 200 but with empty data
      expect(response.body.data).toEqual([]);
    });
  });
});

// Helper function to generate test data
export function generateTestOHLCData(symbol: string, count: number = 100) {
  const data = [];
  const baseTime = new Date('2024-01-01T00:00:00Z');
  let basePrice = 67000;

  for (let i = 0; i < count; i++) {
    const time = new Date(baseTime.getTime() + i * 60 * 60 * 1000); // 1 hour intervals
    const open = basePrice + (Math.random() - 0.5) * 100;
    const close = open + (Math.random() - 0.5) * 50;
    const high = Math.max(open, close) + Math.random() * 25;
    const low = Math.min(open, close) - Math.random() * 25;
    const volume = Math.random() * 1000;

    data.push({
      id: `test-${i}`,
      tickerSymbol: symbol,
      interval: '1h',
      time,
      open: open.toFixed(2),
      high: high.toFixed(2),
      low: low.toFixed(2),
      close: close.toFixed(2),
      volume: volume.toFixed(2),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    basePrice = close;
  }

  return data;
}

export default generateTestOHLCData;