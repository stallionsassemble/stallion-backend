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
import { ProjectStatus, ProjectType, Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ActivitiesService } from '../activities/activities.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { ProfileCompleteGuard } from '../common/guards/profile-complete.guard';
import { ApplicationIdParamDto } from './dto/application-id-param.dto';
import { ApplyToProjectDto } from './dto/apply-to-project.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { GetMyMilestonesQueryDto } from './dto/get-my-milestones-query.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { MilestoneIdParamDto } from './dto/milestone-id-param.dto';
import { ProjectIdParamDto } from './dto/project-id-param.dto';
import {
  ActivityResponseDto,
  ApplicationResponseDto,
  MilestoneResponseDto,
  ProjectResponseDto,
} from './dto/project-response.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { ReviewMilestoneDto } from './dto/review-milestone.dto';
import { SubmitMilestoneDto } from './dto/submit-milestone.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectApplicationsService } from './project-applications.service';
import { ProjectMilestonesService } from './project-milestones.service';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly applicationsService: ProjectApplicationsService,
    private readonly milestonesService: ProjectMilestonesService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'List all projects',
    description:
      'Get a list of projects with optional filters. Authentication is optional - if provided, includes applied field.',
  })
  @ApiQuery({ name: 'type', enum: ProjectType, required: false })
  @ApiQuery({ name: 'status', enum: ProjectStatus, required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Projects retrieved successfully',
    type: [ProjectResponseDto],
    schema: {
      example: [
        {
          id: 'project-uuid',
          title: 'Build a DeFi Dashboard',
          shortDescription: 'Create a comprehensive DeFi analytics dashboard',
          status: 'OPEN',
          type: 'GIG',
          reward: '5000',
          currency: 'USDC',
          peopleNeeded: 1,
          acceptedCount: 0,
          deadline: '2024-03-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          applied: true,
          projectProgress: 0,
          owner: {
            id: 'owner-uuid',
            username: 'project_owner',
            firstName: 'John',
            lastName: 'Doe',
            companyName: 'Tech Corp',
            profilePicture: 'https://example.com/profile.jpg',
            totalPaid: '25000',
            totalBounties: 15,
            totalProjects: 8,
          },
        },
      ],
    },
  })
  async listProjects(
    @Query() query: ListProjectsQueryDto,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.projectsService.listProjects(query, currentUserId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get project details',
    description:
      'Get detailed information about a specific project including milestones and winner. Authentication is optional - if provided, includes applied field.',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project retrieved successfully',
    type: ProjectResponseDto,
    schema: {
      example: {
        id: 'project-uuid',
        title: 'Build a DeFi Dashboard',
        shortDescription: 'Create a comprehensive DeFi analytics dashboard',
        description: 'We need a full-featured DeFi dashboard that tracks...',
        requirements: ['React expertise', 'Web3 experience'],
        deliverables: ['Responsive web app', 'Documentation'],
        skills: ['React', 'TypeScript', 'Web3'],
        reward: '5000',
        currency: 'USDC',
        deadline: '2024-03-01T00:00:00.000Z',
        status: 'IN_PROGRESS',
        type: 'GIG',
        peopleNeeded: 1,
        acceptedCount: 1,
        contractProjectId: 123,
        txHash: '0xabc123...',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        ownerId: 'owner-uuid',
        applied: true,
        released: '2000',
        escrowed: '3000',
        winner: {
          userId: 'winner-uuid',
          username: 'dev_jane',
          firstName: 'Jane',
          lastName: 'Smith',
          profilePicture: 'https://example.com/jane.jpg',
          acceptedAt: '2024-01-10T14:30:00.000Z',
        },
        owner: {
          id: 'owner-uuid',
          username: 'project_owner',
          firstName: 'John',
          lastName: 'Doe',
          companyName: 'Tech Corp',
          profilePicture: 'https://example.com/profile.jpg',
          totalPaid: '25000',
          totalBounties: 15,
          totalProjects: 8,
        },
        projectProgress: 50,
        milestones: [
          {
            id: 'milestone-1',
            title: 'UI Design & Setup',
            description: 'Create the initial UI mockups and project setup',
            amount: '2000',
            dueDate: '2024-02-01T00:00:00.000Z',
            status: 'COMPLETED',
            order: 1,
            submittedAt: '2024-01-28T10:00:00.000Z',
            reviewedAt: '2024-01-29T15:00:00.000Z',
            paidAt: '2024-01-30T09:00:00.000Z',
            txHash: '0xdef456...',
            contributorId: 'winner-uuid',
            contributor: {
              id: 'winner-uuid',
              username: 'dev_jane',
              firstName: 'Jane',
              lastName: 'Smith',
              profilePicture: 'https://example.com/jane.jpg',
            },
          },
          {
            id: 'milestone-2',
            title: 'Backend Integration',
            description: 'Integrate with DeFi protocols',
            amount: '3000',
            dueDate: '2024-02-15T00:00:00.000Z',
            status: 'IN_PROGRESS',
            order: 2,
            contributorId: 'winner-uuid',
            contributor: {
              id: 'winner-uuid',
              username: 'dev_jane',
              firstName: 'Jane',
              lastName: 'Smith',
              profilePicture: 'https://example.com/jane.jpg',
            },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProject(
    @Param() params: ProjectIdParamDto,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.projectsService.getProject(params.id, currentUserId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.PROJECT_OWNER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new project',
    description:
      'Create a GIG or JOB project. Only accessible by project owners. Requires a complete profile.',
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

  @Patch(':id')
  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.PROJECT_OWNER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update a project',
    description:
      'Update project details. Only accessible by the project owner. Only OPEN projects can be updated. Requires a complete profile.',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project updated successfully',
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - validation failed or project not in OPEN status',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the project owner',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async updateProject(
    @Param() params: ProjectIdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(params.id, userId, dto);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.PROJECT_OWNER)
  @ApiBearerAuth('JWT-auth')
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
    @Param() params: ProjectIdParamDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.cancelProject(params.id, userId);
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Apply to project',
    description:
      'Submit an application to a project. Requires a complete profile.',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 201,
    description: 'Application submitted successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not a contributor' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async applyToProject(
    @Param() params: ProjectIdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyToProjectDto,
  ) {
    return this.applicationsService.applyToProject(userId, params.id, dto);
  }

  @Patch('applications/:applicationId')
  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update project application',
    description:
      'Update an existing application (only before deadline and if not reviewed)',
  })
  @ApiParam({ name: 'applicationId', description: 'Application ID' })
  @ApiResponse({
    status: 200,
    description: 'Application updated successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - deadline passed or already reviewed',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not your application' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async updateApplication(
    @Param() params: ApplicationIdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyToProjectDto,
  ) {
    return this.applicationsService.updateApplication(
      params.applicationId,
      userId,
      dto,
    );
  }

  @Get(':id/applications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  async getProjectApplications(@Param() params: ProjectIdParamDto) {
    return this.applicationsService.getApplicationsByProject(params.id);
  }

  @Get('applications/me')
  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiBearerAuth('JWT-auth')
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

  @Get(':id/applications/accepted')
  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.PROJECT_OWNER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get accepted applications for a project',
    description:
      'Get all accepted applications for a specific project. Only accessible by the project owner.',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Accepted applications retrieved successfully',
    type: [ApplicationResponseDto],
    schema: {
      example: [
        {
          id: 'application-uuid',
          coverLetter: 'I am excited to work on this project...',
          estimatedCompletionTime: 30,
          portfolioLinks: ['https://github.com/user/project'],
          status: 'ACCEPTED',
          createdAt: '2024-01-05T10:00:00.000Z',
          updatedAt: '2024-01-10T14:30:00.000Z',
          projectId: 'project-uuid',
          userId: 'user-uuid',
          user: {
            id: 'user-uuid',
            username: 'dev_jane',
            firstName: 'Jane',
            lastName: 'Smith',
            profilePicture: 'https://example.com/jane.jpg',
            skills: ['React', 'TypeScript', 'Web3'],
            bio: 'Full-stack developer with 5 years experience',
          },
          userMilestones: [
            {
              id: 'user-milestone-1',
              status: 'PAID',
              submissionNote: 'Completed UI design',
              submittedAt: '2024-01-28T10:00:00.000Z',
              paidAt: '2024-01-30T09:00:00.000Z',
              milestone: {
                id: 'milestone-1',
                title: 'UI Design & Setup',
                description: 'Create the initial UI mockups',
                amount: '2000',
                dueDate: '2024-02-01T00:00:00.000Z',
                order: 1,
              },
            },
            {
              id: 'user-milestone-2',
              status: 'IN_PROGRESS',
              milestone: {
                id: 'milestone-2',
                title: 'Backend Integration',
                description: 'Integrate with DeFi protocols',
                amount: '3000',
                dueDate: '2024-02-15T00:00:00.000Z',
                order: 2,
              },
            },
          ],
        },
      ],
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the project owner',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getAcceptedApplications(
    @Param() params: ProjectIdParamDto,
    @CurrentUser('id') ownerId: string,
  ) {
    return this.applicationsService.getAcceptedApplicationsByProject(
      params.id,
      ownerId,
    );
  }

  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.PROJECT_OWNER)
  @ApiBearerAuth('JWT-auth')
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
    @Param() params: ApplicationIdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.applicationsService.reviewApplication(
      params.applicationId,
      userId,
      dto.status,
      dto.rejectionReason,
    );
  }

  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiBearerAuth('JWT-auth')
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
    @Param() params: ApplicationIdParamDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.applicationsService.withdrawApplication(
      params.applicationId,
      userId,
    );
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
  async getProjectMilestones(@Param() params: ProjectIdParamDto) {
    return this.milestonesService.getMilestonesByProject(params.id);
  }

  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR, Role.PROJECT_OWNER)
  @ApiBearerAuth('JWT-auth')
  @Get('milestones/me')
  @ApiOperation({
    summary: 'Get my milestones',
    description:
      'Get all milestones assigned to the current user, optionally filtered by project',
  })
  @ApiResponse({
    status: 200,
    description: 'Milestones retrieved successfully',
    type: [MilestoneResponseDto],
  })
  async getMyMilestones(
    @Query() query: GetMyMilestonesQueryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.milestonesService.getUserMilestonesByContributor(
      userId,
      query.projectId,
    );
  }

  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiBearerAuth('JWT-auth')
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
    @Param() params: MilestoneIdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitMilestoneDto,
  ) {
    return this.milestonesService.submitMilestone(params.id, userId, dto);
  }

  @UseGuards(JwtAuthGuard, ProfileCompleteGuard, RolesGuard)
  @Roles(Role.PROJECT_OWNER)
  @ApiBearerAuth('JWT-auth')
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
    @Param() params: MilestoneIdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewMilestoneDto,
  ) {
    return this.milestonesService.reviewMilestone(
      params.id,
      userId,
      dto.approve,
      dto.reviewNote,
      dto.revisionNote,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('applications/:applicationId/milestones')
  @ApiOperation({
    summary: 'Get milestones for an approved application',
    description:
      'Get all milestones for an approved application. Only accessible by the project owner.',
  })
  @ApiParam({ name: 'applicationId', description: 'Application ID' })
  @ApiResponse({
    status: 200,
    description: 'Milestones retrieved successfully',
    type: [MilestoneResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Application not accepted' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the project owner',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getApplicationMilestones(
    @Param() params: ApplicationIdParamDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.milestonesService.getMilestonesByApplication(
      params.applicationId,
      userId,
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
  async getProjectActivities(@Param() params: ProjectIdParamDto) {
    return this.activitiesService.getProjectActivities(params.id);
  }
}
