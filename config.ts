/**
 * Server Configuration
 * Centralized configuration management
 */

// JWT Configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-change-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Server Configuration
export const PORT = parseInt(process.env.PORT || '5000');
export const NODE_ENV = process.env.NODE_ENV || 'development';

// Database Configuration
export const DATABASE_URL = process.env.DATABASE_URL;

// External API Configuration
export const BINANCE_API_URL = 'https://api.binance.com/api/v3';
export const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

// Cache Configuration
export const CACHE_TTL = {
  PRICE: 30 * 1000,        // 30 seconds
  OHLC: 60 * 1000,         // 1 minute
  USER_DATA: 5 * 60 * 1000, // 5 minutes
  MARKET_DATA: 15 * 1000    // 15 seconds
};

// Rate Limiting
export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,          // requests per window
  API_COOLDOWN: 10 * 1000     // 10 seconds between external API calls
};

// Supported Trading Pairs
export const SUPPORTED_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 
  'ADAUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT', 'ATOMUSDT',
  'NEARUSDT', 'LINKUSDT', 'UNIUSDT', 'AAVEUSDT', 'CRVUSDT'
];

// WebSocket Configuration
export const WS_CONFIG = {
  PATH: '/ws',
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  MAX_CLIENTS: 1000
};

// Subscription Plans
export const SUBSCRIPTION_PLANS = {
  FREE: 'free',
  BASIC: 'basic',
  PREMIUM: 'premium',
  PROFESSIONAL: 'professional'
};

// Feature Access Control
export const FEATURE_ACCESS = {
  [SUBSCRIPTION_PLANS.FREE]: [
    'basic_market_data',
    'price_alerts'
  ],
  [SUBSCRIPTION_PLANS.BASIC]: [
    'basic_market_data',
    'price_alerts',
    'trading_signals',
    'basic_charts'
  ],
  [SUBSCRIPTION_PLANS.PREMIUM]: [
    'basic_market_data',
    'price_alerts', 
    'trading_signals',
    'basic_charts',
    'advanced_charts',
    'portfolio_tracking',
    'sms_notifications'
  ],
  [SUBSCRIPTION_PLANS.PROFESSIONAL]: [
    'basic_market_data',
    'price_alerts',
    'trading_signals',
    'basic_charts',
    'advanced_charts',
    'portfolio_tracking',
    'sms_notifications',
    'api_access',
    'priority_support',
    'custom_alerts'
  ]
};

export default {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  PORT,
  NODE_ENV,
  DATABASE_URL,
  BINANCE_API_URL,
  COINGECKO_API_URL,
  CACHE_TTL,
  RATE_LIMIT,
  SUPPORTED_SYMBOLS,
  WS_CONFIG,
  SUBSCRIPTION_PLANS,
  FEATURE_ACCESS
};