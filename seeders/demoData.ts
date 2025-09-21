/**
 * Demo Data Seeder
 * Automatically populates database with demo data for public showcasing
 */
import { storage } from "../storage.js";
import bcrypt from "bcryptjs";

// Demo Users with different subscription tiers
const DEMO_USERS = [
  {
    email: "demo@free.com",
    password: "demo123",
    firstName: "Free",
    lastName: "User",
    subscriptionTier: "free",
    subscriptionStatus: "active",
    role: "user"
  },
  {
    email: "demo@premium.com", 
    password: "demo123",
    firstName: "Premium",
    lastName: "User",
    subscriptionTier: "premium",
    subscriptionStatus: "active",
    role: "user"
  },
  {
    email: "demo@pro.com",
    password: "demo123", 
    firstName: "Pro",
    lastName: "User",
    subscriptionTier: "pro",
    subscriptionStatus: "active",
    role: "user"
  },
  {
    email: "admin@demo.com",
    password: "admin123",
    firstName: "Admin",
    lastName: "Demo",
    subscriptionTier: "pro",
    subscriptionStatus: "active",
    role: "admin"
  }
];

// Demo Trading Signals
const DEMO_SIGNALS = [
  {
    ticker: "BTCUSDT",
    type: "buy" as const,
    price: "119500",
    confidence: 85,
    timeframe: "1H",
    timestamp: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
  },
  {
    ticker: "ETHUSDT", 
    type: "sell" as const,
    price: "4180",
    confidence: 92,
    timeframe: "4H", 
    timestamp: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
  },
  {
    ticker: "SOLUSDT",
    type: "buy" as const,
    price: "245",
    confidence: 78,
    timeframe: "1D",
    timestamp: new Date(Date.now() - 32 * 60 * 1000) // 32 minutes ago  
  },
  {
    ticker: "ADAUSDT",
    type: "sell" as const,
    price: "1.25",
    confidence: 88,
    timeframe: "1H",
    timestamp: new Date(Date.now() - 45 * 60 * 1000) // 45 minutes ago
  },
  {
    ticker: "DOTUSDT",
    type: "buy" as const, 
    price: "12.5",
    confidence: 73,
    timeframe: "4H",
    timestamp: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
  }
];

// Demo OHLC Data Generator
function generateDemoOHLC(symbol: string, days: number = 30) {
  const data = [];
  const basePrice = getBasePriceForSymbol(symbol);
  let currentPrice = basePrice;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    
    // Generate realistic price movement
    const volatility = Math.random() * 0.08 - 0.04; // -4% to +4% daily change
    const open = currentPrice;
    const close = open * (1 + volatility);
    const high = Math.max(open, close) * (1 + Math.random() * 0.03);
    const low = Math.min(open, close) * (1 - Math.random() * 0.03);
    const volume = Math.random() * 1000000 + 100000; // Random volume
    
    data.push({
      tickerSymbol: symbol,
      interval: "1d",
      time: date,
      open: parseFloat(open.toFixed(2)).toString(),
      high: parseFloat(high.toFixed(2)).toString(), 
      low: parseFloat(low.toFixed(2)).toString(),
      close: parseFloat(close.toFixed(2)).toString(),
      volume: parseFloat(volume.toFixed(2)).toString()
    });
    
    currentPrice = close;
  }
  
  return data;
}

function getBasePriceForSymbol(symbol: string): number {
  const prices: Record<string, number> = {
    "BTCUSDT": 119000,
    "ETHUSDT": 4100,
    "SOLUSDT": 240,
    "ADAUSDT": 1.2,
    "DOTUSDT": 12.0,
    "MATICUSDT": 0.95,
    "AVAXUSDT": 85,
    "ATOMUSDT": 18.5,
    "LINKUSDT": 22,
    "UNIUSDT": 12.5
  };
  return prices[symbol] || 50;
}

// Demo Heatmap Data
const DEMO_HEATMAPS = [
  {
    ticker: "BTCUSDT",
    week: new Date(),
    sma200w: "119000.00",
    deviationPercent: "15.50"
  },
  {
    ticker: "ETHUSDT", 
    week: new Date(),
    sma200w: "4100.00",
    deviationPercent: "-8.25"
  },
  {
    ticker: "SOLUSDT",
    week: new Date(),
    sma200w: "240.00", 
    deviationPercent: "22.75"
  }
];

/**
 * Seed database with demo data
 */
export async function seedDemoData() {
  console.log("🌱 Starting demo data seeding...");
  
  try {
    // 1. Create demo users
    console.log("👥 Creating demo users...");
    for (const userData of DEMO_USERS) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      try {
        await storage.createUser({
          email: userData.email,
          hashedPassword: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          subscriptionTier: userData.subscriptionTier as any,
          subscriptionStatus: userData.subscriptionStatus as any,
          role: userData.role as any,
          createdAt: new Date(),
          lastLoginAt: new Date()
        });
        console.log(`  ✅ Created user: ${userData.email}`);
      } catch (error: any) {
        if (error.message?.includes("already exists")) {
          console.log(`  ⚠️ User already exists: ${userData.email}`);
        } else {
          console.error(`  ❌ Failed to create user ${userData.email}:`, error);
        }
      }
    }
    
    // 2. Create demo signals  
    console.log("⚡ Creating demo trading signals...");
    for (const signal of DEMO_SIGNALS) {
      try {
        await storage.createSignal({
          ticker: signal.ticker,
          signalType: signal.type,
          price: signal.price,
          confidence: signal.confidence,
          timeframe: signal.timeframe,
          timestamp: signal.timestamp,
          source: "TradingView",
          isActive: true
        });
        console.log(`  ✅ Created signal: ${signal.type} ${signal.ticker} @ $${signal.price}`);
      } catch (error) {
        console.error(`  ❌ Failed to create signal for ${signal.ticker}:`, error);
      }
    }
    
    // 3. Generate demo OHLC data for major pairs
    console.log("📊 Generating demo OHLC data...");
    const majorPairs = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "DOTUSDT"];
    
    for (const pair of majorPairs) {
      try {
        const ohlcData = generateDemoOHLC(pair, 90); // 90 days of data
        
        for (const candle of ohlcData) {
          await storage.createOhlcData(candle);
        }
        console.log(`  ✅ Generated ${ohlcData.length} OHLC candles for ${pair}`);
      } catch (error) {
        console.error(`  ❌ Failed to create OHLC data for ${pair}:`, error);
      }
    }
    
    // 4. Create demo heatmap data
    console.log("🔥 Creating demo heatmap data...");
    for (const heatmap of DEMO_HEATMAPS) {
      try {
        await storage.createHeatmapData({
          ticker: heatmap.ticker,
          week: heatmap.week,
          sma200w: heatmap.sma200w,
          deviationPercent: heatmap.deviationPercent
        });
        console.log(`  ✅ Created heatmap: ${heatmap.ticker} 200-week analysis`);
      } catch (error) {
        console.error(`  ❌ Failed to create heatmap for ${heatmap.ticker}:`, error);
      }
    }
    
    console.log("🎉 Demo data seeding completed successfully!");
    console.log("\n📱 Demo Login Credentials:");
    console.log("🆓 Free Tier:    demo@free.com    / demo123");
    console.log("⭐ Premium Tier: demo@premium.com / demo123"); 
    console.log("👑 Pro Tier:     demo@pro.com     / demo123");
    console.log("🔑 Admin Access: admin@demo.com   / admin123");
    
    return true;
    
  } catch (error) {
    console.error("❌ Demo data seeding failed:", error);
    return false;
  }
}

/**
 * Check if database needs seeding
 */
export async function shouldSeedDatabase(): Promise<boolean> {
  try {
    // Check if any demo users exist
    const demoUser = await storage.getUserByEmail("demo@free.com");
    return !demoUser; // Seed if no demo user found
  } catch (error) {
    console.log("Database check failed, will attempt seeding:", error);
    return true; // Seed on any error to ensure data exists
  }
}