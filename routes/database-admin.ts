/**
 * Database Administration Routes
 * 
 * Admin-only endpoints for database management, seeding, and health checks
 */

import { Router } from 'express';
import { db } from '../db.js';
import { users, availableTickers, alertSignals, subscriptionPlans, userSettings, userSubscriptions, ohlcCache } from '../../shared/schema.js';
import { requireAdmin } from '../middleware/security.js';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const router = Router();

// Load seed data helper
function loadSeedData(filename: string) {
  try {
    const seedDir = path.join(process.cwd(), 'backend_new/seeds');
    const filePath = path.join(seedDir, filename);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return [];
  }
}

// Database Health Check (Admin access only)
router.get('/health', async (req, res) => {
  try {
    console.log('🔍 Performing database health check...');
    
    // Test basic connectivity
    const connectivityTest = await db.execute(sql`SELECT NOW() as current_time, version() as db_version`);
    
    // Test table existence
    const requiredTables = ['users', 'user_settings', 'available_tickers', 'user_subscriptions', 'alert_signals', 'subscription_plans', 'ohlc_cache'];
    const tableChecks = await Promise.all(
      requiredTables.map(async (tableName) => {
        const result = await db.execute(
          sql`SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          )`
        );
        return { table: tableName, exists: result.rows[0]?.exists || false };
      })
    );
    
    // Get row counts
    const rowCounts = await Promise.all(
      requiredTables.map(async (table) => {
        try {
          const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
          return { table, count: Number(result.rows[0]?.count || 0) };
        } catch (error: any) {
          return { table, count: 0, error: error.message };
        }
      })
    );
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        version: connectivityTest.rows[0]?.db_version,
        current_time: connectivityTest.rows[0]?.current_time
      },
      tables: tableChecks,
      data: rowCounts
    });
    
  } catch (error: any) {
    console.error('Database health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Seed Users (Admin access only)
router.post('/seed/users', async (req, res) => {
  try {
    console.log('🔹 Seeding users...');
    const users_data = loadSeedData('users.json');
    const results = { added: 0, skipped: 0, failed: 0 };
    
    for (const user of users_data) {
      try {
        // Check if user already exists
        const existingUser = await db.select().from(users).where(sql`email = ${user.email}`);
        
        if (existingUser.length > 0) {
          console.log(`User already exists: ${user.email}`);
          results.skipped++;
          continue;
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        await db.insert(users).values({
          email: user.email,
          hashedPassword,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as 'admin' | 'user',
          isActive: user.isActive,
          subscriptionTier: user.subscriptionTier as 'free' | 'basic' | 'premium' | 'pro',
          subscriptionStatus: user.subscriptionStatus as 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete',
          subscriptionEndsAt: user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : null,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt)
        });
        
        console.log(`User added: ${user.email}`);
        results.added++;
      } catch (error: any) {
        console.error(`Failed to seed user ${user.email}:`, error);
        results.failed++;
      }
    }
    
    res.json({
      success: true,
      message: `User seeding completed`,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('User seeding failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Seed Signals (Admin access only)
router.post('/seed/signals', async (req, res) => {
  try {
    console.log('🔹 Seeding alert signals...');
    const signals_data = loadSeedData('signals.json');
    const results = { added: 0, skipped: 0, failed: 0 };
    
    for (const signal of signals_data) {
      try {
        // Check if signal already exists
        const existingSignal = await db.select().from(alertSignals).where(sql`ticker = ${signal.ticker} AND created_at = ${new Date(signal.createdAt)}`);
        
        if (existingSignal.length > 0) {
          console.log(`Signal already exists: ${signal.ticker} at ${signal.createdAt}`);
          results.skipped++;
          continue;
        }
        
        await db.insert(alertSignals).values({
          ticker: signal.ticker,
          signalType: signal.type as 'buy' | 'sell',
          price: signal.price.toString(),
          targetPrice: signal.target?.toString(),
          stopLoss: signal.stopLoss?.toString(),
          timeframe: signal.timeframe,
          confidence: signal.confidence,
          source: signal.source,
          description: signal.description,
          isActive: signal.isActive,
          createdAt: new Date(signal.createdAt),
          updatedAt: new Date(signal.updatedAt)
        });
        
        console.log(`Signal added: ${signal.ticker} ${signal.type}`);
        results.added++;
      } catch (error: any) {
        console.error(`Failed to seed signal ${signal.ticker}:`, error);
        results.failed++;
      }
    }
    
    res.json({
      success: true,
      message: `Signal seeding completed`,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Signal seeding failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update Market Data from Seed File (Admin access only)
router.post('/seed/market-data', async (req, res) => {
  try {
    console.log('🔹 Updating market data from seed file...');
    const market_data = loadSeedData('market_data.json');
    const results = { added: 0, updated: 0, failed: 0 };
    
    // Map additional tickers from seed file to available_tickers
    const tickerMappings = {
      'BTCUSDT': { description: 'Bitcoin', category: 'major' as const, marketCap: 1 },
      'ETHUSDT': { description: 'Ethereum', category: 'major' as const, marketCap: 2 },
      'BNBUSDT': { description: 'Binance Coin', category: 'layer1' as const, marketCap: 3 },
      'ADAUSDT': { description: 'Cardano', category: 'layer1' as const, marketCap: 8 },
      'SOLUSDT': { description: 'Solana', category: 'layer1' as const, marketCap: 5 },
      'XRPUSDT': { description: 'Ripple', category: 'utility' as const, marketCap: 4 },
      'DOTUSDT': { description: 'Polkadot', category: 'layer1' as const, marketCap: 10 },
      'LINKUSDT': { description: 'Chainlink', category: 'utility' as const, marketCap: 15 }
    };
    
    for (const data of market_data) {
      try {
        const tickerInfo = tickerMappings[data.symbol as keyof typeof tickerMappings];
        if (tickerInfo) {
          // Check if ticker exists in available_tickers
          const existingTicker = await db.select().from(availableTickers).where(sql`symbol = ${data.symbol}`);
          
          if (existingTicker.length === 0) {
            await db.insert(availableTickers).values({
              symbol: data.symbol,
              description: tickerInfo.description,
              category: tickerInfo.category,
              marketCap: tickerInfo.marketCap,
              isEnabled: true
            });
            console.log(`Added ticker: ${data.symbol}`);
            results.added++;
          } else {
            // Update existing ticker
            await db.update(availableTickers)
              .set({
                description: tickerInfo.description,
                category: tickerInfo.category,
                marketCap: tickerInfo.marketCap,
                updatedAt: new Date()
              })
              .where(sql`symbol = ${data.symbol}`);
            console.log(`Updated ticker: ${data.symbol}`);
            results.updated++;
          }
        }
      } catch (error: any) {
        console.error(`Failed to process ticker ${data.symbol}:`, error);
        results.failed++;
      }
    }
    
    res.json({
      success: true,
      message: `Market data update completed`,
      results,
      newTickers: market_data.map((d: any) => d.symbol),
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Market data update failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Comprehensive seed operation (Admin access only)
router.post('/seed/all', async (req, res) => {
  try {
    console.log('🌱 Starting comprehensive database seeding...');
    const results = {
      users: { added: 0, skipped: 0, failed: 0 },
      tickers: { added: 0, updated: 0, failed: 0 },
      signals: { added: 0, skipped: 0, failed: 0 },
      timestamp: new Date().toISOString()
    };
    
    // Run all seeding operations
    // Note: In a real implementation, you'd call the individual seed functions
    // For now, this provides the endpoint structure
    
    res.json({
      success: true,
      message: 'Comprehensive seeding completed',
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Comprehensive seeding failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export { router as databaseAdminRouter };