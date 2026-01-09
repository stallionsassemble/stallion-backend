import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Bounty,
  BountySubmission,
  Project,
  ProjectApplication,
  Role,
} from '@prisma/client';
import { calculateUserTotalEarnings } from 'src/common/utils/user-earnings.util';
import { SanitizedUser, sanitizeUser } from 'src/common/utils/user.util';
import { PrismaService } from '../common/prisma/prisma.service';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
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
   * Get public user profile by username or ID (unauthenticated)
   */
  async getPublicProfile(identifier: string): Promise<PublicUserProfileDto> {
    // Try to find by username first, then by ID
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { id: identifier }],
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        role: true,
        skills: true,
        profilePicture: true,
        companyName: true,
        companyBio: true,
        companyLogo: true,
        industry: true,
        createdAt: true,
      },
    });

    if (!user || !user.username) {
      throw new NotFoundException('User not found');
    }

    // Calculate additional statistics
    const [
      bountySubmissionsCount,
      projectApplicationsCount,
      bountyWinsCount,
      acceptedProjectsCount,
      totalEarnings,
    ] = await Promise.all([
      this.prisma.bountySubmission.count({
        where: { userId: user.id },
      }),
      this.prisma.projectApplication.count({
        where: { userId: user.id },
      }),
      this.prisma.bountyWinner.count({
        where: { userId: user.id },
      }),
      this.prisma.projectApplication.count({
        where: { userId: user.id, status: 'ACCEPTED' },
      }),
      calculateUserTotalEarnings(this.prisma, user.id),
    ]);

    const totalSubmissions = bountySubmissionsCount + projectApplicationsCount;
    const totalWon = bountyWinsCount + acceptedProjectsCount;

    return {
      ...user,
      totalEarnings,
      totalSubmissions,
      totalWon,
    } as PublicUserProfileDto;
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
        bio: dto.bio,
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
        bio: dto.bio,
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

  /**
   * Create a review for another user
   */
  async createReview(
    reviewerId: string,
    reviewedUserId: string,
    rating: number,
    message: string,
  ) {
    if (reviewerId === reviewedUserId) {
      throw new BadRequestException('Cannot review yourself');
    }

    const reviewedUser = await this.prisma.user.findUnique({
      where: { id: reviewedUserId },
    });

    if (!reviewedUser) {
      throw new NotFoundException('User not found');
    }

    // Check if review already exists
    const existingReview = await this.prisma.userReview.findUnique({
      where: {
        reviewerId_reviewedUserId: {
          reviewerId,
          reviewedUserId,
        },
      },
    });

    if (existingReview) {
      // Update existing review
      return this.prisma.userReview.update({
        where: { id: existingReview.id },
        data: { rating, message },
        include: {
          reviewer: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
              role: true,
            },
          },
        },
      });
    }

    // Create new review
    return this.prisma.userReview.create({
      data: {
        reviewerId,
        reviewedUserId,
        rating,
        message,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Get reviews for a user
   */
  async getUserReviews(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const reviews = await this.prisma.userReview.findMany({
      where: { reviewedUserId: userId },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            role: true,
            location: true,
            skills: true,
            socials: true,
            companyName: true,
            companyLogo: true,
            companyBio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate average rating
    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        : 0;

    return {
      reviews,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length,
    };
  }

  /**
   * Get average rating for a user
   */
  async getUserAverageRating(userId: string): Promise<number> {
    const result = await this.prisma.userReview.aggregate({
      where: { reviewedUserId: userId },
      _avg: { rating: true },
      _count: true,
    });

    return result._avg.rating || 0;
  }

  /**
   * Get all user submissions (bounty + project) with pagination, filtering, and sorting
   */
  async getAllSubmissions(
    userId: string,
    query: {
      page?: number;
      limit?: number;
      type?: 'bounty' | 'project' | 'all';
      status?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const sortOrder = query.sortOrder || 'desc';

    const allSubmissions: ((
      | (BountySubmission & {
          type: 'bounty';
          bounty: Pick<
            Bounty,
            | 'id'
            | 'title'
            | 'shortDescription'
            | 'reward'
            | 'rewardCurrency'
            | 'status'
            | 'submissionDeadline'
          >;
        })
      | (ProjectApplication & {
          type: 'project';
          project: Pick<
            Project,
            | 'id'
            | 'title'
            | 'shortDescription'
            | 'reward'
            | 'currency'
            | 'status'
            | 'deadline'
            | 'type'
          >;
        })
    ) & {
      type: 'bounty' | 'project';
    })[] = [];

    // Fetch bounty submissions if needed
    if (query.type === 'bounty' || query.type === 'all') {
      const bountyWhere: any = { userId };
      if (query.status) bountyWhere.status = query.status;
      if (query.search) {
        bountyWhere.bounty = {
          title: { contains: query.search, mode: 'insensitive' },
        };
      }

      const bountySubmissions = await this.prisma.bountySubmission.findMany({
        where: bountyWhere,
        include: {
          bounty: {
            select: {
              id: true,
              title: true,
              shortDescription: true,
              reward: true,
              rewardCurrency: true,
              status: true,
              submissionDeadline: true,
            },
          },
        },
      });

      allSubmissions.push(
        ...bountySubmissions.map((sub) => ({
          type: 'bounty' as const,
          ...sub,
        })),
      );
    }

    // Fetch project applications if needed
    if (query.type === 'project' || query.type === 'all') {
      const projectWhere: any = { userId };
      if (query.status) projectWhere.status = query.status;
      if (query.search) {
        projectWhere.project = {
          title: { contains: query.search, mode: 'insensitive' },
        };
      }

      const projectApplications = await this.prisma.projectApplication.findMany(
        {
          where: projectWhere,
          include: {
            project: {
              select: {
                id: true,
                title: true,
                shortDescription: true,
                reward: true,
                currency: true,
                status: true,
                deadline: true,
                type: true,
              },
            },
          },
        },
      );

      allSubmissions.push(
        ...projectApplications.map((app) => ({
          type: 'project' as const,
          ...app,
        })),
      );
    }

    // Sort combined results
    const sortField = query.sortBy || 'createdAt';
    allSubmissions.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === 'title') {
        aValue = a.type === 'bounty' ? a.bounty.title : a.project.title;
        bValue = b.type === 'bounty' ? b.bounty.title : b.project.title;
      } else {
        aValue = a[sortField];
        bValue = b[sortField];
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const total = allSubmissions.length;
    const paginatedData = allSubmissions.slice(skip, skip + limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
