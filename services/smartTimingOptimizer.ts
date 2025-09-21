import { db } from '../db';
import { 
  notificationTimingPreferences, 
  notificationTimingAnalytics, 
  smartTimingOptimizations,
  type NotificationTimingPreference,
  type NotificationTimingAnalytic,
  type InsertNotificationTimingPreference,
  type InsertNotificationTimingAnalytic,
  type InsertSmartTimingOptimization
} from '@shared/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

export class SmartTimingOptimizer {
  // Get user's timing preferences or create defaults
  async getUserTimingPreferences(userId: string): Promise<NotificationTimingPreference> {
    const [existing] = await db
      .select()
      .from(notificationTimingPreferences)
      .where(eq(notificationTimingPreferences.userId, userId))
      .limit(1);

    if (existing) {
      return existing;
    }

    // Create default preferences
    const defaultPreferences: InsertNotificationTimingPreference = {
      userId,
      timezone: 'UTC',
      preferredHours: [9, 10, 11, 16, 17, 18], // Business hours
      quietHours: [22, 23, 0, 1, 2, 3, 4, 5, 6, 7], // Night time
      weekendPreference: 'reduced',
      marketOpenOnly: false,
      maxNotificationsPerHour: 3,
      adaptiveTiming: true
    };

    const [created] = await db
      .insert(notificationTimingPreferences)
      .values(defaultPreferences)
      .returning();

    return created;
  }

  // Update user timing preferences
  async updateTimingPreferences(
    userId: string, 
    updates: Partial<InsertNotificationTimingPreference>
  ): Promise<NotificationTimingPreference> {
    const [updated] = await db
      .update(notificationTimingPreferences)
      .set({ 
        ...updates, 
        updatedAt: new Date() 
      })
      .where(eq(notificationTimingPreferences.userId, userId))
      .returning();

    return updated;
  }

  // Record notification interaction analytics
  async recordNotificationAnalytics(data: InsertNotificationTimingAnalytic): Promise<void> {
    await db
      .insert(notificationTimingAnalytics)
      .values(data);
  }

  // Calculate optimal timing based on user behavior
  async calculateOptimalTiming(userId: string): Promise<{
    peakHours: number[];
    quietHours: number[];
    bestDays: string[];
    avgResponseTime: number;
    engagementScore: number;
  }> {
    // Get last 30 days of analytics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const analytics = await db
      .select()
      .from(notificationTimingAnalytics)
      .where(
        and(
          eq(notificationTimingAnalytics.userId, userId),
          gte(notificationTimingAnalytics.sentAt, thirtyDaysAgo)
        )
      )
      .orderBy(desc(notificationTimingAnalytics.sentAt));

    if (analytics.length === 0) {
      // Return default optimization for new users
      return {
        peakHours: [9, 10, 11, 16, 17],
        quietHours: [22, 23, 0, 1, 2, 3, 4, 5, 6, 7],
        bestDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        avgResponseTime: 0,
        engagementScore: 0
      };
    }

    // Analyze engagement by hour
    const hourlyEngagement = new Map<number, { opened: number, total: number, avgResponse: number }>();
    
    analytics.forEach(analytic => {
      const hour = analytic.sentAt.getHours();
      const current = hourlyEngagement.get(hour) || { opened: 0, total: 0, avgResponse: 0 };
      
      current.total++;
      if (analytic.openedAt) {
        current.opened++;
        const responseTime = analytic.responseTime || 0;
        current.avgResponse = (current.avgResponse + responseTime) / 2;
      }
      
      hourlyEngagement.set(hour, current);
    });

    // Calculate peak hours (>50% engagement rate)
    const peakHours = Array.from(hourlyEngagement.entries())
      .filter(([, stats]) => stats.opened / stats.total > 0.5)
      .sort((a, b) => (b[1].opened / b[1].total) - (a[1].opened / a[1].total))
      .slice(0, 6)
      .map(([hour]) => hour);

    // Calculate quiet hours (<20% engagement rate)
    const quietHours = Array.from(hourlyEngagement.entries())
      .filter(([, stats]) => stats.opened / stats.total < 0.2)
      .map(([hour]) => hour);

    // Analyze best days
    const dailyEngagement = new Map<string, { opened: number, total: number }>();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    analytics.forEach(analytic => {
      const day = dayNames[analytic.sentAt.getDay()];
      const current = dailyEngagement.get(day) || { opened: 0, total: 0 };
      
      current.total++;
      if (analytic.openedAt) current.opened++;
      
      dailyEngagement.set(day, current);
    });

    const bestDays = Array.from(dailyEngagement.entries())
      .filter(([, stats]) => stats.opened / stats.total > 0.4)
      .sort((a, b) => (b[1].opened / b[1].total) - (a[1].opened / a[1].total))
      .map(([day]) => day);

    // Calculate average response time and engagement score
    const engagedAnalytics = analytics.filter(a => a.openedAt);
    const avgResponseTime = engagedAnalytics.length > 0 
      ? engagedAnalytics.reduce((sum, a) => sum + (a.responseTime || 0), 0) / engagedAnalytics.length
      : 0;

    const engagementScore = analytics.length > 0 
      ? engagedAnalytics.length / analytics.length 
      : 0;

    return {
      peakHours: peakHours.length > 0 ? peakHours : [9, 10, 11, 16, 17],
      quietHours: quietHours.length > 0 ? quietHours : [22, 23, 0, 1, 2, 3, 4, 5, 6, 7],
      bestDays: bestDays.length > 0 ? bestDays : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      avgResponseTime,
      engagementScore
    };
  }

  // Generate timing optimization suggestions
  async generateOptimizationSuggestions(userId: string): Promise<InsertSmartTimingOptimization[]> {
    const preferences = await this.getUserTimingPreferences(userId);
    const optimal = await this.calculateOptimalTiming(userId);
    
    const suggestions: InsertSmartTimingOptimization[] = [];

    // Suggest peak hours optimization
    if (optimal.engagementScore > 0.3) { // Only suggest if we have sufficient data
      const currentPeakHours = preferences.preferredHours as number[];
      const suggestedPeakHours = optimal.peakHours;
      
      if (JSON.stringify(currentPeakHours.sort()) !== JSON.stringify(suggestedPeakHours.sort())) {
        suggestions.push({
          userId,
          optimizationType: 'peak_hours',
          currentSetting: { hours: currentPeakHours },
          suggestedSetting: { hours: suggestedPeakHours },
          confidenceScore: Math.min(optimal.engagementScore * 2, 1), // Scale confidence
        });
      }
    }

    // Suggest quiet hours adjustment
    if (optimal.quietHours.length > 0) {
      const currentQuietHours = preferences.quietHours as number[];
      const suggestedQuietHours = optimal.quietHours;
      
      if (JSON.stringify(currentQuietHours.sort()) !== JSON.stringify(suggestedQuietHours.sort())) {
        suggestions.push({
          userId,
          optimizationType: 'quiet_adjustment',
          currentSetting: { hours: currentQuietHours },
          suggestedSetting: { hours: suggestedQuietHours },
          confidenceScore: Math.min(optimal.engagementScore * 1.5, 1),
        });
      }
    }

    // Suggest frequency adjustment based on response patterns
    if (optimal.avgResponseTime > 0) {
      const currentMaxPerHour = preferences.maxNotificationsPerHour;
      let suggestedMaxPerHour = currentMaxPerHour;

      if (optimal.avgResponseTime < 300) { // Fast response - can handle more
        suggestedMaxPerHour = Math.min(currentMaxPerHour + 1, 5);
      } else if (optimal.avgResponseTime > 1800) { // Slow response - reduce frequency
        suggestedMaxPerHour = Math.max(currentMaxPerHour - 1, 1);
      }

      if (suggestedMaxPerHour !== currentMaxPerHour) {
        suggestions.push({
          userId,
          optimizationType: 'frequency_limit',
          currentSetting: { maxPerHour: currentMaxPerHour },
          suggestedSetting: { maxPerHour: suggestedMaxPerHour },
          confidenceScore: Math.min(optimal.engagementScore * 1.2, 1),
        });
      }
    }

    return suggestions;
  }

  // Apply optimization suggestion
  async applyOptimization(optimizationId: string): Promise<boolean> {
    const [optimization] = await db
      .select()
      .from(smartTimingOptimizations)
      .where(eq(smartTimingOptimizations.id, optimizationId))
      .limit(1);

    if (!optimization) return false;

    const preferences = await this.getUserTimingPreferences(optimization.userId);
    const updates: Partial<InsertNotificationTimingPreference> = {};

    switch (optimization.optimizationType) {
      case 'peak_hours':
        updates.preferredHours = optimization.suggestedSetting.hours;
        break;
      case 'quiet_adjustment':
        updates.quietHours = optimization.suggestedSetting.hours;
        break;
      case 'frequency_limit':
        updates.maxNotificationsPerHour = optimization.suggestedSetting.maxPerHour;
        break;
    }

    if (Object.keys(updates).length > 0) {
      await this.updateTimingPreferences(optimization.userId, updates);
      
      // Mark optimization as applied
      await db
        .update(smartTimingOptimizations)
        .set({ appliedAt: new Date() })
        .where(eq(smartTimingOptimizations.id, optimizationId));

      return true;
    }

    return false;
  }

  // Check if notification should be sent based on timing rules
  async shouldSendNotification(userId: string, signalConfidence: number = 0.8): Promise<{
    shouldSend: boolean;
    reason: string;
    delayUntil?: Date;
  }> {
    const preferences = await this.getUserTimingPreferences(userId);
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayName = dayNames[currentDay];

    // Check quiet hours
    const quietHours = preferences.quietHours as number[];
    if (quietHours.includes(currentHour)) {
      // Find next preferred hour
      const preferredHours = preferences.preferredHours as number[];
      const nextPreferredHour = preferredHours.find(h => h > currentHour) || preferredHours[0];
      const delayUntil = new Date(now);
      
      if (nextPreferredHour > currentHour) {
        delayUntil.setHours(nextPreferredHour, 0, 0, 0);
      } else {
        delayUntil.setDate(delayUntil.getDate() + 1);
        delayUntil.setHours(nextPreferredHour, 0, 0, 0);
      }

      return {
        shouldSend: false,
        reason: 'Current time is in quiet hours',
        delayUntil
      };
    }

    // Check weekend preference
    const isWeekend = currentDay === 0 || currentDay === 6;
    if (isWeekend && preferences.weekendPreference === 'none') {
      return {
        shouldSend: false,
        reason: 'Weekend notifications disabled'
      };
    }

    if (isWeekend && preferences.weekendPreference === 'reduced' && signalConfidence < 0.9) {
      return {
        shouldSend: false,
        reason: 'Weekend - only high confidence signals allowed'
      };
    }

    // Check market hours if enabled
    if (preferences.marketOpenOnly) {
      const marketHours = this.getMarketHours();
      if (!this.isMarketOpen(now, marketHours)) {
        return {
          shouldSend: false,
          reason: 'Market is closed'
        };
      }
    }

    // Check notification frequency limit
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentNotifications = await db
      .select()
      .from(notificationTimingAnalytics)
      .where(
        and(
          eq(notificationTimingAnalytics.userId, userId),
          gte(notificationTimingAnalytics.sentAt, oneHourAgo)
        )
      );

    if (recentNotifications.length >= preferences.maxNotificationsPerHour) {
      return {
        shouldSend: false,
        reason: 'Hourly notification limit reached'
      };
    }

    return {
      shouldSend: true,
      reason: 'All timing conditions met'
    };
  }

  // Get market hours (simplified - can be enhanced with holiday calendars)
  private getMarketHours() {
    return {
      weekdays: { open: 9, close: 16 }, // 9 AM to 4 PM
      timezone: 'America/New_York'
    };
  }

  // Check if market is currently open
  private isMarketOpen(date: Date, marketHours: any): boolean {
    const day = date.getDay();
    if (day === 0 || day === 6) return false; // Weekend

    const hour = date.getHours();
    return hour >= marketHours.weekdays.open && hour < marketHours.weekdays.close;
  }

  // Get user's timing analytics summary
  async getTimingAnalyticsSummary(userId: string, days: number = 30): Promise<{
    totalNotifications: number;
    engagementRate: number;
    avgResponseTime: number;
    bestPerformingHours: number[];
    worstPerformingHours: number[];
    weeklyPattern: { [key: string]: number };
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const analytics = await db
      .select()
      .from(notificationTimingAnalytics)
      .where(
        and(
          eq(notificationTimingAnalytics.userId, userId),
          gte(notificationTimingAnalytics.sentAt, startDate)
        )
      );

    const totalNotifications = analytics.length;
    const engagedNotifications = analytics.filter(a => a.openedAt).length;
    const engagementRate = totalNotifications > 0 ? engagedNotifications / totalNotifications : 0;

    const responseTimes = analytics
      .filter(a => a.responseTime)
      .map(a => a.responseTime!);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    // Analyze hourly performance
    const hourlyStats = new Map<number, { total: number; engaged: number }>();
    analytics.forEach(a => {
      const hour = a.sentAt.getHours();
      const stats = hourlyStats.get(hour) || { total: 0, engaged: 0 };
      stats.total++;
      if (a.openedAt) stats.engaged++;
      hourlyStats.set(hour, stats);
    });

    const hourlyRates = Array.from(hourlyStats.entries())
      .map(([hour, stats]) => ({
        hour,
        rate: stats.total > 0 ? stats.engaged / stats.total : 0
      }))
      .sort((a, b) => b.rate - a.rate);

    const bestPerformingHours = hourlyRates.slice(0, 5).map(h => h.hour);
    const worstPerformingHours = hourlyRates.slice(-5).map(h => h.hour);

    // Weekly pattern
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weeklyPattern: { [key: string]: number } = {};
    
    dayNames.forEach(day => weeklyPattern[day] = 0);
    
    analytics.forEach(a => {
      const day = dayNames[a.sentAt.getDay()];
      weeklyPattern[day]++;
    });

    return {
      totalNotifications,
      engagementRate,
      avgResponseTime,
      bestPerformingHours,
      worstPerformingHours,
      weeklyPattern
    };
  }
}

export const smartTimingOptimizer = new SmartTimingOptimizer();