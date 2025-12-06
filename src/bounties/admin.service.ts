import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSDK from '@stellar/stellar-sdk';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  Client as SorobanClient,
  networks,
} from '../soroban/contract-bindings';
import { StellarAccountService } from '../soroban/stellar-account.service';

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
    private stellarAccount: StellarAccountService,
    private configService: ConfigService,
  ) {
    this.contractId = this.configService.get<string>('SOROBAN_CONTRACT_ID')!;
    const network = this.configService.get<string>('SOROBAN_NETWORK')!;
    const rpcUrl = this.configService.get<string>('SOROBAN_RPC_URL')!;

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

      const tx = await this.sorobanClient.update_admin({
        new_admin: newAdminAddress,
      });

      // Prepare, sign with Vault and send transaction
      const preparedTx = await tx.simulate();
      const builtTx = StellarSDK.TransactionBuilder.fromXDR(
        preparedTx.toXDR(),
        this.networkPassphrase,
      ) as StellarSDK.Transaction;
      const signedTx =
        await this.stellarAccount.signTransactionWithVault(builtTx);

      const sendResponse = await this.rpcServer.sendTransaction(signedTx);
      this.logger.log(
        `Admin updated to ${newAdminAddress}, tx: ${sendResponse.hash}`,
      );

      return { txHash: sendResponse.hash };
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

      const tx = await this.sorobanClient.update_fee_account({
        new_fee_account: newFeeAccount,
      });

      // Prepare, sign with Vault and send transaction
      const preparedTx = await tx.simulate();
      const builtTx = StellarSDK.TransactionBuilder.fromXDR(
        preparedTx.toXDR(),
        this.networkPassphrase,
      ) as StellarSDK.Transaction;
      const signedTx =
        await this.stellarAccount.signTransactionWithVault(builtTx);

      const sendResponse = await this.rpcServer.sendTransaction(signedTx);
      this.logger.log(
        `Fee account updated to ${newFeeAccount}, tx: ${sendResponse.hash}`,
      );

      return { txHash: sendResponse.hash };
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
      const totalBountiesTx = await this.sorobanClient.get_bounties_count();
      const totalBounties = Number((await totalBountiesTx.simulate()).result);

      // Get active bounties
      const activeBountiesTx = await this.sorobanClient.get_active_bounties();
      const activeBounties = (await activeBountiesTx.simulate()).result.length;

      // Get completed bounties
      const completedBountiesTx =
        await this.sorobanClient.get_bounties_by_status({
          status: { tag: 'Completed', values: undefined },
        });
      const completedBounties = (await completedBountiesTx.simulate()).result
        .length;

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
   * Get master account balance
   */
  async getMasterAccountBalance(userId: string): Promise<{
    balance: string;
    publicKey: string;
  }> {
    try {
      await this.verifyAdmin(userId);

      const publicKey = this.stellarAccount.getMasterPublicKey();
      const balance = await this.stellarAccount.getAccountBalance(publicKey);

      return {
        balance,
        publicKey,
      };
    } catch (error) {
      this.logger.error('Failed to get master account balance', error);
      throw error;
    }
  }

  /**
   * Emergency: Send funds from master account
   * Should only be used in emergencies
   */
  async emergencyWithdraw(
    userId: string,
    destination: string,
    amount: string,
    memo?: string,
  ): Promise<{ txHash: string }> {
    try {
      await this.verifyAdmin(userId);

      this.logger.warn(
        `Emergency withdraw initiated by ${userId} to ${destination} for ${amount} stroops`,
      );

      const txHash = await this.stellarAccount.sendPayment(
        destination,
        amount,
        undefined,
        memo,
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
    bountyId: number,
  ): Promise<{ txHash: string }> {
    try {
      await this.verifyAdmin(userId);

      const tx = await this.sorobanClient.check_judging({
        bounty_id: bountyId,
      });

      // Prepare, sign with Vault and send transaction
      const preparedTx = await tx.simulate();
      const builtTx = StellarSDK.TransactionBuilder.fromXDR(
        preparedTx.toXDR(),
        this.networkPassphrase,
      ) as StellarSDK.Transaction;
      const signedTx =
        await this.stellarAccount.signTransactionWithVault(builtTx);

      const sendResponse = await this.rpcServer.sendTransaction(signedTx);
      this.logger.log(
        `Judging checked for bounty ${bountyId}, tx: ${sendResponse.hash}`,
      );

      return { txHash: sendResponse.hash };
    } catch (error) {
      this.logger.error('Failed to check judging', error);
      throw error;
    }
  }
}
