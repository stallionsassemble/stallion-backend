import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { IdParamDto } from '../common/dto/id-param.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

import { CreateHackathonDto } from './dto/create-hackathon.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { GetHackathonsQueryDto } from './dto/get-hackathons-query.dto';
import { GetSubmissionsQueryDto } from './dto/get-submissions-query.dto';
import { HackathonIdentifierParamDto } from './dto/identifier-param.dto';
import { SelectWinnerDto } from './dto/select-winner.dto';
import { UpdateHackathonDto } from './dto/update-hackathon.dto';

import { HackathonsService } from './hackathons.service';
import { HackathonJudgingService } from './services/hackathon-judging.service';
import { HackathonSubmissionsService } from './services/hackathon-submissions.service';
import { HackathonTeamsService } from './services/hackathon-teams.service';

@ApiTags('Hackathons')
@Controller('hackathons')
export class HackathonsController {
  constructor(
    private readonly hackathonsService: HackathonsService,
    private readonly submissionsService: HackathonSubmissionsService,
    private readonly judgingService: HackathonJudgingService,
    private readonly teamsService: HackathonTeamsService,
  ) {}

  // --- Admin Endpoints ---
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create hackathon (Admin only)' })
  createHackathon(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateHackathonDto,
  ) {
    return this.hackathonsService.createHackathon(adminId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update hackathon (Admin only)' })
  updateHackathon(
    @Param() params: IdParamDto,
    @CurrentUser('id') adminId: string,
    @Body() dto: UpdateHackathonDto,
  ) {
    return this.hackathonsService.updateHackathon(params.id, adminId, dto);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cancel hackathon (Admin only)' })
  cancelHackathon(
    @Param() params: IdParamDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.hackathonsService.cancelHackathon(params.id, adminId);
  }

  // --- Public Endpoints ---

  @Get()
  @ApiOperation({ summary: 'Get hackathons list' })
  getHackathons(@Query() query: GetHackathonsQueryDto) {
    return this.hackathonsService.getHackathons(query);
  }

  @Get(':identifier')
  @ApiOperation({ summary: 'Get hackathon details' })
  getHackathon(@Param() params: HackathonIdentifierParamDto) {
    return this.hackathonsService.getHackathonByIdentifier(params.identifier);
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'Get submissions for a hackathon' })
  getSubmissions(
    @Param() params: IdParamDto,
    @Query() query: GetSubmissionsQueryDto,
  ) {
    return this.submissionsService.getSubmissions(params.id, query);
  }

  // --- Participant Endpoints ---

  @Post(':id/participate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Join hackathon as participant' })
  participate(@Param() params: IdParamDto, @CurrentUser('id') userId: string) {
    return this.submissionsService.participate(userId, params.id);
  }

  @Post(':id/teams')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a team for a team-based hackathon' })
  createTeam(
    @Param() params: IdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamsService.createTeam(userId, params.id, dto.name);
  }

  @Post(':id/teams/:teamId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Join an existing team' })
  joinTeam(
    @Param('id') hackathonId: string,
    @Param('teamId') teamId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.teamsService.joinTeam(userId, hackathonId, teamId);
  }

  @Post(':id/teams/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Leave your current team' })
  leaveTeam(
    @Param('id') hackathonId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.teamsService.leaveTeam(userId, hackathonId);
  }

  @Post(':id/submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Submit a project' })
  submitProject(
    @Param() params: IdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.submissionsService.createSubmission(userId, {
      ...dto,
      hackathonId: params.id,
    });
  }

  // --- Display / Judging (Project Owner) Endpoints ---

  @Post(':id/manage/submissions/:sid/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_OWNER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Set submission status to IN_REVIEW' })
  reviewSubmission(
    @Param('id') hackathonId: string,
    @Param('sid') submissionId: string,
    @CurrentUser('id') companyId: string,
  ) {
    return this.judgingService.setInReview(
      hackathonId,
      companyId,
      submissionId,
    );
  }

  @Post(':id/manage/submissions/:sid/select-winner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_OWNER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Select submission as winner' })
  selectWinner(
    @Param('id') hackathonId: string,
    @Param('sid') submissionId: string,
    @CurrentUser('id') companyId: string,
    @Body() dto: SelectWinnerDto,
  ) {
    return this.judgingService.selectWinner(
      hackathonId,
      companyId,
      submissionId,
      dto.position,
      dto.feedback,
    );
  }

  @Post(':id/manage/submissions/:sid/remove-winner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_OWNER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove winner status' })
  removeWinner(
    @Param('id') hackathonId: string,
    @Param('sid') submissionId: string,
    @CurrentUser('id') companyId: string,
  ) {
    return this.judgingService.removeWinner(
      hackathonId,
      companyId,
      submissionId,
    );
  }

  @Post(':id/manage/publish-results')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_OWNER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Publish results and trigger prize distribution' })
  publishResults(
    @Param('id') hackathonId: string,
    @CurrentUser('id') companyId: string,
  ) {
    return this.judgingService.publishResults(hackathonId, companyId);
  }
}
