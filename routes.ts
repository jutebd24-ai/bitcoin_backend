/**
 * Legacy Routes File - Redirects to New Modular Structure
 * 
 * This file has been refactored into a clean, human-readable modular structure.
 * All routes are now organized in separate files under /routes/ directory.
 * 
 * File Structure:
 * - server/routes/index.ts     - Main router entry point
 * - server/routes/auth.ts      - Authentication routes
 * - server/routes/user.ts      - User profile and settings
 * - server/routes/market.ts    - Market data and prices
 * - server/routes/signals.ts   - Trading signals management
 * - server/routes/admin.ts     - Admin-only functionality
 * - server/routes/payments.ts  - Payment and subscription handling
 * - server/routes/webhooks.ts  - External webhook endpoints
 * - server/routes/websocket.ts - WebSocket server setup
 * 
 * Utilities:
 * - server/utils/validation.ts - Input validation helpers
 * - server/utils/cache.ts      - Caching utilities
 * - server/utils/websocket.ts  - WebSocket utilities
 * 
 * Middleware:
 * - server/middleware/auth.ts  - Authentication middleware
 * 
 * Configuration:
 * - server/config.ts           - Centralized configuration
 */

// Re-export the main registerRoutes function from new modular structure
export { registerRoutes } from "./routes/index.js";

console.log("✅ Routes.ts successfully refactored into modular structure");
console.log("📁 Check server/routes/ directory for organized route modules");