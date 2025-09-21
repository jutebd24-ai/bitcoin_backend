import TelegramBot from 'node-telegram-bot-api';

interface TelegramMessage {
  chatId: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown';
  disableWebPagePreview?: boolean;
}

interface TelegramConfig {
  botToken: string;
  webhookUrl?: string;
}

class TelegramService {
  private bot: TelegramBot | null = null;
  private config: TelegramConfig | null = null;
  private activeChatIds: Set<string> = new Set();

  constructor() {
    this.initializeBot();
  }

  private initializeBot() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (botToken) {
      this.config = { botToken };
      this.bot = new TelegramBot(botToken, { polling: false });
      this.setupBotCommands();
      console.log('Telegram Service initialized');
    } else {
      console.log('Telegram Service not configured - missing bot token');
    }
  }

  private setupBotCommands() {
    if (!this.bot) return;

    // Set bot commands
    this.bot.setMyCommands([
      { command: 'start', description: 'Start receiving crypto signals' },
      { command: 'stop', description: 'Stop receiving notifications' },
      { command: 'status', description: 'Check your subscription status' },
      { command: 'help', description: 'Get help with commands' }
    ]);

    // Handle /start command
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id.toString();
      this.activeChatIds.add(chatId);
      
      const welcomeMessage = `🚀 *Welcome to CryptoStrategy Pro!*

Your Chat ID: \`${chatId}\`

To receive trading signals:
1. Copy your Chat ID above
2. Go to your notification settings
3. Paste the Chat ID in Telegram settings
4. Enable Telegram notifications

Commands:
/start - Start receiving signals
/stop - Stop notifications  
/status - Check status
/help - Get help

Happy trading! 📈`;

      this.bot!.sendMessage(chatId, welcomeMessage, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true 
      });
    });

    // Handle /stop command
    this.bot.onText(/\/stop/, (msg) => {
      const chatId = msg.chat.id.toString();
      this.activeChatIds.delete(chatId);
      
      this.bot!.sendMessage(chatId, '🛑 You have unsubscribed from notifications. Use /start to subscribe again.');
    });

    // Handle /status command
    this.bot.onText(/\/status/, (msg) => {
      const chatId = msg.chat.id.toString();
      const isActive = this.activeChatIds.has(chatId);
      
      const statusMessage = `📊 *Status Report*

Chat ID: \`${chatId}\`
Notifications: ${isActive ? '✅ Active' : '❌ Inactive'}
Bot Status: 🟢 Online

${!isActive ? 'Use /start to activate notifications' : 'You\'re all set to receive signals!'}`;

      this.bot!.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
    });

    // Handle /help command
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id.toString();
      
      const helpMessage = `🤖 *CryptoStrategy Pro Bot Help*

*Setup Instructions:*
1. Send /start to get your Chat ID
2. Copy the Chat ID from the welcome message
3. Add it to your notification settings on the website
4. Enable Telegram notifications

*Commands:*
/start - Get Chat ID and activate
/stop - Disable notifications
/status - Check current status
/help - Show this help message

*About Signals:*
• Buy/Sell alerts from our AI system
• Real-time market notifications
• TradingView webhook integration
• Professional trading insights

*Support:*
Visit our website for more help or contact support.

Happy trading! 🚀`;

      this.bot!.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    });
  }

  isConfigured(): boolean {
    return this.bot !== null && this.config !== null;
  }

  getConfigStatus(): 'configured' | 'missing_config' | 'invalid_config' {
    if (!this.config) return 'missing_config';
    
    // Basic token validation (should start with a number followed by colon)
    if (!this.config.botToken.match(/^\d+:/)) {
      return 'invalid_config';
    }
    
    return 'configured';
  }

  async sendMessage(message: TelegramMessage): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Telegram service not configured. Please add bot token.'
      };
    }

    try {
      const result = await this.bot!.sendMessage(
        message.chatId,
        message.message,
        {
          parse_mode: message.parseMode || 'HTML',
          disable_web_page_preview: message.disableWebPagePreview !== false
        }
      );

      console.log(`Telegram message sent successfully: ${result.message_id} to ${message.chatId}`);
      
      return {
        success: true,
        messageId: result.message_id
      };

    } catch (error: any) {
      console.error('Error sending Telegram message:', error);
      
      // Handle specific Telegram errors
      let errorMessage = 'Failed to send Telegram message';
      if (error.response?.body?.error_code === 400) {
        errorMessage = 'Invalid chat ID or message format';
      } else if (error.response?.body?.error_code === 403) {
        errorMessage = 'Bot was blocked by user or chat not found';
      } else if (error.response?.body?.error_code === 429) {
        errorMessage = 'Rate limited by Telegram API';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async testConnection(): Promise<{ success: boolean; botInfo?: any; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Telegram service not configured'
      };
    }

    try {
      const botInfo = await this.bot!.getMe();
      
      return {
        success: true,
        botInfo: {
          id: botInfo.id,
          username: botInfo.username,
          first_name: botInfo.first_name,
          is_bot: botInfo.is_bot
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to connect to Telegram Bot API'
      };
    }
  }

  async validateChatId(chatId: string): Promise<{ valid: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return {
        valid: false,
        error: 'Telegram service not configured'
      };
    }

    try {
      // Try to get chat info
      const chat = await this.bot!.getChat(chatId);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: 'Invalid chat ID or bot not authorized'
      };
    }
  }

  formatSignalMessage(payload: {
    ticker: string;
    signalType: 'buy' | 'sell';
    price: number;
    confidence: number;
    timeframe?: string;
    message?: string;
  }): string {
    const emoji = payload.signalType === 'buy' ? '🟢' : '🔴';
    const action = payload.signalType.toUpperCase();
    
    return `${emoji} <b>${action} SIGNAL ALERT</b>

💰 <b>Symbol:</b> ${payload.ticker}
💵 <b>Price:</b> $${payload.price.toLocaleString()}
📊 <b>Confidence:</b> ${payload.confidence}%${payload.timeframe ? `\n⏱️ <b>Timeframe:</b> ${payload.timeframe}` : ''}

${payload.message || 'Trade signal generated by our advanced algorithm.'}

⚡ <i>Act fast - markets move quickly!</i>

<a href="https://tradingview.com/chart/?symbol=${payload.ticker}">📈 View Chart</a>

🤖 CryptoStrategy Pro`;
  }

  getBotUsername(): string | null {
    return this.config ? '@CryptoStrategyProBot' : null;
  }

  getSetupInstructions(): string {
    const botUsername = this.getBotUsername();
    if (!botUsername) return 'Telegram bot not configured';

    return `1. Open Telegram and search for ${botUsername}
2. Send /start command to the bot
3. Copy your Chat ID from the bot's response
4. Paste the Chat ID in your notification settings
5. Enable Telegram notifications`;
  }
}

export const telegramService = new TelegramService();
export type { TelegramMessage };