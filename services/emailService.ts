import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn('SENDGRID_API_KEY not found - email service disabled');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private static instance: EmailService;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = !!process.env.SENDGRID_API_KEY;
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendEmail(params: EmailParams): Promise<boolean> {
    if (!this.isEnabled) {
      console.error('Email service is disabled - SENDGRID_API_KEY not configured');
      return false;
    }

    try {
      const mailData = {
        to: params.to,
        from: params.from || 'noreply@proudprofits.com',
        subject: params.subject,
        ...(params.text && { text: params.text }),
        ...(params.html && { html: params.html })
      };
      
      await sgMail.send(mailData);
      
      console.log(`Email sent successfully to ${params.to}`);
      return true;
    } catch (error: any) {
      console.error('SendGrid email error:', error);
      if (error.response?.body) {
        console.error('SendGrid error details:', error.response.body);
      }
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string, baseUrl: string): Promise<boolean> {
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password - Proud Profits</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a365d; margin: 0;">Proud Profits</h1>
              <p style="color: #666; margin: 5px 0 0 0;">Crypto Trading Platform</p>
            </div>
            
            <h2 style="color: #1a365d; margin-bottom: 20px;">Reset Your Password</h2>
            
            <p style="color: #333; line-height: 1.6; margin-bottom: 20px;">
              We received a request to reset your password. If you didn't make this request, you can safely ignore this email.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        font-weight: bold;
                        display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
              This password reset link will expire in 1 hour for security reasons.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              © 2024 Proud Profits. All rights reserved.<br>
              This is an automated email, please do not reply.
            </p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Reset Your Password - Proud Profits

We received a request to reset your password. If you didn't make this request, you can safely ignore this email.

To reset your password, click the following link or copy it into your browser:
${resetUrl}

This password reset link will expire in 1 hour for security reasons.

© 2024 Proud Profits. All rights reserved.
This is an automated email, please do not reply.
    `;

    return await this.sendEmail({
      to: email,
      from: 'noreply@proudprofits.com',
      subject: 'Reset Your Password - Proud Profits',
      text: textContent,
      html: htmlContent
    });
  }

  isEmailServiceEnabled(): boolean {
    return this.isEnabled;
  }
}

export const emailService = EmailService.getInstance();