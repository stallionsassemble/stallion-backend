import { Pool } from 'pg';
import 'dotenv/config';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('1. Cleaning up ghost/inconsistent MFA rows...');
    const cleanupResult = await pool.query(`
      UPDATE "users"
      SET mfa_enabled = FALSE, pending_totp_secret = NULL, backup_codes = '{}'
      WHERE mfa_enabled = TRUE AND totp_secret IS NULL;
    `);
    console.log(`Cleaned up ${cleanupResult.rowCount ?? 0} inconsistent user row(s).`);

    console.log('2. Adding chk_mfa_totp_integrity CHECK constraint...');
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE "users"
        ADD CONSTRAINT chk_mfa_totp_integrity
        CHECK (mfa_enabled = FALSE OR totp_secret IS NOT NULL);
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'Constraint chk_mfa_totp_integrity already exists, skipping.';
      END $$;
    `);
    console.log('Successfully verified/added chk_mfa_totp_integrity constraint.');
  } catch (error) {
    console.error('Failed to apply constraint:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
