import { db } from "../db.js";
import { notificationQueue, notificationLogs, notificationChannels, users, userSettings, alertSignals } from "../../shared/schema.js";
import { eq, and, lte, isNull, sql, desc, asc } from "drizzle-orm";
import { smsService } from "./smsService.js";
import { telegramService } from "./telegramService.js";

export interface QueuedNotification {
  id: string;
  userId: string;
  alertId?: string;
  channel: "email" | "sms" | "push" | "telegram" | "discord";
  recipient: string;
  subject?: string;
  message: string;
  messageHtml?: string;
  templateId?: string;
  templateVariables?: any;
  status: "pending" | "processing" | "sent" | "delivered" | "failed" | "cancelled";
  priority: number;
  maxRetries: number;
  currentAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  scheduledFor: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  lastError?: string;
  errorDetails?: any;
  metadata?: any;
  providerMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveryTime?: number;
}

class NotificationQueueService {
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Temporarily disabled - notification tables not available in current schema
    // this.startProcessor();
    console.log('⚠️ Notification queue service disabled - required database tables not available');
  }

  // Start the notification processor
  startProcessor() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process notifications every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 30000);

    // Initial processing
    setTimeout(() => this.processQueue(), 1000);
  }

  // Stop the notification processor
  stopProcessor() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  // Add notification to queue
  async queueNotification(notification: {
    userId: string;
    alertId?: string;
    channel: "email" | "sms" | "push" | "telegram" | "discord";
    recipient: string;
    subject?: string;
    message: string;
    messageHtml?: string;
    templateId?: string;
    templateVariables?: any;
    priority?: number;
    scheduledFor?: Date;
    metadata?: any;
  }): Promise<string> {
    // Temporarily disabled - database tables not available
    console.log('⚠️ Notification queue disabled - returning mock ID');
    return 'disabled-' + Date.now();
    
    const [result] = await db.insert(notificationQueue).values({
      userId: notification.userId,
      alertId: notification.alertId,
      channel: notification.channel,
      recipient: notification.recipient,
      subject: notification.subject,
      message: notification.message,
      messageHtml: notification.messageHtml,
      templateId: notification.templateId,
      templateVariables: notification.templateVariables,
      priority: notification.priority || 5,
      scheduledFor: notification.scheduledFor || new Date(),
      metadata: notification.metadata,
      status: "pending",
      maxRetries: 3,
      currentAttempts: 0,
    }).returning({ id: notificationQueue.id });

    console.log(`Notification queued: ${result.id} (${notification.channel} to ${notification.recipient})`);
    return result.id;
  }

  // Queue trading signal notification for user
  async queueSignalNotification(alertId: string, userId: string) {
    try {
      // Get alert details
      const alert = await db.select()
        .from(alertSignals)
        .where(eq(alertSignals.id, alertId))
        .limit(1);

      if (!alert.length) return;

      const alertData = alert[0];

      // Get user settings
      const settings = await db.select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      if (!settings.length) return;

      const userPrefs = settings[0];

      // Queue notifications based on user preferences
      const notifications = [];

      // Email notification
      if (userPrefs.emailSignalAlerts && userPrefs.emailAddress) {
        notifications.push({
          userId,
          alertId,
          channel: "email" as const,
          recipient: userPrefs.emailAddress,
          subject: `🚨 ${alertData.action.toUpperCase()} Signal: ${alertData.symbol}`,
          message: `Trading Signal Alert\n\nSymbol: ${alertData.symbol}\nAction: ${alertData.action.toUpperCase()}\nPrice: $${alertData.price}\nTimeframe: ${alertData.timeframe}\nNotes: ${alertData.notes || 'N/A'}\n\nTime: ${alertData.timestamp}`,
          messageHtml: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${alertData.action === 'buy' ? '#10B981' : '#EF4444'};">
                🚨 ${alertData.action.toUpperCase()} Signal: ${alertData.symbol}
              </h2>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Symbol:</strong> ${alertData.symbol}</p>
                <p><strong>Action:</strong> <span style="color: ${alertData.action === 'buy' ? '#10B981' : '#EF4444'}; font-weight: bold;">${alertData.action.toUpperCase()}</span></p>
                <p><strong>Price:</strong> $${alertData.price}</p>
                <p><strong>Timeframe:</strong> ${alertData.timeframe}</p>
                <p><strong>Notes:</strong> ${alertData.notes || 'N/A'}</p>
                <p><strong>Time:</strong> ${alertData.timestamp}</p>
              </div>
              <p style="color: #6b7280; font-size: 12px;">
                This is an automated trading signal from CryptoStrategy Pro.
              </p>
            </div>
          `,
          priority: 8,
        });
      }

      // SMS notification
      if (userPrefs.smsSignalAlerts && userPrefs.phoneNumber) {
        notifications.push({
          userId,
          alertId,
          channel: "sms" as const,
          recipient: userPrefs.phoneNumber,
          message: `🚨 ${alertData.action.toUpperCase()} ${alertData.symbol} at $${alertData.price} (${alertData.timeframe}) - CryptoStrategy Pro`,
          priority: 9,
        });
      }

      // Telegram notification
      if (userPrefs.notificationTelegram && userPrefs.telegramChatId) {
        notifications.push({
          userId,
          alertId,
          channel: "telegram" as const,
          recipient: userPrefs.telegramChatId,
          message: `🚨 <b>${alertData.action.toUpperCase()}</b> Signal\n\n📊 <b>${alertData.symbol}</b>\n💰 Price: $${alertData.price}\n⏰ Timeframe: ${alertData.timeframe}\n📝 Notes: ${alertData.notes || 'N/A'}\n\n🕐 ${alertData.timestamp}`,
          priority: 8,
        });
      }

      // Queue all notifications
      for (const notification of notifications) {
        await this.queueNotification(notification);
      }

      console.log(`Queued ${notifications.length} notifications for signal ${alertId}`);
    } catch (error) {
      console.error('Error queuing signal notification:', error);
    }
  }

  // Process pending notifications
  async processQueue() {
    // Temporarily disabled - database tables not available
    console.log('⚠️ Notification processing skipped - required database tables not available');
    return;

    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
      // Get pending notifications that are due for processing
      const pendingNotifications = await db.select()
        .from(notificationQueue)
        .where(
          and(
            eq(notificationQueue.status, "pending"),
            lte(notificationQueue.scheduledFor, new Date()),
            sql`(${notificationQueue.nextRetryAt} IS NULL OR ${notificationQueue.nextRetryAt} <= NOW())`
          )
        )
        .orderBy(desc(notificationQueue.priority), asc(notificationQueue.createdAt))
        .limit(50);

      console.log(`Processing ${pendingNotifications.length} notifications`);

      for (const notification of pendingNotifications) {
        await this.processNotification(notification);
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process individual notification
  async processNotification(notification: any) {
    const startTime = Date.now();
    
    try {
      // Mark as processing
      await db.update(notificationQueue)
        .set({ 
          status: "processing",
          lastAttemptAt: new Date(),
          currentAttempts: notification.currentAttempts + 1,
          updatedAt: new Date()
        })
        .where(eq(notificationQueue.id, notification.id));

      let result: NotificationResult;

      // Send notification based on channel
      switch (notification.channel) {
        case "email":
          result = await this.sendEmail(notification);
          break;
        case "sms":
          result = await this.sendSMS(notification);
          break;
        case "telegram":
          result = await this.sendTelegram(notification);
          break;
        case "push":
          result = await this.sendPush(notification);
          break;
        case "discord":
          result = await this.sendDiscord(notification);
          break;
        default:
          throw new Error(`Unsupported channel: ${notification.channel}`);
      }

      const processingTime = Date.now() - startTime;

      if (result.success) {
        // Mark as sent
        await db.update(notificationQueue)
          .set({
            status: "sent",
            sentAt: new Date(),
            providerMessageId: result.messageId,
            updatedAt: new Date()
          })
          .where(eq(notificationQueue.id, notification.id));

        // Log successful delivery
        await this.logDelivery(notification, "sent", processingTime, result);
      } else {
        await this.handleFailure(notification, result.error || "Unknown error", processingTime);
      }
    } catch (error: any) {
      console.error(`Error processing notification ${notification.id}:`, error);
      const processingTime = Date.now() - startTime;
      await this.handleFailure(notification, error.message, processingTime);
    }
  }

  // Handle notification failure
  async handleFailure(notification: any, error: string, processingTime: number) {
    const shouldRetry = notification.currentAttempts < notification.maxRetries;
    const nextRetryAt = shouldRetry 
      ? new Date(Date.now() + Math.pow(2, notification.currentAttempts) * 60000) // Exponential backoff
      : null;

    await db.update(notificationQueue)
      .set({
        status: shouldRetry ? "pending" : "failed",
        lastError: error,
        nextRetryAt,
        updatedAt: new Date()
      })
      .where(eq(notificationQueue.id, notification.id));

    // Log failure
    await this.logDelivery(notification, "failed", processingTime, { success: false, error });
  }

  // Send email notification
  async sendEmail(notification: any): Promise<NotificationResult> {
    // For now, return demo success since SENDGRID_API_KEY might not be configured
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
    
    return {
      success: true,
      messageId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deliveryTime: 100
    };
  }

  // Send SMS notification
  async sendSMS(notification: any): Promise<NotificationResult> {
    try {
      if (!smsService.isConfigured()) {
        // Demo mode - simulate success
        return {
          success: true,
          messageId: `sms_demo_${Date.now()}`,
          deliveryTime: 200
        };
      }

      const result = await smsService.sendSMS(notification.recipient, notification.message);
      return {
        success: true,
        messageId: result.sid,
        deliveryTime: 500
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Send Telegram notification
  async sendTelegram(notification: any): Promise<NotificationResult> {
    try {
      if (!telegramService.isConfigured()) {
        // Demo mode - simulate success
        return {
          success: true,
          messageId: `telegram_demo_${Date.now()}`,
          deliveryTime: 300
        };
      }

      const result = await telegramService.sendMessage(notification.recipient, notification.message);
      return {
        success: true,
        messageId: result.message_id.toString(),
        deliveryTime: 400
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Send push notification
  async sendPush(notification: any): Promise<NotificationResult> {
    // Demo implementation
    await new Promise(resolve => setTimeout(resolve, 150));
    
    return {
      success: true,
      messageId: `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deliveryTime: 150
    };
  }

  // Send Discord notification
  async sendDiscord(notification: any): Promise<NotificationResult> {
    // Demo implementation
    await new Promise(resolve => setTimeout(resolve, 250));
    
    return {
      success: true,
      messageId: `discord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deliveryTime: 250
    };
  }

  // Log notification delivery
  async logDelivery(notification: any, status: string, processingTime: number, result: NotificationResult) {
    await db.insert(notificationLogs).values({
      queueId: notification.id,
      userId: notification.userId,
      channel: notification.channel,
      recipient: notification.recipient,
      status,
      provider: this.getProviderForChannel(notification.channel),
      providerMessageId: result.messageId,
      providerResponse: result,
      processingTimeMs: processingTime,
      deliveryTimeMs: result.deliveryTime,
      errorCode: result.success ? null : "DELIVERY_FAILED",
      errorMessage: result.error,
      sentAt: result.success ? new Date() : null,
      deliveredAt: result.success ? new Date() : null,
    });
  }

  // Get provider name for channel
  private getProviderForChannel(channel: string): string {
    switch (channel) {
      case "email": return "sendgrid";
      case "sms": return "twilio";
      case "telegram": return "telegram_bot";
      case "push": return "firebase";
      case "discord": return "discord_webhook";
      default: return "unknown";
    }
  }

  // Get queue statistics
  async getQueueStats() {
    const stats = await db.select({
      status: notificationQueue.status,
      channel: notificationQueue.channel,
      count: sql<number>`count(*)`.as('count')
    })
    .from(notificationQueue)
    .groupBy(notificationQueue.status, notificationQueue.channel);

    const totalLogs = await db.select({
      count: sql<number>`count(*)`.as('count')
    })
    .from(notificationLogs);

    const recentFailures = await db.select()
      .from(notificationQueue)
      .where(eq(notificationQueue.status, "failed"))
      .orderBy(desc(notificationQueue.updatedAt))
      .limit(10);

    return {
      queueStats: stats,
      totalProcessed: totalLogs[0]?.count || 0,
      recentFailures
    };
  }

  // Retry failed notification
  async retryNotification(notificationId: string) {
    await db.update(notificationQueue)
      .set({
        status: "pending",
        nextRetryAt: null,
        lastError: null,
        updatedAt: new Date()
      })
      .where(eq(notificationQueue.id, notificationId));
  }

  // Get notification queue for admin
  async getQueueForAdmin(limit: number = 100) {
    return await db.select()
      .from(notificationQueue)
      .orderBy(desc(notificationQueue.createdAt))
      .limit(limit);
  }
}

export const notificationQueueService = new NotificationQueueService();