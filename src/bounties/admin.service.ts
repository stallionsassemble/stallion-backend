import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSDK from '@stellar/stellar-sdk';
import { PrismaService } from '../common/prisma/prisma.service';
import { EnvConfig } from '../config/env.config';
import {
  Client as SorobanClient,
  networks,
} from '../soroban/contract-bindings';
import { WalletSigningService } from '../wallet/wallet-signing.service';

/**
 * Admin Service
 * Handles administrative operations for the Soroban contract
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private sorobanClient: SorobanClient;
  private rpcServer: StellarSDK.rpc.Server;
  private readonly contractId: string;
  private readonly networkPassphrase: string;

  constructor(
    private prisma: PrismaService,
    private walletSigning: WalletSigningService,
    private configService: ConfigService,
  ) {
    this.contractId = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_CONTRACT_ID,
    );
    const network = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_NETWORK,
    );
    const rpcUrl = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_RPC_URL,
    );

    // Initialize Soroban RPC server
    this.rpcServer = new StellarSDK.rpc.Server(rpcUrl);
    this.networkPassphrase =
      networks[network as keyof typeof networks].networkPassphrase;

    // Initialize Soroban client
    this.sorobanClient = new SorobanClient({
      contractId: this.contractId,
      networkPassphrase: this.networkPassphrase,
      rpcUrl,
    });
  }

  /**
   * Check if user is admin
   */
  private async isAdmin(userId: string): Promise<boolean> {
    // Check if user has ADMIN role in database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    return user?.role === 'ADMIN';
  }

  /**
   * Verify user is admin or throw error
   */
  private async verifyAdmin(userId: string): Promise<void> {
    const isAdmin = await this.isAdmin(userId);
    if (!isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
  }

  /**
   * Update contract admin
   */
  async updateAdmin(
    userId: string,
    newAdminAddress: string,
  ): Promise<{ txHash: string }> {
    try {
      await this.verifyAdmin(userId);

      // Get admin user wallet
      const adminUser = await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
        include: { wallet: true },
      });

      if (!adminUser?.wallet) {
        throw new Error('Admin wallet not found');
      }

      const walletId = adminUser.wallet.id;
      const walletPublicKey = adminUser.wallet.publicKey;

      // Set the public key for the Soroban client
      this.sorobanClient.options.publicKey = walletPublicKey;

      const tx = await this.sorobanClient.update_admin({
        new_admin: newAdminAddress,
      });

      // Sign and send transaction
      const result = await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            walletId,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: walletPublicKey,
          };
        },
      });

      // Handle transaction result
      if (!result.result.isOk()) {
        const error = result.result.unwrapErr();
        this.logger.error('Contract invocation failed', error);
        throw new BadRequestException(
          `Failed to update admin on contract: ${JSON.stringify(error)}`,
        );
      }

      if (!result.getTransactionResponse) {
        throw new BadRequestException('Transaction response not available');
      }

      const txHash = result.getTransactionResponse.txHash;
      this.logger.log(`Admin updated to ${newAdminAddress}, tx: ${txHash}`);

      return { txHash };
    } catch (error) {
      this.logger.error('Failed to update admin', error);
      throw error;
    }
  }

  /**
   * Update fee account
   */
  async updateFeeAccount(
    userId: string,
    newFeeAccount: string,
  ): Promise<{ txHash: string }> {
    try {
      await this.verifyAdmin(userId);

      // Get admin user wallet
      const adminUser = await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
        include: { wallet: true },
      });

      if (!adminUser?.wallet) {
        throw new Error('Admin wallet not found');
      }

      const walletId = adminUser.wallet.id;
      const walletPublicKey = adminUser.wallet.publicKey;

      // Set the public key for the Soroban client
      this.sorobanClient.options.publicKey = walletPublicKey;

      const tx = await this.sorobanClient.update_fee_account({
        new_fee_account: newFeeAccount,
      });

      // Sign and send transaction
      const result = await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const transaction = StellarSDK.TransactionBuilder.fromXDR(
            transactionXdr,
            this.networkPassphrase,
          ) as StellarSDK.Transaction;

          const signedTx = await this.walletSigning.signTransaction(
            walletId,
            transaction,
          );

          return {
            signedTxXdr: signedTx.toXDR(),
            signerAddress: walletPublicKey,
          };
        },
      });

      // Handle transaction result
      if (!result.result.isOk()) {
        const error = result.result.unwrapErr();
        this.logger.error('Contract invocation failed', error);
        throw new BadRequestException(
          `Failed to update fee account on contract: ${JSON.stringify(error)}`,
        );
      }

      if (!result.getTransactionResponse) {
        throw new BadRequestException('Transaction response not available');
      }

      const txHash = result.getTransactionResponse.txHash;
      this.logger.log(`Fee account updated to ${newFeeAccount}, tx: ${txHash}`);

      return { txHash };
    } catch (error) {
      this.logger.error('Failed to update fee account', error);
      throw error;
    }
  }

  /**
   * Get contract statistics
   */
  async getContractStats(userId: string): Promise<{
    totalBounties: number;
    activeBounties: number;
    completedBounties: number;
    totalRewards: string;
  }> {
    try {
      await this.verifyAdmin(userId);

      // Get total bounties
      const totalBountiesAssembled =
        await this.sorobanClient.get_bounties_count();
      const totalBountiesSimulated = await totalBountiesAssembled.simulate();
      const totalBounties = Number(totalBountiesSimulated.result);

      // Get active bounties
      const activeBountiesAssembled =
        await this.sorobanClient.get_active_bounties();
      const activeBountiesSimulated = await activeBountiesAssembled.simulate();
      const activeBounties = activeBountiesSimulated.result.length;

      // Get completed bounties
      const completedBountiesAssembled =
        await this.sorobanClient.get_bounties_by_status({
          status: { tag: 'Completed', values: undefined },
        });
      const completedBountiesSimulated =
        await completedBountiesAssembled.simulate();
      const completedBounties = completedBountiesSimulated.result.length;

      // Calculate total rewards from database
      const bounties = await this.prisma.bounty.findMany({
        select: { reward: true },
      });

      const totalRewards = bounties
        .reduce((sum, b) => sum + BigInt(b.reward.toString()), BigInt(0))
        .toString();

      return {
        totalBounties,
        activeBounties,
        completedBounties,
        totalRewards,
      };
    } catch (error) {
      this.logger.error('Failed to get contract stats', error);
      throw error;
    }
  }

  /**
   * Emergency: Send funds from admin wallet
   * Should only be used in emergencies
   */
  async emergencyWithdraw(
    userId: string,
    destination: string,
    amount: string,
  ): Promise<{ txHash: string }> {
    try {
      await this.verifyAdmin(userId);

      this.logger.warn(
        `Emergency withdraw initiated by ${userId} to ${destination} for ${amount} stroops`,
      );

      // Emergency withdrawal from admin wallet
      const adminUser = await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
        include: { wallet: true },
      });

      if (!adminUser?.wallet) {
        throw new Error('Admin wallet not found');
      }

      const txHash = await this.walletSigning.signAndSubmitPayment(
        adminUser.wallet.id,
        destination,
        amount,
      );

      return { txHash };
    } catch (error) {
      this.logger.error('Failed to perform emergency withdraw', error);
      throw error;
    }
  }

  /**
   * Check judging deadline for a bounty
   * Automatically completes bounty if judging deadline passed
   */
  async checkJudging(
    userId: string,
    dbBountyId: string,
  ): Promise<{ txHash: string }> {
    try {
      await this.verifyAdmin(userId);

      // Get bounty to fetch contract ID
      const bounty = await this.prisma.bounty.findUnique({
        where: { id: dbBountyId },
      });

      if (!bounty || bounty.contractBountyId === null) {
        throw new NotFoundException('Bounty not found');
      }

      const tx = await this.sorobanClient.check_judging({
        bounty_id: bounty.contractBountyId,
      });

      // Prepare, sign and send transaction
      const preparedTx = await tx.simulate();
      const builtTx = StellarSDK.TransactionBuilder.fromXDR(
        preparedTx.toXDR(),
        this.networkPassphrase,
      ) as StellarSDK.Transaction;
      // Note: Admin operations need a designated admin wallet
      // For now, using the first admin user's wallet
      const adminUser = await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
        include: { wallet: true },
      });

      if (!adminUser?.wallet) {
        throw new Error('Admin wallet not found');
      }

      const signedTx = await this.walletSigning.signTransaction(
        adminUser.wallet.id,
        builtTx,
      );

      const sendResponse = await this.rpcServer.sendTransaction(signedTx);
      this.logger.log(
        `Judging checked for bounty ${dbBountyId}, tx: ${sendResponse.hash}`,
      );

      return { txHash: sendResponse.hash };
    } catch (error) {
      this.logger.error('Failed to check judging', error);
      throw error;
    }
  }
}
