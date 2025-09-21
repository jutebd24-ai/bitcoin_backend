import twilio from 'twilio';

interface SMSMessage {
  to: string;
  message: string;
  subject?: string;
}

interface SMSConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

class SMSService {
  private client: twilio.Twilio | null = null;
  private config: SMSConfig | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && fromNumber) {
      // Validate Twilio credentials format before initializing
      if (!accountSid.startsWith('AC')) {
        console.log('SMS Service not configured - invalid Twilio Account SID format (must start with AC)');
        return;
      }
      
      if (!fromNumber.startsWith('+')) {
        console.log('SMS Service not configured - invalid phone number format (must include country code)');
        return;
      }

      try {
        this.config = { accountSid, authToken, fromNumber };
        this.client = twilio(accountSid, authToken);
        console.log('SMS Service initialized with Twilio');
      } catch (error) {
        console.log('SMS Service not configured - invalid Twilio credentials:', error.message);
      }
    } else {
      console.log('SMS Service not configured - missing Twilio credentials');
    }
  }

  isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  getConfigStatus(): 'configured' | 'missing_config' | 'invalid_config' {
    if (!this.config) return 'missing_config';
    
    // Validate phone number format
    if (!this.config.fromNumber.startsWith('+')) {
      return 'invalid_config';
    }
    
    return 'configured';
  }

  async sendSMS(message: SMSMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'SMS service not configured. Please add Twilio credentials.'
      };
    }

    try {
      // Validate phone number format
      if (!message.to.startsWith('+')) {
        return {
          success: false,
          error: 'Phone number must include country code (e.g., +1234567890)'
        };
      }

      // Limit message length for SMS (160 characters)
      const smsBody = message.message.length > 160 
        ? message.message.substring(0, 157) + '...'
        : message.message;

      const result = await this.client!.messages.create({
        body: smsBody,
        from: this.config!.fromNumber,
        to: message.to
      });

      console.log(`SMS sent successfully: ${result.sid} to ${message.to}`);
      
      return {
        success: true,
        messageId: result.sid
      };

    } catch (error: any) {
      console.error('Error sending SMS:', error);
      
      // Handle specific Twilio errors
      let errorMessage = 'Failed to send SMS';
      if (error.code === 21211) {
        errorMessage = 'Invalid phone number format';
      } else if (error.code === 21608) {
        errorMessage = 'Phone number is not verified for trial account';
      } else if (error.code === 20003) {
        errorMessage = 'Invalid Twilio credentials';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async sendVerificationCode(phoneNumber: string): Promise<{ success: boolean; code?: string; error?: string }> {
    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const message = `Your CryptoStrategy Pro verification code is: ${code}. This code expires in 10 minutes.`;
    
    const result = await this.sendSMS({
      to: phoneNumber,
      message: message
    });

    if (result.success) {
      return {
        success: true,
        code: code
      };
    }

    return {
      success: false,
      error: result.error
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'SMS service not configured'
      };
    }

    try {
      // Test by retrieving account info
      const account = await this.client!.api.accounts(this.config!.accountSid).fetch();
      
      return {
        success: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to connect to Twilio'
      };
    }
  }

  formatSignalMessage(payload: {
    ticker: string;
    signalType: 'buy' | 'sell';
    price: number;
    confidence: number;
    timeframe?: string;
  }): string {
    const emoji = payload.signalType === 'buy' ? '🟢' : '🔴';
    const action = payload.signalType.toUpperCase();
    
    // SMS-optimized format (shorter)
    return `${emoji} ${action} ${payload.ticker} @ $${payload.price.toLocaleString()}
Confidence: ${payload.confidence}%${payload.timeframe ? ` | ${payload.timeframe}` : ''}
CryptoStrategy Pro`;
  }
}

export const smsService = new SMSService();
export type { SMSMessage };