"use server";

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import type { Post, User } from '@/types';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { startOfDay, formatISO, endOfDay, parseISO, format } from 'date-fns';

import { getActiveSpecialEventForDate } from '@/actions/events';

/** Context identifier for logging post-related operations */
const POST_ACTIONS_CONTEXT = "PostActions";

/** Points awarded per star received on a post */
const POINTS_PER_STAR = 10;

/** Base points awarded for posting an approved post */
const BASE_POST_POINTS = 50;

/**
 * Timeout wrapper utility function that prevents infinite loading states
 * @param promiseFunction - Function that returns a promise to wrap with timeout
 * @param timeoutMs - Timeout in milliseconds (default: 12000ms = 12 seconds)
 * @returns Promise that either resolves with the original result or rejects with timeout error
 */
function withTimeout<T>(promiseFunction: () => Promise<T>, timeoutMs: number = 12000): Promise<T> {
  return Promise.race([
    promiseFunction(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out after 12 seconds')), timeoutMs)
    )
  ]);
}

/**
 * Awards points to user for approved post
 * @param userId - The user ID to award points to
 * @param postDate - The date of the post to check for special events
 * @param supabaseAdmin - Admin client for database operations
 * @returns Promise with points awarded or error
 */
async function awardPostPoints(userId: string, postDate: Date, supabaseAdmin: any): Promise<{ pointsAwarded?: number; error?: string }> {
  try {
    // Check for special events on submission_date
    const { data: specialEvent, error: eventError } = await getActiveSpecialEventForDate(postDate);
    
    if (eventError) {
      logger.warn(POST_ACTIONS_CONTEXT, `awardPostPoints: Could not check for special events: ${eventError}`);
    }
    
    // Calculate total points: base points + any special event bonus
    const basePoints = BASE_POST_POINTS;
    const bonusPoints = specialEvent?.bonus_points || 0;
    const totalPoints = basePoints + bonusPoints;
    
    // Get current user score
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('score')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      logger.error(POST_ACTIONS_CONTEXT, `awardPostPoints: Error fetching user profile: ${profileError.message}`);
      return { error: `Error fetching user profile: ${profileError.message}` };
    }
    
    const currentScore = userProfile?.score || 0;
    const newScore = currentScore + totalPoints;
    
    // Update user score
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ score: newScore })
      .eq('id', userId);
    
    if (updateError) {
      logger.error(POST_ACTIONS_CONTEXT, `awardPostPoints: Error updating user score: ${updateError.message}`);
      return { error: `Error updating user score: ${updateError.message}` };
    }
    
    logger.info(POST_ACTIONS_CONTEXT, `awardPostPoints: Awarded ${totalPoints} points to user ${userId} (Base: ${basePoints}, Bonus: ${bonusPoints}, Special Event: ${specialEvent?.name || 'None'})`);
    
    return { pointsAwarded: totalPoints };
  } catch (e: any) {
    logger.error(POST_ACTIONS_CONTEXT, `awardPostPoints: Unexpected error: ${e.message}`);
    return { error: `Unexpected error awarding points: ${e.message}` };
  }
}

/**
 * Retrieves approved posts for a specific date using European timezone
 * @param date - The date to filter posts by
 * @returns Promise containing array of approved posts for the date or error message
 */
export async function getApprovedPostsByDate(date: Date): Promise<{ data?: Post[]; error?: string }> {
  logger.info(POST_ACTIONS_CONTEXT, "getApprovedPostsByDate: Starting post retrieval for date (European timezone):", date.toISOString());
  
  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();
    const dateString = format(date, 'yyyy-MM-dd');
    const startOfDayISO = formatISO(startOfDay(date));
    const endOfDayISO = formatISO(endOfDay(date));

    logger.debug(POST_ACTIONS_CONTEXT, `getApprovedPostsByDate: European timezone - Date: ${dateString}, Start: ${startOfDayISO}, End: ${endOfDayISO}`);

    // Query for posts within the specified day in European timezone
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('approved', true)
      .gte('submission_date', startOfDayISO)
      .lt('submission_date', endOfDayISO)
      .order('stars_received', { ascending: false })
      .order('submission_date', { ascending: false });

    if (error) {
      logger.error(POST_ACTIONS_CONTEXT, 'getApprovedPostsByDate: Error retrieving approved posts:', error.message);
      return { error: `Error retrieving posts: ${error.message}` };
    }

    if (posts) {
      const supabaseAdmin = createAdminClient();
      for (const post of posts) {
        if (post.photo_urls && Array.isArray(post.photo_urls) && post.photo_urls.length > 0) {
          const { data: signedUrlsData, error: urlError } = await supabaseAdmin.storage
            .from('posts')
            .createSignedUrls(post.photo_urls, 60 * 5); // 5 minutes validity

          if (urlError) {
            logger.error(POST_ACTIONS_CONTEXT, `getApprovedPostsByDate: Error creating signed URLs for post ${post.id}:`, urlError.message);
            post.photo_urls = [];
          } else if (signedUrlsData) {
            post.photo_urls = signedUrlsData.map(u => u.signedUrl).filter((url): url is string => !!url);
          } else {
            logger.warn(POST_ACTIONS_CONTEXT, `getApprovedPostsByDate: createSignedUrls returned no data for post ${post.id}`);
            post.photo_urls = [];
          }
        }
      }
    }

    logger.info(POST_ACTIONS_CONTEXT, `getApprovedPostsByDate: Successfully retrieved and processed ${posts?.length || 0} approved posts for ${dateString} (UTC).`);
    return { data: posts as Post[] };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(POST_ACTIONS_CONTEXT, "getApprovedPostsByDate: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(POST_ACTIONS_CONTEXT, "getApprovedPostsByDate: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Gets post count by day within a date range using European timezone
 * @param startDate - Start date of the range
 * @param endDate - End date of the range
 * @returns Promise containing array of date-count pairs or error message
 */
export async function getPostsCountByDayInRange(
  startDate: Date,
  endDate: Date
): Promise<{ data?: { date: string; count: number }[]; error?: string }> {
  const CONTEXT = `${POST_ACTIONS_CONTEXT}/getPostsCountByDayInRange`;
  logger.info(CONTEXT, `Starting post count retrieval (European timezone). Range: ${formatISO(startDate)} to ${formatISO(endDate)}`);
  const supabase = await createServerSupabaseClient();

  const startDateStr = formatISO(startOfDay(startDate));
  const endDateStr = formatISO(endOfDay(endDate));

  logger.debug(CONTEXT, `European timezone range: ${startDateStr} to ${endDateStr}`);

  const { data: postsInDateRange, error: postsFetchError } = await supabase
    .from('posts')
    .select('submission_date') // Select only the necessary column
    .eq('approved', true)
    .gte('submission_date', startDateStr)
    .lte('submission_date', endDateStr);

  if (postsFetchError) {
    logger.error(CONTEXT, 'Error retrieving posts for count:', postsFetchError.message);
    return { error: `Error retrieving posts: ${postsFetchError.message}` };
  }

  if (!postsInDateRange) {
    logger.info(CONTEXT, 'No posts found in the range.');
    return { data: [] };
  }

  const counts: Record<string, number> = {};
  postsInDateRange.forEach(post => {
    const postDate = new Date(post.submission_date);
    const dateKey = format(postDate, 'yyyy-MM-dd');
    counts[dateKey] = (counts[dateKey] || 0) + 1;
  });

  const result = Object.entries(counts).map(([date, count]) => ({ date, count }));
  logger.info(CONTEXT, `Post count completed (UTC). ${result.length} days with posts.`);
  return { data: result };
}

/**
 * Toggles star status for a post (add/remove star)
 * @param postId - The ID of the post to star/unstar
 * @returns Promise containing success status, new star count, author score, and user's starred submissions
 */
export async function toggleStarPost(
  postId: string
): Promise<{
  success: boolean;
  error?: string;
  newStarsCount?: number;
  newAuthorScore?: number;
  newStarredSubmissionsForCurrentUser?: string[];
  isStarred?: boolean;
}> {
  logger.info(POST_ACTIONS_CONTEXT, `toggleStarPost: Starting for post ID: ${postId}`);
  
  return withTimeout(async () => {
    const supabaseServerClient = await createServerSupabaseClient();
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (e: any) {
    logger.error(POST_ACTIONS_CONTEXT, "toggleStarPost: Failed to create Supabase Admin Client:", e.message);
    return { success: false, error: `Server configuration error: ${e.message}. Contact support.` };
  }

  const { data: { user: authUser }, error: authError } = await supabaseServerClient.auth.getUser();

  if (authError || !authUser) {
    logger.warn(POST_ACTIONS_CONTEXT, "toggleStarPost: Authentication required.");
    return { success: false, error: 'Authentication required.' };
  }
  logger.info(POST_ACTIONS_CONTEXT, `toggleStarPost: Authenticated user ID: ${authUser.id}`);

  const { data: post, error: postError } = await supabaseAdmin
    .from('posts')
    .select('id, user_id, stars_received, approved, submission_date') 
    .eq('id', postId)
    .single();

  if (postError || !post) {
    logger.error(POST_ACTIONS_CONTEXT, `toggleStarPost: Post not found (ID: ${postId}). Error:`, postError?.message);
    return { success: false, error: 'Post not found or error retrieving it.' };
  }

  if (post.approved !== true) {
     logger.warn(POST_ACTIONS_CONTEXT, `toggleStarPost: Post (ID: ${postId}) not approved. Cannot assign star.`);
    return { success: false, error: 'You can only assign stars to approved posts.' };
  }

  if (post.user_id === authUser.id) {
    logger.warn(POST_ACTIONS_CONTEXT, `toggleStarPost: User ${authUser.id} cannot assign stars to their own post (ID: ${postId}).`);
    return { success: false, error: 'You cannot assign stars to your own post.' };
  }

  const { data: currentUserProfile, error: currentUserProfileError } = await supabaseAdmin
    .from('profiles')
    .select('id, starred_submissions')
    .eq('id', authUser.id)
    .single();

  if (currentUserProfileError || !currentUserProfile) {
    logger.error(POST_ACTIONS_CONTEXT, `toggleStarPost: Current user profile not found (ID: ${authUser.id}). Error:`, currentUserProfileError?.message);
    return { success: false, error: 'Current user profile not found.' };
  }

  const starredPosts = Array.isArray(currentUserProfile.starred_submissions) ? currentUserProfile.starred_submissions : [];
  const isCurrentlyStarred = starredPosts.includes(postId);
  let newStarsCount: number;
  let scoreChange: number;
  let newStarredSubmissionsForCurrentUser: string[];

  if (isCurrentlyStarred) {
    newStarsCount = Math.max(0, (post.stars_received || 0) - 1);
    scoreChange = -POINTS_PER_STAR;
    newStarredSubmissionsForCurrentUser = starredPosts.filter(id => id !== postId);
    logger.info(POST_ACTIONS_CONTEXT, `toggleStarPost: User ${authUser.id} is removing star from post ${postId}.`);
  } else {
    newStarsCount = (post.stars_received || 0) + 1;
    scoreChange = POINTS_PER_STAR;
    newStarredSubmissionsForCurrentUser = [...starredPosts, postId];
    logger.info(POST_ACTIONS_CONTEXT, `toggleStarPost: User ${authUser.id} is assigning star to post ${postId}.`);
  }
  logger.debug(POST_ACTIONS_CONTEXT, `toggleStarPost: Star calculation: previous=${post.stars_received}, new=${newStarsCount}, scoreChange=${scoreChange}`);

  const { error: updatePostError } = await supabaseAdmin
    .from('posts')
    .update({ stars_received: newStarsCount })
    .eq('id', postId);

  if (updatePostError) {
    logger.error(POST_ACTIONS_CONTEXT, `toggleStarPost: Error updating post stars (ID: ${postId}). Error:`, updatePostError.message);
    return { success: false, error: `Error updating post stars: ${updatePostError.message}` };
  }

  const { data: authorProfile, error: authorProfileError } = await supabaseAdmin
    .from('profiles')
    .select('id, score')
    .eq('id', post.user_id)
    .single();
  
  let newAuthorScore: number | undefined = undefined;
  if (authorProfileError || !authorProfile) {
    logger.error(POST_ACTIONS_CONTEXT, `toggleStarPost: Author profile not found (ID: ${post.user_id}). Error:`, authorProfileError?.message);
  } else {
    newAuthorScore = Math.max(0, (authorProfile.score || 0) + scoreChange);
    const { error: updateAuthorScoreError } = await supabaseAdmin
      .from('profiles')
      .update({ score: newAuthorScore })
      .eq('id', post.user_id);

    if (updateAuthorScoreError) {
      logger.error(POST_ACTIONS_CONTEXT, `toggleStarPost: Error updating author score (ID: ${post.user_id}). Error:`, updateAuthorScoreError.message);
    } else {
      logger.info(POST_ACTIONS_CONTEXT, `toggleStarPost: Author score ID ${post.user_id} updated to ${newAuthorScore}.`);
    }
  }

  const { error: updateUserStarredError } = await supabaseAdmin
    .from('profiles')
    .update({ starred_submissions: newStarredSubmissionsForCurrentUser })
    .eq('id', authUser.id);

  if (updateUserStarredError) {
    logger.error(POST_ACTIONS_CONTEXT, `toggleStarPost: Error updating user starred_submissions (ID: ${authUser.id}). Error:`, updateUserStarredError.message);
    return { success: false, error: `Error updating user preferences: ${updateUserStarredError.message}` };
  }

  logger.info(POST_ACTIONS_CONTEXT, `toggleStarPost: Successfully processed for post ID: ${postId} by user ${authUser.id}. New star status: ${!isCurrentlyStarred}`);
  
  revalidatePath('/posts');
  revalidatePath('/leaderboard');
  if (post.submission_date) {
    try {
      // post.submission_date is an ISO UTC string. parseISO handles it correctly.
      // formatISO with representation: 'date' extracts YYYY-MM-DD based on UTC.
      const postDateUTC = parseISO(post.submission_date);
      const pathForDate = `/posts?date=${formatISO(postDateUTC, { representation: 'date' })}`;
      revalidatePath(pathForDate);
      logger.debug(POST_ACTIONS_CONTEXT, `toggleStarPost: Path revalidated: ${pathForDate}`);
    } catch (e) {
      logger.warn(POST_ACTIONS_CONTEXT, "toggleStarPost: Unable to revalidate specific posts date path", e);
    }
  }

    return {
      success: true,
      newStarsCount,
      newAuthorScore,
      newStarredSubmissionsForCurrentUser,
      isStarred: !isCurrentlyStarred
    };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(POST_ACTIONS_CONTEXT, "toggleStarPost: Request timed out");
      return { success: false, error: 'The request took too long. Please try again later.' };
    }
    logger.error(POST_ACTIONS_CONTEXT, "toggleStarPost: Unexpected error:", error.message);
    return { success: false, error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Retrieves all posts for admin dashboard
 * @returns Promise containing array of all posts or error message
 */
export async function getAllPostsForAdmin(): Promise<{ data?: Post[]; error?: string }> {
  logger.info(POST_ACTIONS_CONTEXT, "getAllPostsForAdmin: Starting retrieval of all posts for admin.");
  
  return withTimeout(async () => {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (e: any) {
      logger.error(POST_ACTIONS_CONTEXT, "getAllPostsForAdmin: Failed to create Supabase Admin Client:", e.message);
      return { error: `Server configuration error: ${e.message}. Contact support.` };
    }

    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .order('submission_date', { ascending: false });

    if (error) {
      logger.error(POST_ACTIONS_CONTEXT, 'getAllPostsForAdmin: Error retrieving all posts for admin:', error.message);
      return { error: `Error retrieving posts for admin: ${error.message}` };
    }

    if (posts) {
      for (const post of posts) {
        if (post.photo_urls && Array.isArray(post.photo_urls) && post.photo_urls.length > 0) {
          const { data: signedUrlsData, error: urlError } = await supabaseAdmin.storage
            .from('posts')
            .createSignedUrls(post.photo_urls, 60 * 5); // 5 minutes validity

          if (urlError) {
            logger.error(POST_ACTIONS_CONTEXT, `getAllPostsForAdmin: Error creating signed URLs for post ${post.id}:`, urlError.message);
            post.photo_urls = [];
          } else if (signedUrlsData) {
            post.photo_urls = signedUrlsData.map(u => u.signedUrl).filter((url): url is string => !!url);
          } else {
            logger.warn(POST_ACTIONS_CONTEXT, `getAllPostsForAdmin: createSignedUrls returned no data for post ${post.id}`);
            post.photo_urls = [];
          }
        }
      }
    }
    logger.info(POST_ACTIONS_CONTEXT, `getAllPostsForAdmin: Successfully retrieved and processed ${posts?.length || 0} posts for admin.`);
    return { data: posts as Post[] };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(POST_ACTIONS_CONTEXT, "getAllPostsForAdmin: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(POST_ACTIONS_CONTEXT, "getAllPostsForAdmin: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Moderates a post by approving or rejecting it. Awards points if approved.
 * @param postId - The ID of the post to moderate
 * @param approve - Whether to approve (true) or reject (false) the post
 * @returns Promise containing success status or error message
 */
export async function moderatePost(postId: string, approve: boolean): Promise<{ success: boolean; error?: string }> {
  logger.info(POST_ACTIONS_CONTEXT, `moderatePost: Starting for ID ${postId}, Approval: ${approve}`);
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (e: any) {
    logger.error(POST_ACTIONS_CONTEXT, "moderatePost: Failed to create Supabase Admin Client:", e.message);
    return { success: false, error: `Server configuration error: ${e.message}. Contact support.` };
  }
  
  const supabaseServerClient = await createServerSupabaseClient();

  const { data: { user: authUser } } = await supabaseServerClient.auth.getUser();
  if (!authUser) {
      logger.warn(POST_ACTIONS_CONTEXT, "moderatePost: Authentication required.");
      return { success: false, error: 'Authentication required' };
  }
  logger.info(POST_ACTIONS_CONTEXT, `moderatePost: Authenticated admin ID: ${authUser.id}`);

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', authUser.id).single();
  if (profile?.role !== 'admin') {
      logger.warn(POST_ACTIONS_CONTEXT, "moderatePost: Administrator privileges required.");
      return { success: false, error: 'Administrator privileges required' };
  }

  // Get post details before updating for points awarding
  const { data: post, error: fetchError } = await supabaseAdmin
    .from('posts')
    .select('user_id, submission_date')
    .eq('id', postId)
    .single();

  if (fetchError || !post) {
    logger.error(POST_ACTIONS_CONTEXT, `moderatePost: Error fetching post details: ${fetchError?.message}`);
    return { success: false, error: 'Post not found' };
  }

  const { error } = await supabaseAdmin
      .from('posts')
      .update({ approved: approve })
      .eq('id', postId);

  if (error) {
      logger.error(POST_ACTIONS_CONTEXT, `moderatePost: Error moderating post ${postId}:`, error.message);
      return { success: false, error: error.message };
  }

  // Award points if post is being approved
  if (approve) {
    const postDate = new Date(post.submission_date);
    const { pointsAwarded, error: pointsError } = await awardPostPoints(post.user_id, postDate, supabaseAdmin);
    
    if (pointsError) {
      logger.warn(POST_ACTIONS_CONTEXT, `moderatePost: Error awarding points for approved post: ${pointsError}`);
      // Don't fail the approval, just warn
    } else if (pointsAwarded) {
      logger.info(POST_ACTIONS_CONTEXT, `moderatePost: Awarded ${pointsAwarded} points to user ${post.user_id} for approved post.`);
    }
  }

  logger.info(POST_ACTIONS_CONTEXT, `moderatePost: Post ${postId} successfully moderated (Approved: ${approve}).`);
  revalidatePath('/admin');
  revalidatePath('/posts');
  return { success: true };
}

export async function deletePostByAdmin(postId: string): Promise<{ success: boolean; error?: string }> {
  logger.info(POST_ACTIONS_CONTEXT, `deletePostByAdmin: Admin attempting to delete post ID ${postId}`);
  return deletePostAndAssociatedImages(postId, true);
}

/**
 * Deletes a user's own post.
 * @param postId - The ID of the post to delete.
 * @returns Promise containing success status or error message.
 */
export async function deleteOwnPost(postId: string): Promise<{ success: boolean; error?: string }> {
  logger.info(POST_ACTIONS_CONTEXT, `deleteOwnPost: User attempting to delete post ID ${postId}`);
  return deletePostAndAssociatedImages(postId, false);
}

/**
 * Centralized function to delete a post and its associated images from storage.
 * @param postId - The ID of the post to delete.
 * @param asAdmin - Boolean indicating if the deletion is an admin action.
 * @returns Promise containing success status or error message.
 */
async function deletePostAndAssociatedImages(postId: string, asAdmin: boolean): Promise<{ success: boolean; error?: string }> {
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (e: any) {
    logger.error(POST_ACTIONS_CONTEXT, "deletePostAndAssociatedImages: Failed to create Supabase Admin Client:", e.message);
    return { success: false, error: "Server configuration error. Contact support." };
  }

  const supabaseServerClient = await createServerSupabaseClient();
  const { data: { user: authUser }, error: authError } = await supabaseServerClient.auth.getUser();

  if (authError || !authUser) {
    logger.warn(POST_ACTIONS_CONTEXT, "deletePostAndAssociatedImages: Authentication required.");
    return { success: false, error: 'Authentication required' };
  }

  // Fetch the post with admin client to get photo_urls regardless of who owns it
  const { data: post, error: fetchError } = await supabaseAdmin
    .from('posts')
    .select('id, user_id, photo_urls')
    .eq('id', postId)
    .single();

  if (fetchError || !post) {
    logger.error(POST_ACTIONS_CONTEXT, `deletePostAndAssociatedImages: Post not found with ID ${postId}. Error: ${fetchError?.message}`);
    return { success: false, error: 'Post not found.' };
  }

  // Permission check
  if (!asAdmin && post.user_id !== authUser.id) {
    logger.warn(POST_ACTIONS_CONTEXT, `deletePostAndAssociatedImages: User ${authUser.id} attempted to delete post ${postId} without admin rights.`);
    return { success: false, error: 'Permission denied.' };
  }
  if (asAdmin) {
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', authUser.id).single();
    if (profile?.role !== 'admin') {
      logger.warn(POST_ACTIONS_CONTEXT, `deletePostAndAssociatedImages: User ${authUser.id} attempted an admin delete without admin role.`);
      return { success: false, error: 'Administrator privileges required.' };
    }
  }

  // Delete associated images from storage
  if (post.photo_urls && Array.isArray(post.photo_urls) && post.photo_urls.length > 0) {
    const filePaths = post.photo_urls.filter(p => typeof p === 'string'); // Ensure we only have strings
    if (filePaths.length > 0) {
      logger.info(POST_ACTIONS_CONTEXT, `deletePostAndAssociatedImages: Deleting ${filePaths.length} associated image paths from storage for post ${postId}.`);
      
      const { error: storageError } = await supabaseAdmin.storage
        .from('posts')
        .remove(filePaths);

      if (storageError) {
        // Log the error but don't block the post deletion from the database
        logger.error(POST_ACTIONS_CONTEXT, `deletePostAndAssociatedImages: Error deleting images from storage for post ${postId}. The post record will still be deleted. Error:`, storageError.message);
      }
    }
  }

  // Delete the post record from the database
  const { error: deleteError } = await supabaseAdmin
    .from('posts')
    .delete()
    .eq('id', postId);

  if (deleteError) {
    logger.error(POST_ACTIONS_CONTEXT, `deletePostAndAssociatedImages: Error deleting post record ${postId} from database:`, deleteError.message);
    return { success: false, error: `Failed to delete post: ${deleteError.message}` };
  }

  logger.info(POST_ACTIONS_CONTEXT, `deletePostAndAssociatedImages: Post ${postId} and associated data deleted successfully by user ${authUser.id}. Admin action: ${asAdmin}`);
  
  revalidatePath('/posts');
  if (asAdmin) {
    revalidatePath('/admin');
  }

  return { success: true };
}
