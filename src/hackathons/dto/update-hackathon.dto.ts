import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateHackathonDto } from './create-hackathon.dto';

export class UpdateHackathonDto extends PartialType(
  OmitType(CreateHackathonDto, ['payoutMode'] as const),
) {}
