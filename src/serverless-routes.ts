import type { Express } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult, param } from "express-validator";
import { z } from "zod";

// Simple in-memory storage for serverless (you may want to use database instead)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Basic validation middleware
const validateInput = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation errors',
      errors: errors.array(),
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Serverless-compatible routes (without WebSocket dependencies)
export async function registerApiRoutes(app: Express) {
  
  // Health check endpoints
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString() 
    });
  });

  // Tickers endpoint
  app.get('/api/tickers', async (req, res) => {
    try {
      // This would normally connect to your database
      const tickers = [
        { id: 1, symbol: 'BTCUSD', name: 'Bitcoin', price: 45000 },
        { id: 2, symbol: 'ETHUSD', name: 'Ethereum', price: 3000 },
        { id: 3, symbol: 'ADAUSD', name: 'Cardano', price: 0.5 }
      ];
      
      res.json({
        success: true,
        data: tickers,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching tickers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tickers',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });

  // Signals endpoint
  app.get('/api/signals', async (req, res) => {
    try {
      // This would normally connect to your database
      const signals = [
        {
          id: 1,
          ticker: 'BTCUSD',
          type: 'BUY',
          price: 45000,
          timestamp: new Date().toISOString(),
          confidence: 0.85
        },
        {
          id: 2,
          ticker: 'ETHUSD',
          type: 'SELL',
          price: 3000,
          timestamp: new Date().toISOString(),
          confidence: 0.75
        }
      ];

      res.json({
        success: true,
        data: signals,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching signals:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch signals',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });

  // User authentication routes
  app.post('/api/auth/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    validateInput
  ], async (req, res) => {
    try {
      const { email, password } = req.body;

      // Check if user exists (this would normally check your database)
      // For now, just hash the password and return success
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const token = jwt.sign(
        { email, id: Date.now().toString() },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        message: 'User registered successfully',
        token,
        user: { email, id: Date.now().toString() }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });

  app.post('/api/auth/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    validateInput
  ], async (req, res) => {
    try {
      const { email, password } = req.body;

      // This would normally verify against your database
      // For demo purposes, accept any valid email/password format
      const token = jwt.sign(
        { email, id: Date.now().toString() },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: { email, id: Date.now().toString() }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });

  // Market data endpoint
  app.get('/api/market/overview', async (req, res) => {
    try {
      const overview = {
        totalMarketCap: 2.1e12, // $2.1T
        btcDominance: 42.5,
        ethDominance: 18.2,
        fearGreedIndex: 65,
        trending: ['BTC', 'ETH', 'ADA', 'SOL', 'DOT'],
        gainers: [
          { symbol: 'SOL', change: 12.5 },
          { symbol: 'ADA', change: 8.3 },
          { symbol: 'DOT', change: 6.7 }
        ],
        losers: [
          { symbol: 'DOGE', change: -5.2 },
          { symbol: 'SHIB', change: -3.8 },
          { symbol: 'LTC', change: -2.1 }
        ]
      };

      res.json({
        success: true,
        data: overview,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Market overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch market overview',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });

  // Price data endpoint
  app.get('/api/price/:symbol', [
    param('symbol').isAlpha().withMessage('Invalid symbol format'),
    validateInput
  ], async (req, res) => {
    try {
      const { symbol } = req.params;
      
      // Mock price data - would normally fetch from external API or database
      const priceData = {
        symbol: symbol.toUpperCase(),
        price: Math.random() * 50000 + 1000,
        change24h: (Math.random() - 0.5) * 10,
        volume24h: Math.random() * 1000000000,
        marketCap: Math.random() * 1000000000000,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: priceData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Price data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch price data',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });

  console.log('Serverless API routes registered successfully');
}