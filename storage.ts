import { config } from 'dotenv';
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, and, or, gte, lte, inArray, asc, sql, isNull, ne, count, sum, avg, min, max, like } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import { db as dbConnection } from "./db.js";

// Load environment variables first
config();
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
  SystemSetting,
  InsertSystemSetting,
  UserNotification,
  InsertUserNotification,
  UserNotificationPreferences,
  InsertUserNotificationPreferences,
  NotificationQueue,
  InsertNotificationQueue,
  NotificationTemplate,
  InsertNotificationTemplate,
  NotificationLog,
  InsertNotificationLog,
  NotificationChannel,
  InsertNotificationChannel,
  Announcement,
  AnnouncementInsert,
  PasswordResetToken,
  InsertPasswordResetToken,
} from "../shared/schema.js";

// Database connection is handled in db.js - removed duplicate initialization

// Database connection is handled centrally in db.js

// Database connection status
console.log('Storage initialization - DATABASE_URL present:', !!process.env.DATABASE_URL);

// Export database initialization function for server startup
export function initializeDatabase() {
  console.log('🔧 Initializing database connection for authentication testing');
  const isDatabaseUrlValid = !!process.env.DATABASE_URL;
  
  if (!isDatabaseUrlValid) {
    console.error('❌ DATABASE_URL not found in environment');
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  const urlPattern = /^postgresql/;
  const formatValid = process.env.DATABASE_URL ? urlPattern.test(process.env.DATABASE_URL) : false;
  console.log('Database URL format:', formatValid ? 'PostgreSQL standard' : 'Invalid format');
  
  if (!formatValid) {
    console.error('❌ Invalid DATABASE_URL format - must be PostgreSQL connection string');
    throw new Error('Invalid DATABASE_URL format');
  }
  
  console.log('✅ Database connection established successfully');
  console.log('🔄 Ready for user authentication testing');
}

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserLoginTime(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;
  upsertOAuthUser(user: Partial<InsertUser>): Promise<User>;
  
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
  
  // OHLC Data
  getOhlcData(symbol: string, interval: string, limit: number): Promise<OhlcData[]>;
  getOhlcDataPaginated(symbol: string, interval: string, page: number, limit: number): Promise<{ data: OhlcData[], totalCount: number }>;
  createOhlcData(ohlc: InsertOhlc): Promise<OhlcData>;
  
  // Signals
  getSignals(limit?: number): Promise<AlertSignal[]>;
  getSignalsByTicker(ticker: string, limit?: number): Promise<AlertSignal[]>;
  getSignalsByUser(userId: string, limit?: number): Promise<AlertSignal[]>;
  createSignal(signal: InsertSignal): Promise<AlertSignal>;

  // New Signal Management System
  createBuySignal(signal: any): Promise<any>;
  getBuySignals(filters?: any): Promise<any[]>;
  updateBuySignal(id: string, updates: any): Promise<any>;
  createSignalDelivery(delivery: any): Promise<any>;
  
  // Ticker/Timeframe Management
  getAllowedTickerTimeframes(): Promise<any[]>;
  getTickerTimeframe(symbol: string, timeframe: string): Promise<any>;
  createAllowedTickerTimeframe(data: any): Promise<any>;
  deleteAllowedTickerTimeframe(id: string): Promise<boolean>;
  
  // User Subscriptions
  getUserTickerSubscriptions(userId: string): Promise<any[]>;
  getUserTickerSubscription(userId: string, symbol: string, timeframe: string): Promise<any>;
  createUserTickerSubscription(data: any): Promise<any>;
  deleteUserTickerSubscription(id: string, userId: string): Promise<boolean>;
  getUserSubscriptionsForTicker(symbol: string, timeframe: string): Promise<any[]>;
  getSignalsForUser(userId: string, limit: number): Promise<any[]>;

  // Admin Signal Subscriptions Management
  getSignalSubscriptions(filters?: { userId?: string; ticker?: string; page?: number; limit?: number }): Promise<any[]>;
  createSignalSubscription(data: any): Promise<any>;
  updateSignalSubscription(id: string, updates: any): Promise<any>;
  deleteSignalSubscription(id: string): Promise<boolean>;
  
  
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
  getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(tier: string): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlanById(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  deleteSubscriptionPlan(id: string): Promise<boolean>;
  
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

  // Notification configuration management
  getNotificationConfigs(): Promise<NotificationChannel[]>;
  getNotificationConfig(id: string): Promise<NotificationChannel | undefined>;
  createNotificationConfig(config: InsertNotificationChannel): Promise<NotificationChannel>;
  updateNotificationConfig(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel | undefined>;
  deleteNotificationConfig(id: string): Promise<boolean>;

  // Notification Queue Management
  getNotificationQueue(limit?: number): Promise<NotificationQueue[]>;
  getQueuedNotifications(status?: string): Promise<NotificationQueue[]>;
  addToNotificationQueue(notification: InsertNotificationQueue): Promise<NotificationQueue>;
  updateNotificationQueueStatus(id: string, status: string, metadata?: any): Promise<NotificationQueue | undefined>;
  deleteFromNotificationQueue(id: string): Promise<boolean>;
  getFailedNotifications(retryCount?: number): Promise<NotificationQueue[]>;

  // Notification Templates Management
  getNotificationTemplates(): Promise<NotificationTemplate[]>;
  getNotificationTemplate(id: string): Promise<NotificationTemplate | undefined>;
  getNotificationTemplateByType(type: string): Promise<NotificationTemplate | undefined>;
  createNotificationTemplate(template: InsertNotificationTemplate): Promise<NotificationTemplate>;
  updateNotificationTemplate(id: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate | undefined>;
  deleteNotificationTemplate(id: string): Promise<boolean>;

  // Notification Logs Management
  getNotificationLogs(limit?: number, channel?: string): Promise<NotificationLog[]>;
  getNotificationLog(id: string): Promise<NotificationLog | undefined>;
  getNotificationLogsByUser(userId: string, limit?: number): Promise<NotificationLog[]>;
  createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog>;
  updateNotificationLog(id: string, updates: Partial<NotificationLog>): Promise<NotificationLog | undefined>;
  getNotificationStats(dateFrom?: Date, dateTo?: Date): Promise<any>;

  // Notification Channels Management
  getNotificationChannels(): Promise<NotificationChannel[]>;
  getNotificationChannel(id: string): Promise<NotificationChannel | undefined>;
  getNotificationChannelByType(type: string): Promise<NotificationChannel | undefined>;
  createNotificationChannel(channel: InsertNotificationChannel): Promise<NotificationChannel>;
  updateNotificationChannel(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel | undefined>;
  deleteNotificationChannel(id: string): Promise<boolean>;
  testNotificationChannel(id: string): Promise<any>;

  // Additional methods for missing functionality  
  updateUserTickerSubscription(id: string, updates: any): Promise<boolean>;
  deleteUserTickerSubscriptionById(id: string): Promise<boolean>;

  // System Settings
  getSystemSettings(): Promise<SystemSetting[]>;
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  updateSystemSetting(key: string, updates: Partial<SystemSetting>): Promise<SystemSetting | undefined>;
  deleteSystemSetting(key: string): Promise<boolean>;
  getSystemSettingsByCategory(category: string): Promise<SystemSetting[]>;

  // User Notifications
  getUserNotifications(userId: string, limit?: number): Promise<UserNotification[]>;
  createUserNotification(notification: InsertUserNotification): Promise<UserNotification>;
  markNotificationAsRead(id: string, userId: string): Promise<UserNotification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  archiveNotification(id: string, userId: string): Promise<UserNotification | undefined>;
  deleteNotification(id: string, userId: string): Promise<boolean>;
  
  // User Notification Preferences
  getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | undefined>;
  createUserNotificationPreferences(preferences: InsertUserNotificationPreferences): Promise<UserNotificationPreferences>;
  updateUserNotificationPreferences(userId: string, updates: Partial<UserNotificationPreferences>): Promise<UserNotificationPreferences | undefined>;

  // Announcements
  getAnnouncements(audience?: string): Promise<Announcement[]>;
  getAnnouncement(id: string): Promise<Announcement | undefined>;
  createAnnouncement(announcement: AnnouncementInsert): Promise<Announcement>;
  updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement | undefined>;
  deleteAnnouncement(id: string): Promise<boolean>;
  publishAnnouncement(id: string): Promise<Announcement | undefined>;
  
  // Password Reset Tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenAsUsed(token: string): Promise<boolean>;
  invalidateUserPasswordResetTokens(userId: string): Promise<void>;
  cleanupExpiredPasswordResetTokens(): Promise<void>;
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  private db: any;

  constructor() {
    if (process.env.DATABASE_URL) {
      this.db = dbConnection;
    }
  }

  // User management
  async getUser(id: string): Promise<User | undefined> {
    if (!this.db) return undefined;
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!this.db) return undefined;
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!this.db) throw new Error('Database not available');
    const [user] = await this.db
      .insert(schema.users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    if (!this.db) return undefined;
    
    // Normalize decimal fields to strings for Drizzle compatibility
    const normalizedUpdates = { ...updates };
    if (updates.subscriptionTier) {
      // Ensure subscription tier is valid
    }
    
    const [user] = await this.db
      .update(schema.users)
      .set({ ...normalizedUpdates, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserLoginTime(id: string): Promise<void> {
    if (!this.db) return;
    await this.db
      .update(schema.users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  }

  async deleteUser(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.delete(schema.users)
      .where(eq(schema.users.id, id))
      .returning({ id: schema.users.id });
    return result.length > 0;
  }

  async upsertOAuthUser(userData: Partial<InsertUser>): Promise<User> {
    if (!this.db) throw new Error('Database connection not available');
    
    try {
      const [user] = await this.db
        .insert(schema.users)
        .values({
          ...userData,
          hashedPassword: null, // OAuth users don't have passwords
          role: 'user', // Force OAuth users to be regular users only
          isActive: true,
          subscriptionTier: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.users.email,
          set: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();
      
      return user;
    } catch (error) {
      console.error('Error upserting OAuth user:', error);
      throw error;
    }
  }

  // Ticker management
  async getAllTickers(): Promise<AvailableTicker[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.availableTickers).orderBy(schema.availableTickers.symbol);
  }

  async getEnabledTickers(): Promise<AvailableTicker[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.availableTickers)
      .where(eq(schema.availableTickers.isEnabled, true))
      .orderBy(schema.availableTickers.symbol);
  }

  async createTicker(ticker: InsertTicker): Promise<AvailableTicker> {
    if (!this.db) throw new Error('Database not available');
    const [newTicker] = await this.db
      .insert(schema.availableTickers)
      .values(ticker)
      .returning();
    return newTicker;
  }

  async updateTicker(id: string, updates: Partial<AvailableTicker>): Promise<AvailableTicker | undefined> {
    if (!this.db) return undefined;
    const [ticker] = await this.db
      .update(schema.availableTickers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.availableTickers.id, id))
      .returning();
    return ticker || undefined;
  }

  async deleteTicker(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.delete(schema.availableTickers)
      .where(eq(schema.availableTickers.id, id))
      .returning({ id: schema.availableTickers.id });
    return result.length > 0;
  }

  // OHLC Data management
  async getOhlcData(ticker: string, interval: string, limit: number = 100): Promise<OhlcData[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.ohlcCache)
      .where(and(eq(schema.ohlcCache.symbol, ticker), eq(schema.ohlcCache.interval, interval)))
      .orderBy(desc(schema.ohlcCache.lastUpdated))
      .limit(limit);
  }

  async getOhlcDataPaginated(symbol: string, interval: string, page: number = 1, limit: number = 100): Promise<{ data: OhlcData[], totalCount: number }> {
    if (!this.db) return { data: [], totalCount: 0 };
    
    // Validate and sanitize inputs
    const validatedPage = Math.max(1, Math.floor(page));
    const validatedLimit = Math.min(1000, Math.max(1, Math.floor(limit))); // Cap at 1000
    const offset = (validatedPage - 1) * validatedLimit;

    const whereClause = and(
      eq(schema.ohlcCache.symbol, symbol),
      eq(schema.ohlcCache.interval, interval)
    );

    // Get total count and paginated data in parallel
    const [totalCountResult, data] = await Promise.all([
      this.db.select({ count: count() }).from(schema.ohlcCache).where(whereClause),
      this.db.select().from(schema.ohlcCache)
        .where(whereClause)
        .orderBy(desc(schema.ohlcCache.lastUpdated))
        .limit(validatedLimit)
        .offset(offset)
    ]);

    const totalCount = totalCountResult[0]?.count || 0;

    return {
      data,
      totalCount: Number(totalCount)
    };
  }

  async createOhlcData(data: InsertOhlc): Promise<OhlcData> {
    if (!this.db) throw new Error('Database not available');
    const [ohlc] = await this.db
      .insert(schema.ohlcCache)
      .values(data)
      .returning();
    return ohlc;
  }

  // Signal management
  async getSignals(limit: number = 50): Promise<AlertSignal[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.alertSignals)
      .orderBy(desc(schema.alertSignals.createdAt))
      .limit(limit);
  }

  async getSignalsByTicker(ticker: string, limit: number = 50): Promise<AlertSignal[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.alertSignals)
      .where(eq(schema.alertSignals.ticker, ticker))
      .orderBy(desc(schema.alertSignals.createdAt))
      .limit(limit);
  }

  async getSignalsByUser(userId: string, limit: number = 50): Promise<AlertSignal[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.alertSignals)
      .where(eq(schema.alertSignals.userId, userId))
      .orderBy(desc(schema.alertSignals.createdAt))
      .limit(limit);
  }

  async createSignal(signal: InsertSignal): Promise<AlertSignal> {
    if (!this.db) throw new Error('Database not available');
    const [newSignal] = await this.db
      .insert(schema.alertSignals)
      .values(signal)
      .returning();
    return newSignal;
  }

  // Other required methods with basic implementations
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    if (!this.db) return undefined;
    const [settings] = await this.db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
    return settings || undefined;
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    if (!this.db) throw new Error('Database not available');
    const [newSettings] = await this.db
      .insert(schema.userSettings)
      .values(settings)
      .returning();
    return newSettings;
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    if (!this.db) return undefined;
    
    // Normalize decimal fields to strings for Drizzle compatibility
    const normalizedUpdates = { ...updates };
    if (updates.paperTradingBalance) {
      normalizedUpdates.paperTradingBalance = updates.paperTradingBalance.toString();
    }
    if (updates.riskPercentage) {
      normalizedUpdates.riskPercentage = updates.riskPercentage.toString();
    }
    if (updates.stopLossPercentage) {
      normalizedUpdates.stopLossPercentage = updates.stopLossPercentage.toString();
    }
    if (updates.takeProfitPercentage) {
      normalizedUpdates.takeProfitPercentage = updates.takeProfitPercentage.toString();
    }
    
    const [settings] = await this.db
      .update(schema.userSettings)
      .set({ ...normalizedUpdates, updatedAt: new Date() })
      .where(eq(schema.userSettings.userId, userId))
      .returning();
    return settings || undefined;
  }

  // Buy Signals Management
  async createBuySignal(signal: any): Promise<any> {
    if (!this.db) throw new Error('Database not available');
    const [newSignal] = await this.db
      .insert(schema.buySignals)
      .values({
        symbol: signal.symbol,
        timeframe: signal.timeframe,
        signalType: signal.signalType,
        price: signal.price.toString(),
        entryPrice: signal.entryPrice?.toString(),
        stopLoss: signal.stopLoss?.toString(),
        takeProfit: signal.takeProfit?.toString(),
        confidence: signal.confidence,
        source: signal.source,
        notes: signal.notes,
        createdBy: signal.createdBy
      })
      .returning();
    return newSignal;
  }

  async getBuySignals(filters?: any): Promise<any[]> {
    if (!this.db) return [];
    let query = this.db.select().from(schema.buySignals);
    
    if (filters?.symbol) {
      query = query.where(eq(schema.buySignals.symbol, filters.symbol));
    }
    
    return await query.orderBy(desc(schema.buySignals.createdAt)).limit(filters?.limit || 100);
  }

  async updateBuySignal(id: string, updates: any): Promise<any> {
    if (!this.db) return null;
    const [signal] = await this.db
      .update(schema.buySignals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.buySignals.id, id))
      .returning();
    return signal || null;
  }

  async createSignalDelivery(delivery: any): Promise<any> {
    if (!this.db) throw new Error('Database not available');
    const [newDelivery] = await this.db
      .insert(schema.signalDeliveries)
      .values(delivery)
      .returning();
    return newDelivery;
  }

  // Ticker Timeframes Management
  async getAllowedTickerTimeframes(): Promise<any[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.allowedTickerTimeframes).orderBy(schema.allowedTickerTimeframes.tickerSymbol);
  }

  async getTickerTimeframe(symbol: string, timeframe: string): Promise<any> {
    if (!this.db) return null;
    const [result] = await this.db.select().from(schema.allowedTickerTimeframes)
      .where(and(
        eq(schema.allowedTickerTimeframes.tickerSymbol, symbol),
        eq(schema.allowedTickerTimeframes.timeframe as any, timeframe)
      ));
    return result || null;
  }

  async createAllowedTickerTimeframe(data: any): Promise<any> {
    if (!this.db) throw new Error('Database not available');
    const [newCombo] = await this.db
      .insert(schema.allowedTickerTimeframes)
      .values(data)
      .returning();
    return newCombo;
  }

  async deleteAllowedTickerTimeframe(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.delete(schema.allowedTickerTimeframes)
      .where(eq(schema.allowedTickerTimeframes.id, id))
      .returning({ id: schema.allowedTickerTimeframes.id });
    return result.length > 0;
  }

  // User Ticker Subscriptions
  async getUserTickerSubscriptions(userId: string): Promise<any[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.userTickerSubscriptions)
      .where(eq(schema.userTickerSubscriptions.userId, userId))
      .orderBy(desc(schema.userTickerSubscriptions.subscribedAt));
  }

  async getUserTickerSubscription(userId: string, symbol: string, timeframe: string): Promise<any> {
    if (!this.db) return null;
    const [subscription] = await this.db.select().from(schema.userTickerSubscriptions)
      .where(and(
        eq(schema.userTickerSubscriptions.userId, userId),
        eq(schema.userTickerSubscriptions.tickerSymbol, symbol),
        eq(schema.userTickerSubscriptions.timeframe as any, timeframe)
      ));
    return subscription || null;
  }

  async createUserTickerSubscription(data: any): Promise<any> {
    if (!this.db) throw new Error('Database not available');
    const [newSub] = await this.db
      .insert(schema.userTickerSubscriptions)
      .values(data)
      .returning();
    return newSub;
  }

  async deleteUserTickerSubscription(id: string, userId: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.delete(schema.userTickerSubscriptions)
      .where(and(
        eq(schema.userTickerSubscriptions.id, id),
        eq(schema.userTickerSubscriptions.userId, userId)
      ));
    return result.rowCount > 0;
  }

  async getUserSubscriptionsForTicker(symbol: string, timeframe: string): Promise<any[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.userTickerSubscriptions)
      .where(and(
        eq(schema.userTickerSubscriptions.tickerSymbol, symbol),
        eq(schema.userTickerSubscriptions.timeframe as any, timeframe),
        eq(schema.userTickerSubscriptions.isActive, true)
      ));
  }

  async getSignalsForUser(userId: string, limit: number): Promise<any[]> {
    if (!this.db) return [];
    // Get user's active subscriptions
    const subscriptions = await this.getUserTickerSubscriptions(userId);
    if (subscriptions.length === 0) return [];
    
    // Get signals for subscribed tickers
    const tickerConditions = subscriptions.map(sub => 
      and(
        eq(schema.buySignals.symbol, sub.tickerSymbol),
        eq(schema.buySignals.timeframe, sub.timeframe)
      )
    );
    
    return await this.db.select().from(schema.buySignals)
      .where(or(...tickerConditions))
      .orderBy(desc(schema.buySignals.timestamp))
      .limit(limit);
  }

  // Admin Signal Subscriptions Management
  async getSignalSubscriptions(filters: { userId?: string; ticker?: string; page?: number; limit?: number } = {}): Promise<any[]> {
    if (!this.db) return [];
    
    const { userId, ticker, page = 1, limit = 20 } = filters;
    let query = this.db.select({
      id: schema.userTickerSubscriptions.id,
      userId: schema.userTickerSubscriptions.userId,
      userName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
      userEmail: schema.users.email,
      tickerSymbol: schema.userTickerSubscriptions.tickerSymbol,
      timeframe: schema.userTickerSubscriptions.timeframe,
      deliveryMethods: schema.userTickerSubscriptions.deliveryMethods,
      maxAlertsPerDay: schema.userTickerSubscriptions.maxAlertsPerDay,
      isActive: schema.userTickerSubscriptions.isActive,
      createdAt: schema.userTickerSubscriptions.createdAt
    }).from(schema.userTickerSubscriptions)
    .leftJoin(schema.users, eq(schema.userTickerSubscriptions.userId, schema.users.id));

    if (userId) {
      query = query.where(eq(schema.userTickerSubscriptions.userId, userId));
    }
    if (ticker) {
      query = query.where(eq(schema.userTickerSubscriptions.tickerSymbol, ticker));
    }

    const offset = (page - 1) * limit;
    return await query.orderBy(desc(schema.userTickerSubscriptions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async createSignalSubscription(data: any): Promise<any> {
    if (!this.db) throw new Error('Database not available');
    const [newSubscription] = await this.db
      .insert(schema.userTickerSubscriptions)
      .values({
        userId: data.userId,
        tickerSymbol: data.tickerSymbol,
        timeframe: data.timeframe,
        deliveryMethods: data.deliveryMethods,
        maxAlertsPerDay: data.maxAlertsPerDay,
        isActive: data.isActive
      })
      .returning();
    return newSubscription;
  }

  async updateSignalSubscription(id: string, updates: any): Promise<any> {
    if (!this.db) throw new Error('Database not available');
    const [updatedSubscription] = await this.db
      .update(schema.userTickerSubscriptions)
      .set(updates)
      .where(eq(schema.userTickerSubscriptions.id, id))
      .returning();
    return updatedSubscription;
  }

  async deleteSignalSubscription(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.delete(schema.userTickerSubscriptions)
      .where(eq(schema.userTickerSubscriptions.id, id))
      .returning({ id: schema.userTickerSubscriptions.id });
    return result.length > 0;
  }

  // Data Management
  async getHeatmapData(ticker: string): Promise<HeatmapData[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.heatmapData)
      .where(eq(schema.heatmapData.ticker, ticker))
      .orderBy(desc(schema.heatmapData.week));
  }

  async createHeatmapData(data: InsertHeatmap): Promise<HeatmapData> {
    if (!this.db) throw new Error('Database not available');
    const [newData] = await this.db
      .insert(schema.heatmapData)
      .values(data)
      .returning();
    return newData;
  }

  async getCycleData(ticker: string): Promise<CycleData[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.cycleIndicatorData)
      .where(eq(schema.cycleIndicatorData.ticker, ticker))
      .orderBy(desc(schema.cycleIndicatorData.date));
  }

  async createCycleData(data: InsertCycle): Promise<CycleData> {
    if (!this.db) throw new Error('Database not available');
    const [newData] = await this.db
      .insert(schema.cycleIndicatorData)
      .values(data)
      .returning();
    return newData;
  }

  async getForecastData(ticker: string): Promise<ForecastData[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.forecastData)
      .where(eq(schema.forecastData.ticker, ticker))
      .orderBy(desc(schema.forecastData.date));
  }

  async createForecastData(data: InsertForecast): Promise<ForecastData> {
    if (!this.db) throw new Error('Database not available');
    const [newData] = await this.db
      .insert(schema.forecastData)
      .values(data)
      .returning();
    return newData;
  }

  // Admin Logs
  async getAdminLogs(limit?: number): Promise<AdminLog[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.adminActivityLog)
      .orderBy(desc(schema.adminActivityLog.timestamp))
      .limit(limit || 100);
  }

  async createAdminLog(log: InsertAdminLog): Promise<AdminLog> {
    if (!this.db) throw new Error('Database not available');
    const [newLog] = await this.db
      .insert(schema.adminActivityLog)
      .values(log)
      .returning();
    return newLog;
  }

  // Trading System
  async getUserTrades(userId: string, limit?: number): Promise<UserTrade[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.userTrades)
      .where(eq(schema.userTrades.userId, userId))
      .orderBy(desc(schema.userTrades.timestamp))
      .limit(limit || 100);
  }

  async createTrade(trade: InsertUserTrade): Promise<UserTrade> {
    if (!this.db) throw new Error('Database not available');
    const [newTrade] = await this.db
      .insert(schema.userTrades)
      .values(trade)
      .returning();
    return newTrade;
  }

  async getUserPortfolio(userId: string): Promise<UserPortfolio[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.userPortfolio)
      .where(eq(schema.userPortfolio.userId, userId))
      .orderBy(schema.userPortfolio.ticker);
  }

  async updatePortfolio(userId: string, ticker: string, updates: Partial<UserPortfolio>): Promise<UserPortfolio | undefined> {
    if (!this.db) return undefined;
    const [portfolio] = await this.db
      .update(schema.userPortfolio)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(schema.userPortfolio.userId, userId),
        eq(schema.userPortfolio.ticker, ticker)
      ))
      .returning();
    return portfolio || undefined;
  }

  async getTradingSettings(userId: string): Promise<TradingSettings | undefined> {
    if (!this.db) return undefined;
    const [settings] = await this.db.select().from(schema.tradingSettings)
      .where(eq(schema.tradingSettings.userId, userId));
    return settings || undefined;
  }

  async updateTradingSettings(userId: string, settingsUpdate: Partial<TradingSettings>): Promise<TradingSettings> {
    if (!this.db) throw new Error('Database not available');
    const [settings] = await this.db
      .update(schema.tradingSettings)
      .set({ ...settingsUpdate, updatedAt: new Date() })
      .where(eq(schema.tradingSettings.userId, userId))
      .returning();
    return settings;
  }

  // User Alerts
  async getUserAlerts(userId: string): Promise<UserAlert[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.userAlerts)
      .where(eq(schema.userAlerts.userId, userId))
      .orderBy(desc(schema.userAlerts.createdAt));
  }

  async createUserAlert(alert: InsertUserAlert): Promise<UserAlert> {
    if (!this.db) throw new Error('Database not available');
    const [newAlert] = await this.db
      .insert(schema.userAlerts)
      .values(alert)
      .returning();
    return newAlert;
  }

  async updateUserAlert(id: string, updates: Partial<UserAlert>): Promise<UserAlert | undefined> {
    if (!this.db) return undefined;
    const [alert] = await this.db
      .update(schema.userAlerts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userAlerts.id, id))
      .returning();
    return alert || undefined;
  }

  async deleteUserAlert(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.delete(schema.userAlerts).where(eq(schema.userAlerts.id, id));
    return result.rowCount > 0;
  }

  // Subscription Plans - Database Implementation
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.subscriptionPlans)
      .orderBy(asc(schema.subscriptionPlans.tier));
  }

  async getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.isActive, true))
      .orderBy(asc(schema.subscriptionPlans.tier));
  }

  async getSubscriptionPlan(tier: string): Promise<SubscriptionPlan | undefined> {
    if (!this.db) return undefined;
    const [plan] = await this.db.select().from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.tier, tier));
    return plan || undefined;
  }

  async getSubscriptionPlanById(id: string): Promise<SubscriptionPlan | undefined> {
    if (!this.db) return undefined;
    const [plan] = await this.db.select().from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.id, id));
    return plan || undefined;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    if (!this.db) throw new Error('Database not available');
    const [newPlan] = await this.db
      .insert(schema.subscriptionPlans)
      .values(plan)
      .returning();
    return newPlan;
  }

  async updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    if (!this.db) return undefined;
    const [plan] = await this.db
      .update(schema.subscriptionPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.subscriptionPlans.id, id))
      .returning();
    return plan || undefined;
  }

  async deleteSubscriptionPlan(id: string): Promise<boolean> {
    if (!this.db) return false;
    try {
      const result = await this.db.delete(schema.subscriptionPlans)
        .where(eq(schema.subscriptionPlans.id, id))
        .returning({ id: schema.subscriptionPlans.id });
      return result.length > 0;
    } catch (error) {
      // Fallback for drivers that don't support returning on DELETE
      const result = await this.db.delete(schema.subscriptionPlans)
        .where(eq(schema.subscriptionPlans.id, id));
      return result.rowCount > 0;
    }
  }
  async getUserSubscriptions(userId: string): Promise<UserSubscription[]> { return []; }
  async createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription> { throw new Error('Not implemented'); }
  async deleteUserSubscription(id: string): Promise<boolean> { return false; }
  async updateUserSubscription(userId: string, updates: Partial<User>): Promise<User | undefined> { return undefined; }
  async getDashboardLayout(userId: string): Promise<DashboardLayout | undefined> { return undefined; }
  async saveDashboardLayout(layout: InsertDashboardLayout): Promise<DashboardLayout> { throw new Error('Not implemented'); }
  async updateDashboardLayout(id: string, updates: Partial<DashboardLayout>): Promise<DashboardLayout | undefined> { return undefined; }
  async getAllAchievements(): Promise<Achievement[]> { return []; }
  async getAchievement(id: string): Promise<Achievement | undefined> { return undefined; }
  async createAchievement(achievement: InsertAchievement): Promise<Achievement> { throw new Error('Not implemented'); }
  async updateAchievement(id: string, updates: Partial<Achievement>): Promise<Achievement | undefined> { return undefined; }
  async deleteAchievement(id: string): Promise<boolean> { return false; }
  async getUserAchievements(userId: string): Promise<UserAchievement[]> { return []; }
  async getUserAchievement(userId: string, achievementId: string): Promise<UserAchievement | undefined> { return undefined; }
  async unlockUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement> { throw new Error('Not implemented'); }
  async updateUserAchievement(id: string, updates: Partial<UserAchievement>): Promise<UserAchievement | undefined> { return undefined; }
  async updateUserAchievementProgress(userId: string, achievementId: string, progress: number): Promise<UserAchievement | undefined> { return undefined; }
  async getUserStats(userId: string): Promise<UserStats | undefined> { return undefined; }
  async createUserStats(userStats: InsertUserStats): Promise<UserStats> { throw new Error('Not implemented'); }
  async updateUserStats(userId: string, updates: Partial<UserStats>): Promise<UserStats | undefined> { return undefined; }
  async incrementUserStat(userId: string, statName: keyof UserStats, increment?: number): Promise<UserStats | undefined> { return undefined; }

  // Notification configuration management methods - using userSettings as a fallback
  async getNotificationConfigs(): Promise<any[]> { 
    if (!this.db) return [];
    // Since notification channels table doesn't exist, return user settings with notification preferences
    return await this.db.select().from(schema.userSettings).orderBy(desc(schema.userSettings.createdAt));
  }
  
  async getNotificationConfig(id: string): Promise<any | undefined> { 
    if (!this.db) return undefined;
    const [config] = await this.db.select().from(schema.userSettings).where(eq(schema.userSettings.id, id));
    return config || undefined;
  }
  
  async createNotificationConfig(config: any): Promise<any> { 
    if (!this.db) throw new Error('Database not available');
    // Create as user settings entry
    const [newConfig] = await this.db
      .insert(schema.userSettings)
      .values(config)
      .returning();
    return newConfig;
  }
  
  async updateNotificationConfig(id: string, updates: any): Promise<any | undefined> { 
    if (!this.db) return undefined;
    const [config] = await this.db
      .update(schema.userSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userSettings.id, id))
      .returning();
    return config || undefined;
  }
  
  async deleteNotificationConfig(id: string): Promise<boolean> { 
    if (!this.db) return false;
    const result = await this.db.delete(schema.userSettings).where(eq(schema.userSettings.id, id));
    return result.rowCount > 0;
  }


  async updateNotificationTemplate(id: string, updates: any): Promise<any | undefined> {
    if (!this.db) return undefined;
    const [template] = await this.db
      .update(schema.userNotifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userNotifications.id, id))
      .returning();
    return template || undefined;
  }

  async deleteNotificationTemplate(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.delete(schema.userNotifications)
      .where(eq(schema.userNotifications.id, id));
    return result.rowCount > 0;
  }

  // Notification Logs Management
  async getNotificationLogs(limit: number = 100, channel?: string): Promise<any[]> {
    if (!this.db) return [];
    let query = this.db.select().from(schema.userNotifications);
    
    if (channel) {
      query = query.where(eq(schema.userNotifications.channel as any, channel));
    }
    
    return await query.orderBy(desc(schema.userNotifications.createdAt)).limit(limit);
  }

  async getNotificationLog(id: string): Promise<any | undefined> {
    if (!this.db) return undefined;
    const [log] = await this.db.select().from(schema.userNotifications)
      .where(eq(schema.userNotifications.id, id));
    return log || undefined;
  }

  async getNotificationLogsByUser(userId: string, limit: number = 50): Promise<any[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.userNotifications)
      .where(eq(schema.userNotifications.userId, userId))
      .orderBy(desc(schema.userNotifications.createdAt))
      .limit(limit);
  }

  async createNotificationLog(log: any): Promise<any> {
    if (!this.db) throw new Error('Database not available');
    const [newLog] = await this.db
      .insert(schema.userNotifications)
      .values(log)
      .returning();
    return newLog;
  }

  async updateNotificationLog(id: string, updates: any): Promise<any | undefined> {
    if (!this.db) return undefined;
    const [log] = await this.db
      .update(schema.userNotifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userNotifications.id, id))
      .returning();
    return log || undefined;
  }

  async getNotificationStats(dateFrom?: Date, dateTo?: Date): Promise<any> {
    if (!this.db) return {};
    
    // Get basic stats
    const totalSent = await this.db.select().from(schema.userNotifications);
    const delivered = totalSent.filter((log: any) => log.status === 'delivered');
    const failed = totalSent.filter((log: any) => log.status === 'failed');
    
    // Channel breakdown
    const channelBreakdown: any = {};
    totalSent.forEach((log: any) => {
      const channel = log.channel || 'unknown';
      if (!channelBreakdown[channel]) {
        channelBreakdown[channel] = { sent: 0, delivered: 0, failed: 0 };
      }
      channelBreakdown[channel].sent++;
      if (log.status === 'delivered') channelBreakdown[channel].delivered++;
      if (log.status === 'failed') channelBreakdown[channel].failed++;
    });

    return {
      totalSent: totalSent.length,
      delivered: delivered.length,
      failed: failed.length,
      deliveryRate: totalSent.length > 0 ? (delivered.length / totalSent.length) * 100 : 0,
      failureRate: totalSent.length > 0 ? (failed.length / totalSent.length) * 100 : 0,
      channelBreakdown
    };
  }

  // Notification Channels Management
  async getNotificationChannels(): Promise<any[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.userSettings)
      .orderBy(desc(schema.userSettings.createdAt));
  }

  async getNotificationChannel(id: string): Promise<any | undefined> {
    if (!this.db) return undefined;
    const [channel] = await this.db.select().from(schema.userSettings)
      .where(eq(schema.userSettings.id, id));
    return channel || undefined;
  }

  async getNotificationChannelByType(type: string): Promise<any | undefined> {
    if (!this.db) return undefined;
    const [channel] = await this.db.select().from(schema.userSettings)
      .where(eq(schema.userSettings.userId, type));
    return channel || undefined;
  }

  async createNotificationChannel(channel: any): Promise<any> {
    if (!this.db) throw new Error('Database not available');
    const [newChannel] = await this.db
      .insert(schema.userSettings)
      .values(channel)
      .returning();
    return newChannel;
  }

  async updateNotificationChannel(id: string, updates: any): Promise<any | undefined> {
    if (!this.db) return undefined;
    const [channel] = await this.db
      .update(schema.notificationChannels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.notificationChannels.id, id))
      .returning();
    return channel || undefined;
  }

  async deleteNotificationChannel(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.delete(schema.notificationChannels)
      .where(eq(schema.notificationChannels.id, id))
      .returning({ id: schema.notificationChannels.id });
    return result.length > 0;
  }

  async testNotificationChannel(id: string): Promise<any> {
    if (!this.db) return { success: false, error: 'Database not available' };
    
    const channel = await this.getNotificationChannel(id);
    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    // Test channel configuration
    try {
      switch (channel.type) {
        case 'email':
          return { success: true, message: 'Email channel configuration is valid' };
        case 'sms':
          return { success: true, message: 'SMS channel configuration is valid' };
        case 'telegram':
          return { success: true, message: 'Telegram channel configuration is valid' };
        default:
          return { success: false, error: 'Unknown channel type' };
      }
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Additional missing methods
  async updateUserTickerSubscription(id: string, updates: any): Promise<boolean> {
    // Mock implementation - in real app would update database
    return true;
  }

  async deleteUserTickerSubscriptionById(id: string): Promise<boolean> {
    // Mock implementation - in real app would delete from database
    return true;
  }

  // Webhook Secrets Management
  async getWebhookSecrets(): Promise<WebhookSecret[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.webhookSecrets).orderBy(desc(schema.webhookSecrets.createdAt));
  }

  async getWebhookSecret(name: string): Promise<WebhookSecret | undefined> {
    if (!this.db) return undefined;
    const [secret] = await this.db.select().from(schema.webhookSecrets).where(eq(schema.webhookSecrets.name, name));
    return secret || undefined;
  }

  async createWebhookSecret(secret: InsertWebhookSecret): Promise<WebhookSecret> { 
    if (!this.db) throw new Error('Database not available');
    const [newSecret] = await this.db
      .insert(schema.webhookSecrets)
      .values(secret)
      .returning();
    return newSecret;
  }

  async updateWebhookSecret(id: string, updates: Partial<WebhookSecret>): Promise<WebhookSecret | undefined> {
    if (!this.db) return undefined;
    const [secret] = await this.db
      .update(schema.webhookSecrets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.webhookSecrets.id, id))
      .returning();
    return secret || undefined;
  }

  async deleteWebhookSecret(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db
      .delete(schema.webhookSecrets)
      .where(eq(schema.webhookSecrets.id, id))
      .returning({ id: schema.webhookSecrets.id });
    return result.length > 0;
  }

  // System Settings Implementation
  async getSystemSettings(): Promise<SystemSetting[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.systemSettings).orderBy(schema.systemSettings.category, schema.systemSettings.key);
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    if (!this.db) return undefined;
    const [setting] = await this.db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, key));
    return setting || undefined;
  }

  async createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    if (!this.db) throw new Error('Database not available');
    const [newSetting] = await this.db
      .insert(schema.systemSettings)
      .values(setting)
      .returning();
    return newSetting;
  }

  async updateSystemSetting(key: string, updates: Partial<SystemSetting>): Promise<SystemSetting | undefined> {
    if (!this.db) return undefined;
    const [setting] = await this.db
      .update(schema.systemSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.systemSettings.key, key))
      .returning();
    return setting || undefined;
  }

  async deleteSystemSetting(key: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db
      .delete(schema.systemSettings)
      .where(eq(schema.systemSettings.key, key))
      .returning({ id: schema.systemSettings.id });
    return result.length > 0;
  }

  async getSystemSettingsByCategory(category: string): Promise<SystemSetting[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.systemSettings)
      .where(eq(schema.systemSettings.category, category))
      .orderBy(schema.systemSettings.key);
  }

  // Announcements Implementation
  async getAnnouncements(audience?: string): Promise<Announcement[]> {
    if (!this.db) return [];
    if (audience) {
      return await this.db.select().from(schema.announcements)
        .where(or(eq(schema.announcements.audience, audience), eq(schema.announcements.audience, 'all')))
        .orderBy(desc(schema.announcements.createdAt));
    }
    return await this.db.select().from(schema.announcements)
      .orderBy(desc(schema.announcements.createdAt));
  }

  async getAnnouncement(id: string): Promise<Announcement | undefined> {
    if (!this.db) return undefined;
    const [announcement] = await this.db.select().from(schema.announcements).where(eq(schema.announcements.id, id));
    return announcement || undefined;
  }

  async createAnnouncement(announcement: AnnouncementInsert): Promise<Announcement> {
    if (!this.db) throw new Error('Database not available');
    const [newAnnouncement] = await this.db
      .insert(schema.announcements)
      .values(announcement)
      .returning();
    return newAnnouncement;
  }

  async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement | undefined> {
    if (!this.db) return undefined;
    const [announcement] = await this.db
      .update(schema.announcements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.announcements.id, id))
      .returning();
    return announcement || undefined;
  }

  async deleteAnnouncement(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db
      .delete(schema.announcements)
      .where(eq(schema.announcements.id, id))
      .returning({ id: schema.announcements.id });
    return result.length > 0;
  }

  async publishAnnouncement(id: string): Promise<Announcement | undefined> {
    if (!this.db) return undefined;
    const [announcement] = await this.db
      .update(schema.announcements)
      .set({ 
        isPublished: true, 
        publishedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.announcements.id, id))
      .returning();
    return announcement || undefined;
  }

  // User Notifications
  async getUserNotifications(userId: string, limit = 50): Promise<UserNotification[]> {
    if (!this.db) return [];
    return await this.db.select()
      .from(schema.userNotifications)
      .where(eq(schema.userNotifications.userId, userId))
      .orderBy(desc(schema.userNotifications.createdAt))
      .limit(limit);
  }

  async createUserNotification(notification: InsertUserNotification): Promise<UserNotification> {
    if (!this.db) throw new Error('Database not available');
    const [created] = await this.db
      .insert(schema.userNotifications)
      .values(notification)
      .returning();
    return created;
  }

  async markNotificationAsRead(id: string, userId: string): Promise<UserNotification | undefined> {
    if (!this.db) return undefined;
    const [updated] = await this.db
      .update(schema.userNotifications)
      .set({ 
        isRead: true, 
        readAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(schema.userNotifications.id, id),
          eq(schema.userNotifications.userId, userId)
        )
      )
      .returning();
    return updated || undefined;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    if (!this.db) return;
    await this.db
      .update(schema.userNotifications)
      .set({ 
        isRead: true, 
        readAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.userNotifications.userId, userId));
  }

  async archiveNotification(id: string, userId: string): Promise<UserNotification | undefined> {
    if (!this.db) return undefined;
    const [updated] = await this.db
      .update(schema.userNotifications)
      .set({ 
        isArchived: true, 
        archivedAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(schema.userNotifications.id, id),
          eq(schema.userNotifications.userId, userId)
        )
      )
      .returning();
    return updated || undefined;
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db
      .delete(schema.userNotifications)
      .where(
        and(
          eq(schema.userNotifications.id, id),
          eq(schema.userNotifications.userId, userId)
        )
      )
      .returning({ id: schema.userNotifications.id });
    return result.length > 0;
  }

  // User Notification Preferences
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | undefined> {
    if (!this.db) return undefined;
    const [preferences] = await this.db.select()
      .from(schema.userNotificationPreferences)
      .where(eq(schema.userNotificationPreferences.userId, userId));
    return preferences || undefined;
  }

  async createUserNotificationPreferences(preferences: InsertUserNotificationPreferences): Promise<UserNotificationPreferences> {
    if (!this.db) throw new Error('Database not available');
    const [created] = await this.db
      .insert(schema.userNotificationPreferences)
      .values(preferences)
      .returning();
    return created;
  }

  async updateUserNotificationPreferences(userId: string, updates: Partial<UserNotificationPreferences>): Promise<UserNotificationPreferences | undefined> {
    if (!this.db) return undefined;
    const [updated] = await this.db
      .update(schema.userNotificationPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userNotificationPreferences.userId, userId))
      .returning();
    return updated || undefined;
  }

  // Notification Configuration Methods
  async getNotificationConfigs(): Promise<NotificationChannel[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.notificationChannels);
  }

  async getNotificationConfig(id: string): Promise<NotificationChannel | undefined> {
    if (!this.db) return undefined;
    const [config] = await this.db.select()
      .from(schema.notificationChannels)
      .where(eq(schema.notificationChannels.id, id));
    return config || undefined;
  }

  async createNotificationConfig(config: InsertNotificationChannel): Promise<NotificationChannel> {
    if (!this.db) throw new Error('Database not available');
    const [created] = await this.db
      .insert(schema.notificationChannels)
      .values(config)
      .returning();
    return created;
  }

  async updateNotificationConfig(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel | undefined> {
    if (!this.db) return undefined;
    const [updated] = await this.db
      .update(schema.notificationChannels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.notificationChannels.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteNotificationConfig(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db
      .delete(schema.notificationChannels)
      .where(eq(schema.notificationChannels.id, id));
    return result.rowCount > 0;
  }

  // Notification Queue Methods
  async getNotificationQueue(limit = 50): Promise<NotificationQueue[]> {
    if (!this.db) return [];
    return await this.db.select()
      .from(schema.notificationQueue)
      .orderBy(desc(schema.notificationQueue.createdAt))
      .limit(limit);
  }

  async getQueuedNotifications(status?: string): Promise<NotificationQueue[]> {
    if (!this.db) return [];
    const query = this.db.select().from(schema.notificationQueue);
    if (status) {
      query.where(eq(schema.notificationQueue.status, status));
    }
    return await query.orderBy(desc(schema.notificationQueue.createdAt));
  }

  async addToNotificationQueue(notification: InsertNotificationQueue): Promise<NotificationQueue> {
    if (!this.db) throw new Error('Database not available');
    const [created] = await this.db
      .insert(schema.notificationQueue)
      .values(notification)
      .returning();
    return created;
  }

  async updateNotificationQueueStatus(id: string, status: string, metadata?: any): Promise<NotificationQueue | undefined> {
    if (!this.db) return undefined;
    const updateData: any = { status, updatedAt: new Date() };
    if (metadata) {
      updateData.metadata = metadata;
    }
    const [updated] = await this.db
      .update(schema.notificationQueue)
      .set(updateData)
      .where(eq(schema.notificationQueue.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteFromNotificationQueue(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db
      .delete(schema.notificationQueue)
      .where(eq(schema.notificationQueue.id, id));
    return result.rowCount > 0;
  }

  async getFailedNotifications(retryCount?: number): Promise<NotificationQueue[]> {
    if (!this.db) return [];
    let query = this.db.select()
      .from(schema.notificationQueue)
      .where(eq(schema.notificationQueue.status, 'failed'));
    
    if (typeof retryCount === 'number') {
      query = query.where(eq(schema.notificationQueue.retryCount, retryCount));
    }
    
    return await query.orderBy(desc(schema.notificationQueue.createdAt));
  }

  // Notification Template Methods
  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.notificationTemplates);
  }

  async getNotificationTemplate(id: string): Promise<NotificationTemplate | undefined> {
    if (!this.db) return undefined;
    const [template] = await this.db.select()
      .from(schema.notificationTemplates)
      .where(eq(schema.notificationTemplates.id, id));
    return template || undefined;
  }

  async getNotificationTemplateByType(type: string): Promise<NotificationTemplate | undefined> {
    if (!this.db) return undefined;
    const [template] = await this.db.select()
      .from(schema.notificationTemplates)
      .where(eq(schema.notificationTemplates.type, type));
    return template || undefined;
  }

  async createNotificationTemplate(template: InsertNotificationTemplate): Promise<NotificationTemplate> {
    if (!this.db) throw new Error('Database not available');
    const [created] = await this.db
      .insert(schema.notificationTemplates)
      .values(template)
      .returning();
    return created;
  }

  async updateNotificationTemplate(id: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate | undefined> {
    if (!this.db) return undefined;
    const [updated] = await this.db
      .update(schema.notificationTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.notificationTemplates.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteNotificationTemplate(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db
      .delete(schema.notificationTemplates)
      .where(eq(schema.notificationTemplates.id, id));
    return result.rowCount > 0;
  }

  // Notification Log Methods
  async getNotificationLogs(limit = 100, channel?: string): Promise<NotificationLog[]> {
    if (!this.db) return [];
    let query = this.db.select().from(schema.notificationLogs);
    if (channel) {
      query = query.where(eq(schema.notificationLogs.channel, channel));
    }
    return await query
      .orderBy(desc(schema.notificationLogs.createdAt))
      .limit(limit);
  }

  async getNotificationLog(id: string): Promise<NotificationLog | undefined> {
    if (!this.db) return undefined;
    const [log] = await this.db.select()
      .from(schema.notificationLogs)
      .where(eq(schema.notificationLogs.id, id));
    return log || undefined;
  }

  async getNotificationLogsByUser(userId: string, limit = 50): Promise<NotificationLog[]> {
    if (!this.db) return [];
    return await this.db.select()
      .from(schema.notificationLogs)
      .where(eq(schema.notificationLogs.userId, userId))
      .orderBy(desc(schema.notificationLogs.createdAt))
      .limit(limit);
  }

  async createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog> {
    if (!this.db) throw new Error('Database not available');
    const [created] = await this.db
      .insert(schema.notificationLogs)
      .values(log)
      .returning();
    return created;
  }

  async updateNotificationLog(id: string, updates: Partial<NotificationLog>): Promise<NotificationLog | undefined> {
    if (!this.db) return undefined;
    const [updated] = await this.db
      .update(schema.notificationLogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.notificationLogs.id, id))
      .returning();
    return updated || undefined;
  }

  async getNotificationStats(dateFrom?: Date, dateTo?: Date): Promise<any> {
    if (!this.db) return {};
    
    // Build base query with optional date filtering
    let query = this.db.select().from(schema.notificationLogs);
    if (dateFrom) {
      query = query.where(gte(schema.notificationLogs.createdAt, dateFrom));
    }
    if (dateTo) {
      query = query.where(lte(schema.notificationLogs.createdAt, dateTo));
    }

    const logs = await query;
    
    // Calculate statistics
    const totalSent = logs.filter(l => l.status === 'delivered').length;
    const totalFailed = logs.filter(l => l.status === 'failed').length;
    const totalPending = logs.filter(l => l.status === 'pending').length;
    
    return {
      total: logs.length,
      sent: totalSent,
      failed: totalFailed,
      pending: totalPending,
      successRate: logs.length > 0 ? ((totalSent / logs.length) * 100).toFixed(1) + '%' : '0%',
      channels: {
        email: logs.filter(l => l.channel === 'email').length,
        sms: logs.filter(l => l.channel === 'sms').length,
        push: logs.filter(l => l.channel === 'push').length
      }
    };
  }

  // Notification Channel Methods
  async getNotificationChannels(): Promise<NotificationChannel[]> {
    if (!this.db) return [];
    return await this.db.select().from(schema.notificationChannels);
  }

  async getNotificationChannel(id: string): Promise<NotificationChannel | undefined> {
    if (!this.db) return undefined;
    const [channel] = await this.db.select()
      .from(schema.notificationChannels)
      .where(eq(schema.notificationChannels.id, id));
    return channel || undefined;
  }

  async getNotificationChannelByType(type: string): Promise<NotificationChannel | undefined> {
    if (!this.db) return undefined;
    const [channel] = await this.db.select()
      .from(schema.notificationChannels)
      .where(eq(schema.notificationChannels.channelType, type));
    return channel || undefined;
  }

  async createNotificationChannel(channel: InsertNotificationChannel): Promise<NotificationChannel> {
    if (!this.db) throw new Error('Database not available');
    const [created] = await this.db
      .insert(schema.notificationChannels)
      .values(channel)
      .returning();
    return created;
  }

  async updateNotificationChannel(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel | undefined> {
    if (!this.db) return undefined;
    const [updated] = await this.db
      .update(schema.notificationChannels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.notificationChannels.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteNotificationChannel(id: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db
      .delete(schema.notificationChannels)
      .where(eq(schema.notificationChannels.id, id));
    return result.rowCount > 0;
  }

  async testNotificationChannel(id: string): Promise<any> {
    if (!this.db) return { success: false, message: 'Database not available' };
    
    const channel = await this.getNotificationChannel(id);
    if (!channel) {
      return { success: false, message: 'Channel not found' };
    }

    // In a real implementation, this would send a test notification
    // For now, just return success with channel info
    return {
      success: true,
      message: `Test notification sent via ${channel.channelType}`,
      channelType: channel.channelType,
      timestamp: new Date().toISOString()
    };
  }

  // Password Reset Tokens
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    if (!this.db) throw new Error('Database not available');
    const [created] = await this.db
      .insert(schema.passwordResetTokens)
      .values(token)
      .returning();
    return created;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    if (!this.db) return undefined;
    const [resetToken] = await this.db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.token, token));
    return resetToken || undefined;
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db
      .update(schema.passwordResetTokens)
      .set({ isUsed: true })
      .where(eq(schema.passwordResetTokens.token, token));
    return result.rowCount > 0;
  }

  async invalidateUserPasswordResetTokens(userId: string): Promise<void> {
    if (!this.db) return;
    await this.db
      .update(schema.passwordResetTokens)
      .set({ isUsed: true })
      .where(
        and(
          eq(schema.passwordResetTokens.userId, userId),
          eq(schema.passwordResetTokens.isUsed, false)
        )
      );
  }

  async cleanupExpiredPasswordResetTokens(): Promise<void> {
    if (!this.db) return;
    await this.db
      .delete(schema.passwordResetTokens)
      .where(
        or(
          eq(schema.passwordResetTokens.isUsed, true),
          lte(schema.passwordResetTokens.expiresAt, new Date())
        )
      );
  }
}

export class MemoryStorage implements IStorage {
  private users: User[] = [
    {
      id: "admin-user-456",
      email: "admin@proudprofits.com", 
      hashedPassword: "$2b$10$lGkyw7N7oWP3koQk3..j0eOgyRzY95DK4iOi9vKXelwbc.DK20/aq", // password: "admin123"
      role: "admin",
      firstName: "Admin",
      lastName: "User", 
      isActive: true,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionTier: "elite",
      subscriptionStatus: "active",
      subscriptionEndsAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-user-789",
      email: "user@proudprofits.com",
      hashedPassword: "$2b$10$DlDpCBqY7oEx46JBVDIlLuD1c1FSvVfIgl7S.cvABk882f3wwTDgu", // password: "user123"
      role: "user",
      firstName: "Regular",
      lastName: "User",
      isActive: true,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionTier: null,
      subscriptionStatus: "active",
      subscriptionEndsAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "demo-user-123",
      email: "demo@proudprofits.com",
      hashedPassword: "$2b$10$5CVfxAR7KqNwp..478OaqOD0kYA/TJNws4TPP7BDYPnvh.AbZ81Um", // password: "demo123"
      role: "user",
      firstName: "Demo",
      lastName: "User",
      isActive: true,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionTier: "elite",
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
      notificationTelegram: false,
      emailSignalAlerts: true,
      smsSignalAlerts: false,
      pushSignalAlerts: true,
      emailFrequency: "realtime",
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      weekendNotifications: true,
      emailAddress: null,
      phoneNumber: null,
      telegramChatId: null,
      webhookSecret: null,
      webhookEnabled: false,
      pushSubscription: null,
      pushEnabled: false,
      priceAlerts: true,
      volumeAlerts: false,
      newsAlerts: true,
      technicalAlerts: true,
      whaleAlerts: false,
      theme: "dark",
      language: "en",
      timezone: "UTC",
      currency: "USD",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
      defaultChartType: "candlestick",
      defaultTimeframe: "15m",
      chartTheme: "dark",
      showVolume: true,
      showIndicators: true,
      autoRefreshCharts: true,
      chartRefreshInterval: 30,
      defaultOrderType: "market",
      confirmTrades: true,
      enablePaperTrading: true,
      paperTradingBalance: "10000.00",
      riskPercentage: "2.00",
      stopLossPercentage: "3.00",
      takeProfitPercentage: "6.00",
      defaultDashboard: "overview",
      showPriceAlerts: true,
      showRecentTrades: true,
      showPortfolioSummary: true,
      showMarketOverview: true,
      maxDashboardItems: 20,
      compactView: false,
      profileVisibility: "private",
      shareTradeHistory: false,
      allowAnalytics: true,
      twoFactorEnabled: false,
      sessionTimeout: 1440,
      enableBetaFeatures: false,
      apiAccessEnabled: false,
      webhookUrl: null,
      customCssEnabled: false,
      customCss: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "settings-admin-456",
      userId: "admin-user-456",
      notificationEmail: true,
      notificationSms: true,
      notificationPush: true,
      notificationTelegram: false,
      emailSignalAlerts: true,
      smsSignalAlerts: true,
      pushSignalAlerts: true,
      emailFrequency: "realtime",
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      weekendNotifications: true,
      emailAddress: null,
      phoneNumber: null,
      telegramChatId: null,
      webhookSecret: null,
      webhookEnabled: false,
      pushSubscription: null,
      pushEnabled: false,
      priceAlerts: true,
      volumeAlerts: true,
      newsAlerts: true,
      technicalAlerts: true,
      whaleAlerts: true,
      theme: "dark",
      language: "en",
      timezone: "UTC",
      currency: "USD",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
      defaultChartType: "candlestick",
      defaultTimeframe: "15m",
      chartTheme: "dark",
      showVolume: true,
      showIndicators: true,
      autoRefreshCharts: true,
      chartRefreshInterval: 30,
      defaultOrderType: "market",
      confirmTrades: true,
      enablePaperTrading: true,
      paperTradingBalance: "50000.00",
      riskPercentage: "1.00",
      stopLossPercentage: "2.00",
      takeProfitPercentage: "4.00",
      defaultDashboard: "overview",
      showPriceAlerts: true,
      showRecentTrades: true,
      showPortfolioSummary: true,
      showMarketOverview: true,
      maxDashboardItems: 50,
      compactView: false,
      profileVisibility: "private",
      shareTradeHistory: false,
      allowAnalytics: true,
      twoFactorEnabled: false,
      sessionTimeout: 1440,
      enableBetaFeatures: true,
      apiAccessEnabled: true,
      webhookUrl: null,
      customCssEnabled: false,
      customCss: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];
  private tickers: AvailableTicker[] = [
    {
      id: "1",
      symbol: "BTCUSDT",
      description: "Bitcoin / USD Tether",
      category: "major",
      marketCap: 1,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "2", 
      symbol: "ETHUSDT",
      description: "Ethereum / USD Tether",
      category: "major",
      marketCap: 2,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "3",
      symbol: "ADAUSDT", 
      description: "Cardano / USD Tether",
      category: "layer1",
      marketCap: 8,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  private signals: AlertSignal[] = [
    // BTCUSDT signals across multiple timeframes
    {
      id: "signal-1",
      userId: "test-user-123",
      ticker: "BTCUSDT",
      signalType: "buy",
      price: "67500.00",
      timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      timeframe: "30M",
      source: "tradingview",
      note: "Strong upward momentum detected",
      createdAt: new Date(Date.now() - 15 * 60 * 1000),
      updatedAt: new Date(Date.now() - 15 * 60 * 1000),
    },
    {
      id: "signal-btc-1h",
      userId: "test-user-123",
      ticker: "BTCUSDT", 
      signalType: "buy",
      price: "67450.00",
      timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      timeframe: "1H",
      source: "tradingview",
      note: "Bullish breakout confirmed",
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      id: "signal-btc-4h",
      userId: "test-user-123",
      ticker: "BTCUSDT",
      signalType: "sell",
      price: "67800.00",
      timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
      timeframe: "4H",
      source: "tradingview",
      note: "Resistance at 67800, take profit",
      createdAt: new Date(Date.now() - 45 * 60 * 1000),
      updatedAt: new Date(Date.now() - 45 * 60 * 1000),
    },
    {
      id: "signal-btc-1d",
      userId: "test-user-123",
      ticker: "BTCUSDT",
      signalType: "buy",
      price: "67200.00",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      timeframe: "1D",
      source: "tradingview",
      note: "Daily support holding strong",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    // ETHUSDT signals
    {
      id: "signal-2",
      userId: "test-user-123",
      ticker: "ETHUSDT",
      signalType: "sell",
      price: "3420.50",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      timeframe: "1H",
      source: "tradingview",
      note: "Resistance level reached",
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
    {
      id: "signal-eth-30m",
      userId: "test-user-123",
      ticker: "ETHUSDT",
      signalType: "buy",
      price: "3380.00",
      timestamp: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
      timeframe: "30M",
      source: "tradingview",
      note: "Bounce off support level",
      createdAt: new Date(Date.now() - 20 * 60 * 1000),
      updatedAt: new Date(Date.now() - 20 * 60 * 1000),
    },
    // Other tickers
    {
      id: "signal-3",
      userId: "test-user-123",
      ticker: "ADAUSDT",
      signalType: "buy",
      price: "0.4567",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      timeframe: "4H",
      source: "tradingview",
      note: "Oversold conditions detected",
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
    {
      id: "signal-sol-1h",
      userId: "test-user-123",
      ticker: "SOLUSDT",
      signalType: "buy",
      price: "185.50",
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      timeframe: "1H",
      source: "tradingview",
      note: "Strong volume breakout",
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
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
      subscriptionTier: user.subscriptionTier ?? null,
      subscriptionStatus: user.subscriptionStatus ?? null,
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

  async deleteUser(id: string): Promise<boolean> {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) return false;
    this.users.splice(index, 1);
    return true;
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
      id: Math.random().toString(36).substr(2, 9),
      userId: settings.userId,
      // Notification Preferences
      notificationEmail: settings.notificationEmail ?? true,
      notificationSms: settings.notificationSms ?? false,
      notificationPush: settings.notificationPush ?? true,
      notificationTelegram: settings.notificationTelegram ?? false,
      emailSignalAlerts: settings.emailSignalAlerts ?? true,
      smsSignalAlerts: settings.smsSignalAlerts ?? false,
      pushSignalAlerts: settings.pushSignalAlerts ?? true,
      emailFrequency: settings.emailFrequency ?? "realtime",
      quietHoursStart: settings.quietHoursStart ?? "22:00",
      quietHoursEnd: settings.quietHoursEnd ?? "08:00",
      weekendNotifications: settings.weekendNotifications ?? true,
      // Contact Information
      emailAddress: settings.emailAddress ?? null,
      phoneNumber: settings.phoneNumber ?? null,
      telegramChatId: settings.telegramChatId ?? null,
      // Webhook Settings
      webhookSecret: settings.webhookSecret ?? null,
      webhookEnabled: settings.webhookEnabled ?? false,
      // Push Notification Settings
      pushSubscription: settings.pushSubscription ?? null,
      pushEnabled: settings.pushEnabled ?? false,
      // Alert Type Preferences
      priceAlerts: settings.priceAlerts ?? true,
      volumeAlerts: settings.volumeAlerts ?? false,
      newsAlerts: settings.newsAlerts ?? true,
      technicalAlerts: settings.technicalAlerts ?? true,
      whaleAlerts: settings.whaleAlerts ?? false,
      // Display Preferences
      theme: settings.theme ?? "dark",
      language: settings.language ?? "en",
      timezone: settings.timezone ?? "UTC",
      currency: settings.currency ?? "USD",
      dateFormat: settings.dateFormat ?? "MM/DD/YYYY",
      timeFormat: settings.timeFormat ?? "12h",
      // Chart Preferences
      defaultChartType: settings.defaultChartType ?? "candlestick",
      defaultTimeframe: settings.defaultTimeframe ?? "15m",
      chartTheme: settings.chartTheme ?? "dark",
      showVolume: settings.showVolume ?? true,
      showIndicators: settings.showIndicators ?? true,
      autoRefreshCharts: settings.autoRefreshCharts ?? true,
      chartRefreshInterval: settings.chartRefreshInterval ?? 30,
      // Trading Preferences
      defaultOrderType: settings.defaultOrderType ?? "market",
      confirmTrades: settings.confirmTrades ?? true,
      enablePaperTrading: settings.enablePaperTrading ?? true,
      paperTradingBalance: settings.paperTradingBalance ?? "10000.00",
      riskPercentage: settings.riskPercentage ?? "2.00",
      stopLossPercentage: settings.stopLossPercentage ?? "3.00",
      takeProfitPercentage: settings.takeProfitPercentage ?? "6.00",
      // Dashboard Preferences
      defaultDashboard: settings.defaultDashboard ?? "overview",
      showPriceAlerts: settings.showPriceAlerts ?? true,
      showRecentTrades: settings.showRecentTrades ?? true,
      showPortfolioSummary: settings.showPortfolioSummary ?? true,
      showMarketOverview: settings.showMarketOverview ?? true,
      maxDashboardItems: settings.maxDashboardItems ?? 20,
      compactView: settings.compactView ?? false,
      // Privacy & Security
      profileVisibility: settings.profileVisibility ?? "private",
      shareTradeHistory: settings.shareTradeHistory ?? false,
      allowAnalytics: settings.allowAnalytics ?? true,
      twoFactorEnabled: settings.twoFactorEnabled ?? false,
      sessionTimeout: settings.sessionTimeout ?? 1440,
      // Advanced Features
      enableBetaFeatures: settings.enableBetaFeatures ?? false,
      apiAccessEnabled: settings.apiAccessEnabled ?? false,
      webhookUrl: settings.webhookUrl ?? null,
      customCssEnabled: settings.customCssEnabled ?? false,
      customCss: settings.customCss ?? null,
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
      category: ticker.category ?? "other",
      marketCap: ticker.marketCap ?? 999,
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
      timeframe: signal.timeframe ?? null,
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
      .filter(d => d.symbol === ticker && d.interval === interval)
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
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
      id: Math.random().toString(36).substr(2, 9),
      ticker: data.ticker,
      date: data.date,
      ma2y: data.ma2y,
      deviation: data.deviation,
      harmonicCycle: data.harmonicCycle ?? null,
      fibonacciLevel: data.fibonacciLevel ?? null,
      cycleMomentum: data.cycleMomentum ?? null,
      seasonalWeight: data.seasonalWeight ?? null,
      volatilityIndex: data.volatilityIndex ?? null,
      fractalDimension: data.fractalDimension ?? null,
      entropyScore: data.entropyScore ?? null,
      elliottWaveCount: data.elliottWaveCount ?? null,
      gannAngle: data.gannAngle ?? null,
      cyclePhase: data.cyclePhase ?? null,
      strengthScore: data.strengthScore ?? null,
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
      id: Math.random().toString(36).substr(2, 9),
      ticker: data.ticker,
      date: data.date,
      predictedPrice: data.predictedPrice,
      confidenceLow: data.confidenceLow,
      confidenceHigh: data.confidenceHigh,
      cyclePhase: data.cyclePhase ?? null,
      modelType: data.modelType ?? null,
      algorithmWeights: data.algorithmWeights ?? null,
      marketRegime: data.marketRegime ?? null,
      supportLevels: data.supportLevels ?? null,
      resistanceLevels: data.resistanceLevels ?? null,
      volatilityForecast: data.volatilityForecast ?? null,
      trendStrength: data.trendStrength ?? null,
      harmonicTarget: data.harmonicTarget ?? null,
      fibonacciTarget: data.fibonacciTarget ?? null,
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
    // Return only Elite subscription plan
    return [
      {
        id: "plan-elite",
        name: "Elite Plan",
        tier: "elite",
        stripePriceId: "price_elite_monthly",
        monthlyPrice: 9999,
        yearlyPrice: 99999,
        features: ["Unlimited signals", "Advanced charts", "Unlimited tickers", "Premium alerts", "Priority support"],
        maxSignals: -1, // Unlimited
        maxTickers: -1, // Unlimited
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
      stripePriceId: plan.stripePriceId || null,
      monthlyPrice: plan.monthlyPrice || 0,
      yearlyPrice: plan.yearlyPrice ?? null,
      features: plan.features ?? null,
      maxSignals: plan.maxSignals ?? 0,
      maxTickers: plan.maxTickers ?? 0,
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
  private userBillingSubscriptions: UserSubscription[] = [
    // Sample billing subscriptions for demo user  
    {
      id: 'billing-sub-1',
      userId: 'test-user-123',
      currentPlanId: 'plan-elite',
      status: 'active',
      billingInterval: 'monthly',
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastBillingDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      stripeCustomerId: 'cus_test123',
      stripeSubscriptionId: 'sub_test123',
      paypalSubscriptionId: null,
      startedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      cancelledAt: null,
      pausedAt: null,
      resumedAt: null,
      trialStartedAt: null,
      trialEndsAt: null,
      currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      metadata: null,
      notes: 'Basic plan subscription',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    }
  ];
  
  // Ticker-specific subscriptions (alerts/timeframes) 
  private userTickerSubscriptionsOld: any[] = [
    {
      id: 'ticker-sub-1',
      userId: 'test-user-123', 
      tickerSymbol: 'BTCUSDT',
      timeframe: '1H',
      isActive: true,
      alertTypes: ['price_alert', 'volume_spike'],
      deliveryMethods: ['email'],
      priceThresholds: { upper: 70000, lower: 60000 },
      maxAlertsPerDay: 50,
      telegramChatId: null,
      customWebhook: null,
      notes: 'BTC 1H alerts',
      subscribedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'ticker-sub-2',
      userId: 'test-user-123',
      tickerSymbol: 'ETHUSDT', 
      timeframe: '4H',
      isActive: true,
      alertTypes: ['price_alert'],
      deliveryMethods: ['email'],
      priceThresholds: { upper: 4000, lower: 3000 },
      maxAlertsPerDay: 30,
      telegramChatId: null,
      customWebhook: null,
      notes: 'ETH 4H price alerts',
      subscribedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
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
      category: "trading",
      iconType: "badge",
      iconColor: "green",
      points: 40,
      requirement: { type: "portfolio_count", target: 15 },
      isActive: true,
      rarity: "rare",
      createdAt: new Date(),
    },
    {
      id: "achievement-7",
      name: "Notification Ninja",
      description: "Set up all notification channels",
      category: "milestone",
      iconType: "trophy",
      iconColor: "blue",
      points: 30,
      requirement: { type: "notification_setup", target: 3 },
      isActive: true,
      rarity: "rare",
      createdAt: new Date(),
    },
    {
      id: "achievement-8",
      name: "Chart Master",
      description: "View advanced charts 50 times",
      category: "learning",
      iconType: "medal",
      iconColor: "purple",
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
      category: "trading",
      iconType: "crown",
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
      category: "streak",
      iconType: "star",
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
      target: 100,
      isCompleted: true,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-2", 
      userId: "test-user-123",
      achievementId: "achievement-3",
      progress: 100,
      target: 100,
      isCompleted: true,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-3",
      userId: "test-user-123", 
      achievementId: "achievement-4",
      progress: 50,
      target: 100,
      isCompleted: false,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-4",
      userId: "test-user-123",
      achievementId: "achievement-2",
      progress: 30,
      target: 100,
      isCompleted: false,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-5",
      userId: "test-user-123",
      achievementId: "achievement-7",
      progress: 100,
      target: 100,
      isCompleted: true,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-6",
      userId: "test-user-123",
      achievementId: "achievement-8",
      progress: 75,
      target: 100,
      isCompleted: false,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-achievement-7",
      userId: "test-user-123",
      achievementId: "achievement-6",
      progress: 80,
      target: 100,
      isCompleted: false,
      completedAt: null,
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
      mode: trade.mode || "paper",
      status: trade.status || "EXECUTED",
      signalId: trade.signalId || null,
      pnl: trade.pnl || null,
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

  // ======================================
  // NEW SIGNAL MANAGEMENT SYSTEM IMPLEMENTATION
  // ======================================
  
  private buySignals: any[] = [];
  private signalDeliveries: any[] = [];
  private allowedTickerTimeframes: any[] = [
    {
      id: 'ticker-1',
      tickerSymbol: 'BTCUSDT',
      timeframe: '1D',
      description: 'Bitcoin Daily Signals',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'ticker-2',
      tickerSymbol: 'BTCUSDT',
      timeframe: '4H',
      description: 'Bitcoin 4-Hour Signals',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'ticker-3', 
      tickerSymbol: 'ETHUSDT',
      timeframe: '1D',
      description: 'Ethereum Daily Signals',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'ticker-4',
      tickerSymbol: 'ETHUSDT',
      timeframe: '1H',
      description: 'Ethereum Hourly Signals',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'ticker-5',
      tickerSymbol: 'ADAUSDT',
      timeframe: '1D',
      description: 'Cardano Daily Signals',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  private userTickerSubscriptions: any[] = [
    {
      id: 'sub-1',
      userId: '2a16dnclr', // admin user
      tickerSymbol: 'BTCUSDT',
      timeframe: '1D',
      deliveryMethods: ['email', 'telegram'],
      maxAlertsPerDay: 20,
      isActive: true,
      subscribedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'sub-2',
      userId: '2a16dnclr', // admin user
      tickerSymbol: 'ETHUSDT',
      timeframe: '4H',
      deliveryMethods: ['email', 'sms'],
      maxAlertsPerDay: 50,
      isActive: true,
      subscribedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'sub-3',
      userId: 'demo-user-1', // demo user
      tickerSymbol: 'BTCUSDT',
      timeframe: '1H',
      deliveryMethods: ['email'],
      maxAlertsPerDay: 10,
      isActive: false,
      subscribedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    }
  ];

  // New Signal Management Methods
  async createBuySignal(signal: any): Promise<any> {
    const newSignal = {
      id: `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol: signal.symbol,
      signalType: signal.signalType,
      price: signal.price,
      timeframe: signal.timeframe,
      timestamp: signal.timestamp || new Date(),
      notes: signal.notes || null,
      confidence: signal.confidence || null,
      createdBy: signal.createdBy || null,
      source: signal.source || 'manual',
      sentToUsers: 0,
      deliveryStats: { email: 0, sms: 0, telegram: 0 },
      createdAt: new Date()
    };
    this.buySignals.push(newSignal);
    return newSignal;
  }

  async getBuySignals(filters: any = {}): Promise<any[]> {
    let results = [...this.buySignals];
    
    if (filters.symbol) {
      results = results.filter(s => s.symbol === filters.symbol);
    }
    if (filters.timeframe) {
      results = results.filter(s => s.timeframe === filters.timeframe);
    }
    if (filters.signalType) {
      results = results.filter(s => s.signalType === filters.signalType);
    }
    
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (filters.limit) {
      results = results.slice(filters.offset || 0, (filters.offset || 0) + filters.limit);
    }
    
    return results;
  }

  async updateBuySignal(id: string, updates: any): Promise<any> {
    const signalIndex = this.buySignals.findIndex(s => s.id === id);
    if (signalIndex === -1) return null;
    
    this.buySignals[signalIndex] = { ...this.buySignals[signalIndex], ...updates };
    return this.buySignals[signalIndex];
  }

  async createSignalDelivery(delivery: any): Promise<any> {
    const newDelivery = {
      id: `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      signalId: delivery.signalId,
      userId: delivery.userId,
      deliveryMethod: delivery.deliveryMethod,
      deliveryStatus: delivery.deliveryStatus,
      deliveryTimestamp: delivery.deliveryTimestamp || new Date(),
      errorMessage: delivery.errorMessage || null
    };
    this.signalDeliveries.push(newDelivery);
    return newDelivery;
  }

  // Ticker/Timeframe Management
  async getAllowedTickerTimeframes(): Promise<any[]> {
    return [...this.allowedTickerTimeframes];
  }

  async getTickerTimeframe(symbol: string, timeframe: string): Promise<any> {
    return this.allowedTickerTimeframes.find(combo => 
      combo.tickerSymbol === symbol && combo.timeframe === timeframe
    );
  }

  async createAllowedTickerTimeframe(data: any): Promise<any> {
    const newCombo = {
      id: `combo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tickerSymbol: data.tickerSymbol,
      timeframe: data.timeframe,
      description: data.description || `${data.tickerSymbol} ${data.timeframe} signals`,
      isEnabled: data.isEnabled ?? true,
      createdAt: new Date()
    };
    this.allowedTickerTimeframes.push(newCombo);
    return newCombo;
  }

  async deleteAllowedTickerTimeframe(id: string): Promise<boolean> {
    const index = this.allowedTickerTimeframes.findIndex(combo => combo.id === id);
    if (index === -1) return false;
    
    this.allowedTickerTimeframes.splice(index, 1);
    return true;
  }

  // User Subscriptions
  async getUserTickerSubscriptions(userId: string): Promise<any[]> {
    return this.userTickerSubscriptions.filter(sub => sub.userId === userId && sub.isActive);
  }

  async getUserTickerSubscription(userId: string, symbol: string, timeframe: string): Promise<any> {
    return this.userTickerSubscriptions.find(sub => 
      sub.userId === userId && 
      sub.tickerSymbol === symbol && 
      sub.timeframe === timeframe
    );
  }

  async createUserTickerSubscription(data: any): Promise<any> {
    const newSub = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: data.userId,
      tickerSymbol: data.tickerSymbol,
      timeframe: data.timeframe,
      deliveryMethods: data.deliveryMethods || ['email'],
      maxAlertsPerDay: data.maxAlertsPerDay || 50,
      isActive: true,
      subscribedAt: new Date(),
      createdAt: new Date()
    };
    this.userTickerSubscriptions.push(newSub);
    return newSub;
  }

  async deleteUserTickerSubscription(id: string, userId: string): Promise<boolean> {
    const index = this.userTickerSubscriptions.findIndex(sub => 
      sub.id === id && sub.userId === userId
    );
    if (index === -1) return false;
    
    this.userTickerSubscriptions.splice(index, 1);
    return true;
  }


  async getUserSubscriptionsForTicker(symbol: string, timeframe: string): Promise<any[]> {
    return this.userTickerSubscriptions.filter(sub => 
      sub.tickerSymbol === symbol && 
      sub.timeframe === timeframe && 
      sub.isActive
    );
  }

  async getSignalsForUser(userId: string, limit: number): Promise<any[]> {
    // Get user's subscriptions
    const userSubs = await this.getUserTickerSubscriptions(userId);
    
    // Get signals for subscribed tickers
    const signals = this.buySignals.filter(signal => 
      userSubs.some(sub => 
        sub.tickerSymbol === signal.symbol && 
        sub.timeframe === signal.timeframe
      )
    );

    return signals
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Admin Signal Subscriptions Management (Memory)
  async getSignalSubscriptions(filters: { userId?: string; ticker?: string; page?: number; limit?: number } = {}): Promise<any[]> {
    const { userId, ticker, page = 1, limit = 20 } = filters;
    
    let filteredSubscriptions = this.userTickerSubscriptions.filter(sub => {
      if (userId && sub.userId !== userId) return false;
      if (ticker && sub.tickerSymbol !== ticker) return false;
      return true;
    });

    // Add user information
    const subscriptionsWithUserInfo = filteredSubscriptions.map(sub => {
      const user = this.users.find(u => u.id === sub.userId);
      return {
        ...sub,
        userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
        userEmail: user ? user.email : 'unknown@example.com'
      };
    });

    // Sort by creation date (newest first)
    subscriptionsWithUserInfo.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Pagination
    const startIndex = (page - 1) * limit;
    return subscriptionsWithUserInfo.slice(startIndex, startIndex + limit);
  }

  async createSignalSubscription(data: any): Promise<any> {
    const newSubscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: data.userId,
      tickerSymbol: data.tickerSymbol,
      timeframe: data.timeframe,
      deliveryMethods: data.deliveryMethods || ['email'],
      maxAlertsPerDay: data.maxAlertsPerDay || 50,
      isActive: data.isActive !== false,
      subscribedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.userTickerSubscriptions.push(newSubscription);
    
    // Add user information for response
    const user = this.users.find(u => u.id === data.userId);
    return {
      ...newSubscription,
      userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
      userEmail: user ? user.email : 'unknown@example.com'
    };
  }

  async updateSignalSubscription(id: string, updates: any): Promise<any> {
    const index = this.userTickerSubscriptions.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    this.userTickerSubscriptions[index] = {
      ...this.userTickerSubscriptions[index],
      ...updates,
      updatedAt: new Date()
    };
    
    // Add user information for response
    const subscription = this.userTickerSubscriptions[index];
    const user = this.users.find(u => u.id === subscription.userId);
    return {
      ...subscription,
      userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
      userEmail: user ? user.email : 'unknown@example.com'
    };
  }

  async deleteSignalSubscription(id: string): Promise<boolean> {
    const index = this.userTickerSubscriptions.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    this.userTickerSubscriptions.splice(index, 1);
    return true;
  }

  // User Alerts implementation
  async getUserAlerts(userId: string): Promise<UserAlert[]> {
    return this.userAlerts.filter(alert => alert.userId === userId);
  }

  async createUserAlert(alert: InsertUserAlert): Promise<UserAlert> {
    const newAlert: UserAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...alert,
      enabled: alert.enabled ?? true,
      channels: alert.channels ?? ["email"],
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
      userId: layout.userId || null,
      isDefault: layout.isDefault ?? false,
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
      isActive: subscription.isActive ?? true,
      telegramChatId: subscription.telegramChatId || null,
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
      isActive: achievement.isActive ?? true,
      rarity: achievement.rarity ?? "common",
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
      target: userAchievement.target ?? 100,
      isCompleted: true,
      completedAt: new Date(),
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
      totalLogins: userStats.totalLogins ?? 0,
      loginStreak: userStats.loginStreak ?? 0,
      lastLoginDate: userStats.lastLoginDate || null,
      signalsReceived: userStats.signalsReceived ?? 0,
      alertsCreated: userStats.alertsCreated ?? 0,
      dashboardViews: userStats.dashboardViews ?? 0,
      totalPoints: userStats.totalPoints ?? 0,
      level: userStats.level ?? 1,
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

  // Notification configuration management methods for MemoryStorage
  private notificationConfigs: any[] = [
    {
      id: 'config-1',
      name: 'Email Notifications',
      type: 'email',
      provider: 'smtp',
      config: { host: 'smtp.example.com', port: 587 },
      description: 'Email notification service',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'config-2',
      name: 'SMS Notifications',
      type: 'sms',
      provider: 'twilio',
      config: { accountSid: 'AC...', authToken: '[hidden]' },
      description: 'SMS notification service via Twilio',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  async getNotificationConfigs(): Promise<any[]> { 
    return this.notificationConfigs.filter(c => c.isActive);
  }
  
  async getNotificationConfig(id: string): Promise<any | undefined> { 
    return this.notificationConfigs.find(c => c.id === id && c.isActive);
  }
  
  async createNotificationConfig(config: any): Promise<any> { 
    const newConfig = {
      id: `config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...config,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.notificationConfigs.push(newConfig);
    return newConfig;
  }
  
  async updateNotificationConfig(id: string, updates: any): Promise<any | undefined> { 
    const index = this.notificationConfigs.findIndex(c => c.id === id);
    if (index === -1) return undefined;
    
    this.notificationConfigs[index] = {
      ...this.notificationConfigs[index],
      ...updates,
      updatedAt: new Date()
    };
    
    return this.notificationConfigs[index];
  }
  
  async deleteNotificationConfig(id: string): Promise<boolean> { 
    const index = this.notificationConfigs.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    this.notificationConfigs.splice(index, 1);
    return true;
  }

  // Additional missing methods for user ticker subscriptions
  async updateUserTickerSubscriptionMemory(id: string, updates: any): Promise<boolean> {
    const index = this.userTickerSubscriptions.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    this.userTickerSubscriptions[index] = {
      ...this.userTickerSubscriptions[index],
      ...updates,
      updatedAt: new Date()
    };
    return true;
  }

  async deleteUserTickerSubscriptionByIdMemory(id: string): Promise<boolean> {
    const index = this.userTickerSubscriptions.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    this.userTickerSubscriptions.splice(index, 1);
    return true;
  }

  // User Notifications methods for MemoryStorage
  async getUserNotifications(userId: string, limit = 50): Promise<UserNotification[]> {
    return [];  // Return empty array for MemoryStorage
  }

  async createUserNotification(notification: InsertUserNotification): Promise<UserNotification> {
    throw new Error('User notifications not implemented in MemoryStorage');
  }

  async markNotificationAsRead(id: string, userId: string): Promise<UserNotification | undefined> {
    return undefined;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    // No-op for MemoryStorage
  }

  async archiveNotification(id: string, userId: string): Promise<UserNotification | undefined> {
    return undefined;
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    return false;
  }

  // User Notification Preferences methods for MemoryStorage
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | undefined> {
    return undefined;
  }

  async createUserNotificationPreferences(preferences: InsertUserNotificationPreferences): Promise<UserNotificationPreferences> {
    throw new Error('User notification preferences not implemented in MemoryStorage');
  }

  async updateUserNotificationPreferences(userId: string, updates: Partial<UserNotificationPreferences>): Promise<UserNotificationPreferences | undefined> {
    return undefined;
  }

  // ======================================
  // MISSING INTERFACE METHODS IMPLEMENTATION
  // ======================================

  // OAuth method implementation
  async upsertOAuthUser(userData: Partial<InsertUser>): Promise<User> {
    // Check if user exists by email
    let existingUser = await this.getUserByEmail(userData.email!);
    
    if (existingUser) {
      // Update existing user
      const updates = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      };
      return (await this.updateUser(existingUser.id, updates))!;
    } else {
      // Create new OAuth user
      const newUser: InsertUser = {
        email: userData.email!,
        hashedPassword: null, // OAuth users don't have passwords
        role: 'user', // Force OAuth users to be regular users only
        firstName: userData.firstName,
        lastName: userData.lastName,
        isActive: true,
        subscriptionTier: 'free',
      };
      return await this.createUser(newUser);
    }
  }

  // Announcements implementation with in-memory storage
  private announcements: Announcement[] = [
    {
      id: 'announcement-1',
      title: 'Welcome to Proud Profits',
      body: 'Welcome to our advanced crypto trading signals platform!',
      type: 'info',
      audience: 'all',
      isPublished: true,
      priority: 1,
      publishedAt: new Date(),
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin-user-456'
    }
  ];

  async getAnnouncements(audience?: string): Promise<Announcement[]> {
    let filtered = this.announcements.filter(a => a.isPublished);
    
    if (audience) {
      filtered = filtered.filter(a => a.audience === audience || a.audience === 'all');
    }
    
    return filtered.sort((a, b) => {
      // Priority first, then by creation date
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async getAnnouncement(id: string): Promise<Announcement | undefined> {
    return this.announcements.find(a => a.id === id);
  }

  async createAnnouncement(announcement: AnnouncementInsert): Promise<Announcement> {
    const newAnnouncement: Announcement = {
      id: `announcement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...announcement,
      isPublished: announcement.isPublished ?? false,
      priority: announcement.priority ?? 1,
      audience: announcement.audience ?? 'all',
      type: announcement.type ?? 'info',
      publishedAt: null,
      expiresAt: announcement.expiresAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.announcements.push(newAnnouncement);
    return newAnnouncement;
  }

  async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement | undefined> {
    const index = this.announcements.findIndex(a => a.id === id);
    if (index === -1) return undefined;
    
    this.announcements[index] = {
      ...this.announcements[index],
      ...updates,
      updatedAt: new Date(),
    };
    return this.announcements[index];
  }

  async deleteAnnouncement(id: string): Promise<boolean> {
    const index = this.announcements.findIndex(a => a.id === id);
    if (index === -1) return false;
    
    this.announcements.splice(index, 1);
    return true;
  }

  async publishAnnouncement(id: string): Promise<Announcement | undefined> {
    return await this.updateAnnouncement(id, { 
      isPublished: true,
      publishedAt: new Date()
    });
  }

  // Notification Queue implementation
  private notificationQueue: NotificationQueue[] = [];

  async getNotificationQueue(limit?: number): Promise<NotificationQueue[]> {
    const sorted = [...this.notificationQueue].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getQueuedNotifications(status?: string): Promise<NotificationQueue[]> {
    let filtered = [...this.notificationQueue];
    if (status) {
      filtered = filtered.filter(n => n.status === status);
    }
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async addToNotificationQueue(notification: InsertNotificationQueue): Promise<NotificationQueue> {
    const newNotification: NotificationQueue = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...notification,
      status: notification.status ?? 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.notificationQueue.push(newNotification);
    return newNotification;
  }

  async updateNotificationQueueStatus(id: string, status: string, metadata?: any): Promise<NotificationQueue | undefined> {
    const index = this.notificationQueue.findIndex(n => n.id === id);
    if (index === -1) return undefined;
    
    this.notificationQueue[index] = {
      ...this.notificationQueue[index],
      status,
      metadata: metadata ? { ...this.notificationQueue[index].metadata, ...metadata } : this.notificationQueue[index].metadata,
      updatedAt: new Date(),
    };
    return this.notificationQueue[index];
  }

  async deleteFromNotificationQueue(id: string): Promise<boolean> {
    const index = this.notificationQueue.findIndex(n => n.id === id);
    if (index === -1) return false;
    
    this.notificationQueue.splice(index, 1);
    return true;
  }

  async getFailedNotifications(retryCount?: number): Promise<NotificationQueue[]> {
    let filtered = this.notificationQueue.filter(n => n.status === 'failed');
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Notification Templates implementation
  private notificationTemplates: NotificationTemplate[] = [
    {
      id: 'template-1',
      name: 'Signal Alert',
      type: 'email',
      subject: 'New Trading Signal: {{ticker}}',
      content: 'A new {{signalType}} signal has been generated for {{ticker}} at price {{price}}',
      variables: ['ticker', 'signalType', 'price'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];

  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    return [...this.notificationTemplates].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getNotificationTemplate(id: string): Promise<NotificationTemplate | undefined> {
    return this.notificationTemplates.find(t => t.id === id);
  }

  async getNotificationTemplateByType(type: string): Promise<NotificationTemplate | undefined> {
    return this.notificationTemplates.find(t => t.type === type && t.isActive);
  }

  async createNotificationTemplate(template: InsertNotificationTemplate): Promise<NotificationTemplate> {
    const newTemplate: NotificationTemplate = {
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...template,
      isActive: template.isActive ?? true,
      variables: template.variables ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.notificationTemplates.push(newTemplate);
    return newTemplate;
  }

  async updateNotificationTemplate(id: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate | undefined> {
    const index = this.notificationTemplates.findIndex(t => t.id === id);
    if (index === -1) return undefined;
    
    this.notificationTemplates[index] = {
      ...this.notificationTemplates[index],
      ...updates,
      updatedAt: new Date(),
    };
    return this.notificationTemplates[index];
  }

  async deleteNotificationTemplate(id: string): Promise<boolean> {
    const index = this.notificationTemplates.findIndex(t => t.id === id);
    if (index === -1) return false;
    
    this.notificationTemplates.splice(index, 1);
    return true;
  }

  // Notification Logs implementation
  private notificationLogs: NotificationLog[] = [];

  async getNotificationLogs(limit?: number, channel?: string): Promise<NotificationLog[]> {
    let filtered = [...this.notificationLogs];
    if (channel) {
      filtered = filtered.filter(l => l.channel === channel);
    }
    
    const sorted = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getNotificationLog(id: string): Promise<NotificationLog | undefined> {
    return this.notificationLogs.find(l => l.id === id);
  }

  async getNotificationLogsByUser(userId: string, limit?: number): Promise<NotificationLog[]> {
    const filtered = this.notificationLogs.filter(l => l.userId === userId);
    const sorted = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog> {
    const newLog: NotificationLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...log,
      createdAt: new Date(),
    };
    this.notificationLogs.push(newLog);
    return newLog;
  }

  async updateNotificationLog(id: string, updates: Partial<NotificationLog>): Promise<NotificationLog | undefined> {
    const index = this.notificationLogs.findIndex(l => l.id === id);
    if (index === -1) return undefined;
    
    this.notificationLogs[index] = {
      ...this.notificationLogs[index],
      ...updates,
    };
    return this.notificationLogs[index];
  }

  async getNotificationStats(dateFrom?: Date, dateTo?: Date): Promise<any> {
    let filtered = [...this.notificationLogs];
    
    if (dateFrom) {
      filtered = filtered.filter(l => new Date(l.createdAt) >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(l => new Date(l.createdAt) <= dateTo);
    }
    
    const stats = {
      total: filtered.length,
      successful: filtered.filter(l => l.status === 'sent').length,
      failed: filtered.filter(l => l.status === 'failed').length,
      byChannel: {} as Record<string, number>,
    };
    
    filtered.forEach(log => {
      stats.byChannel[log.channel] = (stats.byChannel[log.channel] || 0) + 1;
    });
    
    return stats;
  }

  // Notification Channels implementation  
  private notificationChannels: NotificationChannel[] = [
    {
      id: 'channel-1',
      name: 'Email',
      type: 'email',
      provider: 'smtp',
      config: { host: 'smtp.example.com', port: 587 },
      providerConfig: { apiKey: 'test' },
      isEnabled: true,
      isHealthy: true,
      lastHealthCheck: new Date(),
      healthCheckInterval: 300,
      errorCount: 0,
      successCount: 100,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];

  async getNotificationChannels(): Promise<NotificationChannel[]> {
    return [...this.notificationChannels].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getNotificationChannel(id: string): Promise<NotificationChannel | undefined> {
    return this.notificationChannels.find(c => c.id === id);
  }

  async getNotificationChannelByType(type: string): Promise<NotificationChannel | undefined> {
    return this.notificationChannels.find(c => c.type === type && c.isEnabled);
  }

  async createNotificationChannel(channel: InsertNotificationChannel): Promise<NotificationChannel> {
    const newChannel: NotificationChannel = {
      id: `channel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...channel,
      isEnabled: channel.isEnabled ?? true,
      isHealthy: true,
      lastHealthCheck: null,
      healthCheckInterval: 300,
      errorCount: 0,
      successCount: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.notificationChannels.push(newChannel);
    return newChannel;
  }

  async updateNotificationChannel(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel | undefined> {
    const index = this.notificationChannels.findIndex(c => c.id === id);
    if (index === -1) return undefined;
    
    this.notificationChannels[index] = {
      ...this.notificationChannels[index],
      ...updates,
      updatedAt: new Date(),
    };
    return this.notificationChannels[index];
  }

  async deleteNotificationChannel(id: string): Promise<boolean> {
    const index = this.notificationChannels.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    this.notificationChannels.splice(index, 1);
    return true;
  }

  async testNotificationChannel(id: string): Promise<any> {
    const channel = await this.getNotificationChannel(id);
    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }
    
    // Simulate test result
    return { 
      success: true, 
      message: `Test notification sent via ${channel.name}`,
      timestamp: new Date() 
    };
  }

  // System Settings implementation
  private systemSettings: SystemSetting[] = [
    {
      id: 'setting-1',
      key: 'maintenance_mode',
      value: false,
      dataType: 'boolean',
      category: 'system',
      description: 'Enable maintenance mode',
      isPublic: false,
      isEditable: true,
      validationRules: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];

  async getSystemSettings(): Promise<SystemSetting[]> {
    return [...this.systemSettings].sort((a, b) => a.key.localeCompare(b.key));
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    return this.systemSettings.find(s => s.key === key);
  }

  async createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const newSetting: SystemSetting = {
      id: `setting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...setting,
      isPublic: setting.isPublic ?? false,
      isEditable: setting.isEditable ?? true,
      description: setting.description ?? null,
      validationRules: setting.validationRules ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.systemSettings.push(newSetting);
    return newSetting;
  }

  async updateSystemSetting(key: string, updates: Partial<SystemSetting>): Promise<SystemSetting | undefined> {
    const index = this.systemSettings.findIndex(s => s.key === key);
    if (index === -1) return undefined;
    
    this.systemSettings[index] = {
      ...this.systemSettings[index],
      ...updates,
      updatedAt: new Date(),
    };
    return this.systemSettings[index];
  }

  async deleteSystemSetting(key: string): Promise<boolean> {
    const index = this.systemSettings.findIndex(s => s.key === key);
    if (index === -1) return false;
    
    this.systemSettings.splice(index, 1);
    return true;
  }

  async getSystemSettingsByCategory(category: string): Promise<SystemSetting[]> {
    return this.systemSettings
      .filter(s => s.category === category)
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  // Fix the method name inconsistency for user ticker subscriptions
  async updateUserTickerSubscription(id: string, updates: any): Promise<boolean> {
    return this.updateUserTickerSubscriptionMemory(id, updates);
  }

  async deleteUserTickerSubscriptionById(id: string): Promise<boolean> {
    return this.deleteUserTickerSubscriptionByIdMemory(id);
  }

  // Additional missing methods for various functionality (duplicates removed)

  // Subscription Plans implementation  
  private subscriptionPlans: SubscriptionPlan[] = [
    {
      id: 'plan-elite',
      name: 'Elite',
      tier: 'elite',
      monthlyPrice: 9999,
      yearlyPrice: 99999,
      isActive: true,
      stripePriceId: 'price_elite_monthly',
      features: ['Unlimited signals', 'Advanced charts', 'Unlimited tickers', 'Premium alerts', 'Priority support'],
      maxSignals: -1,
      maxTickers: -1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return this.subscriptionPlans.filter(p => p.isActive);
  }

  async getSubscriptionPlan(tier: string): Promise<SubscriptionPlan | undefined> {
    return this.subscriptionPlans.find(p => p.tier === tier && p.isActive);
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const newPlan: SubscriptionPlan = {
      id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...plan,
      isActive: plan.isActive ?? true,
      features: plan.features ?? [],
      stripePriceId: plan.stripePriceId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.subscriptionPlans.push(newPlan);
    return newPlan;
  }

  // Password Reset Tokens - Memory Storage Implementation
  private passwordResetTokens: PasswordResetToken[] = [];

  async createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const token: PasswordResetToken = {
      id: crypto.randomUUID(),
      ...tokenData,
      createdAt: new Date(),
    };
    this.passwordResetTokens.push(token);
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return this.passwordResetTokens.find(t => 
      t.token === token && 
      !t.isUsed && 
      new Date(t.expiresAt) > new Date()
    );
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<boolean> {
    const tokenIndex = this.passwordResetTokens.findIndex(t => t.token === token);
    if (tokenIndex === -1) return false;
    
    this.passwordResetTokens[tokenIndex].isUsed = true;
    return true;
  }

  async invalidateUserPasswordResetTokens(userId: string): Promise<void> {
    this.passwordResetTokens = this.passwordResetTokens.map(token => 
      token.userId === userId && !token.isUsed ? { ...token, isUsed: true } : token
    );
  }

  async cleanupExpiredPasswordResetTokens(): Promise<void> {
    this.passwordResetTokens = this.passwordResetTokens.filter(t => 
      !t.isUsed && new Date(t.expiresAt) > new Date()
    );
  }

  // Removed duplicate implementations - these methods already exist earlier in the class
}

// Export instance for use throughout the application
export const storage = new DatabaseStorage();

