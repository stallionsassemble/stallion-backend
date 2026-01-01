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
import { ProjectStatus, ProjectType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApplyToProjectDto } from './dto/apply-to-project.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import {
  ActivityResponseDto,
  ApplicationResponseDto,
  MilestoneResponseDto,
  ProjectResponseDto,
} from './dto/project-response.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { ReviewMilestoneDto } from './dto/review-milestone.dto';
import { SubmitMilestoneDto } from './dto/submit-milestone.dto';
import { ProjectActivityService } from './project-activity.service';
import { ProjectApplicationsService } from './project-applications.service';
import { ProjectMilestonesService } from './project-milestones.service';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly applicationsService: ProjectApplicationsService,
    private readonly milestonesService: ProjectMilestonesService,
    private readonly activityService: ProjectActivityService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new project',
    description:
      'Create a GIG or JOB project. Only accessible by project owners.',
  })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a project owner' })
  async createProject(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.createProject(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all projects',
    description: 'Get a list of projects with optional filters',
  })
  @ApiQuery({ name: 'type', enum: ProjectType, required: false })
  @ApiQuery({ name: 'status', enum: ProjectStatus, required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Projects retrieved successfully',
    type: [ProjectResponseDto],
  })
  async listProjects(
    @Query('type') type?: ProjectType,
    @Query('status') status?: ProjectStatus,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.projectsService.listProjects({ type, status, ownerId });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get project details',
    description: 'Get detailed information about a specific project',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project retrieved successfully',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProject(@Param('id') id: string) {
    return this.projectsService.getProject(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a project',
    description: 'Cancel a project. Only accessible by the project owner.',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project cancelled successfully',
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the project owner',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async cancelProject(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.cancelProject(id, userId);
  }

  @Post(':id/apply')
  @ApiOperation({
    summary: 'Apply to a project',
    description:
      'Submit an application to work on a project. Only accessible by contributors.',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 201,
    description: 'Application submitted successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or already applied',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not a contributor' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async applyToProject(
    @Param('id') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyToProjectDto,
  ) {
    return this.applicationsService.applyToProject(userId, projectId, dto);
  }

  @Get(':id/applications')
  @ApiOperation({
    summary: 'Get project applications',
    description: 'Get all applications for a specific project',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Applications retrieved successfully',
    type: [ApplicationResponseDto],
  })
  async getProjectApplications(@Param('id') projectId: string) {
    return this.applicationsService.getApplicationsByProject(projectId);
  }

  @Get('applications/my')
  @ApiOperation({
    summary: 'Get my applications',
    description: 'Get all applications submitted by the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Applications retrieved successfully',
    type: [ApplicationResponseDto],
  })
  async getMyApplications(@CurrentUser('id') userId: string) {
    return this.applicationsService.getApplicationsByUser(userId);
  }

  @Patch('applications/:id/review')
  @ApiOperation({
    summary: 'Review an application',
    description:
      'Accept or reject a project application. Only accessible by the project owner.',
  })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiResponse({
    status: 200,
    description: 'Application reviewed successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the project owner',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async reviewApplication(
    @Param('id') applicationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.applicationsService.reviewApplication(
      applicationId,
      userId,
      dto.status,
      dto.rejectionReason,
    );
  }

  @Delete('applications/:id')
  @ApiOperation({
    summary: 'Withdraw an application',
    description:
      'Withdraw a pending application. Only accessible by the applicant.',
  })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiResponse({
    status: 200,
    description: 'Application withdrawn successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - application not pending',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not your application' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async withdrawApplication(
    @Param('id') applicationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.applicationsService.withdrawApplication(applicationId, userId);
  }

  @Get(':id/milestones')
  @ApiOperation({
    summary: 'Get project milestones',
    description: 'Get all milestones for a specific project (GIG only)',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Milestones retrieved successfully',
    type: [MilestoneResponseDto],
  })
  async getProjectMilestones(@Param('id') projectId: string) {
    return this.milestonesService.getMilestonesByProject(projectId);
  }

  @Get('milestones')
  @ApiOperation({
    summary: 'Get my milestones',
    description: 'Get all milestones assigned to the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Milestones retrieved successfully',
    type: [MilestoneResponseDto],
  })
  async getMyMilestones(@CurrentUser('id') userId: string) {
    return this.milestonesService.getMilestonesByContributor(userId);
  }

  @Post('milestones/:id/submit')
  @ApiOperation({
    summary: 'Submit a milestone',
    description:
      'Submit work for a milestone. Only accessible by the assigned contributor.',
  })
  @ApiParam({ name: 'id', description: 'Milestone ID' })
  @ApiResponse({
    status: 200,
    description: 'Milestone submitted successfully',
    type: MilestoneResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your milestone' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async submitMilestone(
    @Param('id') milestoneId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitMilestoneDto,
  ) {
    return this.milestonesService.submitMilestone(milestoneId, userId, dto);
  }

  @Patch('milestones/:id/review')
  @ApiOperation({
    summary: 'Review a milestone',
    description:
      'Approve or request revision for a milestone. Only accessible by the project owner.',
  })
  @ApiParam({ name: 'id', description: 'Milestone ID' })
  @ApiResponse({
    status: 200,
    description: 'Milestone reviewed successfully',
    type: MilestoneResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the project owner',
  })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async reviewMilestone(
    @Param('id') milestoneId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewMilestoneDto,
  ) {
    return this.milestonesService.reviewMilestone(
      milestoneId,
      userId,
      dto.approve,
      dto.reviewNote,
      dto.revisionNote,
    );
  }

  @Get(':id/activities')
  @ApiOperation({
    summary: 'Get project activity timeline',
    description: 'Get the activity timeline for a specific project',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Activities retrieved successfully',
    type: [ActivityResponseDto],
  })
  async getProjectActivities(@Param('id') projectId: string) {
    return this.activityService.getProjectActivities(projectId);
  }
}
