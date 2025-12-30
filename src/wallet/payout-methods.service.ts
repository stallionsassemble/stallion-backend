import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as StellarSDK from '@stellar/stellar-sdk';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePayoutMethodDto } from './dto/create-payout-method.dto';
import { UpdatePayoutMethodDto } from './dto/update-payout-method.dto';

@Injectable()
export class PayoutMethodsService {
  private readonly logger = new Logger(PayoutMethodsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Validate Stellar public key format and checksum
   */
  private validateStellarPublicKey(publicKey: string): void {
    try {
      // This will throw if the key is invalid
      StellarSDK.StrKey.decodeEd25519PublicKey(publicKey);
    } catch {
      throw new BadRequestException(
        'Invalid Stellar public key. Please provide a valid Stellar public key starting with G.',
      );
    }
  }

  /**
   * Create a new payout method
   */
  async createPayoutMethod(
    userId: string,
    dto: CreatePayoutMethodDto,
  ): Promise<any> {
    try {
      // Validate the Stellar public key
      this.validateStellarPublicKey(dto.publicKey);

      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // If setting as default, unset other defaults
      if (dto.isDefault) {
        await this.prisma.payoutMethod.updateMany({
          where: {
            userId,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      // Check if this is the first payout method, make it default
      const existingCount = await this.prisma.payoutMethod.count({
        where: { userId },
      });

      const isDefault = dto.isDefault ?? existingCount === 0;

      // Create the payout method
      const payoutMethod = await this.prisma.payoutMethod.create({
        data: {
          name: dto.name,
          publicKey: dto.publicKey,
          isDefault,
          userId,
        },
      });

      this.logger.log(
        `Created payout method ${payoutMethod.id} for user ${userId}`,
      );

      return payoutMethod;
    } catch (error) {
      this.logger.error('Failed to create payout method', error);
      throw error;
    }
  }

  /**
   * Get all payout methods for a user
   */
  async getPayoutMethods(userId: string): Promise<any[]> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const payoutMethods = await this.prisma.payoutMethod.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return payoutMethods;
    } catch (error) {
      this.logger.error('Failed to get payout methods', error);
      throw error;
    }
  }

  /**
   * Get a specific payout method
   */
  async getPayoutMethod(userId: string, payoutMethodId: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const payoutMethod = await this.prisma.payoutMethod.findFirst({
        where: {
          id: payoutMethodId,
          userId,
        },
      });

      if (!payoutMethod) {
        throw new NotFoundException('Payout method not found');
      }

      return payoutMethod;
    } catch (error) {
      this.logger.error('Failed to get payout method', error);
      throw error;
    }
  }

  /**
   * Get default payout method for a user
   */
  async getDefaultPayoutMethod(userId: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const payoutMethod = await this.prisma.payoutMethod.findFirst({
        where: {
          userId,
          isDefault: true,
        },
      });

      if (!payoutMethod) {
        throw new NotFoundException(
          'No default payout method found. Please add a payout method first.',
        );
      }

      return payoutMethod;
    } catch (error) {
      this.logger.error('Failed to get default payout method', error);
      throw error;
    }
  }

  /**
   * Update a payout method
   */
  async updatePayoutMethod(
    userId: string,
    payoutMethodId: string,
    dto: UpdatePayoutMethodDto,
  ): Promise<any> {
    try {
      // Validate the Stellar public key if provided
      if (dto.publicKey) {
        this.validateStellarPublicKey(dto.publicKey);
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Verify the payout method belongs to the user
      const existingMethod = await this.prisma.payoutMethod.findFirst({
        where: {
          id: payoutMethodId,
          userId,
        },
      });

      if (!existingMethod) {
        throw new NotFoundException('Payout method not found');
      }

      // If setting as default, unset other defaults
      if (dto.isDefault === true) {
        await this.prisma.payoutMethod.updateMany({
          where: {
            userId,
            isDefault: true,
            id: { not: payoutMethodId },
          },
          data: {
            isDefault: false,
          },
        });
      }

      // Update the payout method
      const updatedMethod = await this.prisma.payoutMethod.update({
        where: { id: payoutMethodId },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.publicKey && { publicKey: dto.publicKey }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        },
      });

      this.logger.log(
        `Updated payout method ${payoutMethodId} for user ${userId}`,
      );

      return updatedMethod;
    } catch (error) {
      this.logger.error('Failed to update payout method', error);
      throw error;
    }
  }

  /**
   * Delete a payout method
   */
  async deletePayoutMethod(
    userId: string,
    payoutMethodId: string,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Verify the payout method belongs to the user
      const existingMethod = await this.prisma.payoutMethod.findFirst({
        where: {
          id: payoutMethodId,
          userId,
        },
      });

      if (!existingMethod) {
        throw new NotFoundException('Payout method not found');
      }

      // Delete the payout method
      await this.prisma.payoutMethod.delete({
        where: { id: payoutMethodId },
      });

      // If it was the default, set another one as default
      if (existingMethod.isDefault) {
        const nextMethod = await this.prisma.payoutMethod.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });

        if (nextMethod) {
          await this.prisma.payoutMethod.update({
            where: { id: nextMethod.id },
            data: { isDefault: true },
          });
        }
      }

      this.logger.log(
        `Deleted payout method ${payoutMethodId} for user ${userId}`,
      );
    } catch (error) {
      this.logger.error('Failed to delete payout method', error);
      throw error;
    }
  }
}
