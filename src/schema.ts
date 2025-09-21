import { pgTable, text, varchar, serial, integer, boolean, timestamp, uuid, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  isActive: boolean("is_active").notNull().default(true),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionTier: text("subscription_tier", { enum: ["free", "basic", "premium", "pro"] }).notNull().default("free"),
  subscriptionStatus: text("subscription_status", { enum: ["active", "canceled", "past_due", "trialing", "incomplete"] }),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  
  // Notification Preferences
  notificationEmail: boolean("notification_email").notNull().default(true),
  notificationSms: boolean("notification_sms").notNull().default(false),
  notificationPush: boolean("notification_push").notNull().default(true),
  notificationTelegram: boolean("notification_telegram").notNull().default(false),
  emailSignalAlerts: boolean("email_signal_alerts").notNull().default(true),
  smsSignalAlerts: boolean("sms_signal_alerts").notNull().default(false),
  pushSignalAlerts: boolean("push_signal_alerts").notNull().default(true),
  emailFrequency: text("email_frequency", { enum: ["realtime", "daily", "weekly", "never"] }).notNull().default("realtime"),
  quietHoursStart: text("quiet_hours_start").default("22:00"), // 24h format
  quietHoursEnd: text("quiet_hours_end").default("08:00"),
  weekendNotifications: boolean("weekend_notifications").notNull().default(true),
  
  // Contact Information
  emailAddress: text("email_address"),
  phoneNumber: text("phone_number"),
  telegramChatId: text("telegram_chat_id"),
  
  // Webhook Settings
  webhookSecret: text("webhook_secret"),
  webhookEnabled: boolean("webhook_enabled").notNull().default(false),
  
  // Push Notification Settings
  pushSubscription: jsonb("push_subscription"),
  pushEnabled: boolean("push_enabled").notNull().default(false),
  
  // Alert Type Preferences
  priceAlerts: boolean("price_alerts").notNull().default(true),
  volumeAlerts: boolean("volume_alerts").notNull().default(false),
  newsAlerts: boolean("news_alerts").notNull().default(true),
  technicalAlerts: boolean("technical_alerts").notNull().default(true),
  whaleAlerts: boolean("whale_alerts").notNull().default(false),
  
  // Display Preferences
  theme: text("theme", { enum: ["light", "dark", "auto"] }).notNull().default("dark"),
  language: text("language").notNull().default("en"),
  timezone: text("timezone").notNull().default("UTC"),
  currency: text("currency").notNull().default("USD"),
  dateFormat: text("date_format", { enum: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] }).notNull().default("MM/DD/YYYY"),
  timeFormat: text("time_format", { enum: ["12h", "24h"] }).notNull().default("12h"),
  
  // Chart Preferences
  defaultChartType: text("default_chart_type", { enum: ["candlestick", "line", "area", "heikin_ashi"] }).notNull().default("candlestick"),
  defaultTimeframe: text("default_timeframe", { enum: ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] }).notNull().default("15m"),
  chartTheme: text("chart_theme", { enum: ["dark", "light", "auto"] }).notNull().default("dark"),
  showVolume: boolean("show_volume").notNull().default(true),
  showIndicators: boolean("show_indicators").notNull().default(true),
  autoRefreshCharts: boolean("auto_refresh_charts").notNull().default(true),
  chartRefreshInterval: integer("chart_refresh_interval").notNull().default(30), // seconds
  
  // Trading Preferences
  defaultOrderType: text("default_order_type", { enum: ["market", "limit", "stop_loss", "take_profit"] }).notNull().default("market"),
  confirmTrades: boolean("confirm_trades").notNull().default(true),
  enablePaperTrading: boolean("enable_paper_trading").notNull().default(true),
  paperTradingBalance: decimal("paper_trading_balance", { precision: 15, scale: 2 }).default("10000.00"),
  riskPercentage: decimal("risk_percentage", { precision: 5, scale: 2 }).default("2.00"), // 2% default risk
  stopLossPercentage: decimal("stop_loss_percentage", { precision: 5, scale: 2 }).default("3.00"),
  takeProfitPercentage: decimal("take_profit_percentage", { precision: 5, scale: 2 }).default("6.00"),
  
  // Dashboard Preferences
  defaultDashboard: text("default_dashboard", { enum: ["overview", "trading", "analytics", "portfolio"] }).notNull().default("overview"),
  showPriceAlerts: boolean("show_price_alerts").notNull().default(true),
  showRecentTrades: boolean("show_recent_trades").notNull().default(true),
  showPortfolioSummary: boolean("show_portfolio_summary").notNull().default(true),
  showMarketOverview: boolean("show_market_overview").notNull().default(true),
  maxDashboardItems: integer("max_dashboard_items").notNull().default(20),
  compactView: boolean("compact_view").notNull().default(false),
  
  // Privacy & Security
  profileVisibility: text("profile_visibility", { enum: ["public", "friends", "private"] }).notNull().default("private"),
  shareTradeHistory: boolean("share_trade_history").notNull().default(false),
  allowAnalytics: boolean("allow_analytics").notNull().default(true),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  sessionTimeout: integer("session_timeout").notNull().default(1440), // minutes (24 hours)
  
  // Advanced Features
  enableBetaFeatures: boolean("enable_beta_features").notNull().default(false),
  apiAccessEnabled: boolean("api_access_enabled").notNull().default(false),
  webhookUrl: text("webhook_url"),
  customCssEnabled: boolean("custom_css_enabled").notNull().default(false),
  customCss: text("custom_css"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const availableTickers = pgTable("available_tickers", {
  id: uuid("id").primaryKey().defaultRandom(),
  symbol: text("symbol").notNull().unique(),
  description: text("description").notNull(),
  category: text("category", { enum: ["major", "layer1", "defi", "legacy", "utility", "emerging", "other"] }).notNull().default("other"),
  marketCap: integer("market_cap").default(999), // market cap ranking
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userSubscriptions = pgTable("user_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  tickerSymbol: text("ticker_symbol").notNull().references(() => availableTickers.symbol),
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tier: text("tier", { enum: ["free", "basic", "premium", "pro"] }).notNull().unique(),
  stripePriceId: text("stripe_price_id").notNull(),
  monthlyPrice: integer("monthly_price").notNull(), // in cents
  yearlyPrice: integer("yearly_price"), // in cents
  features: text("features").array(),
  maxSignals: integer("max_signals"),
  maxTickers: integer("max_tickers"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Webhook secrets table for secure webhook authentication
export const webhookSecrets = pgTable("webhook_secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  secret: text("secret").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  allowedSources: text("allowed_sources").array().default([]), // e.g., ['tradingview', 'tradingbot']
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").default(0),
});

export const alertSignals = pgTable("alert_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  ticker: text("ticker").notNull(),
  signalType: text("signal_type", { enum: ["buy", "sell"] }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  timeframe: text("timeframe", { enum: ["1M", "1W", "1D", "12H", "4H", "1H", "30M"] }),
  source: text("source").notNull().default("webhook"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ohlcCache = pgTable("ohlc_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  tickerSymbol: text("ticker_symbol").notNull(),
  interval: text("interval").notNull(),
  time: timestamp("time").notNull(),
  open: decimal("open", { precision: 10, scale: 2 }).notNull(),
  high: decimal("high", { precision: 10, scale: 2 }).notNull(),
  low: decimal("low", { precision: 10, scale: 2 }).notNull(),
  close: decimal("close", { precision: 10, scale: 2 }).notNull(),
  volume: decimal("volume", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const heatmapData = pgTable("heatmap_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticker: text("ticker").notNull(),
  week: timestamp("week").notNull(),
  sma200w: decimal("sma_200w", { precision: 10, scale: 2 }).notNull(),
  deviationPercent: decimal("deviation_percent", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cycleIndicatorData = pgTable("cycle_indicator_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticker: text("ticker").notNull(),
  date: timestamp("date").notNull(),
  ma2y: decimal("ma_2y", { precision: 10, scale: 2 }).notNull(),
  deviation: decimal("deviation", { precision: 5, scale: 2 }).notNull(),
  // Advanced cycle analysis fields
  harmonicCycle: decimal("harmonic_cycle", { precision: 8, scale: 4 }),
  fibonacciLevel: decimal("fibonacci_level", { precision: 8, scale: 4 }),
  cycleMomentum: decimal("cycle_momentum", { precision: 8, scale: 4 }),
  seasonalWeight: decimal("seasonal_weight", { precision: 8, scale: 4 }),
  volatilityIndex: decimal("volatility_index", { precision: 8, scale: 4 }),
  fractalDimension: decimal("fractal_dimension", { precision: 8, scale: 6 }),
  entropyScore: decimal("entropy_score", { precision: 8, scale: 4 }),
  elliottWaveCount: integer("elliott_wave_count"),
  gannAngle: decimal("gann_angle", { precision: 8, scale: 4 }),
  cyclePhase: text("cycle_phase"), // "accumulation", "markup", "distribution", "markdown"
  strengthScore: decimal("strength_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const forecastData = pgTable("forecast_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticker: text("ticker").notNull(),
  date: timestamp("date").notNull(),
  predictedPrice: decimal("predicted_price", { precision: 10, scale: 2 }).notNull(),
  confidenceLow: decimal("confidence_low", { precision: 10, scale: 2 }).notNull(),
  confidenceHigh: decimal("confidence_high", { precision: 10, scale: 2 }).notNull(),
  // Enhanced forecasting fields
  modelType: text("model_type"), // "fourier", "elliott_wave", "gann", "harmonic", "ensemble"
  algorithmWeights: jsonb("algorithm_weights"), // Ensemble method weights
  marketRegime: text("market_regime"), // "bull", "bear", "sideways", "volatile"
  cyclePhase: text("cycle_phase"), // Current cycle phase prediction
  supportLevels: jsonb("support_levels"), // Dynamic support levels
  resistanceLevels: jsonb("resistance_levels"), // Dynamic resistance levels
  volatilityForecast: decimal("volatility_forecast", { precision: 8, scale: 4 }),
  trendStrength: decimal("trend_strength", { precision: 5, scale: 4 }),
  harmonicTarget: decimal("harmonic_target", { precision: 10, scale: 2 }),
  fibonacciTarget: decimal("fibonacci_target", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Advanced forecasting models table
export const cycleForecastModels = pgTable("cycle_forecast_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticker: text("ticker").notNull(),
  modelName: text("model_name").notNull(), // "fourier", "elliott_wave", "gann", "harmonic", "fractal"
  modelType: text("model_type").notNull(), // "short_term", "medium_term", "long_term"
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(),
  accuracy: decimal("accuracy", { precision: 5, scale: 4 }),
  isActive: boolean("is_active").notNull().default(true),
  parameters: jsonb("parameters"), // Model-specific parameters
  calibrationData: jsonb("calibration_data"), // Historical calibration
  performanceMetrics: jsonb("performance_metrics"), // Tracking accuracy over time
  lastCalibration: timestamp("last_calibration"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminActivityLog = pgTable("admin_activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  targetTable: text("target_table"),
  targetId: uuid("target_id"),
  notes: text("notes"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  roleName: text("role_name").notNull(),
  permissions: jsonb("permissions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// User custom alerts table
export const userAlerts = pgTable("user_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  type: text("type", { enum: ["price", "technical", "volume", "news", "whale"] }).notNull(),
  ticker: text("ticker").notNull(),
  condition: text("condition", { enum: ["above", "below", "crosses_above", "crosses_below"] }).notNull(),
  value: decimal("value", { precision: 20, scale: 8 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  channels: text("channels").array().notNull().default(["email"]),
  lastTriggered: timestamp("last_triggered"),
  triggerCount: integer("trigger_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Trading system tables
export const userTrades = pgTable("user_trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  ticker: text("ticker").notNull(),
  type: text("type").notNull(), // "BUY" or "SELL"
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  status: text("status").default("EXECUTED"), // "EXECUTED", "PENDING", "CANCELLED"
  mode: text("mode").default("paper"), // "paper" or "live"
  signalId: uuid("signal_id").references(() => alertSignals.id),
  pnl: decimal("pnl", { precision: 20, scale: 8 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userPortfolio = pgTable("user_portfolio", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  ticker: text("ticker").notNull(),
  quantity: decimal("quantity", { precision: 20, scale: 8 }).notNull(),
  averagePrice: decimal("average_price", { precision: 20, scale: 8 }).notNull(),
  currentValue: decimal("current_value", { precision: 20, scale: 8 }).notNull(),
  pnl: decimal("pnl", { precision: 20, scale: 8 }).default("0"),
  pnlPercentage: decimal("pnl_percentage", { precision: 10, scale: 4 }).default("0"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tradingSettings = pgTable("trading_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  riskLevel: text("risk_level").default("moderate"), // "conservative", "moderate", "aggressive"
  maxTradeAmount: decimal("max_trade_amount", { precision: 20, scale: 2 }).default("1000"),
  autoTrading: boolean("auto_trading").default(false),
  stopLoss: decimal("stop_loss", { precision: 5, scale: 2 }).default("5"),
  takeProfit: decimal("take_profit", { precision: 5, scale: 2 }).default("10"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTickerSchema = createInsertSchema(availableTickers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSignalSchema = createInsertSchema(alertSignals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOhlcSchema = createInsertSchema(ohlcCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHeatmapSchema = createInsertSchema(heatmapData).omit({
  id: true,
  createdAt: true,
});

export const insertCycleSchema = createInsertSchema(cycleIndicatorData).omit({
  id: true,
  createdAt: true,
});

export const insertForecastSchema = createInsertSchema(forecastData).omit({
  id: true,
  createdAt: true,
});

export const insertAdminLogSchema = createInsertSchema(adminActivityLog).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserAlertSchema = createInsertSchema(userAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  triggerCount: true,
  lastTriggered: true,
});

export const insertWebhookSecretSchema = createInsertSchema(webhookSecrets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUsed: true,
  usageCount: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type AvailableTicker = typeof availableTickers.$inferSelect;
export type InsertTicker = z.infer<typeof insertTickerSchema>;
export type AlertSignal = typeof alertSignals.$inferSelect;
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type OhlcData = typeof ohlcCache.$inferSelect & { source?: string };
export type InsertOhlc = z.infer<typeof insertOhlcSchema>;
export type HeatmapData = typeof heatmapData.$inferSelect;
export type InsertHeatmap = z.infer<typeof insertHeatmapSchema>;
export type CycleData = typeof cycleIndicatorData.$inferSelect;
export type InsertCycle = z.infer<typeof insertCycleSchema>;
export type ForecastData = typeof forecastData.$inferSelect;
export type InsertForecast = z.infer<typeof insertForecastSchema>;
export type AdminLog = typeof adminActivityLog.$inferSelect;
export type InsertAdminLog = z.infer<typeof insertAdminLogSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type WebhookSecret = typeof webhookSecrets.$inferSelect;
export type InsertWebhookSecret = z.infer<typeof insertWebhookSecretSchema>;

// Trading types
export type UserTrade = typeof userTrades.$inferSelect;
export type InsertUserTrade = typeof userTrades.$inferInsert;
export type UserPortfolio = typeof userPortfolio.$inferSelect;
export type InsertUserPortfolio = typeof userPortfolio.$inferInsert;
export type TradingSettings = typeof tradingSettings.$inferSelect;
export type InsertTradingSettings = typeof tradingSettings.$inferInsert;
export type UserAlert = typeof userAlerts.$inferSelect;
export type InsertUserAlert = z.infer<typeof insertUserAlertSchema>;

// Dashboard Layout table
export const dashboardLayouts = pgTable("dashboard_layouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  name: varchar("name", { length: 100 }).notNull(),
  widgets: jsonb("widgets").notNull().$type<{
    id: string;
    type: string;
    title: string;
    position: number;
    size: 'small' | 'medium' | 'large';
    settings: Record<string, any>;
    enabled: boolean;
  }[]>(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDashboardLayoutSchema = createInsertSchema(dashboardLayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type InsertDashboardLayout = z.infer<typeof insertDashboardLayoutSchema>;

// Smart Notification Timing Tables
export const notificationTimingPreferences = pgTable("notification_timing_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  timezone: varchar("timezone").notNull(), // User's timezone
  preferredHours: jsonb("preferred_hours").notNull(), // Array of preferred hours [9, 10, 11, 16, 17]
  quietHours: jsonb("quiet_hours").notNull(), // Array of quiet hours [22, 23, 0, 1, 2, 3, 4, 5, 6, 7]
  weekendPreference: varchar("weekend_preference").notNull().default("reduced"), // "normal", "reduced", "none"
  marketOpenOnly: boolean("market_open_only").default(false),
  maxNotificationsPerHour: integer("max_notifications_per_hour").default(3),
  adaptiveTiming: boolean("adaptive_timing").default(true), // Learn from user behavior
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notification Queue Table for Alert Events
export const notificationQueue = pgTable("notification_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  alertId: uuid("alert_id").references(() => alertSignals.id),
  
  // Channel Information
  channel: text("channel", { enum: ["email", "sms", "push", "telegram", "discord"] }).notNull(),
  recipient: text("recipient").notNull(), // email address, phone number, chat_id, etc.
  
  // Message Content
  subject: text("subject"),
  message: text("message").notNull(),
  messageHtml: text("message_html"), // HTML version for email
  templateId: uuid("template_id"), // Optional template reference
  templateVariables: jsonb("template_variables"), // Variables for template rendering
  
  // Status and Processing
  status: text("status", { 
    enum: ["pending", "processing", "sent", "delivered", "failed", "cancelled"] 
  }).notNull().default("pending"),
  
  // Retry Logic
  priority: integer("priority").notNull().default(5), // 1-10, higher = more important
  maxRetries: integer("max_retries").notNull().default(3),
  currentAttempts: integer("current_attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for").defaultNow(), // When to send
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  
  // Error Handling
  lastError: text("last_error"),
  errorDetails: jsonb("error_details"), // Full error info for debugging
  
  // Metadata
  metadata: jsonb("metadata"), // Additional channel-specific data
  providerMessageId: text("provider_message_id"), // External provider's message ID
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Notification Templates for Different Alert Types
export const notificationTemplates = pgTable("notification_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  type: text("type", { enum: ["email", "sms", "push", "telegram", "discord"] }).notNull(),
  category: text("category", { enum: ["signal", "price_alert", "portfolio", "system", "marketing"] }).notNull(),
  
  // Template Content
  subject: text("subject"), // For email and push
  bodyText: text("body_text").notNull(),
  bodyHtml: text("body_html"), // For email
  
  // Template Variables
  variables: jsonb("variables").notNull().default('[]'), // Array of variable names
  
  // Configuration
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false), // System templates can't be deleted
  
  // Metadata
  description: text("description"),
  tags: jsonb("tags").default('[]'),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Notification Delivery Logs
export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  queueId: uuid("queue_id").references(() => notificationQueue.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  
  // Delivery Information
  channel: text("channel").notNull(),
  recipient: text("recipient").notNull(),
  status: text("status", { 
    enum: ["sent", "delivered", "failed", "bounced", "spam", "unsubscribed"] 
  }).notNull(),
  
  // Provider Information
  provider: text("provider"), // "twilio", "sendgrid", "firebase", etc.
  providerMessageId: text("provider_message_id"),
  providerResponse: jsonb("provider_response"),
  
  // Performance Metrics
  processingTimeMs: integer("processing_time_ms"),
  deliveryTimeMs: integer("delivery_time_ms"),
  
  // Error Details
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  
  // Timestamps
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Notification Channel Configurations
export const notificationChannels = pgTable("notification_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  type: text("type", { enum: ["email", "sms", "push", "telegram", "discord"] }).notNull(),
  
  // Channel Status
  isEnabled: boolean("is_enabled").notNull().default(true),
  isHealthy: boolean("is_healthy").notNull().default(true),
  lastHealthCheck: timestamp("last_health_check"),
  
  // Configuration
  config: jsonb("config").notNull(), // Provider-specific configuration
  rateLimitPerMinute: integer("rate_limit_per_minute").default(60),
  rateLimitPerHour: integer("rate_limit_per_hour").default(1000),
  
  // Provider Information
  provider: text("provider").notNull(), // "twilio", "sendgrid", "firebase", etc.
  providerConfig: jsonb("provider_config").notNull(),
  
  // Performance Metrics
  totalSent: integer("total_sent").notNull().default(0),
  totalDelivered: integer("total_delivered").notNull().default(0),
  totalFailed: integer("total_failed").notNull().default(0),
  avgDeliveryTimeMs: integer("avg_delivery_time_ms").default(0),
  
  // Error Handling
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lastError: text("last_error"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notificationTimingAnalytics = pgTable("notification_timing_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  notificationId: varchar("notification_id").notNull(), // Reference to sent notification
  sentAt: timestamp("sent_at").notNull(),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  dismissedAt: timestamp("dismissed_at"),
  responseTime: integer("response_time"), // Seconds to open/click
  marketCondition: varchar("market_condition"), // "bullish", "bearish", "volatile", "stable"
  signalConfidence: decimal("signal_confidence", { precision: 5, scale: 4 }), // 0.0000 to 1.0000
  userActiveScore: decimal("user_active_score", { precision: 3, scale: 2 }), // 0.00 to 1.00
  timeScore: decimal("time_score", { precision: 3, scale: 2 }), // Calculated timing effectiveness
  createdAt: timestamp("created_at").defaultNow(),
});

export const smartTimingOptimizations = pgTable("smart_timing_optimizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  optimizationType: varchar("optimization_type").notNull(), // "peak_hours", "quiet_adjustment", "frequency_limit"
  currentSetting: jsonb("current_setting").notNull(),
  suggestedSetting: jsonb("suggested_setting").notNull(),
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }).notNull(),
  appliedAt: timestamp("applied_at"),
  effectivenessScore: decimal("effectiveness_score", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationTimingPreferenceSchema = createInsertSchema(notificationTimingPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationTimingAnalyticSchema = createInsertSchema(notificationTimingAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertSmartTimingOptimizationSchema = createInsertSchema(smartTimingOptimizations).omit({
  id: true,
  createdAt: true,
});

export type NotificationTimingPreference = typeof notificationTimingPreferences.$inferSelect;
export type InsertNotificationTimingPreference = z.infer<typeof insertNotificationTimingPreferenceSchema>;
export type NotificationTimingAnalytic = typeof notificationTimingAnalytics.$inferSelect;
export type InsertNotificationTimingAnalytic = z.infer<typeof insertNotificationTimingAnalyticSchema>;
export type SmartTimingOptimization = typeof smartTimingOptimizations.$inferSelect;
export type InsertSmartTimingOptimization = z.infer<typeof insertSmartTimingOptimizationSchema>;

// Notification Queue Types
export type NotificationQueue = typeof notificationQueue.$inferSelect;
export type InsertNotificationQueue = typeof notificationQueue.$inferInsert;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;
export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type InsertNotificationChannel = typeof notificationChannels.$inferInsert;

// Achievement system tables
export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category", { enum: ["trading", "social", "learning", "milestone", "streak"] }).notNull(),
  iconType: text("icon_type", { enum: ["trophy", "medal", "star", "badge", "crown"] }).notNull(),
  iconColor: text("icon_color", { enum: ["gold", "silver", "bronze", "blue", "green", "purple"] }).notNull().default("gold"),
  points: integer("points").notNull().default(0),
  requirement: jsonb("requirement").notNull(), // { type: 'login_streak', target: 7 }
  isActive: boolean("is_active").notNull().default(true),
  rarity: text("rarity", { enum: ["common", "rare", "epic", "legendary"] }).notNull().default("common"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userAchievements = pgTable("user_achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: uuid("achievement_id").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  progress: integer("progress").notNull().default(0),
  target: integer("target").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userStats = pgTable("user_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  totalLogins: integer("total_logins").notNull().default(0),
  loginStreak: integer("login_streak").notNull().default(0),
  lastLoginDate: timestamp("last_login_date"),
  signalsReceived: integer("signals_received").notNull().default(0),
  alertsCreated: integer("alerts_created").notNull().default(0),
  dashboardViews: integer("dashboard_views").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Achievement types and schemas
export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
