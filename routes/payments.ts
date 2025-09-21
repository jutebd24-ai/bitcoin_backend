/**
 * Payment Routes
 * Handles subscription payments, Stripe/PayPal integration
 */
import type { Express } from "express";
import type { WebSocketServer } from "ws";
import { body } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { validateInput } from "../utils/validation.js";
import { storage } from "../storage.js";
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault } from "../paypal.js";

/**
 * Payment routes setup
 */
export function paymentRoutes(app: Express, wss: WebSocketServer) {

  /**
   * Get subscription plans
   * GET /api/subscription-plans
   */
  app.get('/api/subscription-plans', async (req, res) => {
    try {
      // Fetch plans from database, filtering by active status
      const plans = await storage.getActiveSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error('Get subscription plans error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch subscription plans',
        code: 'SUBSCRIPTION_PLANS_ERROR'
      });
    }
  });

  /**
   * PayPal Client ID Endpoint
   * GET /paypal/client-id
   */
  app.get("/paypal/client-id", async (req, res) => {
    try {
      const clientId = process.env.PAYPAL_CLIENT_ID || "AYGLFWbjeR9n8nJEOwzjJQAitNr2HUWVV_jkcRAOcKFRZBd_e9NGTFY0nz2NTN5Lj1LF9sIDdO_EHpC9";
      res.json({ clientId });
    } catch (error) {
      console.error('Error getting PayPal client ID:', error);
      res.status(500).json({ error: 'Failed to get PayPal client ID' });
    }
  });

  /**
   * PayPal Setup Endpoint
   * GET /paypal/setup
   */
  app.get("/paypal/setup", async (req, res) => {
    await loadPaypalDefault(req, res);
  });

  /**
   * PayPal Create Order
   * POST /paypal/order
   */
  app.post("/paypal/order", async (req, res) => {
    await createPaypalOrder(req, res);
  });

  /**
   * PayPal Capture Order
   * POST /paypal/order/:orderID/capture
   */
  app.post("/paypal/order/:orderID/capture", async (req, res) => {
    await capturePaypalOrder(req, res);
  });

  /**
   * Create subscription - Main endpoint for frontend
   * POST /api/create-subscription
   */
  app.post('/api/create-subscription', [
    requireAuth,
    body('planTier').isIn(['basic', 'premium', 'pro']).withMessage('Invalid plan tier'),
    body('billingInterval').isIn(['monthly', 'yearly']).withMessage('Invalid billing interval'),
    body('paymentMethod').optional().isIn(['stripe', 'paypal']).withMessage('Invalid payment method'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { planTier, billingInterval, paymentMethod = 'stripe' } = req.body;
      const user = req.user;

      console.log(`💳 Creating subscription for user ${user.id}: ${planTier} plan (${billingInterval})`);

      // Check if user already has this subscription tier
      if (user.subscriptionTier === planTier) {
        return res.status(400).json({
          message: `You are already subscribed to the ${planTier} plan`,
          code: 'ALREADY_SUBSCRIBED'
        });
      }

      // Plan pricing in cents
      const planPricing: Record<string, { monthly: number; yearly: number }> = {
        basic: { monthly: 2997, yearly: 29997 },
        premium: { monthly: 4997, yearly: 49997 },
        pro: { monthly: 9997, yearly: 99997 }
      };

      const price = planPricing[planTier]?.[billingInterval];
      if (!price) {
        return res.status(400).json({
          message: 'Invalid plan or billing interval',
          code: 'INVALID_PLAN'
        });
      }

      if (paymentMethod === 'stripe') {
        // Create Stripe checkout session (mock)
        const sessionId = `cs_${Math.random().toString(36).substr(2, 9)}`;
        const checkoutUrl = `https://checkout.stripe.com/pay/${sessionId}`;

        res.json({
          message: 'Stripe checkout session created',
          checkoutUrl,
          sessionId,
          price: price / 100,
          planTier,
          billingInterval
        });
      } else if (paymentMethod === 'paypal') {
        // For PayPal payments: actually update user subscription in storage
        console.log(`✅ PayPal: Upgrading ${user.id} to ${planTier} subscription`);
        
        // Update user subscription in storage
        const updatedUser = await storage.updateUser(user.id, {
          subscriptionTier: planTier,
          subscriptionStatus: 'active'
        });
        
        if (updatedUser) {
          console.log(`✅ User ${user.id} subscription updated successfully to ${planTier}`);
          res.json({
            success: true,
            message: `Successfully upgraded to ${planTier} plan via PayPal!`,
            user: {
              subscriptionTier: updatedUser.subscriptionTier,
              subscriptionStatus: updatedUser.subscriptionStatus
            },
            subscription: {
              tier: updatedUser.subscriptionTier,
              status: updatedUser.subscriptionStatus,
              endsAt: new Date(Date.now() + (billingInterval === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString()
            }
          });
        } else {
          console.error(`❌ Failed to update subscription for user ${user.id}`);
          res.status(500).json({
            message: 'Failed to update subscription',
            code: 'SUBSCRIPTION_UPDATE_ERROR'
          });
        }
      } else {
        // Default: simulate successful subscription upgrade
        console.log(`✅ Simulating successful ${planTier} subscription for user ${user.id}`);
        
        // Mock successful subscription response
        res.json({
          success: true,
          message: `Successfully upgraded to ${planTier} plan!`,
          user: {
            subscriptionTier: planTier,
            subscriptionStatus: 'active'
          },
          subscription: {
            tier: planTier,
            status: 'active',
            endsAt: new Date(Date.now() + (billingInterval === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString()
          }
        });
      }

    } catch (error) {
      console.error('Create subscription error:', error);
      res.status(500).json({
        message: 'Failed to create subscription',
        code: 'SUBSCRIPTION_ERROR'
      });
    }
  });

  /**
   * Create payment intent (Stripe)
   * POST /api/payments/create-intent
   */
  app.post('/api/payments/create-intent', [
    requireAuth,
    body('amount').isInt({ min: 1 }).withMessage('Amount must be positive'),
    body('currency').isIn(['usd', 'eur']).withMessage('Invalid currency'),
    body('planId').exists().withMessage('Plan ID required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { amount, currency, planId } = req.body;

      // Mock Stripe integration
      const paymentIntent = {
        id: `pi_${Math.random().toString(36).substr(2, 9)}`,
        client_secret: `pi_${Math.random().toString(36).substr(2, 9)}_secret`,
        amount: amount * 100, // Convert to cents
        currency,
        status: 'requires_payment_method'
      };

      console.log(`💳 Payment intent created for user ${req.user.id}: $${amount}`);

      res.json({
        message: 'Payment intent created',
        paymentIntent
      });

    } catch (error) {
      console.error('Payment intent creation error:', error);
      res.status(500).json({ 
        message: 'Failed to create payment intent',
        code: 'PAYMENT_INTENT_ERROR'
      });
    }
  });

  /**
   * Handle payment success
   * POST /api/payments/success
   */
  app.post('/api/payments/success', [
    requireAuth,
    body('paymentIntentId').exists().withMessage('Payment intent ID required'),
    body('planId').exists().withMessage('Plan ID required'),
    validateInput
  ], async (req: any, res) => {
    try {
      const { paymentIntentId, planId } = req.body;
      
      // Verify payment with Stripe (mock)
      console.log(`✅ Payment successful for user ${req.user.id}: ${paymentIntentId}`);

      // Update user subscription based on plan
      const subscriptionMap: any = {
        'basic': { tier: 'basic', status: 'active' },
        'premium': { tier: 'premium', status: 'active' },
        'professional': { tier: 'professional', status: 'active' }
      };

      const subscription = subscriptionMap[planId];
      if (!subscription) {
        return res.status(400).json({ 
          message: 'Invalid plan ID',
          code: 'INVALID_PLAN'
        });
      }

      // Update user subscription (mock)
      console.log(`🎯 Activating ${subscription.tier} subscription for user ${req.user.id}`);

      res.json({
        message: 'Payment processed successfully',
        subscription: {
          tier: subscription.tier,
          status: subscription.status,
          activatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Payment success handler error:', error);
      res.status(500).json({ 
        message: 'Failed to process payment',
        code: 'PAYMENT_PROCESS_ERROR'
      });
    }
  });

  /**
   * Get subscription plans
   * GET /api/payments/plans
   */
  app.get('/api/payments/plans', async (req, res) => {
    try {
      const dbPlans = await storage.getActiveSubscriptionPlans();
      
      // Transform database plans to match expected format
      const plans = dbPlans.map(plan => ({
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        price: plan.monthlyPrice / 100, // Convert cents to dollars for backward compatibility
        currency: 'USD',
        interval: 'month',
        features: Array.isArray(plan.features) ? plan.features : [],
        maxSignals: plan.maxSignals,
        maxTickers: plan.maxTickers,
        isActive: plan.isActive
      }));

      res.json({ plans });

    } catch (error) {
      console.error('Plans fetch error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch plans',
        code: 'PLANS_FETCH_ERROR'
      });
    }
  });

  /**
   * Cancel subscription
   * POST /api/payments/cancel
   */
  app.post('/api/payments/cancel', [
    requireAuth,
    validateInput
  ], async (req: any, res) => {
    try {
      console.log(`🚫 Subscription cancelled for user ${req.user.id}`);

      // Update user subscription to cancelled
      // await storage.updateUser(req.user.id, {
      //   subscriptionStatus: 'cancelled'
      // });

      res.json({
        message: 'Subscription cancelled successfully'
      });

    } catch (error) {
      console.error('Subscription cancellation error:', error);
      res.status(500).json({ 
        message: 'Failed to cancel subscription',
        code: 'CANCEL_SUBSCRIPTION_ERROR'
      });
    }
  });

  /**
   * Get user's payment history
   * GET /api/payments/history
   */
  app.get('/api/payments/history', [requireAuth], async (req: any, res) => {
    try {
      // Mock payment history
      const history = [
        {
          id: 'pay_123',
          amount: 29.00,
          currency: 'USD',
          status: 'succeeded',
          created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'Basic Plan - Monthly Subscription'
        },
        {
          id: 'pay_124',
          amount: 29.00,
          currency: 'USD',
          status: 'succeeded',
          created: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'Basic Plan - Monthly Subscription'
        }
      ];

      res.json({ history });

    } catch (error) {
      console.error('Payment history error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch payment history',
        code: 'PAYMENT_HISTORY_ERROR'
      });
    }
  });

  /**
   * Admin Payment Management Endpoints
   */

  /**
   * Get payment logs for admin
   * GET /api/admin/payments
   */
  app.get('/api/admin/payments', [requireAuth], async (req: any, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { search, status } = req.query;

      // Mock payment logs data based on database schema
      const mockPayments = [
        {
          id: 'pay_1',
          userId: 'user_1',
          userEmail: 'user1@example.com',
          subscriptionId: 'sub_1',
          amount: 2997, // in cents
          currency: 'USD',
          status: 'succeeded',
          paymentMethod: 'card',
          stripePaymentId: 'pi_1234567890',
          gatewayResponse: { last4: '4242', brand: 'visa' },
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'pay_2',
          userId: 'user_2',
          userEmail: 'user2@example.com',
          subscriptionId: 'sub_2',
          amount: 4997,
          currency: 'USD',
          status: 'failed',
          paymentMethod: 'card',
          stripePaymentId: 'pi_0987654321',
          gatewayResponse: { error: 'card_declined' },
          errorCode: 'card_declined',
          errorMessage: 'Your card was declined.',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'pay_3',
          userId: 'user_3',
          userEmail: 'user3@example.com',
          subscriptionId: 'sub_3',
          amount: 9997,
          currency: 'USD',
          status: 'pending',
          paymentMethod: 'card',
          stripePaymentId: 'pi_1122334455',
          gatewayResponse: { status: 'requires_action' },
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        },
      ];

      // Filter payments based on search and status
      let filteredPayments = mockPayments;

      if (search) {
        filteredPayments = filteredPayments.filter(payment => 
          payment.userEmail.toLowerCase().includes(search.toLowerCase()) ||
          payment.stripePaymentId.toLowerCase().includes(search.toLowerCase())
        );
      }

      if (status && status !== 'all') {
        filteredPayments = filteredPayments.filter(payment => payment.status === status);
      }

      res.json(filteredPayments);

    } catch (error) {
      console.error('Admin payments fetch error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch payment logs',
        code: 'ADMIN_PAYMENTS_ERROR'
      });
    }
  });

  /**
   * Get payment analytics for admin
   * GET /api/admin/payments/analytics
   */
  app.get('/api/admin/payments/analytics', [requireAuth], async (req: any, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Mock analytics data
      const analytics = {
        totalRevenue: 1749700, // in cents
        successfulPayments: 125,
        failedPayments: 8,
        refundedAmount: 5994, // in cents
        averageTransactionAmount: 4997, // in cents
        conversionRate: 94.0, // percentage
      };

      res.json(analytics);

    } catch (error) {
      console.error('Admin payment analytics error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch payment analytics',
        code: 'ADMIN_ANALYTICS_ERROR'
      });
    }
  });

  /**
   * Retry failed payment
   * POST /api/admin/payments/:id/retry
   */
  app.post('/api/admin/payments/:id/retry', [requireAuth], async (req: any, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { id } = req.params;

      // Mock retry functionality
      console.log(`🔄 Admin retrying payment ${id}`);

      // In a real implementation, you would:
      // 1. Retrieve the payment from database
      // 2. Call Stripe/PayPal API to retry the payment
      // 3. Update the payment status in database

      res.json({
        success: true,
        message: 'Payment retry initiated successfully',
        paymentId: id,
      });

    } catch (error) {
      console.error('Payment retry error:', error);
      res.status(500).json({ 
        message: 'Failed to retry payment',
        code: 'PAYMENT_RETRY_ERROR'
      });
    }
  });

  /**
   * Process payment refund
   * POST /api/admin/payments/:id/refund
   */
  app.post('/api/admin/payments/:id/refund', [requireAuth], async (req: any, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { id } = req.params;

      // Mock refund functionality
      console.log(`💰 Admin processing refund for payment ${id}`);

      // In a real implementation, you would:
      // 1. Retrieve the payment from database
      // 2. Call Stripe/PayPal API to process the refund
      // 3. Update the payment status to 'refunded' in database

      res.json({
        success: true,
        message: 'Refund processed successfully',
        paymentId: id,
      });

    } catch (error) {
      console.error('Payment refund error:', error);
      res.status(500).json({ 
        message: 'Failed to process refund',
        code: 'PAYMENT_REFUND_ERROR'
      });
    }
  });
}