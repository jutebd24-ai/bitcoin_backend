import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import express from "express";
import { registerRoutes } from "./routes/index.js";
import { initializeTickers } from "./init-tickers.js";
import { scheduledProcessor } from "./services/scheduledProcessor.js";
import config from "./config.js";
import { setupVite, log } from "./vite.js";
import helmet from "helmet";
import cors from "cors";
import { eq } from "drizzle-orm";
import { smsService } from "./services/smsService.js";
import { telegramService } from "./services/telegramService.js";
import rateLimit from "express-rate-limit";
import { requireAdmin, requireSubscription } from "./middleware/security.js";
import { encryptData, decryptData } from "./middleware/encryption.js";
import { validateUserData, validateTradingSignal, validateWebhookPayload } from "./middleware/dataValidation.js";

const app = express();
const port = config.PORT;

// Disable helmet in development to avoid CSP issues
if (config.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "http://localhost:5000", "ws://localhost:5000", "https:", "wss:"],
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
} else {
  // Development mode - minimal security for easier debugging
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
  }));
}

// CORS Configuration - Allow all origins in development
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}));

// Trust proxy for Replit environment
app.set('trust proxy', true);

// Rate limiting - configured for real-time trading dashboard
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1000, // limit each IP to 1000 requests per 5 minutes (supports real-time updates)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },
  skip: (req) => {
    // Skip rate limiting for market data and signals APIs in development
    if (config.NODE_ENV === 'development' && 
        (req.path.includes('/api/market/') || req.path.includes('/api/signals/'))) {
      return true;
    }
    return false;
  }
});

app.use('/api', limiter);

// Security middleware (applied per route as needed)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize services
if (config.NODE_ENV === 'development') {
  console.log('SMS Service not configured - missing Twilio credentials');
  console.log('Telegram Service not configured - missing bot token');
}

// Initialize and start services
async function initializeServices() {
  try {
    // Initialize database connection first
    const { initializeDatabase } = await import('./storage.js');
    initializeDatabase();
    
    await initializeTickers();
    console.log('Cryptocurrency tickers initialized successfully');
    
    // Auto-seed demo data for public showcase
    const { seedDemoData, shouldSeedDatabase } = await import('./seeders/demoData.js');
    
    if (await shouldSeedDatabase()) {
      console.log('🎯 Database appears empty - auto-seeding with demo data for public showcase...');
      await seedDemoData();
    } else {
      console.log('✅ Database already contains demo data');
    }
    
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }

  // Notification processor starts automatically via scheduledProcessor import
}

// Initialize and start application
(async () => {
  try {
    // Register API routes and get HTTP server with WebSocket support
    const httpServer = await registerRoutes(app);

    // Start services
    await initializeServices();

    // Setup Vite for development (serving frontend + backend together)
    if (config.NODE_ENV === 'development') {
      await setupVite(app, httpServer);
    }

    httpServer.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();