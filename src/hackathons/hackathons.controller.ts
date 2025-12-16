import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
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

@Controller('hackathons')
export class HackathonsController {
  constructor(private readonly hackathonsService: HackathonsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, OwnerGuard)
  createHackathon(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateHackathonDto,
  ) {
    return this.hackathonsService.createHackathon(userId, dto);
  }

  @Get()
  getHackathons(
    @Query('status') status?: HackathonStatus,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.hackathonsService.getHackathons({ status, ownerId });
  }

  @Get(':identifier')
  getHackathon(@Param('identifier') identifier: string) {
    return this.hackathonsService.getHackathon(identifier);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  updateHackathon(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateHackathonDto,
  ) {
    return this.hackathonsService.updateHackathon(id, userId, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  publishHackathon(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.hackathonsService.publishHackathon(id, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  deleteHackathon(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.hackathonsService.deleteHackathon(id, userId);
  }

  @Post('submissions')
  @UseGuards(JwtAuthGuard, MFAGuard)
  createSubmission(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.hackathonsService.createSubmission(userId, dto);
  }

  @Get(':hackathonId/submissions')
  getSubmissions(
    @Param('hackathonId') hackathonId: string,
    @Query('trackId') trackId?: string,
  ) {
    return this.hackathonsService.getSubmissions(hackathonId, trackId);
  }

  @Get('submissions/my')
  @UseGuards(JwtAuthGuard)
  getMySubmissions(
    @CurrentUser('id') userId: string,
    @Query('hackathonId') hackathonId?: string,
  ) {
    return this.hackathonsService.getUserSubmissions(userId, hackathonId);
  }

  @Put('submissions/:id')
  @UseGuards(JwtAuthGuard)
  updateSubmission(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSubmissionDto,
  ) {
    return this.hackathonsService.updateSubmission(id, userId, dto);
  }

  @Delete('submissions/:id')
  @UseGuards(JwtAuthGuard)
  deleteSubmission(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.hackathonsService.deleteSubmission(id, userId);
  }

  @Post('submissions/:id/judge')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  judgeSubmission(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: JudgeSubmissionDto,
  ) {
    return this.hackathonsService.judgeSubmission(id, userId, dto);
  }

  @Post(':id/winners')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  selectWinners(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: HackathonSelectWinnersDto,
  ) {
    return this.hackathonsService.selectWinners(id, userId, dto);
  }

  @Get(':hackathonId/winners')
  getWinners(
    @Param('hackathonId') hackathonId: string,
    @Query('trackId') trackId?: string,
  ) {
    return this.hackathonsService.getWinners(hackathonId, trackId);
  }
}
