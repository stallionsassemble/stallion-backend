import { ConfigService } from '@nestjs/config';

/**
 * Centralized environment configuration
 * Provides type-safe access to environment variables
 */
export class EnvConfig {
  private static configService: ConfigService;

  static initialize(configService: ConfigService) {
    this.configService = configService;
  }

  // Application
  static get APP_NAME(): string {
    return this.configService.get<string>('APP_NAME') || 'Stallion';
  }

  static get APP_URL(): string {
    return this.configService.get<string>('APP_URL') || 'http://localhost:3000';
  }

  static get PORT(): number {
    return this.configService.get<number>('PORT') || 3000;
  }

  // Database
  static get DATABASE_URL(): string {
    return this.configService.getOrThrow<string>('DATABASE_URL');
  }

  // JWT
  static get JWT_SECRET(): string {
    return this.configService.getOrThrow<string>('JWT_SECRET');
  }

  static get REFRESH_TOKEN_SECRET(): string {
    return this.configService.getOrThrow<string>('REFRESH_TOKEN_SECRET');
  }

  static get ACCESS_TOKEN_EXPIRES_IN(): string {
    return this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN') || '15m';
  }

  static get REFRESH_TOKEN_EXPIRES_IN(): string {
    return this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') || '7d';
  }

  // Redis
  static get REDIS_HOST(): string {
    return this.configService.get<string>('REDIS_HOST') || 'localhost';
  }

  static get REDIS_PORT(): number {
    return this.configService.get<number>('REDIS_PORT') || 6379;
  }

  static get REDIS_PASSWORD(): string | undefined {
    return this.configService.get<string>('REDIS_PASSWORD');
  }

  static get REDIS_DB(): number {
    return this.configService.get<number>('REDIS_DB') || 0;
  }

  // SMTP/Email
  static get SMTP_HOST(): string {
    return this.configService.getOrThrow<string>('SMTP_HOST');
  }

  static get SMTP_PORT(): number {
    return this.configService.get<number>('SMTP_PORT') || 587;
  }

  static get SMTP_SECURE(): boolean {
    return this.configService.get<boolean>('SMTP_SECURE') || false;
  }

  static get SMTP_USER(): string {
    return this.configService.getOrThrow<string>('SMTP_USER');
  }

  static get SMTP_PASS(): string {
    return this.configService.getOrThrow<string>('SMTP_PASS');
  }

  static get SMTP_FROM(): string {
    return this.configService.getOrThrow<string>('SMTP_FROM');
  }

  // Soroban/Stellar
  static get SOROBAN_CONTRACT_ID(): string {
    return this.configService.getOrThrow<string>('SOROBAN_CONTRACT_ID');
  }

  static get SOROBAN_NETWORK(): string {
    return this.configService.getOrThrow<string>('SOROBAN_NETWORK');
  }

  static get SOROBAN_RPC_URL(): string {
    return this.configService.getOrThrow<string>('SOROBAN_RPC_URL');
  }

  // Upload
  static get UPLOAD_DIR(): string {
    return this.configService.get<string>('UPLOAD_DIR') || './uploads';
  }

  static get MAX_FILE_SIZE(): number {
    return this.configService.get<number>('MAX_FILE_SIZE') || 10 * 1024 * 1024; // 10MB
  }

  // Firebase
  static get FIREBASE_SERVICE_ACCOUNT_PATH(): string | undefined {
    return this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
  }

  // Passkey/WebAuthn
  static get RP_ID(): string {
    return this.configService.get<string>('RP_ID') || 'localhost';
  }

  static get ORIGIN(): string {
    return this.configService.get<string>('ORIGIN') || 'http://localhost:3000';
  }
}
