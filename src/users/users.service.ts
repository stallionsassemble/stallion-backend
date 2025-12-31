import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { SanitizedUser, sanitizeUser } from 'src/common/utils/user.util';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateContributorProfileDto } from './dto/update-contributor-profile.dto';
import { UpdateProjectOwnerProfileDto } from './dto/update-project-owner-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userPoints: true,
        wallet: true,
      },
    });
  }

  /**
   * Update contributor profile
   */
  async updateContributorProfile(
    userId: string,
    dto: UpdateContributorProfileDto,
  ): Promise<SanitizedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== Role.CONTRIBUTOR) {
      throw new BadRequestException(
        'Only contributors can update contributor profile',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        location: dto.location,
        skills: dto.skills,
        profilePicture: dto.profilePicture,
        socials: dto.socials,
      },
    });

    return sanitizeUser(updatedUser);
  }

  /**
   * Update project owner profile
   */
  async updateProjectOwnerProfile(
    userId: string,
    dto: UpdateProjectOwnerProfileDto,
  ): Promise<SanitizedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== Role.PROJECT_OWNER) {
      throw new BadRequestException(
        'Only project owners can update project owner profile',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        companyName: dto.companyName,
        entityName: dto.entityName,
        phoneNumber: dto.phoneNumber,
        industry: dto.industry,
        companyBio: dto.companyBio,
        companyLogo: dto.companyLogo,
        location: dto.location,
        skills: dto.skills,
        profilePicture: dto.profilePicture,
        socials: dto.socials,
      },
    });

    return sanitizeUser(updatedUser);
  }
}
