import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TxState, TxType } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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
  @ApiQuery({
    name: 'type',
    required: false,
    enum: TxType,
    description: 'Filter by transaction type',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    enum: TxState,
    description: 'Filter by transaction state',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter transactions from this date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter transactions until this date (ISO 8601)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of transactions to retrieve (default: 50)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Offset for pagination (default: 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User wallet not found' })
  getUserTransactions(
    @CurrentUser('id') userId: string,
    @Query('type') type?: TxType,
    @Query('state') state?: TxState,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters = {
      type,
      state,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
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
  @ApiResponse({ status: 200, description: 'Transaction found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your transaction' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.transactionsService.findOne(id, userId);
  }
}
