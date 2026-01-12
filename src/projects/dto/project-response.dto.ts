import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActivityType,
  ApplicationStatus,
  MilestoneStatus,
  ProjectStatus,
  ProjectType,
} from '@prisma/client';
import { AttachmentItem } from 'src/bounties/dto';

export class ProjectResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  shortDescription: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: [String] })
  requirements: string[];

  @ApiProperty({ type: [String] })
  deliverables: string[];

  @ApiProperty({ type: [String] })
  skills: string[];

  @ApiPropertyOptional()
  attachments?: AttachmentItem[];

  @ApiProperty()
  reward: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  deadline: Date;

  @ApiProperty({ enum: ProjectStatus })
  status: ProjectStatus;

  @ApiProperty({ enum: ProjectType })
  type: ProjectType;

  @ApiProperty()
  peopleNeeded: number;

  @ApiProperty()
  acceptedCount: number;

  @ApiPropertyOptional()
  contractProjectId?: number;

  @ApiPropertyOptional()
  txHash?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  ownerId: string;

  @ApiPropertyOptional()
  owner?: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    profilePicture: string | null;
    totalPaid: string;
    totalBounties: number;
    totalProjects: number;
  };

  @ApiPropertyOptional({
    description:
      'Whether the current user has applied to this project (only present if authenticated)',
  })
  applied?: boolean;

  @ApiPropertyOptional({
    description:
      'Total amount released from completed milestones (PAID status)',
  })
  released?: string;

  @ApiPropertyOptional({
    description:
      'Total amount escrowed in milestones that have not been paid yet',
  })
  escrowed?: string;

  @ApiPropertyOptional({
    description: 'Winner information if an application has been accepted',
  })
  winner?: {
    userId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profilePicture: string | null;
    acceptedAt: Date;
  };

  @ApiPropertyOptional({
    description: 'Project milestones (only in detailed view)',
  })
  milestones?: MilestoneResponseDto[];

  @ApiProperty({
    description: 'Project completion progress as a percentage (0-100)',
    example: 65.5,
  })
  projectProgress: number;
}

export class ApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  coverLetter: string;

  @ApiPropertyOptional()
  estimatedCompletionTime?: number;

  @ApiProperty({ type: [String] })
  portfolioLinks: string[];

  @ApiPropertyOptional()
  attachments?: AttachmentItem[];

  @ApiProperty({ enum: ApplicationStatus })
  status: ApplicationStatus;

  @ApiPropertyOptional()
  rejectionReason?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  user?: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profilePicture: string | null;
    skills: string[];
  };

  @ApiPropertyOptional()
  project?: ProjectResponseDto;
}

export class MilestoneResponseDto {
  @ApiProperty({
    description:
      'ID (userMilestoneId if project has accepted contributor, otherwise milestoneId)',
  })
  id: string;

  @ApiPropertyOptional({
    description:
      'User milestone ID (only present if project has accepted contributor)',
  })
  userMilestoneId?: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty()
  order: number;

  @ApiPropertyOptional({
    enum: MilestoneStatus,
    description: 'Status (only present if project has accepted contributor)',
  })
  status?: MilestoneStatus;

  @ApiPropertyOptional()
  submissionNote?: string;

  @ApiPropertyOptional()
  submissionUrl?: string;

  @ApiPropertyOptional()
  submittedAt?: Date;

  @ApiPropertyOptional()
  reviewNote?: string;

  @ApiPropertyOptional()
  reviewedAt?: Date;

  @ApiPropertyOptional()
  revisionNote?: string;

  @ApiPropertyOptional()
  txHash?: string;

  @ApiPropertyOptional()
  paidAt?: Date;

  @ApiPropertyOptional()
  contributorId?: string;

  @ApiPropertyOptional({
    description:
      'Contributor information (only present if project has accepted contributor)',
  })
  contributor?: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profilePicture: string | null;
  };
}

export class ActivityResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ActivityType })
  type: ActivityType;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  metadata?: Record<string, any>;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  projectId?: string;

  @ApiPropertyOptional()
  bountyId?: string;

  @ApiPropertyOptional()
  hackathonId?: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  user?: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}
