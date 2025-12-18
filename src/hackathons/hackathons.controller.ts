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
import { HackathonStatus } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { MFAGuard } from 'src/common/guards/mfa.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OwnerGuard } from '../common/guards/owner.guard';
import { CreateHackathonDto } from './dto/create-hackathon.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { JudgeSubmissionDto } from './dto/judge-submission.dto';
import { HackathonSelectWinnersDto } from './dto/select-winners.dto';
import { UpdateHackathonDto } from './dto/update-hackathon.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { HackathonsService } from './hackathons.service';

@ApiTags('Hackathons')
@Controller('hackathons')
export class HackathonsController {
  constructor(private readonly hackathonsService: HackathonsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create hackathon',
    description: 'Create a new hackathon (requires project owner role)',
  })
  @ApiResponse({ status: 201, description: 'Hackathon created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires owner role' })
  createHackathon(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateHackathonDto,
  ) {
    return this.hackathonsService.createHackathon(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get hackathons',
    description: 'Retrieve hackathons with optional filters',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: HackathonStatus,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'ownerId',
    required: false,
    description: 'Filter by owner ID',
  })
  @ApiResponse({ status: 200, description: 'List of hackathons' })
  getHackathons(
    @Query('status') status?: HackathonStatus,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.hackathonsService.getHackathons({ status, ownerId });
  }

  @Get(':identifier')
  @ApiOperation({
    summary: 'Get hackathon',
    description: 'Retrieve hackathon by ID or slug',
  })
  @ApiParam({ name: 'identifier', description: 'Hackathon ID or slug' })
  @ApiResponse({ status: 200, description: 'Hackathon details' })
  @ApiResponse({ status: 404, description: 'Hackathon not found' })
  getHackathon(@Param('identifier') identifier: string) {
    return this.hackathonsService.getHackathon(identifier);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update hackathon',
    description: 'Update hackathon details (only by owner)',
  })
  @ApiParam({ name: 'id', description: 'Hackathon ID' })
  @ApiResponse({ status: 200, description: 'Hackathon updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Hackathon not found' })
  updateHackathon(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateHackathonDto,
  ) {
    return this.hackathonsService.updateHackathon(id, userId, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Publish hackathon',
    description: 'Publish a draft hackathon to make it active',
  })
  @ApiParam({ name: 'id', description: 'Hackathon ID' })
  @ApiResponse({ status: 200, description: 'Hackathon published successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  publishHackathon(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.hackathonsService.publishHackathon(id, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete hackathon',
    description: 'Delete a hackathon (only by owner)',
  })
  @ApiParam({ name: 'id', description: 'Hackathon ID' })
  @ApiResponse({ status: 200, description: 'Hackathon deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  deleteHackathon(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.hackathonsService.deleteHackathon(id, userId);
  }

  @Post('submissions')
  @UseGuards(JwtAuthGuard, MFAGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create submission',
    description: 'Submit a project to a hackathon (requires MFA)',
  })
  @ApiResponse({ status: 201, description: 'Submission created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'MFA required' })
  createSubmission(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.hackathonsService.createSubmission(userId, dto);
  }

  @Get(':hackathonId/submissions')
  @ApiOperation({
    summary: 'Get hackathon submissions',
    description: 'Retrieve all submissions for a hackathon',
  })
  @ApiParam({ name: 'hackathonId', description: 'Hackathon ID' })
  @ApiQuery({
    name: 'trackId',
    required: false,
    description: 'Filter by track ID',
  })
  @ApiResponse({ status: 200, description: 'List of submissions' })
  getSubmissions(
    @Param('hackathonId') hackathonId: string,
    @Query('trackId') trackId?: string,
  ) {
    return this.hackathonsService.getSubmissions(hackathonId, trackId);
  }

  @Get('submissions/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my submissions',
    description: 'Retrieve submissions created by the authenticated user',
  })
  @ApiQuery({
    name: 'hackathonId',
    required: false,
    description: 'Filter by hackathon ID',
  })
  @ApiResponse({ status: 200, description: 'List of user submissions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMySubmissions(
    @CurrentUser('id') userId: string,
    @Query('hackathonId') hackathonId?: string,
  ) {
    return this.hackathonsService.getUserSubmissions(userId, hackathonId);
  }

  @Patch('submissions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update submission',
    description: 'Update a hackathon submission (only by submitter)',
  })
  @ApiParam({ name: 'id', description: 'Submission ID' })
  @ApiResponse({ status: 200, description: 'Submission updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  updateSubmission(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSubmissionDto,
  ) {
    return this.hackathonsService.updateSubmission(id, userId, dto);
  }

  @Delete('submissions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete submission',
    description: 'Delete a hackathon submission (only by submitter)',
  })
  @ApiParam({ name: 'id', description: 'Submission ID' })
  @ApiResponse({ status: 200, description: 'Submission deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  deleteSubmission(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.hackathonsService.deleteSubmission(id, userId);
  }

  @Post('submissions/:id/judge')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Judge submission',
    description:
      'Score and provide feedback on a submission (only by hackathon owner)',
  })
  @ApiParam({ name: 'id', description: 'Submission ID' })
  @ApiResponse({ status: 200, description: 'Submission judged successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  judgeSubmission(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: JudgeSubmissionDto,
  ) {
    return this.hackathonsService.judgeSubmission(id, userId, dto);
  }

  @Post(':id/winners')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Select winners',
    description: 'Select and announce hackathon winners (only by owner)',
  })
  @ApiParam({ name: 'id', description: 'Hackathon ID' })
  @ApiResponse({ status: 200, description: 'Winners selected successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  selectWinners(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: HackathonSelectWinnersDto,
  ) {
    return this.hackathonsService.selectWinners(id, userId, dto);
  }

  @Get(':hackathonId/winners')
  @ApiOperation({
    summary: 'Get winners',
    description: 'Retrieve hackathon winners',
  })
  @ApiParam({ name: 'hackathonId', description: 'Hackathon ID' })
  @ApiQuery({
    name: 'trackId',
    required: false,
    description: 'Filter by track ID',
  })
  @ApiResponse({ status: 200, description: 'List of winners' })
  getWinners(
    @Param('hackathonId') hackathonId: string,
    @Query('trackId') trackId?: string,
  ) {
    return this.hackathonsService.getWinners(hackathonId, trackId);
  }
}
