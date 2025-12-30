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
  ApiBody,
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
import { UpdateBountyApplicationDto } from './dto/update-bounty-application.dto';

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
    schema: {
      example: [
        {
          id: 'clx1a2b3c4d5e6f7g8h9i0',
          title: 'Build a DeFi Dashboard',
          shortDescription: 'Create a modern DeFi analytics dashboard',
          description: 'Full description of the bounty requirements...',
          reward: '1000000000',
          rewardCurrency: 'USDC',
          skills: ['React', 'TypeScript', 'Web3'],
          status: 'ACTIVE',
          submissionDeadline: '2024-12-31T23:59:59.000Z',
          judgingDeadline: '2025-01-07T23:59:59.000Z',
          contractBountyId: 1,
          ownerId: 'user-uuid-123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'clx2b3c4d5e6f7g8h9i0j1',
          title: 'Smart Contract Audit',
          shortDescription: 'Security audit for DeFi protocol',
          description: 'Comprehensive security audit...',
          reward: '5000000000',
          rewardCurrency: 'USDC',
          skills: ['Solidity', 'Security', 'Smart Contracts'],
          status: 'ACTIVE',
          submissionDeadline: '2025-01-15T23:59:59.000Z',
          judgingDeadline: '2025-01-22T23:59:59.000Z',
          contractBountyId: 2,
          ownerId: 'user-uuid-456',
          createdAt: '2024-01-05T00:00:00.000Z',
          updatedAt: '2024-01-05T00:00:00.000Z',
        },
      ],
    },
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
    schema: {
      example: [
        {
          id: 'clx1a2b3c4d5e6f7g8h9i0',
          title: 'Build a DeFi Dashboard',
          shortDescription: 'Create a modern DeFi analytics dashboard',
          description: 'Full description...',
          reward: '1000000000',
          rewardCurrency: 'USDC',
          skills: ['React', 'TypeScript', 'Web3'],
          status: 'ACTIVE',
          submissionDeadline: '2024-12-31T23:59:59.000Z',
          judgingDeadline: '2025-01-07T23:59:59.000Z',
          contractBountyId: 1,
          ownerId: 'current-user-id',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  })
  async getMyBounties(@CurrentUser('id') userId: string) {
    return this.bountyService.getOwnerBounties(userId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active bounties' })
  @ApiResponse({
    status: 200,
    description: 'List of active bounty IDs',
    schema: {
      example: [1, 2, 5, 7, 12],
    },
  })
  async getActiveBounties() {
    return this.bountyService.getActiveBounties();
  }

  @Get('user/:id')
  @ApiOperation({ summary: 'Get bounties owned by a user' })
  @ApiResponse({
    status: 200,
    description: 'List of bounties owned by user',
    schema: {
      example: [
        {
          id: 'clx1a2b3c4d5e6f7g8h9i0',
          title: 'Build a DeFi Dashboard',
          shortDescription: 'Create a modern DeFi analytics dashboard',
          description: 'Full description...',
          reward: '1000000000',
          rewardCurrency: 'USDC',
          skills: ['React', 'TypeScript', 'Web3'],
          status: 'ACTIVE',
          submissionDeadline: '2024-12-31T23:59:59.000Z',
          judgingDeadline: '2025-01-07T23:59:59.000Z',
          contractBountyId: 1,
          ownerId: 'specified-user-id',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  })
  async getUserBounties(@Param('id') userId: string) {
    return this.bountyService.getOwnerBounties(userId);
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Get bounty details' })
  @ApiResponse({
    status: 200,
    description: 'Bounty details from contract',
    schema: {
      example: {
        id: 'clx1a2b3c4d5e6f7g8h9i0',
        title: 'Build a DeFi Dashboard',
        shortDescription: 'Create a modern DeFi analytics dashboard',
        description:
          'Full description of the bounty requirements and deliverables...',
        reward: '1000000000',
        token: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
        rewardCurrency: 'USDC',
        skills: ['React', 'TypeScript', 'TailwindCSS', 'Web3'],
        rewardDistribution: [
          { rank: 1, percentage: 70 },
          { rank: 2, percentage: 20 },
          { rank: 3, percentage: 10 },
        ],
        submissionFields: [
          {
            name: 'githubUrl',
            label: 'GitHub Repository URL',
            type: 'url',
            required: true,
          },
        ],
        attachments: [
          {
            filename: 'requirements.pdf',
            url: 'https://example.com/files/requirements.pdf',
            size: 102400,
            mimetype: 'application/pdf',
          },
        ],
        status: 'ACTIVE',
        submissionDeadline: '2024-12-31T23:59:59.000Z',
        judgingDeadline: '2025-01-07T23:59:59.000Z',
        contractBountyId: 1,
        txHash: '0x1234567890abcdef...',
        ownerId: 'user-uuid-123',
        owner: {
          id: 'user-uuid-123',
          username: 'project_owner',
          email: 'owner@example.com',
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  async getBounty(@Param('id') id: string) {
    return this.bountyService.getBounty(id);
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
        message: 'Bounty created successfully',
        bounty: {
          id: 'uuid',
          title: 'Build a DeFi Dashboard',
          shortDescription: 'Create a modern DeFi analytics dashboard',
          description: 'Full description...',
          reward: '1000000000',
          rewardCurrency: 'USDC',
          skills: ['React', 'TypeScript', 'Web3'],
          status: 'ACTIVE',
          submissionDeadline: '2024-12-31T23:59:59.000Z',
          judgingDeadline: '2025-01-07T23:59:59.000Z',
          contractBountyId: 1,
          ownerId: 'user-uuid',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
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
        message: 'Bounty updated successfully',
        bounty: {
          id: 'uuid',
          title: 'Updated Bounty Title',
          shortDescription: 'Updated description',
          skills: ['React', 'Node.js'],
          status: 'ACTIVE',
        },
      },
    },
  })
  async updateBounty(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBountyDto,
  ) {
    return this.bountyService.updateBounty(userId, id, dto);
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
        message: 'Bounty closed successfully',
        bounty: {
          id: 'uuid',
          title: 'Build a DeFi Dashboard',
          shortDescription: 'Create a modern DeFi analytics dashboard',
          description: 'Full description...',
          reward: '1000000000',
          rewardCurrency: 'USDC',
          skills: ['React', 'TypeScript', 'Web3'],
          status: 'CLOSED',
          submissionDeadline: '2024-12-31T23:59:59.000Z',
          judgingDeadline: '2025-01-07T23:59:59.000Z',
          contractBountyId: 1,
          ownerId: 'user-uuid',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      },
    },
  })
  async closeBounty(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.bountyService.closeBounty(userId, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete bounty' })
  @ApiResponse({
    status: 200,
    description: 'Bounty deleted successfully',
    schema: {
      example: {
        message: 'Bounty deleted successfully',
      },
    },
  })
  async deleteBounty(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.bountyService.deleteBounty(userId, id);
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard, MFAGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Apply to bounty (requires MFA)' })
  @ApiResponse({
    status: 200,
    description: 'Application submitted successfully',
    schema: {
      example: {
        message: 'Application submitted successfully',
        submission: {
          id: 'uuid',
          bountyId: 'bounty-uuid',
          userId: 'user-uuid',
          submissionLink: 'https://github.com/user/repo',
          submission: {},
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'MFA required' })
  async applyToBounty(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ApplyToBountyDto,
  ) {
    return this.bountyService.applyToBounty(userId, id, dto);
  }

  @Patch(':id/submission')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update submission' })
  @ApiResponse({
    status: 200,
    description: 'Submission updated successfully',
    schema: {
      example: {
        message: 'Submission updated successfully',
        submission: {
          id: 'uuid',
          bountyId: 'bounty-uuid',
          userId: 'user-uuid',
          submissionLink: 'https://github.com/user/repo',
          submission: {},
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      },
    },
  })
  async updateSubmission(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBountyApplicationDto,
  ) {
    return this.bountyService.updateSubmission(userId, id, dto);
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
        message: 'Winners selected successfully',
      },
    },
  })
  async selectWinners(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: SelectWinnersDto,
  ) {
    return this.bountyService.selectWinners(userId, id, dto);
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
    return this.bountyService.getBountySubmissionsDetailed(id);
  }

  @Get(':id/applicants')
  @ApiOperation({ summary: 'Get bounty applicants' })
  @ApiResponse({
    status: 200,
    description: 'List of applicant addresses',
  })
  async getBountyApplicants(@Param('id') id: string) {
    return this.bountyService.getBountyApplicants(id);
  }

  @Get(':id/winners')
  @ApiOperation({ summary: 'Get bounty winners' })
  @ApiResponse({
    status: 200,
    description: 'List of winner addresses',
  })
  async getBountyWinners(@Param('id') id: string) {
    return this.bountyService.getBountyWinners(id);
  }

  // Admin endpoints
  @Post('admin/update-admin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update contract admin (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newAdminAddress: {
          type: 'string',
          example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          description: 'Stellar public key of the new admin',
        },
      },
      required: ['newAdminAddress'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Admin updated successfully',
    schema: {
      type: 'object',
      properties: {
        txHash: {
          type: 'string',
          example: 'abc123def456...',
        },
      },
    },
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newFeeAccount: {
          type: 'string',
          example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          description: 'Stellar public key of the new fee account',
        },
      },
      required: ['newFeeAccount'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Fee account updated successfully',
    schema: {
      type: 'object',
      properties: {
        txHash: {
          type: 'string',
          example: 'abc123def456...',
        },
      },
    },
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
    schema: {
      type: 'object',
      properties: {
        totalBounties: {
          type: 'number',
          example: 42,
        },
        totalRewards: {
          type: 'string',
          example: '1000000',
        },
        totalSubmissions: {
          type: 'number',
          example: 128,
        },
      },
    },
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          description: 'Stellar public key of the destination account',
        },
        amount: {
          type: 'string',
          example: '1000000',
          description: 'Amount to withdraw (in stroops)',
        },
      },
      required: ['destination', 'amount'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal successful',
    schema: {
      type: 'object',
      properties: {
        txHash: {
          type: 'string',
          example: 'abc123def456...',
        },
      },
    },
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
  @ApiOperation({
    summary: 'Check judging deadline (Admin only)',
    description:
      'Checks if judging deadline has passed and automatically completes the bounty if needed',
  })
  @ApiResponse({
    status: 200,
    description: 'Judging checked successfully',
    schema: {
      type: 'object',
      properties: {
        txHash: {
          type: 'string',
          example: 'abc123def456...',
        },
      },
    },
  })
  async checkJudging(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.adminService.checkJudging(userId, id);
  }
}
