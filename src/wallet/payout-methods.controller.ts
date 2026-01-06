import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParamDto } from '../common/dto/id-param.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreatePayoutMethodDto } from './dto/create-payout-method.dto';
import { PayoutMethodResponseDto } from './dto/payout-method-response.dto';
import { UpdatePayoutMethodDto } from './dto/update-payout-method.dto';
import { PayoutMethodsService } from './payout-methods.service';

@ApiTags('Payout Methods')
@Controller('wallet/payout-methods')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PayoutMethodsController {
  constructor(private readonly payoutMethodsService: PayoutMethodsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new payout method' })
  @ApiResponse({
    status: 201,
    description: 'Payout method created successfully',
    type: PayoutMethodResponseDto,
    schema: {
      example: {
        id: 'payout-method-uuid',
        name: 'My Ledger Wallet',
        publicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        isDefault: true,
        createdAt: '2024-03-01T12:00:00.000Z',
        updatedAt: '2024-03-01T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Stellar public key',
  })
  async createPayoutMethod(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePayoutMethodDto,
  ) {
    return this.payoutMethodsService.createPayoutMethod(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all payout methods' })
  @ApiResponse({
    status: 200,
    description: 'List of payout methods',
    type: [PayoutMethodResponseDto],
    schema: {
      example: [
        {
          id: 'payout-method-uuid-1',
          name: 'My Ledger Wallet',
          publicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          isDefault: true,
          createdAt: '2024-03-01T12:00:00.000Z',
          updatedAt: '2024-03-01T12:00:00.000Z',
        },
        {
          id: 'payout-method-uuid-2',
          name: 'Exchange Wallet',
          publicKey: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
          isDefault: false,
          createdAt: '2024-03-02T12:00:00.000Z',
          updatedAt: '2024-03-02T12:00:00.000Z',
        },
      ],
    },
  })
  async getPayoutMethods(@CurrentUser('id') userId: string) {
    return this.payoutMethodsService.getPayoutMethods(userId);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default payout method' })
  @ApiResponse({
    status: 200,
    description: 'Default payout method',
    type: PayoutMethodResponseDto,
    schema: {
      example: {
        id: 'payout-method-uuid',
        name: 'My Ledger Wallet',
        publicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        isDefault: true,
        createdAt: '2024-03-01T12:00:00.000Z',
        updatedAt: '2024-03-01T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No default payout method found',
  })
  async getDefaultPayoutMethod(@CurrentUser('id') userId: string) {
    return this.payoutMethodsService.getDefaultPayoutMethod(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific payout method' })
  @ApiResponse({
    status: 200,
    description: 'Payout method details',
    type: PayoutMethodResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payout method not found',
  })
  async getPayoutMethod(
    @CurrentUser('id') userId: string,
    @Param() params: IdParamDto,
  ) {
    return this.payoutMethodsService.getPayoutMethod(userId, params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a payout method' })
  @ApiResponse({
    status: 200,
    description: 'Payout method updated successfully',
    type: PayoutMethodResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Stellar public key',
  })
  @ApiResponse({
    status: 404,
    description: 'Payout method not found',
  })
  async updatePayoutMethod(
    @CurrentUser('id') userId: string,
    @Param() params: IdParamDto,
    @Body() dto: UpdatePayoutMethodDto,
  ) {
    return this.payoutMethodsService.updatePayoutMethod(userId, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a payout method' })
  @ApiResponse({
    status: 204,
    description: 'Payout method deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Payout method not found',
  })
  async deletePayoutMethod(
    @CurrentUser('id') userId: string,
    @Param() params: IdParamDto,
  ) {
    await this.payoutMethodsService.deletePayoutMethod(userId, params.id);
  }
}
