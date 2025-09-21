import dotenv from 'dotenv';
dotenv.config(); // This will load the .env file


import { createServer } from "http";
import { Server } from "socket.io";
import express from "express";
import { registerRoutes } from "./routes.js";
import { initializeTickers } from "./init-tickers.js";
import { config } from "./config.js";
import helmet from "helmet";
import cors from "cors";
import { smsService } from "./services/smsService.js";
import { telegramService } from "./services/telegramService.js";
import rateLimit from "express-rate-limit";

const app = express();
const port = config.port;

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

// CORS Configuration using centralized config
const corsOrigins = config.corsOrigin 
  ? config.corsOrigin.split(',').map(origin => origin.trim())
  : config.nodeEnv === 'production' 
    ? ['https://your-frontend-domain.vercel.app'] // Replace with actual frontend domain
    : ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:5173', 'http://localhost:8000'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api', limiter);

// Security middleware (removed for build compatibility)

// Initialize services
if (process.env.NODE_ENV === 'development') {
  console.log('SMS Service not configured - missing Twilio credentials');
  console.log('Telegram Service not configured - missing bot token');
}

const server = createServer(app);

// Initialize and start services
async function initializeServices() {
  try {
    await initializeTickers();
    console.log('Cryptocurrency tickers initialized successfully');
  } catch (error) {
    console.error('Failed to initialize tickers:', error);
  }

  // Start notification processor (removed for build compatibility)
}

// Register API routes
const wsServer = await registerRoutes(app);

// Start services
await initializeServices();

server.listen(port, "0.0.0.0", () => {
  console.log(`Backend API server running on port ${port}`);
});