import { Injectable } from '@nestjs/common';
import { PrismaService } from './common/prisma/prisma.service';
import { RedisService } from './common/redis/redis.service';

const CHECK_TIMEOUT_MS = 3000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);

type CheckResult = { ok: boolean; latencyMs: number; error?: string };

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  getHello(): { message: string } {
    return { message: 'Hello World!' };
  }

  async getReadiness() {
    const [database, redis] = await Promise.all([
      this.runCheck(() => this.prisma.$queryRaw`SELECT 1`),
      this.runCheck(async () => {
        if (!(await this.redis.ping())) throw new Error('ping failed');
      }),
    ]);

    return {
      ok: database.ok && redis.ok,
      database: { ...database, pool: this.prisma.getPoolStats() },
      redis,
    };
  }

  private async runCheck(check: () => Promise<unknown>): Promise<CheckResult> {
    const start = Date.now();
    try {
      await withTimeout(check(), CHECK_TIMEOUT_MS);
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
