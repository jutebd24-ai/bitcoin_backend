import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Database schema validation to prevent SQL injection and data corruption
export const validateUserData = (req: Request, res: Response, next: NextFunction) => {
  const userSchema = z.object({
    email: z.string().email().max(255),
    password: z.string().min(6).max(128),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
  });

  try {
    if (req.body.email || req.body.password) {
      userSchema.parse(req.body);
    }
    next();
  } catch (error) {
    return res.status(400).json({
      message: 'Invalid user data format',
      code: 'INVALID_USER_DATA',
      details: error instanceof z.ZodError ? error.errors : 'Validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Trading signal validation
export const validateTradingSignal = (req: Request, res: Response, next: NextFunction) => {
  const signalSchema = z.object({
    ticker: z.string().regex(/^[A-Z]{2,10}USDT?$/, 'Invalid ticker format'),
    signalType: z.enum(['buy', 'sell']),
    price: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid price format'),
    timeframe: z.enum(['1M', '1W', '1D', '12h', '4h', '1h', '30m']).optional(),
    note: z.string().max(500).optional(),
    source: z.enum(['webhook', 'manual', 'algorithm', 'technical_analysis']).optional(),
  });

  try {
    if (req.body.ticker || req.body.signalType) {
      signalSchema.parse(req.body);
    }
    next();
  } catch (error) {
    return res.status(400).json({
      message: 'Invalid trading signal format',
      code: 'INVALID_SIGNAL_DATA',
      details: error instanceof z.ZodError ? error.errors : 'Signal validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Webhook payload validation
export const validateWebhookPayload = (req: Request, res: Response, next: NextFunction) => {
  const webhookSchema = z.object({
    ticker: z.string().regex(/^[A-Z]{2,10}USDT?$/),
    action: z.enum(['buy', 'sell']),
    price: z.union([z.string(), z.number()]).transform(String),
    timeframe: z.string().optional(),
    strategy: z.string().max(100).optional(),
    comment: z.string().max(500).optional(),
    secret: z.string().min(1).optional(),
  });

  try {
    webhookSchema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      message: 'Invalid webhook payload',
      code: 'INVALID_WEBHOOK_PAYLOAD',
      details: error instanceof z.ZodError ? error.errors : 'Webhook validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Notification settings validation
export const validateNotificationSettings = (req: Request, res: Response, next: NextFunction) => {
  const notificationSchema = z.object({
    emailSignalAlerts: z.boolean().optional(),
    smsSignalAlerts: z.boolean().optional(),
    pushSignalAlerts: z.boolean().optional(),
    telegramSignalAlerts: z.boolean().optional(),
    emailFrequency: z.enum(['realtime', 'daily', 'weekly', 'never']).optional(),
    phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
    telegramChatId: z.string().max(50).optional(),
    quietHoursStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    quietHoursEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  });

  try {
    notificationSchema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      message: 'Invalid notification settings',
      code: 'INVALID_NOTIFICATION_SETTINGS',
      details: error instanceof z.ZodError ? error.errors : 'Notification validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Admin operation validation
export const validateAdminOperation = (req: Request, res: Response, next: NextFunction) => {
  const adminSchema = z.object({
    operation: z.enum(['create', 'update', 'delete', 'disable', 'enable']),
    target: z.enum(['user', 'ticker', 'signal', 'webhook', 'subscription']),
    targetId: z.string().uuid().optional(),
    reason: z.string().min(10).max(500),
    metadata: z.record(z.any()).optional(),
  });

  try {
    if (req.body.operation || req.body.target) {
      adminSchema.parse(req.body);
    }
    next();
  } catch (error) {
    return res.status(400).json({
      message: 'Invalid admin operation',
      code: 'INVALID_ADMIN_OPERATION',
      details: error instanceof z.ZodError ? error.errors : 'Admin validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

// File upload validation
export const validateFileUpload = (allowedTypes: string[], maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next();
    }

    // Check file type
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        message: 'Invalid file type',
        code: 'INVALID_FILE_TYPE',
        allowedTypes,
        receivedType: req.file.mimetype,
        timestamp: new Date().toISOString()
      });
    }

    // Check file size
    if (req.file.size > maxSize) {
      return res.status(400).json({
        message: 'File too large',
        code: 'FILE_TOO_LARGE',
        maxSize,
        receivedSize: req.file.size,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

// API key format validation
export const validateApiKeyFormat = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (apiKey) {
    const apiKeyPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (!apiKeyPattern.test(apiKey)) {
      return res.status(401).json({
        message: 'Invalid API key format',
        code: 'INVALID_API_KEY_FORMAT',
        timestamp: new Date().toISOString()
      });
    }
  }

  next();
};

// UUID parameter validation
export const validateUuidParams = (paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    for (const paramName of paramNames) {
      const value = req.params[paramName];
      if (value && !uuidPattern.test(value)) {
        return res.status(400).json({
          message: `Invalid ${paramName} format`,
          code: 'INVALID_UUID_FORMAT',
          parameter: paramName,
          value: value,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    next();
  };
};

// Pagination validation
export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const paginationSchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 1000).optional(),
    sortBy: z.string().max(50).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  });

  try {
    paginationSchema.parse(req.query);
    next();
  } catch (error) {
    return res.status(400).json({
      message: 'Invalid pagination parameters',
      code: 'INVALID_PAGINATION',
      details: error instanceof z.ZodError ? error.errors : 'Pagination validation failed',
      timestamp: new Date().toISOString()
    });
  }
};