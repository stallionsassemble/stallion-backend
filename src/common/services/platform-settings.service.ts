import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EnvConfig } from '../../config/env.config';

const GLOBAL_PLATFORM_SETTINGS_ID = 'global';

@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getSettings() {
    return this.prisma.platformSetting.findUnique({
      where: { id: GLOBAL_PLATFORM_SETTINGS_ID },
    });
  }

  async resolveFundingWalletId(): Promise<string | undefined> {
    const settings = await this.getSettings();
    if (settings?.fundingWalletId) {
      return settings.fundingWalletId;
    }

    return this.configService.get<string>(EnvConfig.FUNDING_WALLET_ID);
  }

  async getFundingWallet() {
    const settings = await this.getSettings();
    if (settings?.fundingWalletId) {
      return {
        fundingWalletId: settings.fundingWalletId,
        source: 'admin' as const,
      };
    }

    const envFundingWalletId = this.configService.get<string>(
      EnvConfig.FUNDING_WALLET_ID,
    );

    if (envFundingWalletId) {
      return {
        fundingWalletId: envFundingWalletId,
        source: 'env' as const,
      };
    }

    return {
      fundingWalletId: null,
      source: 'none' as const,
    };
  }

  async setFundingWalletId(fundingWalletId: string, updatedByUserId: string) {
    return this.prisma.platformSetting.upsert({
      where: { id: GLOBAL_PLATFORM_SETTINGS_ID },
      update: {
        fundingWalletId,
        updatedByUserId,
      },
      create: {
        id: GLOBAL_PLATFORM_SETTINGS_ID,
        fundingWalletId,
        updatedByUserId,
      },
    });
  }

  async clearFundingWalletId(updatedByUserId: string) {
    return this.prisma.platformSetting.upsert({
      where: { id: GLOBAL_PLATFORM_SETTINGS_ID },
      update: {
        fundingWalletId: null,
        updatedByUserId,
      },
      create: {
        id: GLOBAL_PLATFORM_SETTINGS_ID,
        fundingWalletId: null,
        updatedByUserId,
      },
    });
  }
}
