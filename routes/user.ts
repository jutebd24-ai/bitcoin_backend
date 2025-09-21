/**
 * User Routes
 * Handles user profile, settings, and preferences
 */
import type { Express } from "express";
import type { WebSocketServer } from "ws";
import { body, param, query } from "express-validator";
import { storage } from "../storage.js";
import { requireAuth } from "../middleware/auth.js";
import { validateInput } from "../utils/validation.js";
import { z } from "zod";
import { insertUserNotificationSchema, insertUserNotificationPreferencesSchema } from "../../shared/schema.js";

/**
 * User routes setup
 */
export function userRoutes(app: Express, wss: WebSocketServer) {

  /**
   * Get user profile
   * GET /api/user/profile
   */
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
      res.status(500).json({ 
        message: 'Failed to get profile',
        code: 'PROFILE_ERROR'
      });
    }
  });

  /**
   * Update user profile
   * PUT /api/user/profile
   */
  app.put('/api/user/profile', [
    requireAuth,
    body('name')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be 2-50 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { name, email } = req.body;
      const updates: any = {};

      if (name) updates.name = name;
      if (email && email !== req.user.email) {
        // Check if email is already taken
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== req.user.id) {
          return res.status(409).json({ 
            message: 'Email already in use',
            code: 'EMAIL_EXISTS'
          });
        }
        updates.email = email;
      }

      if (Object.keys(updates).length === 0) {
        return res.json({ message: 'No changes to update' });
      }

      const updatedUser = await storage.updateUser(req.user.id, updates);
      
      res.json({
        message: 'Profile updated successfully',
        user: { ...updatedUser, hashedPassword: undefined }
      });

    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ 
        message: 'Failed to update profile',
        code: 'PROFILE_UPDATE_ERROR'
      });
    }
  });

  /**
   * Get user settings
   * GET /api/user/settings
   */
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
      res.status(500).json({ 
        message: 'Failed to get settings',
        code: 'SETTINGS_ERROR'
      });
    }
  });

  /**
   * Update user settings
   * PUT /api/user/settings  
   */
  app.put('/api/user/settings', [
    requireAuth,
    body('theme').optional().isIn(['light', 'dark', 'auto']),
    body('language').optional().isLength({ min: 2, max: 5 }),
    body('timezone').optional().isLength({ min: 3, max: 50 }),
    body('currency').optional().isLength({ min: 3, max: 5 }),
    validateInput
  ], async (req: any, res) => {
    try {
      const settingsSchema = z.object({
        // Notification Preferences
        notificationEmail: z.boolean().optional(),
        notificationSms: z.boolean().optional(),
        notificationPush: z.boolean().optional(),
        
        // Display Preferences
        theme: z.enum(['light', 'dark', 'auto']).optional(),
        language: z.string().optional(),
        timezone: z.string().optional(),
        currency: z.string().optional(),
        dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
        timeFormat: z.enum(['12h', '24h']).optional(),
        
        // Chart Preferences
        defaultChartType: z.enum(['candlestick', 'line', 'area']).optional(),
        defaultTimeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']).optional(),
        showVolume: z.boolean().optional(),
        autoRefreshCharts: z.boolean().optional(),
      });

      const validatedData = settingsSchema.parse(req.body);
      const settings = await storage.updateUserSettings(req.user.id, validatedData);

      res.json({
        message: 'Settings updated successfully',
        settings
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid settings data',
          errors: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }

      console.error('Settings update error:', error);
      res.status(500).json({ 
        message: 'Failed to update settings',
        code: 'SETTINGS_UPDATE_ERROR'
      });
    }
  });

  /**
   * Get user achievements
   * GET /api/user/achievements
   */
  app.get('/api/user/achievements', requireAuth, async (req: any, res) => {
    try {
      // Demo achievements data (replace with actual logic)
      const achievements = [
        {
          id: 'first-login',
          title: 'Welcome Aboard',
          description: 'Successfully logged into your account',
          icon: '🚀',
          earnedAt: new Date().toISOString(),
          points: 10
        },
        {
          id: 'profile-complete',
          title: 'Profile Master',
          description: 'Completed your profile information',
          icon: '👤',
          earnedAt: new Date().toISOString(),
          points: 25
        }
      ];

      res.json(achievements);
    } catch (error) {
      console.error('Error fetching achievements:', error);
      res.status(500).json({ 
        message: 'Failed to fetch achievements',
        code: 'ACHIEVEMENTS_ERROR'
      });
    }
  });

  /**
   * Get user notifications
   * GET /api/user/notifications
   */
  app.get('/api/user/notifications', [
    requireAuth,
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('read').optional().isBoolean(),
    validateInput
  ], async (req: any, res) => {
    try {
      const { limit = 50, offset = 0, read } = req.query;

      // Mock notifications data - replace with actual database query
      const notifications = [
        {
          id: 'notif-1',
          userId: req.user.id,
          type: 'signal',
          title: 'New Buy Signal',
          message: 'BTCUSDT buy signal at $110,500',
          data: { symbol: 'BTCUSDT', price: 110500, action: 'buy' },
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'notif-2',
          userId: req.user.id,
          type: 'account',
          title: 'Profile Updated',
          message: 'Your notification preferences have been updated',
          data: {},
          isRead: true,
          createdAt: new Date(Date.now() - 3600000), // 1 hour ago
          updatedAt: new Date(Date.now() - 3600000)
        },
        {
          id: 'notif-3',
          userId: req.user.id,
          type: 'alert',
          title: 'Price Alert Triggered',
          message: 'ETH reached your target price of $4,000',
          data: { symbol: 'ETHUSD', price: 4000, alertType: 'price' },
          isRead: false,
          createdAt: new Date(Date.now() - 7200000), // 2 hours ago
          updatedAt: new Date(Date.now() - 7200000)
        }
      ];

      // Filter by read status if specified
      let filteredNotifications = notifications;
      if (read !== undefined) {
        filteredNotifications = notifications.filter(n => n.isRead === (read === 'true'));
      }

      // Apply pagination
      const paginatedNotifications = filteredNotifications.slice(offset, offset + limit);

      res.json({
        notifications: paginatedNotifications,
        total: filteredNotifications.length,
        hasMore: offset + limit < filteredNotifications.length,
        unreadCount: notifications.filter(n => !n.isRead).length
      });

    } catch (error) {
      console.error('User notifications error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch notifications',
        code: 'USER_NOTIFICATIONS_ERROR'
      });
    }
  });

  /**
   * Mark notification as read
   * PUT /api/user/notifications/:id/read
   */
  app.put('/api/user/notifications/:id/read', [
    requireAuth,
    param('id').notEmpty().withMessage('Notification ID is required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;

      // Mock implementation - would update database
      console.log(`Marking notification ${id} as read for user ${req.user.id}`);

      res.json({
        message: 'Notification marked as read'
      });

    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({
        message: 'Failed to mark notification as read',
        code: 'MARK_NOTIFICATION_READ_ERROR'
      });
    }
  });

  /**
   * Mark all notifications as read
   * PUT /api/user/notifications/mark-all-read
   */
  app.put('/api/user/notifications/mark-all-read', [
    requireAuth
  ], async (req: any, res) => {
    try {
      // Mock implementation - would update database
      console.log(`Marking all notifications as read for user ${req.user.id}`);

      res.json({
        message: 'All notifications marked as read'
      });

    } catch (error) {
      console.error('Mark all notifications read error:', error);
      res.status(500).json({
        message: 'Failed to mark all notifications as read',
        code: 'MARK_ALL_NOTIFICATIONS_READ_ERROR'
      });
    }
  });

  /**
   * Delete notification
   * DELETE /api/user/notifications/:id
   */
  app.delete('/api/user/notifications/:id', [
    requireAuth,
    param('id').notEmpty().withMessage('Notification ID is required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;

      // Mock implementation - would delete from database
      console.log(`Deleting notification ${id} for user ${req.user.id}`);

      res.json({
        message: 'Notification deleted successfully'
      });

    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        message: 'Failed to delete notification',
        code: 'DELETE_NOTIFICATION_ERROR'
      });
    }
  });

  /**
   * Update notification preferences
   * PUT /api/user/notification-preferences
   */
  app.put('/api/user/notification-preferences', [
    requireAuth,
    body('emailAlerts').optional().isBoolean(),
    body('smsAlerts').optional().isBoolean(),
    body('pushAlerts').optional().isBoolean(),
    body('telegramAlerts').optional().isBoolean(),
    body('emailAddress').optional().isEmail(),
    body('phoneNumber').optional().isLength({ min: 10, max: 15 }),
    body('telegramChatId').optional().isString(),
    body('quietHoursEnabled').optional().isBoolean(),
    body('quietHoursStart').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('quietHoursEnd').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    validateInput
  ], async (req: any, res) => {
    try {
      const updates = req.body;
      
      const settings = await storage.updateUserSettings(req.user.id, {
        notificationEmail: updates.emailAlerts,
        notificationSms: updates.smsAlerts,
        notificationPush: updates.pushAlerts,
        notificationTelegram: updates.telegramAlerts,
        emailAddress: updates.emailAddress,
        phoneNumber: updates.phoneNumber,
        telegramChatId: updates.telegramChatId,
        quietHoursStart: updates.quietHoursStart,
        quietHoursEnd: updates.quietHoursEnd
      });

      res.json({
        message: 'Notification preferences updated successfully',
        settings
      });

    } catch (error) {
      console.error('Update notification preferences error:', error);
      res.status(500).json({
        message: 'Failed to update notification preferences',
        code: 'UPDATE_NOTIFICATION_PREFERENCES_ERROR'
      });
    }
  });

  /**
   * Delete user account
   * DELETE /api/user/account
   */
  app.delete('/api/user/account', [
    requireAuth,
    body('password').exists().withMessage('Password required for account deletion'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { password } = req.body;

      // Verify password before deletion
      const bcrypt = await import('bcryptjs');
      const isValidPassword = await bcrypt.compare(password, req.user.hashedPassword);
      
      if (!isValidPassword) {
        return res.status(401).json({ 
          message: 'Invalid password',
          code: 'INVALID_PASSWORD'
        });
      }

      // Delete user account
      await storage.deleteUser(req.user.id);

      res.json({
        message: 'Account deleted successfully'
      });

    } catch (error) {
      console.error('Account deletion error:', error);
      res.status(500).json({ 
        message: 'Failed to delete account',
        code: 'ACCOUNT_DELETE_ERROR'
      });
    }
  });

  /**
   * Get user notifications
   * GET /api/notifications
   */
  app.get('/api/notifications', requireAuth, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const notifications = await storage.getUserNotifications(req.user.id, limit);
      res.json(notifications);
    } catch (error) {
      console.error('Failed to get notifications:', error);
      res.status(500).json({ 
        message: 'Failed to get notifications',
        code: 'NOTIFICATIONS_ERROR'
      });
    }
  });

  /**
   * Mark notification as read
   * PATCH /api/notifications/:id/read
   */
  app.patch('/api/notifications/:id/read', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationAsRead(id, req.user.id);
      
      if (!notification) {
        return res.status(404).json({ 
          message: 'Notification not found',
          code: 'NOTIFICATION_NOT_FOUND'
        });
      }
      
      res.json(notification);
    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({ 
        message: 'Failed to mark notification as read',
        code: 'MARK_NOTIFICATION_READ_ERROR'
      });
    }
  });

  /**
   * Mark all notifications as read
   * PATCH /api/notifications/read-all
   */
  app.patch('/api/notifications/read-all', requireAuth, async (req: any, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json({ 
        message: 'Failed to mark all notifications as read',
        code: 'MARK_ALL_NOTIFICATIONS_READ_ERROR'
      });
    }
  });

  /**
   * Archive notification
   * PATCH /api/notifications/:id/archive
   */
  app.patch('/api/notifications/:id/archive', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.archiveNotification(id, req.user.id);
      
      if (!notification) {
        return res.status(404).json({ 
          message: 'Notification not found',
          code: 'NOTIFICATION_NOT_FOUND'
        });
      }
      
      res.json(notification);
    } catch (error) {
      console.error('Archive notification error:', error);
      res.status(500).json({ 
        message: 'Failed to archive notification',
        code: 'ARCHIVE_NOTIFICATION_ERROR'
      });
    }
  });

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  app.delete('/api/notifications/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteNotification(id, req.user.id);
      
      if (!success) {
        return res.status(404).json({ 
          message: 'Notification not found',
          code: 'NOTIFICATION_NOT_FOUND'
        });
      }
      
      res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({ 
        message: 'Failed to delete notification',
        code: 'DELETE_NOTIFICATION_ERROR'
      });
    }
  });

  /**
   * Create a new notification
   * POST /api/notifications
   */
  app.post('/api/notifications', requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertUserNotificationSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      const notification = await storage.createUserNotification(validatedData);
      
      // Broadcast via WebSocket if available
      if (wss) {
        const message = {
          type: 'notification',
          notification: notification
        };
        
        wss.clients.forEach((client: any) => {
          if (client.readyState === 1 && client.userId === req.user.id) {
            client.send(JSON.stringify(message));
          }
        });
      }
      
      res.status(201).json(notification);
    } catch (error) {
      console.error('Failed to create notification:', error);
      res.status(500).json({ 
        message: 'Failed to create notification',
        code: 'NOTIFICATION_CREATE_ERROR'
      });
    }
  });

  /**
   * Mark notification as read
   * PATCH /api/notifications/:id/read
   */
  app.patch('/api/notifications/:id/read', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationAsRead(id, req.user.id);
      
      if (!notification) {
        return res.status(404).json({ 
          message: 'Notification not found',
          code: 'NOTIFICATION_NOT_FOUND'
        });
      }
      
      res.json(notification);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({ 
        message: 'Failed to mark notification as read',
        code: 'NOTIFICATION_READ_ERROR'
      });
    }
  });

  /**
   * Mark all notifications as read
   * PATCH /api/notifications/mark-all-read
   */
  app.patch('/api/notifications/mark-all-read', requireAuth, async (req: any, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      res.status(500).json({ 
        message: 'Failed to mark all notifications as read',
        code: 'NOTIFICATIONS_READ_ALL_ERROR'
      });
    }
  });

  /**
   * Archive notification
   * PATCH /api/notifications/:id/archive
   */
  app.patch('/api/notifications/:id/archive', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.archiveNotification(id, req.user.id);
      
      if (!notification) {
        return res.status(404).json({ 
          message: 'Notification not found',
          code: 'NOTIFICATION_NOT_FOUND'
        });
      }
      
      res.json(notification);
    } catch (error) {
      console.error('Failed to archive notification:', error);
      res.status(500).json({ 
        message: 'Failed to archive notification',
        code: 'NOTIFICATION_ARCHIVE_ERROR'
      });
    }
  });

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  app.delete('/api/notifications/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteNotification(id, req.user.id);
      
      if (!deleted) {
        return res.status(404).json({ 
          message: 'Notification not found',
          code: 'NOTIFICATION_NOT_FOUND'
        });
      }
      
      res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
      console.error('Failed to delete notification:', error);
      res.status(500).json({ 
        message: 'Failed to delete notification',
        code: 'NOTIFICATION_DELETE_ERROR'
      });
    }
  });

  /**
   * Get user notification preferences
   * GET /api/user/notification-preferences
   */
  app.get('/api/user/notification-preferences', requireAuth, async (req: any, res) => {
    try {
      let preferences = await storage.getUserNotificationPreferences(req.user.id);
      
      if (!preferences) {
        // Create default preferences
        const defaultPreferences = {
          userId: req.user.id,
          enableSound: true,
          enableBrowser: true,
          enableContextual: true,
          categorySignals: true,
          categoryPrice: true,
          categoryNews: true,
          categorySystem: true,
          categoryAchievements: true,
          priorityLow: true,
          priorityMedium: true,
          priorityHigh: true,
          priorityCritical: true,
        };
        preferences = await storage.createUserNotificationPreferences(defaultPreferences);
      }
      
      res.json(preferences);
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      res.status(500).json({ 
        message: 'Failed to get notification preferences',
        code: 'PREFERENCES_ERROR'
      });
    }
  });

  /**
   * Update user notification preferences
   * PUT /api/user/notification-preferences
   */
  app.put('/api/user/notification-preferences', requireAuth, async (req: any, res) => {
    try {
      const preferences = await storage.updateUserNotificationPreferences(req.user.id, req.body);
      
      if (!preferences) {
        return res.status(404).json({ 
          message: 'Notification preferences not found',
          code: 'PREFERENCES_NOT_FOUND'
        });
      }
      
      res.json(preferences);
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      res.status(500).json({ 
        message: 'Failed to update notification preferences',
        code: 'PREFERENCES_UPDATE_ERROR'
      });
    }
  });

  /**
   * Get user alerts
   * GET /api/user/alerts
   */
  app.get('/api/user/alerts', [requireAuth], async (req: any, res) => {
    try {
      const { page = 1, limit = 20, active } = req.query;
      
      // Mock alerts data - in production this would come from database
      const alerts = [
        {
          id: '1',
          userId: req.user.id,
          ticker: 'BTCUSDT',
          type: 'price',
          condition: 'above',
          value: '70000',
          currentValue: '65262.94',
          isActive: true,
          channels: ['email'],
          createdAt: '2025-09-12T08:00:00.000Z',
          triggeredAt: null,
          lastChecked: new Date().toISOString()
        },
        {
          id: '2',
          userId: req.user.id,
          ticker: 'ETHUSDT',
          type: 'price',
          condition: 'below',
          value: '3500',
          currentValue: '3850.25',
          isActive: true,
          channels: ['email', 'sms'],
          createdAt: '2025-09-11T15:30:00.000Z',
          triggeredAt: null,
          lastChecked: new Date().toISOString()
        },
        {
          id: '3',
          userId: req.user.id,
          ticker: 'BTCUSDT',
          type: 'technical',
          condition: 'rsi_oversold',
          value: '30',
          currentValue: '45.2',
          isActive: false,
          channels: ['email'],
          createdAt: '2025-09-10T10:15:00.000Z',
          triggeredAt: '2025-09-10T14:22:00.000Z',
          lastChecked: new Date().toISOString()
        }
      ];

      let filteredAlerts = alerts;
      if (active !== undefined) {
        filteredAlerts = alerts.filter(alert => alert.isActive === (active === 'true'));
      }

      const startIndex = (page - 1) * limit;
      const paginatedAlerts = filteredAlerts.slice(startIndex, startIndex + parseInt(limit));

      res.json({
        alerts: paginatedAlerts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredAlerts.length,
          pages: Math.ceil(filteredAlerts.length / parseInt(limit))
        },
        summary: {
          total: alerts.length,
          active: alerts.filter(a => a.isActive).length,
          triggered: alerts.filter(a => a.triggeredAt).length
        }
      });
    } catch (error) {
      console.error('User alerts error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch alerts',
        code: 'USER_ALERTS_ERROR'
      });
    }
  });

  /**
   * Create user alert
   * POST /api/user/alerts
   */
  app.post('/api/user/alerts', [
    requireAuth,
    body('ticker').isString().notEmpty().withMessage('Ticker is required'),
    body('type').isIn(['price', 'technical']).withMessage('Type must be price or technical'),
    body('condition').isString().notEmpty().withMessage('Condition is required'),
    body('value').isString().notEmpty().withMessage('Value is required'),
    body('channels').isArray().notEmpty().withMessage('Channels array is required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { ticker, type, condition, value, channels } = req.body;
      
      const newAlert = {
        id: Math.random().toString(36).substr(2, 9),
        userId: req.user.id,
        ticker,
        type,
        condition,
        value,
        currentValue: null,
        isActive: true,
        channels,
        createdAt: new Date().toISOString(),
        triggeredAt: null,
        lastChecked: new Date().toISOString()
      };

      // In production, save to database
      console.log('Creating alert:', newAlert);

      res.status(201).json({
        message: 'Alert created successfully',
        alert: newAlert
      });
    } catch (error) {
      console.error('Create alert error:', error);
      res.status(500).json({ 
        message: 'Failed to create alert',
        code: 'CREATE_ALERT_ERROR'
      });
    }
  });

  /**
   * Update user alert
   * PUT /api/user/alerts/:id
   */
  app.put('/api/user/alerts/:id', [
    requireAuth,
    param('id').notEmpty().withMessage('Alert ID is required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // In production, update in database
      console.log(`Updating alert ${id} for user ${req.user.id}:`, updates);

      res.json({
        message: 'Alert updated successfully',
        alert: { id, ...updates, updatedAt: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Update alert error:', error);
      res.status(500).json({ 
        message: 'Failed to update alert',
        code: 'UPDATE_ALERT_ERROR'
      });
    }
  });

  /**
   * Delete user alert
   * DELETE /api/user/alerts/:id
   */
  app.delete('/api/user/alerts/:id', [
    requireAuth,
    param('id').notEmpty().withMessage('Alert ID is required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // In production, delete from database
      console.log(`Deleting alert ${id} for user ${req.user.id}`);

      res.json({
        message: 'Alert deleted successfully'
      });
    } catch (error) {
      console.error('Delete alert error:', error);
      res.status(500).json({ 
        message: 'Failed to delete alert',
        code: 'DELETE_ALERT_ERROR'
      });
    }
  });

  /**
   * Get user portfolio
   * GET /api/user/portfolio
   */
  app.get('/api/user/portfolio', [requireAuth], async (req: any, res) => {
    try {
      // Mock portfolio data - in production this would come from database
      const portfolio = {
        totalValue: 125847.32,
        totalPnL: 15847.32,
        totalPnLPercentage: 14.41,
        dayChange: 2347.89,
        dayChangePercentage: 1.87,
        lastUpdated: new Date().toISOString(),
        positions: [
          {
            id: '1',
            symbol: 'BTCUSDT',
            name: 'Bitcoin',
            quantity: '1.25',
            averagePrice: '58500.00',
            currentPrice: '65262.94',
            marketValue: 81578.68,
            pnl: 8453.68,
            pnlPercentage: 11.56,
            weight: 64.8,
            lastTrade: '2025-09-10T14:30:00.000Z'
          },
          {
            id: '2',
            symbol: 'ETHUSDT',
            name: 'Ethereum',
            quantity: '10.5',
            averagePrice: '3200.00',
            currentPrice: '3850.25',
            marketValue: 40427.63,
            pnl: 6827.63,
            pnlPercentage: 20.34,
            weight: 32.1,
            lastTrade: '2025-09-09T16:45:00.000Z'
          },
          {
            id: '3',
            symbol: 'SOLUSDT',
            name: 'Solana',
            quantity: '25.0',
            averagePrice: '145.00',
            currentPrice: '152.33',
            marketValue: 3808.25,
            pnl: 183.25,
            pnlPercentage: 5.07,
            weight: 3.0,
            lastTrade: '2025-09-08T09:15:00.000Z'
          }
        ],
        performance: {
          weeklyReturn: 8.32,
          monthlyReturn: 22.41,
          yearlyReturn: 145.67,
          sharpeRatio: 1.34,
          maxDrawdown: -12.45,
          winRate: 68.5
        },
        allocation: {
          crypto: 100.0,
          stocks: 0.0,
          bonds: 0.0,
          cash: 0.0
        }
      };

      res.json(portfolio);
    } catch (error) {
      console.error('User portfolio error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch portfolio',
        code: 'USER_PORTFOLIO_ERROR'
      });
    }
  });

  /**
   * Add portfolio position
   * POST /api/user/portfolio/positions
   */
  app.post('/api/user/portfolio/positions', [
    requireAuth,
    body('symbol').isString().notEmpty().withMessage('Symbol is required'),
    body('quantity').isString().notEmpty().withMessage('Quantity is required'),
    body('averagePrice').isString().notEmpty().withMessage('Average price is required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { symbol, quantity, averagePrice } = req.body;
      
      const newPosition = {
        id: Math.random().toString(36).substr(2, 9),
        userId: req.user.id,
        symbol,
        quantity,
        averagePrice,
        createdAt: new Date().toISOString()
      };

      // In production, save to database
      console.log('Adding portfolio position:', newPosition);

      res.status(201).json({
        message: 'Position added successfully',
        position: newPosition
      });
    } catch (error) {
      console.error('Add position error:', error);
      res.status(500).json({ 
        message: 'Failed to add position',
        code: 'ADD_POSITION_ERROR'
      });
    }
  });

  /**
   * Update portfolio position
   * PUT /api/user/portfolio/positions/:id
   */
  app.put('/api/user/portfolio/positions/:id', [
    requireAuth,
    param('id').notEmpty().withMessage('Position ID is required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // In production, update in database
      console.log(`Updating position ${id} for user ${req.user.id}:`, updates);

      res.json({
        message: 'Position updated successfully',
        position: { id, ...updates, updatedAt: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Update position error:', error);
      res.status(500).json({ 
        message: 'Failed to update position',
        code: 'UPDATE_POSITION_ERROR'
      });
    }
  });

  /**
   * Delete portfolio position
   * DELETE /api/user/portfolio/positions/:id
   */
  app.delete('/api/user/portfolio/positions/:id', [
    requireAuth,
    param('id').notEmpty().withMessage('Position ID is required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // In production, delete from database
      console.log(`Deleting position ${id} for user ${req.user.id}`);

      res.json({
        message: 'Position deleted successfully'
      });
    } catch (error) {
      console.error('Delete position error:', error);
      res.status(500).json({ 
        message: 'Failed to delete position',
        code: 'DELETE_POSITION_ERROR'
      });
    }
  });
}