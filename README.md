# CryptoStrategy Pro - Backend

Node.js/Express backend API for the CryptoStrategy Pro cryptocurrency trading platform.

## Features

- **RESTful API**: Comprehensive REST endpoints for all platform features
- **WebSocket Server**: Real-time trading signals and market data
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Rate Limiting**: Configurable rate limiting for API endpoints
- **Security**: Helmet security headers, CORS, input validation
- **Notifications**: Multi-channel notifications (Email, SMS, Telegram)
- **Webhook Support**: TradingView webhook integration
- **Background Jobs**: Scheduled notification processing

## Tech Stack

- **Runtime**: Node.js + Express.js
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM with Zod validation
- **Authentication**: JWT + bcrypt
- **Real-time**: WebSocket (ws library)
- **Notifications**: Twilio (SMS), Telegram Bot API, SendGrid (Email)
- **Security**: Helmet, CORS, express-rate-limit
- **Background Jobs**: Node.js timers for scheduled tasks

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   Update the database and API keys in `.env`:
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET=your-secret-key
   TWILIO_ACCOUNT_SID=your-twilio-sid
   TWILIO_AUTH_TOKEN=your-twilio-token
   TELEGRAM_BOT_TOKEN=your-telegram-token
   ```

3. **Push database schema**:
   ```bash
   npm run db:push
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Market Data
- `GET /api/market/price/:symbol` - Get current price
- `GET /api/tickers` - Get available tickers
- `GET /api/ohlc/:symbol` - Get OHLC data

### Trading Signals
- `GET /api/signals/:symbol` - Get trading signals
- `POST /api/webhook/alerts` - TradingView webhook endpoint

### User Management
- `GET /api/users` - Get users (admin only)
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Notifications
- `POST /api/notifications/send` - Send notification
- `GET /api/notifications/history` - Get notification history

## Database Schema

### Core Tables
- `users` - User accounts and authentication
- `user_settings` - User preferences and notification settings
- `available_tickers` - Cryptocurrency symbols configuration
- `subscriptions` - User subscriptions to trading pairs
- `alert_signals` - Trading signals and alerts
- `ohlc_data` - Price data for charts

### Notification System
- `notification_queue` - Pending notifications
- `notification_templates` - Message templates
- `notification_logs` - Delivery tracking
- `notification_channels` - Channel configurations

### Analytics
- `heatmap_data` - 200-week SMA analysis
- `cycle_data` - Market cycle analysis
- `forecast_data` - Predictive analytics

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for frontend origins
- **Helmet**: Security headers
- **Input Validation**: Zod schema validation
- **Authentication**: JWT with secure token handling
- **Password Hashing**: bcrypt with salt rounds

## WebSocket Events

- `price_update` - Real-time price updates
- `signal_alert` - New trading signals
- `notification` - System notifications
- `user_activity` - User activity updates

## Background Services

### Notification Processor
- Runs every 30 seconds
- Processes queued notifications
- Handles retry logic with exponential backoff
- Supports Email, SMS, and Telegram delivery

### Market Data Fetcher
- Fetches real-time price data from Binance API
- Fallback to synthetic data for demo purposes
- Caches data to reduce API calls

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `PORT` | Server port | No (default: 3001) |
| `NODE_ENV` | Environment mode | No (default: development) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | No |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | No |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | No |
| `SENDGRID_API_KEY` | SendGrid API key | No |

## Deployment

The backend can be deployed to any Node.js hosting service:

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start production server**:
   ```bash
   npm start
   ```

3. **Database Migration**:
   ```bash
   npm run db:push
   ```

## Development

- **Port**: 3001
- **Hot Reload**: Enabled with tsx in development
- **Logging**: Structured logging with timestamps
- **Error Handling**: Comprehensive error handling middleware

## API Documentation

The API follows REST conventions with consistent response formats:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

### Rate Limit Headers
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time