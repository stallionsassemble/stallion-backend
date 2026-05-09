import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UpdateBountyDto } from 'src/bounties/dto/update-bounty.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { IdParamDto } from 'src/common/dto/id-param.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UpdateProjectDto } from 'src/projects/dto/update-project.dto';
import { AdminService } from './admin.service';
import {
  AdminBountyQueryDto,
  AdminCreateHackathonDto,
  AdminCreateUserDto,
  AdminHackathonQueryDto,
  AdminPayoutQueryDto,
  AdminProjectQueryDto,
  AdminUserQueryDto,
  AdminActionResponseDto,
  BanUserDto,
  FundingWalletResponseDto,
  SetFundingWalletDto,
  StepUpTokenResponseDto,
  StepUpPasskeyVerifyDto,
  StepUpTotpDto,
  SuspendUserDto,
  ToggleFeatureDto,
} from './dto/admin.dto';
import { AdminStepUpGuard } from './guards/admin-step-up.guard';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
@ApiForbiddenResponse({ description: 'Admin role required' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('security/step-up/totp')
  @ApiOperation({ summary: 'Verify TOTP for admin step-up token' })
  @ApiOkResponse({
    description: 'Step-up token issued',
    type: StepUpTokenResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid TOTP input' })
  verifyTotpStepUp(
    @CurrentUser('id') userId: string,
    @Body() dto: StepUpTotpDto,
  ) {
    return this.adminService.verifyTotpStepUp(userId, dto.code);
  }

  @Post('security/step-up/passkey/options')
  @ApiOperation({ summary: 'Get passkey options for admin step-up' })
  @ApiOkResponse({
    description: 'WebAuthn options generated for step-up authentication',
  })
  getPasskeyStepUpOptions(@CurrentUser('id') userId: string) {
    return this.adminService.getPasskeyStepUpOptions(userId);
  }

  @Post('security/step-up/passkey/verify')
  @ApiOperation({ summary: 'Verify passkey for admin step-up token' })
  @ApiOkResponse({
    description: 'Step-up token issued',
    type: StepUpTokenResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid passkey authentication payload',
  })
  verifyPasskeyStepUp(
    @CurrentUser('id') userId: string,
    @Body() dto: StepUpPasskeyVerifyDto,
  ) {
    return this.adminService.verifyPasskeyStepUp(userId, dto.response);
  }

  @Get('funding-wallet')
  @ApiOperation({ summary: 'Get current platform funding wallet' })
  @ApiOkResponse({
    description: 'Current funding wallet source and value',
    type: FundingWalletResponseDto,
  })
  getFundingWallet() {
    return this.adminService.getFundingWallet();
  }

  @Put('funding-wallet')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Set platform funding wallet' })
  @ApiOkResponse({
    description: 'Funding wallet updated',
    type: FundingWalletResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      'Admin step-up verification required (x-admin-step-up-token header)',
  })
  setFundingWallet(
    @CurrentUser('id') userId: string,
    @Body() dto: SetFundingWalletDto,
  ) {
    return this.adminService.setFundingWallet(userId, dto.fundingWalletId);
  }

  @Delete('funding-wallet')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Clear platform funding wallet override' })
  @ApiOkResponse({
    description: 'Funding wallet override cleared',
    type: FundingWalletResponseDto,
  })
  clearFundingWallet(@CurrentUser('id') userId: string) {
    return this.adminService.clearFundingWallet(userId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin main dashboard analytics' })
  @ApiOkResponse({
    description: 'Admin dashboard aggregate metrics',
  })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users/stats')
  @ApiOperation({ summary: 'Admin user management statistics' })
  @ApiOkResponse({ description: 'User stats summary' })
  getUserStats() {
    return this.adminService.getUserStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users with admin filters and pagination' })
  @ApiOkResponse({
    description: 'Paginated users list',
    schema: {
      example: {
        data: [
          {
            id: 'user-uuid-123',
            email: 'contact@company.com',
            username: 'company_alpha',
            firstName: 'Alice',
            lastName: 'Smith',
            role: 'PROJECT_OWNER',
            status: 'ACTIVE',
            gender: 'UNSPECIFIED',
            reputation: {
              score: 450,
              level: 'EXPERT',
            },
            reputationRating: 4.9,
            totalReviews: 25,
            bountiesParticipated: 0,
            projectsParticipated: 8,
            earningsUsd: 0,
            lastActiveAt: '2026-05-09T20:10:38Z',
            createdAt: '2026-01-15T09:30:00Z',
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    },
  })
  listUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create user as admin and send invite email' })
  @ApiOkResponse({ description: 'User created and invite email queued' })
  createUser(@Body() dto: AdminCreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Post('users/:id/reset-2fa')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Reset user 2FA and passkeys' })
  @ApiOkResponse({ type: AdminActionResponseDto })
  resetUser2FA(@Param() params: IdParamDto) {
    return this.adminService.resetUser2FA(params.id);
  }

  @Post('users/:id/make-admin')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Promote user to admin' })
  @ApiOkResponse({ type: AdminActionResponseDto })
  makeAdmin(@Param() params: IdParamDto) {
    return this.adminService.makeAdmin(params.id);
  }

  @Post('users/:id/suspend')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Suspend user (timed or indefinite)' })
  @ApiOkResponse({ description: 'User suspended' })
  suspendUser(@Param() params: IdParamDto, @Body() dto: SuspendUserDto) {
    return this.adminService.suspendUser(params.id, dto);
  }

  @Post('users/:id/ban')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Ban user' })
  @ApiOkResponse({ type: AdminActionResponseDto })
  banUser(@Param() params: IdParamDto, @Body() dto: BanUserDto) {
    return this.adminService.banUser(params.id, dto);
  }

  @Get('bounties/stats')
  @ApiOperation({ summary: 'Bounty management stats' })
  @ApiOkResponse({ description: 'Bounty stats summary' })
  getBountyStats() {
    return this.adminService.getBountyStats();
  }

  @Get('bounties')
  @ApiOperation({ summary: 'List bounties with admin filters and pagination' })
  @ApiOkResponse({
    description: 'Paginated bounties list',
  })
  listBounties(@Query() query: AdminBountyQueryDto) {
    return this.adminService.listBounties(query);
  }

  @Patch('bounties/:id/feature')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Set/remove featured flag on bounty' })
  @ApiOkResponse({ description: 'Bounty feature flag updated' })
  toggleBountyFeature(
    @Param() params: IdParamDto,
    @Body() dto: ToggleFeatureDto,
  ) {
    return this.adminService.toggleBountyFeature(params.id, dto.isFeatured);
  }

  @Patch('bounties/:id')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Admin update bounty' })
  @ApiOkResponse({ description: 'Bounty updated' })
  updateBounty(@Param() params: IdParamDto, @Body() dto: UpdateBountyDto) {
    return this.adminService.adminUpdateBounty(params.id, dto);
  }

  @Delete('bounties/:id')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Admin delete bounty' })
  @ApiOkResponse({ type: AdminActionResponseDto })
  deleteBounty(@Param() params: IdParamDto) {
    return this.adminService.adminDeleteBounty(params.id);
  }

  @Get('projects/stats')
  @ApiOperation({ summary: 'Project management stats' })
  @ApiOkResponse({ description: 'Project stats summary' })
  getProjectStats() {
    return this.adminService.getProjectStats();
  }

  @Get('projects')
  @ApiOperation({ summary: 'List projects with admin filters and pagination' })
  @ApiOkResponse({ description: 'Paginated projects list' })
  listProjects(@Query() query: AdminProjectQueryDto) {
    return this.adminService.listProjects(query);
  }

  @Patch('projects/:id/feature')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Set/remove featured flag on project' })
  @ApiOkResponse({ description: 'Project feature flag updated' })
  toggleProjectFeature(
    @Param() params: IdParamDto,
    @Body() dto: ToggleFeatureDto,
  ) {
    return this.adminService.toggleProjectFeature(params.id, dto.isFeatured);
  }

  @Patch('projects/:id')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Admin update project' })
  @ApiOkResponse({ description: 'Project updated' })
  updateProject(@Param() params: IdParamDto, @Body() dto: UpdateProjectDto) {
    return this.adminService.adminUpdateProject(params.id, dto);
  }

  @Delete('projects/:id')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Admin delete project' })
  @ApiOkResponse({ type: AdminActionResponseDto })
  deleteProject(@Param() params: IdParamDto) {
    return this.adminService.adminDeleteProject(params.id);
  }

  @Get('payouts/stats')
  @ApiOperation({ summary: 'Payout management stats' })
  @ApiOkResponse({ description: 'Payout stats summary' })
  getPayoutStats() {
    return this.adminService.getPayoutStats();
  }

  @Get('payouts')
  @ApiOperation({ summary: 'List payouts with admin filters and pagination' })
  @ApiOkResponse({ description: 'Paginated payouts list' })
  listPayouts(@Query() query: AdminPayoutQueryDto) {
    return this.adminService.listPayouts(query);
  }

  @Post('payouts/:id/retry')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Retry failed payout' })
  @ApiOkResponse({ description: 'Payout retry attempted' })
  retryPayout(@Param() params: IdParamDto) {
    return this.adminService.retryPayout(params.id);
  }

  @Get('hackathons/stats')
  @ApiOperation({ summary: 'Hackathon management stats' })
  @ApiOkResponse({ description: 'Hackathon stats summary' })
  getHackathonStats() {
    return this.adminService.getHackathonStats();
  }

  @Get('hackathons')
  @ApiOperation({
    summary: 'List hackathons with admin filters and pagination',
  })
  @ApiOkResponse({ description: 'Paginated hackathons list' })
  listHackathons(@Query() query: AdminHackathonQueryDto) {
    return this.adminService.listHackathons(query);
  }

  @Post('hackathons')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Create hackathon as admin' })
  @ApiOkResponse({ description: 'Hackathon created' })
  createHackathon(@Body() dto: AdminCreateHackathonDto) {
    return this.adminService.createHackathon(dto.ownerId, dto.payload);
  }

  @Patch('hackathons/:id')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Update hackathon as admin' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        title: 'Updated Hackathon Title',
        description: 'Updated description',
      },
    },
  })
  @ApiOkResponse({ description: 'Hackathon updated' })
  updateHackathon(
    @Param() params: IdParamDto,
    @Body() payload: Record<string, any>,
  ) {
    return this.adminService.updateHackathon(params.id, payload);
  }

  @Delete('hackathons/:id')
  @UseGuards(AdminStepUpGuard)
  @ApiOperation({ summary: 'Delete hackathon as admin' })
  @ApiOkResponse({ type: AdminActionResponseDto })
  deleteHackathon(@Param() params: IdParamDto) {
    return this.adminService.deleteHackathon(params.id);
  }
}
