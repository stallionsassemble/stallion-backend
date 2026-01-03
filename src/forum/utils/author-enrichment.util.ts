import { PrismaService } from '../../common/prisma/prisma.service';

export interface EnrichedAuthor {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePicture: string | null;
  role: string;
  postCount: number;
  reactionCount: number;
  replyCount: number;
}

/**
 * Enrich author data with additional statistics
 * @param prisma - Prisma service instance
 * @param author - Basic author data from query
 * @returns Enriched author data with stats
 */
export async function enrichAuthorData(
  prisma: PrismaService,
  author: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profilePicture: string | null;
    role: string;
  },
): Promise<EnrichedAuthor> {
  // Get post count (forum posts created by user)
  const postCount = await prisma.forumPost.count({
    where: { authorId: author.id },
  });

  // Get reaction count (total reactions received on user's posts)
  const reactionCount = await prisma.forumReaction.count({
    where: {
      post: {
        authorId: author.id,
      },
    },
  });

  // Get reply count (comments made by user)
  const replyCount = await prisma.forumComment.count({
    where: { authorId: author.id },
  });

  return {
    id: author.id,
    username: author.username,
    firstName: author.firstName,
    lastName: author.lastName,
    profilePicture: author.profilePicture,
    role: author.role,
    postCount,
    reactionCount,
    replyCount,
  };
}

/**
 * Enrich multiple authors with statistics
 * @param prisma - Prisma service instance
 * @param authors - Array of basic author data
 * @returns Array of enriched author data
 */
export async function enrichAuthorsData(
  prisma: PrismaService,
  authors: Array<{
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profilePicture: string | null;
    role: string;
  }>,
): Promise<EnrichedAuthor[]> {
  return Promise.all(authors.map((author) => enrichAuthorData(prisma, author)));
}
