import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, and } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import type {
  User,
  InsertUser,
  UserSettings,
  InsertUserSettings,
  AvailableTicker,
  InsertTicker,
  AlertSignal,
  InsertSignal,
  OhlcData,
  InsertOhlc,
  HeatmapData,
  InsertHeatmap,
  CycleData,
  InsertCycle,
  ForecastData,
  InsertForecast,
  AdminLog,
  InsertAdminLog,
  SubscriptionPlan,
  InsertSubscriptionPlan,
  UserSubscription,
  InsertUserSubscription,
  UserTrade,
  InsertUserTrade,
  UserPortfolio,
  InsertUserPortfolio,
  TradingSettings,
  InsertTradingSettings,
  UserAlert,
  InsertUserAlert,
  DashboardLayout,
  InsertDashboardLayout,
  WebhookSecret,
  InsertWebhookSecret,
  Achievement,
  UserAchievement, 
  UserStats,
  InsertAchievement,
  InsertUserAchievement,
  InsertUserStats,
} from "../shared/schema.js";

// Initialize database connection if URL is provided
let db: any = null;
if (process.env.DATABASE_URL) {
  const sql = neon(process.env.DATABASE_URL);
  db = drizzle(sql, { schema });
}

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserLoginTime(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // User settings
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined>;
  
  // Tickers
  getAllTickers(): Promise<AvailableTicker[]>;
  getEnabledTickers(): Promise<AvailableTicker[]>;
  createTicker(ticker: InsertTicker): Promise<AvailableTicker>;
  updateTicker(id: string, updates: Partial<AvailableTicker>): Promise<AvailableTicker | undefined>;
  deleteTicker(id: string): Promise<boolean>;
  
  // Signals
  getSignals(limit?: number): Promise<AlertSignal[]>;
  getSignalsByTicker(ticker: string, limit?: number): Promise<AlertSignal[]>;
  getSignalsByUser(userId: string, limit?: number): Promise<AlertSignal[]>;
  createSignal(signal: InsertSignal): Promise<AlertSignal>;
  
  // OHLC Data
  getOhlcData(ticker: string, interval: string, limit?: number): Promise<OhlcData[]>;
  createOhlcData(data: InsertOhlc): Promise<OhlcData>;
  
  // Heatmap Data
  getHeatmapData(ticker: string): Promise<HeatmapData[]>;
  createHeatmapData(data: InsertHeatmap): Promise<HeatmapData>;
  
  // Cycle Data
  getCycleData(ticker: string): Promise<CycleData[]>;
  createCycleData(data: InsertCycle): Promise<CycleData>;
  
  // Forecast Data
  getForecastData(ticker: string): Promise<ForecastData[]>;
  createForecastData(data: InsertForecast): Promise<ForecastData>;
  
  // Admin logs
  getAdminLogs(limit?: number): Promise<AdminLog[]>;
  createAdminLog(log: InsertAdminLog): Promise<AdminLog>;
  
  // Subscription Plans
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(tier: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  
  // User Subscriptions (Ticker Subscriptions)
  getUserSubscriptions(userId: string): Promise<UserSubscription[]>;
  createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription>;
  deleteUserSubscription(id: string): Promise<boolean>;
  updateUserSubscription(userId: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Trading System
  getUserTrades(userId: string, limit?: number): Promise<UserTrade[]>;
  createTrade(trade: InsertUserTrade): Promise<UserTrade>;
  getUserPortfolio(userId: string): Promise<UserPortfolio[]>;
  updatePortfolio(userId: string, ticker: string, updates: Partial<UserPortfolio>): Promise<UserPortfolio | undefined>;
  getTradingSettings(userId: string): Promise<TradingSettings | undefined>;
  updateTradingSettings(userId: string, settings: Partial<TradingSettings>): Promise<TradingSettings>;
  
  // User Alerts
  getUserAlerts(userId: string): Promise<UserAlert[]>;
  createUserAlert(alert: InsertUserAlert): Promise<UserAlert>;
  updateUserAlert(id: string, updates: Partial<UserAlert>): Promise<UserAlert | undefined>;
  deleteUserAlert(id: string): Promise<boolean>;
  
  // Dashboard Layouts
  getDashboardLayout(userId: string): Promise<DashboardLayout | undefined>;
  saveDashboardLayout(layout: InsertDashboardLayout): Promise<DashboardLayout>;
  updateDashboardLayout(id: string, updates: Partial<DashboardLayout>): Promise<DashboardLayout | undefined>;
  
  // Webhook Secrets
  getWebhookSecrets(): Promise<WebhookSecret[]>;
  getWebhookSecret(name: string): Promise<WebhookSecret | undefined>;
  createWebhookSecret(secret: InsertWebhookSecret): Promise<WebhookSecret>;
  updateWebhookSecret(id: string, updates: Partial<WebhookSecret>): Promise<WebhookSecret | undefined>;
  deleteWebhookSecret(id: string): Promise<boolean>;

  // Achievement system
  getAllAchievements(): Promise<Achievement[]>;
  getAchievement(id: string): Promise<Achievement | undefined>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  updateAchievement(id: string, updates: Partial<Achievement>): Promise<Achievement | undefined>;
  deleteAchievement(id: string): Promise<boolean>;

  // User achievements
  getUserAchievements(userId: string): Promise<UserAchievement[]>;
  getUserAchievement(userId: string, achievementId: string): Promise<UserAchievement | undefined>;
  unlockUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement>;
  updateUserAchievement(id: string, updates: Partial<UserAchievement>): Promise<UserAchievement | undefined>;
  updateUserAchievementProgress(userId: string, achievementId: string, progress: number): Promise<UserAchievement | undefined>;

  // User stats
  getUserStats(userId: string): Promise<UserStats | undefined>;
  createUserStats(userStats: InsertUserStats): Promise<UserStats>;
  updateUserStats(userId: string, updates: Partial<UserStats>): Promise<UserStats | undefined>;
  incrementUserStat(userId: string, statName: keyof UserStats, increment?: number): Promise<UserStats | undefined>;
}

export class MemoryStorage implements IStorage {
  private users: User[] = [
    {
      id: "test-user-123",
      email: "demo@test.com",
      hashedPassword: "$2b$10$AsIHwrKU6nwX.JLjCBHNvOXNcFjdllyiqNKDfcAfwjw49Z.wjd8qC", // password: "demo123"
      role: "user",
      firstName: "Demo",
      lastName: "User",
      isActive: true,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionTier: "free",
      subscriptionStatus: null,
      subscriptionEndsAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "admin-user-456",
      email: "admin@test.com", 
      hashedPassword: "$2b$10$0YvgN82b48qyNveCIHrMwOMtItAXXaL51YolHUIpMJWrHPr6965/m", // password: "admin123"
      role: "admin",
      firstName: "Admin",
      lastName: "User", 
      isActive: true,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionTier: "pro",
      subscriptionStatus: "active",
      subscriptionEndsAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];
  private userSettings: UserSettings[] = [
    {
      id: "settings-test-123",
      userId: "test-user-123",
      notificationEmail: true,
      notificationSms: false,
      notificationPush: true,
      theme: "dark",
      language: "en",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "settings-admin-456",
      userId: "admin-user-456",
      notificationEmail: true,
      notificationSms: true,
      notificationPush: true,
      theme: "dark",
      language: "en",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];
  private tickers: AvailableTicker[] = [
    {
      id: "1",
      symbol: "BTCUSDT",
      description: "Bitcoin / USD Tether",
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "2", 
      symbol: "ETHUSDT",
      description: "Ethereum / USD Tether",
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "3",
      symbol: "ADAUSDT", 
      description: "Cardano / USD Tether",
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  private signals: AlertSignal[] = [
    {
      id: "signal-1",
      userId: "test-user-123",
      ticker: "BTCUSDT",
      signalType: "buy",
      price: "67500.00",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      source: "algorithm",
      note: "Strong upward momentum detected",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: "signal-2",
      userId: "test-user-123",
      ticker: "ETHUSDT",
      signalType: "sell",
      price: "3420.50",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      source: "technical_analysis",
      note: "Resistance level reached",
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
    {
      id: "signal-3",
      userId: "test-user-123",
      ticker: "ADAUSDT",
      signalType: "buy",
      price: "0.4567",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      source: "webhook",
      note: "Oversold conditions detected",
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    }
  ];
  private ohlcData: OhlcData[] = [];
  private heatmapData: HeatmapData[] = [];
  private cycleData: CycleData[] = [];
  private forecastData: ForecastData[] = [];
  private adminLogs: AdminLog[] = [];

  async getUser(id: string): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find(u => u.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email: user.email,
      hashedPassword: user.hashedPassword,
      role: user.role ?? "user",
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      isActive: user.isActive ?? true,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionTier: "free",
      subscriptionStatus: null,
      subscriptionEndsAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(newUser);
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) return undefined;
    this.users[index] = { ...this.users[index], ...updates, updatedAt: new Date() };
    return this.users[index];
  }

  async updateUserLoginTime(id: string): Promise<void> {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users[index] = { 
        ...this.users[index], 
        lastLoginAt: new Date(), 
        updatedAt: new Date() 
      };
    }
  }

  async getAllUsers(): Promise<User[]> {
    return [...this.users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return this.userSettings.find(s => s.userId === userId);
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const newSettings: UserSettings = {
      userId: settings.userId,
      notificationEmail: settings.notificationEmail ?? true,
      notificationSms: settings.notificationSms ?? false,
      notificationPush: settings.notificationPush ?? true,
      theme: settings.theme ?? "dark",
      language: settings.language ?? "en",
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.userSettings.push(newSettings);
    return newSettings;
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const index = this.userSettings.findIndex(s => s.userId === userId);
    if (index === -1) return undefined;
    this.userSettings[index] = { ...this.userSettings[index], ...updates, updatedAt: new Date() };
    return this.userSettings[index];
  }

  async getAllTickers(): Promise<AvailableTicker[]> {
    return [...this.tickers].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  async getEnabledTickers(): Promise<AvailableTicker[]> {
    return this.tickers.filter(t => t.isEnabled).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  async createTicker(ticker: InsertTicker): Promise<AvailableTicker> {
    const newTicker: AvailableTicker = {
      id: Math.random().toString(36).substr(2, 9),
      symbol: ticker.symbol,
      description: ticker.description,
      isEnabled: ticker.isEnabled ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tickers.push(newTicker);
    return newTicker;
  }

  async updateTicker(id: string, updates: Partial<AvailableTicker>): Promise<AvailableTicker | undefined> {
    const index = this.tickers.findIndex(t => t.id === id);
    if (index === -1) return undefined;
    this.tickers[index] = { ...this.tickers[index], ...updates, updatedAt: new Date() };
    return this.tickers[index];
  }

  async deleteTicker(id: string): Promise<boolean> {
    const index = this.tickers.findIndex(t => t.id === id);
    if (index === -1) return false;
    this.tickers.splice(index, 1);
    return true;
  }

  async getSignals(limit = 100): Promise<AlertSignal[]> {
    return [...this.signals]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getSignalsByTicker(ticker: string, limit = 100): Promise<AlertSignal[]> {
    return this.signals
      .filter(s => s.ticker === ticker)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getSignalsByUser(userId: string, limit = 100): Promise<AlertSignal[]> {
    return this.signals
      .filter(s => s.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async createSignal(signal: InsertSignal): Promise<AlertSignal> {
    const newSignal: AlertSignal = {
      id: Math.random().toString(36).substr(2, 9),
      userId: signal.userId ?? null,
      ticker: signal.ticker,
      signalType: signal.signalType,
      price: signal.price,
      timestamp: signal.timestamp,
      source: signal.source ?? "webhook",
      note: signal.note ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.signals.push(newSignal);
    return newSignal;
  }

  async getOhlcData(ticker: string, interval: string, limit = 1000): Promise<OhlcData[]> {
    return this.ohlcData
      .filter(d => d.tickerSymbol === ticker && d.interval === interval)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, limit);
  }

  async createOhlcData(data: InsertOhlc): Promise<OhlcData> {
    const newData: OhlcData = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.ohlcData.push(newData);
    return newData;
  }

  async getHeatmapData(ticker: string): Promise<HeatmapData[]> {
    return this.heatmapData.filter(d => d.ticker === ticker);
  }

  async createHeatmapData(data: InsertHeatmap): Promise<HeatmapData> {
    const newData: HeatmapData = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
    };
    this.heatmapData.push(newData);
    return newData;
  }

  async getCycleData(ticker: string): Promise<CycleData[]> {
    return this.cycleData.filter(d => d.ticker === ticker);
  }

  async createCycleData(data: InsertCycle): Promise<CycleData> {
    const newData: CycleData = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
    };
    this.cycleData.push(newData);
    return newData;
  }

  async getForecastData(ticker: string): Promise<ForecastData[]> {
    return this.forecastData.filter(d => d.ticker === ticker);
  }

  async createForecastData(data: InsertForecast): Promise<ForecastData> {
    const newData: ForecastData = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
    };
    this.forecastData.push(newData);
    return newData;
  }

  async getAdminLogs(limit = 100): Promise<AdminLog[]> {
    return [...this.adminLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async createAdminLog(log: InsertAdminLog): Promise<AdminLog> {
    const newLog: AdminLog = {
      id: Math.random().toString(36).substr(2, 9),
      adminId: log.adminId,
      action: log.action,
      timestamp: log.timestamp ?? new Date(),
      targetTable: log.targetTable ?? null,
      targetId: log.targetId ?? null,
      notes: log.notes ?? null,
      createdAt: new Date(),
    };
    this.adminLogs.push(newLog);
    return newLog;
  }

  // Subscription Plans
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    // Return mock subscription plans for MemoryStorage
    return [
      {
        id: "plan-free",
        name: "Free Plan",
        tier: "free",
        stripePriceId: "price_free",
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: ["Basic signals", "Limited charts", "3 tickers"],
        maxSignals: 10,
        maxTickers: 3,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "plan-basic",
        name: "Basic Plan",
        tier: "basic",
        stripePriceId: "price_basic_monthly",
        monthlyPrice: 2999,
        yearlyPrice: 29999,
        features: ["Advanced signals", "Full charts", "10 tickers", "Email alerts"],
        maxSignals: 100,
        maxTickers: 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  async getSubscriptionPlan(tier: string): Promise<SubscriptionPlan | undefined> {
    const plans = await this.getSubscriptionPlans();
    return plans.find(p => p.tier === tier);
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const newPlan: SubscriptionPlan = {
      id: Math.random().toString(36).substr(2, 9),
      name: plan.name,
      tier: plan.tier,
      stripePriceId: plan.stripePriceId,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice ?? null,
      features: plan.features ?? null,
      maxSignals: plan.maxSignals ?? null,
      maxTickers: plan.maxTickers ?? null,
      isActive: plan.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return newPlan;
  }

  async updateUserSubscription(userId: string, updates: Partial<User>): Promise<User | undefined> {
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1) return undefined;
    
    this.users[userIndex] = { ...this.users[userIndex], ...updates, updatedAt: new Date() };
    return this.users[userIndex];
  }

  // Trading System implementation
  private trades: UserTrade[] = [];
  private portfolios: UserPortfolio[] = [];
  private tradingSettings: TradingSettings[] = [];
  private userAlerts: UserAlert[] = [];
  private userSubscriptions: UserSubscription[] = [
    // Sample user subscriptions for demo user
    {
      id: 'sub-1',
      userId: 'test-user-123',
      tickerSymbol: 'BTCUSDT',
      subscribedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'sub-2',
      userId: 'test-user-123',
      tickerSymbol: 'ETHUSDT',
      subscribedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'sub-3',
      userId: 'test-user-123',
      tickerSymbol: 'SOLUSDT',
      subscribedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  ];
  private dashboardLayouts: DashboardLayout[] = [];
  private webhookSecrets: WebhookSecret[] = [
    {
      id: 'default-webhook-1',
      name: 'tradingview-primary',
      secret: 'tradingview_webhook_secret_2025',
      description: 'Primary TradingView webhook secret',
      isActive: true,
      allowedSources: ['tradingview'],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsed: null,
      usageCount: 0
    }
  ];
  private achievements: Achievement[] = [
    {
      id: "achievement-1",
      name: "First Login",
      description: "Complete your first login to the platform",
      category: "milestone",
      iconType: "star",
      iconColor: "gold",
      points: 10,
      requirement: { type: "login_count", target: 1 },
      isActive: true,
      rarity: "common",
      createdAt: new Date(),
    },
    {
      id: "achievement-2", 
      name: "Week Warrior",
      description: "Login for 7 consecutive days",
      category: "streak",
      iconType: "trophy",
      iconColor: "gold",
      points: 50,
      requirement: { type: "login_streak", target: 7 },
      isActive: true,
      rarity: "rare",
      createdAt: new Date(),
    },
    {
      id: "achievement-3",
      name: "Signal Hunter",
      description: "Receive your first trading signal",
      category: "trading",
      iconType: "badge",
      iconColor: "blue",
      points: 15,
      requirement: { type: "signals_received", target: 1 },
      isActive: true,
      rarity: "common",
      createdAt: new Date(),
    },
    {
      id: "achievement-4",
      name: "Dashboard Explorer",
      description: "Visit the dashboard 10 times",
      category: "learning",
      iconType: "medal",
      iconColor: "bronze",
      points: 25,
      requirement: { type: "dashboard_views", target: 10 },
      isActive: true,
      rarity: "common",
      createdAt: new Date(),
    },
    {
      id: "achievement-5",
      name: "Alert Master",
      description: "Create 5 custom alerts",
      category: "trading",
      iconType: "crown",
      iconColor: "purple",
      points: 75,
      requirement: { type: "alerts_created", target: 5 },
      isActive: true,
      rarity: "epic",
      createdAt: new Date(),
    },
    {
      id: "achievement-6",
      name: "Portfolio Pro",
      description: "Track 15+ cryptocurrencies in your portfolio",
      category: "portfolio",
      iconType: "briefcase",
      iconColor: "green",
      points: 40,
      requirement: { type: "portfolio_count", target: 15 },
      isActive: true,
      rarity: "uncommon",
      createdAt: new Date(),
    },
    {
      id: "achievement-7",
      name: "Notification Ninja",
      description: "Set up all notification channels",
      category: "settings",
      iconType: "bell",
      iconColor: "blue",
      points: 30,
      requirement: { type: "notification_setup", target: 3 },
      isActive: true,
      rarity: "uncommon",
      createdAt: new Date(),
    },
    {
      id: "achievement-8",
      name: "Chart Master",
      description: "View advanced charts 50 times",
      category: "analysis",
      iconType: "chart",
      iconColor: "orange",
      points: 60,
      requirement: { type: "chart_views", target: 50 },
      isActive: true,
      rarity: "rare",
      createdAt: new Date(),
    },
    {
      id: "achievement-9",
      name: "Trading Playground Champion",
      description: "Complete 100 practice trades",
      category: "practice",
      iconType: "gamepad",
      iconColor: "purple",
      points: 100,
      requirement: { type: "practice_trades", target: 100 },
      isActive: true,
      rarity: "legendary",
      createdAt: new Date(),
    },
    {
      id: "achievement-10",
      name: "Bitcoin Believer",
      description: "Follow Bitcoin signals for 30 days",
      category: "dedication",
      iconType: "bitcoin",
      iconColor: "gold",
      points: 80,
      requirement: { type: "bitcoin_streak", target: 30 },
      isActive: true,
      rarity: "epic",
      createdAt: new Date(),
    }
  ];
  private userAchievements: UserAchievement[] = [
    {
      id: "user-achievement-1",
      userId: "test-user-123",
      achievementId: "achievement-1",
      progress: 100,
      isUnlocked: true,
      unlockedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-2", 
      userId: "test-user-123",
      achievementId: "achievement-3",
      progress: 100,
      isUnlocked: true,
      unlockedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-3",
      userId: "test-user-123", 
      achievementId: "achievement-4",
      progress: 50,
      isUnlocked: false,
      unlockedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-4",
      userId: "test-user-123",
      achievementId: "achievement-2",
      progress: 30,
      isUnlocked: false,
      unlockedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-5",
      userId: "test-user-123",
      achievementId: "achievement-7",
      progress: 100,
      isUnlocked: true,
      unlockedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-6",
      userId: "test-user-123",
      achievementId: "achievement-8",
      progress: 75,
      isUnlocked: false,
      unlockedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-7",
      userId: "test-user-123",
      achievementId: "achievement-6",
      progress: 80,
      isUnlocked: false,
      unlockedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];
  private userStats: UserStats[] = [
    {
      id: "stats-test-123",
      userId: "test-user-123",
      totalLogins: 1,
      loginStreak: 1,
      lastLoginDate: new Date(),
      signalsReceived: 3,
      alertsCreated: 0,
      dashboardViews: 5,
      chartViews: 37,
      portfolioCount: 12,
      practiceTradesCompleted: 15,
      totalPoints: 185,
      level: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];

  async getUserTrades(userId: string, limit = 100): Promise<UserTrade[]> {
    return this.trades
      .filter(trade => trade.userId === userId)
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, limit);
  }

  async createTrade(trade: InsertUserTrade): Promise<UserTrade> {
    const newTrade: UserTrade = {
      id: `trade_${Date.now()}`,
      timestamp: new Date(),
      createdAt: new Date(),
      ...trade
    };
    this.trades.push(newTrade);
    return newTrade;
  }

  async getUserPortfolio(userId: string): Promise<UserPortfolio[]> {
    return this.portfolios.filter(portfolio => portfolio.userId === userId);
  }

  async updatePortfolio(userId: string, ticker: string, updates: Partial<UserPortfolio>): Promise<UserPortfolio | undefined> {
    const portfolioIndex = this.portfolios.findIndex(p => p.userId === userId && p.ticker === ticker);
    if (portfolioIndex !== -1) {
      this.portfolios[portfolioIndex] = { 
        ...this.portfolios[portfolioIndex], 
        ...updates,
        updatedAt: new Date()
      };
      return this.portfolios[portfolioIndex];
    }
    
    // Create new portfolio entry if it doesn't exist
    const newPortfolio: UserPortfolio = {
      id: `portfolio_${Date.now()}`,
      userId,
      ticker,
      quantity: "0",
      averagePrice: "0",
      currentValue: "0",
      pnl: "0",
      pnlPercentage: "0",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...updates
    };
    this.portfolios.push(newPortfolio);
    return newPortfolio;
  }

  async getTradingSettings(userId: string): Promise<TradingSettings | undefined> {
    return this.tradingSettings.find(settings => settings.userId === userId);
  }

  async updateTradingSettings(userId: string, settingsUpdate: Partial<TradingSettings>): Promise<TradingSettings> {
    const settingsIndex = this.tradingSettings.findIndex(s => s.userId === userId);
    if (settingsIndex !== -1) {
      this.tradingSettings[settingsIndex] = {
        ...this.tradingSettings[settingsIndex],
        ...settingsUpdate,
        updatedAt: new Date()
      };
      return this.tradingSettings[settingsIndex];
    }
    
    // Create new settings if they don't exist
    const newSettings: TradingSettings = {
      id: `settings_${Date.now()}`,
      userId,
      riskLevel: "moderate",
      maxTradeAmount: "1000",
      autoTrading: false,
      stopLoss: "5",
      takeProfit: "10",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...settingsUpdate
    };
    this.tradingSettings.push(newSettings);
    return newSettings;
  }

  // User Alerts implementation
  async getUserAlerts(userId: string): Promise<UserAlert[]> {
    return this.userAlerts.filter(alert => alert.userId === userId);
  }

  async createUserAlert(alert: InsertUserAlert): Promise<UserAlert> {
    const newAlert: UserAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...alert,
      triggerCount: 0,
      lastTriggered: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.userAlerts.push(newAlert);
    return newAlert;
  }

  async updateUserAlert(id: string, updates: Partial<UserAlert>): Promise<UserAlert | undefined> {
    const alertIndex = this.userAlerts.findIndex(alert => alert.id === id);
    if (alertIndex === -1) return undefined;

    this.userAlerts[alertIndex] = {
      ...this.userAlerts[alertIndex],
      ...updates,
      updatedAt: new Date(),
    };
    return this.userAlerts[alertIndex];
  }

  async deleteUserAlert(id: string): Promise<boolean> {
    const alertIndex = this.userAlerts.findIndex(alert => alert.id === id);
    if (alertIndex === -1) return false;

    this.userAlerts.splice(alertIndex, 1);
    return true;
  }

  // Dashboard Layout implementation
  async getDashboardLayout(userId: string): Promise<DashboardLayout | undefined> {
    return this.dashboardLayouts.find(layout => layout.userId === userId && layout.isDefault);
  }

  async saveDashboardLayout(layout: InsertDashboardLayout): Promise<DashboardLayout> {
    // Check if user already has a default layout
    const existingIndex = this.dashboardLayouts.findIndex(l => l.userId === layout.userId && l.isDefault);
    
    const newLayout: DashboardLayout = {
      id: `layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...layout,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (existingIndex !== -1) {
      // Update existing layout
      this.dashboardLayouts[existingIndex] = { ...this.dashboardLayouts[existingIndex], ...newLayout };
      return this.dashboardLayouts[existingIndex];
    } else {
      // Create new layout
      this.dashboardLayouts.push(newLayout);
      return newLayout;
    }
  }

  async updateDashboardLayout(id: string, updates: Partial<DashboardLayout>): Promise<DashboardLayout | undefined> {
    const layoutIndex = this.dashboardLayouts.findIndex(layout => layout.id === id);
    if (layoutIndex === -1) return undefined;

    this.dashboardLayouts[layoutIndex] = {
      ...this.dashboardLayouts[layoutIndex],
      ...updates,
      updatedAt: new Date(),
    };
    return this.dashboardLayouts[layoutIndex];
  }

  // User Subscriptions implementation (Ticker Subscriptions)
  async getUserSubscriptions(userId: string): Promise<UserSubscription[]> {
    return this.userSubscriptions.filter(sub => sub.userId === userId);
  }

  async createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription> {
    const newSubscription: UserSubscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...subscription,
      subscribedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.userSubscriptions.push(newSubscription);
    return newSubscription;
  }

  async deleteUserSubscription(id: string): Promise<boolean> {
    const subscriptionIndex = this.userSubscriptions.findIndex(sub => sub.id === id);
    if (subscriptionIndex === -1) return false;

    this.userSubscriptions.splice(subscriptionIndex, 1);
    return true;
  }

  async getWebhookSecrets(): Promise<WebhookSecret[]> {
    return this.webhookSecrets.filter(s => s.isActive);
  }

  async getWebhookSecret(name: string): Promise<WebhookSecret | undefined> {
    return this.webhookSecrets.find(s => s.name === name && s.isActive);
  }

  async createWebhookSecret(secret: InsertWebhookSecret): Promise<WebhookSecret> {
    const newSecret: WebhookSecret = {
      ...secret,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsed: null,
      usageCount: 0,
    };
    this.webhookSecrets.push(newSecret);
    return newSecret;
  }

  async updateWebhookSecret(id: string, updates: Partial<WebhookSecret>): Promise<WebhookSecret | undefined> {
    const index = this.webhookSecrets.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    
    this.webhookSecrets[index] = { 
      ...this.webhookSecrets[index], 
      ...updates, 
      updatedAt: new Date() 
    };
    return this.webhookSecrets[index];
  }

  async deleteWebhookSecret(id: string): Promise<boolean> {
    const index = this.webhookSecrets.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    this.webhookSecrets.splice(index, 1);
    return true;
  }

  // Achievement system implementation
  async getAllAchievements(): Promise<Achievement[]> {
    return this.achievements.filter(a => a.isActive);
  }

  async getAchievement(id: string): Promise<Achievement | undefined> {
    return this.achievements.find(a => a.id === id && a.isActive);
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const newAchievement: Achievement = {
      ...achievement,
      id: `achievement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };
    this.achievements.push(newAchievement);
    return newAchievement;
  }

  async updateAchievement(id: string, updates: Partial<Achievement>): Promise<Achievement | undefined> {
    const index = this.achievements.findIndex(a => a.id === id);
    if (index === -1) return undefined;
    
    this.achievements[index] = { 
      ...this.achievements[index], 
      ...updates 
    };
    return this.achievements[index];
  }

  async deleteAchievement(id: string): Promise<boolean> {
    const index = this.achievements.findIndex(a => a.id === id);
    if (index === -1) return false;
    
    this.achievements.splice(index, 1);
    return true;
  }

  // User achievements implementation
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    return this.userAchievements.filter(ua => ua.userId === userId);
  }

  async getUserAchievement(userId: string, achievementId: string): Promise<UserAchievement | undefined> {
    return this.userAchievements.find(ua => ua.userId === userId && ua.achievementId === achievementId);
  }

  async unlockUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement> {
    const newUserAchievement: UserAchievement = {
      ...userAchievement,
      id: `user-achievement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      progress: userAchievement.progress ?? 100,
      isUnlocked: true,
      unlockedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.userAchievements.push(newUserAchievement);
    return newUserAchievement;
  }

  async updateUserAchievement(id: string, updates: Partial<UserAchievement>): Promise<UserAchievement | undefined> {
    const index = this.userAchievements.findIndex(ua => ua.id === id);
    if (index === -1) return undefined;
    
    this.userAchievements[index] = { 
      ...this.userAchievements[index], 
      ...updates,
      updatedAt: new Date()
    };
    return this.userAchievements[index];
  }

  async updateUserAchievementProgress(userId: string, achievementId: string, progress: number): Promise<UserAchievement | undefined> {
    const userAchievement = await this.getUserAchievement(userId, achievementId);
    if (!userAchievement) return undefined;
    
    const isCompleted = progress >= userAchievement.target;
    return this.updateUserAchievement(userAchievement.id, {
      progress,
      isCompleted,
      completedAt: isCompleted ? new Date() : undefined
    });
  }

  // User stats implementation
  async getUserStats(userId: string): Promise<UserStats | undefined> {
    return this.userStats.find(s => s.userId === userId);
  }

  async createUserStats(userStats: InsertUserStats): Promise<UserStats> {
    const newUserStats: UserStats = {
      ...userStats,
      id: `stats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.userStats.push(newUserStats);
    return newUserStats;
  }

  async updateUserStats(userId: string, updates: Partial<UserStats>): Promise<UserStats | undefined> {
    const index = this.userStats.findIndex(s => s.userId === userId);
    if (index === -1) return undefined;
    
    this.userStats[index] = { 
      ...this.userStats[index], 
      ...updates,
      updatedAt: new Date()
    };
    return this.userStats[index];
  }

  async incrementUserStat(userId: string, statName: keyof UserStats, increment = 1): Promise<UserStats | undefined> {
    const stats = await this.getUserStats(userId);
    if (!stats) return undefined;
    
    const currentValue = stats[statName] as number || 0;
    const updates: Partial<UserStats> = {
      [statName]: currentValue + increment
    } as Partial<UserStats>;
    
    return this.updateUserStats(userId, updates);
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(schema.users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    return result[0];
  }

  async updateUserLoginTime(id: string): Promise<void> {
    await db.update(schema.users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const result = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)).limit(1);
    return result[0];
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const result = await db.insert(schema.userSettings).values(settings).returning();
    return result[0];
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const result = await db.update(schema.userSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userSettings.userId, userId))
      .returning();
    return result[0];
  }

  async getAllTickers(): Promise<AvailableTicker[]> {
    return await db.select().from(schema.availableTickers).orderBy(schema.availableTickers.symbol);
  }

  async getEnabledTickers(): Promise<AvailableTicker[]> {
    return await db.select().from(schema.availableTickers)
      .where(eq(schema.availableTickers.isEnabled, true))
      .orderBy(schema.availableTickers.symbol);
  }

  async createTicker(ticker: InsertTicker): Promise<AvailableTicker> {
    const result = await db.insert(schema.availableTickers).values(ticker).returning();
    return result[0];
  }

  async updateTicker(id: string, updates: Partial<AvailableTicker>): Promise<AvailableTicker | undefined> {
    const result = await db.update(schema.availableTickers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.availableTickers.id, id))
      .returning();
    return result[0];
  }

  async deleteTicker(id: string): Promise<boolean> {
    const result = await db.delete(schema.availableTickers).where(eq(schema.availableTickers.id, id));
    return result.rowCount > 0;
  }

  async getSignals(limit = 100): Promise<AlertSignal[]> {
    return await db.select().from(schema.alertSignals)
      .orderBy(desc(schema.alertSignals.timestamp))
      .limit(limit);
  }

  async getSignalsByTicker(ticker: string, limit = 100): Promise<AlertSignal[]> {
    return await db.select().from(schema.alertSignals)
      .where(eq(schema.alertSignals.ticker, ticker))
      .orderBy(desc(schema.alertSignals.timestamp))
      .limit(limit);
  }

  async getSignalsByUser(userId: string, limit = 100): Promise<AlertSignal[]> {
    return await db.select().from(schema.alertSignals)
      .where(eq(schema.alertSignals.userId, userId))
      .orderBy(desc(schema.alertSignals.timestamp))
      .limit(limit);
  }

  async createSignal(signal: InsertSignal): Promise<AlertSignal> {
    const result = await db.insert(schema.alertSignals).values(signal).returning();
    return result[0];
  }

  async getOhlcData(ticker: string, interval: string, limit = 1000): Promise<OhlcData[]> {
    return await db.select().from(schema.ohlcCache)
      .where(and(
        eq(schema.ohlcCache.tickerSymbol, ticker),
        eq(schema.ohlcCache.interval, interval)
      ))
      .orderBy(desc(schema.ohlcCache.time))
      .limit(limit);
  }

  async createOhlcData(data: InsertOhlc): Promise<OhlcData> {
    const result = await db.insert(schema.ohlcCache).values(data).returning();
    return result[0];
  }

  async getHeatmapData(ticker: string): Promise<HeatmapData[]> {
    return await db.select().from(schema.heatmapData)
      .where(eq(schema.heatmapData.ticker, ticker))
      .orderBy(desc(schema.heatmapData.week));
  }

  async createHeatmapData(data: InsertHeatmap): Promise<HeatmapData> {
    const result = await db.insert(schema.heatmapData).values(data).returning();
    return result[0];
  }

  async getCycleData(ticker: string): Promise<CycleData[]> {
    return await db.select().from(schema.cycleIndicatorData)
      .where(eq(schema.cycleIndicatorData.ticker, ticker))
      .orderBy(desc(schema.cycleIndicatorData.date));
  }

  async createCycleData(data: InsertCycle): Promise<CycleData> {
    const result = await db.insert(schema.cycleIndicatorData).values(data).returning();
    return result[0];
  }

  async getForecastData(ticker: string): Promise<ForecastData[]> {
    return await db.select().from(schema.forecastData)
      .where(eq(schema.forecastData.ticker, ticker))
      .orderBy(desc(schema.forecastData.date));
  }

  async createForecastData(data: InsertForecast): Promise<ForecastData> {
    const result = await db.insert(schema.forecastData).values(data).returning();
    return result[0];
  }

  async getAdminLogs(limit = 100): Promise<AdminLog[]> {
    return await db.select().from(schema.adminActivityLog)
      .orderBy(desc(schema.adminActivityLog.timestamp))
      .limit(limit);
  }

  async createAdminLog(log: InsertAdminLog): Promise<AdminLog> {
    const result = await db.insert(schema.adminActivityLog).values(log).returning();
    return result[0];
  }

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.isActive, true));
  }

  async getSubscriptionPlan(tier: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.tier, tier as any));
    return plan;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [newPlan] = await db
      .insert(schema.subscriptionPlans)
      .values(plan)
      .returning();
    return newPlan;
  }

  async updateUserSubscription(userId: string, updates: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(schema.users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning();
    return updatedUser;
  }

  // Trading System implementation
  async getUserTrades(userId: string, limit = 100): Promise<UserTrade[]> {
    return await db.select()
      .from(schema.userTrades)
      .where(eq(schema.userTrades.userId, userId))
      .orderBy(desc(schema.userTrades.timestamp))
      .limit(limit);
  }

  async createTrade(trade: InsertUserTrade): Promise<UserTrade> {
    const [newTrade] = await db
      .insert(schema.userTrades)
      .values(trade)
      .returning();
    return newTrade;
  }

  async getUserPortfolio(userId: string): Promise<UserPortfolio[]> {
    return await db.select()
      .from(schema.userPortfolio)
      .where(eq(schema.userPortfolio.userId, userId));
  }

  async updatePortfolio(userId: string, ticker: string, updates: Partial<UserPortfolio>): Promise<UserPortfolio | undefined> {
    const [updated] = await db
      .update(schema.userPortfolio)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(schema.userPortfolio.userId, userId),
        eq(schema.userPortfolio.ticker, ticker)
      ))
      .returning();
    
    if (!updated) {
      // Create new portfolio entry if it doesn't exist
      const [newPortfolio] = await db
        .insert(schema.userPortfolio)
        .values({
          userId,
          ticker,
          quantity: "0",
          averagePrice: "0",
          currentValue: "0",
          ...updates
        })
        .returning();
      return newPortfolio;
    }
    
    return updated;
  }

  async getTradingSettings(userId: string): Promise<TradingSettings | undefined> {
    const [settings] = await db.select()
      .from(schema.tradingSettings)
      .where(eq(schema.tradingSettings.userId, userId))
      .limit(1);
    return settings;
  }

  async updateTradingSettings(userId: string, settingsUpdate: Partial<TradingSettings>): Promise<TradingSettings> {
    const [updated] = await db
      .update(schema.tradingSettings)
      .set({ ...settingsUpdate, updatedAt: new Date() })
      .where(eq(schema.tradingSettings.userId, userId))
      .returning();
    
    if (!updated) {
      // Create new settings if they don't exist
      const [newSettings] = await db
        .insert(schema.tradingSettings)
        .values({
          userId,
          ...settingsUpdate
        })
        .returning();
      return newSettings;
    }
    
    return updated;
  }

  // User Alerts implementation
  async getUserAlerts(userId: string): Promise<UserAlert[]> {
    const alerts = await db.select().from(schema.userAlerts).where(eq(schema.userAlerts.userId, userId));
    return alerts;
  }

  async createUserAlert(alert: InsertUserAlert): Promise<UserAlert> {
    const [newAlert] = await db
      .insert(schema.userAlerts)
      .values(alert)
      .returning();
    return newAlert;
  }

  async updateUserAlert(id: string, updates: Partial<UserAlert>): Promise<UserAlert | undefined> {
    const [updatedAlert] = await db
      .update(schema.userAlerts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userAlerts.id, id))
      .returning();
    return updatedAlert;
  }

  async deleteUserAlert(id: string): Promise<boolean> {
    const result = await db
      .delete(schema.userAlerts)
      .where(eq(schema.userAlerts.id, id));
    return result.rowCount > 0;
  }

  // Dashboard Layout implementation
  async getDashboardLayout(userId: string): Promise<DashboardLayout | undefined> {
    const [layout] = await db.select()
      .from(schema.dashboardLayouts)
      .where(and(
        eq(schema.dashboardLayouts.userId, userId),
        eq(schema.dashboardLayouts.isDefault, true)
      ))
      .limit(1);
    return layout;
  }

  async saveDashboardLayout(layout: InsertDashboardLayout): Promise<DashboardLayout> {
    // Check if user already has a default layout
    const existing = await this.getDashboardLayout(layout.userId);
    
    if (existing) {
      // Update existing layout
      const [updated] = await db
        .update(schema.dashboardLayouts)
        .set({ ...layout, updatedAt: new Date() })
        .where(eq(schema.dashboardLayouts.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new layout
      const [newLayout] = await db
        .insert(schema.dashboardLayouts)
        .values(layout)
        .returning();
      return newLayout;
    }
  }

  async updateDashboardLayout(id: string, updates: Partial<DashboardLayout>): Promise<DashboardLayout | undefined> {
    const [updated] = await db
      .update(schema.dashboardLayouts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.dashboardLayouts.id, id))
      .returning();
    return updated;
  }

  async getWebhookSecrets(): Promise<WebhookSecret[]> {
    try {
      return await db.select().from(schema.webhookSecrets)
        .where(eq(schema.webhookSecrets.isActive, true))
        .orderBy(schema.webhookSecrets.createdAt);
    } catch (error) {
      console.log('Webhook secrets table not found, creating...');
      return [];
    }
  }

  async getWebhookSecret(name: string): Promise<WebhookSecret | undefined> {
    try {
      const result = await db.select().from(schema.webhookSecrets)
        .where(and(
          eq(schema.webhookSecrets.name, name),
          eq(schema.webhookSecrets.isActive, true)
        ))
        .limit(1);
      return result[0];
    } catch (error) {
      console.log('Webhook secrets table not found');
      return undefined;
    }
  }

  async createWebhookSecret(secret: InsertWebhookSecret): Promise<WebhookSecret> {
    const result = await db.insert(schema.webhookSecrets).values(secret).returning();
    return result[0];
  }

  async updateWebhookSecret(id: string, updates: Partial<WebhookSecret>): Promise<WebhookSecret | undefined> {
    const result = await db.update(schema.webhookSecrets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.webhookSecrets.id, id))
      .returning();
    return result[0];
  }

  async deleteWebhookSecret(id: string): Promise<boolean> {
    const result = await db.delete(schema.webhookSecrets)
      .where(eq(schema.webhookSecrets.id, id));
    return result.rowCount > 0;
  }

  // User Subscriptions implementation (Ticker Subscriptions)
  async getUserSubscriptions(userId: string): Promise<UserSubscription[]> {
    try {
      const subscriptions = await db.select().from(schema.userSubscriptions)
        .where(eq(schema.userSubscriptions.userId, userId))
        .orderBy(desc(schema.userSubscriptions.subscribedAt));
      return subscriptions;
    } catch (error) {
      console.log('User subscriptions table not found, returning empty array');
      return [];
    }
  }

  async createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription> {
    const [newSubscription] = await db
      .insert(schema.userSubscriptions)
      .values(subscription)
      .returning();
    return newSubscription;
  }

  async deleteUserSubscription(id: string): Promise<boolean> {
    const result = await db
      .delete(schema.userSubscriptions)
      .where(eq(schema.userSubscriptions.id, id));
    return result.rowCount > 0;
  }

  // Achievement system implementation
  async getAllAchievements(): Promise<Achievement[]> {
    try {
      return await db.select().from(schema.achievements)
        .where(eq(schema.achievements.isActive, true))
        .orderBy(schema.achievements.createdAt);
    } catch (error) {
      console.log('Achievements table not found, returning empty array');
      return [];
    }
  }

  async getAchievement(id: string): Promise<Achievement | undefined> {
    try {
      const result = await db.select().from(schema.achievements)
        .where(and(
          eq(schema.achievements.id, id),
          eq(schema.achievements.isActive, true)
        ))
        .limit(1);
      return result[0];
    } catch (error) {
      console.log('Achievements table not found');
      return undefined;
    }
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const result = await db.insert(schema.achievements).values(achievement).returning();
    return result[0];
  }

  async updateAchievement(id: string, updates: Partial<Achievement>): Promise<Achievement | undefined> {
    const result = await db.update(schema.achievements)
      .set(updates)
      .where(eq(schema.achievements.id, id))
      .returning();
    return result[0];
  }

  async deleteAchievement(id: string): Promise<boolean> {
    const result = await db.delete(schema.achievements)
      .where(eq(schema.achievements.id, id));
    return result.rowCount > 0;
  }

  // User achievements implementation
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      return await db.select().from(schema.userAchievements)
        .where(eq(schema.userAchievements.userId, userId))
        .orderBy(desc(schema.userAchievements.createdAt));
    } catch (error) {
      console.log('User achievements table not found, returning empty array');
      return [];
    }
  }

  async getUserAchievement(userId: string, achievementId: string): Promise<UserAchievement | undefined> {
    try {
      const result = await db.select().from(schema.userAchievements)
        .where(and(
          eq(schema.userAchievements.userId, userId),
          eq(schema.userAchievements.achievementId, achievementId)
        ))
        .limit(1);
      return result[0];
    } catch (error) {
      console.log('User achievements table not found');
      return undefined;
    }
  }

  async unlockUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement> {
    const result = await db.insert(schema.userAchievements).values({
      ...userAchievement,
      progress: userAchievement.progress ?? 100,
      isUnlocked: true,
      unlockedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateUserAchievement(id: string, updates: Partial<UserAchievement>): Promise<UserAchievement | undefined> {
    const result = await db.update(schema.userAchievements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userAchievements.id, id))
      .returning();
    return result[0];
  }

  async updateUserAchievementProgress(userId: string, achievementId: string, progress: number): Promise<UserAchievement | undefined> {
    const userAchievement = await this.getUserAchievement(userId, achievementId);
    if (!userAchievement) return undefined;
    
    const isUnlocked = progress >= 100; // Assuming 100 is the target
    return this.updateUserAchievement(userAchievement.id, {
      progress,
      isUnlocked,
      unlockedAt: isUnlocked ? new Date() : undefined
    });
  }

  // User stats implementation
  async getUserStats(userId: string): Promise<UserStats | undefined> {
    try {
      const result = await db.select().from(schema.userStats)
        .where(eq(schema.userStats.userId, userId))
        .limit(1);
      return result[0];
    } catch (error) {
      console.log('User stats table not found');
      return undefined;
    }
  }

  async createUserStats(userStats: InsertUserStats): Promise<UserStats> {
    const result = await db.insert(schema.userStats).values(userStats).returning();
    return result[0];
  }

  async updateUserStats(userId: string, updates: Partial<UserStats>): Promise<UserStats | undefined> {
    const result = await db.update(schema.userStats)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userStats.userId, userId))
      .returning();
    return result[0];
  }

  async incrementUserStat(userId: string, statName: keyof UserStats, increment = 1): Promise<UserStats | undefined> {
    const stats = await this.getUserStats(userId);
    if (!stats) return undefined;
    
    const currentValue = (stats[statName] as number) || 0;
    const updates: Partial<UserStats> = {
      [statName]: currentValue + increment
    } as Partial<UserStats>;
    
    return this.updateUserStats(userId, updates);
  }
}

export const storage = db ? new DatabaseStorage() : new MemoryStorage();
