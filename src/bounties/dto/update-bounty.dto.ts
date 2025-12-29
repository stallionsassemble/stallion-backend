import { PartialType } from '@nestjs/swagger';
import { CreateBountyDto } from './create-bounty.dto';

export class UpdateBountyDto extends PartialType(CreateBountyDto) {}
