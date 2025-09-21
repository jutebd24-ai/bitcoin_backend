/**
 * Authentication Middleware
 * JWT token validation and user authentication
 */
import jwt from "jsonwebtoken";
import { storage } from "../storage.js";

import config from "../config.js";

// JWT Configuration  
const JWT_SECRET = config.JWT_SECRET;

/**
 * Verify JWT token
 */
function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Authentication middleware - requires valid JWT token
 */
export const requireAuth = async (req: any, res: any, next: any) => {
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
    
    // Get user from database
    let user;
    try {
      user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(401).json({ 
          message: 'User not found in database',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
    } catch (storageError) {
      console.error('Database error fetching user:', storageError);
      return res.status(500).json({ 
        message: 'Database connection error',
        code: 'DATABASE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
    
    // Attach user to request object
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed',
      code: 'AUTH_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Admin authentication middleware - requires admin role
 */
export const requireAdmin = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'superuser') {
    return res.status(403).json({ 
      message: 'Admin access required',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  next();
};

/**
 * Subscription middleware - requires active subscription
 */
export const requireSubscription = (allowedTiers: string[] = ['basic', 'premium', 'professional']) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Admin users always have access
    if (req.user.role === 'admin' || req.user.role === 'superuser') {
      return next();
    }

    const userTier = req.user.subscriptionTier;
    const isSubscriptionActive = req.user.subscriptionStatus === 'active';

    if (!isSubscriptionActive) {
      return res.status(402).json({ 
        message: 'Active subscription required',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }

    if (!allowedTiers.includes(userTier)) {
      return res.status(403).json({ 
        message: 'Higher subscription tier required',
        code: 'TIER_UPGRADE_REQUIRED',
        requiredTiers: allowedTiers
      });
    }

    next();
  };
};