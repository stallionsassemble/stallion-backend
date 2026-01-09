/**
 * Environment variable keys
 * This class contains constants for all environment variable keys used in the application
 * Access values via ConfigService using these keys
 */
export class EnvConfig {
  // Application
  static readonly APP_NAME = 'APP_NAME';
  static readonly BASE_URL = 'BASE_URL';
  static readonly FRONTEND_URL = 'FRONTEND_URL';
  static readonly PORT = 'PORT';

  // Database
  static readonly DATABASE_URL = 'DATABASE_URL';

  // JWT
  static readonly JWT_SECRET = 'JWT_SECRET';
  static readonly REFRESH_TOKEN_SECRET = 'REFRESH_TOKEN_SECRET';
  static readonly ACCESS_TOKEN_EXPIRES_IN = 'ACCESS_TOKEN_EXPIRES_IN';
  static readonly REFRESH_TOKEN_EXPIRES_IN = 'REFRESH_TOKEN_EXPIRES_IN';

  // Redis
  static readonly REDIS_HOST = 'REDIS_HOST';
  static readonly REDIS_PORT = 'REDIS_PORT';
  static readonly REDIS_PASSWORD = 'REDIS_PASSWORD';
  static readonly REDIS_DB = 'REDIS_DB';

  // SMTP
  static readonly SMTP_HOST = 'SMTP_HOST';
  static readonly SMTP_PORT = 'SMTP_PORT';
  static readonly SMTP_SECURE = 'SMTP_SECURE';
  static readonly SMTP_USER = 'SMTP_USER';
  static readonly SMTP_PASS = 'SMTP_PASS';
  static readonly SMTP_FROM = 'SMTP_FROM';

  // Soroban
  static readonly SOROBAN_CONTRACT_ID = 'SOROBAN_CONTRACT_ID';
  static readonly SOROBAN_NETWORK = 'SOROBAN_NETWORK';
  static readonly SOROBAN_RPC_URL = 'SOROBAN_RPC_URL';
  static readonly SOROBAN_HORIZON_URL = 'SOROBAN_HORIZON_URL';
  static readonly SOROBAN_NETWORK_PASSPHRASE = 'SOROBAN_NETWORK_PASSPHRASE';

  // Upload
  static readonly UPLOAD_DIR = 'UPLOAD_DIR';
  static readonly MAX_FILE_SIZE = 'MAX_FILE_SIZE';

  // Firebase
  static readonly FIREBASE_SERVICE_ACCOUNT_PATH =
    'FIREBASE_SERVICE_ACCOUNT_PATH';

  // Passkey/WebAuthn
  static readonly RP_ID = 'RP_ID';
  static readonly ORIGIN = 'ORIGIN';

  // Funding Wallet
  static readonly FUNDING_WALLET_ID = 'FUNDING_WALLET_ID';
}
