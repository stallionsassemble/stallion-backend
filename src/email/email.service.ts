import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { EnvConfig } from '../config/env.config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(
    private configService: ConfigService,
    @InjectQueue('email') private emailQueue: Queue,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>(EnvConfig.SMTP_HOST),
      port: this.configService.get<number>(EnvConfig.SMTP_PORT) || 587,
      secure: this.configService.get<boolean>(EnvConfig.SMTP_SECURE) || false,
      auth: {
        user: this.configService.getOrThrow<string>(EnvConfig.SMTP_USER),
        pass: this.configService.getOrThrow<string>(EnvConfig.SMTP_PASS),
      },
    });
  }

  /**
   * Send verification code email (queued)
   */
  async sendVerificationCode(
    email: string,
    code: string,
    context: 'signup' | 'login',
  ): Promise<void> {
    const appName =
      this.configService.get<string>(EnvConfig.APP_NAME) || 'Stallion';
    const appUrl =
      this.configService.get<string>(EnvConfig.FRONTEND_URL) ||
      'http://localhost:3000';

    const template =
      context === 'signup' ? 'verification-signup' : 'verification-login';
    const subject =
      context === 'signup'
        ? `Your ${appName} Verification Code`
        : `Your ${appName} Login Code`;

    await this.emailQueue.add(
      'send-email',
      {
        to: email,
        subject,
        template,
        context: { code, appName, appUrl, emailContext: context },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Verification email (${context}) queued for ${email}`);
  }

  /**
   * Send welcome email after registration (queued)
   */
  async sendWelcomeEmail(
    email: string,
    name: string,
    role: 'CONTRIBUTOR' | 'PROJECT_OWNER',
  ): Promise<void> {
    const appName =
      this.configService.get<string>(EnvConfig.APP_NAME) || 'Stallion';
    const appUrl =
      this.configService.get<string>(EnvConfig.FRONTEND_URL) ||
      'http://localhost:3000';

    const template =
      role === 'CONTRIBUTOR' ? 'welcome-contributor' : 'welcome-owner';

    await this.emailQueue.add(
      'send-email',
      {
        to: email,
        subject: `Welcome to ${appName}!`,
        template,
        context: { name, appName, appUrl, role },
      },
      {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    );

    this.logger.log(`Welcome email (${role}) queued for ${email}`);
  }

  /**
   * Send bounty notification email (queued)
   */
  async sendBountyNotification(
    email: string,
    subject: string,
    message: string,
  ): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME') || 'Stallion';

    await this.emailQueue.add(
      'send-email',
      {
        to: email,
        subject,
        template: 'notification',
        context: { message, appName },
      },
      {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
      },
    );

    this.logger.log(`Notification email queued for ${email}`);
  }

  /**
   * Send generic email with template (queued)
   * Used by notification system
   */
  async sendEmail(
    to: string,
    subject: string,
    template: string,
    context: any,
  ): Promise<void> {
    await this.emailQueue.add(
      'send-email',
      {
        to,
        subject,
        template,
        context,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Email queued for ${to} with template: ${template}`);
  }

  /**
   * Send email directly without queue (used by worker)
   * @internal
   */
  async sendEmailDirect(
    to: string,
    subject: string,
    template: string,
    context: any,
  ): Promise<void> {
    try {
      const appName = this.configService.get<string>('APP_NAME') || 'Stallion';
      const appUrl =
        this.configService.get<string>(EnvConfig.FRONTEND_URL) ||
        'http://localhost:3000';

      let html: string;

      switch (template) {
        case 'verification':
          html = this.getVerificationEmailTemplate(
            context.code,
            appName,
            appUrl,
          );
          break;
        case 'verification-signup':
          html = this.getVerificationSignupEmailTemplate(
            context.code,
            appName,
            appUrl,
          );
          break;
        case 'verification-login':
          html = this.getVerificationLoginEmailTemplate(
            context.code,
            appName,
            appUrl,
          );
          break;
        case 'welcome':
          html = this.getWelcomeEmailTemplate(context.name, appName, appUrl);
          break;
        case 'welcome-contributor':
          html = this.getWelcomeContributorEmailTemplate(
            context.name,
            appName,
            appUrl,
          );
          break;
        case 'welcome-owner':
          html = this.getWelcomeOwnerEmailTemplate(
            context.name,
            appName,
            appUrl,
          );
          break;
        case 'notification':
          html = this.getNotificationEmailTemplate(context.message, appName);
          break;
        default:
          html = this.generateEmailHtml(template, context, appName, appUrl);
      }

      await this.transporter.sendMail({
        from: `"${appName}" <${this.configService.getOrThrow<string>(EnvConfig.SMTP_FROM)}>`,
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
   * Verification code email template (legacy - kept for backward compatibility)
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
   * Signup verification code email template
   */
  private getVerificationSignupEmailTemplate(
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
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">${appName}</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Welcome! Verify Your Email 🎉</h2>
            <p>Thank you for signing up with ${appName}! We're excited to have you join our community.</p>
            <p>Please use the verification code below to complete your registration:</p>
            
            <div style="background: white; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
              <h1 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0;">${code}</h1>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #856404; font-size: 14px; margin: 0;">⏰ This code will expire in <strong>10 minutes</strong>.</p>
            </div>
            
            <p style="color: #666; font-size: 14px;">If you didn't create an account with ${appName}, please ignore this email.</p>
            
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
   * Login verification code email template
   */
  private getVerificationLoginEmailTemplate(
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
          <title>Login Verification Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">${appName}</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Login Verification 🔐</h2>
            <p>We received a login request for your ${appName} account.</p>
            <p>Please use the verification code below to complete your login:</p>
            
            <div style="background: white; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your Login Code</p>
              <h1 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0;">${code}</h1>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #856404; font-size: 14px; margin: 0;">⏰ This code will expire in <strong>10 minutes</strong>.</p>
            </div>
            
            <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #721c24; font-size: 14px; margin: 0;">🔒 <strong>Security Alert:</strong> If you didn't attempt to log in, please secure your account immediately and contact support.</p>
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
   * Welcome email template for contributors
   */
  private getWelcomeContributorEmailTemplate(
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
            <p>We're thrilled to have you join our community of talented contributors! Your account has been successfully created.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h3 style="color: #667eea; margin-top: 0;">Get Started as a Contributor</h3>
              <ul style="padding-left: 20px; color: #555;">
                <li style="margin-bottom: 10px;"><strong>Browse Bounties:</strong> Explore exciting projects and find bounties that match your skills</li>
                <li style="margin-bottom: 10px;"><strong>Build Your Portfolio:</strong> Showcase your work and earn rewards for your contributions</li>
                <li style="margin-bottom: 10px;"><strong>Earn Rewards:</strong> Get paid in crypto for your valuable contributions</li>
                <li style="margin-bottom: 10px;"><strong>Connect:</strong> Collaborate with project owners and fellow contributors</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/bounties" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">Browse Bounties</a>
              <a href="${appUrl}/dashboard" style="background: #764ba2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to Dashboard</a>
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
   * Welcome email template for project owners
   */
  private getWelcomeOwnerEmailTemplate(
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
            <p>Welcome aboard! We're excited to help you find the perfect contributors for your projects. Your account has been successfully created.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h3 style="color: #667eea; margin-top: 0;">Get Started as a Project Owner</h3>
              <ul style="padding-left: 20px; color: #555;">
                <li style="margin-bottom: 10px;"><strong>Create Bounties:</strong> Post bounties and attract talented contributors to your projects</li>
                <li style="margin-bottom: 10px;"><strong>Manage Projects:</strong> Track progress and collaborate with contributors seamlessly</li>
                <li style="margin-bottom: 10px;"><strong>Pay with Crypto:</strong> Reward contributors securely using blockchain technology</li>
                <li style="margin-bottom: 10px;"><strong>Build Your Team:</strong> Find skilled developers to bring your vision to life</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/bounties/create" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">Create Bounty</a>
              <a href="${appUrl}/dashboard" style="background: #764ba2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to Dashboard</a>
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
