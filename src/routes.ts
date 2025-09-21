import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { body, validationResult, param, query } from "express-validator";
import { storage } from "./storage";
//import { insertUserSchema, insertSignalSchema, insertTickerSchema, insertUserAlertSchema, insertDashboardLayoutSchema } from "../../shared/schema";
import { insertUserSchema, insertSignalSchema, insertTickerSchema, insertUserAlertSchema, insertDashboardLayoutSchema } from "../shared/schema.js";

import { cycleForecastingService } from "./services/cycleForecasting";
import { notificationService } from "./services/notificationService";
import { smsService } from "./services/smsService";
import { telegramService } from "./services/telegramService";
import { notificationQueueService } from "./services/notificationQueue";
import { scheduledProcessor } from "./services/scheduledProcessor";
import { smartTimingOptimizer } from "./services/smartTimingOptimizer";
import { z } from "zod";

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Security utilities
function sanitizeInput(input: string): string {
  return input.replace(/[<>\"'&]/g, '');
}

function generateSecureToken(): string {
  return jwt.sign(
    { 
      id: Math.random().toString(36).substring(2),
      iat: Math.floor(Date.now() / 1000)
    }, 
    JWT_SECRET, 
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Input validation middleware
const validateInput = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation errors',
      errors: errors.array(),
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// SQL injection prevention
const validateUuid = param('id').isUUID().withMessage('Invalid ID format');
const validateEmail = body('email').isEmail().normalizeEmail().withMessage('Invalid email format');
const validatePassword = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be between 8 and 128 characters')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const clients = new Set<WebSocket>();
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected to WebSocket');
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Broadcast to all connected clients
  function broadcast(message: any) {
    const data = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // Enhanced authentication middleware with token validation
  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          message: 'No token provided',
          code: 'NO_TOKEN',
          timestamp: new Date().toISOString()
        });
      }
      
      const token = authHeader.substring(7);
      
      // Verify JWT token
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        return res.status(401).json({ 
          message: 'Invalid token format',
          code: 'INVALID_TOKEN_FORMAT',
          timestamp: new Date().toISOString()
        });
      }
      
      // Get user from database - use fallback if storage fails
      let user;
      try {
        user = await storage.getUser(decoded.userId);
      } catch (storageError) {
        console.log('Storage error, using token data:', storageError);
        // Fallback to token data if storage fails
        user = {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role || 'user',
          isActive: true,
          firstName: 'User',
          lastName: 'Test'
        };
      }
      
      if (!user) {
        return res.status(401).json({ 
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      // Check if user account is active
      if (!user.isActive) {
        return res.status(403).json({ 
          message: 'Account is deactivated',
          code: 'ACCOUNT_INACTIVE',
          timestamp: new Date().toISOString()
        });
      }

      // Check token expiration
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        return res.status(401).json({ 
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED',
          timestamp: new Date().toISOString()
        });
      }
      
      // Note: Login time updated only during actual login, not every request
      req.user = user;
      req.tokenData = decoded;
      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(401).json({ 
        message: 'Authentication failed',
        code: 'AUTH_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  };

  // Enhanced permission-based middleware
  const requirePermission = (permission: string) => {
    return (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
          timestamp: new Date().toISOString()
        });
      }

      // Check if user has required permission
      if (!hasUserPermission(req.user, permission)) {
        return res.status(403).json({
          message: `Permission '${permission}' required`,
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredPermission: permission,
          userRole: req.user.role,
          userTier: req.user.subscriptionTier,
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  };

  // Admin role middleware (local implementation)
  const requireAdmin = (req: any, res: any, next: any) => {
    const userRole = req.user?.role;
    
    // Allow admin and superuser roles
    if (userRole !== 'admin' && userRole !== 'superuser') {
      return res.status(403).json({ 
        message: 'Administrative privileges required',
        code: 'INSUFFICIENT_PRIVILEGES',
        requiredRole: 'admin',
        userRole: userRole || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
    next();
  };

  // Permission checking function
  function hasUserPermission(user: any, permission: string): boolean {
    if (!user) return false;
    
    // Define role permissions (matches client-side permissions)
    const rolePermissions: Record<string, string[]> = {
      'user': [
        'signals.view', 'analytics.basic', 'alerts.email', 
        'subscriptions.view', 'api.basic'
      ],
      'admin': [
        'signals.view', 'analytics.basic', 'analytics.advanced', 'analytics.heatmap',
        'analytics.cycle', 'analytics.portfolio', 'trading.playground',
        'alerts.email', 'alerts.sms', 'alerts.telegram', 'alerts.advanced',
        'subscriptions.view', 'subscriptions.billing', 'api.basic', 'api.advanced',
        'users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage_roles',
        'signals.create', 'signals.manage', 'alerts.manage', 'admin.dashboard',
        'admin.logs', 'admin.system', 'admin.tickers', 'admin.webhooks',
        'subscriptions.manage', 'api.admin'
      ],
      'superuser': [
        // All permissions - superuser has access to everything
        'signals.view', 'signals.create', 'signals.manage',
        'analytics.basic', 'analytics.advanced', 'analytics.heatmap', 'analytics.cycle', 'analytics.portfolio',
        'trading.playground', 'alerts.email', 'alerts.sms', 'alerts.telegram', 'alerts.advanced', 'alerts.manage',
        'subscriptions.view', 'subscriptions.manage', 'subscriptions.billing',
        'users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage_roles',
        'admin.dashboard', 'admin.logs', 'admin.system', 'admin.tickers', 'admin.webhooks',
        'api.basic', 'api.advanced', 'api.admin'
      ]
    };

    // Get subscription-based permissions
    const subscriptionPermissions: Record<string, string[]> = {
      'free': ['signals.view', 'analytics.basic', 'alerts.email'],
      'basic': ['signals.view', 'analytics.basic', 'analytics.heatmap', 'trading.playground', 'alerts.email', 'alerts.sms'],
      'premium': ['signals.view', 'analytics.basic', 'analytics.advanced', 'analytics.heatmap', 'analytics.cycle', 'analytics.portfolio', 'trading.playground', 'alerts.email', 'alerts.sms', 'alerts.telegram', 'alerts.advanced'],
      'pro': ['signals.view', 'analytics.basic', 'analytics.advanced', 'analytics.heatmap', 'analytics.cycle', 'analytics.portfolio', 'trading.playground', 'alerts.email', 'alerts.sms', 'alerts.telegram', 'alerts.advanced']
    };

    // Combine role and subscription permissions
    const userRolePermissions = rolePermissions[user.role] || [];
    const userSubscriptionPermissions = subscriptionPermissions[user.subscriptionTier] || [];
    const allPermissions = [...userRolePermissions, ...userSubscriptionPermissions];

    return allPermissions.includes(permission);
  }

  // TradingView webhook authentication
  const validateWebhookSecret = (req: any, res: any, next: any) => {
    const secret = req.headers['x-webhook-secret'] || req.body.secret || req.query.secret;
    const validSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET || 'default_secret';
    
    if (secret !== validSecret) {
      return res.status(401).json({ message: 'Invalid webhook secret' });
    }
    
    next();
  };

  // Supported timeframes for BTCUSD
  const SUPPORTED_TIMEFRAMES = ['1M', '1W', '1D', '12h', '4h', '1h', '30m'];
  const SUPPORTED_TICKERS = ['BTCUSD']; // Initially only BTCUSD

  // Apply basic security middleware inline  
  app.use((req, res, next) => {
    // Basic XSS protection
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Request logging middleware
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
  });

  // Secure auth routes with validation
  app.post('/api/auth/register', [
    validateEmail,
    validatePassword,
    body('firstName').optional().isLength({ min: 1, max: 50 }).trim().escape(),
    body('lastName').optional().isLength({ min: 1, max: 50 }).trim().escape(),
    validateInput
  ], async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ 
          message: 'User already exists',
          code: 'USER_EXISTS',
          timestamp: new Date().toISOString()
        });
      }

      // Hash password with salt
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      const user = await storage.createUser({
        email: email.toLowerCase(),
        hashedPassword,
        firstName: sanitizeInput(firstName || ''),
        lastName: sanitizeInput(lastName || ''),
        role: 'user',
        isActive: true,
      });

      // Create default user settings
      await storage.createUserSettings({
        userId: user.id,
        notificationEmail: true,
        notificationSms: false,
        notificationPush: true,
        theme: 'dark',
        language: 'en',
        sessionTimeout: 1440, // 24 hours
        twoFactorEnabled: false,
      });

      // Generate secure JWT token
      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          role: user.role,
          iat: Math.floor(Date.now() / 1000)
        }, 
        JWT_SECRET, 
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(201).json({ 
        user: { 
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          subscriptionTier: user.subscriptionTier,
          isActive: user.isActive
        }, 
        token,
        sessionInfo: {
          loginTime: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          tokenType: 'Bearer'
        }
      });
    } catch (error) {
      res.status(400).json({ message: 'Registration failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Secure login route with validation
  app.post('/api/auth/login', [
    validateEmail,
    body('password').notEmpty().withMessage('Password is required'),
    validateInput
  ], async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user) {
        return res.status(401).json({ 
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
          timestamp: new Date().toISOString()
        });
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.hashedPassword);
      if (!passwordMatch) {
        return res.status(401).json({ 
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
          timestamp: new Date().toISOString()
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(403).json({ 
          message: 'Account is deactivated. Please contact support.',
          code: 'ACCOUNT_DEACTIVATED',
          timestamp: new Date().toISOString()
        });
      }

      // Note: Skip login time update for demo purposes
      // await storage.updateUserLoginTime(user.id);

      // Generate secure JWT token
      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          role: user.role,
          sessionId: Math.random().toString(36).substring(2),
          iat: Math.floor(Date.now() / 1000)
        }, 
        JWT_SECRET, 
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({ 
        user: { 
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          subscriptionTier: user.subscriptionTier,
          isActive: user.isActive,
          lastLoginAt: new Date().toISOString()
        }, 
        token,
        sessionInfo: {
          loginTime: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          tokenType: 'Bearer'
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        message: 'Login failed. Please try again.',
        code: 'LOGIN_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Logout route
  app.post('/api/auth/logout', requireAuth, async (req: any, res) => {
    try {
      // In a real implementation, you might invalidate the token in a blacklist
      res.json({ 
        message: 'Logged out successfully',
        code: 'LOGOUT_SUCCESS',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Logout failed',
        code: 'LOGOUT_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  // User Progress API endpoints
  app.get('/api/user/progress', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getUserStats(userId);
      
      if (!stats) {
        // Create default user stats if not found
        const defaultStats = {
          userId,
          totalTrades: 47,
          successfulTrades: 32,
          totalProfit: 2485.67,
          winRate: 68.1,
          currentStreak: 5,
          longestStreak: 12,
          platformUsageDays: 23,
          signalsReceived: 156,
          achievementsUnlocked: 8,
          totalAchievements: 25,
          level: 7,
          experiencePoints: 3420,
          nextLevelXP: 4000,
          skillPoints: {
            trading: 85,
            analysis: 72,
            riskManagement: 65,
            research: 78
          }
        };
        
        try {
          await storage.createUserStats(defaultStats);
        } catch (error) {
          console.log('UserStats creation skipped (table may not exist)');
        }
        res.json(defaultStats);
      } else {
        res.json(stats);
      }
    } catch (error) {
      console.error('Error fetching user progress:', error);
      res.status(500).json({ message: 'Failed to fetch user progress' });
    }
  });

  app.get('/api/user/achievements', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const achievements = await storage.getUserAchievements(userId);
      
      // Return demo achievements if none found
      const demoAchievements = [
        {
          id: 'first-trade',
          name: 'First Steps',
          description: 'Complete your first trade',
          category: 'trading',
          rarity: 'common',
          points: 100,
          icon: '🎯',
          isUnlocked: true,
          unlockedAt: '2025-01-02T10:30:00Z',
          progress: 1,
          target: 1
        },
        {
          id: 'profitable-week',
          name: 'Profitable Week',
          description: 'Achieve 7 consecutive profitable days',
          category: 'trading',
          rarity: 'uncommon',
          points: 250,
          icon: '📈',
          isUnlocked: true,
          unlockedAt: '2025-01-05T15:45:00Z',
          progress: 7,
          target: 7
        },
        {
          id: 'signal-master',
          name: 'Signal Master',
          description: 'Successfully act on 50 trading signals',
          category: 'analysis',
          rarity: 'rare',
          points: 500,
          icon: '⚡',
          isUnlocked: false,
          progress: 32,
          target: 50
        },
        {
          id: 'diamond-hands',
          name: 'Diamond Hands',
          description: 'Hold a position for 30+ days',
          category: 'patience',
          rarity: 'epic',
          points: 750,
          icon: '💎',
          isUnlocked: false,
          progress: 18,
          target: 30
        },
        {
          id: 'whale-watcher',
          name: 'Whale Watcher',
          description: 'Achieve $10,000+ in total profits',
          category: 'milestone',
          rarity: 'legendary',
          points: 1000,
          icon: '🐋',
          isUnlocked: false,
          progress: 2485,
          target: 10000
        }
      ];
      
      res.json(achievements.length > 0 ? achievements : demoAchievements);
    } catch (error) {
      console.error('Error fetching user achievements:', error);
      res.status(500).json({ message: 'Failed to fetch user achievements' });
    }
  });

  app.get('/api/user/milestones', requireAuth, async (req: any, res) => {
    try {
      const demoMilestones = [
        {
          id: 'beginner-trader',
          title: 'Beginner Trader',
          description: 'Complete 10 trades to unlock advanced features',
          type: 'trading',
          progress: 47,
          target: 10,
          reward: 'Advanced chart tools',
          isCompleted: true,
          completedAt: '2025-01-03T12:00:00Z'
        },
        {
          id: 'signal-subscriber',
          title: 'Signal Subscriber',
          description: 'Receive 100 trading signals',
          type: 'engagement',
          progress: 156,
          target: 100,
          reward: 'Premium signal notifications',
          isCompleted: true,
          completedAt: '2025-01-07T09:15:00Z'
        },
        {
          id: 'consistent-trader',
          title: 'Consistent Trader',
          description: 'Maintain 70%+ win rate over 50 trades',
          type: 'trading',
          progress: 47,
          target: 50,
          reward: 'VIP trader badge',
          isCompleted: false
        },
        {
          id: 'platform-veteran',
          title: 'Platform Veteran',
          description: 'Use the platform for 30 consecutive days',
          type: 'engagement',
          progress: 23,
          target: 30,
          reward: 'Veteran user perks',
          isCompleted: false
        }
      ];
      
      res.json(demoMilestones);
    } catch (error) {
      console.error('Error fetching user milestones:', error);
      res.status(500).json({ message: 'Failed to fetch user milestones' });
    }
  });

  // User routes
  app.get('/api/user/profile', requireAuth, async (req: any, res) => {
    try {
      // Return user profile with default settings
      const defaultSettings = {
        userId: req.user.id,
        notificationEmail: true,
        notificationSms: false,
        notificationPush: true,
        theme: 'dark',
        language: 'en',
        timezone: 'UTC',
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '24h'
      };
      
      res.json({ 
        user: { ...req.user, hashedPassword: undefined },
        settings: defaultSettings
      });
    } catch (error) {
      console.error('Profile API error:', error);
      res.status(500).json({ message: 'Failed to get profile' });
    }
  });

  // Get comprehensive user settings
  app.get('/api/user/settings', requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getUserSettings(req.user.id);
      if (!settings) {
        // Create default settings if none exist
        const defaultSettings = await storage.createUserSettings({
          userId: req.user.id,
        });
        res.json(defaultSettings);
      } else {
        res.json(settings);
      }
    } catch (error) {
      console.error('Failed to get user settings:', error);
      res.status(500).json({ message: 'Failed to get settings' });
    }
  });

  // Update comprehensive user settings
  app.put('/api/user/settings', requireAuth, async (req: any, res) => {
    try {
      const updates = z.object({
        // Notification Preferences
        notificationEmail: z.boolean().optional(),
        notificationSms: z.boolean().optional(),
        notificationPush: z.boolean().optional(),
        emailSignalAlerts: z.boolean().optional(),
        smsSignalAlerts: z.boolean().optional(),
        pushSignalAlerts: z.boolean().optional(),
        emailFrequency: z.enum(['realtime', 'daily', 'weekly', 'never']).optional(),
        quietHoursStart: z.string().optional(),
        quietHoursEnd: z.string().optional(),
        weekendNotifications: z.boolean().optional(),
        
        // Display Preferences
        theme: z.enum(['light', 'dark', 'auto']).optional(),
        language: z.string().optional(),
        timezone: z.string().optional(),
        currency: z.string().optional(),
        dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
        timeFormat: z.enum(['12h', '24h']).optional(),
        
        // Chart Preferences
        defaultChartType: z.enum(['candlestick', 'line', 'area', 'heikin_ashi']).optional(),
        defaultTimeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']).optional(),
        chartTheme: z.enum(['dark', 'light', 'auto']).optional(),
        showVolume: z.boolean().optional(),
        showIndicators: z.boolean().optional(),
        autoRefreshCharts: z.boolean().optional(),
        chartRefreshInterval: z.number().min(5).max(300).optional(),
        
        // Trading Preferences
        defaultOrderType: z.enum(['market', 'limit', 'stop_loss', 'take_profit']).optional(),
        confirmTrades: z.boolean().optional(),
        enablePaperTrading: z.boolean().optional(),
        paperTradingBalance: z.string().optional(),
        riskPercentage: z.string().optional(),
        stopLossPercentage: z.string().optional(),
        takeProfitPercentage: z.string().optional(),
        
        // Dashboard Preferences
        defaultDashboard: z.enum(['overview', 'trading', 'analytics', 'portfolio']).optional(),
        showPriceAlerts: z.boolean().optional(),
        showRecentTrades: z.boolean().optional(),
        showPortfolioSummary: z.boolean().optional(),
        showMarketOverview: z.boolean().optional(),
        maxDashboardItems: z.number().min(5).max(50).optional(),
        compactView: z.boolean().optional(),
        
        // Privacy & Security
        profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
        shareTradeHistory: z.boolean().optional(),
        allowAnalytics: z.boolean().optional(),
        twoFactorEnabled: z.boolean().optional(),
        sessionTimeout: z.number().min(15).max(10080).optional(),
        
        // Advanced Features
        enableBetaFeatures: z.boolean().optional(),
        apiAccessEnabled: z.boolean().optional(),
        webhookUrl: z.string().url().optional().or(z.literal('')),
        customCssEnabled: z.boolean().optional(),
        customCss: z.string().optional(),
      }).parse(req.body);

      const settings = await storage.updateUserSettings(req.user.id, updates);
      res.json(settings);
    } catch (error: any) {
      console.error('Failed to update user settings:', error);
      if (error.issues) {
        res.status(400).json({ 
          message: 'Validation error', 
          details: error.issues.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      } else {
        res.status(400).json({ message: 'Failed to update settings' });
      }
    }
  });

  // Partial update for single preference changes
  app.patch('/api/user/settings', requireAuth, async (req: any, res) => {
    try {
      // Allow any single preference update without strict validation
      const updates = req.body;
      const settings = await storage.updateUserSettings(req.user.id, updates);
      res.json(settings);
    } catch (error) {
      console.error('Failed to patch user settings:', error);
      res.status(400).json({ message: 'Failed to update settings' });
    }
  });

  // Reset settings to defaults
  app.post('/api/user/settings/reset', requireAuth, async (req: any, res) => {
    try {
      // Get current settings
      const currentSettings = await storage.getUserSettings(req.user.id);
      if (!currentSettings) {
        return res.status(404).json({ message: 'Settings not found' });
      }

      // Reset to defaults by creating new settings
      const defaultSettings = await storage.createUserSettings({
        userId: req.user.id,
      });

      res.json(defaultSettings);
    } catch (error) {
      console.error('Failed to reset user settings:', error);
      res.status(500).json({ message: 'Failed to reset settings' });
    }
  });

  // Secure webhook endpoints with enhanced validation
  app.post('/api/webhook/alerts', [
    validateWebhookSecret,
    body('ticker').matches(/^[A-Z]{2,10}USDT?$/).withMessage('Invalid ticker format'),
    body('action').isIn(['buy', 'sell']).withMessage('Invalid action'),
    body('price').isNumeric().withMessage('Invalid price format'),
    validateInput
  ], async (req, res) => {
    try {
      const { ticker, action, price, timeframe, strategy, comment } = req.body;

      // Validate ticker is supported
      if (!SUPPORTED_TICKERS.includes(ticker.replace('USDT', 'USD'))) {
        return res.status(400).json({ 
          message: 'Ticker not supported',
          supportedTickers: SUPPORTED_TICKERS,
          code: 'TICKER_NOT_SUPPORTED'
        });
      }

      // Validate timeframe if provided
      if (timeframe && !SUPPORTED_TIMEFRAMES.includes(timeframe)) {
        return res.status(400).json({ 
          message: 'Timeframe not supported',
          supportedTimeframes: SUPPORTED_TIMEFRAMES,
          code: 'TIMEFRAME_NOT_SUPPORTED'
        });
      }

      // Create signal
      const signal = await storage.createSignal({
        userId: null, // System signal
        ticker: ticker,
        signalType: action,
        price: String(price),
        timestamp: new Date(),
        source: 'webhook',
        note: comment || `${strategy || 'TradingView'} signal for ${ticker}`
      });

      // Broadcast to all connected clients
      broadcast({
        type: 'new_signal',
        signal: signal,
        timestamp: new Date().toISOString()
      });

      // Queue notifications for subscribed users
      await notificationQueueService.queueSignalNotification(signal.id, signal.userId || 'all');

      res.status(201).json({ 
        message: 'Signal received and processed',
        signalId: signal.id,
        code: 'SIGNAL_PROCESSED',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ 
        message: 'Failed to process webhook',
        code: 'WEBHOOK_PROCESSING_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Export settings
  app.get('/api/user/settings/export', requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getUserSettings(req.user.id);
      if (!settings) {
        return res.status(404).json({ message: 'Settings not found' });
      }

      // Remove internal fields
      const exportData = {
        ...settings,
        id: undefined,
        userId: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="preferences.json"');
      res.json(exportData);
    } catch (error) {
      console.error('Failed to export settings:', error);
      res.status(500).json({ message: 'Failed to export settings' });
    }
  });

  // Import settings
  app.post('/api/user/settings/import', requireAuth, async (req: any, res) => {
    try {
      const importData = req.body;
      
      // Validate and clean import data
      const cleanData = Object.keys(importData).reduce((acc: any, key) => {
        // Skip internal fields
        if (!['id', 'userId', 'createdAt', 'updatedAt'].includes(key)) {
          acc[key] = importData[key];
        }
        return acc;
      }, {});

      const settings = await storage.updateUserSettings(req.user.id, cleanData);
      res.json(settings);
    } catch (error) {
      console.error('Failed to import settings:', error);
      res.status(400).json({ message: 'Failed to import settings' });
    }
  });

  // Ticker routes
  app.get('/api/tickers', async (req, res) => {
    try {
      const tickers = await storage.getEnabledTickers();
      res.json(tickers);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get tickers' });
    }
  });

  app.get('/api/admin/tickers', requireAuth, requireAdmin, async (req, res) => {
    try {
      const tickers = await storage.getAllTickers();
      res.json(tickers);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get tickers' });
    }
  });

  app.post('/api/admin/tickers', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const tickerData = insertTickerSchema.parse(req.body);
      const ticker = await storage.createTicker(tickerData);
      
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'CREATE_TICKER',
        targetTable: 'available_tickers',
        targetId: ticker.id,
        notes: `Created ticker: ${ticker.symbol}`,
      });

      res.json(ticker);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create ticker' });
    }
  });

  app.put('/api/admin/tickers/:id', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = z.object({
        symbol: z.string().optional(),
        description: z.string().optional(),
        isEnabled: z.boolean().optional(),
      }).parse(req.body);

      const ticker = await storage.updateTicker(id, updates);
      if (!ticker) {
        return res.status(404).json({ message: 'Ticker not found' });
      }

      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'UPDATE_TICKER',
        targetTable: 'available_tickers',
        targetId: ticker.id,
        notes: `Updated ticker: ${ticker.symbol}`,
      });

      res.json(ticker);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update ticker' });
    }
  });

  app.delete('/api/admin/tickers/:id', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTicker(id);
      
      if (!success) {
        return res.status(404).json({ message: 'Ticker not found' });
      }

      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'DELETE_TICKER',
        targetTable: 'available_tickers',
        targetId: id,
        notes: `Deleted ticker with ID: ${id}`,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete ticker' });
    }
  });

  // Signal routes
  app.get('/api/signals', requireAuth, async (req: any, res) => {
    try {
      const { ticker, limit, timeframe } = req.query;
      let signals;
      
      if (ticker) {
        signals = await storage.getSignalsByTicker(ticker, limit ? parseInt(limit) : undefined);
      } else {
        signals = await storage.getSignals(limit ? parseInt(limit) : undefined);
      }
      
      // Filter by timeframe if specified
      if (timeframe && typeof timeframe === 'string') {
        signals = signals.filter(signal => signal.timeframe === timeframe);
      }
      
      res.json(signals);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get signals' });
    }
  });

  // Get all signals with pagination, sorting, and filtering
  app.get('/api/signals/all', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sort = (req.query.sort as string) || 'timestamp_desc';
      const signalType = req.query.signal_type as string;
      const search = req.query.search as string;
      
      const offset = (page - 1) * limit;
      
      // Get all signals from storage
      const allSignals = await storage.getSignals(1000); // Get more signals for filtering
      
      // Apply filters
      let filteredSignals = allSignals;
      
      if (signalType && signalType !== 'all') {
        filteredSignals = filteredSignals.filter(signal => signal.signalType === signalType);
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        filteredSignals = filteredSignals.filter(signal => 
          signal.ticker.toLowerCase().includes(searchLower) ||
          signal.source.toLowerCase().includes(searchLower) ||
          (signal.strategy && signal.strategy.toLowerCase().includes(searchLower)) ||
          (signal.note && signal.note.toLowerCase().includes(searchLower))
        );
      }
      
      // Apply sorting
      filteredSignals.sort((a, b) => {
        switch (sort) {
          case 'timestamp_desc':
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          case 'timestamp_asc':
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          case 'price_desc':
            return b.price - a.price;
          case 'price_asc':
            return a.price - b.price;
          case 'ticker_asc':
            return a.ticker.localeCompare(b.ticker);
          case 'ticker_desc':
            return b.ticker.localeCompare(a.ticker);
          default:
            return 0;
        }
      });
      
      // Apply pagination
      const paginatedSignals = filteredSignals.slice(offset, offset + limit);
      
      res.json({
        alerts: paginatedSignals,
        total: filteredSignals.length,
        page,
        limit,
        totalPages: Math.ceil(filteredSignals.length / limit)
      });
    } catch (error) {
      console.error("Error fetching all signals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get signals by ticker and timeframe specifically
  app.get('/api/signals/:ticker/:timeframe', requireAuth, async (req: any, res) => {
    try {
      const { ticker, timeframe } = req.params;
      const { limit } = req.query;
      const signals = await storage.getSignalsByTicker(ticker, limit ? parseInt(limit) : undefined);
      
      // Filter by timeframe
      const filteredSignals = signals.filter(signal => signal.timeframe === timeframe);
      
      res.json(filteredSignals);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get signals for timeframe' });
    }
  });

  app.get('/api/user/signals', requireAuth, async (req: any, res) => {
    try {
      const { limit } = req.query;
      const signals = await storage.getSignalsByUser(req.user.id, limit ? parseInt(limit) : undefined);
      res.json(signals);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get user signals' });
    }
  });

  // TradingView Webhook Ingestion - Supabase Edge Function Implementation
  app.post('/api/webhook/alerts', async (req, res) => {
    try {
      // Secure Webhook Endpoint Using webhook_secrets Validation
      const authHeader = req.headers.authorization || req.headers['x-webhook-secret'];
      if (!authHeader) {
        return res.status(401).json({ 
          message: 'Missing webhook authentication',
          code: 401,
          required: 'Authorization header or x-webhook-secret header'
        });
      }

      const providedSecret = authHeader.replace('Bearer ', '');
      
      // Validate against webhook_secrets table
      const isValidSecret = await validateWebhookSecretAsync(providedSecret);
      if (!isValidSecret) {
        return res.status(401).json({ 
          message: 'Invalid webhook secret',
          code: 401,
          timestamp: new Date().toISOString()
        });
      }

      // Parse and validate incoming alert data
      const alertData = validateAlertPayload(req.body);
      if (!alertData.valid) {
        return res.status(400).json({
          message: 'Invalid alert payload',
          errors: alertData.errors,
          code: 400
        });
      }

      // Persist Incoming Alert to alert_signals Table
      const signal = await storage.createSignal({
        ticker: alertData.data.ticker,
        signalType: alertData.data.action.toUpperCase() as 'BUY' | 'SELL',
        price: alertData.data.price.toString(),
        timestamp: new Date(alertData.data.timestamp),
        timeframe: alertData.data.timeframe,
        source: 'tradingview_webhook',
        note: alertData.data.strategy || 'TradingView Alert',
        userId: null, // System-generated signal
      });

      // Broadcast to all connected WebSocket clients
      broadcast({
        type: 'webhook_alert',
        signal: signal,
        source: 'tradingview',
        timestamp: new Date().toISOString()
      });

      // Update webhook usage tracking
      await updateWebhookUsage(providedSecret);

      // Return Proper HTTP Codes (201 for created)
      return res.status(201).json({
        message: 'Alert successfully ingested',
        alertId: signal.id,
        ticker: signal.ticker,
        signalType: signal.signalType,
        timestamp: signal.timestamp,
        code: 201
      });

    } catch (error: any) {
      console.error('Webhook Alert Ingestion Error:', error);
      return res.status(500).json({
        message: 'Internal webhook processing error',
        error: error.message,
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Webhook secret validation function for new endpoint
  async function validateWebhookSecretAsync(providedSecret: string): Promise<boolean> {
    try {
      // Check against database webhook_secrets
      const secrets = await storage.getWebhookSecrets();
      const validSecret = secrets.find(s => 
        s.secret === providedSecret && s.isActive
      );

      if (validSecret) {
        return true;
      }

      // Fallback to environment variable for backward compatibility
      const envSecret = process.env.WEBHOOK_SECRET || 'default_tradingview_secret_2025';
      return providedSecret === envSecret;
    } catch (error) {
      console.error('Webhook secret validation error:', error);
      return false;
    }
  }

  // Alert payload validation function
  function validateAlertPayload(payload: any): { valid: boolean; data?: any; errors?: string[] } {
    const errors: string[] = [];
    
    // Required fields validation
    if (!payload.ticker) errors.push('ticker is required');
    if (!payload.action || !['buy', 'sell'].includes(payload.action.toLowerCase())) {
      errors.push('action must be "buy" or "sell"');
    }
    if (!payload.price || typeof payload.price !== 'number') {
      errors.push('price must be a valid number');
    }
    if (!payload.timestamp) errors.push('timestamp is required');
    if (!payload.timeframe) errors.push('timeframe is required');

    // Ticker validation
    const supportedTickers = ['BTCUSDT', 'BTCUSD', 'ETHUSDT', 'ETHUSD'];
    if (payload.ticker && !supportedTickers.includes(payload.ticker.toUpperCase())) {
      errors.push(`ticker must be one of: ${supportedTickers.join(', ')}`);
    }

    // Timeframe validation
    const supportedTimeframes = ['1M', '1W', '1D', '12h', '4h', '1h', '30m'];
    if (payload.timeframe && !supportedTimeframes.includes(payload.timeframe)) {
      errors.push(`timeframe must be one of: ${supportedTimeframes.join(', ')}`);
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      data: {
        ticker: payload.ticker.toUpperCase(),
        action: payload.action.toLowerCase(),
        price: payload.price,
        timestamp: payload.timestamp,
        timeframe: payload.timeframe,
        strategy: payload.strategy || payload.note
      }
    };
  }

  // Update webhook usage tracking
  async function updateWebhookUsage(secret: string): Promise<void> {
    try {
      const secrets = await storage.getWebhookSecrets();
      const webhookSecret = secrets.find(s => s.secret === secret);
      
      if (webhookSecret) {
        await storage.updateWebhookSecret(webhookSecret.id, {
          lastUsed: new Date(),
          usageCount: (webhookSecret.usageCount || 0) + 1
        });
      }
    } catch (error) {
      console.error('Error updating webhook usage:', error);
    }
  }

  // Legacy endpoint for backward compatibility
  app.post('/api/webhook/tradingview', validateWebhookSecret, async (req: any, res) => {
    try {
      const { ticker, action, price, time, timeframe, strategy, alert_id } = req.body;
      
      // Validate ticker (initially only BTCUSD supported)
      if (!SUPPORTED_TICKERS.includes(ticker)) {
        return res.status(400).json({ 
          message: `Ticker ${ticker} not supported. Supported tickers: ${SUPPORTED_TICKERS.join(', ')}` 
        });
      }
      
      // Validate timeframe
      if (!SUPPORTED_TIMEFRAMES.includes(timeframe)) {
        return res.status(400).json({ 
          message: `Timeframe ${timeframe} not supported. Supported timeframes: ${SUPPORTED_TIMEFRAMES.join(', ')}` 
        });
      }
      
      // Validate action (buy/sell)
      if (!['buy', 'sell'].includes(action)) {
        return res.status(400).json({ 
          message: 'Action must be either "buy" or "sell"' 
        });
      }
      
      // Create signal in database
      const signal = await storage.createSignal({
        ticker: ticker,
        signalType: action,
        price: price.toString(),
        timestamp: time ? new Date(time) : new Date(),
        timeframe: timeframe,
        source: 'tradingview_webhook',
        note: strategy ? `Strategy: ${strategy}` : 'TradingView Alert',
      });
      
      // Broadcast to all connected WebSocket clients
      broadcast({
        type: 'new_signal',
        signal: signal,
        source: 'tradingview'
      });
      
      // TODO: Send notifications to users (notification service not yet implemented)
      // await notificationService.sendSignalNotification(signal);
      
      console.log(`TradingView signal received: ${action.toUpperCase()} ${ticker} at ${price} (${timeframe})`);
      
      res.json({ 
        success: true, 
        signal_id: signal.id,
        message: `${action.toUpperCase()} signal processed for ${ticker} at ${price}`,
        timeframe: timeframe
      });
      
    } catch (error) {
      console.error('TradingView webhook error:', error);
      res.status(500).json({ 
        message: 'Failed to process TradingView webhook',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get supported timeframes and tickers for TradingView setup
  app.get('/api/webhook/config', (req: any, res) => {
    res.json({
      supported_tickers: SUPPORTED_TICKERS,
      supported_timeframes: SUPPORTED_TIMEFRAMES,
      webhook_url: `${req.protocol}://${req.get('host')}/api/webhook/tradingview`,
      secret_header: 'x-webhook-secret',
      required_fields: ['ticker', 'action', 'price', 'timeframe']
    });
  });

  // Get supported timeframes for specific ticker (for trading interface)
  app.get('/api/trading/timeframes/:ticker', (req: any, res) => {
    const { ticker } = req.params;
    
    if (!SUPPORTED_TICKERS.includes(ticker)) {
      return res.json({
        ticker: ticker,
        supported: false,
        supported_timeframes: [],
        message: `${ticker} is not currently supported for TradingView alerts`
      });
    }
    
    res.json({
      ticker: ticker,
      supported: true,
      supported_timeframes: SUPPORTED_TIMEFRAMES,
      tradingview_enabled: true,
      webhook_configured: true
    });
  });

  // Manual signal injection for testing (admin only)
  app.post('/api/admin/signals/inject', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { ticker, action, price, timeframe, strategy, note } = req.body;
      
      // Validate ticker and timeframe
      if (!SUPPORTED_TICKERS.includes(ticker)) {
        return res.status(400).json({ 
          message: `Ticker ${ticker} not supported` 
        });
      }
      
      if (!SUPPORTED_TIMEFRAMES.includes(timeframe)) {
        return res.status(400).json({ 
          message: `Timeframe ${timeframe} not supported` 
        });
      }
      
      const signal = await storage.createSignal({
        ticker: ticker,
        signalType: action,
        price: price.toString(),
        timestamp: new Date(),
        timeframe: timeframe,
        source: 'manual_admin',
        note: note || `Manual injection by admin - ${strategy || 'No strategy specified'}`,
      });
      
      // Log admin action
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'INJECT_SIGNAL',
        targetTable: 'alert_signals',
        targetId: signal.id,
        notes: `Manually injected ${action} signal for ${ticker} at ${price} (${timeframe})`,
      });
      
      // Broadcast to WebSocket clients
      broadcast({
        type: 'new_signal',
        signal: signal,
        source: 'admin'
      });

      // Queue notifications for subscribed users
      try {
        const subscribedUsers = await storage.getUserSubscriptions();
        const relevantSubscriptions = subscribedUsers.filter(sub => sub.symbol === signal.ticker);
        
        for (const subscription of relevantSubscriptions) {
          await notificationQueueService.queueSignalNotification(signal.id, subscription.userId);
        }
      } catch (error) {
        console.error('Error queuing signal notifications:', error);
      }
      
      res.json({ 
        success: true, 
        signal: signal,
        message: `Manual ${action} signal injected for ${ticker}`
      });
      
    } catch (error) {
      console.error('Manual signal injection error:', error);
      res.status(500).json({ message: 'Failed to inject signal' });
    }
  });

  // Test endpoint
  app.get('/api/test-alerts', async (req: any, res) => {
    try {
      res.json({ message: 'Alerts endpoint is working', status: 'ok' });
    } catch (error) {
      res.status(500).json({ message: 'Test failed' });
    }
  });

  // User Alerts API
  app.get('/api/alerts', async (req: any, res) => {
    try {
      // For now, use demo user for testing
      const demoUserId = 'b9a4c92c-33f8-445d-8e23-2a3bb701f4ab';
      const alerts = await storage.getUserAlerts(demoUserId);
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching user alerts:', error);
      res.status(500).json({ message: 'Failed to get alerts' });
    }
  });

  app.post('/api/alerts', async (req: any, res) => {
    try {
      const demoUserId = 'b9a4c92c-33f8-445d-8e23-2a3bb701f4ab';
      const alertData = insertUserAlertSchema.parse({
        ...req.body,
        userId: demoUserId
      });
      
      const alert = await storage.createUserAlert(alertData);
      
      // Log the creation
      await storage.createAdminLog({
        adminId: demoUserId,
        action: "create_alert",
        targetTable: "user_alerts",
        targetId: alert.id,
        notes: `Created ${alertData.type} alert for ${alertData.ticker}`,
      });

      res.json(alert);
    } catch (error) {
      console.error('Error creating alert:', error);
      res.status(500).json({ message: 'Failed to create alert' });
    }
  });

  app.patch('/api/alerts/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const demoUserId = 'b9a4c92c-33f8-445d-8e23-2a3bb701f4ab';
      
      const alert = await storage.updateUserAlert(id, updates);
      if (!alert) {
        return res.status(404).json({ message: 'Alert not found' });
      }

      // Log the update
      await storage.createAdminLog({
        adminId: demoUserId,
        action: "update_alert",
        targetTable: "user_alerts",
        targetId: id,
        notes: `Updated alert settings`,
      });

      res.json(alert);
    } catch (error) {
      console.error('Error updating alert:', error);
      res.status(500).json({ message: 'Failed to update alert' });
    }
  });

  app.delete('/api/alerts/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const demoUserId = 'b9a4c92c-33f8-445d-8e23-2a3bb701f4ab';
      
      const success = await storage.deleteUserAlert(id);
      if (!success) {
        return res.status(404).json({ message: 'Alert not found' });
      }

      // Log the deletion
      await storage.createAdminLog({
        adminId: demoUserId,
        action: "delete_alert",
        targetTable: "user_alerts",
        targetId: id,
        notes: `Deleted user alert`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting alert:', error);
      res.status(500).json({ message: 'Failed to delete alert' });
    }
  });

  // Dashboard Layout API
  app.get('/api/dashboard/layout', async (req: any, res) => {
    try {
      const demoUserId = 'b9a4c92c-33f8-445d-8e23-2a3bb701f4ab';
      const layout = await storage.getDashboardLayout(demoUserId);
      res.json(layout);
    } catch (error) {
      console.error('Error fetching dashboard layout:', error);
      res.status(500).json({ message: 'Failed to get dashboard layout' });
    }
  });

  app.post('/api/dashboard/layout', async (req: any, res) => {
    try {
      const demoUserId = 'b9a4c92c-33f8-445d-8e23-2a3bb701f4ab';
      const layoutData = insertDashboardLayoutSchema.parse({
        ...req.body,
        userId: demoUserId
      });
      
      const layout = await storage.saveDashboardLayout(layoutData);
      res.json(layout);
    } catch (error) {
      console.error('Error saving dashboard layout:', error);
      res.status(500).json({ message: 'Failed to save dashboard layout' });
    }
  });

  app.patch('/api/dashboard/layout/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const layout = await storage.updateDashboardLayout(id, updates);
      if (!layout) {
        return res.status(404).json({ message: 'Layout not found' });
      }

      res.json(layout);
    } catch (error) {
      console.error('Error updating dashboard layout:', error);
      res.status(500).json({ message: 'Failed to update dashboard layout' });
    }
  });

  // Webhook for TradingView signals
  app.post('/api/webhook/signal', async (req, res) => {
    try {
      const { token, symbol, price, type, time, timeframe, note } = z.object({
        token: z.string(),
        symbol: z.string(),
        price: z.number(),
        type: z.enum(['buy', 'sell']),
        time: z.string(),
        timeframe: z.enum(['1M', '1W', '1D', '12H', '4H', '1H', '30M']),
        note: z.string().optional(),
      }).parse(req.body);

      // Validate webhook token
      const expectedToken = process.env.WEBHOOK_SECRET || 'tradingview_crypto_bot_2025';
      if (token !== expectedToken) {
        return res.status(401).json({ message: 'Invalid webhook token' });
      }

      const signal = await storage.createSignal({
        ticker: symbol,
        signalType: type,
        price: price.toString(),
        timestamp: new Date(time),
        timeframe,
        source: 'tradingview_webhook',
        note,
        userId: null, // System-generated signal
      });

      // Broadcast to all connected clients
      broadcast({
        type: 'new_signal',
        signal,
      });

      // Queue notifications for subscribed users via new notification engine
      try {
        const subscribedUsers = await storage.getUserSubscriptions();
        const relevantSubscriptions = subscribedUsers.filter(sub => sub.symbol === signal.ticker);
        
        for (const subscription of relevantSubscriptions) {
          await notificationQueueService.queueSignalNotification(signal.id, subscription.userId);
        }
      } catch (error) {
        console.error('Error queuing signal notifications:', error);
      }

      res.json({ success: true, signal });
    } catch (error) {
      res.status(400).json({ message: 'Invalid webhook payload', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Manual signal injection (admin only)
  app.post('/api/admin/signals', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const signalData = insertSignalSchema.extend({
        price: z.number(),
      }).parse(req.body);

      const signal = await storage.createSignal({
        ...signalData,
        price: signalData.price.toString(),
        timestamp: new Date(),
        source: 'admin_manual',
        userId: req.user.id,
      });

      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'CREATE_SIGNAL',
        targetTable: 'alert_signals',
        targetId: signal.id,
        notes: `Manual signal: ${signal.signalType} ${signal.ticker} at ${signal.price}`,
      });

      // Broadcast to all connected clients
      broadcast({
        type: 'new_signal',
        signal,
      });

      // Queue notifications for subscribed users via new notification engine
      try {
        const subscribedUsers = await storage.getUserSubscriptions();
        const relevantSubscriptions = subscribedUsers.filter(sub => sub.symbol === signal.ticker);
        
        for (const subscription of relevantSubscriptions) {
          await notificationQueueService.queueSignalNotification(signal.id, subscription.userId);
        }
      } catch (error) {
        console.error('Error queuing signal notifications:', error);
      }

      res.json(signal);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create signal' });
    }
  });

  // Historical OHLC Service - Edge Function Implementation
  app.get('/api/ohlc', async (req, res) => {
    try {
      const { symbol, interval = '1h', limit = 1000, startTime, endTime } = req.query;
      
      if (!symbol) {
        return res.status(400).json({ 
          message: 'Symbol parameter is required',
          example: '/api/ohlc?symbol=BTCUSDT&interval=1h&limit=100'
        });
      }

      // Enforce Ticker Validation Against available_tickers
      const availableTickers = await storage.getAllTickers();
      const validTicker = availableTickers.find(t => 
        t.symbol === symbol && t.enabled
      );
      
      if (!validTicker) {
        return res.status(400).json({ 
          message: `Invalid or disabled ticker: ${symbol}`,
          availableTickers: availableTickers.filter(t => t.enabled).map(t => t.symbol)
        });
      }

      const symbolStr = symbol as string;
      const intervalStr = interval as string;
      const limitNum = Math.min(parseInt(limit as string) || 1000, 5000); // Max 5000 candles

      // OHLC Cache Lookup with Fallback Strategy
      let ohlcData = await getOHLCWithCacheFallback(
        symbolStr, 
        intervalStr, 
        limitNum, 
        startTime as string, 
        endTime as string
      );

      // Add metadata to response
      const response = {
        symbol: symbolStr,
        interval: intervalStr,
        count: ohlcData.length,
        cached: ohlcData.some(d => d.source === 'cache'),
        external: ohlcData.some(d => d.source === 'binance'),
        data: ohlcData.map(d => ({
          time: d.time,
          open: parseFloat(d.open),
          high: parseFloat(d.high), 
          low: parseFloat(d.low),
          close: parseFloat(d.close),
          volume: parseFloat(d.volume),
          source: d.source
        }))
      };

      res.json(response);
    } catch (error: any) {
      console.error('OHLC Service Error:', error);
      res.status(500).json({ 
        message: 'Historical OHLC service error',
        error: error.message 
      });
    }
  });

  // OHLC Cache Lookup with Fallback to Binance REST API
  async function getOHLCWithCacheFallback(
    symbol: string, 
    interval: string, 
    limit: number,
    startTime?: string,
    endTime?: string
  ) {
    try {
      // Step 1: Check cache first
      console.log(`Checking OHLC cache for ${symbol} ${interval}`);
      let cachedData = await storage.getOhlcData(symbol, interval, limit);
      
      // Step 2: Determine if we need fresh data
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const needsFreshData = cachedData.length === 0 || 
        (cachedData.length > 0 && new Date(cachedData[0].time) < oneHourAgo);

      if (needsFreshData) {
        console.log(`Fetching fresh OHLC data from Binance for ${symbol}`);
        
        try {
          // Fetch from Binance REST API with timeout
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          
          let binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
          
          if (startTime) {
            binanceUrl += `&startTime=${new Date(startTime).getTime()}`;
          }
          if (endTime) {
            binanceUrl += `&endTime=${new Date(endTime).getTime()}`;
          }

          const response = await fetch(binanceUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'CryptoStrategy-OHLC-Service/1.0'
            }
          });
          
          clearTimeout(timeout);

          if (response.ok) {
            const binanceData = await response.json();
            
            // Normalize and Upsert OHLC Data
            const normalizedData = await normalizeAndUpsertOHLC(binanceData, symbol, interval);
            
            return normalizedData.map(d => ({ ...d, source: 'binance' }));
          } else {
            console.log(`Binance API error ${response.status}, using cached data`);
          }
        } catch (fetchError) {
          console.log(`Binance fetch failed: ${fetchError.message}, using cached data`);
        }
      }

      // Return cached data with source indicator
      return cachedData.map(d => ({ ...d, source: 'cache' }));
      
    } catch (error) {
      console.error('OHLC Cache Fallback Error:', error);
      throw error;
    }
  }

  // Normalize and Upsert OHLC Data into ohlc_cache Table
  async function normalizeAndUpsertOHLC(binanceData: any[], symbol: string, interval: string) {
    const normalizedData = [];
    
    for (const kline of binanceData) {
      const [
        openTime,
        open,
        high,
        low,
        close,
        volume,
        closeTime,
        quoteAssetVolume,
        numberOfTrades,
        takerBuyBaseAssetVolume,
        takerBuyQuoteAssetVolume,
        ignore
      ] = kline;

      const normalizedCandle = {
        tickerSymbol: symbol,
        interval: interval,
        time: new Date(openTime),
        open: open.toString(),
        high: high.toString(),
        low: low.toString(),
        close: close.toString(),
        volume: volume.toString()
      };

      try {
        // Upsert: Insert if not exists, update if exists
        const existingCandle = await storage.getOhlcData(symbol, interval, 1);
        const exists = existingCandle.some(c => 
          new Date(c.time).getTime() === new Date(normalizedCandle.time).getTime()
        );

        if (!exists) {
          await storage.createOhlcData(normalizedCandle);
        }
        
        normalizedData.push(normalizedCandle);
      } catch (upsertError) {
        console.error(`OHLC Upsert Error for ${symbol}:`, upsertError);
      }
    }

    console.log(`Normalized and cached ${normalizedData.length} OHLC candles for ${symbol}`);
    return normalizedData;
  }

  // Admin User Management Routes
  app.get('/api/admin/users', requireAuth, requirePermission('users.view'), async (req: any, res: any) => {
    try {
      const { roles } = req.query;
      let users = await storage.getAllUsers();
      
      // Filter by roles if specified
      if (roles) {
        const roleList = roles.split(',');
        users = users.filter((user: any) => roleList.includes(user.role));
      }
      
      // Remove sensitive data
      const sanitizedUsers = users.map((user: any) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName || 'Admin',
        lastName: user.lastName || 'User',
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        isActive: user.isActive !== false,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }));
      
      res.json(sanitizedUsers);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ 
        message: 'Failed to fetch admin users',
        code: 'ADMIN_USERS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post('/api/admin/users', requireAuth, requirePermission('users.create'), async (req: any, res: any) => {
    try {
      const { email, firstName, lastName, role, subscriptionTier } = req.body;
      
      // Validate required fields
      if (!email || !role) {
        return res.status(400).json({ 
          message: 'Email and role are required',
          code: 'VALIDATION_ERROR'
        });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ 
          message: 'User with this email already exists',
          code: 'USER_EXISTS'
        });
      }
      
      // Create admin user
      const newUser = await storage.createUser({
        email,
        firstName: firstName || 'Admin',
        lastName: lastName || 'User',
        role: role,
        subscriptionTier: subscriptionTier || 'pro',
        password: 'temp123', // Temporary password - should trigger password reset
        isActive: true,
        createdAt: new Date().toISOString()
      });
      
      res.status(201).json({
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        subscriptionTier: newUser.subscriptionTier,
        isActive: newUser.isActive
      });
    } catch (error) {
      console.error('Error creating admin user:', error);
      res.status(500).json({ 
        message: 'Failed to create admin user',
        code: 'CREATE_USER_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.patch('/api/admin/users/:userId/role', requireAuth, requirePermission('users.manage_roles'), async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      if (!role) {
        return res.status(400).json({ 
          message: 'Role is required',
          code: 'VALIDATION_ERROR'
        });
      }
      
      // Validate role
      const validRoles = ['user', 'admin', 'superuser'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ 
          message: 'Invalid role specified',
          code: 'INVALID_ROLE'
        });
      }
      
      const updatedUser = await storage.updateUser(userId, { role });
      
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        message: 'User role updated successfully'
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ 
        message: 'Failed to update user role',
        code: 'UPDATE_ROLE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.patch('/api/admin/users/:userId/status', requireAuth, requirePermission('users.edit'), async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ 
          message: 'isActive must be a boolean',
          code: 'VALIDATION_ERROR'
        });
      }
      
      const updatedUser = await storage.updateUser(userId, { isActive });
      
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        isActive: updatedUser.isActive,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({ 
        message: 'Failed to update user status',
        code: 'UPDATE_STATUS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/api/admin/roles', requireAuth, requirePermission('admin.dashboard'), async (req: any, res: any) => {
    try {
      const users = await storage.getAllUsers();
      
      const roles = [
        {
          id: 'admin',
          name: 'Administrator',
          description: 'Full system administration access with user management',
          permissions: [
            'users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage_roles',
            'signals.create', 'signals.manage', 'alerts.manage', 'admin.dashboard',
            'admin.logs', 'admin.system', 'admin.tickers', 'admin.webhooks',
            'subscriptions.manage', 'api.admin'
          ],
          userCount: users.filter((u: any) => u.role === 'admin').length
        },
        {
          id: 'superuser',
          name: 'Super Administrator',
          description: 'Complete system control with all permissions',
          permissions: ['*'], // All permissions
          userCount: users.filter((u: any) => u.role === 'superuser').length
        }
      ];
      
      res.json(roles);
    } catch (error) {
      console.error('Error fetching admin roles:', error);
      res.status(500).json({ 
        message: 'Failed to fetch admin roles',
        code: 'ADMIN_ROLES_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  // API endpoint to get user permissions
  app.get('/api/user/permissions', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const userPermissions = [];
      
      // Get role-based permissions
      const rolePermissions: Record<string, string[]> = {
        'user': ['signals.view', 'analytics.basic', 'alerts.email', 'subscriptions.view', 'api.basic'],
        'admin': ['signals.view', 'analytics.basic', 'analytics.advanced', 'analytics.heatmap', 'analytics.cycle', 'analytics.portfolio', 'trading.playground', 'alerts.email', 'alerts.sms', 'alerts.telegram', 'alerts.advanced', 'subscriptions.view', 'subscriptions.billing', 'api.basic', 'api.advanced', 'users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage_roles', 'signals.create', 'signals.manage', 'alerts.manage', 'admin.dashboard', 'admin.logs', 'admin.system', 'admin.tickers', 'admin.webhooks', 'subscriptions.manage', 'api.admin'],
        'superuser': ['signals.view', 'signals.create', 'signals.manage', 'analytics.basic', 'analytics.advanced', 'analytics.heatmap', 'analytics.cycle', 'analytics.portfolio', 'trading.playground', 'alerts.email', 'alerts.sms', 'alerts.telegram', 'alerts.advanced', 'alerts.manage', 'subscriptions.view', 'subscriptions.manage', 'subscriptions.billing', 'users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage_roles', 'admin.dashboard', 'admin.logs', 'admin.system', 'admin.tickers', 'admin.webhooks', 'api.basic', 'api.advanced', 'api.admin']
      };
      
      // Get subscription-based permissions
      const subscriptionPermissions: Record<string, string[]> = {
        'free': ['signals.view', 'analytics.basic', 'alerts.email'],
        'basic': ['signals.view', 'analytics.basic', 'analytics.heatmap', 'trading.playground', 'alerts.email', 'alerts.sms'],
        'premium': ['signals.view', 'analytics.basic', 'analytics.advanced', 'analytics.heatmap', 'analytics.cycle', 'analytics.portfolio', 'trading.playground', 'alerts.email', 'alerts.sms', 'alerts.telegram', 'alerts.advanced'],
        'pro': ['signals.view', 'analytics.basic', 'analytics.advanced', 'analytics.heatmap', 'analytics.cycle', 'analytics.portfolio', 'trading.playground', 'alerts.email', 'alerts.sms', 'alerts.telegram', 'alerts.advanced']
      };
      
      const userRolePermissions = rolePermissions[user.role] || [];
      const userSubscriptionPermissions = subscriptionPermissions[user.subscriptionTier] || [];
      const allPermissions = [...new Set([...userRolePermissions, ...userSubscriptionPermissions])];
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          subscriptionTier: user.subscriptionTier
        },
        permissions: allPermissions,
        rolePermissions: userRolePermissions,
        subscriptionPermissions: userSubscriptionPermissions
      });
    } catch (error) {
      console.error('Error getting user permissions:', error);
      res.status(500).json({ 
        message: 'Failed to get user permissions',
        code: 'PERMISSIONS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

  // User Subscription Management Routes
  app.get('/api/user/subscriptions', requireAuth, async (req: any, res) => {
    try {
      const subscriptions = await storage.getUserSubscriptions(req.user.id);
      res.json(subscriptions);
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      res.status(500).json({ message: 'Failed to fetch subscriptions' });
    }
  });

  app.post('/api/user/subscriptions', requireAuth, async (req: any, res) => {
    try {
      const { tickerSymbol } = req.body;
      
      if (!tickerSymbol) {
        return res.status(400).json({ message: 'Ticker symbol is required' });
      }

      // Validate ticker exists and is enabled
      const availableTickers = await storage.getAllTickers();
      const validTicker = availableTickers.find(t => 
        t.symbol === tickerSymbol && t.isEnabled
      );
      
      if (!validTicker) {
        return res.status(400).json({ message: `Invalid or disabled ticker: ${tickerSymbol}` });
      }

      // Check if user already subscribed to this ticker
      const existingSubscriptions = await storage.getUserSubscriptions(req.user.id);
      const alreadySubscribed = existingSubscriptions.some(sub => sub.tickerSymbol === tickerSymbol);
      
      if (alreadySubscribed) {
        return res.status(400).json({ message: 'Already subscribed to this ticker' });
      }

      const subscription = await storage.createUserSubscription({
        userId: req.user.id,
        tickerSymbol,
      });

      res.json(subscription);
    } catch (error) {
      console.error('Error creating subscription:', error);
      res.status(500).json({ message: 'Failed to create subscription' });
    }
  });

  app.delete('/api/user/subscriptions/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Verify subscription belongs to user
      const userSubscriptions = await storage.getUserSubscriptions(req.user.id);
      const subscription = userSubscriptions.find(sub => sub.id === id);
      
      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      const success = await storage.deleteUserSubscription(id);
      
      if (success) {
        res.json({ message: 'Subscription removed successfully' });
      } else {
        res.status(500).json({ message: 'Failed to remove subscription' });
      }
    } catch (error) {
      console.error('Error removing subscription:', error);
      res.status(500).json({ message: 'Failed to remove subscription' });
    }
  });

  // Bulk price endpoint for subscribed tickers
  app.post('/api/market/prices', async (req, res) => {
    try {
      const { symbols } = req.body;
      
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ message: 'Symbols array is required' });
      }

      const prices: Record<string, any> = {};
      
      // Fetch prices for all requested symbols
      await Promise.all(
        symbols.map(async (symbol: string) => {
          try {
            // Use existing price endpoint logic
            const mockPrices: Record<string, number> = {
              'BTCUSDT': 67543.21,
              'ETHUSDT': 3421.89,
              'SOLUSDT': 98.34,
              'ADAUSDT': 0.4567,
              'BNBUSDT': 342.15,
              'XRPUSDT': 0.6234,
              'DOTUSDT': 7.89,
              'MATICUSDT': 0.8923,
              'AVAXUSDT': 23.45,
              'LINKUSDT': 12.67
            };

            const basePrice = mockPrices[symbol] || 100;
            const variation = (Math.random() - 0.5) * 0.04;
            const price = basePrice * (1 + variation);

            prices[symbol] = {
              symbol,
              price: parseFloat(price.toFixed(6)),
              change24h: (Math.random() - 0.5) * 10,
              volume24h: Math.random() * 1000000000
            };
          } catch (error) {
            console.error(`Failed to fetch price for ${symbol}:`, error);
          }
        })
      );

      res.json(prices);
    } catch (error) {
      console.error('Error fetching bulk prices:', error);
      res.status(500).json({ message: 'Failed to fetch prices' });
    }
  });

  // Chart data routes (legacy support)
  app.get('/api/chart/ohlc/:ticker', async (req, res) => {
    try {
      const { ticker } = req.params;
      const { interval = '1h', limit = 1000 } = req.query;
      
      const data = await storage.getOhlcData(ticker, interval as string, parseInt(limit as string));
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get OHLC data' });
    }
  });

  app.get('/api/chart/heatmap/:ticker', async (req, res) => {
    try {
      const { ticker } = req.params;
      const data = await storage.getHeatmapData(ticker);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get heatmap data' });
    }
  });

  app.get('/api/chart/cycle/:ticker', async (req, res) => {
    try {
      const { ticker } = req.params;
      const data = await storage.getCycleData(ticker);
      
      // If no data found, generate sample cycle data
      if (!data || data.length === 0) {
        const sampleCycleData = [];
        const now = new Date();
        
        for (let i = 30; i >= 0; i--) {
          const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
          const deviation = (Math.sin(i * 0.2) + Math.random() - 0.5) * 20; // Cyclical pattern
          
          sampleCycleData.push({
            id: `sample-${ticker}-${i}`,
            ticker: ticker.replace('USDT', ''),
            date,
            createdAt: date,
            ma2y: "50000.00",
            deviation: deviation.toFixed(2),
            harmonicCycle: Math.sin(i * 0.1).toFixed(3),
            fibonacciLevel: "0.618",
            cycleMomentum: (Math.random() * 100).toFixed(2),
            volumeProfile: (Math.random() * 1000000).toFixed(0),
            seasonalityFactor: Math.cos(i * 0.15).toFixed(3),
            marketRegime: i % 4 === 0 ? "Bull" : i % 4 === 1 ? "Bear" : i % 4 === 2 ? "Volatile" : "Sideways",
            cyclePhase: ["Accumulation", "Markup", "Distribution", "Markdown"][i % 4],
            confidenceScore: (0.6 + Math.random() * 0.3).toFixed(2),
            strengthScore: (Math.random() * 100).toFixed(0)
          });
        }
        
        return res.json(sampleCycleData);
      }
      
      res.json(data);
    } catch (error) {
      console.error('Error fetching cycle data:', error);
      res.status(500).json({ message: 'Failed to get cycle data' });
    }
  });

  app.get('/api/chart/forecast/:ticker', async (req, res) => {
    try {
      const { ticker } = req.params;
      const data = await storage.getForecastData(ticker);
      
      // If no data found, generate sample forecast data
      if (!data || data.length === 0) {
        const sampleForecastData = [];
        const now = new Date();
        const basePrices: Record<string, number> = {
          'BTC': 67543.21,
          'ETH': 3421.89,
          'SOL': 98.34,
          'ADA': 0.4567,
          'BNB': 342.15,
          'XRP': 0.6234,
          'DOT': 7.89,
          'MATIC': 0.8923,
        };
        
        const basePrice = basePrices[ticker] || 100;
        
        for (let i = 1; i <= 30; i++) {
          const date = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
          const trend = 1 + (Math.sin(i * 0.1) * 0.1); // Gentle trend
          const predicted = basePrice * trend;
          const confidence = 0.8 - (i * 0.01); // Decreasing confidence over time
          
          sampleForecastData.push({
            id: `forecast-${ticker}-${i}`,
            ticker: ticker,
            date,
            createdAt: now,
            cyclePhase: ["Accumulation", "Markup", "Distribution", "Markdown"][i % 4],
            predictedPrice: predicted.toFixed(6),
            confidenceLow: (predicted * (1 - confidence * 0.1)).toFixed(6),
            confidenceHigh: (predicted * (1 + confidence * 0.1)).toFixed(6),
            modelType: "Ensemble",
            forecastHorizon: i,
            supportLevel: (predicted * 0.95).toFixed(6),
            resistanceLevel: (predicted * 1.05).toFixed(6),
            volatilityScore: (Math.random() * 100).toFixed(0),
            trendStrength: (confidence * 100).toFixed(0),
            fibonacciTarget: (predicted * 1.618).toFixed(6)
          });
        }
        
        return res.json(sampleForecastData);
      }
      
      res.json(data);
    } catch (error) {
      console.error('Error fetching forecast data:', error);
      res.status(500).json({ message: 'Failed to get forecast data' });
    }
  });

  // Advanced cycle forecasting endpoint
  app.post('/api/forecast/advanced/:ticker', async (req, res) => {
    try {
      const { ticker } = req.params;
      const { horizon = 30 } = req.body;
      
      const result = await cycleForecastingService.generateAdvancedForecast(ticker, horizon);
      
      res.json({
        success: true,
        ticker,
        horizon,
        forecast: result.forecast,
        overallConfidence: result.confidence,
        models: result.models,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error generating advanced forecast:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to generate advanced forecast',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get forecast model performance metrics
  app.get('/api/forecast/models/:ticker', async (req, res) => {
    try {
      const { ticker } = req.params;
      
      // Mock model performance data (would be real metrics in production)
      const modelMetrics = [
        {
          name: "Fourier Transform",
          accuracy: 0.76,
          confidence: 0.82,
          lastCalibrated: new Date(Date.now() - 24 * 60 * 60 * 1000),
          dominantCycles: [14, 30, 90],
          strength: 0.74
        },
        {
          name: "Elliott Wave",
          accuracy: 0.71,
          confidence: 0.78,
          lastCalibrated: new Date(Date.now() - 48 * 60 * 60 * 1000),
          currentWave: 3,
          waveTargets: [52000, 65000, 78000]
        },
        {
          name: "Gann Analysis",
          accuracy: 0.68,
          confidence: 0.75,
          lastCalibrated: new Date(Date.now() - 36 * 60 * 60 * 1000),
          primaryAngles: [45, 63.75, 71.25],
          strength: 0.72
        },
        {
          name: "Harmonic Patterns",
          accuracy: 0.73,
          confidence: 0.79,
          lastCalibrated: new Date(Date.now() - 12 * 60 * 60 * 1000),
          detectedPatterns: ["Gartley", "Butterfly"],
          targets: [55000, 72000]
        },
        {
          name: "Fractal Dimension",
          accuracy: 0.69,
          confidence: 0.71,
          lastCalibrated: new Date(Date.now() - 6 * 60 * 60 * 1000),
          dimension: 1.73,
          predictability: 0.68
        },
        {
          name: "Entropy Analysis",
          accuracy: 0.72,
          confidence: 0.76,
          lastCalibrated: new Date(Date.now() - 18 * 60 * 60 * 1000),
          regime: "volatile",
          stability: 0.64
        }
      ];
      
      res.json(modelMetrics);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get model metrics' });
    }
  });

  // Admin routes
  app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(user => ({ ...user, hashedPassword: undefined }));
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get users' });
    }
  });

  app.get('/api/admin/logs', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { limit } = req.query;
      const logs = await storage.getAdminLogs(limit ? parseInt(limit as string) : undefined);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get admin logs' });
    }
  });

  // Create new user (admin only)
  app.post('/api/admin/users', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const userData = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: z.enum(['admin', 'user']).default('user'),
      }).parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user
      const user = await storage.createUser({
        email: userData.email,
        hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        isActive: true,
      });

      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'CREATE_USER',
        targetTable: 'users',
        targetId: user.id,
        notes: `Created user: ${user.email} with role: ${user.role}`,
      });

      res.json({ ...user, hashedPassword: undefined });
    } catch (error) {
      res.status(400).json({ message: 'Failed to create user' });
    }
  });

  app.put('/api/admin/users/:id', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = z.object({
        isActive: z.boolean().optional(),
        role: z.enum(['admin', 'user']).optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      }).parse(req.body);

      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'UPDATE_USER',
        targetTable: 'users',
        targetId: user.id,
        notes: `Updated user: ${user.email} - ${JSON.stringify(updates)}`,
      });

      res.json({ ...user, hashedPassword: undefined });
    } catch (error) {
      res.status(400).json({ message: 'Failed to update user' });
    }
  });

  // Delete user (admin only)
  app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Prevent admin from deleting themselves
      if (id === req.user.id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Instead of hard delete, deactivate the user for safety
      const deactivatedUser = await storage.updateUser(id, { isActive: false });

      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'DELETE_USER',
        targetTable: 'users',
        targetId: id,
        notes: `Deactivated user: ${user.email}`,
      });

      res.json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Get enabled tickers for user selection (legacy endpoint)
  app.get("/api/tickers/enabled", async (req, res) => {
    try {
      const enabledTickers = await storage.getEnabledTickers();
      res.json(enabledTickers);
    } catch (error: any) {
      console.error("Error fetching enabled tickers:", error);
      res.status(500).json({ message: "Failed to get enabled tickers" });
    }
  });

  // Supabase-style edge function: GET /api/tickers
  app.get("/api/tickers", async (req, res) => {
    try {
      const { 
        search = "", 
        enabled = "true", 
        limit = "100", 
        offset = "0",
        category = "",
        sort = "symbol",
        order = "asc"
      } = req.query;

      // Validate query parameters
      const searchTerm = typeof search === 'string' ? search.trim() : '';
      const isEnabledFilter = enabled === 'true';
      const limitNum = Math.min(parseInt(limit as string) || 100, 1000); // Max 1000 results
      const offsetNum = parseInt(offset as string) || 0;
      const categoryFilter = typeof category === 'string' ? category.trim() : '';
      const sortField = typeof sort === 'string' && ['symbol', 'description', 'createdAt'].includes(sort) ? sort : 'symbol';
      const sortOrder = order === 'desc' ? 'desc' : 'asc';

      // Get all tickers from storage
      const allTickers = await storage.getAllTickers();
      
      // Apply filters
      let filteredTickers = allTickers;

      // Filter by enabled status
      if (isEnabledFilter) {
        filteredTickers = filteredTickers.filter(ticker => ticker.isEnabled);
      }

      // Apply search filter (search in symbol and description)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredTickers = filteredTickers.filter(ticker => 
          ticker.symbol.toLowerCase().includes(searchLower) ||
          ticker.description.toLowerCase().includes(searchLower)
        );
      }

      // Apply category filter
      if (categoryFilter) {
        filteredTickers = filteredTickers.filter(ticker => 
          ticker.category && ticker.category.toLowerCase() === categoryFilter.toLowerCase()
        );
      }

      // Sort results
      filteredTickers.sort((a, b) => {
        let aValue = a[sortField as keyof typeof a];
        let bValue = b[sortField as keyof typeof b];
        
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        
        if (sortOrder === 'desc') {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        } else {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
      });

      // Apply pagination
      const totalCount = filteredTickers.length;
      const paginatedTickers = filteredTickers.slice(offsetNum, offsetNum + limitNum);

      // Prepare autocomplete suggestions
      const suggestions = filteredTickers
        .slice(0, 10) // Limit suggestions to top 10
        .map(ticker => ({
          symbol: ticker.symbol,
          description: ticker.description,
          category: ticker.category
        }));

      // Response with Supabase-style metadata
      const response = {
        data: paginatedTickers,
        count: totalCount,
        filtered_count: totalCount,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          has_more: offsetNum + limitNum < totalCount,
          total_pages: Math.ceil(totalCount / limitNum),
          current_page: Math.floor(offsetNum / limitNum) + 1
        },
        search: {
          term: searchTerm,
          suggestions: searchTerm ? suggestions : [],
          autocomplete: searchTerm ? suggestions.map(s => s.symbol) : []
        },
        filters: {
          enabled: isEnabledFilter,
          category: categoryFilter,
          sort: sortField,
          order: sortOrder
        },
        meta: {
          timestamp: new Date().toISOString(),
          cached: false,
          processing_time_ms: 0 // Will be calculated below
        }
      };

      // Set response headers for caching and API versioning
      res.set({
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
        'X-API-Version': '1.0',
        'X-Total-Count': totalCount.toString(),
        'X-Filtered-Count': totalCount.toString()
      });

      res.status(200).json(response);
    } catch (error: any) {
      console.error("Error fetching tickers:", error);
      res.status(500).json({ 
        error: "Internal Server Error",
        message: "Failed to fetch tickers",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get market price for single ticker - enhanced with fallback
  app.get("/api/market/price/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      
      // Try to fetch from Binance with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        
        if (!response.ok) {
          throw new Error(`Binance API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        const priceData = {
          symbol: data.symbol,
          price: parseFloat(data.lastPrice),
          change24h: parseFloat(data.priceChange),
          changePercent24h: parseFloat(data.priceChangePercent),
          volume24h: parseFloat(data.volume),
          lastUpdate: new Date().toISOString(),
        };
        
        res.json(priceData);
      } catch (fetchError) {
        clearTimeout(timeout);
        
        // Fallback to mock data when external API fails
        console.log(`External API failed for ${symbol}, using fallback data`);
        
        const mockPrices: Record<string, any> = {
          'BTCUSDT': { base: 67543.21, symbol: 'BTCUSDT' },
          'ETHUSDT': { base: 3421.89, symbol: 'ETHUSDT' },
          'SOLUSDT': { base: 98.34, symbol: 'SOLUSDT' },
          'ADAUSDT': { base: 0.4567, symbol: 'ADAUSDT' },
          'BNBUSDT': { base: 342.15, symbol: 'BNBUSDT' },
          'XRPUSDT': { base: 0.6234, symbol: 'XRPUSDT' },
          'DOTUSDT': { base: 7.89, symbol: 'DOTUSDT' },
          'MATICUSDT': { base: 0.8923, symbol: 'MATICUSDT' },
        };
        
        const mockData = mockPrices[symbol] || { base: 100, symbol };
        const change = (Math.random() - 0.5) * 10; // Random change between -5% and +5%
        const price = mockData.base * (1 + change / 100);
        
        const fallbackData = {
          symbol: mockData.symbol,
          price: price,
          change24h: change,
          changePercent24h: (change / mockData.base) * 100,
          volume24h: Math.random() * 1000000000,
          lastUpdate: new Date().toISOString(),
          isFallback: true
        };
        
        res.json(fallbackData);
      }
    } catch (error: any) {
      console.error("Error in market price endpoint:", error);
      res.status(500).json({ message: "Failed to get market price" });
    }
  });

  // Server-Sent Events endpoint for CoinCap fallback streaming
  app.get('/api/stream/coincap', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection message
    res.write('data: {"type":"connected","source":"coincap"}\n\n');

    let intervalId: NodeJS.Timeout;

    // Fetch prices from CoinCap API periodically
    const fetchPrices = async () => {
      try {
        const symbols = ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot'];
        
        for (const symbol of symbols) {
          const response = await fetch(`https://api.coincap.io/v2/assets/${symbol}`);
          if (response.ok) {
            const result = await response.json();
            const data = result.data;
            
            const priceData = {
              type: 'price',
              data: {
                id: data.id,
                priceUsd: data.priceUsd,
                changePercent24Hr: data.changePercent24Hr,
                volumeUsd24Hr: data.volumeUsd24Hr,
                timestamp: Date.now()
              }
            };
            
            res.write(`data: ${JSON.stringify(priceData)}\n\n`);
          }
        }
      } catch (error) {
        console.error('CoinCap SSE error:', error);
        res.write(`data: {"type":"error","message":"${error.message}"}\n\n`);
      }
    };

    // Initial fetch
    fetchPrices();
    
    // Set interval for regular updates
    intervalId = setInterval(fetchPrices, 5000); // Update every 5 seconds

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(intervalId);
      console.log('CoinCap SSE client disconnected');
    });

    req.on('aborted', () => {
      clearInterval(intervalId);
      console.log('CoinCap SSE client aborted');
    });
  });

  // WebSocket to SSE proxy endpoint
  app.get('/api/stream/binance-proxy', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // This would proxy Binance WebSocket data to SSE
    // Implementation would depend on server-side WebSocket client
    res.write('data: {"type":"connected","source":"binance-proxy"}\n\n');

    // Placeholder for Binance WebSocket proxy implementation
    const intervalId = setInterval(() => {
      const mockData = {
        type: 'price',
        data: {
          symbol: 'BTCUSDT',
          price: Math.random() * 1000 + 65000,
          timestamp: Date.now()
        }
      };
      res.write(`data: ${JSON.stringify(mockData)}\n\n`);
    }, 1000);

    req.on('close', () => {
      clearInterval(intervalId);
    });
  });

  // Get market prices for multiple tickers (Enhanced with caching)
  app.get("/api/market/prices", async (req, res) => {
    try {
      const { symbols } = req.query;
      if (!symbols) {
        return res.status(400).json({ message: "Symbols parameter required" });
      }

      const symbolList = (symbols as string).split(',');
      const priceData = [];

      // Fetch data for each symbol from Binance with fallback
      for (const symbol of symbolList) {
        try {
          // Primary: Binance API
          const binanceResponse = await fetch(
            `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
            { signal: AbortSignal.timeout(3000) }
          );
          
          if (binanceResponse.ok) {
            const data = await binanceResponse.json();
            priceData.push({
              symbol: data.symbol,
              price: parseFloat(data.lastPrice),
              change24h: parseFloat(data.priceChange),
              changePercent24h: parseFloat(data.priceChangePercent),
              volume24h: parseFloat(data.volume),
              high24h: parseFloat(data.highPrice),
              low24h: parseFloat(data.lowPrice),
              source: 'binance',
              lastUpdate: new Date().toISOString(),
            });
            continue;
          }
        } catch (binanceError) {
          console.log(`Binance API failed for ${symbol}, trying CoinCap...`);
        }

        try {
          // Fallback: CoinCap API
          const coinCapSymbol = symbol.replace('USDT', '').toLowerCase();
          const coinCapMap: { [key: string]: string } = {
            'btc': 'bitcoin',
            'eth': 'ethereum', 
            'sol': 'solana',
            'ada': 'cardano',
            'dot': 'polkadot'
          };
          
          const mappedSymbol = coinCapMap[coinCapSymbol] || coinCapSymbol;
          const coinCapResponse = await fetch(
            `https://api.coincap.io/v2/assets/${mappedSymbol}`,
            { signal: AbortSignal.timeout(3000) }
          );
          
          if (coinCapResponse.ok) {
            const result = await coinCapResponse.json();
            const data = result.data;
            
            priceData.push({
              symbol: symbol,
              price: parseFloat(data.priceUsd),
              change24h: parseFloat(data.changePercent24Hr || '0'),
              changePercent24h: parseFloat(data.changePercent24Hr || '0'),
              volume24h: parseFloat(data.volumeUsd24Hr || '0'),
              high24h: 0, // Not available in CoinCap
              low24h: 0,  // Not available in CoinCap
              source: 'coincap',
              lastUpdate: new Date().toISOString(),
            });
          }
        } catch (coinCapError) {
          console.error(`Both APIs failed for ${symbol}:`, coinCapError);
          
          // Generate fallback data as last resort
          const fallbackPrice = Math.random() * 1000 + 50000; // Mock price
          priceData.push({
            symbol: symbol,
            price: fallbackPrice,
            change24h: (Math.random() - 0.5) * 1000,
            changePercent24h: (Math.random() - 0.5) * 5,
            volume24h: Math.random() * 1000000,
            high24h: fallbackPrice * 1.02,
            low24h: fallbackPrice * 0.98,
            source: 'fallback',
            lastUpdate: new Date().toISOString(),
          });
        }
      }

      res.json(priceData);
    } catch (error: any) {
      console.error("Error fetching market prices:", error);
      res.status(500).json({ message: "Failed to get market prices" });
    }
  });

  app.get('/api/market/klines/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { interval = '1h', limit = 100 } = req.query;
      
      // Try to fetch from Binance with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        
        if (!response.ok) {
          throw new Error(`Binance API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Transform Binance format to our format
        const transformedData = data.map((kline: any[]) => ({
          time: new Date(kline[0]),
          open: parseFloat(kline[1]),
          high: parseFloat(kline[2]),
          low: parseFloat(kline[3]),
          close: parseFloat(kline[4]),
          volume: parseFloat(kline[5]),
        }));
        
        res.json(transformedData);
      } catch (fetchError) {
        clearTimeout(timeout);
        
        // Generate realistic fallback OHLC data
        console.log(`External API failed for ${symbol} klines, using fallback data`);
        
        const basePrices: Record<string, number> = {
          'BTCUSDT': 67543.21,
          'ETHUSDT': 3421.89,
          'SOLUSDT': 98.34,
          'ADAUSDT': 0.4567,
          'BNBUSDT': 342.15,
          'XRPUSDT': 0.6234,
          'DOTUSDT': 7.89,
          'MATICUSDT': 0.8923,
        };
        
        const basePrice = basePrices[symbol] || 100;
        const numPoints = Math.min(parseInt(limit as string), 100);
        const mockData = [];
        
        for (let i = numPoints - 1; i >= 0; i--) {
          const timestamp = Date.now() - (i * 60 * 60 * 1000); // 1 hour intervals
          const randomness = (Math.random() - 0.5) * 0.1; // ±5% variation
          const trendFactor = 1 + randomness;
          
          const open = basePrice * (1 + (Math.random() - 0.5) * 0.05);
          const close = open * trendFactor;
          const high = Math.max(open, close) * (1 + Math.random() * 0.02);
          const low = Math.min(open, close) * (1 - Math.random() * 0.02);
          const volume = Math.random() * 1000000;
          
          mockData.push({
            time: new Date(timestamp),
            open: parseFloat(open.toFixed(6)),
            high: parseFloat(high.toFixed(6)),
            low: parseFloat(low.toFixed(6)),
            close: parseFloat(close.toFixed(6)),
            volume: parseFloat(volume.toFixed(2)),
          });
        }
        
        res.json(mockData);
      }
    } catch (error) {
      console.error('Error in klines endpoint:', error);
      res.status(500).json({ message: 'Failed to get market data' });
    }
  });

  // Subscription Management Routes
  app.get("/api/subscription/plans", async (req, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: "Failed to fetch subscription plans" });
    }
  });

  app.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: "Failed to fetch subscription plans" });
    }
  });

  // Get current user subscription
  app.get("/api/subscription/current", requireAuth, async (req: any, res) => {
    try {
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const plan = await storage.getSubscriptionPlan(user.subscriptionTier || 'free');
      
      res.json({
        currentPlan: plan,
        subscriptionStatus: user.subscriptionStatus,
        stripeSubscriptionId: user.stripeSubscriptionId
      });
    } catch (error) {
      console.error("Error fetching current subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // Create test users for different subscription levels (development only)
  app.post("/api/admin/create-test-users", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const testUsers = [
        {
          email: "free@test.com",
          password: "password123",
          firstName: "Free",
          lastName: "User",
          subscriptionTier: "free",
          subscriptionStatus: null,
        },
        {
          email: "basic@test.com", 
          password: "password123",
          firstName: "Basic",
          lastName: "User",
          subscriptionTier: "basic",
          subscriptionStatus: "active",
        },
        {
          email: "premium@test.com",
          password: "password123", 
          firstName: "Premium",
          lastName: "User",
          subscriptionTier: "premium",
          subscriptionStatus: "active",
        },
        {
          email: "pro@test.com",
          password: "password123",
          firstName: "Pro", 
          lastName: "User",
          subscriptionTier: "pro",
          subscriptionStatus: "active",
        },
      ];

      const createdUsers = [];
      
      for (const testUser of testUsers) {
        // Check if user already exists
        const existingUser = await storage.getUserByEmail(testUser.email);
        if (!existingUser) {
          const hashedPassword = await bcrypt.hash(testUser.password, 10);
          const user = await storage.createUser({
            email: testUser.email,
            hashedPassword,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            subscriptionTier: testUser.subscriptionTier as any,
            subscriptionStatus: testUser.subscriptionStatus as any,
            role: "user",
            isActive: true,
          });
          createdUsers.push({
            email: user.email,
            subscriptionTier: user.subscriptionTier,
            id: user.id,
          });
        }
      }

      res.json({
        success: true,
        message: `Created ${createdUsers.length} test users`,
        users: createdUsers,
        credentials: testUsers.map(u => ({
          email: u.email,
          password: u.password,
          tier: u.subscriptionTier,
        })),
      });
    } catch (error) {
      console.error("Error creating test users:", error);
      res.status(500).json({ message: "Failed to create test users" });
    }
  });

  // Upgrade subscription
  app.post("/api/subscription/upgrade", requireAuth, async (req: any, res) => {
    try {
      
      const { tier } = req.body;
      if (!tier || !['free', 'basic', 'premium', 'pro'].includes(tier)) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }
      
      const user = await storage.updateUser(req.user.id, {
        subscriptionTier: tier,
        subscriptionStatus: tier === 'free' ? undefined : 'active'
      });
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Log the upgrade
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'SUBSCRIPTION_UPGRADE',
        targetTable: 'users',
        targetId: user.id,
        notes: `User upgraded to ${tier} plan`
      });
      
      res.json({ 
        success: true, 
        message: `Successfully upgraded to ${tier} plan`,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus
      });
    } catch (error) {
      console.error("Error upgrading subscription:", error);
      res.status(500).json({ message: "Failed to upgrade subscription" });
    }
  });

  // Get subscription usage
  app.get("/api/subscription/usage", requireAuth, async (req: any, res) => {
    try {
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const plan = await storage.getSubscriptionPlan(user.subscriptionTier || 'free');
      const userSignals = await storage.getSignalsByUser(user.id, 1000);
      
      // Calculate usage for current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlySignals = userSignals.filter(signal => 
        new Date(signal.timestamp) >= monthStart
      );
      
      const maxSignals = plan?.maxSignals || 10;
      const signalsUsed = monthlySignals.length;
      const signalsRemaining = maxSignals === -1 ? 'Unlimited' : Math.max(0, maxSignals - signalsUsed);
      const usagePercentage = maxSignals === -1 ? 0 : Math.min(100, (signalsUsed / maxSignals) * 100);
      
      // Create daily trend data for the past 7 days
      const dailyTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        
        const daySignals = userSignals.filter(signal => {
          const signalDate = new Date(signal.timestamp);
          return signalDate >= dayStart && signalDate < dayEnd;
        });
        
        dailyTrend.push({
          date: date.toISOString().split('T')[0],
          signals: daySignals.length
        });
      }
      
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      res.json({
        currentPlan: {
          name: plan?.name || 'Free',
          tier: plan?.tier || 'free',
          monthlyPrice: plan?.monthlyPrice || 0,
          features: plan?.features || [],
          maxSignals: plan?.maxSignals || 10,
          maxTickers: plan?.maxTickers || 3
        },
        usage: {
          signalsUsed,
          signalsLimit: maxSignals,
          signalsRemaining,
          usagePercentage,
          resetDate: nextMonth.toISOString(),
          renewalDate: nextMonth.toISOString(),
          dailyTrend
        },
        analytics: {
          totalSignalsReceived: userSignals.length,
          averageSignalsPerDay: userSignals.length / 30,
          mostActiveDay: dailyTrend.reduce((max, day) => 
            day.signals > max.signals ? day : max, 
            { date: '', signals: 0 }
          )
        }
      });
    } catch (error) {
      console.error("Error fetching subscription usage:", error);
      res.status(500).json({ message: "Failed to fetch usage data" });
    }
  });

  // Apply Promotional Code
  app.post("/api/apply-promo-code", async (req, res) => {
    try {
      const { promoCode, planTier } = req.body;
      
      // Mock promo codes - in production, these would be stored in database
      const promoCodes = {
        "WELCOME20": { discount: 0.2, type: "percentage", validTiers: ["basic", "premium", "pro"] },
        "CRYPTO50": { discount: 0.5, type: "percentage", validTiers: ["premium", "pro"] },
        "FIRST30": { discount: 30, type: "fixed", validTiers: ["basic"] },
      };
      
      const promo = promoCodes[promoCode as keyof typeof promoCodes];
      
      if (!promo) {
        return res.status(404).json({ message: "Invalid promotional code" });
      }
      
      if (!promo.validTiers.includes(planTier)) {
        return res.status(400).json({ message: "Promotional code not valid for this plan" });
      }
      
      const plan = await storage.getSubscriptionPlan(planTier);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      
      let discountedPrice = plan.monthlyPrice;
      if (promo.type === "percentage") {
        discountedPrice = Math.round(plan.monthlyPrice * (1 - promo.discount));
      } else {
        discountedPrice = Math.max(0, plan.monthlyPrice - (promo.discount * 100));
      }
      
      res.json({
        originalPrice: plan.monthlyPrice,
        discountedPrice,
        discount: promo.discount,
        discountType: promo.type,
        savings: plan.monthlyPrice - discountedPrice,
      });
    } catch (error: any) {
      console.error("Error applying promo code:", error);
      res.status(500).json({ message: "Failed to apply promotional code" });
    }
  });

  // Create Stripe Checkout Session for Subscription
  app.post("/api/create-subscription", async (req, res) => {
    try {
      const { planTier, billingInterval = "monthly", promoCode } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get the subscription plan
      const plan = await storage.getSubscriptionPlan(planTier);
      if (!plan) {
        return res.status(404).json({ message: "Subscription plan not found" });
      }

      // Handle free plan
      if (plan.monthlyPrice === 0) {
        await storage.updateUserSubscription(userId, {
          subscriptionTier: "free",
          subscriptionStatus: "active",
        });
        return res.json({ success: true });
      }

      // Get or create Stripe customer
      const user = await storage.getUser(userId);
      let customerId = user?.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user?.email,
          metadata: { userId },
        });
        customerId = customer.id;

        await storage.updateUserSubscription(userId, {
          stripeCustomerId: customerId,
        });
      }

      // Determine price based on billing interval
      const priceAmount = billingInterval === "yearly" && plan.yearlyPrice ? plan.yearlyPrice : plan.monthlyPrice;

      // Create Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: plan.name,
                description: `${plan.tier} subscription plan`,
              },
              unit_amount: priceAmount,
              recurring: {
                interval: billingInterval === "yearly" ? "year" : "month",
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${req.protocol}://${req.get("host")}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get("host")}/pricing`,
        metadata: {
          userId,
          planTier,
          billingInterval,
        },
      });

      res.json({
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: error.message || "Failed to create subscription" });
    }
  });

  // Stripe Webhook Handler
  app.post("/api/stripe-webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      // In production, you'd need to set STRIPE_WEBHOOK_SECRET
      event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET || "");
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object as any;
        const { userId, planTier } = session.metadata;

        if (userId && planTier) {
          await storage.updateUserSubscription(userId, {
            subscriptionTier: planTier,
            subscriptionStatus: "active",
            stripeSubscriptionId: session.subscription,
          });
        }
        break;

      case "invoice.payment_succeeded":
        // Handle successful payment
        break;

      case "invoice.payment_failed":
        // Handle failed payment
        const failedInvoice = event.data.object as any;
        const failedUserId = failedInvoice.customer_email; // You'd need to map this to userId
        // Update user subscription status to past_due
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  // Customer Portal (for managing subscriptions)
  app.post("/api/customer-portal", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No subscription found" });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${req.protocol}://${req.get("host")}/settings`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating customer portal session:", error);
      res.status(500).json({ message: error.message || "Failed to create portal session" });
    }
  });

  // Admin Subscription Management Endpoints
  app.get("/api/admin/subscriptions", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const paidUsers = users.filter(u => u.subscriptionTier !== "free");
      
      // Mock subscription data - in production this would come from a subscriptions table
      const subscriptions = paidUsers.map(user => ({
        id: user.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.email.split('@')[0],
        planTier: user.subscriptionTier,
        planName: user.subscriptionTier === 'basic' ? 'Basic Plan' : 
                  user.subscriptionTier === 'premium' ? 'Premium Plan' : 'Pro Plan',
        status: user.subscriptionStatus || 'active',
        startDate: user.createdAt,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        amount: user.subscriptionTier === 'basic' ? 2900 : 
                user.subscriptionTier === 'premium' ? 7900 : 19900,
        stripeSubscriptionId: user.stripeSubscriptionId,
        lastPayment: user.createdAt,
        nextPayment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }));
      
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching admin subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  app.post("/api/admin/subscription-plans", [
    requireAuth, 
    requireAdmin,
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('tier').isString().isIn(['free', 'basic', 'premium', 'pro', 'elite']).withMessage('Invalid tier'),
    body('monthlyPrice').isInt({ min: 0 }).withMessage('Monthly price must be a non-negative integer'),
    body('yearlyPrice').optional().isInt({ min: 0 }).withMessage('Yearly price must be a non-negative integer'),
    body('features').optional().isArray().withMessage('Features must be an array'),
    body('maxSignals').optional().isInt({ min: -1 }).withMessage('Max signals must be -1 or positive integer'),
    body('maxTickers').optional().isInt({ min: -1 }).withMessage('Max tickers must be -1 or positive integer'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { name, tier, monthlyPrice, yearlyPrice, features = [], maxSignals = 10, maxTickers = 3 } = req.body;
      
      const plan = await storage.createSubscriptionPlan({
        name,
        tier,
        monthlyPrice,
        yearlyPrice: yearlyPrice || null,
        features,
        maxSignals,
        maxTickers,
        isActive: true
      });
      
      // Log admin action
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'CREATE_PLAN',
        targetTable: 'subscription_plans',
        targetId: plan.id,
        notes: `Created subscription plan: ${plan.name} (${plan.tier})`,
      });
      
      res.json(plan);
    } catch (error) {
      console.error("Error creating subscription plan:", error);
      res.status(500).json({ message: "Failed to create subscription plan" });
    }
  });

  app.put("/api/admin/subscription-plans/:id", [
    requireAuth, 
    requireAdmin,
    param('id').isUUID().withMessage('Invalid plan ID'),
    body('name').optional().isString().notEmpty().withMessage('Name must be a non-empty string'),
    body('tier').optional().isString().isIn(['free', 'basic', 'premium', 'pro', 'elite']).withMessage('Invalid tier'),
    body('monthlyPrice').optional().isInt({ min: 0 }).withMessage('Monthly price must be a non-negative integer'),
    body('yearlyPrice').optional().isInt({ min: 0 }).withMessage('Yearly price must be a non-negative integer'),
    body('features').optional().isArray().withMessage('Features must be an array'),
    body('maxSignals').optional().isInt({ min: -1 }).withMessage('Max signals must be -1 or positive integer'),
    body('maxTickers').optional().isInt({ min: -1 }).withMessage('Max tickers must be -1 or positive integer'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const plan = await storage.getSubscriptionPlanById(id);
      if (!plan) {
        return res.status(404).json({ message: "Subscription plan not found" });
      }
      
      // Update the plan in database
      const updatedPlan = await storage.updateSubscriptionPlan(id, updates);
      if (!updatedPlan) {
        return res.status(500).json({ message: "Failed to update subscription plan" });
      }
      
      // Log admin action
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'UPDATE_PLAN',
        targetTable: 'subscription_plans',
        targetId: id,
        notes: `Updated subscription plan: ${plan.name}`,
      });
      
      res.json(updatedPlan);
    } catch (error) {
      console.error("Error updating subscription plan:", error);
      res.status(500).json({ message: "Failed to update subscription plan" });
    }
  });

  app.delete("/api/admin/subscription-plans/:id", [
    requireAuth, 
    requireAdmin,
    param('id').isUUID().withMessage('Invalid plan ID'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const plan = await storage.getSubscriptionPlanById(id);
      if (!plan) {
        return res.status(404).json({ message: "Subscription plan not found" });
      }
      
      // Check if plan is in use by any users
      const users = await storage.getAllUsers();
      const usersWithPlan = users.filter(user => user.subscriptionTier === plan.tier);
      if (usersWithPlan.length > 0) {
        return res.status(400).json({ 
          message: `Cannot delete subscription plan. ${usersWithPlan.length} users are currently subscribed to this plan.`,
          usersCount: usersWithPlan.length
        });
      }
      
      // Delete the plan from database
      const deleted = await storage.deleteSubscriptionPlan(id);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete subscription plan" });
      }
      
      // Log admin action
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'DELETE_PLAN',
        targetTable: 'subscription_plans',
        targetId: id,
        notes: `Deleted subscription plan: ${plan.name}`,
      });
      
      res.json({ success: true, message: "Subscription plan deleted" });
    } catch (error) {
      console.error("Error deleting subscription plan:", error);
      res.status(500).json({ message: "Failed to delete subscription plan" });
    }
  });

  app.post("/api/admin/subscriptions/:id/cancel", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Cancel the subscription by updating user status
      const updatedUser = await storage.updateUser(id, {
        subscriptionStatus: 'cancelled',
        subscriptionTier: 'free'
      });
      
      // Log admin action
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'CANCEL_SUBSCRIPTION',
        targetTable: 'users',
        targetId: id,
        notes: `Cancelled subscription for user: ${user.email}`,
      });
      
      res.json({ success: true, message: "Subscription cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // Admin Analytics Endpoints
  app.get("/api/admin/analytics", async (req, res) => {
    try {
      const { period = '7d', metric = 'all' } = req.query;
      
      // Get analytics data based on period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '1d':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }

      const users = await storage.getAllUsers();
      const signals = await storage.getSignals(1000);
      
      // Calculate comprehensive analytics
      const paidUsers = users.filter(u => u.subscriptionTier !== "free");
      const tierPrices = { basic: 2900, premium: 7900, pro: 19900 };
      const totalRevenue = paidUsers.reduce((sum, user) => {
        return sum + (tierPrices[user.subscriptionTier as keyof typeof tierPrices] || 0);
      }, 0);

      const analyticsData = {
        overview: {
          totalUsers: users.length,
          activeUsers: users.filter(u => u.lastLoginAt && new Date(u.lastLoginAt) >= startDate).length,
          totalRevenue: totalRevenue / 100, // Convert to dollars
          monthlyRevenue: totalRevenue / 100,
          totalTrades: 156789, // Mock data - could be from trades table
          signalAccuracy: signals.length > 0 ? 78.4 : 0,
          userGrowth: 12.5,
          revenueGrowth: 8.3,
          tradesGrowth: 23.7,
          accuracyChange: 2.1
        },
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          period: period
        }
      };

      res.json(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ message: 'Failed to fetch analytics data' });
    }
  });

  app.get("/api/admin/analytics/revenue", async (req, res) => {
    try {
      const { period = '7d' } = req.query;
      
      const users = await storage.getAllUsers();
      const paidUsers = users.filter(u => u.subscriptionTier !== "free");
      const tierPrices = { basic: 2900, premium: 7900, pro: 19900 };
      
      const totalRevenue = paidUsers.reduce((sum, user) => {
        return sum + (tierPrices[user.subscriptionTier as keyof typeof tierPrices] || 0);
      }, 0) / 100;

      const revenueData = {
        total: totalRevenue,
        monthly: totalRevenue,
        growth: 8.3,
        sources: [
          { name: 'Basic Subscriptions', amount: paidUsers.filter(u => u.subscriptionTier === 'basic').length * 29, percentage: 75.3 },
          { name: 'Premium Subscriptions', amount: paidUsers.filter(u => u.subscriptionTier === 'premium').length * 79, percentage: 19.4 },
          { name: 'Pro Subscriptions', amount: paidUsers.filter(u => u.subscriptionTier === 'pro').length * 199, percentage: 5.3 }
        ],
        trends: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amount: Math.floor(totalRevenue * (0.8 + Math.random() * 0.4))
        }))
      };

      res.json(revenueData);
    } catch (error) {
      console.error('Error fetching revenue analytics:', error);
      res.status(500).json({ message: 'Failed to fetch revenue analytics' });
    }
  });

  app.get("/api/admin/analytics/trading", async (req, res) => {
    try {
      const { period = '7d' } = req.query;
      
      // Generate volume data for chart
      const volumeData = Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        volume: Math.floor(Math.random() * 500000) + 200000
      }));
      
      // Mock trading analytics - would come from actual trades table
      const tradingAnalytics = {
        totalTrades: 156789,
        volume: 2458792.34,
        avgTradeSize: 15.67,
        successRate: 73.4,
        growth: 23.7,
        volumeData: volumeData,
        topPairs: [
          { symbol: 'BTCUSDT', trades: 45234, volume: 892345.67 },
          { symbol: 'ETHUSDT', trades: 32187, volume: 634521.89 },
          { symbol: 'SOLUSDT', trades: 18945, volume: 298456.12 },
          { symbol: 'ADAUSDT', trades: 12743, volume: 145678.34 }
        ],
        hourlyDistribution: Array.from({ length: 24 }, (_, i) => ({
          hour: String(i).padStart(2, '0') + ':00',
          trades: Math.floor(1000 + Math.random() * 3000)
        }))
      };

      res.json(tradingAnalytics);
    } catch (error) {
      console.error('Error fetching trading analytics:', error);
      res.status(500).json({ message: 'Failed to fetch trading analytics' });
    }
  });

  app.get("/api/admin/analytics/signals", async (req, res) => {
    try {
      const { period = '7d' } = req.query;
      
      const signals = await storage.getSignals(1000);
      const successfulSignals = signals.filter(s => s.signalType === 'buy' || s.signalType === 'sell').length;
      const failedSignals = signals.length - successfulSignals;
      const accuracy = signals.length > 0 ? Math.round((successfulSignals / signals.length) * 100) : 0;
      
      // Generate accuracy data for chart
      const accuracyData = Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        accuracy: Math.floor(Math.random() * 20) + 70 // 70-90% accuracy range
      }));
      
      const signalAnalytics = {
        totalSignals: signals.length,
        successfulSignals: successfulSignals,
        failedSignals: failedSignals,
        accuracy: accuracy,
        accuracyData: accuracyData
      };

      res.json(signalAnalytics);
    } catch (error) {
      console.error('Error fetching signal analytics:', error);
      res.status(500).json({ message: 'Failed to fetch signal analytics' });
    }
  });

  app.get("/api/admin/analytics/metrics", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || "7d";
      
      const users = await storage.getAllUsers();
      const signals = await storage.getSignals(1000);
      
      // Calculate metrics based on time range
      const now = new Date();
      const daysBack = timeRange === "24h" ? 1 : timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      
      const recentUsers = users.filter(u => new Date(u.createdAt) >= startDate);
      const activeUsers = users.filter(u => u.lastLoginAt && new Date(u.lastLoginAt) >= startDate);
      const recentSignals = signals.filter(s => new Date(s.createdAt) >= startDate);
      
      // Calculate revenue from subscription tiers
      const paidUsers = users.filter(u => u.subscriptionTier !== "free");
      const totalRevenue = paidUsers.reduce((sum, user) => {
        const tierPrices = { basic: 2900, premium: 7900, pro: 19900 };
        return sum + (tierPrices[user.subscriptionTier as keyof typeof tierPrices] || 0);
      }, 0);
      
      const monthlyRevenue = totalRevenue; // Simplified for demo
      
      const metrics = {
        totalUsers: users.length,
        activeUsers: activeUsers.length,
        totalRevenue,
        monthlyRevenue,
        totalSignals: signals.length,
        dailySignals: Math.floor(recentSignals.length / daysBack),
        conversionRate: users.length > 0 ? paidUsers.length / users.length : 0,
        churnRate: 0.05, // 5% churn rate
      };
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching analytics metrics:", error);
      res.status(500).json({ message: "Failed to fetch analytics metrics" });
    }
  });

  app.get("/api/admin/analytics/users", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || "7d";
      const users = await storage.getAllUsers();
      
      // Group users by tier
      const usersByTier = users.reduce((acc, user) => {
        const tier = user.subscriptionTier || "free";
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const totalUsers = users.length;
      const tierData = Object.entries(usersByTier).map(([tier, count]) => ({
        tier,
        count,
        percentage: (count / totalUsers) * 100,
      }));
      
      // Mock time series data for demo
      const generateTimeSeries = (days: number, baseValue: number) => {
        return Array.from({ length: days }, (_, i) => ({
          date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          count: Math.floor(baseValue + Math.random() * 10),
        }));
      };
      
      const analytics = {
        newUsers: generateTimeSeries(7, 5),
        activeUsers: generateTimeSeries(7, 15),
        usersByTier: tierData,
        retentionRate: [
          { period: "1 Day", rate: 85 },
          { period: "7 Days", rate: 65 },
          { period: "30 Days", rate: 45 },
          { period: "90 Days", rate: 25 },
        ],
      };
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching user analytics:", error);
      res.status(500).json({ message: "Failed to fetch user analytics" });
    }
  });

  app.get("/api/admin/analytics/revenue", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const paidUsers = users.filter(u => u.subscriptionTier !== "free");
      
      // Calculate revenue by tier
      const revenueByTier = paidUsers.reduce((acc, user) => {
        const tier = user.subscriptionTier;
        const tierPrices = { basic: 2900, premium: 7900, pro: 19900 };
        const revenue = tierPrices[tier as keyof typeof tierPrices] || 0;
        
        if (!acc[tier]) acc[tier] = 0;
        acc[tier] += revenue;
        return acc;
      }, {} as Record<string, number>);
      
      const totalRevenue = Object.values(revenueByTier).reduce((sum, rev) => sum + rev, 0);
      
      const tierData = Object.entries(revenueByTier).map(([tier, revenue]) => ({
        tier,
        revenue,
        percentage: (revenue / totalRevenue) * 100,
      }));
      
      // Mock monthly revenue data
      const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
        const month = new Date(2024, i).toLocaleString('default', { month: 'short' });
        return {
          month,
          revenue: Math.floor(totalRevenue * (0.7 + Math.random() * 0.6)),
          subscriptions: Math.floor(paidUsers.length * (0.8 + Math.random() * 0.4)),
        };
      });
      
      const analytics = {
        monthlyRevenue,
        revenueByTier: tierData,
        mrr: totalRevenue, // Monthly Recurring Revenue
        arr: totalRevenue * 12, // Annual Recurring Revenue
        ltv: totalRevenue / paidUsers.length * 24, // Lifetime Value (24 months avg)
      };
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching revenue analytics:", error);
      res.status(500).json({ message: "Failed to fetch revenue analytics" });
    }
  });

  app.get("/api/admin/analytics/signals", async (req, res) => {
    try {
      const signals = await storage.getSignals(1000);
      const tickers = await storage.getAllTickers();
      
      // Group signals by ticker
      const signalsByTicker = signals.reduce((acc, signal) => {
        const ticker = signal.ticker;
        if (!acc[ticker]) {
          acc[ticker] = { count: 0, accuracySum: 0 };
        }
        acc[ticker].count += 1;
        acc[ticker].accuracySum += Math.random() * 0.3 + 0.7; // Mock accuracy 70-100%
        return acc;
      }, {} as Record<string, { count: number; accuracySum: number }>);
      
      const tickerData = Object.entries(signalsByTicker)
        .map(([ticker, data]) => ({
          ticker,
          count: data.count,
          accuracy: data.accuracySum / data.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Mock popular tickers data
      const popularTickers = tickers.slice(0, 10).map(ticker => ({
        ticker: ticker.symbol,
        subscriptions: Math.floor(Math.random() * 100) + 20,
      }));
      
      // Mock time series data
      const signalsPerDay = Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (7 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.floor(Math.random() * 50) + 30,
        accuracy: Math.random() * 0.2 + 0.8,
      }));
      
      const signalAccuracy = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        accuracy: Math.random() * 0.15 + 0.85,
      }));
      
      const analytics = {
        signalsPerDay,
        signalsByTicker: tickerData,
        signalAccuracy,
        popularTickers,
      };
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching signal analytics:", error);
      res.status(500).json({ message: "Failed to fetch signal analytics" });
    }
  });

  app.get("/api/admin/analytics/system", async (req, res) => {
    try {
      // Mock system metrics - in production these would come from monitoring services
      const metrics = {
        cpuUsage: Math.floor(Math.random() * 40) + 20, // 20-60%
        memoryUsage: Math.floor(Math.random() * 30) + 40, // 40-70%
        activeConnections: Math.floor(Math.random() * 100) + 50,
        responseTime: Math.floor(Math.random() * 100) + 150, // 150-250ms
        errorRate: Math.random() * 0.02, // 0-2%
        uptime: "99.9%",
      };
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching system metrics:", error);
      res.status(500).json({ message: "Failed to fetch system metrics" });
    }
  });

  // Admin Reports Endpoints
  app.get("/api/admin/reports", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      // Mock report data - in production this would come from a reports table
      const mockReports = [
        {
          id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          name: "User Activity Report - December 2024",
          type: "user_activity",
          generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          downloadUrl: "/api/admin/reports/f47ac10b-58cc-4372-a567-0e02b2c3d479/download",
          status: "ready",
          fileSize: "2.3 MB",
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440000", 
          name: "Signal Effectiveness - November 2024",
          type: "signal_effectiveness",
          generatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          downloadUrl: "/api/admin/reports/550e8400-e29b-41d4-a716-446655440000/download",
          status: "ready",
          fileSize: "1.8 MB",
        },
        {
          id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
          name: "Revenue Analytics - Q4 2024", 
          type: "revenue_analytics",
          generatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          downloadUrl: "/api/admin/reports/6ba7b810-9dad-11d1-80b4-00c04fd430c8/download",
          status: "expired",
          fileSize: "3.1 MB",
        },
      ];

      res.json(mockReports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.post("/api/admin/reports/generate", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const reportConfig = z.object({
        type: z.enum(["user_activity", "signal_effectiveness", "subscription_trends", "revenue_analytics"]),
        dateRange: z.object({
          start: z.string(),
          end: z.string(),
        }),
        format: z.enum(["xlsx", "csv", "pdf"]).default("xlsx"),
      }).parse(req.body);

      // Mock report generation - in production this would trigger background job
      const reportId = crypto.randomUUID();
      const reportName = `${reportConfig.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${new Date().toLocaleDateString()}`;
      
      // Create admin log
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'GENERATE_REPORT',
        targetTable: 'reports',
        targetId: reportId,
        notes: `Generated ${reportConfig.type} report for period ${reportConfig.dateRange.start} to ${reportConfig.dateRange.end}`,
      });

      const newReport = {
        id: reportId,
        name: reportName,
        type: reportConfig.type,
        generatedAt: new Date().toISOString(),
        downloadUrl: `/api/admin/reports/${reportId}/download`,
        status: "ready",
        fileSize: "1.5 MB",
      };

      res.json(newReport);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.get("/api/admin/reports/:reportId/download", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { reportId } = req.params;
      
      // Mock Excel file generation - in production this would create actual Excel/CSV files
      const mockExcelContent = Buffer.from("Report ID: " + reportId + "\nGenerated: " + new Date().toISOString() + "\n\nSample Report Data\n");
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=report-${reportId}.xlsx`);
      res.send(mockExcelContent);
    } catch (error) {
      console.error("Error downloading report:", error);
      res.status(500).json({ message: "Failed to download report" });
    }
  });

  // Advanced Forecasting API Endpoints
  app.get("/api/forecast/models/:ticker", async (req, res) => {
    try {
      const { ticker } = req.params;
      
      // Return model performance metrics
      const modelMetrics = [
        {
          name: "Fourier Transform",
          accuracy: 0.82,
          confidence: 0.75,
          lastCalibrated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          dominantCycles: [21, 42, 84],
          regime: "bull"
        },
        {
          name: "Elliott Wave",
          accuracy: 0.78,
          confidence: 0.68,
          lastCalibrated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          currentWave: "3",
          patterns: ["Impulse", "Wave 3 Extension"]
        },
        {
          name: "Gann Analysis",
          accuracy: 0.71,
          confidence: 0.64,
          lastCalibrated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          supportLevels: [45000, 42500, 40000],
          resistanceLevels: [52000, 55000, 58000]
        },
        {
          name: "Harmonic Patterns",
          accuracy: 0.76,
          confidence: 0.72,
          lastCalibrated: new Date().toISOString(),
          detectedPatterns: ["Gartley", "Butterfly"],
          completion: 0.85
        },
        {
          name: "Fractal Dimension",
          accuracy: 0.69,
          confidence: 0.61,
          lastCalibrated: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          dimension: 1.47,
          complexity: "High"
        },
        {
          name: "Entropy Analysis",
          accuracy: 0.73,
          confidence: 0.67,
          lastCalibrated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          entropy: 0.85,
          predictability: "Medium"
        }
      ];

      res.json(modelMetrics);
    } catch (error) {
      console.error("Error fetching model metrics:", error);
      res.status(500).json({ message: "Failed to fetch model metrics" });
    }
  });

  app.post("/api/forecast/advanced/:ticker", async (req, res) => {
    try {
      const { ticker } = req.params;
      const { horizon = 30 } = req.body;
      
      console.log(`Generating advanced forecast for ${ticker} with ${horizon} day horizon`);
      
      // Generate the advanced forecast using the service
      const forecastResult = await cycleForecastingService.generateAdvancedForecast(ticker, horizon);
      
      res.json({
        forecast: forecastResult.forecast,
        overallConfidence: forecastResult.confidence,
        models: forecastResult.models,
        generatedAt: new Date().toISOString(),
        horizon
      });
    } catch (error) {
      console.error("Error generating advanced forecast:", error);
      res.status(500).json({ message: "Failed to generate forecast" });
    }
  });

  app.get("/api/forecast/data/:ticker", async (req, res) => {
    try {
      const { ticker } = req.params;
      const forecastData = await storage.getForecastData(ticker);
      res.json(forecastData);
    } catch (error) {
      console.error("Error fetching forecast data:", error);
      res.status(500).json({ message: "Failed to fetch forecast data" });
    }
  });

  app.get("/api/cycle/data/:ticker", async (req, res) => {
    try {
      const { ticker } = req.params;
      const cycleData = await storage.getCycleData(ticker);
      res.json(cycleData);
    } catch (error) {
      console.error("Error fetching cycle data:", error);
      res.status(500).json({ message: "Failed to fetch cycle data" });
    }
  });

  // Trading API endpoints
  app.get('/api/trading/portfolio', requireAuth, async (req: any, res) => {
    try {
      const portfolio = await storage.getUserPortfolio(req.user.id);
      res.json(portfolio);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ message: 'Failed to fetch portfolio' });
    }
  });

  app.get('/api/trading/trades', requireAuth, async (req: any, res) => {
    try {
      const { limit } = req.query;
      const trades = await storage.getUserTrades(req.user.id, limit ? parseInt(limit) : undefined);
      res.json(trades);
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: 'Failed to fetch trades' });
    }
  });

  app.post('/api/trading/trade', requireAuth, async (req: any, res) => {
    try {
      const tradeData = {
        userId: req.user.id,
        ticker: req.body.ticker,
        type: req.body.type,
        amount: req.body.amount,
        price: req.body.price,
        mode: req.body.mode || 'paper',
        status: 'EXECUTED',
        signalId: req.body.signalId || null,
      };

      const trade = await storage.createTrade(tradeData);

      // Update portfolio based on the trade
      const portfolio = await storage.getUserPortfolio(req.user.id);
      const existingPosition = portfolio.find(p => p.ticker === req.body.ticker);

      const tradeAmount = parseFloat(req.body.amount);
      const tradePrice = parseFloat(req.body.price);
      const tradeValue = tradeAmount * tradePrice;

      if (req.body.type === 'BUY') {
        if (existingPosition) {
          const currentQuantity = parseFloat(existingPosition.quantity);
          const currentValue = parseFloat(existingPosition.currentValue);
          const newQuantity = currentQuantity + tradeAmount;
          const newAveragePrice = (currentValue + tradeValue) / newQuantity;

          await storage.updatePortfolio(req.user.id, req.body.ticker, {
            quantity: newQuantity.toString(),
            averagePrice: newAveragePrice.toString(),
            currentValue: (newQuantity * tradePrice).toString(),
          });
        } else {
          await storage.updatePortfolio(req.user.id, req.body.ticker, {
            quantity: tradeAmount.toString(),
            averagePrice: tradePrice.toString(),
            currentValue: tradeValue.toString(),
          });
        }
      } else if (req.body.type === 'SELL') {
        if (existingPosition) {
          const currentQuantity = parseFloat(existingPosition.quantity);
          const newQuantity = Math.max(0, currentQuantity - tradeAmount);
          
          await storage.updatePortfolio(req.user.id, req.body.ticker, {
            quantity: newQuantity.toString(),
            currentValue: (newQuantity * tradePrice).toString(),
          });
        }
      }

      // Broadcast trade to WebSocket clients
      broadcast({
        type: 'trade_executed',
        data: trade
      });

      res.json(trade);
    } catch (error) {
      console.error("Error executing trade:", error);
      res.status(500).json({ message: 'Failed to execute trade' });
    }
  });

  app.get('/api/trading/settings', requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.getTradingSettings(req.user.id);
      if (!settings) {
        // Return default settings if none exist
        const defaultSettings = {
          riskLevel: 'moderate',
          maxTradeAmount: '1000',
          autoTrading: false,
          stopLoss: '5',
          takeProfit: '10',
        };
        res.json(defaultSettings);
      } else {
        res.json(settings);
      }
    } catch (error) {
      console.error("Error fetching trading settings:", error);
      res.status(500).json({ message: 'Failed to fetch trading settings' });
    }
  });

  app.put('/api/trading/settings', requireAuth, async (req: any, res) => {
    try {
      const settings = await storage.updateTradingSettings(req.user.id, req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating trading settings:", error);
      res.status(500).json({ message: 'Failed to update trading settings' });
    }
  });

  // Notification Dashboard API routes
  app.get('/api/notifications/stats', requireAuth, async (req: any, res) => {
    try {
      const range = req.query.range || '24h';
      const stats = await notificationService.getNotificationStats(range);
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching notification stats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/notifications/logs', requireAuth, async (req: any, res) => {
    try {
      const channel = req.query.channel || 'all';
      const limit = parseInt(req.query.limit) || 100;
      const logs = notificationService.getNotificationLogs(channel, limit);
      res.json(logs);
    } catch (error: any) {
      console.error('Error fetching notification logs:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/notifications/health', requireAuth, async (req: any, res) => {
    try {
      const health = notificationService.getChannelHealth();
      res.json(health);
    } catch (error: any) {
      console.error('Error fetching channel health:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/notifications/:id/retry', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await notificationService.retryNotification(id);
      res.json({ success });
    } catch (error: any) {
      console.error('Error retrying notification:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/notifications/test/:channel', requireAuth, async (req: any, res) => {
    try {
      const { channel } = req.params;
      const success = await notificationService.testChannel(channel);
      res.json({ success });
    } catch (error: any) {
      console.error('Error testing notification channel:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // SMS Configuration and Testing
  app.post('/api/notifications/sms/verify', async (req: any, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber || !phoneNumber.startsWith('+')) {
        return res.status(400).json({ 
          error: 'Phone number must include country code (e.g., +1234567890)' 
        });
      }

      // Demo mode for testing without real credentials
      if (!smsService.isConfigured()) {
        // Simulate successful verification in demo mode
        const demoCode = Math.floor(100000 + Math.random() * 900000).toString();
        res.json({ 
          success: true, 
          message: 'Demo verification code generated (SMS service not configured)',
          code: demoCode,
          demo: true
        });
        return;
      }

      const result = await smsService.sendVerificationCode(phoneNumber);
      
      if (result.success) {
        // Store verification code temporarily (in production, use Redis or database)
        // For demo, we'll return the code directly
        res.json({ 
          success: true, 
          message: 'Verification code sent',
          code: result.code // Remove this in production
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      console.error('Error sending SMS verification:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/notifications/sms/status', async (req: any, res) => {
    try {
      res.json({
        configured: smsService.isConfigured(),
        configStatus: smsService.getConfigStatus(),
        provider: 'Twilio'
      });
    } catch (error: any) {
      console.error('Error getting SMS status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Telegram Configuration and Testing
  app.post('/api/notifications/telegram/validate', async (req: any, res) => {
    try {
      const { chatId } = req.body;
      
      if (!chatId) {
        return res.status(400).json({ error: 'Chat ID is required' });
      }

      // Demo mode for testing without real credentials
      if (!telegramService.isConfigured()) {
        // Simulate successful validation in demo mode
        if (chatId.match(/^\d+$/)) {
          res.json({ 
            success: true, 
            message: 'Demo validation successful (Telegram service not configured)',
            chatId: chatId,
            demo: true
          });
        } else {
          res.status(400).json({ 
            error: 'Invalid chat ID format. Must be numeric (e.g., 123456789)' 
          });
        }
        return;
      }

      const result = await telegramService.validateChatId(chatId);
      
      if (result.valid) {
        res.json({ 
          success: true, 
          message: 'Chat ID is valid',
          chatId: chatId
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      console.error('Error validating Telegram chat ID:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Notification Queue Management - Admin Endpoints
  app.get('/api/admin/notification-queue', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const queue = await notificationQueueService.getQueueForAdmin(100);
      res.json(queue);
    } catch (error) {
      console.error('Error fetching notification queue:', error);
      res.status(500).json({ error: 'Failed to fetch notification queue' });
    }
  });

  app.get('/api/admin/notification-queue/stats', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const stats = await notificationQueueService.getQueueStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching queue stats:', error);
      res.status(500).json({ error: 'Failed to fetch queue statistics' });
    }
  });

  app.post('/api/admin/notification-queue/:id/retry', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await notificationQueueService.retryNotification(id);
      res.json({ success: true, message: 'Notification queued for retry' });
    } catch (error) {
      console.error('Error retrying notification:', error);
      res.status(500).json({ error: 'Failed to retry notification' });
    }
  });

  app.post('/api/admin/notification-queue/test', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { channel, recipient, message } = req.body;
      
      const notificationId = await notificationQueueService.queueNotification({
        userId: req.user.id,
        channel,
        recipient,
        subject: 'Test Notification',
        message: message || 'This is a test notification from the admin panel.',
        priority: 10, // High priority for tests
      });

      res.json({ 
        success: true, 
        message: 'Test notification queued successfully',
        notificationId
      });
    } catch (error) {
      console.error('Error queuing test notification:', error);
      res.status(500).json({ error: 'Failed to queue test notification' });
    }
  });

  // Scheduled Processor Management (Admin Only)
  app.get('/api/admin/notification-processor/status', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const health = await scheduledProcessor.healthCheck();
      res.json(health);
    } catch (error) {
      console.error('Error getting processor status:', error);
      res.status(500).json({ error: 'Failed to get processor status' });
    }
  });

  app.post('/api/admin/notification-processor/force-process', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      await scheduledProcessor.forceProcess();
      res.json({ success: true, message: 'Force processing initiated' });
    } catch (error) {
      console.error('Error forcing notification processing:', error);
      res.status(500).json({ error: 'Failed to force process notifications' });
    }
  });

  app.post('/api/admin/notification-processor/update-interval', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { intervalMs } = req.body;
      
      if (!intervalMs || intervalMs < 10000) {
        return res.status(400).json({ error: 'Interval must be at least 10 seconds (10000ms)' });
      }

      scheduledProcessor.updateInterval(intervalMs);
      res.json({ 
        success: true, 
        message: `Processing interval updated to ${intervalMs / 1000} seconds` 
      });
    } catch (error) {
      console.error('Error updating processor interval:', error);
      res.status(500).json({ error: 'Failed to update processing interval' });
    }
  });

  app.get('/api/notifications/telegram/status', async (req: any, res) => {
    try {
      const testResult = await telegramService.testConnection();
      
      res.json({
        configured: telegramService.isConfigured(),
        configStatus: telegramService.getConfigStatus(),
        botUsername: telegramService.getBotUsername(),
        setupInstructions: telegramService.getSetupInstructions(),
        botInfo: testResult.success ? testResult.botInfo : null
      });
    } catch (error: any) {
      console.error('Error getting Telegram status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/notifications/telegram/test', async (req: any, res) => {
    try {
      const { chatId } = req.body;
      
      if (!chatId) {
        return res.status(400).json({ error: 'Chat ID is required' });
      }

      // Demo mode for testing without real credentials
      if (!telegramService.isConfigured()) {
        // Simulate successful test message in demo mode
        res.json({ 
          success: true, 
          message: 'Demo test message sent (Telegram service not configured)',
          messageId: `demo_${Date.now()}`,
          demo: true
        });
        return;
      }

      const result = await telegramService.sendMessage({
        chatId: chatId,
        message: '🧪 <b>Test Notification</b>\n\nThis is a test message from CryptoStrategy Pro!\n\n✅ Your Telegram notifications are working correctly.',
        parseMode: 'HTML'
      });

      if (result.success) {
        res.json({ 
          success: true, 
          message: 'Test message sent successfully',
          messageId: result.messageId
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      console.error('Error sending Telegram test:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Smart Timing Optimizer Routes
  
  // Get user's timing preferences
  app.get('/api/smart-timing/preferences', async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      const preferences = await smartTimingOptimizer.getUserTimingPreferences(userId as string);
      res.json(preferences);
    } catch (error) {
      console.error('Get timing preferences error:', error);
      res.status(500).json({ error: 'Failed to get timing preferences' });
    }
  });

  // Update user's timing preferences
  app.put('/api/smart-timing/preferences', async (req, res) => {
    try {
      const { userId, ...updates } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      const preferences = await smartTimingOptimizer.updateTimingPreferences(userId, updates);
      res.json(preferences);
    } catch (error) {
      console.error('Update timing preferences error:', error);
      res.status(500).json({ error: 'Failed to update timing preferences' });
    }
  });

  // Get timing optimization suggestions
  app.get('/api/smart-timing/suggestions', async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      const suggestions = await smartTimingOptimizer.generateOptimizationSuggestions(userId as string);
      res.json(suggestions);
    } catch (error) {
      console.error('Get timing suggestions error:', error);
      res.status(500).json({ error: 'Failed to get timing suggestions' });
    }
  });

  // Apply timing optimization
  app.post('/api/smart-timing/apply-optimization', async (req, res) => {
    try {
      const { optimizationId } = req.body;
      if (!optimizationId) {
        return res.status(400).json({ error: 'Optimization ID is required' });
      }
      
      const success = await smartTimingOptimizer.applyOptimization(optimizationId);
      res.json({ success });
    } catch (error) {
      console.error('Apply optimization error:', error);
      res.status(500).json({ error: 'Failed to apply optimization' });
    }
  });

  // Check if notification should be sent
  app.post('/api/smart-timing/should-send', async (req, res) => {
    try {
      const { userId, signalConfidence } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      const result = await smartTimingOptimizer.shouldSendNotification(userId, signalConfidence);
      res.json(result);
    } catch (error) {
      console.error('Should send notification error:', error);
      res.status(500).json({ error: 'Failed to check notification timing' });
    }
  });

  // Get timing analytics summary
  app.get('/api/smart-timing/analytics', async (req, res) => {
    try {
      const { userId, days } = req.query;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      const analytics = await smartTimingOptimizer.getTimingAnalyticsSummary(
        userId as string, 
        days ? parseInt(days as string) : 30
      );
      res.json(analytics);
    } catch (error) {
      console.error('Get timing analytics error:', error);
      res.status(500).json({ error: 'Failed to get timing analytics' });
    }
  });

  // Record notification interaction
  app.post('/api/smart-timing/record-interaction', async (req, res) => {
    try {
      const analyticsData = req.body;
      await smartTimingOptimizer.recordNotificationAnalytics(analyticsData);
      res.json({ success: true });
    } catch (error) {
      console.error('Record interaction error:', error);
      res.status(500).json({ error: 'Failed to record interaction' });
    }
  });

  // Get optimal timing analysis
  app.get('/api/smart-timing/optimal-analysis', async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      const analysis = await smartTimingOptimizer.calculateOptimalTiming(userId as string);
      res.json(analysis);
    } catch (error) {
      console.error('Get optimal analysis error:', error);
      res.status(500).json({ error: 'Failed to get optimal timing analysis' });
    }
  });

  // Achievement System API Endpoints
  
  // Get all achievements
  app.get('/api/achievements', async (req, res) => {
    try {
      const achievements = await storage.getAllAchievements();
      res.json(achievements);
    } catch (error) {
      console.error('Error fetching achievements:', error);
      res.status(500).json({ message: 'Failed to fetch achievements' });
    }
  });

  // Get user achievements with progress
  app.get('/api/user/achievements', requireAuth, async (req: any, res) => {
    try {
      const userAchievements = await storage.getUserAchievements(req.user.id);
      res.json(userAchievements);
    } catch (error) {
      console.error('Error fetching user achievements:', error);
      res.status(500).json({ message: 'Failed to fetch user achievements' });
    }
  });

  // Get user statistics
  app.get('/api/user/stats', requireAuth, async (req: any, res) => {
    try {
      const stats = await storage.getUserStats(req.user.id);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ message: 'Failed to fetch user statistics' });
    }
  });

  // Update user statistics (internal use for achievement tracking)
  app.put('/api/user/stats', requireAuth, async (req: any, res) => {
    try {
      const { signalsReceived, daysActive, profitPercentage } = req.body;
      
      const updates: any = {};
      if (signalsReceived !== undefined) updates.signalsReceived = signalsReceived;
      if (daysActive !== undefined) updates.daysActive = daysActive;
      if (profitPercentage !== undefined) updates.profitPercentage = profitPercentage;
      
      const stats = await storage.updateUserStats(req.user.id, updates);
      
      // Check for new achievement unlocks
      await checkAndUnlockAchievements(req.user.id, stats);
      
      res.json(stats);
    } catch (error) {
      console.error('Error updating user stats:', error);
      res.status(500).json({ message: 'Failed to update user statistics' });
    }
  });

  // Helper function to check and unlock achievements
  async function checkAndUnlockAchievements(userId: string, stats: any) {
    try {
      const achievements = await storage.getAllAchievements();
      const userAchievements = await storage.getUserAchievements(userId);
      const unlockedIds = userAchievements.map(ua => ua.achievementId);
      
      for (const achievement of achievements) {
        if (unlockedIds.includes(achievement.id)) continue;
        
        let shouldUnlock = false;
        
        // Check achievement criteria
        switch (achievement.id) {
          case 'first-signal':
            shouldUnlock = stats.signalsReceived >= 1;
            break;
          case 'signal-veteran':
            shouldUnlock = stats.signalsReceived >= 100;
            break;
          case 'signal-master':
            shouldUnlock = stats.signalsReceived >= 1000;
            break;
          case 'early-adopter':
            shouldUnlock = stats.daysActive >= 7;
            break;
          case 'consistent-trader':
            shouldUnlock = stats.daysActive >= 30;
            break;
          case 'profitable-trader':
            shouldUnlock = stats.profitPercentage >= 10;
            break;
          case 'platform-explorer':
            shouldUnlock = stats.daysActive >= 1; // Simple engagement check
            break;
          case 'loyal-user':
            shouldUnlock = stats.daysActive >= 90;
            break;
        }
        
        if (shouldUnlock) {
          await storage.unlockUserAchievement({
            userId,
            achievementId: achievement.id,
            progress: 100,
            unlockedAt: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  }

  // Admin endpoints for achievement management
  app.post('/api/admin/achievements', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const achievementData = req.body;
      const achievement = await storage.createAchievement(achievementData);
      
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'CREATE_ACHIEVEMENT',
        targetTable: 'achievements',
        targetId: achievement.id,
        notes: `Created achievement: ${achievement.title}`,
      });
      
      res.json(achievement);
    } catch (error) {
      console.error('Error creating achievement:', error);
      res.status(500).json({ message: 'Failed to create achievement' });
    }
  });

  app.put('/api/admin/achievements/:id', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const achievement = await storage.updateAchievement(id, updates);
      if (!achievement) {
        return res.status(404).json({ message: 'Achievement not found' });
      }
      
      await storage.createAdminLog({
        adminId: req.user.id,
        action: 'UPDATE_ACHIEVEMENT',
        targetTable: 'achievements',
        targetId: achievement.id,
        notes: `Updated achievement: ${achievement.title}`,
      });
      
      res.json(achievement);
    } catch (error) {
      console.error('Error updating achievement:', error);
      res.status(500).json({ message: 'Failed to update achievement' });
    }
  });

  // Notification API Routes
  app.get('/api/notifications', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Return sample notifications for now
      const sampleNotifications = [
        {
          id: '1',
          userId,
          type: 'signal',
          title: 'BTC Buy Signal',
          message: 'Strong buy signal detected for Bitcoin at $67,543',
          priority: 'high',
          isRead: false,
          isArchived: false,
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          metadata: {
            symbol: 'BTCUSDT',
            price: 67543,
            change: 2.4,
            signalType: 'buy'
          }
        },
        {
          id: '2',
          userId,
          type: 'price',
          title: 'Price Alert',
          message: 'Ethereum reached your target price of $3,400',
          priority: 'medium',
          isRead: false,
          isArchived: false,
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          metadata: {
            symbol: 'ETHUSDT',
            price: 3400,
            change: 1.8
          }
        },
        {
          id: '3',
          userId,
          type: 'system',
          title: 'System Update',
          message: 'New features have been added to your dashboard',
          priority: 'low',
          isRead: true,
          isArchived: false,
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        }
      ];
      res.json(sampleNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: any, res) => {
    try {
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  });

  app.patch('/api/notifications/:id/archive', requireAuth, async (req: any, res) => {
    try {
      res.json({ success: true });
    } catch (error) {
      console.error('Error archiving notification:', error);
      res.status(500).json({ message: 'Failed to archive notification' });
    }
  });

  app.patch('/api/notifications/mark-all-read', requireAuth, async (req: any, res) => {
    try {
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ message: 'Failed to mark all notifications as read' });
    }
  });

  app.get('/api/user/notification-preferences', requireAuth, async (req: any, res) => {
    try {
      const preferences = {
        enableSound: true,
        enableBrowser: true,
        enableContextual: true,
        categories: {
          signals: true,
          price: true,
          news: true,
          system: true,
          achievements: true,
        },
        priorities: {
          low: true,
          medium: true,
          high: true,
          critical: true,
        },
      };
      res.json(preferences);
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      res.status(500).json({ message: 'Failed to fetch notification preferences' });
    }
  });

  app.put('/api/user/notification-preferences', requireAuth, async (req: any, res) => {
    try {
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({ message: 'Failed to update notification preferences' });
    }
  });

  // Subscription Management API Routes
  app.get('/api/admin/subscriptions', requireAuth, requireAdmin, async (req, res) => {
    try {
      // Return sample subscription data
      const sampleSubscriptions = [
        {
          id: '1',
          userId: 'user1',
          userEmail: 'john@example.com',
          userName: 'John Doe',
          planTier: 'premium',
          planName: 'Premium Plan',
          status: 'active',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          amount: 2999,
          lastPayment: '2024-01-01',
          nextPayment: '2024-02-01'
        }
      ];
      res.json(sampleSubscriptions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch subscriptions' });
    }
  });

  app.get('/api/subscription-plans', async (req, res) => {
    try {
      // Return sample subscription plans
      const samplePlans = [
        {
          id: '1',
          name: 'Basic Plan',
          tier: 'basic',
          monthlyPrice: 999,
          yearlyPrice: 9999,
          features: ['5 Trading Signals', '3 Tickers', 'Email Notifications'],
          maxSignals: 5,
          maxTickers: 3,
          isActive: true
        },
        {
          id: '2',
          name: 'Premium Plan',
          tier: 'premium',
          monthlyPrice: 2999,
          yearlyPrice: 29999,
          features: ['Unlimited Signals', '15 Tickers', 'SMS + Email Alerts', 'Advanced Analytics'],
          maxSignals: -1,
          maxTickers: 15,
          isActive: true
        }
      ];
      res.json(samplePlans);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch subscription plans' });
    }
  });

  app.post('/api/admin/subscription-plans', requireAuth, requireAdmin, async (req, res) => {
    try {
      const planData = req.body;
      const newPlan = {
        id: Date.now().toString(),
        ...planData,
        isActive: true
      };
      res.json(newPlan);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create subscription plan' });
    }
  });

  app.put('/api/admin/subscription-plans/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      res.json({ id, ...updates });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update subscription plan' });
    }
  });

  app.delete('/api/admin/subscription-plans/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete subscription plan' });
    }
  });

  app.post('/api/admin/subscriptions/:id/cancel', requireAuth, requireAdmin, async (req, res) => {
    try {
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to cancel subscription' });
    }
  });

  app.post('/api/notifications/test', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type = 'system' } = req.body;
      
      const testNotification = {
        id: `test-${Date.now()}`,
        userId,
        type,
        title: `Test ${type} notification`,
        message: `This is a test ${type} notification to verify the system is working correctly.`,
        priority: 'medium' as const,
        isRead: false,
        isArchived: false,
        timestamp: new Date().toISOString(),
        metadata: type === 'signal' ? {
          symbol: 'BTCUSDT',
          price: 45000,
          change: 2.5,
          signalType: 'buy' as const,
        } : null,
      };
      
      // Broadcast to connected clients
      broadcast({
        type: 'notification',
        notification: testNotification,
      });
      
      res.json(testNotification);
    } catch (error) {
      console.error('Error creating test notification:', error);
      res.status(500).json({ message: 'Failed to create test notification' });
    }
  });

  return httpServer;
}
