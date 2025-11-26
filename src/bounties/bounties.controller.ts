import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BountyStatus } from '@prisma/client';
import { RequestUser } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BountiesService } from './bounties.service';
import { CreateBountyDto } from './dto/create-bounty.dto';
import { UpdateBountyDto } from './dto/update-bounty.dto';

@ApiTags('Bounties')
@Controller('bounties')
export class BountiesController {
  constructor(private readonly bountiesService: BountiesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create bounty',
    description: 'Create a new bounty (requires authentication)',
  })
  @ApiResponse({ status: 201, description: 'Bounty created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @Body() createBountyDto: CreateBountyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.bountiesService.create(createBountyDto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List bounties',
    description: 'Get all bounties with optional status filter',
  })
  @ApiQuery({
    name: 'status',
    enum: BountyStatus,
    required: false,
    description: 'Filter by bounty status',
  })
  @ApiResponse({ status: 200, description: 'List of bounties' })
  findAll(@Query('status') status?: BountyStatus) {
    return this.bountiesService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get bounty by ID',
    description: 'Retrieve detailed bounty information',
  })
  @ApiParam({ name: 'id', description: 'Bounty ID' })
  @ApiResponse({ status: 200, description: 'Bounty found' })
  @ApiResponse({ status: 404, description: 'Bounty not found' })
  findOne(@Param('id') id: string) {
    return this.bountiesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update bounty',
    description: 'Update bounty details (creator or admin only)',
  })
  @ApiParam({ name: 'id', description: 'Bounty ID' })
  @ApiResponse({ status: 200, description: 'Bounty updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Bounty not found' })
  update(@Param('id') id: string, @Body() updateBountyDto: UpdateBountyDto) {
    return this.bountiesService.update(id, updateBountyDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete bounty',
    description: 'Remove bounty from the system (creator or admin only)',
  })
  @ApiParam({ name: 'id', description: 'Bounty ID' })
  @ApiResponse({ status: 200, description: 'Bounty deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Bounty not found' })
  remove(@Param('id') id: string) {
    return this.bountiesService.remove(id);
  }
}
