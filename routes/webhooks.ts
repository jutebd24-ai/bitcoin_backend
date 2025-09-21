/**
 * Webhook Routes
 * Handles external webhooks from TradingView, Stripe, etc.
 */
import type { Express } from "express";
import type { WebSocketServer } from "ws";
import { body } from "express-validator";
import { storage } from "../storage.js";
import { validateInput } from "../utils/validation.js";
import { broadcast } from "../utils/websocket.js";

/**
 * Webhook routes setup
 */
export function webhookRoutes(app: Express, wss: WebSocketServer) {

  /**
   * TradingView webhook for receiving signals
   * POST /api/webhooks/tradingview
   */
  app.post('/api/webhooks/tradingview', [
    body('symbol').exists().withMessage('Symbol required'),
    body('action').isIn(['buy', 'sell']).withMessage('Action must be buy or sell'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be positive'),
    body('timeframe').optional().isString(),
    validateInput
  ], async (req, res) => {
    try {
      const { symbol, action, price, timeframe, message } = req.body;
      
      console.log('📊 TradingView webhook received:', {
        symbol,
        action,
        price,
        timeframe
      });

      // Create signal from webhook
      const signalData = {
        ticker: symbol,
        signalType: action,
        price: parseFloat(price),
        timeframe: timeframe || '1h',
        notes: message || `TradingView ${action} signal`,
        timestamp: new Date().toISOString()
      };

      const signal = await storage.createSignal(signalData);

      // Broadcast to WebSocket clients
      broadcast(wss, {
        type: 'webhook_signal',
        data: {
          ...signal,
          source: 'tradingview'
        }
      });

      console.log('✅ Signal created from TradingView webhook:', signal.id);

      res.json({
        message: 'Webhook processed successfully',
        signalId: signal.id
      });

    } catch (error) {
      console.error('TradingView webhook error:', error);
      res.status(500).json({ 
        message: 'Webhook processing failed',
        code: 'WEBHOOK_ERROR'
      });
    }
  });

  /**
   * Stripe webhook for payment events
   * POST /api/webhooks/stripe
   */
  app.post('/api/webhooks/stripe', async (req, res) => {
    try {
      const event = req.body;
      
      console.log('💳 Stripe webhook received:', event.type);

      switch (event.type) {
        case 'payment_intent.succeeded':
          console.log('✅ Payment succeeded:', event.data.object.id);
          // Handle successful payment
          break;
          
        case 'payment_intent.payment_failed':
          console.log('❌ Payment failed:', event.data.object.id);
          // Handle failed payment
          break;
          
        case 'customer.subscription.created':
          console.log('🎯 Subscription created:', event.data.object.id);
          // Handle new subscription
          break;
          
        case 'customer.subscription.deleted':
          console.log('🚫 Subscription cancelled:', event.data.object.id);
          // Handle cancelled subscription
          break;
          
        default:
          console.log('ℹ️ Unhandled Stripe event:', event.type);
      }

      res.json({ received: true });

    } catch (error) {
      console.error('Stripe webhook error:', error);
      res.status(400).json({ 
        message: 'Webhook processing failed',
        code: 'STRIPE_WEBHOOK_ERROR'
      });
    }
  });

  /**
   * Generic notification webhook
   * POST /api/webhooks/notify
   */
  app.post('/api/webhooks/notify', [
    body('type').exists().withMessage('Notification type required'),
    body('message').exists().withMessage('Message required'),
    validateInput
  ], async (req, res) => {
    try {
      const { type, message, data } = req.body;
      
      console.log('🔔 Notification webhook:', type, message);

      // Broadcast notification to clients
      broadcast(wss, {
        type: 'notification',
        notification: {
          type,
          message,
          data,
          timestamp: new Date().toISOString()
        }
      });

      res.json({
        message: 'Notification sent successfully'
      });

    } catch (error) {
      console.error('Notification webhook error:', error);
      res.status(500).json({ 
        message: 'Notification failed',
        code: 'NOTIFICATION_ERROR'
      });
    }
  });

  /**
   * Health check for webhook endpoints
   * GET /api/webhooks/health
   */
  app.get('/api/webhooks/health', (req, res) => {
    res.json({
      status: 'healthy',
      webhooks: [
        'tradingview',
        'stripe',
        'notify'
      ],
      timestamp: new Date().toISOString()
    });
  });
}