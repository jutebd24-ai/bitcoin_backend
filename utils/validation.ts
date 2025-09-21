/**
 * Input Validation Utilities
 * Centralized validation and sanitization functions
 */
import { validationResult } from "express-validator";

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input.replace(/[<>\"'&]/g, '');
}

/**
 * Validation middleware - checks for validation errors
 */
export const validateInput = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation errors',
      errors: errors.array(),
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

/**
 * Check if string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate cryptocurrency symbol format
 */
export function isValidSymbol(symbol: string): boolean {
  const symbolRegex = /^[A-Z]{2,10}USDT$/;
  return symbolRegex.test(symbol);
}

/**
 * Validate timeframe format
 */
export function isValidTimeframe(timeframe: string): boolean {
  const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
  return validTimeframes.includes(timeframe);
}

/**
 * Validate password strength
 */
export function isStrongPassword(password: string): { isValid: boolean; message?: string } {
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters' };
  }
  
  if (password.length > 128) {
    return { isValid: false, message: 'Password must be less than 128 characters' };
  }
  
  if (!/[A-Za-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one letter' };
  }
  
  return { isValid: true };
}