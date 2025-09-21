import { notificationQueueService } from "./notificationQueue";

/**
 * Scheduled Edge Function to Process Notifications
 * 
 * This service acts as a Supabase-style Edge Function that runs periodically
 * to process the notification queue. In a production environment, this would
 * be deployed as a serverless function with scheduled execution.
 * 
 * For this implementation, it runs as a Node.js service with interval-based execution.
 */

class ScheduledNotificationProcessor {
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private processingIntervalMs = 30000; // 30 seconds
  private batchSize = 50;

  constructor() {
    this.startScheduledProcessing();
  }

  // Start the scheduled processor
  startScheduledProcessing() {
    console.log('🚀 Starting Scheduled Notification Processor...');
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process notifications every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processNotificationBatch();
    }, this.processingIntervalMs);

    // Initial processing after 3 seconds
    setTimeout(() => {
      this.processNotificationBatch();
    }, 3000);

    console.log(`✅ Notification processor scheduled every ${this.processingIntervalMs / 1000} seconds`);
  }

  // Stop the scheduled processor
  stopScheduledProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('⏹️ Notification processor stopped');
    }
  }

  // Process a batch of notifications
  async processNotificationBatch() {
    if (this.isProcessing) {
      console.log('⏳ Notification processing already in progress, skipping batch...');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      console.log('📨 Processing notification batch...');
      
      // Get statistics before processing
      const beforeStats = await notificationQueueService.getQueueStats();
      
      // Process the queue
      await notificationQueueService.processQueue();
      
      // Get statistics after processing
      const afterStats = await notificationQueueService.getQueueStats();
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Notification batch processed in ${processingTime}ms`);
      
      // Log processing summary
      if (beforeStats.queueStats && afterStats.queueStats) {
        const beforePending = beforeStats.queueStats.find(s => s.status === 'pending')?.count || 0;
        const afterPending = afterStats.queueStats.find(s => s.status === 'pending')?.count || 0;
        const processed = beforePending - afterPending;
        
        if (processed > 0) {
          console.log(`📊 Processed ${processed} notifications (${afterPending} pending remaining)`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error in scheduled notification processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Get processor status
  getStatus() {
    return {
      isRunning: this.processingInterval !== null,
      isProcessing: this.isProcessing,
      intervalMs: this.processingIntervalMs,
      batchSize: this.batchSize
    };
  }

  // Update processing interval (for admin control)
  updateInterval(intervalMs: number) {
    if (intervalMs < 10000) { // Minimum 10 seconds
      throw new Error('Processing interval cannot be less than 10 seconds');
    }
    
    this.processingIntervalMs = intervalMs;
    this.startScheduledProcessing(); // Restart with new interval
    
    console.log(`⚙️ Notification processing interval updated to ${intervalMs / 1000} seconds`);
  }

  // Force process notifications immediately (for admin control)
  async forceProcess() {
    console.log('🔄 Force processing notifications...');
    await this.processNotificationBatch();
  }

  // Health check
  async healthCheck() {
    try {
      const stats = await notificationQueueService.getQueueStats();
      const status = this.getStatus();
      
      return {
        healthy: true,
        processor: status,
        queue: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export const scheduledProcessor = new ScheduledNotificationProcessor();

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, stopping notification processor...');
  scheduledProcessor.stopScheduledProcessing();
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, stopping notification processor...');
  scheduledProcessor.stopScheduledProcessing();
  process.exit(0);
});

export default scheduledProcessor;