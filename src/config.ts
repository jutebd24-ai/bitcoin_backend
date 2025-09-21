// Backend Configuration - Environment Variables Management
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export const config = {
  // Server Configuration
  port: Number(process.env.PORT) || 9000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL,
  
  // Authentication
  jwtSecret: process.env.JWT_SECRET,
  sessionSecret: process.env.SESSION_SECRET,
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN,
  
  // TradingView Webhook
  tradingViewWebhookSecret: process.env.TRADINGVIEW_WEBHOOK_SECRET || 'default_secret',
  
  // External APIs
  binanceApiKey: process.env.BINANCE_API_KEY,
  binanceSecretKey: process.env.BINANCE_SECRET_KEY,
  
  // Notification Services
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
  
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
  
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL,
  },
  
  // Payment Processing
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
  },
  
  // AI Features
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  
  // Supabase (Optional)
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  
  // Health Check
  healthCheckPath: process.env.HEALTH_CHECK_PATH || '/api/tickers',
};

// Environment validation
export const validateConfig = () => {
  const missing = [];
  
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!config.jwtSecret) missing.push('JWT_SECRET');
  if (!config.sessionSecret) missing.push('SESSION_SECRET');
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    console.error('Please check your .env file configuration');
    
    // In development mode, allow server to start with warnings instead of exiting
    if (config.nodeEnv === 'development') {
      console.warn('⚠️  Starting in development mode with missing environment variables - some features will be disabled');
    } else {
      process.exit(1);
    }
  }
  
  console.log('✅ Backend Configuration Loaded:', {
    port: config.port,
    environment: config.nodeEnv,
    databaseConnected: !!config.databaseUrl,
    authConfigured: !!config.jwtSecret,
    corsOrigin: config.corsOrigin || 'default',
    notificationServices: {
      twilio: !!config.twilio.accountSid,
      telegram: !!config.telegram.botToken,
      sendgrid: !!config.sendgrid.apiKey,
    },
    externalAPIs: {
      binance: !!config.binanceApiKey,
      openai: !!config.openai.apiKey,
      stripe: !!config.stripe.secretKey,
    }
  });
};

// Initialize validation
validateConfig();