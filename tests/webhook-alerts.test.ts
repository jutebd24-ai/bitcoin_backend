import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import { storage } from '../storage';

// Mock the storage module
jest.mock('../storage');

describe('POST /api/webhook/alerts - TradingView Webhook Ingestion', () => {
  let app: Express;
  
  beforeEach(() => {
    // Setup would initialize your Express app
    // app = createTestApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Webhook Authentication', () => {
    it('should return 401 when no authentication header is provided', async () => {
      const response = await request(app)
        .post('/api/webhook/alerts')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(401);

      expect(response.body.message).toBe('Missing webhook authentication');
      expect(response.body.code).toBe(401);
      expect(response.body.required).toBeDefined();
    });

    it('should return 401 for invalid webhook secret', async () => {
      (storage.getWebhookSecrets as jest.Mock).mockResolvedValue([
        { secret: 'valid_secret', isActive: true }
      ]);

      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'invalid_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid webhook secret');
      expect(response.body.code).toBe(401);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should accept valid webhook secret from database', async () => {
      (storage.getWebhookSecrets as jest.Mock).mockResolvedValue([
        { 
          id: 'webhook-1',
          secret: 'tradingview_webhook_secret_2025', 
          isActive: true,
          usageCount: 5
        }
      ]);
      (storage.createSignal as jest.Mock).mockResolvedValue({
        id: 'signal-123',
        ticker: 'BTCUSDT',
        signalType: 'BUY',
        price: '67500',
        timestamp: new Date('2025-07-09T12:00:00Z')
      });
      (storage.updateWebhookSecret as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'tradingview_webhook_secret_2025')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(201);

      expect(response.body.message).toBe('Alert successfully ingested');
      expect(response.body.alertId).toBe('signal-123');
      expect(response.body.code).toBe(201);
    });

    it('should accept Authorization header with Bearer token', async () => {
      (storage.getWebhookSecrets as jest.Mock).mockResolvedValue([
        { secret: 'bearer_token_secret', isActive: true }
      ]);
      (storage.createSignal as jest.Mock).mockResolvedValue({
        id: 'signal-456',
        ticker: 'BTCUSDT',
        signalType: 'SELL',
        timestamp: new Date()
      });
      (storage.updateWebhookSecret as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('Authorization', 'Bearer bearer_token_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'sell',
          price: 66800,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '4h'
        })
        .expect(201);

      expect(storage.createSignal).toHaveBeenCalled();
    });
  });

  describe('Payload Validation', () => {
    beforeEach(() => {
      (storage.getWebhookSecrets as jest.Mock).mockResolvedValue([
        { secret: 'valid_secret', isActive: true }
      ]);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'valid_secret')
        .send({})
        .expect(400);

      expect(response.body.message).toBe('Invalid alert payload');
      expect(response.body.errors).toContain('ticker is required');
      expect(response.body.errors).toContain('action must be "buy" or "sell"');
      expect(response.body.errors).toContain('price must be a valid number');
      expect(response.body.errors).toContain('timestamp is required');
      expect(response.body.errors).toContain('timeframe is required');
    });

    it('should validate ticker symbols', async () => {
      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'valid_secret')
        .send({
          ticker: 'INVALIDCOIN',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(400);

      expect(response.body.errors).toContain(
        'ticker must be one of: BTCUSDT, BTCUSD, ETHUSDT, ETHUSD'
      );
    });

    it('should validate action values', async () => {
      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'valid_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'hold',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(400);

      expect(response.body.errors).toContain('action must be "buy" or "sell"');
    });

    it('should validate price as number', async () => {
      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'valid_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 'not_a_number',
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(400);

      expect(response.body.errors).toContain('price must be a valid number');
    });

    it('should validate timeframes', async () => {
      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'valid_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '5m'
        })
        .expect(400);

      expect(response.body.errors).toContain(
        'timeframe must be one of: 1M, 1W, 1D, 12h, 4h, 1h, 30m'
      );
    });

    it('should accept valid payload with all supported tickers', async () => {
      const supportedTickers = ['BTCUSDT', 'BTCUSD', 'ETHUSDT', 'ETHUSD'];
      (storage.createSignal as jest.Mock).mockResolvedValue({
        id: 'signal-test',
        signalType: 'BUY',
        timestamp: new Date()
      });
      (storage.updateWebhookSecret as jest.Mock).mockResolvedValue({});

      for (const ticker of supportedTickers) {
        const response = await request(app)
          .post('/api/webhook/alerts')
          .set('x-webhook-secret', 'valid_secret')
          .send({
            ticker: ticker.toLowerCase(), // Test case insensitivity
            action: 'buy',
            price: 67500,
            timestamp: '2025-07-09T12:00:00Z',
            timeframe: '1h'
          })
          .expect(201);

        expect(response.body.alertId).toBe('signal-test');
      }
    });

    it('should accept all supported timeframes', async () => {
      const supportedTimeframes = ['1M', '1W', '1D', '12h', '4h', '1h', '30m'];
      (storage.createSignal as jest.Mock).mockResolvedValue({
        id: 'signal-timeframe',
        signalType: 'BUY',
        timestamp: new Date()
      });
      (storage.updateWebhookSecret as jest.Mock).mockResolvedValue({});

      for (const timeframe of supportedTimeframes) {
        const response = await request(app)
          .post('/api/webhook/alerts')
          .set('x-webhook-secret', 'valid_secret')
          .send({
            ticker: 'BTCUSDT',
            action: 'buy',
            price: 67500,
            timestamp: '2025-07-09T12:00:00Z',
            timeframe: timeframe
          })
          .expect(201);

        expect(response.body.alertId).toBe('signal-timeframe');
      }
    });
  });

  describe('Alert Persistence', () => {
    beforeEach(() => {
      (storage.getWebhookSecrets as jest.Mock).mockResolvedValue([
        { secret: 'valid_secret', isActive: true }
      ]);
      (storage.updateWebhookSecret as jest.Mock).mockResolvedValue({});
    });

    it('should persist incoming alert to alert_signals table', async () => {
      const mockSignal = {
        id: 'persisted-signal-123',
        ticker: 'BTCUSDT',
        signalType: 'BUY',
        price: '67500',
        timestamp: new Date('2025-07-09T12:00:00Z'),
        timeframe: '1h',
        source: 'tradingview_webhook',
        note: 'RSI Oversold Strategy'
      };

      (storage.createSignal as jest.Mock).mockResolvedValue(mockSignal);

      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'valid_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h',
          strategy: 'RSI Oversold Strategy'
        })
        .expect(201);

      expect(storage.createSignal).toHaveBeenCalledWith({
        ticker: 'BTCUSDT',
        signalType: 'BUY',
        price: '67500',
        timestamp: new Date('2025-07-09T12:00:00Z'),
        timeframe: '1h',
        source: 'tradingview_webhook',
        note: 'RSI Oversold Strategy',
        userId: null
      });

      expect(response.body.alertId).toBe('persisted-signal-123');
      expect(response.body.ticker).toBe('BTCUSDT');
      expect(response.body.signalType).toBe('BUY');
    });

    it('should handle case normalization correctly', async () => {
      (storage.createSignal as jest.Mock).mockResolvedValue({
        id: 'normalized-signal',
        ticker: 'ETHUSDT',
        signalType: 'SELL',
        timestamp: new Date()
      });

      await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'valid_secret')
        .send({
          ticker: 'ethusdt', // lowercase
          action: 'SELL',    // uppercase
          price: 3450.75,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '4h'
        })
        .expect(201);

      expect(storage.createSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          ticker: 'ETHUSDT',
          signalType: 'SELL'
        })
      );
    });

    it('should use default note when strategy is not provided', async () => {
      (storage.createSignal as jest.Mock).mockResolvedValue({
        id: 'default-note-signal',
        timestamp: new Date()
      });

      await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'valid_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(201);

      expect(storage.createSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          note: 'TradingView Alert'
        })
      );
    });
  });

  describe('HTTP Response Codes', () => {
    beforeEach(() => {
      (storage.getWebhookSecrets as jest.Mock).mockResolvedValue([
        { secret: 'valid_secret', isActive: true }
      ]);
      (storage.createSignal as jest.Mock).mockResolvedValue({
        id: 'response-test-signal',
        ticker: 'BTCUSDT',
        signalType: 'BUY',
        timestamp: new Date('2025-07-09T12:00:00Z')
      });
      (storage.updateWebhookSecret as jest.Mock).mockResolvedValue({});
    });

    it('should return 201 for successfully created alert', async () => {
      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'valid_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(201);

      expect(response.body.code).toBe(201);
      expect(response.body.message).toBe('Alert successfully ingested');
      expect(response.body.alertId).toBeDefined();
      expect(response.body.ticker).toBeDefined();
      expect(response.body.signalType).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return 401 for authentication failures', async () => {
      const response = await request(app)
        .post('/api/webhook/alerts')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(401);

      expect(response.body.code).toBe(401);
    });

    it('should return 400 for validation errors', async () => {
      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'valid_secret')
        .send({
          ticker: 'INVALID',
          action: 'invalid_action',
          price: 'not_a_number'
        })
        .expect(400);

      expect(response.body.code).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 500 for internal server errors', async () => {
      (storage.createSignal as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'valid_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(500);

      expect(response.body.code).toBe(500);
      expect(response.body.message).toBe('Internal webhook processing error');
      expect(response.body.error).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Webhook Usage Tracking', () => {
    it('should update webhook usage statistics', async () => {
      const mockWebhookSecret = {
        id: 'webhook-123',
        secret: 'tracked_secret',
        isActive: true,
        usageCount: 10
      };

      (storage.getWebhookSecrets as jest.Mock).mockResolvedValue([mockWebhookSecret]);
      (storage.createSignal as jest.Mock).mockResolvedValue({
        id: 'usage-tracking-signal',
        timestamp: new Date()
      });
      (storage.updateWebhookSecret as jest.Mock).mockResolvedValue({});

      await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'tracked_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(201);

      expect(storage.updateWebhookSecret).toHaveBeenCalledWith('webhook-123', {
        lastUsed: expect.any(Date),
        usageCount: 11
      });
    });

    it('should handle webhook usage tracking errors gracefully', async () => {
      (storage.getWebhookSecrets as jest.Mock).mockResolvedValue([
        { secret: 'error_prone_secret', isActive: true }
      ]);
      (storage.createSignal as jest.Mock).mockResolvedValue({
        id: 'error-handling-signal',
        timestamp: new Date()
      });
      (storage.updateWebhookSecret as jest.Mock).mockRejectedValue(new Error('Update failed'));

      // Should still succeed even if usage tracking fails
      await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'error_prone_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(201);
    });
  });

  describe('Real-time Broadcasting', () => {
    it('should broadcast webhook alerts to WebSocket clients', async () => {
      const mockBroadcast = jest.fn();
      global.broadcast = mockBroadcast; // Mock the broadcast function

      (storage.getWebhookSecrets as jest.Mock).mockResolvedValue([
        { secret: 'broadcast_secret', isActive: true }
      ]);
      (storage.createSignal as jest.Mock).mockResolvedValue({
        id: 'broadcast-signal',
        ticker: 'BTCUSDT',
        signalType: 'BUY',
        timestamp: new Date('2025-07-09T12:00:00Z')
      });
      (storage.updateWebhookSecret as jest.Mock).mockResolvedValue({});

      await request(app)
        .post('/api/webhook/alerts')
        .set('x-webhook-secret', 'broadcast_secret')
        .send({
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h'
        })
        .expect(201);

      expect(mockBroadcast).toHaveBeenCalledWith({
        type: 'webhook_alert',
        signal: expect.objectContaining({
          id: 'broadcast-signal',
          ticker: 'BTCUSDT',
          signalType: 'BUY'
        }),
        source: 'tradingview',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete webhook flow with multiple alerts', async () => {
      (storage.getWebhookSecrets as jest.Mock).mockResolvedValue([
        { secret: 'integration_secret', isActive: true }
      ]);
      (storage.updateWebhookSecret as jest.Mock).mockResolvedValue({});

      const alerts = [
        {
          ticker: 'BTCUSDT',
          action: 'buy',
          price: 67500,
          timestamp: '2025-07-09T12:00:00Z',
          timeframe: '1h',
          strategy: 'RSI Oversold'
        },
        {
          ticker: 'ETHUSDT',
          action: 'sell',
          price: 3450,
          timestamp: '2025-07-09T12:05:00Z',
          timeframe: '4h',
          strategy: 'MACD Bearish Cross'
        }
      ];

      for (let i = 0; i < alerts.length; i++) {
        (storage.createSignal as jest.Mock).mockResolvedValueOnce({
          id: `integration-signal-${i}`,
          ticker: alerts[i].ticker,
          signalType: alerts[i].action.toUpperCase(),
          timestamp: new Date(alerts[i].timestamp)
        });

        const response = await request(app)
          .post('/api/webhook/alerts')
          .set('x-webhook-secret', 'integration_secret')
          .send(alerts[i])
          .expect(201);

        expect(response.body.alertId).toBe(`integration-signal-${i}`);
        expect(response.body.ticker).toBe(alerts[i].ticker);
      }

      expect(storage.createSignal).toHaveBeenCalledTimes(2);
    });
  });
});

// Helper function to generate test webhook payloads
export function generateTestWebhookPayload(overrides: Partial<any> = {}) {
  return {
    ticker: 'BTCUSDT',
    action: 'buy',
    price: 67500 + Math.random() * 1000,
    timestamp: new Date().toISOString(),
    timeframe: '1h',
    strategy: 'Test Strategy',
    ...overrides
  };
}

// Helper function to create test webhook secrets
export function createTestWebhookSecrets() {
  return [
    {
      id: 'test-webhook-1',
      name: 'tradingview-primary',
      secret: 'test_tradingview_secret_2025',
      description: 'Test webhook secret',
      isActive: true,
      allowedSources: ['tradingview'],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsed: null,
      usageCount: 0
    },
    {
      id: 'test-webhook-2',
      name: 'tradingview-backup',
      secret: 'backup_webhook_secret',
      description: 'Backup webhook secret',
      isActive: true,
      allowedSources: ['tradingview'],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsed: new Date(),
      usageCount: 25
    }
  ];
}

export default generateTestWebhookPayload;