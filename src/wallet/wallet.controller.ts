import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequestUser } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WithdrawDto } from './dto/withdraw.dto';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({
    summary: 'Get wallet',
    description: 'Retrieve user wallet details and balance',
  })
  @ApiResponse({ status: 200, description: 'Wallet details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getWallet(@CurrentUser() user: RequestUser) {
    return this.walletService.getWalletByUserId(user.id);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Get wallet transactions',
    description: 'Retrieve transaction history for user wallet',
  })
  @ApiResponse({ status: 200, description: 'List of transactions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTransactions(@CurrentUser() user: RequestUser) {
    const wallet = await this.walletService.getWalletByUserId(user.id);
    return this.walletService.getTransactions(wallet.id);
  }

  @Post('withdraw')
  @ApiOperation({
    summary: 'Withdraw funds',
    description: 'Create a withdrawal request from wallet',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal initiated successfully',
  })
  @ApiResponse({ status: 400, description: 'Insufficient balance' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async withdraw(
    @CurrentUser() user: RequestUser,
    @Body() withdrawDto: WithdrawDto,
  ) {
    const wallet = await this.walletService.getWalletByUserId(user.id);
    return this.walletService.createWithdrawal(
      wallet.id,
      withdrawDto.amount,
      withdrawDto.currency,
    );
  }
}
