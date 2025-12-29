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
import { Roles } from 'src/common/decorators/roles.decorator';
import { MFAGuard } from 'src/common/guards/mfa.guard';
import { OwnerGuard } from 'src/common/guards/owner.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { BountiesService } from './bounties.service';
import { ApplyToBountyDto } from './dto/apply-to-bounty.dto';
import { CreateBountyDto } from './dto/create-bounty.dto';
import { SelectWinnersDto } from './dto/select-winners.dto';
import { UpdateBountyDto } from './dto/update-bounty.dto';

@ApiTags('Bounties')
@Controller('bounties')
export class BountyController {
  constructor(
    private readonly bountyService: BountiesService,
    private readonly adminService: AdminService,
  ) {}

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
    return this.bountyService.getSupportedCurrencies();
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all bounties' })
  @ApiResponse({
    status: 200,
    description: 'List of all bounties from database',
  })
  async getAllBounties() {
    return this.bountyService.getAllBounties();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get bounties owned by current user' })
  @ApiResponse({
    status: 200,
    description: 'List of bounties owned by user',
  })
  async getMyBounties(@CurrentUser('id') userId: string) {
    return this.bountyService.getOwnerBounties(userId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active bounties' })
  @ApiResponse({
    status: 200,
    description: 'List of active bounty IDs',
  })
  async getActiveBounties() {
    return this.bountyService.getActiveBounties();
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Get bounty details' })
  @ApiResponse({
    status: 200,
    description: 'Bounty details from contract',
  })
  async getBounty(@Param('id') id: string) {
    return this.bountyService.getBounty(parseInt(id));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new bounty',
    description: 'Create a bounty on the Soroban contract.',
  })
  @ApiResponse({
    status: 201,
    description: 'Bounty created successfully',
    schema: {
      example: {
        bountyId: 1,
        txHash: '0x123...',
      },
    },
  })
  async createBounty(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBountyDto,
  ) {
    return this.bountyService.createBounty(userId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update bounty' })
  @ApiResponse({
    status: 200,
    description: 'Bounty updated successfully',
    schema: {
      example: {
        txHash: '0x123...',
      },
    },
  })
  async updateBounty(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBountyDto,
  ) {
    return this.bountyService.updateBounty(userId, parseInt(id), dto);
  }

  @Patch(':id/close')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Close a bounty',
    description:
      'Close a bounty. Can only be done by the owner before any submissions are made.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bounty closed successfully',
    schema: {
      example: {
        txHash: '0x123...',
      },
    },
  })
  async closeBounty(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.bountyService.closeBounty(userId, parseInt(id));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete bounty' })
  @ApiResponse({
    status: 200,
    description: 'Bounty deleted successfully',
  })
  async deleteBounty(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.bountyService.deleteBounty(userId, parseInt(id));
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard, MFAGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Apply to bounty (requires MFA)' })
  @ApiResponse({
    status: 200,
    description: 'Application submitted successfully',
    schema: {
      example: {
        txHash: '0x123...',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'MFA required' })
  async applyToBounty(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ApplyToBountyDto,
  ) {
    return this.bountyService.applyToBounty(userId, parseInt(id), dto);
  }

  @Patch(':id/submission')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update submission' })
  @ApiResponse({
    status: 200,
    description: 'Submission updated successfully',
  })
  async updateSubmission(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ApplyToBountyDto,
  ) {
    return this.bountyService.updateSubmission(userId, parseInt(id), dto);
  }

  @Post(':id/winners')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Select winners' })
  @ApiResponse({
    status: 200,
    description: 'Winners selected successfully',
    schema: {
      example: {
        txHash: '0x123...',
      },
    },
  })
  async selectWinners(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: SelectWinnersDto,
  ) {
    return this.bountyService.selectWinners(userId, parseInt(id), dto);
  }

  @Get(':id/submissions')
  @ApiOperation({
    summary: 'Get detailed bounty submissions',
    description:
      'Get submissions with full data including submission fields and user information',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed submissions with user info and submission data',
    schema: {
      example: [
        {
          id: 'submission-id',
          submissionLink: 'https://github.com/user/repo',
          submissionData: {
            githubRepo: 'https://github.com/user/repo',
            liveDemo: 'https://demo.example.com',
            estimatedHours: 40,
          },
          status: 'PENDING',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          user: {
            id: 'user-id',
            username: 'username',
            email: 'user@example.com',
          },
        },
      ],
    },
  })
  async getBountySubmissionsDetailed(@Param('id') id: string) {
    return this.bountyService.getBountySubmissionsDetailed(parseInt(id));
  }

  @Get(':id/applicants')
  @ApiOperation({ summary: 'Get bounty applicants' })
  @ApiResponse({
    status: 200,
    description: 'List of applicant addresses',
  })
  async getBountyApplicants(@Param('id') id: string) {
    return this.bountyService.getBountyApplicants(parseInt(id));
  }

  @Get(':id/winners')
  @ApiOperation({ summary: 'Get bounty winners' })
  @ApiResponse({
    status: 200,
    description: 'List of winner addresses',
  })
  async getBountyWinners(@Param('id') id: string) {
    return this.bountyService.getBountyWinners(parseInt(id));
  }

  // Admin endpoints
  @Post('admin/update-admin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update contract admin (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Admin updated successfully',
  })
  async updateAdmin(
    @CurrentUser('id') userId: string,
    @Body() dto: { newAdminAddress: string },
  ) {
    return this.adminService.updateAdmin(userId, dto.newAdminAddress);
  }

  @Post('admin/update-fee-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update fee account (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Fee account updated successfully',
  })
  async updateFeeAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: { newFeeAccount: string },
  ) {
    return this.adminService.updateFeeAccount(userId, dto.newFeeAccount);
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get contract statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Contract statistics',
  })
  async getContractStats(@CurrentUser('id') userId: string) {
    return this.adminService.getContractStats(userId);
  }

  @Post('admin/emergency-withdraw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Emergency withdraw (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal successful',
  })
  async emergencyWithdraw(
    @CurrentUser('id') userId: string,
    @Body()
    dto: {
      destination: string;
      amount: string;
    },
  ) {
    return this.adminService.emergencyWithdraw(
      userId,
      dto.destination,
      dto.amount,
    );
  }

  @Post('admin/check-judging/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check judging deadline (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Judging checked successfully',
  })
  async checkJudging(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.adminService.checkJudging(userId, parseInt(id));
  }
}
