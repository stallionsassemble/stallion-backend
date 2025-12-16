import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

@Module({
  imports: [PrismaModule],
  controllers: [ForumController],
  providers: [ForumService],
  exports: [ForumService],
})
export class ForumModule {}
