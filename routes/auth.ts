/**
 * Authentication Routes
 * Handles user registration, login, password management
 */
import type { Express, Request, Response } from "express";
import type { WebSocketServer } from "ws";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { storage } from "../storage.js";
import { insertUserSchema, passwordResetTokens, insertPasswordResetTokenSchema } from "../../shared/schema.js";
import { validateInput, sanitizeInput } from "../utils/validation.js";
import config from "../config.js";
import { emailService } from "../services/emailService.js";
import crypto from "crypto";

const { JWT_SECRET, JWT_EXPIRES_IN } = config;

/**
 * Generate JWT token for authenticated user
 */
function generateToken(userId: string): string {
  const secret = JWT_SECRET || 'development-jwt-secret-key';
  const expiresIn = JWT_EXPIRES_IN || '24h';
  
  return jwt.sign(
    { 
      userId,
      iat: Math.floor(Date.now() / 1000)
    }, 
    secret,
    { expiresIn }
  );
}

/**
 * Hash password securely
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Hash reset tokens for secure storage
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Compare password with hash
 */
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Authentication routes setup
 */
export function authRoutes(app: Express, wss: WebSocketServer) {

  /**
   * User Registration
   * POST /api/auth/register
   */
  app.post('/api/auth/register', [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6, max: 128 })
      .withMessage('Password must be 6-128 characters'),
    body('firstName')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be 2-50 characters')
      .customSanitizer(sanitizeInput),
    body('lastName')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be 2-50 characters')
      .customSanitizer(sanitizeInput),
    validateInput
  ], async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ 
          message: 'User already exists with this email',
          code: 'USER_EXISTS'
        });
      }

      // Create new user
      const hashedPassword = await hashPassword(password);
      const userData = insertUserSchema.parse({
        email,
        firstName,
        lastName,
        hashedPassword,
        subscriptionTier: 'free',
        subscriptionStatus: 'active'
      });

      const user = await storage.createUser(userData);
      const token = generateToken(user.id);

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus
        },
        token
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ 
        message: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  });

  /**
   * User Login
   * POST /api/auth/login
   */
  app.post('/api/auth/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').exists().withMessage('Password is required'),
    validateInput
  ], async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ 
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.hashedPassword);
      if (!isValidPassword) {
        return res.status(401).json({ 
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Generate token
      const token = generateToken(user.id);

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus
        },
        token
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        message: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  });

  /**
   * Password Reset Request
   * POST /api/auth/forgot-password
   */
  app.post('/api/auth/forgot-password', [
    body('email').isEmail().normalizeEmail(),
    validateInput
  ], async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        return res.json({ 
          message: 'If an account with that email exists, a password reset link will be sent.'
        });
      }

      // TODO: Implement email sending logic
      console.log(`Password reset requested for: ${email}`);

      res.json({ 
        message: 'If an account with that email exists, a password reset link will be sent.'
      });

    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ 
        message: 'Password reset failed',
        code: 'PASSWORD_RESET_ERROR'
      });
    }
  });

  /**
   * Token Validation
   * GET /api/auth/validate
   */
  app.get('/api/auth/validate', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ 
          message: 'No token provided',
          code: 'NO_TOKEN'
        });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET || 'development-jwt-secret-key') as any;
      
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(401).json({ 
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }

      res.json({ 
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus
        }
      });

    } catch (error) {
      res.status(401).json({ 
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  });

  /**
   * Forgot Password
   * POST /api/auth/forgot-password
   */
  app.post('/api/auth/forgot-password', [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    validateInput
  ], async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({
          message: 'If an account with that email exists, we have sent a password reset link.',
          success: true
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(400).json({
          message: 'Account is inactive. Please contact support.',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      // Invalidate any existing tokens for this user
      await storage.invalidateUserPasswordResetTokens(user.id);

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = hashToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store hashed reset token in database
      await storage.createPasswordResetToken({
        userId: user.id,
        token: hashedToken, // Store hashed version
        expiresAt: expiresAt.toISOString(),
        isUsed: false
      });

      // Send reset email
      const baseUrl = req.get('origin') || 'http://localhost:5000';
      const emailSent = await emailService.sendPasswordResetEmail(
        email,
        resetToken,
        baseUrl
      );

      if (!emailSent) {
        console.error('Failed to send password reset email for:', email);
        return res.status(500).json({
          message: 'Failed to send password reset email. Please try again later.',
          code: 'EMAIL_SEND_FAILED'
        });
      }

      res.json({
        message: 'If an account with that email exists, we have sent a password reset link.',
        success: true
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * Validate Reset Token
   * GET /api/auth/validate-reset-token?token=<token>
   */
  app.get('/api/auth/validate-reset-token', async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          message: 'Reset token is required',
          code: 'MISSING_TOKEN'
        });
      }

      // Hash the provided token to compare with stored hash
      const hashedToken = hashToken(token);
      
      // Find valid reset token
      const resetToken = await storage.getPasswordResetToken(hashedToken);
      
      if (!resetToken || resetToken.isUsed || new Date(resetToken.expiresAt) < new Date()) {
        return res.status(400).json({
          message: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        });
      }

      // Check if user still exists and is active
      const user = await storage.getUser(resetToken.userId);
      if (!user || !user.isActive) {
        return res.status(400).json({
          message: 'User not found or inactive',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'Reset token is valid',
        success: true
      });

    } catch (error) {
      console.error('Validate reset token error:', error);
      res.status(500).json({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * Reset Password
   * POST /api/auth/reset-password
   */
  app.post('/api/auth/reset-password', [
    body('token')
      .isLength({ min: 64, max: 64 })
      .withMessage('Invalid reset token'),
    body('newPassword')
      .isLength({ min: 6, max: 128 })
      .withMessage('Password must be 6-128 characters'),
    validateInput
  ], async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;

      // Hash the provided token to compare with stored hash
      const hashedToken = hashToken(token);

      // Find valid reset token
      const resetToken = await storage.getPasswordResetToken(hashedToken);
      
      if (!resetToken || resetToken.isUsed || new Date(resetToken.expiresAt) < new Date()) {
        return res.status(400).json({
          message: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        });
      }

      // Get user
      const user = await storage.getUser(resetToken.userId);
      if (!user || !user.isActive) {
        return res.status(400).json({
          message: 'User not found or inactive',
          code: 'USER_NOT_FOUND'
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      await storage.updateUser(user.id, { hashedPassword });

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(hashedToken);

      res.json({
        message: 'Password reset successful',
        success: true
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  });
}