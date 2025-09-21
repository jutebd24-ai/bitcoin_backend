import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById } from '../storage';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    subscriptionTier: string;
    subscriptionStatus: string;
  };
}

// Subscription tier hierarchy
const SUBSCRIPTION_HIERARCHY = {
  'free': 0,
  'basic': 1,
  'premium': 2,
  'pro': 3,
  'admin': 4
};

// Feature to minimum required tier mapping - NO FREE ACCESS
const FEATURE_REQUIREMENTS = {
  // Basic tier features - REQUIRE PAID SUBSCRIPTION
  'dashboard': 'basic',
  'alerts': 'basic',
  'heatmap': 'basic',
  'basicCharts': 'basic',
  'basicSignals': 'basic',
  'members': 'basic',
  
  // Premium tier features
  'advancedAlerts': 'premium',
  'historicalData': 'premium',
  'forecasting': 'premium',
  'cycleAnalysis': 'premium',
  'liveStreaming': 'premium',
  
  // Pro tier features
  'tradingPlayground': 'pro',
  'advancedAnalytics': 'pro',
  'portfolioManagement': 'pro',
  'apiAccess': 'pro',
  
  // Admin features
  'adminDashboard': 'admin',
  'userManagement': 'admin',
  'systemConfiguration': 'admin'
};

/**
 * Middleware to authenticate and extract user information from JWT token
 */
export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await findUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid authentication token',
        code: 'INVALID_USER'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      subscriptionTier: user.subscriptionTier || 'free',
      subscriptionStatus: user.subscriptionStatus || 'inactive'
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ 
      error: 'Invalid authentication token',
      code: 'TOKEN_INVALID'
    });
  }
};

/**
 * Middleware to require a minimum subscription tier
 */
export const requireSubscription = (minTier: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    // Admin users bypass subscription checks
    if (user.role === 'admin' || user.role === 'superuser') {
      return next();
    }

    const userTierLevel = SUBSCRIPTION_HIERARCHY[user.subscriptionTier as keyof typeof SUBSCRIPTION_HIERARCHY] || 0;
    const requiredTierLevel = SUBSCRIPTION_HIERARCHY[minTier as keyof typeof SUBSCRIPTION_HIERARCHY] || 0;

    // Check if user has active subscription for paid tiers
    if (requiredTierLevel > 0 && user.subscriptionStatus !== 'active') {
      return res.status(403).json({
        error: 'Active subscription required',
        code: 'SUBSCRIPTION_INACTIVE',
        requiredTier: minTier,
        currentTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus
      });
    }

    // Check subscription tier level
    if (userTierLevel < requiredTierLevel) {
      return res.status(403).json({
        error: 'Insufficient subscription tier',
        code: 'SUBSCRIPTION_INSUFFICIENT',
        requiredTier: minTier,
        currentTier: user.subscriptionTier,
        message: `This feature requires ${minTier} subscription or higher`
      });
    }

    next();
  };
};

/**
 * Middleware to require specific feature access
 */
export const requireFeature = (featureName: string) => {
  const requiredTier = FEATURE_REQUIREMENTS[featureName];
  
  if (!requiredTier) {
    console.warn(`Unknown feature: ${featureName}. Allowing access.`);
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => next();
  }

  return requireSubscription(requiredTier);
};

/**
 * Middleware to require admin access
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'NOT_AUTHENTICATED'
    });
  }

  if (user.role !== 'admin' && user.role !== 'superuser') {
    return res.status(403).json({
      error: 'Administrator access required',
      code: 'ADMIN_REQUIRED',
      currentRole: user.role
    });
  }

  next();
};

/**
 * Middleware to require payment before accessing any features
 */
export const requirePayment = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'NOT_AUTHENTICATED'
    });
  }

  // Admin users bypass payment checks
  if (user.role === 'admin' || user.role === 'superuser') {
    return next();
  }

  // Check if user has an active paid subscription
  const hasPaidSubscription = user.subscriptionTier !== 'free' && user.subscriptionStatus === 'active';
  
  if (!hasPaidSubscription) {
    return res.status(402).json({
      error: 'Payment required',
      code: 'PAYMENT_REQUIRED',
      message: 'A paid subscription is required to access this feature',
      currentTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus
    });
  }

  next();
};

export default {
  authenticateToken,
  requireSubscription,
  requireFeature,
  requireAdmin,
  requirePayment,
  FEATURE_REQUIREMENTS,
  SUBSCRIPTION_HIERARCHY
};