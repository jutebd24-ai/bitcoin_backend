/**
 * Trading Signals Routes
 * Handles buy/sell signals, alerts, and signal management
 */
import type { Express } from "express";
import type { WebSocketServer } from "ws";
import { body, query, param } from "express-validator";
import { storage } from "../storage.js";
import { insertSignalSchema, createSignalSchema } from "../../shared/schema.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validateInput } from "../utils/validation.js";
import { broadcast } from "./websocket.js";

/**
 * Signal validation schemas
 */
const signalQuerySchema = {
  ticker: query('ticker').optional().isLength({ min: 2, max: 10 }),
  timeframe: query('timeframe').optional().isIn(['1m', '5m', '15m', '1h', '4h', '1d', '1w']),
  days: query('days').optional().isInt({ min: 1, max: 365 })
};

/**
 * Trading signals routes setup
 */
export function signalRoutes(app: Express, wss: WebSocketServer) {

  /**
   * Get signals with limit (for admin panel)
   * GET /api/signals?limit=20
   */
  app.get('/api/signals', [requireAuth], async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const signals = await storage.getSignals(limit);
      res.json(signals);
    } catch (error) {
      console.error('Failed to fetch signals:', error);
      res.status(500).json({ 
        message: 'Failed to fetch signals',
        code: 'FETCH_SIGNALS_ERROR'
      });
    }
  });

  /**
   * Get recent signals for live streaming
   * GET /api/signals/recent
   */
  app.get('/api/signals/recent', async (req: any, res) => {
    try {
      const signals = await storage.getSignals(20); // Get last 20 signals
      res.json(signals);
    } catch (error) {
      console.error('Failed to fetch recent signals:', error);
      res.status(500).json({ 
        message: 'Failed to fetch recent signals',
        code: 'FETCH_SIGNALS_ERROR'
      });
    }
  });

  /**
   * Get trading signals/alerts (Public endpoint)
   * GET /api/public/signals/alerts
   */
  app.get('/api/public/signals/alerts', [
    signalQuerySchema.ticker,
    signalQuerySchema.timeframe,
    signalQuerySchema.days,
    validateInput
  ], async (req, res) => {
    try {
      const { ticker, timeframe, days } = req.query;

      console.log('📊 Signals API called with:', { ticker, timeframe, days });

      // Get signals from storage
      const signals = await storage.getSignals();
      console.log('📊 Raw signals from storage:', signals.length);

      if (signals.length > 0) {
        console.log('📊 First signal sample:', {
          ticker: signals[0].ticker,
          timeframe: signals[0].timeframe,
          timestamp: signals[0].timestamp
        });
      }

      let filteredSignals = signals;

      // Filter by ticker if provided
      if (ticker) {
        console.log('📊 Filtering by ticker:', ticker);
        filteredSignals = filteredSignals.filter(s => 
          s.ticker?.toLowerCase() === (ticker as string).toLowerCase()
        );
        console.log('📊 After ticker filter:', signals.length, '->', filteredSignals.length);
      }

      // Filter by timeframe if provided
      if (timeframe) {
        console.log('📊 Filtering by timeframe:', timeframe);
        filteredSignals = filteredSignals.filter(s => 
          s.timeframe?.toLowerCase() === (timeframe as string).toLowerCase()
        );
        console.log('📊 After timeframe filter:', 
          filteredSignals.length > 0 ? signals.length : 'previous', 
          '->', filteredSignals.length
        );
      }

      // Filter by date range if provided
      if (days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));
        
        filteredSignals = filteredSignals.filter(s => 
          new Date(s.timestamp) >= daysAgo
        );
      }

      // Sort by timestamp (newest first)
      filteredSignals.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      res.json(filteredSignals);

    } catch (error) {
      console.error('Error fetching signals:', error);
      res.status(500).json({ 
        message: 'Failed to fetch signals',
        code: 'SIGNALS_FETCH_ERROR'
      });
    }
  });

  /**
   * Create new trading signal (Admin only)
   * POST /api/admin/signals
   */
  app.post('/api/admin/signals', [
    requireAuth,
    requireAdmin,
    body('symbol').isLength({ min: 2, max: 10 }).withMessage('Invalid symbol'),
    body('signalType').isIn(['buy', 'sell']).withMessage('Signal type must be buy or sell'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be positive number'),
    body('timeframe').isIn(['30M', '1H', '4H', '8H', '12H', '1D', '1W', '1M']).withMessage('Invalid timeframe'),
    body('notes').optional().isLength({ max: 500 }).withMessage('Notes too long'),
    validateInput
  ], async (req: any, res) => {
    try {
      // Create signal data with proper mapping
      const signalData = {
        symbol: req.body.symbol,
        signalType: req.body.signalType,
        price: req.body.price.toString(),
        timeframe: req.body.timeframe,
        timestamp: new Date(),
        source: 'admin',
        notes: req.body.notes || null,
        confidence: req.body.confidence || 80,
        createdBy: req.user?.id || 'admin'
      };

      const signal = await storage.createBuySignal(signalData);

      // Broadcast to WebSocket clients
      broadcast(wss, {
        type: 'new_signal',
        data: signal
      });

      console.log('📢 New signal created and broadcasted:', {
        id: signal.id,
        symbol: signal.symbol,
        type: signal.signalType,
        price: signal.price
      });

      res.status(201).json({
        message: 'Signal created successfully',
        signal
      });

    } catch (error) {
      console.error('Error creating signal:', error);
      res.status(500).json({ 
        message: 'Failed to create signal',
        code: 'SIGNAL_CREATE_ERROR'
      });
    }
  });

  /**
   * Get all signals (Admin only)
   * GET /api/admin/signals
   */
  app.get('/api/admin/signals', [
    requireAuth,
    requireAdmin,
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validateInput
  ], async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const signals = await storage.getBuySignals();
      
      // Sort by timestamp (newest first)
      signals.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedSignals = signals.slice(startIndex, endIndex);

      res.json({
        signals: paginatedSignals,
        pagination: {
          page,
          limit,
          total: signals.length,
          pages: Math.ceil(signals.length / limit)
        }
      });

    } catch (error) {
      console.error('Error fetching admin signals:', error);
      res.status(500).json({ 
        message: 'Failed to fetch signals',
        code: 'ADMIN_SIGNALS_FETCH_ERROR'
      });
    }
  });

  /**
   * Update signal (Admin only)
   * PUT /api/admin/signals/:id
   */
  app.put('/api/admin/signals/:id', [
    requireAuth,
    requireAdmin,
    param('id').isUUID().withMessage('Invalid signal ID'),
    body('notes').optional().isLength({ max: 500 }),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const signal = await storage.updateSignal(id, updates);
      
      if (!signal) {
        return res.status(404).json({ 
          message: 'Signal not found',
          code: 'SIGNAL_NOT_FOUND'
        });
      }

      res.json({
        message: 'Signal updated successfully',
        signal
      });

    } catch (error) {
      console.error('Error updating signal:', error);
      res.status(500).json({ 
        message: 'Failed to update signal',
        code: 'SIGNAL_UPDATE_ERROR'
      });
    }
  });

  /**
   * Delete signal (Admin only)
   * DELETE /api/admin/signals/:id
   */
  app.delete('/api/admin/signals/:id', [
    requireAuth,
    requireAdmin,
    param('id').isUUID().withMessage('Invalid signal ID'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;

      const success = await storage.deleteSignal(id);
      
      if (!success) {
        return res.status(404).json({ 
          message: 'Signal not found',
          code: 'SIGNAL_NOT_FOUND'
        });
      }

      res.json({
        message: 'Signal deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting signal:', error);
      res.status(500).json({ 
        message: 'Failed to delete signal',
        code: 'SIGNAL_DELETE_ERROR'
      });
    }
  });

  /**
   * Get signal statistics (Admin only)
   * GET /api/admin/signals/stats
   */
  app.get('/api/admin/signals/stats', [
    requireAuth,
    requireAdmin
  ], async (req: any, res) => {
    try {
      const signals = await storage.getSignals();

      const stats = {
        total: signals.length,
        buy: signals.filter(s => s.signalType === 'buy').length,
        sell: signals.filter(s => s.signalType === 'sell').length,
        byTimeframe: signals.reduce((acc: any, signal) => {
          acc[signal.timeframe] = (acc[signal.timeframe] || 0) + 1;
          return acc;
        }, {}),
        byTicker: signals.reduce((acc: any, signal) => {
          acc[signal.ticker] = (acc[signal.ticker] || 0) + 1;
          return acc;
        }, {}),
        recent: signals
          .filter(s => new Date(s.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          .length
      };

      res.json(stats);

    } catch (error) {
      console.error('Error fetching signal stats:', error);
      res.status(500).json({ 
        message: 'Failed to fetch signal statistics',
        code: 'SIGNAL_STATS_ERROR'
      });
    }
  });
}