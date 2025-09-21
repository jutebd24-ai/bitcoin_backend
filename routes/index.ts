/**
 * Main Router Entry Point
 * Consolidates all route modules in a clean, organized way
 */
import type { Express } from "express";
import { createServer, type Server } from "http";

// Import route modules
import { authRoutes } from './auth.js';
import { userRoutes } from './user.js';
import { marketRoutes } from './market.js';
import { signalRoutes } from './signals.js';
import { adminRoutes } from './admin.js';
import { paymentRoutes } from './payments.js';
import { webhookRoutes } from './webhooks.js';
import { websocketServer } from './websocket.js';
import { setupGoogleAuth } from '../replitAuth.js';

/**
 * Register all application routes
 * @param app Express application instance
 * @returns HTTP server with WebSocket support
 */
export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  const wss = websocketServer(httpServer);
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Initialize Google OAuth for users
  await setupGoogleAuth(app);

  // Register route modules
  authRoutes(app, wss);
  userRoutes(app, wss);
  marketRoutes(app, wss);
  signalRoutes(app, wss);
  adminRoutes(app, wss);
  paymentRoutes(app, wss);
  webhookRoutes(app, wss);

  return httpServer;
}