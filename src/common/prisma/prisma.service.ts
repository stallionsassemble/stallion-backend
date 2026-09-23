import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    await this.ensureDatabaseConstraints();
  }

  async ensureDatabaseConstraints() {
    try {
      // 1. Clean up any existing inconsistent rows where mfa_enabled is true but totp_secret is null
      await this.$executeRawUnsafe(`
        UPDATE "users"
        SET mfa_enabled = FALSE, pending_totp_secret = NULL, backup_codes = '{}'
        WHERE mfa_enabled = TRUE AND totp_secret IS NULL;
      `);

      // 2. Add CHECK constraint idempotently
      await this.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "users"
          ADD CONSTRAINT chk_mfa_totp_integrity
          CHECK (mfa_enabled = FALSE OR totp_secret IS NOT NULL);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    } catch {
      // Ignore if table does not exist yet (e.g. during test setup or db creation)
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => key[0] !== '_' && key !== 'constructor',
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        if (model && typeof model === 'object' && 'deleteMany' in model) {
          return (model as any).deleteMany();
        }
      }),
    );
  }
}
