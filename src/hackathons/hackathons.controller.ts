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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IdParamDto } from 'src/common/dto/id-param.dto';
import { MFAGuard } from 'src/common/guards/mfa.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OwnerGuard } from '../common/guards/owner.guard';
import { CreateHackathonDto } from './dto/create-hackathon.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { GetHackathonsQueryDto } from './dto/get-hackathons-query.dto';
import { GetSubmissionsQueryDto } from './dto/get-submissions-query.dto';
import { HackathonIdParamDto } from './dto/hackathon-id-param.dto';
import { HackathonIdentifierParamDto } from './dto/identifier-param.dto';
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
  @ApiResponse({ status: 200, description: 'List of hackathons' })
  getHackathons(@Query() query: GetHackathonsQueryDto) {
    return this.hackathonsService.getHackathons({
      status: query.status,
      ownerId: query.ownerId,
    });
  }

  @Get(':identifier')
  @ApiOperation({
    summary: 'Get hackathon',
    description: 'Retrieve hackathon by ID or slug',
  })
  @ApiParam({ name: 'identifier', description: 'Hackathon ID or slug' })
  @ApiResponse({ status: 200, description: 'Hackathon details' })
  @ApiResponse({ status: 404, description: 'Hackathon not found' })
  getHackathon(@Param() params: HackathonIdentifierParamDto) {
    return this.hackathonsService.getHackathon(params.identifier);
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
    @Param() params: IdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateHackathonDto,
  ) {
    return this.hackathonsService.updateHackathon(params.id, userId, dto);
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
  publishHackathon(
    @Param() params: IdParamDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.hackathonsService.publishHackathon(params.id, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete hackathon',
    description: 'Delete a hackathon (only by owner)',
  })
  @ApiParam({ name: 'id', description: 'Hackathon ID' })
  @ApiResponse({ status: 204, description: 'Hackathon deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  deleteHackathon(
    @Param() params: IdParamDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.hackathonsService.deleteHackathon(params.id, userId);
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
  @ApiResponse({ status: 200, description: 'List of submissions' })
  getSubmissions(
    @Param() params: HackathonIdParamDto,
    @Query() query: GetSubmissionsQueryDto,
  ) {
    return this.hackathonsService.getSubmissions(
      params.hackathonId,
      query.trackId,
    );
  }

  @Get('submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my submissions',
    description: 'Retrieve submissions created by the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'List of user submissions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMySubmissions(
    @CurrentUser('id') userId: string,
    @Query() query: GetSubmissionsQueryDto,
  ) {
    return this.hackathonsService.getUserSubmissions(userId, query.trackId);
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
    @Param() params: IdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSubmissionDto,
  ) {
    return this.hackathonsService.updateSubmission(params.id, userId, dto);
  }

  @Delete('submissions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete submission',
    description: 'Delete a hackathon submission (only by submitter)',
  })
  @ApiParam({ name: 'id', description: 'Submission ID' })
  @ApiResponse({ status: 204, description: 'Submission deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  deleteSubmission(
    @Param() params: IdParamDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.hackathonsService.deleteSubmission(params.id, userId);
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
    @Param() params: IdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: JudgeSubmissionDto,
  ) {
    return this.hackathonsService.judgeSubmission(params.id, userId, dto);
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
    @Param() params: IdParamDto,
    @CurrentUser('id') userId: string,
    @Body() dto: HackathonSelectWinnersDto,
  ) {
    return this.hackathonsService.selectWinners(params.id, userId, dto);
  }

  @Get(':hackathonId/winners')
  @ApiOperation({
    summary: 'Get winners',
    description: 'Retrieve hackathon winners',
  })
  @ApiParam({ name: 'hackathonId', description: 'Hackathon ID' })
  @ApiResponse({ status: 200, description: 'List of winners' })
  getWinners(
    @Param() params: HackathonIdParamDto,
    @Query() query: GetSubmissionsQueryDto,
  ) {
    return this.hackathonsService.getWinners(params.hackathonId, query.trackId);
  }
}
