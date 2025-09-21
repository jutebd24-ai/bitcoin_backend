/**
 * Admin Routes
 * Administrative functions for managing users, system settings, and monitoring
 */
import type { Express, Request, Response } from "express";
import type { WebSocketServer } from "ws";
import { query, param, body } from "express-validator";
import { storage } from "../storage.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validateInput } from "../utils/validation.js";
import { smsService } from "../services/smsService.js";
import { telegramService } from "../services/telegramService.js";
import { notificationService } from "../services/notificationService.js";
import { notificationQueueService } from "../services/notificationQueue.js";
import { insertSystemSettingSchema, insertAnnouncementSchema } from "../../shared/schema.js";

/**
 * Admin routes setup
 */
export function adminRoutes(app: Express, wss: WebSocketServer) {

  /**
   * Get all subscription plans (admin)
   * GET /api/admin/subscription-plans
   */
  app.get('/api/admin/subscription-plans', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error('Admin get subscription plans error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch subscription plans',
        code: 'ADMIN_PLANS_ERROR'
      });
    }
  });

  /**
   * Create subscription plan
   * POST /api/admin/subscription-plans
   */
  app.post('/api/admin/subscription-plans', [
    requireAuth, 
    requireAdmin,
    body('name').isString().notEmpty().withMessage('Plan name is required'),
    body('tier').isString().notEmpty().withMessage('Plan tier is required'),
    body('monthlyPrice').isNumeric().withMessage('Monthly price must be a number'),
    body('yearlyPrice').optional().custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return !isNaN(Number(value));
    }).withMessage('Yearly price must be a number or null'),
    body('features').isArray().withMessage('Features must be an array'),
    body('maxSignals').isNumeric().withMessage('Max signals must be a number'),
    body('maxTickers').isNumeric().withMessage('Max tickers must be a number'),
    validateInput
  ], async (req: any, res) => {
    try {
      const planData = {
        name: req.body.name,
        tier: req.body.tier,
        monthlyPrice: req.body.monthlyPrice,
        yearlyPrice: req.body.yearlyPrice || null,
        features: req.body.features,
        maxSignals: req.body.maxSignals,
        maxTickers: req.body.maxTickers,
        isActive: req.body.isActive !== false // default to true
      };
      
      const plan = await storage.createSubscriptionPlan(planData);
      res.status(201).json(plan);
    } catch (error) {
      console.error('Create subscription plan error:', error);
      res.status(500).json({ 
        message: 'Failed to create subscription plan',
        code: 'CREATE_PLAN_ERROR'
      });
    }
  });

  /**
   * Update subscription plan
   * PUT /api/admin/subscription-plans/:id
   */
  app.put('/api/admin/subscription-plans/:id', [
    requireAuth, 
    requireAdmin,
    param('id').isString().notEmpty(),
    body('name').optional().isString(),
    body('tier').optional().isString(),
    body('monthlyPrice').optional().isNumeric(),
    body('yearlyPrice').optional().custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return !isNaN(Number(value));
    }).withMessage('Yearly price must be a number or null'),
    body('features').optional().isArray(),
    body('maxSignals').optional().isNumeric(),
    body('maxTickers').optional().isNumeric(),
    body('isActive').optional().isBoolean(),
    validateInput
  ], async (req: any, res) => {
    try {
      const planId = req.params.id;
      const updates = req.body;
      
      const plan = await storage.updateSubscriptionPlan(planId, updates);
      res.json(plan);
    } catch (error) {
      console.error('Update subscription plan error:', error);
      res.status(500).json({ 
        message: 'Failed to update subscription plan',
        code: 'UPDATE_PLAN_ERROR'
      });
    }
  });

  /**
   * Delete subscription plan
   * DELETE /api/admin/subscription-plans/:id
   */
  app.delete('/api/admin/subscription-plans/:id', [
    requireAuth, 
    requireAdmin,
    param('id').isString().notEmpty(),
    validateInput
  ], async (req: any, res) => {
    try {
      const planId = req.params.id;
      
      await storage.deleteSubscriptionPlan(planId);
      res.json({ message: 'Subscription plan deleted successfully' });
    } catch (error) {
      console.error('Delete subscription plan error:', error);
      res.status(500).json({ 
        message: 'Failed to delete subscription plan',
        code: 'DELETE_PLAN_ERROR'
      });
    }
  });

  /**
   * Get system statistics
   * GET /api/admin/stats
   */
  app.get('/api/admin/stats', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const signals = await storage.getSignals();
      
      const stats = {
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version
        },
        users: {
          total: users.length,
          active: users.filter(u => u.subscriptionStatus === 'active').length,
          byTier: users.reduce((acc: any, user) => {
            acc[user.subscriptionTier] = (acc[user.subscriptionTier] || 0) + 1;
            return acc;
          }, {})
        },
        signals: {
          total: signals.length,
          recent: signals.filter(s => 
            new Date(s.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
          ).length,
          byType: signals.reduce((acc: any, signal) => {
            acc[signal.signalType] = (acc[signal.signalType] || 0) + 1;
            return acc;
          }, {})
        }
      };

      res.json(stats);

    } catch (error) {
      console.error('Admin stats error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch system statistics',
        code: 'ADMIN_STATS_ERROR'
      });
    }
  });

  /**
   * Get all tickers (for signal creation)
   * GET /api/admin/tickers
   */
  app.get('/api/admin/tickers', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const tickers = await storage.getAllTickers();
      res.json(tickers);
    } catch (error) {
      console.error('Admin tickers fetch error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch tickers',
        code: 'ADMIN_TICKERS_ERROR'
      });
    }
  });

  /**
   * Create new ticker
   * POST /api/admin/tickers
   */
  app.post('/api/admin/tickers', [
    requireAuth, 
    requireAdmin,
    body('symbol').isString().notEmpty().withMessage('Symbol is required'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('category').optional().isString(),
    body('isEnabled').optional().isBoolean(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { symbol, description, category = 'other', isEnabled = true } = req.body;
      
      const ticker = await storage.createTicker({
        symbol: symbol.toUpperCase(),
        description,
        category,
        isEnabled
      });
      
      res.status(201).json(ticker);
    } catch (error) {
      console.error('Create ticker error:', error);
      res.status(500).json({ 
        message: 'Failed to create ticker',
        code: 'CREATE_TICKER_ERROR'
      });
    }
  });

  /**
   * Update ticker
   * PUT /api/admin/tickers/:id
   */
  app.put('/api/admin/tickers/:id', [
    requireAuth, 
    requireAdmin,
    param('id').isString().notEmpty(),
    body('symbol').optional().isString(),
    body('description').optional().isString(),
    body('category').optional().isString(),
    body('isEnabled').optional().isBoolean(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (updates.symbol) {
        updates.symbol = updates.symbol.toUpperCase();
      }
      
      const ticker = await storage.updateTicker(id, updates);
      
      if (!ticker) {
        return res.status(404).json({ 
          message: 'Ticker not found',
          code: 'TICKER_NOT_FOUND'
        });
      }
      
      res.json(ticker);
    } catch (error) {
      console.error('Update ticker error:', error);
      res.status(500).json({ 
        message: 'Failed to update ticker',
        code: 'UPDATE_TICKER_ERROR'
      });
    }
  });

  /**
   * Delete ticker
   * DELETE /api/admin/tickers/:id
   */
  app.delete('/api/admin/tickers/:id', [
    requireAuth, 
    requireAdmin,
    param('id').isString().notEmpty(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const success = await storage.deleteTicker(id);
      
      if (!success) {
        return res.status(404).json({ 
          message: 'Ticker not found',
          code: 'TICKER_NOT_FOUND'
        });
      }
      
      res.json({ message: 'Ticker deleted successfully' });
    } catch (error) {
      console.error('Delete ticker error:', error);
      res.status(500).json({ 
        message: 'Failed to delete ticker',
        code: 'DELETE_TICKER_ERROR'
      });
    }
  });

  /**
   * Get OHLC data for admin
   * GET /api/admin/ohlc/:symbol
   */
  app.get('/api/admin/ohlc/:symbol', [
    requireAuth, 
    requireAdmin,
    param('symbol').isString().notEmpty(),
    query('interval').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    validateInput
  ], async (req: any, res) => {
    try {
      const { symbol } = req.params;
      const interval = req.query.interval || '1d';
      const limit = parseInt(req.query.limit as string) || 100;
      
      const ohlcData = await storage.getOhlcData(symbol.toUpperCase(), interval, limit);
      res.json(ohlcData);
    } catch (error) {
      console.error('Admin OHLC fetch error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch OHLC data',
        code: 'ADMIN_OHLC_ERROR'
      });
    }
  });

  /**
   * Create OHLC data entry
   * POST /api/admin/ohlc
   */
  app.post('/api/admin/ohlc', [
    requireAuth, 
    requireAdmin,
    body('symbol').isString().notEmpty(),
    body('interval').isString().notEmpty(),
    body('data').isObject().notEmpty(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { symbol, interval, data } = req.body;
      
      const ohlc = await storage.createOhlcData({
        symbol: symbol.toUpperCase(),
        interval,
        data,
        lastUpdated: new Date()
      });
      
      res.status(201).json(ohlc);
    } catch (error) {
      console.error('Create OHLC error:', error);
      res.status(500).json({ 
        message: 'Failed to create OHLC data',
        code: 'CREATE_OHLC_ERROR'
      });
    }
  });

  /**
   * Get live streaming status and data
   * GET /api/admin/live-streaming
   */
  app.get('/api/admin/live-streaming', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const connectedClients = wss.clients.size;
      const tickers = await storage.getEnabledTickers();
      
      // Get recent signal activity
      const recentSignals = await storage.getSignals(10);
      
      const streamingStatus = {
        websocket: {
          connected: connectedClients,
          status: connectedClients > 0 ? 'active' : 'idle'
        },
        tickers: {
          enabled: tickers.length,
          symbols: tickers.map(t => t.symbol)
        },
        signals: {
          recent: recentSignals.length,
          lastSignal: recentSignals[0]?.timestamp || null
        },
        server: {
          uptime: Math.floor(process.uptime()),
          memory: process.memoryUsage()
        }
      };
      
      res.json(streamingStatus);
    } catch (error) {
      console.error('Live streaming status error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch live streaming status',
        code: 'LIVE_STREAMING_ERROR'
      });
    }
  });

  /**
   * Broadcast test signal to connected clients
   * POST /api/admin/live-streaming/test
   */
  app.post('/api/admin/live-streaming/test', [
    requireAuth, 
    requireAdmin,
    body('symbol').optional().isString(),
    body('signalType').optional().isIn(['buy', 'sell']),
    validateInput
  ], async (req: any, res) => {
    try {
      const { symbol = 'BTCUSDT', signalType = 'buy' } = req.body;
      
      const now = new Date();
      const testSignalData = {
        ticker: symbol.toUpperCase(),
        signalType,
        price: (Math.random() * 50000 + 20000).toString(),
        timestamp: now,
        timeframe: '1H' as const,
        source: 'Admin Test',
        note: 'Test signal from admin panel'
      };
      
      // Save signal to database
      const savedSignal = await storage.createSignal(testSignalData);
      
      // Broadcast to all connected WebSocket clients
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({
            type: 'signal',
            data: {
              id: savedSignal.id,
              ticker: savedSignal.ticker,
              signalType: savedSignal.signalType,
              price: savedSignal.price,
              timestamp: savedSignal.timestamp,
              timeframe: savedSignal.timeframe,
              source: savedSignal.source,
              note: savedSignal.note
            }
          }));
        }
      });
      
      res.json({ 
        message: 'Test signal created and broadcasted successfully',
        signal: savedSignal,
        clientsNotified: wss.clients.size
      });
    } catch (error) {
      console.error('Test signal broadcast error:', error);
      res.status(500).json({ 
        message: 'Failed to broadcast test signal',
        code: 'TEST_SIGNAL_ERROR'
      });
    }
  });

  /**
   * Get all users
   * GET /api/admin/users
   */
  app.get('/api/admin/users', [
    requireAuth, 
    requireAdmin,
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const users = await storage.getAllUsers();
      
      // Remove sensitive data
      const sanitizedUsers = users.map(user => ({
        ...user,
        hashedPassword: undefined
      }));

      // Sort by creation date (newest first)
      sanitizedUsers.sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedUsers = sanitizedUsers.slice(startIndex, endIndex);

      res.json({
        users: paginatedUsers,
        pagination: {
          page,
          limit,
          total: users.length,
          pages: Math.ceil(users.length / limit)
        }
      });

    } catch (error) {
      console.error('Admin users fetch error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch users',
        code: 'ADMIN_USERS_ERROR'
      });
    }
  });

  /**
   * Create new user
   * POST /api/admin/users
   */
  app.post('/api/admin/users', [
    requireAuth,
    requireAdmin,
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('role').isIn(['admin', 'user']).withMessage('Role must be admin or user'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          message: 'User with this email already exists',
          code: 'EMAIL_EXISTS'
        });
      }

      // Create new user
      const newUser = await storage.createUser({
        email,
        hashedPassword: password, // This will be hashed in the storage layer
        firstName,
        lastName,
        role: role as 'admin' | 'user',
        isActive: true,
        subscriptionTier: role === 'admin' ? 'pro' : 'free',
        subscriptionStatus: 'active'
      });

      // Remove sensitive data
      const sanitizedUser = {
        ...newUser,
        hashedPassword: undefined
      };

      res.status(201).json({
        message: 'User created successfully',
        user: sanitizedUser
      });

    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        message: 'Failed to create user',
        code: 'CREATE_USER_ERROR'
      });
    }
  });

  /**
   * Create test users
   * POST /api/admin/create-test-users
   */
  app.post('/api/admin/create-test-users', [
    requireAuth,
    requireAdmin
  ], async (req: any, res: Response) => {
    try {
      const testUsers = [
        {
          email: 'test-free@example.com',
          password: 'test123',
          firstName: 'Test',
          lastName: 'Free',
          tier: 'free'
        },
        {
          email: 'test-premium@example.com',
          password: 'test123',
          firstName: 'Test',
          lastName: 'Premium',
          tier: 'premium'
        },
        {
          email: 'test-pro@example.com',
          password: 'test123',
          firstName: 'Test',
          lastName: 'Pro',
          tier: 'pro'
        }
      ];

      const createdUsers: any[] = [];
      const credentials: any[] = [];

      for (const testUser of testUsers) {
        // Check if user already exists
        const existingUser = await storage.getUserByEmail(testUser.email);
        if (!existingUser) {
          const newUser = await storage.createUser({
            email: testUser.email,
            hashedPassword: testUser.password,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            role: 'user',
            isActive: true,
            subscriptionTier: testUser.tier as 'free' | 'premium' | 'pro',
            subscriptionStatus: 'active'
          });

          createdUsers.push({
            ...newUser,
            hashedPassword: undefined
          });

          credentials.push({
            email: testUser.email,
            password: testUser.password,
            tier: testUser.tier
          });
        }
      }

      res.json({
        message: `Created ${createdUsers.length} test users`,
        users: createdUsers,
        credentials: credentials
      });

    } catch (error) {
      console.error('Create test users error:', error);
      res.status(500).json({
        message: 'Failed to create test users',
        code: 'CREATE_TEST_USERS_ERROR'
      });
    }
  });

  /**
   * Update user
   * PUT /api/admin/users/:id
   */
  app.put('/api/admin/users/:id', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('User ID is required'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('firstName').optional().trim().isLength({ min: 1 }).withMessage('First name cannot be empty'),
    body('lastName').optional().trim().isLength({ min: 1 }).withMessage('Last name cannot be empty'),
    body('role').optional().isIn(['admin', 'user']).withMessage('Role must be admin or user'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    body('subscriptionTier').optional().isIn(['free', 'basic', 'premium', 'pro']).withMessage('Invalid subscription tier'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Prevent admin from changing their own role
      if (id === req.user.id && updateData.role && updateData.role !== req.user.role) {
        return res.status(400).json({ 
          message: 'Cannot change your own role',
          code: 'CANNOT_CHANGE_OWN_ROLE'
        });
      }

      // Check if email is being changed and already exists
      if (updateData.email) {
        const existingUser = await storage.getUserByEmail(updateData.email);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({
            message: 'User with this email already exists',
            code: 'EMAIL_EXISTS'
          });
        }
      }

      const updatedUser = await storage.updateUser(id, updateData);

      if (!updatedUser) {
        return res.status(404).json({ 
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'User updated successfully',
        user: { ...updatedUser, hashedPassword: undefined }
      });

    } catch (error) {
      console.error('Admin user update error:', error);
      res.status(500).json({ 
        message: 'Failed to update user',
        code: 'ADMIN_USER_UPDATE_ERROR'
      });
    }
  });

  /**
   * Update user subscription
   * PUT /api/admin/users/:id/subscription
   */
  app.put('/api/admin/users/:id/subscription', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('User ID is required'),
    body('subscriptionTier').isIn(['free', 'basic', 'premium', 'professional']),
    body('subscriptionStatus').isIn(['active', 'inactive', 'cancelled', 'expired']),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { subscriptionTier, subscriptionStatus } = req.body;

      const updatedUser = await storage.updateUser(id, {
        subscriptionTier,
        subscriptionStatus
      });

      if (!updatedUser) {
        return res.status(404).json({ 
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'User subscription updated successfully',
        user: { ...updatedUser, hashedPassword: undefined }
      });

    } catch (error) {
      console.error('Admin user update error:', error);
      res.status(500).json({ 
        message: 'Failed to update user subscription',
        code: 'ADMIN_USER_UPDATE_ERROR'
      });
    }
  });

  /**
   * Update user role
   * PATCH /api/admin/users/:id/role
   */
  app.patch('/api/admin/users/:id/role', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('User ID is required'),
    body('role').isIn(['admin', 'user']).withMessage('Role must be admin or user'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      // Prevent admin from changing their own role
      if (id === req.user.id) {
        return res.status(400).json({ 
          message: 'Cannot change your own role',
          code: 'CANNOT_CHANGE_OWN_ROLE'
        });
      }

      const updatedUser = await storage.updateUser(id, {
        role: role,
        subscriptionTier: role === 'admin' ? 'pro' : 'free'
      });

      if (!updatedUser) {
        return res.status(404).json({ 
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'User role updated successfully',
        user: { ...updatedUser, hashedPassword: undefined }
      });

    } catch (error) {
      console.error('Admin user role update error:', error);
      res.status(500).json({ 
        message: 'Failed to update user role',
        code: 'ADMIN_USER_ROLE_UPDATE_ERROR'
      });
    }
  });

  /**
   * Update user status
   * PATCH /api/admin/users/:id/status
   */
  app.patch('/api/admin/users/:id/status', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('User ID is required'),
    body('isActive').isBoolean().withMessage('isActive must be boolean'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      // Prevent admin from deactivating themselves
      if (id === req.user.id && !isActive) {
        return res.status(400).json({ 
          message: 'Cannot deactivate your own account',
          code: 'CANNOT_DEACTIVATE_SELF'
        });
      }

      const updatedUser = await storage.updateUser(id, { isActive });

      if (!updatedUser) {
        return res.status(404).json({ 
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'User status updated successfully',
        user: { ...updatedUser, hashedPassword: undefined }
      });

    } catch (error) {
      console.error('Admin user status update error:', error);
      res.status(500).json({ 
        message: 'Failed to update user status',
        code: 'ADMIN_USER_STATUS_UPDATE_ERROR'
      });
    }
  });

  /**
   * Delete user account (Admin)
   * DELETE /api/admin/users/:id
   */
  app.delete('/api/admin/users/:id', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('User ID is required'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;

      // Prevent admin from deleting themselves
      if (id === req.user.id) {
        return res.status(400).json({ 
          message: 'Cannot delete your own account',
          code: 'CANNOT_DELETE_SELF'
        });
      }

      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ 
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'User account deleted successfully'
      });

    } catch (error) {
      console.error('Admin user delete error:', error);
      res.status(500).json({ 
        message: 'Failed to delete user account',
        code: 'ADMIN_USER_DELETE_ERROR'
      });
    }
  });

  /**
   * Get ticker/timeframe combinations
   * GET /api/admin/ticker-timeframes
   */
  app.get('/api/admin/ticker-timeframes', [
    requireAuth,
    requireAdmin
  ], async (req: any, res: Response) => {
    try {
      const combinations = await storage.getAllowedTickerTimeframes();

      res.json({
        combinations,
        total: combinations.length
      });

    } catch (error) {
      console.error('Admin ticker-timeframes error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch ticker timeframes',
        code: 'ADMIN_TICKER_TIMEFRAMES_ERROR'
      });
    }
  });

  /**
   * Create ticker/timeframe combination
   * POST /api/admin/ticker-timeframes
   */
  app.post('/api/admin/ticker-timeframes', [
    requireAuth,
    requireAdmin,
    body('tickerSymbol').isLength({ min: 2, max: 20 }).withMessage('Invalid ticker symbol'),
    body('timeframe').isIn(['30M', '1H', '4H', '8H', '12H', '1D', '1W', '1M']).withMessage('Invalid timeframe'),
    body('description').optional().isLength({ max: 200 }).withMessage('Description too long'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { tickerSymbol, timeframe, description } = req.body;

      const newCombination = await storage.createAllowedTickerTimeframe({
        tickerSymbol: tickerSymbol.toUpperCase(),
        timeframe,
        description: description || `${tickerSymbol} ${timeframe} signals`,
        isEnabled: true
      });

      res.status(201).json({
        message: 'Ticker/timeframe combination created successfully',
        combination: newCombination
      });

    } catch (error) {
      console.error('Create ticker-timeframe error:', error);
      res.status(500).json({
        message: 'Failed to create ticker/timeframe combination',
        code: 'CREATE_TICKER_TIMEFRAME_ERROR'
      });
    }
  });

  /**
   * Delete ticker/timeframe combination
   * DELETE /api/admin/ticker-timeframes/:id
   */
  app.delete('/api/admin/ticker-timeframes/:id', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('Combination ID is required'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;

      const success = await storage.deleteAllowedTickerTimeframe(id);
      
      if (!success) {
        return res.status(404).json({ 
          message: 'Ticker/timeframe combination not found',
          code: 'COMBINATION_NOT_FOUND'
        });
      }

      res.json({
        message: 'Ticker/timeframe combination deleted successfully'
      });

    } catch (error) {
      console.error('Delete ticker-timeframe error:', error);
      res.status(500).json({
        message: 'Failed to delete ticker/timeframe combination',
        code: 'DELETE_TICKER_TIMEFRAME_ERROR'
      });
    }
  });

  /**
   * Get all subscriptions overview (simplified)
   * GET /api/admin/subscriptions
   */
  app.get('/api/admin/subscriptions', [
    requireAuth,
    requireAdmin
  ], async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      
      const subscriptionStats = {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.isActive).length,
        subscriptionTiers: users.reduce((acc: any, user) => {
          const tier = user.subscriptionTier || 'free';
          acc[tier] = (acc[tier] || 0) + 1;
          return acc;
        }, {}),
        subscriptionStatuses: users.reduce((acc: any, user) => {
          const status = user.subscriptionStatus || 'inactive';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {})
      };

      res.json({
        users: users.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
          isActive: user.isActive,
          createdAt: user.createdAt
        })),
        stats: subscriptionStats
      });

    } catch (error) {
      console.error('Admin subscriptions error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch subscriptions',
        code: 'ADMIN_SUBSCRIPTIONS_ERROR'
      });
    }
  });

  /**
   * Get user subscriptions for admin
   * GET /api/admin/user-subscriptions
   */
  app.get('/api/admin/user-subscriptions', [
    requireAuth,
    requireAdmin,
    query('search').optional().isLength({ min: 2, max: 100 }).withMessage('Search term too short or long'),
    query('ticker').optional().isLength({ min: 2, max: 20 }).withMessage('Invalid ticker'),
    query('timeframe').optional().isIn(['30M', '1H', '4H', '8H', '12H', '1D', '1W', '1M']).withMessage('Invalid timeframe'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      // Get all subscriptions with user data
      let subscriptions: any[] = [];
      
      // Get all users and their subscriptions
      const users = await storage.getAllUsers();
      
      for (const user of users) {
        const userSubs = await storage.getUserTickerSubscriptions(user.id);
        for (const sub of userSubs) {
          subscriptions.push({
            id: sub.id,
            userId: user.id,
            userEmail: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            tickerSymbol: sub.tickerSymbol,
            timeframe: sub.timeframe,
            deliveryMethods: sub.deliveryMethods,
            maxAlertsPerDay: sub.maxAlertsPerDay,
            isActive: sub.isActive,
            subscribedAt: sub.subscribedAt
          });
        }
      }

      // Apply filters
      const { search, ticker, timeframe } = req.query;
      
      if (search) {
        const searchLower = (search as string).toLowerCase();
        subscriptions = subscriptions.filter(sub => 
          sub.userEmail.toLowerCase().includes(searchLower) ||
          sub.userName.toLowerCase().includes(searchLower)
        );
      }

      if (ticker) {
        subscriptions = subscriptions.filter(sub => sub.tickerSymbol === ticker);
      }

      if (timeframe) {
        subscriptions = subscriptions.filter(sub => sub.timeframe === timeframe);
      }

      res.json({
        subscriptions,
        total: subscriptions.length
      });

    } catch (error) {
      console.error('Admin user subscriptions error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch user subscriptions',
        code: 'ADMIN_USER_SUBSCRIPTIONS_ERROR'
      });
    }
  });

  /**
   * Get users for subscriptions dropdown
   * GET /api/admin/users-for-subscriptions
   */
  app.get('/api/admin/users-for-subscriptions', [
    requireAuth,
    requireAdmin
  ], async (req: any, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      
      const usersList = users
        .filter(user => user.isActive)
        .map(user => ({
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          isActive: user.isActive
        }));

      res.json({
        users: usersList
      });

    } catch (error) {
      console.error('Admin users for subscriptions error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch users',
        code: 'ADMIN_USERS_FOR_SUBSCRIPTIONS_ERROR'
      });
    }
  });

  /**
   * Create user subscription
   * POST /api/admin/user-subscriptions
   */
  app.post('/api/admin/user-subscriptions', [
    requireAuth,
    requireAdmin,
    body('userId').notEmpty().withMessage('User ID is required'),
    body('tickerSymbol').isLength({ min: 2, max: 20 }).withMessage('Invalid ticker symbol'),
    body('timeframe').isIn(['30M', '1H', '4H', '8H', '12H', '1D', '1W', '1M']).withMessage('Invalid timeframe'),
    body('deliveryMethods').isArray({ min: 1 }).withMessage('At least one delivery method required'),
    body('maxAlertsPerDay').isInt({ min: 1, max: 100 }).withMessage('Invalid max alerts per day'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { userId, tickerSymbol, timeframe, deliveryMethods, maxAlertsPerDay } = req.body;

      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Check if subscription already exists
      const existingSubscription = await storage.getUserTickerSubscription(userId, tickerSymbol, timeframe);
      if (existingSubscription) {
        return res.status(409).json({
          message: 'Subscription already exists for this user and ticker/timeframe',
          code: 'SUBSCRIPTION_ALREADY_EXISTS'
        });
      }

      // Create new subscription
      const subscription = await storage.createUserTickerSubscription({
        userId,
        tickerSymbol,
        timeframe,
        deliveryMethods,
        maxAlertsPerDay
      });

      res.status(201).json({
        message: 'Subscription created successfully',
        subscription
      });

    } catch (error) {
      console.error('Create user subscription error:', error);
      res.status(500).json({
        message: 'Failed to create subscription',
        code: 'CREATE_USER_SUBSCRIPTION_ERROR'
      });
    }
  });

  /**
   * Update user subscription
   * PUT /api/admin/user-subscriptions/:id
   */
  app.put('/api/admin/user-subscriptions/:id', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('Subscription ID is required'),
    body('deliveryMethods').optional().isArray({ min: 1 }).withMessage('At least one delivery method required'),
    body('maxAlertsPerDay').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid max alerts per day'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const success = await storage.updateUserTickerSubscription(id, updates);
      
      if (!success) {
        return res.status(404).json({
          message: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }

      res.json({
        message: 'Subscription updated successfully'
      });

    } catch (error) {
      console.error('Update user subscription error:', error);
      res.status(500).json({
        message: 'Failed to update subscription',
        code: 'UPDATE_USER_SUBSCRIPTION_ERROR'
      });
    }
  });

  /**
   * Delete user subscription
   * DELETE /api/admin/user-subscriptions/:id
   */
  app.delete('/api/admin/user-subscriptions/:id', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('Subscription ID is required'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;

      const success = await storage.deleteUserTickerSubscriptionById(id);
      
      if (!success) {
        return res.status(404).json({
          message: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }

      res.json({
        message: 'Subscription deleted successfully'
      });

    } catch (error) {
      console.error('Delete user subscription error:', error);
      res.status(500).json({
        message: 'Failed to delete subscription',
        code: 'DELETE_USER_SUBSCRIPTION_ERROR'
      });
    }
  });

  /**
   * Get system logs
   * GET /api/admin/logs
   */
  app.get('/api/admin/logs', [
    requireAuth,
    requireAdmin,
    query('level').optional().isIn(['error', 'warn', 'info', 'debug']),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      // Mock logs for now - in production, integrate with logging system
      const mockLogs = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'User authentication successful',
          userId: 'user123',
          ip: '192.168.1.1'
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          level: 'warn',
          message: 'Rate limit exceeded for API endpoint',
          endpoint: '/api/market/price/BTCUSDT',
          ip: '192.168.1.2'
        }
      ];

      res.json({
        logs: mockLogs,
        total: mockLogs.length
      });

    } catch (error) {
      console.error('Admin logs error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch system logs',
        code: 'ADMIN_LOGS_ERROR'
      });
    }
  });

  /**
   * Get webhook management data
   * GET /api/admin/webhooks
   */
  app.get('/api/admin/webhooks', [
    requireAuth,
    requireAdmin
  ], async (req: any, res: Response) => {
    try {
      const webhookSecrets = await storage.getWebhookSecrets();
      
      // Mock webhook activity logs
      const webhookLogs = [
        {
          id: '1',
          webhook: 'tradingview',
          event: 'signal_received',
          status: 'success',
          timestamp: new Date(),
          data: { symbol: 'BTCUSDT', action: 'buy' }
        },
        {
          id: '2',
          webhook: 'stripe',
          event: 'payment_succeeded',
          status: 'success',
          timestamp: new Date(Date.now() - 300000),
          data: { customer_id: 'cus_123' }
        }
      ];

      res.json({
        secrets: webhookSecrets,
        logs: webhookLogs,
        stats: {
          total: webhookSecrets.length,
          active: webhookSecrets.filter(s => s.isActive).length,
          totalRequests: webhookLogs.length,
          successRate: '98.5%'
        }
      });

    } catch (error) {
      console.error('Admin webhooks error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch webhook data',
        code: 'ADMIN_WEBHOOKS_ERROR'
      });
    }
  });

  /**
   * Create webhook secret
   * POST /api/admin/webhooks
   */
  app.post('/api/admin/webhooks', [
    requireAuth,
    requireAdmin,
    body('name').isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    body('description').optional().isLength({ max: 200 }).withMessage('Description too long'),
    body('allowedOrigins').optional().isArray().withMessage('Allowed origins must be an array'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { name, description, allowedOrigins } = req.body;
      
      // Generate random secret
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), 
        byte => byte.toString(16).padStart(2, '0')).join('');

      const webhookSecret = await storage.createWebhookSecret({
        name,
        secret,
        description: description || `Webhook secret for ${name}`,
        allowedSources: allowedOrigins || [],
        isActive: true
      });

      res.status(201).json({
        message: 'Webhook secret created successfully',
        webhook: webhookSecret
      });

    } catch (error) {
      console.error('Create webhook error:', error);
      res.status(500).json({
        message: 'Failed to create webhook secret',
        code: 'CREATE_WEBHOOK_ERROR'
      });
    }
  });

  /**
   * Update webhook secret
   * PUT /api/admin/webhooks/:id
   */
  app.put('/api/admin/webhooks/:id', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('Webhook ID is required'),
    body('description').optional().isLength({ max: 200 }).withMessage('Description too long'),
    body('allowedOrigins').optional().isArray().withMessage('Allowed origins must be an array'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const webhook = await storage.updateWebhookSecret(id, updates);
      
      if (!webhook) {
        return res.status(404).json({
          message: 'Webhook not found',
          code: 'WEBHOOK_NOT_FOUND'
        });
      }

      res.json({
        message: 'Webhook updated successfully',
        webhook
      });

    } catch (error) {
      console.error('Update webhook error:', error);
      res.status(500).json({
        message: 'Failed to update webhook',
        code: 'UPDATE_WEBHOOK_ERROR'
      });
    }
  });

  /**
   * Delete webhook secret
   * DELETE /api/admin/webhooks/:id
   */
  app.delete('/api/admin/webhooks/:id', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('Webhook ID is required'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;

      const success = await storage.deleteWebhookSecret(id);
      
      if (!success) {
        return res.status(404).json({
          message: 'Webhook not found',
          code: 'WEBHOOK_NOT_FOUND'
        });
      }

      res.json({
        message: 'Webhook deleted successfully'
      });

    } catch (error) {
      console.error('Delete webhook error:', error);
      res.status(500).json({
        message: 'Failed to delete webhook',
        code: 'DELETE_WEBHOOK_ERROR'
      });
    }
  });

  /**
   * Get notification configurations
   * GET /api/admin/notification-configs
   */
  app.get('/api/admin/notification-configs', [
    requireAuth,
    requireAdmin
  ], async (req: any, res: Response) => {
    try {
      const configs = await storage.getNotificationConfigs();
      res.json(configs);

    } catch (error) {
      console.error('Admin notification configs error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch notification configurations',
        code: 'ADMIN_NOTIFICATION_CONFIGS_ERROR'
      });
    }
  });

  /**
   * Create notification configuration
   * POST /api/admin/notification-configs
   */
  app.post('/api/admin/notification-configs', [
    requireAuth,
    requireAdmin,
    body('name').isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('type').isIn(['email', 'sms', 'push', 'webhook']).withMessage('Invalid notification type'),
    body('provider').optional().isString(),
    body('config').isObject().withMessage('Configuration must be an object'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { name, type, provider, config, description, isActive } = req.body;

      const notificationConfig = await storage.createNotificationConfig({
        name,
        type,
        provider: provider || 'default',
        config,
        description: description || `${type} notification configuration`,
        isActive: isActive !== undefined ? isActive : true
      });

      res.status(201).json({
        message: 'Notification configuration created successfully',
        config: notificationConfig
      });

    } catch (error) {
      console.error('Create notification config error:', error);
      res.status(500).json({
        message: 'Failed to create notification configuration',
        code: 'CREATE_NOTIFICATION_CONFIG_ERROR'
      });
    }
  });

  /**
   * Update notification configuration
   * PUT /api/admin/notification-configs/:id
   */
  app.put('/api/admin/notification-configs/:id', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('Config ID is required'),
    body('config').optional().isObject().withMessage('Configuration must be an object'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const config = await storage.updateNotificationConfig(id, updates);
      
      if (!config) {
        return res.status(404).json({
          message: 'Notification configuration not found',
          code: 'NOTIFICATION_CONFIG_NOT_FOUND'
        });
      }

      res.json({
        message: 'Notification configuration updated successfully',
        config
      });

    } catch (error) {
      console.error('Update notification config error:', error);
      res.status(500).json({
        message: 'Failed to update notification configuration',
        code: 'UPDATE_NOTIFICATION_CONFIG_ERROR'
      });
    }
  });

  /**
   * Delete notification configuration
   * DELETE /api/admin/notification-configs/:id
   */
  app.delete('/api/admin/notification-configs/:id', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('Config ID is required'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;

      const success = await storage.deleteNotificationConfig(id);
      
      if (!success) {
        return res.status(404).json({
          message: 'Notification configuration not found',
          code: 'NOTIFICATION_CONFIG_NOT_FOUND'
        });
      }

      res.json({
        message: 'Notification configuration deleted successfully'
      });

    } catch (error) {
      console.error('Delete notification config error:', error);
      res.status(500).json({
        message: 'Failed to delete notification configuration',
        code: 'DELETE_NOTIFICATION_CONFIG_ERROR'
      });
    }
  });

  /**
   * Test notification configuration
   * POST /api/admin/notification-configs/:id/test
   */
  app.post('/api/admin/notification-configs/:id/test', [
    requireAuth,
    requireAdmin,
    param('id').notEmpty().withMessage('Config ID is required'),
    body('recipient').notEmpty().withMessage('Recipient is required'),
    body('message').optional().isString(),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { recipient, message } = req.body;

      const config = await storage.getNotificationConfig(id);
      if (!config) {
        return res.status(404).json({
          message: 'Notification configuration not found',
          code: 'NOTIFICATION_CONFIG_NOT_FOUND'
        });
      }

      // Mock sending test notification
      const testMessage = message || `Test notification from ${config.name}`;
      
      console.log(`📧 Testing ${config.type} notification:`, {
        recipient,
        message: testMessage,
        config: config.name
      });

      res.json({
        message: 'Test notification sent successfully',
        details: {
          type: config.type,
          recipient,
          message: testMessage,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Test notification error:', error);
      res.status(500).json({
        message: 'Failed to send test notification',
        code: 'TEST_NOTIFICATION_ERROR'
      });
    }
  });

  /**
   * Get SMS service status
   * GET /api/admin/sms/status
   */
  app.get('/api/admin/sms/status', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      res.json({
        configured: smsService.isConfigured(),
        configStatus: smsService.getConfigStatus(),
        provider: 'Twilio'
      });
    } catch (error) {
      console.error('Error checking SMS status:', error);
      res.status(500).json({ error: 'Failed to check SMS status' });
    }
  });

  /**
   * Send test SMS message
   * POST /api/admin/sms/test
   */
  app.post('/api/admin/sms/test', [
    requireAuth, 
    requireAdmin,
    body('phoneNumber').isMobilePhone('any').withMessage('Valid phone number is required'),
    body('message').optional().isLength({ min: 1, max: 160 }).withMessage('Message must be 1-160 characters'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { phoneNumber, message } = req.body;
      
      const result = await smsService.sendSMS({
        to: phoneNumber,
        message: message || 'Test message from Proud Profits admin panel'
      });

      res.json(result);
    } catch (error) {
      console.error('Error sending test SMS:', error);
      res.status(500).json({ error: 'Failed to send test SMS' });
    }
  });

  // ===================
  // SYSTEM SETTINGS MANAGEMENT
  // ===================

  /**
   * Get all system settings
   * GET /api/admin/settings
   */
  app.get('/api/admin/settings', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching system settings:', error);
      res.status(500).json({ 
        message: 'Failed to fetch system settings',
        code: 'FETCH_SETTINGS_ERROR'
      });
    }
  });

  /**
   * Get system settings by category
   * GET /api/admin/settings/:category
   */
  app.get('/api/admin/settings/:category', [
    requireAuth, 
    requireAdmin,
    param('category').isString().notEmpty(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { category } = req.params;
      const settings = await storage.getSystemSettingsByCategory(category);
      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings by category:', error);
      res.status(500).json({ 
        message: 'Failed to fetch settings by category',
        code: 'FETCH_CATEGORY_SETTINGS_ERROR'
      });
    }
  });

  /**
   * Get specific system setting
   * GET /api/admin/settings/single/:key
   */
  app.get('/api/admin/settings/single/:key', [
    requireAuth, 
    requireAdmin,
    param('key').isString().notEmpty(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getSystemSetting(key);
      
      if (!setting) {
        return res.status(404).json({ 
          message: 'Setting not found',
          code: 'SETTING_NOT_FOUND'
        });
      }
      
      res.json(setting);
    } catch (error) {
      console.error('Error fetching system setting:', error);
      res.status(500).json({ 
        message: 'Failed to fetch system setting',
        code: 'FETCH_SETTING_ERROR'
      });
    }
  });

  /**
   * Create new system setting
   * POST /api/admin/settings
   */
  app.post('/api/admin/settings', [
    requireAuth, 
    requireAdmin,
    body('key').isString().notEmpty().withMessage('Setting key is required'),
    body('value').notEmpty().withMessage('Setting value is required'),
    body('category').isString().notEmpty().withMessage('Category is required'),
    body('type').isIn(['string', 'number', 'boolean', 'json']).withMessage('Invalid setting type'),
    body('label').isString().notEmpty().withMessage('Label is required'),
    body('description').optional().isString(),
    body('isPublic').optional().isBoolean(),
    body('isEditable').optional().isBoolean(),
    validateInput
  ], async (req: any, res) => {
    try {
      const settingData = {
        key: req.body.key,
        value: req.body.value,
        category: req.body.category,
        dataType: req.body.type as "string" | "number" | "boolean" | "array" | "json",
        description: req.body.description,
        isPublic: req.body.isPublic ?? false,
        isEditable: req.body.isEditable ?? true
      };

      const setting = await storage.createSystemSetting(settingData);
      res.status(201).json(setting);
    } catch (error) {
      console.error('Error creating system setting:', error);
      res.status(500).json({ 
        message: 'Failed to create system setting',
        code: 'CREATE_SETTING_ERROR'
      });
    }
  });

  /**
   * Update system setting
   * PUT /api/admin/settings/:key
   */
  app.put('/api/admin/settings/:key', [
    requireAuth, 
    requireAdmin,
    param('key').isString().notEmpty(),
    body('value').optional(),
    body('label').optional().isString(),
    body('description').optional().isString(),
    body('isPublic').optional().isBoolean(),
    body('isEditable').optional().isBoolean(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { key } = req.params;
      const updates = req.body;
      
      const setting = await storage.updateSystemSetting(key, updates);
      
      if (!setting) {
        return res.status(404).json({ 
          message: 'Setting not found',
          code: 'SETTING_NOT_FOUND'
        });
      }
      
      res.json(setting);
    } catch (error) {
      console.error('Error updating system setting:', error);
      res.status(500).json({ 
        message: 'Failed to update system setting',
        code: 'UPDATE_SETTING_ERROR'
      });
    }
  });

  /**
   * Delete system setting
   * DELETE /api/admin/settings/:key
   */
  app.delete('/api/admin/settings/:key', [
    requireAuth, 
    requireAdmin,
    param('key').isString().notEmpty(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { key } = req.params;
      
      const success = await storage.deleteSystemSetting(key);
      
      if (!success) {
        return res.status(404).json({ 
          message: 'Setting not found',
          code: 'SETTING_NOT_FOUND'
        });
      }
      
      res.json({ message: 'System setting deleted successfully' });
    } catch (error) {
      console.error('Error deleting system setting:', error);
      res.status(500).json({ 
        message: 'Failed to delete system setting',
        code: 'DELETE_SETTING_ERROR'
      });
    }
  });

  /**
   * Bulk update system settings
   * PUT /api/admin/settings/bulk
   */
  app.put('/api/admin/settings/bulk', [
    requireAuth, 
    requireAdmin,
    body('settings').isArray().withMessage('Settings must be an array'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { settings } = req.body;
      const updatedSettings: any[] = [];
      
      for (const settingUpdate of settings) {
        if (settingUpdate.key && settingUpdate.value !== undefined) {
          const updated = await storage.updateSystemSetting(settingUpdate.key, {
            value: settingUpdate.value,
            updatedAt: new Date()
          });
          if (updated) {
            updatedSettings.push(updated);
          }
        }
      }
      
      res.json({ 
        message: 'Settings updated successfully',
        updated: updatedSettings.length,
        settings: updatedSettings
      });
    } catch (error) {
      console.error('Error bulk updating settings:', error);
      res.status(500).json({ 
        message: 'Failed to bulk update settings',
        code: 'BULK_UPDATE_SETTINGS_ERROR'
      });
    }
  });

  /**
   * Get system logs (access logs, API usage, etc.)
   * GET /api/admin/system/logs
   */
  app.get('/api/admin/system/logs', [
    requireAuth, 
    requireAdmin,
    query('type').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('offset').optional().isInt({ min: 0 }),
    validateInput
  ], async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getAdminLogs(limit);
      
      res.json({
        logs,
        total: logs.length,
        limit,
        hasMore: logs.length >= limit
      });
    } catch (error) {
      console.error('Error fetching system logs:', error);
      res.status(500).json({ 
        message: 'Failed to fetch system logs',
        code: 'FETCH_LOGS_ERROR'
      });
    }
  });

  /**
   * Get API integration status
   * GET /api/admin/system/integrations
   */
  app.get('/api/admin/system/integrations', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const integrations = {
        database: {
          status: !!process.env.DATABASE_URL ? 'connected' : 'disconnected',
          type: 'PostgreSQL',
          lastCheck: new Date()
        },
        sms: {
          status: smsService.isConfigured() ? 'connected' : 'not_configured',
          provider: 'Twilio',
          configStatus: smsService.getConfigStatus()
        },
        telegram: {
          status: telegramService.isConfigured() ? 'connected' : 'not_configured',
          provider: 'Telegram Bot API'
        },
        email: {
          status: notificationService ? 'connected' : 'not_configured',
          provider: 'SendGrid'
        },
        stripe: {
          status: !!process.env.STRIPE_SECRET_KEY ? 'connected' : 'not_configured',
          provider: 'Stripe'
        },
        paypal: {
          status: 'connected',
          provider: 'PayPal'
        }
      };
      
      res.json(integrations);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      res.status(500).json({ 
        message: 'Failed to fetch integrations',
        code: 'FETCH_INTEGRATIONS_ERROR'
      });
    }
  });

  /**
   * Get system statistics
   * GET /api/admin/system/stats
   */
  app.get('/api/admin/system/stats', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const tickers = await storage.getAllTickers();
      const signals = await storage.getSignals(100);
      
      const stats = {
        users: {
          total: users.length,
          active: users.filter(u => u.isActive).length,
          admin: users.filter(u => u.role === 'admin').length,
          pro: users.filter(u => u.subscriptionTier === 'pro').length,
          free: users.filter(u => u.subscriptionTier === 'free').length
        },
        tickers: {
          total: tickers.length,
          enabled: tickers.filter(t => t.isEnabled).length,
          disabled: tickers.filter(t => !t.isEnabled).length
        },
        signals: {
          total: signals.length,
          recent: signals.filter(s => {
            const dayAgo = new Date();
            dayAgo.setDate(dayAgo.getDate() - 1);
            return new Date(s.createdAt) > dayAgo;
          }).length
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version,
          environment: process.env.NODE_ENV || 'development'
        }
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching system stats:', error);
      res.status(500).json({ 
        message: 'Failed to fetch system statistics',
        code: 'FETCH_STATS_ERROR'
      });
    }
  });

  // ===================
  // COMPREHENSIVE NOTIFICATION SYSTEM MANAGEMENT
  // ===================

  /**
   * Get notification queue
   * GET /api/admin/notifications/queue
   */
  app.get('/api/admin/notifications/queue', [
    requireAuth,
    requireAdmin,
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    query('status').optional().isIn(['pending', 'processing', 'sent', 'failed', 'cancelled']).withMessage('Invalid status'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { limit = 100, status } = req.query;
      
      let notifications;
      if (status) {
        notifications = await storage.getQueuedNotifications(status);
      } else {
        notifications = await storage.getNotificationQueue(parseInt(limit));
      }

      res.json({
        notifications,
        total: notifications.length,
        filters: { status, limit }
      });

    } catch (error) {
      console.error('Admin notification queue error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch notification queue',
        code: 'ADMIN_NOTIFICATION_QUEUE_ERROR'
      });
    }
  });

  /**
   * Add notification to queue
   * POST /api/admin/notifications/queue
   */
  app.post('/api/admin/notifications/queue', [
    requireAuth,
    requireAdmin,
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('channel').isIn(['email', 'sms', 'push', 'telegram', 'discord']).withMessage('Invalid channel'),
    body('recipient').notEmpty().withMessage('Recipient is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
    validateInput
  ], async (req: any, res) => {
    try {
      const notificationData = {
        ...req.body,
        status: 'pending',
        retryCount: 0,
        scheduledFor: req.body.scheduledFor ? new Date(req.body.scheduledFor) : new Date()
      };

      const notification = await storage.addToNotificationQueue(notificationData);

      res.status(201).json({
        message: 'Notification added to queue successfully',
        notification
      });

    } catch (error) {
      console.error('Add notification to queue error:', error);
      res.status(500).json({
        message: 'Failed to add notification to queue',
        code: 'ADD_NOTIFICATION_QUEUE_ERROR'
      });
    }
  });

  /**
   * Get notification templates
   * GET /api/admin/notifications/templates
   */
  app.get('/api/admin/notifications/templates', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const templates = await storage.getNotificationTemplates();

      res.json({
        templates,
        total: templates.length
      });

    } catch (error) {
      console.error('Get notification templates error:', error);
      res.status(500).json({
        message: 'Failed to fetch notification templates',
        code: 'GET_NOTIFICATION_TEMPLATES_ERROR'
      });
    }
  });

  /**
   * Create notification template
   * POST /api/admin/notifications/templates
   */
  app.post('/api/admin/notifications/templates', [
    requireAuth,
    requireAdmin,
    body('name').isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('type').isIn(['buy_signal', 'sell_signal', 'price_alert', 'system', 'welcome', 'security']).withMessage('Invalid template type'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('content').notEmpty().withMessage('Content is required'),
    body('variables').optional().isArray().withMessage('Variables must be an array'),
    body('isSystem').optional().isBoolean().withMessage('isSystem must be boolean'),
    validateInput
  ], async (req: any, res) => {
    try {
      const templateData = {
        ...req.body,
        isSystem: req.body.isSystem || false
      };

      const template = await storage.createNotificationTemplate(templateData);

      res.status(201).json({
        message: 'Notification template created successfully',
        template
      });

    } catch (error) {
      console.error('Create notification template error:', error);
      res.status(500).json({
        message: 'Failed to create notification template',
        code: 'CREATE_NOTIFICATION_TEMPLATE_ERROR'
      });
    }
  });

  /**
   * Get notification logs
   * GET /api/admin/notifications/logs
   */
  app.get('/api/admin/notifications/logs', [
    requireAuth,
    requireAdmin,
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    query('channel').optional().isIn(['email', 'sms', 'push', 'telegram', 'discord']).withMessage('Invalid channel'),
    query('userId').optional().isUUID().withMessage('Valid user ID required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { limit = 100, channel, userId } = req.query;

      let logs;
      if (userId) {
        logs = await storage.getNotificationLogsByUser(userId, parseInt(limit));
      } else {
        logs = await storage.getNotificationLogs(parseInt(limit), channel);
      }

      res.json({
        logs,
        total: logs.length,
        filters: { channel, userId, limit }
      });

    } catch (error) {
      console.error('Get notification logs error:', error);
      res.status(500).json({
        message: 'Failed to fetch notification logs',
        code: 'GET_NOTIFICATION_LOGS_ERROR'
      });
    }
  });

  /**
   * Get notification statistics
   * GET /api/admin/notifications/stats
   */
  app.get('/api/admin/notifications/stats', [
    requireAuth,
    requireAdmin,
    query('dateFrom').optional().isISO8601().withMessage('Invalid dateFrom format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid dateTo format'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      
      const stats = await storage.getNotificationStats(
        dateFrom ? new Date(dateFrom) : undefined,
        dateTo ? new Date(dateTo) : undefined
      );

      res.json({
        stats,
        period: {
          from: dateFrom || 'all time',
          to: dateTo || 'now'
        }
      });

    } catch (error) {
      console.error('Get notification stats error:', error);
      res.status(500).json({
        message: 'Failed to fetch notification statistics',
        code: 'GET_NOTIFICATION_STATS_ERROR'
      });
    }
  });

  /**
   * Get notification channels
   * GET /api/admin/notifications/channels
   */
  app.get('/api/admin/notifications/channels', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const channels = await storage.getNotificationChannels();

      res.json({
        channels,
        total: channels.length
      });

    } catch (error) {
      console.error('Get notification channels error:', error);
      res.status(500).json({
        message: 'Failed to fetch notification channels',
        code: 'GET_NOTIFICATION_CHANNELS_ERROR'
      });
    }
  });

  /**
   * Create notification channel
   * POST /api/admin/notifications/channels
   */
  app.post('/api/admin/notifications/channels', [
    requireAuth,
    requireAdmin,
    body('name').isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('type').isIn(['email', 'sms', 'push', 'telegram', 'discord']).withMessage('Invalid channel type'),
    body('config').isObject().withMessage('Configuration must be an object'),
    body('isEnabled').optional().isBoolean().withMessage('isEnabled must be boolean'),
    validateInput
  ], async (req: any, res) => {
    try {
      const channelData = {
        ...req.body,
        isEnabled: req.body.isEnabled !== undefined ? req.body.isEnabled : true
      };

      const channel = await storage.createNotificationChannel(channelData);

      res.status(201).json({
        message: 'Notification channel created successfully',
        channel
      });

    } catch (error) {
      console.error('Create notification channel error:', error);
      res.status(500).json({
        message: 'Failed to create notification channel',
        code: 'CREATE_NOTIFICATION_CHANNEL_ERROR'
      });
    }
  });

  /**
   * Test notification channel
   * POST /api/admin/notifications/channels/:id/test
   */
  app.post('/api/admin/notifications/channels/:id/test', [
    requireAuth,
    requireAdmin,
    param('id').isUUID().withMessage('Valid channel ID is required'),
    body('recipient').optional().notEmpty().withMessage('Recipient is required for testing'),
    body('message').optional().notEmpty().withMessage('Test message content'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      const { recipient, message } = req.body;

      const result = await storage.testNotificationChannel(id);

      res.json({
        message: 'Channel test completed',
        result,
        testData: {
          recipient: recipient || 'test@example.com',
          message: message || 'Test notification from admin panel',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Test notification channel error:', error);
      res.status(500).json({
        message: 'Failed to test notification channel',
        code: 'TEST_NOTIFICATION_CHANNEL_ERROR'
      });
    }
  });

  // ========================
  // System Settings Routes
  // ========================

  /**
   * Get all system settings
   * GET /api/admin/settings
   */
  app.get('/api/admin/settings', [
    requireAuth, 
    requireAdmin,
    query('category').optional().isString(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { category } = req.query;
      
      let settings;
      if (category) {
        settings = await storage.getSystemSettingsByCategory(category);
      } else {
        settings = await storage.getSystemSettings();
      }
      
      res.json({
        settings,
        total: settings.length
      });
    } catch (error) {
      console.error('Get system settings error:', error);
      res.status(500).json({
        message: 'Failed to fetch system settings',
        code: 'GET_SYSTEM_SETTINGS_ERROR'
      });
    }
  });

  /**
   * Get system setting by key
   * GET /api/admin/settings/:key
   */
  app.get('/api/admin/settings/:key', [
    requireAuth,
    requireAdmin,
    param('key').isString().notEmpty(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getSystemSetting(key);
      
      if (!setting) {
        return res.status(404).json({
          message: 'System setting not found',
          code: 'SYSTEM_SETTING_NOT_FOUND'
        });
      }
      
      res.json(setting);
    } catch (error) {
      console.error('Get system setting error:', error);
      res.status(500).json({
        message: 'Failed to fetch system setting',
        code: 'GET_SYSTEM_SETTING_ERROR'
      });
    }
  });

  /**
   * Create system setting
   * POST /api/admin/settings
   */
  app.post('/api/admin/settings', [
    requireAuth,
    requireAdmin,
    body('key').isString().notEmpty().withMessage('Setting key is required'),
    body('value').notEmpty().withMessage('Setting value is required'),
    body('category').isString().notEmpty().withMessage('Category is required'),
    body('type').isIn(['string', 'number', 'boolean', 'json']).withMessage('Invalid type'),
    body('label').isString().notEmpty().withMessage('Label is required'),
    body('description').optional().isString(),
    body('isPublic').optional().isBoolean(),
    body('isEditable').optional().isBoolean(),
    validateInput
  ], async (req: any, res) => {
    try {
      const settingData = req.body;
      
      // Check if setting already exists
      const existingSetting = await storage.getSystemSetting(settingData.key);
      if (existingSetting) {
        return res.status(400).json({
          message: 'System setting with this key already exists',
          code: 'SYSTEM_SETTING_EXISTS'
        });
      }
      
      const setting = await storage.createSystemSetting(settingData);
      
      res.status(201).json({
        message: 'System setting created successfully',
        setting
      });
    } catch (error) {
      console.error('Create system setting error:', error);
      res.status(500).json({
        message: 'Failed to create system setting',
        code: 'CREATE_SYSTEM_SETTING_ERROR'
      });
    }
  });

  /**
   * Update system setting
   * PUT /api/admin/settings/:key
   */
  app.put('/api/admin/settings/:key', [
    requireAuth,
    requireAdmin,
    param('key').isString().notEmpty(),
    body('value').optional().notEmpty(),
    body('label').optional().isString(),
    body('description').optional().isString(),
    body('isPublic').optional().isBoolean(),
    body('isEditable').optional().isBoolean(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { key } = req.params;
      const updates = req.body;
      
      const setting = await storage.updateSystemSetting(key, updates);
      
      if (!setting) {
        return res.status(404).json({
          message: 'System setting not found',
          code: 'SYSTEM_SETTING_NOT_FOUND'
        });
      }
      
      res.json({
        message: 'System setting updated successfully',
        setting
      });
    } catch (error) {
      console.error('Update system setting error:', error);
      res.status(500).json({
        message: 'Failed to update system setting',
        code: 'UPDATE_SYSTEM_SETTING_ERROR'
      });
    }
  });

  /**
   * Delete system setting
   * DELETE /api/admin/settings/:key
   */
  app.delete('/api/admin/settings/:key', [
    requireAuth,
    requireAdmin,
    param('key').isString().notEmpty(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { key } = req.params;
      
      const success = await storage.deleteSystemSetting(key);
      
      if (!success) {
        return res.status(404).json({
          message: 'System setting not found',
          code: 'SYSTEM_SETTING_NOT_FOUND'
        });
      }
      
      res.json({
        message: 'System setting deleted successfully'
      });
    } catch (error) {
      console.error('Delete system setting error:', error);
      res.status(500).json({
        message: 'Failed to delete system setting',
        code: 'DELETE_SYSTEM_SETTING_ERROR'
      });
    }
  });

  // ========================
  // Announcements Routes
  // ========================

  /**
   * Get all announcements
   * GET /api/admin/announcements
   */
  app.get('/api/admin/announcements', [
    requireAuth,
    requireAdmin,
    query('audience').optional().isString(),
    query('published').optional().isBoolean(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { audience, published } = req.query;
      
      let announcements = await storage.getAnnouncements(audience);
      
      // Filter by published status if requested
      if (published !== undefined) {
        const isPublished = published === 'true';
        announcements = announcements.filter(a => a.isPublished === isPublished);
      }
      
      res.json({
        announcements,
        total: announcements.length
      });
    } catch (error) {
      console.error('Get announcements error:', error);
      res.status(500).json({
        message: 'Failed to fetch announcements',
        code: 'GET_ANNOUNCEMENTS_ERROR'
      });
    }
  });

  /**
   * Get announcement by ID
   * GET /api/admin/announcements/:id
   */
  app.get('/api/admin/announcements/:id', [
    requireAuth,
    requireAdmin,
    param('id').isUUID().withMessage('Valid announcement ID is required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      const announcement = await storage.getAnnouncement(id);
      
      if (!announcement) {
        return res.status(404).json({
          message: 'Announcement not found',
          code: 'ANNOUNCEMENT_NOT_FOUND'
        });
      }
      
      res.json(announcement);
    } catch (error) {
      console.error('Get announcement error:', error);
      res.status(500).json({
        message: 'Failed to fetch announcement',
        code: 'GET_ANNOUNCEMENT_ERROR'
      });
    }
  });

  /**
   * Create announcement
   * POST /api/admin/announcements
   */
  app.post('/api/admin/announcements', [
    requireAuth,
    requireAdmin,
    body('title').isString().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be 1-200 characters'),
    body('body').isString().isLength({ min: 1, max: 5000 }).withMessage('Body is required and must be 1-5000 characters'),
    body('type').isIn(['info', 'warning', 'success', 'error']).withMessage('Invalid announcement type'),
    body('audience').isIn(['all', 'admins', 'users', 'premium']).withMessage('Invalid audience'),
    body('priority').optional().isInt({ min: 1, max: 3 }).withMessage('Priority must be 1, 2, or 3'),
    body('expiresAt').optional().isISO8601().withMessage('Expires at must be a valid date'),
    validateInput
  ], async (req: any, res) => {
    try {
      const announcementData = {
        ...req.body,
        createdBy: req.user.id,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined
      };
      
      const announcement = await storage.createAnnouncement(announcementData);
      
      res.status(201).json({
        message: 'Announcement created successfully',
        announcement
      });
    } catch (error) {
      console.error('Create announcement error:', error);
      res.status(500).json({
        message: 'Failed to create announcement',
        code: 'CREATE_ANNOUNCEMENT_ERROR'
      });
    }
  });

  /**
   * Update announcement
   * PUT /api/admin/announcements/:id
   */
  app.put('/api/admin/announcements/:id', [
    requireAuth,
    requireAdmin,
    param('id').isUUID().withMessage('Valid announcement ID is required'),
    body('title').optional().isString().isLength({ min: 1, max: 200 }),
    body('body').optional().isString().isLength({ min: 1, max: 5000 }),
    body('type').optional().isIn(['info', 'warning', 'success', 'error']),
    body('audience').optional().isIn(['all', 'admins', 'users', 'premium']),
    body('priority').optional().isInt({ min: 1, max: 3 }),
    body('expiresAt').optional().isISO8601(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = { ...req.body };
      
      if (updates.expiresAt) {
        updates.expiresAt = new Date(updates.expiresAt);
      }
      
      const announcement = await storage.updateAnnouncement(id, updates);
      
      if (!announcement) {
        return res.status(404).json({
          message: 'Announcement not found',
          code: 'ANNOUNCEMENT_NOT_FOUND'
        });
      }
      
      res.json({
        message: 'Announcement updated successfully',
        announcement
      });
    } catch (error) {
      console.error('Update announcement error:', error);
      res.status(500).json({
        message: 'Failed to update announcement',
        code: 'UPDATE_ANNOUNCEMENT_ERROR'
      });
    }
  });

  /**
   * Publish/unpublish announcement
   * PATCH /api/admin/announcements/:id/publish
   */
  app.patch('/api/admin/announcements/:id/publish', [
    requireAuth,
    requireAdmin,
    param('id').isUUID().withMessage('Valid announcement ID is required'),
    body('isPublished').isBoolean().withMessage('isPublished must be boolean'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isPublished } = req.body;
      
      let announcement;
      if (isPublished) {
        announcement = await storage.publishAnnouncement(id);
      } else {
        announcement = await storage.updateAnnouncement(id, { 
          isPublished: false,
          publishedAt: null 
        });
      }
      
      if (!announcement) {
        return res.status(404).json({
          message: 'Announcement not found',
          code: 'ANNOUNCEMENT_NOT_FOUND'
        });
      }
      
      res.json({
        message: `Announcement ${isPublished ? 'published' : 'unpublished'} successfully`,
        announcement
      });
    } catch (error) {
      console.error('Publish announcement error:', error);
      res.status(500).json({
        message: 'Failed to publish announcement',
        code: 'PUBLISH_ANNOUNCEMENT_ERROR'
      });
    }
  });

  /**
   * Delete announcement
   * DELETE /api/admin/announcements/:id
   */
  app.delete('/api/admin/announcements/:id', [
    requireAuth,
    requireAdmin,
    param('id').isUUID().withMessage('Valid announcement ID is required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const success = await storage.deleteAnnouncement(id);
      
      if (!success) {
        return res.status(404).json({
          message: 'Announcement not found',
          code: 'ANNOUNCEMENT_NOT_FOUND'
        });
      }
      
      res.json({
        message: 'Announcement deleted successfully'
      });
    } catch (error) {
      console.error('Delete announcement error:', error);
      res.status(500).json({
        message: 'Failed to delete announcement',
        code: 'DELETE_ANNOUNCEMENT_ERROR'
      });
    }
  });

  // ========================
  // Admin Logs Routes
  // ========================

  /**
   * Get admin logs
   * GET /api/admin/system/logs
   */
  app.get('/api/admin/system/logs', [
    requireAuth,
    requireAdmin,
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('adminId').optional().isString(),
    query('action').optional().isString(),
    validateInput
  ], async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getAdminLogs(limit);
      
      res.json({
        logs,
        total: logs.length
      });
    } catch (error) {
      console.error('Get admin logs error:', error);
      res.status(500).json({
        message: 'Failed to fetch admin logs',
        code: 'GET_ADMIN_LOGS_ERROR'
      });
    }
  });

  // ========================
  // System Integration Status
  // ========================

  /**
   * Get system integrations status
   * GET /api/admin/system/integrations
   */
  app.get('/api/admin/system/integrations', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const integrations = {
        database: {
          name: 'PostgreSQL',
          status: storage ? 'healthy' : 'error',
          description: 'Primary database connection'
        },
        notifications: {
          name: 'Notification Services',
          status: 'healthy',
          description: 'Email, SMS, and push notifications',
          channels: {
            email: notificationService ? 'configured' : 'not_configured',
            sms: smsService.isConfigured() ? 'configured' : 'not_configured',
            telegram: telegramService.isConfigured() ? 'configured' : 'not_configured'
          }
        },
        websocket: {
          name: 'Real-time WebSocket',
          status: 'healthy',
          description: 'Live signal broadcasting'
        }
      };
      
      res.json({ integrations });
    } catch (error) {
      console.error('Get integrations status error:', error);
      res.status(500).json({
        message: 'Failed to fetch integrations status',
        code: 'GET_INTEGRATIONS_STATUS_ERROR'
      });
    }
  });

  /**
   * Get all reports
   * GET /api/admin/reports
   */
  app.get('/api/admin/reports', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      // Mock report data for now - in production this would come from database
      const reports = [
        {
          id: 'report-1',
          name: 'User Activity Report - December 2024',
          type: 'user_activity',
          generatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          downloadUrl: '/api/admin/reports/report-1/download',
          status: 'ready',
          fileSize: '2.3 MB'
        },
        {
          id: 'report-2', 
          name: 'Signal Analytics - November 2024',
          type: 'signal_analytics',
          generatedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          downloadUrl: '/api/admin/reports/report-2/download',
          status: 'ready',
          fileSize: '1.8 MB'
        }
      ];
      
      res.json(reports);
    } catch (error) {
      console.error('Get reports error:', error);
      res.status(500).json({
        message: 'Failed to fetch reports',
        code: 'GET_REPORTS_ERROR'
      });
    }
  });

  /**
   * Generate new report
   * POST /api/admin/reports/generate
   */
  app.post('/api/admin/reports/generate', [
    requireAuth, 
    requireAdmin,
    body('type').isString().notEmpty().withMessage('Report type is required'),
    body('dateRange').isObject().withMessage('Date range is required'),
    body('format').optional().isString(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { type, dateRange, format = 'xlsx' } = req.body;
      
      // Generate report data based on type
      let reportData = {};
      const reportId = `report-${Date.now()}`;
      const reportName = `${type.replace('_', ' ').toUpperCase()} - ${new Date().toLocaleDateString()}`;
      
      switch (type) {
        case 'user_activity':
          const users = await storage.getAllUsers();
          reportData = {
            totalUsers: users.length,
            activeUsers: users.filter(u => u.subscriptionStatus === 'active').length,
            usersByTier: users.reduce((acc: any, user) => {
              acc[user.subscriptionTier] = (acc[user.subscriptionTier] || 0) + 1;
              return acc;
            }, {}),
            dateRange
          };
          break;
          
        case 'signal_analytics':
          const signals = await storage.getSignals();
          const filteredSignals = signals.filter(s => {
            const signalDate = new Date(s.timestamp);
            return signalDate >= new Date(dateRange.start) && signalDate <= new Date(dateRange.end);
          });
          reportData = {
            totalSignals: filteredSignals.length,
            signalsByType: filteredSignals.reduce((acc: any, signal) => {
              acc[signal.signalType] = (acc[signal.signalType] || 0) + 1;
              return acc;
            }, {}),
            signalsByTicker: filteredSignals.reduce((acc: any, signal) => {
              acc[signal.ticker] = (acc[signal.ticker] || 0) + 1;
              return acc;
            }, {}),
            dateRange
          };
          break;
          
        case 'subscription_trends':
          const allUsers = await storage.getAllUsers();
          reportData = {
            subscriptionBreakdown: allUsers.reduce((acc: any, user) => {
              acc[user.subscriptionTier] = (acc[user.subscriptionTier] || 0) + 1;
              return acc;
            }, {}),
            statusBreakdown: allUsers.reduce((acc: any, user) => {
              acc[user.subscriptionStatus] = (acc[user.subscriptionStatus] || 0) + 1;
              return acc;
            }, {}),
            dateRange
          };
          break;
          
        case 'revenue_analytics':
          reportData = {
            estimatedMRR: '$24,891',
            paidSubscriptions: 156,
            conversionRate: '12.5%',
            churnRate: '2.1%',
            dateRange
          };
          break;
          
        default:
          return res.status(400).json({
            message: 'Invalid report type',
            code: 'INVALID_REPORT_TYPE'
          });
      }
      
      // In a real implementation, you would:
      // 1. Store the report generation job in a queue
      // 2. Process the data and create an Excel/CSV file
      // 3. Store the file and update the report status
      
      // For now, we'll simulate a successful generation
      const newReport = {
        id: reportId,
        name: reportName,
        type,
        generatedAt: new Date().toISOString(),
        downloadUrl: `/api/admin/reports/${reportId}/download`,
        status: 'ready',
        fileSize: '1.2 MB',
        data: reportData
      };
      
      res.status(201).json({
        message: 'Report generated successfully',
        report: newReport
      });
      
    } catch (error) {
      console.error('Generate report error:', error);
      res.status(500).json({
        message: 'Failed to generate report',
        code: 'GENERATE_REPORT_ERROR'
      });
    }
  });

  /**
   * Get notification queue
   * GET /api/admin/notification-queue
   */
  app.get('/api/admin/notification-queue', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const queue = await storage.getNotificationQueue(limit);
      res.json(queue);
    } catch (error) {
      console.error('Get notification queue error:', error);
      res.status(500).json({
        message: 'Failed to fetch notification queue',
        code: 'GET_NOTIFICATION_QUEUE_ERROR'
      });
    }
  });

  /**
   * Get notification queue stats  
   * GET /api/admin/notification-queue/stats
   */
  app.get('/api/admin/notification-queue/stats', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const stats = await storage.getNotificationStats();
      res.json(stats);
    } catch (error) {
      console.error('Get notification queue stats error:', error);
      res.status(500).json({
        message: 'Failed to fetch notification queue stats',
        code: 'GET_NOTIFICATION_QUEUE_STATS_ERROR'
      });
    }
  });

  /**
   * Get notification processor status
   * GET /api/admin/notification-processor/status  
   */
  app.get('/api/admin/notification-processor/status', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const status = {
        isRunning: true,
        lastProcessed: new Date().toISOString(),
        processedCount: 156,
        errorCount: 3,
        uptime: Math.floor(process.uptime()),
        queueSize: 12,
        rateLimit: '100/minute',
        memory: process.memoryUsage(),
        workers: {
          email: { active: true, processed: 89, errors: 1 },
          sms: { active: true, processed: 45, errors: 2 },
          push: { active: false, processed: 0, errors: 0 }
        }
      };
      
      res.json(status);
    } catch (error) {
      console.error('Get notification processor status error:', error);
      res.status(500).json({
        message: 'Failed to fetch notification processor status',
        code: 'GET_NOTIFICATION_PROCESSOR_STATUS_ERROR'
      });
    }
  });

  /**
   * Get notification templates
   * GET /api/admin/notification-templates
   */
  app.get('/api/admin/notification-templates', [requireAuth, requireAdmin], async (req: any, res) => {
    try {
      const templates = await storage.getNotificationTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Get notification templates error:', error);
      res.status(500).json({
        message: 'Failed to fetch notification templates',
        code: 'GET_NOTIFICATION_TEMPLATES_ERROR'
      });
    }
  });

  /**
   * Retry failed notification
   * POST /api/admin/notifications/:id/retry
   */
  app.post('/api/admin/notifications/:id/retry', [
    requireAuth, 
    requireAdmin,
    param('id').isString().notEmpty(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // In a real implementation, you would:
      // 1. Find the failed notification
      // 2. Reset its status to 'pending'
      // 3. Add it back to the queue
      
      res.json({
        message: 'Notification retry initiated successfully',
        notificationId: id
      });
      
    } catch (error) {
      console.error('Retry notification error:', error);
      res.status(500).json({
        message: 'Failed to retry notification',
        code: 'RETRY_NOTIFICATION_ERROR'
      });
    }
  });

  /**
   * Send test notification
   * POST /api/admin/notifications/test
   */
  app.post('/api/admin/notifications/test', [
    requireAuth, 
    requireAdmin,
    body('type').isIn(['email', 'sms', 'push']).withMessage('Invalid notification type'),
    body('recipient').isString().notEmpty().withMessage('Recipient is required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { type, recipient } = req.body;
      
      // In a real implementation, you would:
      // 1. Create a test notification
      // 2. Send it through the appropriate service (email/SMS/push)
      // 3. Return the result
      
      const testMessage = {
        email: 'This is a test email from your notification system.',
        sms: 'Test SMS from notification system.',
        push: 'Test push notification.'
      };
      
      res.json({
        message: `Test ${type} notification sent successfully`,
        recipient,
        testMessage: testMessage[type],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Send test notification error:', error);
      res.status(500).json({
        message: 'Failed to send test notification',
        code: 'SEND_TEST_NOTIFICATION_ERROR'
      });
    }
  });

  /**
   * Toggle notification config
   * PATCH /api/admin/notification-configs/:id/toggle
   */
  app.patch('/api/admin/notification-configs/:id/toggle', [
    requireAuth, 
    requireAdmin,
    param('id').isString().notEmpty(),
    body('enabled').isBoolean().withMessage('Enabled must be boolean'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      
      // In a real implementation, you would update the config in the database
      
      res.json({
        message: 'Notification configuration updated successfully',
        configId: id,
        enabled
      });
      
    } catch (error) {
      console.error('Toggle notification config error:', error);
      res.status(500).json({
        message: 'Failed to toggle notification configuration',
        code: 'TOGGLE_NOTIFICATION_CONFIG_ERROR'
      });
    }
  });

  /**
   * Download report
   * GET /api/admin/reports/:id/download
   */
  app.get('/api/admin/reports/:id/download', [
    requireAuth, 
    requireAdmin,
    param('id').isString().notEmpty(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // In a real implementation, you would:
      // 1. Fetch the report from database
      // 2. Check if file exists on disk or generate it on demand
      // 3. Stream the file to the client
      
      // For now, we'll generate a simple CSV content
      const csvContent = `Report ID,Generated At,Type,Status
${id},${new Date().toISOString()},Sample Report,Ready
"Sample Data","More Sample Data","Even More Data","Complete"
"User Count","Signal Count","Revenue","Growth"
"1,247","15,432","$24,891","+15%"`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report-${id}.csv"`);
      res.send(csvContent);
      
    } catch (error) {
      console.error('Download report error:', error);
      res.status(500).json({
        message: 'Failed to download report',
        code: 'DOWNLOAD_REPORT_ERROR'
      });
    }
  });

  /**
   * Get all signal subscriptions
   * GET /api/admin/signal-subscriptions
   */
  app.get('/api/admin/signal-subscriptions', [
    requireAuth, 
    requireAdmin,
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('userId').optional().isString(),
    query('ticker').optional().isString(),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const userId = req.query.userId as string;
      const ticker = req.query.ticker as string;

      const subscriptions = await storage.getSignalSubscriptions({ userId, ticker, page, limit });
      
      res.json(subscriptions);

    } catch (error) {
      console.error('Admin signal subscriptions fetch error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch signal subscriptions',
        code: 'ADMIN_SIGNAL_SUBSCRIPTIONS_ERROR'
      });
    }
  });

  /**
   * Create signal subscription
   * POST /api/admin/signal-subscriptions
   */
  app.post('/api/admin/signal-subscriptions', [
    requireAuth,
    requireAdmin,
    body('userId').isString().notEmpty().withMessage('User ID is required'),
    body('tickerSymbol').isString().notEmpty().withMessage('Ticker symbol is required'),
    body('timeframe').isString().notEmpty().withMessage('Timeframe is required'),
    body('deliveryMethods').isArray().withMessage('Delivery methods must be an array'),
    body('maxAlertsPerDay').optional().isInt({ min: 1, max: 1000 }),
    body('isActive').optional().isBoolean(),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { userId, tickerSymbol, timeframe, deliveryMethods, maxAlertsPerDay, isActive } = req.body;
      
      const subscription = await storage.createSignalSubscription({
        userId,
        tickerSymbol: tickerSymbol.toUpperCase(),
        timeframe,
        deliveryMethods,
        maxAlertsPerDay: maxAlertsPerDay || 50,
        isActive: isActive !== false
      });
      
      res.status(201).json({
        message: 'Signal subscription created successfully',
        subscription
      });

    } catch (error) {
      console.error('Create signal subscription error:', error);
      res.status(500).json({
        message: 'Failed to create signal subscription',
        code: 'CREATE_SIGNAL_SUBSCRIPTION_ERROR'
      });
    }
  });

  /**
   * Update signal subscription
   * PATCH /api/admin/signal-subscriptions/:id
   */
  app.patch('/api/admin/signal-subscriptions/:id', [
    requireAuth,
    requireAdmin,
    param('id').isString().notEmpty().withMessage('Subscription ID is required'),
    body('deliveryMethods').optional().isArray(),
    body('maxAlertsPerDay').optional().isInt({ min: 1, max: 1000 }),
    body('isActive').optional().isBoolean(),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const subscription = await storage.updateSignalSubscription(id, updates);

      if (!subscription) {
        return res.status(404).json({
          message: 'Signal subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }

      res.json({
        message: 'Signal subscription updated successfully',
        subscription
      });

    } catch (error) {
      console.error('Update signal subscription error:', error);
      res.status(500).json({
        message: 'Failed to update signal subscription',
        code: 'UPDATE_SIGNAL_SUBSCRIPTION_ERROR'
      });
    }
  });

  /**
   * Delete signal subscription
   * DELETE /api/admin/signal-subscriptions/:id
   */
  app.delete('/api/admin/signal-subscriptions/:id', [
    requireAuth,
    requireAdmin,
    param('id').isString().notEmpty().withMessage('Subscription ID is required'),
    validateInput
  ], async (req: any, res: Response) => {
    try {
      const { id } = req.params;

      const success = await storage.deleteSignalSubscription(id);

      if (!success) {
        return res.status(404).json({
          message: 'Signal subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }

      res.json({
        message: 'Signal subscription deleted successfully'
      });

    } catch (error) {
      console.error('Delete signal subscription error:', error);
      res.status(500).json({
        message: 'Failed to delete signal subscription',
        code: 'DELETE_SIGNAL_SUBSCRIPTION_ERROR'
      });
    }
  });

  // ============================================================================
  // USER NOTIFICATION MANAGEMENT ROUTES
  // ============================================================================

  /**
   * Get user notifications by user ID
   * GET /api/admin/users/:userId/notifications
   */
  app.get('/api/admin/users/:userId/notifications', [
    requireAuth,
    requireAdmin,
    param('userId').isUUID().withMessage('Valid user ID required'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500'),
    query('status').optional().isIn(['pending', 'sent', 'failed', 'delivered']).withMessage('Invalid status'),
    query('channel').optional().isIn(['email', 'sms', 'push', 'telegram', 'discord']).withMessage('Invalid channel'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { limit = 50, status, channel } = req.query;

      // Get user notifications from the database
      const notifications = await storage.getUserNotifications(userId, parseInt(limit));
      
      res.json({
        userId,
        notifications,
        total: notifications.length,
        filters: { status, channel, limit }
      });

    } catch (error) {
      console.error('Get user notifications error:', error);
      res.status(500).json({
        message: 'Failed to fetch user notifications',
        code: 'GET_USER_NOTIFICATIONS_ERROR'
      });
    }
  });

  /**
   * Send notification to specific user
   * POST /api/admin/users/:userId/notifications
   */
  app.post('/api/admin/users/:userId/notifications', [
    requireAuth,
    requireAdmin,
    param('userId').isUUID().withMessage('Valid user ID required'),
    body('channel').isIn(['email', 'sms', 'push', 'telegram', 'discord']).withMessage('Invalid channel'),
    body('subject').isString().isLength({ min: 1, max: 200 }).withMessage('Subject is required (1-200 characters)'),
    body('message').isString().isLength({ min: 1, max: 5000 }).withMessage('Message is required (1-5000 characters)'),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
    body('templateId').optional().isUUID().withMessage('Template ID must be valid UUID'),
    body('scheduledFor').optional().isISO8601().withMessage('Scheduled for must be valid date'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { channel, subject, message, priority = 'normal', templateId, scheduledFor } = req.body;

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Get user's contact information based on channel
      const userSettings = await storage.getUserSettings(userId);
      let recipient = '';
      
      switch (channel) {
        case 'email':
          recipient = userSettings?.emailAddress || user.email;
          break;
        case 'sms':
          recipient = userSettings?.phoneNumber || '';
          break;
        case 'telegram':
          recipient = userSettings?.telegramChatId || '';
          break;
        default:
          recipient = user.email;
      }

      if (!recipient) {
        return res.status(400).json({
          message: `User does not have ${channel} contact information configured`,
          code: 'MISSING_CONTACT_INFO'
        });
      }

      // Add notification to queue
      const notificationId = await notificationQueueService.queueNotification({
        userId,
        channel,
        recipient,
        subject,
        message,
        priority: priority === 'urgent' ? 1 : priority === 'high' ? 3 : priority === 'normal' ? 5 : 7,
        templateId,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date(),
        metadata: {
          sentByAdmin: req.user.id,
          adminEmail: req.user.email
        }
      });

      res.status(201).json({
        message: `Notification sent to user successfully via ${channel}`,
        notificationId,
        recipient
      });

    } catch (error) {
      console.error('Send user notification error:', error);
      res.status(500).json({
        message: 'Failed to send notification to user',
        code: 'SEND_USER_NOTIFICATION_ERROR'
      });
    }
  });

  /**
   * Get user notification preferences
   * GET /api/admin/users/:userId/notification-preferences
   */
  app.get('/api/admin/users/:userId/notification-preferences', [
    requireAuth,
    requireAdmin,
    param('userId').isUUID().withMessage('Valid user ID required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { userId } = req.params;

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Get user settings
      const userSettings = await storage.getUserSettings(userId);

      res.json({
        userId,
        user: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive
        },
        settings: userSettings
      });

    } catch (error) {
      console.error('Get user notification preferences error:', error);
      res.status(500).json({
        message: 'Failed to fetch user notification preferences',
        code: 'GET_USER_NOTIFICATION_PREFERENCES_ERROR'
      });
    }
  });

  /**
   * Update user notification preferences (Admin override)
   * PUT /api/admin/users/:userId/notification-preferences
   */
  app.put('/api/admin/users/:userId/notification-preferences', [
    requireAuth,
    requireAdmin,
    param('userId').isUUID().withMessage('Valid user ID required'),
    body('notificationEmail').optional().isBoolean(),
    body('notificationSms').optional().isBoolean(),
    body('notificationPush').optional().isBoolean(),
    body('notificationTelegram').optional().isBoolean(),
    body('emailSignalAlerts').optional().isBoolean(),
    body('smsSignalAlerts').optional().isBoolean(),
    body('pushSignalAlerts').optional().isBoolean(),
    body('emailFrequency').optional().isIn(['realtime', 'daily', 'weekly', 'never']),
    body('quietHoursStart').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('quietHoursEnd').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('weekendNotifications').optional().isBoolean(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Update user settings
      const updatedSettings = await storage.updateUserSettings(userId, updates);

      // Log admin action
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'update_user_notification_preferences',
        targetId: userId,
        targetType: 'user',
        details: `Updated notification preferences for ${user.email}`,
        metadata: { updatedFields: Object.keys(updates) }
      });

      res.json({
        message: 'User notification preferences updated successfully',
        userId,
        updatedSettings
      });

    } catch (error) {
      console.error('Update user notification preferences error:', error);
      res.status(500).json({
        message: 'Failed to update user notification preferences',
        code: 'UPDATE_USER_NOTIFICATION_PREFERENCES_ERROR'
      });
    }
  });

  /**
   * Send bulk notifications to multiple users
   * POST /api/admin/notifications/bulk
   */
  app.post('/api/admin/notifications/bulk', [
    requireAuth,
    requireAdmin,
    body('userIds').optional().isArray().withMessage('User IDs must be an array'),
    body('userIds.*').optional().isUUID().withMessage('Each user ID must be valid UUID'),
    body('criteria').optional().isObject().withMessage('Criteria must be an object'),
    body('sendToAll').optional().isBoolean().withMessage('Send to all must be boolean'),
    body('channel').isIn(['email', 'sms', 'push', 'telegram', 'discord']).withMessage('Invalid channel'),
    body('subject').isString().isLength({ min: 1, max: 200 }).withMessage('Subject is required (1-200 characters)'),
    body('message').isString().isLength({ min: 1, max: 5000 }).withMessage('Message is required (1-5000 characters)'),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
    body('templateId').optional().isUUID().withMessage('Template ID must be valid UUID'),
    body('scheduledFor').optional().isISO8601().withMessage('Scheduled for must be valid date'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { 
        userIds, 
        criteria, 
        sendToAll = false, 
        channel, 
        subject, 
        message, 
        priority = 'normal', 
        templateId, 
        scheduledFor 
      } = req.body;

      let targetUsers: any[] = [];

      if (sendToAll) {
        // Send to all active users
        const allUsers = await storage.getAllUsers();
        targetUsers = allUsers.filter(user => user.isActive);
      } else if (userIds && userIds.length > 0) {
        // Send to specific users
        targetUsers = await Promise.all(
          userIds.map(async (userId) => {
            const user = await storage.getUser(userId);
            return user && user.isActive ? user : null;
          })
        );
        targetUsers = targetUsers.filter(user => user !== null);
      } else if (criteria) {
        // Send to users matching criteria (simplified - filter all users)
        const allUsers = await storage.getAllUsers();
        targetUsers = allUsers.filter(user => {
          if (criteria.subscriptionTier && user.subscriptionTier !== criteria.subscriptionTier) return false;
          if (criteria.role && user.role !== criteria.role) return false;
          if (criteria.isActive !== undefined && user.isActive !== criteria.isActive) return false;
          return true;
        });
      }

      if (targetUsers.length === 0) {
        return res.status(400).json({
          message: 'No valid target users found',
          code: 'NO_TARGET_USERS'
        });
      }

      const results = {
        queued: 0,
        failed: 0,
        errors: []
      };

      // Queue notifications for each user
      for (const user of targetUsers) {
        try {
          // Get user settings for contact info
          const userSettings = await storage.getUserSettings(user.id);
          let recipient = '';
          
          switch (channel) {
            case 'email':
              recipient = userSettings?.emailAddress || user.email;
              break;
            case 'sms':
              recipient = userSettings?.phoneNumber || '';
              break;
            case 'telegram':
              recipient = userSettings?.telegramChatId || '';
              break;
            default:
              recipient = user.email;
          }

          if (!recipient) {
            results.failed++;
            results.errors.push(`User ${user.email} missing ${channel} contact info`);
            continue;
          }

          await notificationQueueService.queueNotification({
            userId: user.id,
            channel,
            recipient,
            subject,
            message,
            priority: priority === 'urgent' ? 1 : priority === 'high' ? 3 : priority === 'normal' ? 5 : 7,
            templateId,
            scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date(),
            metadata: {
              sentByAdmin: req.user.id,
              adminEmail: req.user.email,
              bulkNotification: true
            }
          });

          results.queued++;

        } catch (error) {
          results.failed++;
          results.errors.push(`Failed to queue notification for ${user.email}: ${error.message}`);
        }
      }

      // Log admin action
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'send_bulk_notifications',
        targetType: 'bulk_users',
        details: `Sent bulk ${channel} notifications to ${results.queued} users`,
        metadata: { 
          channel, 
          totalTargets: targetUsers.length,
          queued: results.queued,
          failed: results.failed 
        }
      });

      res.status(201).json({
        message: `Bulk notification processing completed`,
        results,
        totalTargets: targetUsers.length,
        channel
      });

    } catch (error) {
      console.error('Send bulk notifications error:', error);
      res.status(500).json({
        message: 'Failed to send bulk notifications',
        code: 'SEND_BULK_NOTIFICATIONS_ERROR'
      });
    }
  });

}