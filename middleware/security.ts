import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Security middleware functions

// Admin role middleware
export const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      message: 'Admin access required',
      code: 'ADMIN_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// Subscription tier middleware
export const requireSubscription = (minimumTier: string) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    const tierHierarchy = ['free', 'basic', 'premium', 'pro'];
    const userTierIndex = tierHierarchy.indexOf(req.user.subscriptionTier);
    const requiredTierIndex = tierHierarchy.indexOf(minimumTier);

    if (userTierIndex < requiredTierIndex) {
      return res.status(403).json({
        message: `${minimumTier} subscription required`,
        code: 'SUBSCRIPTION_REQUIRED',
        requiredTier: minimumTier,
        currentTier: req.user.subscriptionTier,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] as string;
    const sessionToken = req.headers['x-session-token'] as string;
    
    if (!token || !sessionToken || token !== sessionToken) {
      return res.status(403).json({
        message: 'CSRF token validation failed',
        code: 'CSRF_VALIDATION_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  }
  next();
};

// IP whitelist middleware (for admin endpoints)
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    
    if (!allowedIPs.includes(clientIP as string)) {
      return res.status(403).json({
        message: 'IP address not whitelisted',
        code: 'IP_NOT_WHITELISTED',
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

// Request size limit middleware
export const requestSizeLimit = (maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        message: 'Request payload too large',
        code: 'PAYLOAD_TOO_LARGE',
        maxSize,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

// SQL injection detection
export const sqlInjectionDetection = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(UNION.*SELECT|SELECT.*FROM|INSERT.*INTO|UPDATE.*SET|DELETE.*FROM)/i,
    /('|(\\')|('')|(\")|(\\\")|(\"\")|(;)|(\\;)|(\\x27)|(\\x22))/,
    /(OR|AND)\s+1\s*=\s*1/i,
    /(OR|AND)\s+1\s*=\s*2/i
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  const suspicious = [
    ...Object.values(req.query),
    ...Object.values(req.body || {}),
    ...Object.values(req.params)
  ].some(checkValue);

  if (suspicious) {
    console.warn('Potential SQL injection attempt detected:', {
      ip: req.ip,
      url: req.url,
      method: req.method,
      query: req.query,
      body: req.body,
      params: req.params,
      timestamp: new Date().toISOString()
    });

    return res.status(400).json({
      message: 'Invalid request parameters detected',
      code: 'INVALID_PARAMETERS',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// XSS protection middleware
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[\\s]*=[\\s]*[\"\\'][\\s]*javascript:/gi
  ];

  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      const hasSuspiciousContent = xssPatterns.some(pattern => pattern.test(value));
      if (hasSuspiciousContent) {
        return value.replace(/<[^>]*>/g, ''); // Strip HTML tags
      }
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  // Sanitize request data
  req.query = sanitizeValue(req.query);
  req.body = sanitizeValue(req.body);
  req.params = sanitizeValue(req.params);

  next();
};

// API key validation
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      message: 'API key required',
      code: 'API_KEY_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }

  // Validate API key format (should be UUID or secure string)
  const apiKeyPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (!apiKeyPattern.test(apiKey)) {
    return res.status(401).json({
      message: 'Invalid API key format',
      code: 'INVALID_API_KEY_FORMAT',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// Request logging for security audit
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const securityLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    referer: req.headers.referer,
    authHeader: !!req.headers.authorization,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    origin: req.headers.origin
  };

  // Log suspicious activity
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /\/etc\/passwd/,
    /\/proc\/self\/environ/,
    /admin|administrator|root/i,
    /script|alert|eval|expression/i
  ];

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.url) || 
    pattern.test(JSON.stringify(req.query)) ||
    pattern.test(JSON.stringify(req.body))
  );

  if (isSuspicious) {
    console.warn('Suspicious activity detected:', securityLog);
  }

  next();
};