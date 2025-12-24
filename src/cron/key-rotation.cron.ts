import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { StellarWalletService } from '../wallet/stellar-wallet.service';

@Injectable()
export class KeyRotationCron {
  private readonly logger = new Logger(KeyRotationCron.name);
  private readonly KEY_ROTATION_INTERVAL_DAYS = 90;

  constructor(
    private prisma: PrismaService,
    private stellarWallet: StellarWalletService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleKeyRotation() {
    this.logger.log('Running key rotation cron job');

    try {
      const rotationDate = new Date();
      rotationDate.setDate(
        rotationDate.getDate() - this.KEY_ROTATION_INTERVAL_DAYS,
      );

      const walletsToRotate = await this.prisma.wallet.findMany({
        where: {
          updatedAt: {
            lt: rotationDate,
          },
          isActivated: true,
        },
        take: 10,
      });

      this.logger.log(
        `Found ${walletsToRotate.length} wallets eligible for key rotation`,
      );

      let rotatedCount = 0;
      let failedCount = 0;

      for (const wallet of walletsToRotate) {
        try {
          await this.stellarWallet.rotateWalletKeys(wallet.id);
          rotatedCount++;
          this.logger.log(`Rotated encryption keys for wallet ${wallet.id}`);
        } catch (error) {
          failedCount++;
          this.logger.error(
            `Failed to rotate keys for wallet ${wallet.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `Key rotation completed: ${rotatedCount} rotated, ${failedCount} failed`,
      );
    } catch (error) {
      this.logger.error(
        `Key rotation cron job failed: ${error.message}`,
        error.stack,
      );
    }
  }
}
