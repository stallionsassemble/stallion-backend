#!/usr/bin/env node

/**
 * Generate a secure encryption key for TOTP secrets
 * Run: node scripts/generate-encryption-key.js
 */

const crypto = require('crypto');

console.log('\n🔐 Generating Encryption Key for TOTP Secrets\n');
console.log('═'.repeat(60));

const key = crypto.randomBytes(32).toString('hex');

console.log('\nYour new encryption key:');
console.log('─'.repeat(60));
console.log(key);
console.log('─'.repeat(60));

console.log('\n📝 Add this to your .env file:');
console.log(`ENCRYPTION_KEY=${key}`);

console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
console.log('  • Keep this key SECRET and SECURE');
console.log('  • Never commit this key to version control');
console.log('  • Use different keys for dev/staging/production');
console.log('  • If you lose this key, encrypted data cannot be recovered');
console.log('  • Changing this key will invalidate all existing TOTP secrets');

console.log('\n✅ Next steps:');
console.log('  1. Add ENCRYPTION_KEY to your .env file');
console.log('  2. Restart your application');
console.log('  3. Existing users will need to re-setup TOTP\n');
