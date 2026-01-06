import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MFAGuard } from 'src/common/guards/mfa.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SetupTrustlineDto } from './dto/setup-trustline.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('supported-currencies')
  @ApiOperation({ summary: 'Get supported currencies' })
  @ApiResponse({
    status: 200,
    description: 'List of supported currencies with token addresses',
    schema: {
      example: [
        {
          code: 'USDC',
          name: 'USD Coin',
          tokenAddress:
            'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
          decimals: 7,
        },
      ],
    },
  })
  async getSupportedCurrencies() {
    return this.walletService.getSupportedCurrencies();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get wallet',
    description: 'Retrieve user wallet details and balance',
  })
  @ApiResponse({ status: 200, description: 'Wallet details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getWallet(@CurrentUser('id') userId: string) {
    return this.walletService.getWalletByUserId(userId);
  }

  @Get('balance')
  @ApiOperation({
    summary: 'Get wallet balance',
    description: 'Retrieve wallet balance with available balance',
  })
  @ApiResponse({ status: 200, description: 'Wallet balance' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getBalance(@CurrentUser('id') userId: string) {
    const wallet = await this.walletService.getWalletByUserId(userId);
    return this.walletService.getWalletBalance(wallet.id);
  }

  @Get('deposit-address')
  @ApiOperation({
    summary: 'Get deposit address',
    description: 'Get the Stellar address for depositing funds',
  })
  @ApiResponse({ status: 200, description: 'Deposit address details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDepositAddress(@CurrentUser('id') userId: string) {
    const wallet = await this.walletService.getWalletByUserId(userId);
    return this.walletService.getDepositAddress(wallet.id);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Get wallet transactions',
    description: 'Retrieve transaction history for user wallet',
  })
  @ApiResponse({ status: 200, description: 'List of transactions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTransactions(@CurrentUser('id') userId: string) {
    const wallet = await this.walletService.getWalletByUserId(userId);
    return this.walletService.getTransactions(wallet.id);
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Sync wallet with blockchain',
    description:
      'Manually sync wallet activation status and transactions from blockchain',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet synced successfully',
    schema: {
      example: {
        synced: true,
        activated: true,
        transactionsSynced: 5,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async syncWallet(@CurrentUser('id') userId: string) {
    const wallet = await this.walletService.getWalletByUserId(userId);
    return this.walletService.syncWallet(wallet.id);
  }

  @Post('withdraw')
  @UseGuards(MFAGuard)
  @ApiOperation({
    summary: 'Withdraw funds',
    description: 'Create a withdrawal request from wallet (requires MFA)',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal initiated successfully',
  })
  @ApiResponse({ status: 400, description: 'Insufficient balance' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'MFA required' })
  async withdraw(
    @CurrentUser('id') userId: string,
    @Body() withdrawDto: WithdrawDto,
  ) {
    const wallet = await this.walletService.getWalletByUserId(userId);
    return this.walletService.createWithdrawal(
      wallet.id,
      withdrawDto.amount,
      withdrawDto.currency,
      withdrawDto.payoutMethodId,
    );
  }

  @Post('trustline')
  @ApiOperation({
    summary: 'Setup trustline for a currency',
    description:
      'Establish a trustline for a supported currency (USDC, EURC, etc.) to enable receiving and holding that asset',
  })
  @ApiResponse({
    status: 201,
    description: 'Trustline established successfully',
    schema: {
      example: {
        success: true,
        txHash: 'abc123...',
        message: 'Trustline for USDC established successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid currency or trustline setup failed',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async setupTrustline(
    @CurrentUser('id') userId: string,
    @Body() dto: SetupTrustlineDto,
  ) {
    const wallet = await this.walletService.getWalletByUserId(userId);

    return this.walletService.setupTrustlineForCurrency(
      wallet.id,
      dto.currencyCode,
    );
  }

  @Delete('trustline')
  @ApiOperation({
    summary: 'Remove trustline for a currency',
    description:
      'Remove a trustline for a currency. Balance must be zero before removal.',
  })
  @ApiResponse({
    status: 204,
    description: 'Trustline removed successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Cannot remove trustline - balance not zero or invalid currency',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeTrustline(
    @CurrentUser('id') userId: string,
    @Body() dto: SetupTrustlineDto,
  ) {
    const wallet = await this.walletService.getWalletByUserId(userId);

    return this.walletService.removeTrustline(wallet.id, dto.currencyCode);
  }
}
