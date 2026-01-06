import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IdParamDto } from 'src/common/dto/id-param.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetTransactionsQueryDto } from './dto/get-transactions-query.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('')
  @ApiOperation({
    summary: 'Get my transaction history',
    description:
      'Retrieve transaction history for the authenticated user with filters and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
    schema: {
      example: {
        transactions: [
          {
            id: 'clx123abc...',
            type: 'DEPOSIT',
            amount: '100.00',
            currency: 'USDC',
            state: 'COMPLETED',
            externalTxId: 'stellar_tx_hash_123',
            note: 'Deposit from Stellar wallet',
            metadata: { source: 'stellar' },
            createdAt: '2025-01-15T10:30:00.000Z',
            updatedAt: '2025-01-15T10:31:00.000Z',
            walletId: 'clx456def...',
          },
          {
            id: 'clx789ghi...',
            type: 'PAYOUT',
            amount: '50.00',
            currency: 'USDC',
            state: 'COMPLETED',
            externalTxId: null,
            note: 'Bounty payout',
            metadata: { bountyId: 'clx999...' },
            createdAt: '2025-01-14T15:20:00.000Z',
            updatedAt: '2025-01-14T15:20:00.000Z',
            walletId: 'clx456def...',
          },
        ],
        total: 25,
        limit: 50,
        offset: 0,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User wallet not found' })
  getUserTransactions(
    @CurrentUser('id') userId: string,
    @Query() query: GetTransactionsQueryDto,
  ) {
    const filters = {
      type: query.type,
      state: query.state,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    };

    return this.transactionsService.getUserTransactions(userId, filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get transaction by ID',
    description:
      'Retrieve detailed transaction information (only for transactions in your wallet)',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction found',
    schema: {
      example: {
        id: 'clx123abc...',
        type: 'DEPOSIT',
        amount: '100.00',
        currency: 'USDC',
        state: 'COMPLETED',
        externalTxId: 'stellar_tx_hash_123',
        idempotencyKey: 'unique_key_123',
        note: 'Deposit from Stellar wallet',
        metadata: { source: 'stellar' },
        createdAt: '2025-01-15T10:30:00.000Z',
        updatedAt: '2025-01-15T10:31:00.000Z',
        walletId: 'clx456def...',
        wallet: {
          id: 'clx456def...',
          publicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          balance: '150.00',
          isActivated: true,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-15T10:31:00.000Z',
          users: [
            {
              id: 'clx789user...',
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your transaction' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  findOne(@Param() dto: IdParamDto, @CurrentUser('id') userId: string) {
    return this.transactionsService.findOne(dto.id, userId);
  }
}
