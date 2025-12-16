import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<boolean>('SMTP_SECURE') || false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  /**
   * Send verification code email
   */
  async sendVerificationCode(email: string, code: string): Promise<void> {
    try {
      const appName = this.configService.get<string>('APP_NAME') || 'Stallion';
      const appUrl =
        this.configService.get<string>('APP_URL') || 'http://localhost:3000';

      await this.transporter.sendMail({
        from: `"${appName}" <${this.configService.get<string>('SMTP_FROM')}>`,
        to: email,
        subject: `Your ${appName} Verification Code`,
        html: this.getVerificationEmailTemplate(code, appName, appUrl),
      });

      this.logger.log(`Verification code sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Send welcome email after registration
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    try {
      const appName = this.configService.get<string>('APP_NAME') || 'Stallion';
      const appUrl =
        this.configService.get<string>('APP_URL') || 'http://localhost:3000';

      await this.transporter.sendMail({
        from: `"${appName}" <${this.configService.get<string>('SMTP_FROM')}>`,
        to: email,
        subject: `Welcome to ${appName}!`,
        html: this.getWelcomeEmailTemplate(name, appName, appUrl),
      });

      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}`, error);
    }
  }

  /**
   * Send bounty notification email
   */
  async sendBountyNotification(
    email: string,
    subject: string,
    message: string,
  ): Promise<void> {
    try {
      const appName = this.configService.get<string>('APP_NAME') || 'Stallion';

      await this.transporter.sendMail({
        from: `"${appName}" <${this.configService.get<string>('SMTP_FROM')}>`,
        to: email,
        subject,
        html: this.getNotificationEmailTemplate(message, appName),
      });

      this.logger.log(`Notification sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send notification to ${email}`, error);
    }
  }

  /**
   * Send generic email with template
   * Used by notification system
   */
  async sendEmail(
    to: string,
    subject: string,
    template: string,
    context: any,
  ): Promise<void> {
    try {
      const appName = this.configService.get<string>('APP_NAME') || 'Stallion';
      const appUrl =
        this.configService.get<string>('APP_URL') || 'http://localhost:3000';

      // Generate HTML based on template and context
      const html = this.generateEmailHtml(template, context, appName, appUrl);

      await this.transporter.sendMail({
        from: `"${appName}" <${this.configService.get<string>('SMTP_FROM')}>`,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to} with template: ${template}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw error;
    }
  }

  /**
   * Generate email HTML from template and context
   */
  private generateEmailHtml(
    template: string,
    context: any,
    appName: string,
    appUrl: string,
  ): string {
    // For now, use a simple template system
    // In production, you might want to use a proper template engine like Handlebars
    const { name, title, message, data } = context;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title || 'Notification'}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">${appName}</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${name || 'there'}! 👋</h2>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #667eea; margin-top: 0;">${title}</h3>
              <p style="color: #555; margin: 0;">${message}</p>
            </div>
            
            ${
              data
                ? `
            <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #666; font-size: 14px; margin: 0;">Additional details available in your dashboard.</p>
            </div>
            `
                : ''
            }
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/notifications" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Dashboard</a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} ${appName}. All rights reserved.<br>
              <a href="${appUrl}/notifications/settings" style="color: #667eea; text-decoration: none;">Manage notification preferences</a>
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Verification code email template
   */
  private getVerificationEmailTemplate(
    code: string,
    appName: string,
    appUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verification Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">${appName}</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Verify Your Email</h2>
            <p>Thank you for signing up! Please use the verification code below to complete your registration:</p>
            
            <div style="background: white; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
              <h1 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0;">${code}</h1>
            </div>
            
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} ${appName}. All rights reserved.<br>
              <a href="${appUrl}" style="color: #667eea; text-decoration: none;">Visit our website</a>
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Welcome email template
   */
  private getWelcomeEmailTemplate(
    name: string,
    appName: string,
    appUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${appName}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome to ${appName}!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hi ${name}! 👋</h2>
            <p>We're excited to have you on board! Your account has been successfully created.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h3 style="color: #667eea; margin-top: 0;">What's Next?</h3>
              <ul style="padding-left: 20px;">
                <li>Complete your profile</li>
                <li>Browse available bounties</li>
                <li>Start contributing or create your first bounty</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/dashboard" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to Dashboard</a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} ${appName}. All rights reserved.<br>
              <a href="${appUrl}" style="color: #667eea; text-decoration: none;">Visit our website</a>
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generic notification email template
   */
  private getNotificationEmailTemplate(
    message: string,
    appName: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">${appName}</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            ${message}
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} ${appName}. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `;
  }
}
