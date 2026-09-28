import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const envInt = (key: string, fallback: number): number => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    // pg's defaults never time out: an unreachable database or an exhausted
    // pool makes every query wait forever, which hangs the HTTP request.
    // Bound every stage so a DB problem surfaces as a fast error instead.
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: envInt('DATABASE_POOL_MAX', 10),
      // Max wait to open a socket or to acquire a client from a full pool
      connectionTimeoutMillis: envInt('DATABASE_CONNECT_TIMEOUT_MS', 5000),
      idleTimeoutMillis: envInt('DATABASE_IDLE_TIMEOUT_MS', 30000),
      // Server-side cap on a single statement, plus a client-side backstop
      statement_timeout: envInt('DATABASE_STATEMENT_TIMEOUT_MS', 15000),
      query_timeout: envInt('DATABASE_QUERY_TIMEOUT_MS', 20000),
      keepAlive: true,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });

    this.pool = pool;
    // An idle client losing its connection emits 'error' on the pool; without
    // a listener that crashes the process.
    this.pool.on('error', (err) => {
      this.logger.error(`Idle Postgres client error: ${err.message}`);
    });
  }

  /**
   * Pool counters, exposed for the readiness endpoint.
   */
  getPoolStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  async onModuleInit() {
    await this.$connect();
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
