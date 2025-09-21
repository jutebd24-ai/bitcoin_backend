import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Basic config for serverless environment
const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || ''
};

// Cache the Express app instance to reduce cold start overhead
let cachedApp: any = null;

// Import a simplified version of routes for serverless
async function createApp() {
  if (cachedApp) {
    return cachedApp;
  }
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameSrc: ["'self'", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "https:"],
        workerSrc: ["'self'", "blob:"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));

  // CORS Configuration
  const corsOrigins = config.corsOrigin 
    ? config.corsOrigin.split(',').map(origin => origin.trim())
    : config.nodeEnv === 'production' 
      ? ['*'] // Allow all origins in production - configure CORS_ORIGIN env var for security
      : ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:5173', 'http://localhost:8000'];

  app.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Rate limiting (more conservative for serverless)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Lower limit for serverless
    message: 'Too many requests from this IP, please try again later.'
  });

  app.use('/api', limiter);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Basic health check
  app.get('/', (req, res) => {
    res.json({ 
      status: 'OK', 
      message: 'Crypto Strategy Backend API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  });

  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Import and register routes (without WebSocket components)
  try {
    // Import routes without WebSocket functionality for serverless
    const { registerApiRoutes } = await import("../src/serverless-routes");
    await registerApiRoutes(app);
  } catch (error) {
    console.warn('Could not load serverless routes, using basic routes');
    
    // Fallback basic API routes
    app.get('/api/tickers', (req, res) => {
      res.json({ message: 'Tickers endpoint - implement in serverless-routes.ts' });
    });

    app.get('/api/signals', (req, res) => {
      res.json({ message: 'Signals endpoint - implement in serverless-routes.ts' });
    });
  }

  // Error handling middleware
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('API Error:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      message: 'Route not found',
      path: req.originalUrl
    });
  });

  // Cache the app instance for subsequent requests
  cachedApp = app;
  return app;
}

// Export for Vercel
export default async function handler(req: any, res: any) {
  const app = await createApp();
  return app(req, res);
}

// Export createApp for testing
export { createApp };

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  createApp().then(app => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}