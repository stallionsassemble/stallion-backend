import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequestUser } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import {
  ApplyToBountyDto,
  BountyService,
  CreateBountyDto,
  SelectWinnersDto,
  UpdateBountyDto,
} from './bounty.service';

@ApiTags('Bounties')
@Controller('bounties')
export class BountyController {
  constructor(
    private readonly bountyService: BountyService,
    private readonly adminService: AdminService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new bounty',
    description:
      'Create a bounty on the Soroban contract. User must send funds to master account first.',
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
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateBountyDto,
  ) {
    return this.bountyService.createBounty(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bounties' })
  @ApiResponse({
    status: 200,
    description: 'List of all bounty IDs',
    schema: {
      example: [1, 2, 3, 4, 5],
    },
  })
  async getAllBounties() {
    return this.bountyService.getAllBounties();
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

  @Get('my-bounties')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get bounties owned by current user' })
  @ApiResponse({
    status: 200,
    description: 'List of bounty IDs owned by user',
  })
  async getMyBounties(@CurrentUser() user: RequestUser) {
    return this.bountyService.getOwnerBounties(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bounty details' })
  @ApiResponse({
    status: 200,
    description: 'Bounty details from contract',
  })
  async getBounty(@Param('id') id: string) {
    return this.bountyService.getBounty(parseInt(id));
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
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
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateBountyDto,
  ) {
    return this.bountyService.updateBounty(user.id, parseInt(id), dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete bounty' })
  @ApiResponse({
    status: 200,
    description: 'Bounty deleted successfully',
  })
  async deleteBounty(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.bountyService.deleteBounty(user.id, parseInt(id));
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Apply to bounty' })
  @ApiResponse({
    status: 200,
    description: 'Application submitted successfully',
    schema: {
      example: {
        txHash: '0x123...',
      },
    },
  })
  async applyToBounty(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ApplyToBountyDto,
  ) {
    return this.bountyService.applyToBounty(user.id, parseInt(id), dto);
  }

  @Put(':id/submission')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update submission' })
  @ApiResponse({
    status: 200,
    description: 'Submission updated successfully',
  })
  async updateSubmission(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ApplyToBountyDto,
  ) {
    return this.bountyService.updateSubmission(user.id, parseInt(id), dto);
  }

  @Post(':id/winners')
  @UseGuards(JwtAuthGuard)
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
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SelectWinnersDto,
  ) {
    return this.bountyService.selectWinners(user.id, parseInt(id), dto);
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'Get bounty submissions' })
  @ApiResponse({
    status: 200,
    description: 'Map of user addresses to submission links',
  })
  async getBountySubmissions(@Param('id') id: string) {
    const submissions = await this.bountyService.getBountySubmissions(
      parseInt(id),
    );
    return Object.fromEntries(submissions);
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

  @Get(':id/status')
  @ApiOperation({ summary: 'Get bounty status' })
  @ApiResponse({
    status: 200,
    description: 'Bounty status',
  })
  async getBountyStatus(@Param('id') id: string) {
    return this.bountyService.getBountyStatus(parseInt(id));
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
    @CurrentUser() user: RequestUser,
    @Body() dto: { newAdminAddress: string },
  ) {
    return this.adminService.updateAdmin(user.id, dto.newAdminAddress);
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
    @CurrentUser() user: RequestUser,
    @Body() dto: { newFeeAccount: string },
  ) {
    return this.adminService.updateFeeAccount(user.id, dto.newFeeAccount);
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get contract statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Contract statistics',
  })
  async getContractStats(@CurrentUser() user: RequestUser) {
    return this.adminService.getContractStats(user.id);
  }

  @Get('admin/balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get master account balance (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Master account balance',
  })
  async getMasterAccountBalance(@CurrentUser() user: RequestUser) {
    return this.adminService.getMasterAccountBalance(user.id);
  }

  @Post('admin/emergency-withdraw')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Emergency withdraw (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal successful',
  })
  async emergencyWithdraw(
    @CurrentUser() user: RequestUser,
    @Body()
    dto: {
      destination: string;
      amount: string;
      memo?: string;
    },
  ) {
    return this.adminService.emergencyWithdraw(
      user.id,
      dto.destination,
      dto.amount,
      dto.memo,
    );
  }

  @Post('admin/check-judging/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check judging deadline (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Judging checked successfully',
  })
  async checkJudging(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.adminService.checkJudging(user.id, parseInt(id));
  }
}
