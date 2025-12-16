import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('Submissions')
@Controller('bounties/:bountyId/submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Submit to bounty',
    description: 'Create a submission for a bounty',
  })
  @ApiParam({ name: 'bountyId', description: 'Bounty ID' })
  @ApiResponse({ status: 201, description: 'Submission created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Bounty not found' })
  create(
    @Param('bountyId') bountyId: string,
    @Body() createSubmissionDto: CreateSubmissionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.submissionsService.create(
      bountyId,
      userId,
      createSubmissionDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List bounty submissions',
    description: 'Get all submissions for a specific bounty',
  })
  @ApiParam({ name: 'bountyId', description: 'Bounty ID' })
  @ApiResponse({ status: 200, description: 'List of submissions' })
  findByBounty(@Param('bountyId') bountyId: string) {
    return this.submissionsService.findByBounty(bountyId);
  }
}
