"use server";

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import type { Submission, User } from '@/types';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { startOfDay, formatISO, endOfDay, parseISO, format } from 'date-fns';
import { formatDateForEuropeanTimezone, startOfDayEuropeanISO, endOfDayEuropeanISO } from '@/lib/utils';
import { getActiveSpecialEventForDate } from '@/actions/events';
import { deleteStorageFilesByUrls } from '@/lib/storage-utils';

/** Context identifier for logging submission-related operations */
const SUBMISSION_ACTIONS_CONTEXT = "SubmissionActions";

/** Points awarded per star received on a submission */
const POINTS_PER_STAR = 10;

/** Base points awarded for posting an approved submission */
const BASE_SUBMISSION_POINTS = 50;

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
 * Awards points to user for approved submission
 * @param userId - The user ID to award points to
 * @param submissionDate - The date of the submission to check for special events
 * @param supabaseAdmin - Admin client for database operations
 * @returns Promise with points awarded or error
 */
async function awardSubmissionPoints(userId: string, submissionDate: Date, supabaseAdmin: any): Promise<{ pointsAwarded?: number; error?: string }> {
  try {
    // Check for special events on submission date
    const { data: specialEvent, error: eventError } = await getActiveSpecialEventForDate(submissionDate);
    
    if (eventError) {
      logger.warn(SUBMISSION_ACTIONS_CONTEXT, `awardSubmissionPoints: Could not check for special events: ${eventError}`);
    }
    
    // Calculate total points: base points + any special event bonus
    const basePoints = BASE_SUBMISSION_POINTS;
    const bonusPoints = specialEvent?.bonus_points || 0;
    const totalPoints = basePoints + bonusPoints;
    
    // Get current user score
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('score')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      logger.error(SUBMISSION_ACTIONS_CONTEXT, `awardSubmissionPoints: Error fetching user profile: ${profileError.message}`);
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
      logger.error(SUBMISSION_ACTIONS_CONTEXT, `awardSubmissionPoints: Error updating user score: ${updateError.message}`);
      return { error: `Error updating user score: ${updateError.message}` };
    }
    
    logger.info(SUBMISSION_ACTIONS_CONTEXT, `awardSubmissionPoints: Awarded ${totalPoints} points to user ${userId} (Base: ${basePoints}, Bonus: ${bonusPoints}, Special Event: ${specialEvent?.name || 'None'})`);
    
    return { pointsAwarded: totalPoints };
  } catch (e: any) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, `awardSubmissionPoints: Unexpected error: ${e.message}`);
    return { error: `Unexpected error awarding points: ${e.message}` };
  }
}

/**
 * Retrieves approved submissions for a specific date using European timezone
 * @param date - The date to filter submissions by
 * @returns Promise containing array of approved submissions for the date or error message
 */
export async function getApprovedSubmissionsByDate(date: Date): Promise<{ data?: Submission[]; error?: string }> {
  logger.info(SUBMISSION_ACTIONS_CONTEXT, "getApprovedSubmissionsByDate: Starting submission retrieval for date (European timezone):", date.toISOString());
  
  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();    // Use European timezone for date boundaries
    const dateString = formatDateForEuropeanTimezone(date);
    const startOfDayISO = startOfDayEuropeanISO(date);
    const endOfDayISO = endOfDayEuropeanISO(date);

    logger.debug(SUBMISSION_ACTIONS_CONTEXT, `getApprovedSubmissionsByDate: European timezone - Date: ${dateString}, Start: ${startOfDayISO}, End: ${endOfDayISO}`);

    // Query for posts within the specified day in European timezone
    const { data: submissions, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('approved', true)
      .gte('submission_date', startOfDayISO)
      .lt('submission_date', endOfDayISO)
      .order('stars_received', { ascending: false })
      .order('submission_date', { ascending: false });

    if (error) {
      logger.error(SUBMISSION_ACTIONS_CONTEXT, 'getApprovedSubmissionsByDate: Error retrieving approved submissions:', error.message);
      return { error: `Error retrieving submissions: ${error.message}` };
    }

    logger.info(SUBMISSION_ACTIONS_CONTEXT, `getApprovedSubmissionsByDate: Successfully retrieved ${submissions?.length || 0} approved submissions for ${dateString} (European timezone).`);
    return { data: submissions as Submission[] };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(SUBMISSION_ACTIONS_CONTEXT, "getApprovedSubmissionsByDate: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(SUBMISSION_ACTIONS_CONTEXT, "getApprovedSubmissionsByDate: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Gets submission count by day within a date range using European timezone
 * @param startDate - Start date of the range
 * @param endDate - End date of the range
 * @returns Promise containing array of date-count pairs or error message
 */
export async function getSubmissionsCountByDayInRange(
  startDate: Date,
  endDate: Date
): Promise<{ data?: { date: string; count: number }[]; error?: string }> {
  const CONTEXT = `${SUBMISSION_ACTIONS_CONTEXT}/getSubmissionsCountByDayInRange`;
  logger.info(CONTEXT, `Starting submission count retrieval (European timezone). Range: ${formatISO(startDate)} to ${formatISO(endDate)}`);
  const supabase = await createServerSupabaseClient();

  // Use European timezone for date boundaries
  const startDateStr = startOfDayEuropeanISO(startDate);
  const endDateStr = endOfDayEuropeanISO(endDate);

  logger.debug(CONTEXT, `European timezone range: ${startDateStr} to ${endDateStr}`);

  const { data: submissionsInDateRange, error: submissionsFetchError } = await supabase
    .from('submissions')
    .select('submission_date') // Select only the necessary column
    .eq('approved', true)
    .gte('submission_date', startDateStr)
    .lte('submission_date', endDateStr);

  if (submissionsFetchError) {
    logger.error(CONTEXT, 'Error retrieving submissions for count:', submissionsFetchError.message);
    return { error: `Error retrieving submissions: ${submissionsFetchError.message}` };
  }

  if (!submissionsInDateRange) {
    logger.info(CONTEXT, 'No submissions found in the range.');
    return { data: [] };
  }

  const counts: Record<string, number> = {};
  submissionsInDateRange.forEach(sub => {
    // Convert submission date to European timezone and extract YYYY-MM-DD
    const submissionDate = new Date(sub.submission_date);
    const europeanDateStr = formatDateForEuropeanTimezone(submissionDate);
    counts[europeanDateStr] = (counts[europeanDateStr] || 0) + 1;
  });

  const result = Object.entries(counts).map(([date, count]) => ({ date, count }));
  logger.info(CONTEXT, `Submission count completed (European timezone). ${result.length} days with posts.`);
  return { data: result };
}

/**
 * Toggles star status for a submission (add/remove star)
 * @param submissionId - The ID of the submission to star/unstar
 * @returns Promise containing success status, new star count, author score, and user's starred submissions
 */
export async function toggleStarSubmission(
  submissionId: string
): Promise<{
  success: boolean;
  error?: string;
  newStarsCount?: number;
  newAuthorScore?: number;
  newStarredSubmissionsForCurrentUser?: string[];
  isStarred?: boolean;
}> {
  logger.info(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Starting for submission ID: ${submissionId}`);
  
  return withTimeout(async () => {
    const supabaseServerClient = await createServerSupabaseClient();
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (e: any) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, "toggleStarSubmission: Failed to create Supabase Admin Client:", e.message);
    return { success: false, error: `Server configuration error: ${e.message}. Contact support.` };
  }

  const { data: { user: authUser }, error: authError } = await supabaseServerClient.auth.getUser();

  if (authError || !authUser) {
    logger.warn(SUBMISSION_ACTIONS_CONTEXT, "toggleStarSubmission: Authentication required.");
    return { success: false, error: 'Authentication required.' };
  }
  logger.info(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Authenticated user ID: ${authUser.id}`);

  const { data: submission, error: submissionError } = await supabaseAdmin
    .from('submissions')
    .select('id, user_id, stars_received, approved, submission_date') 
    .eq('id', submissionId)
    .single();

  if (submissionError || !submission) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Submission not found (ID: ${submissionId}). Error:`, submissionError?.message);
    return { success: false, error: 'Submission not found or error retrieving it.' };
  }

  if (submission.approved !== true) {
     logger.warn(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Submission (ID: ${submissionId}) not approved. Cannot assign star.`);
    return { success: false, error: 'You can only assign stars to approved submissions.' };
  }

  if (submission.user_id === authUser.id) {
    logger.warn(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: User ${authUser.id} cannot assign stars to their own submission (ID: ${submissionId}).`);
    return { success: false, error: 'You cannot assign stars to your own submission.' };
  }

  const { data: currentUserProfile, error: currentUserProfileError } = await supabaseAdmin
    .from('profiles')
    .select('id, starred_submissions')
    .eq('id', authUser.id)
    .single();

  if (currentUserProfileError || !currentUserProfile) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Current user profile not found (ID: ${authUser.id}). Error:`, currentUserProfileError?.message);
    return { success: false, error: 'Current user profile not found.' };
  }

  const starredSubmissions = Array.isArray(currentUserProfile.starred_submissions) ? currentUserProfile.starred_submissions : [];
  const isCurrentlyStarred = starredSubmissions.includes(submissionId);
  let newStarsCount: number;
  let scoreChange: number;
  let newStarredSubmissionsForCurrentUser: string[];

  if (isCurrentlyStarred) {
    newStarsCount = Math.max(0, (submission.stars_received || 0) - 1);
    scoreChange = -POINTS_PER_STAR;
    newStarredSubmissionsForCurrentUser = starredSubmissions.filter(id => id !== submissionId);
    logger.info(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: User ${authUser.id} is removing star from submission ${submissionId}.`);
  } else {
    newStarsCount = (submission.stars_received || 0) + 1;
    scoreChange = POINTS_PER_STAR;
    newStarredSubmissionsForCurrentUser = [...starredSubmissions, submissionId];
    logger.info(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: User ${authUser.id} is assigning star to submission ${submissionId}.`);
  }
  logger.debug(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Star calculation: previous=${submission.stars_received}, new=${newStarsCount}, scoreChange=${scoreChange}`);

  const { error: updateSubmissionError } = await supabaseAdmin
    .from('submissions')
    .update({ stars_received: newStarsCount })
    .eq('id', submissionId);

  if (updateSubmissionError) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Error updating submission stars (ID: ${submissionId}). Error:`, updateSubmissionError.message);
    return { success: false, error: `Error updating submission stars: ${updateSubmissionError.message}` };
  }

  const { data: authorProfile, error: authorProfileError } = await supabaseAdmin
    .from('profiles')
    .select('id, score')
    .eq('id', submission.user_id)
    .single();
  
  let newAuthorScore: number | undefined = undefined;
  if (authorProfileError || !authorProfile) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Author profile not found (ID: ${submission.user_id}). Error:`, authorProfileError?.message);
  } else {
    newAuthorScore = Math.max(0, (authorProfile.score || 0) + scoreChange);
    const { error: updateAuthorScoreError } = await supabaseAdmin
      .from('profiles')
      .update({ score: newAuthorScore })
      .eq('id', submission.user_id);

    if (updateAuthorScoreError) {
      logger.error(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Error updating author score (ID: ${submission.user_id}). Error:`, updateAuthorScoreError.message);
    } else {
      logger.info(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Author score ID ${submission.user_id} updated to ${newAuthorScore}.`);
    }
  }

  const { error: updateUserStarredError } = await supabaseAdmin
    .from('profiles')
    .update({ starred_submissions: newStarredSubmissionsForCurrentUser })
    .eq('id', authUser.id);

  if (updateUserStarredError) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Error updating user starred_submissions (ID: ${authUser.id}). Error:`, updateUserStarredError.message);
    return { success: false, error: `Error updating user preferences: ${updateUserStarredError.message}` };
  }

  logger.info(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Successfully processed for submission ID: ${submissionId} by user ${authUser.id}. New star status: ${!isCurrentlyStarred}`);
  
  revalidatePath('/posts');
  revalidatePath('/leaderboard');
  if (submission.submission_date) {
    try {
      // submission.submission_date is an ISO UTC string. parseISO handles it correctly.
      // formatISO with representation: 'date' extracts YYYY-MM-DD based on UTC.
      const subDateUTC = parseISO(submission.submission_date);
      const pathForDate = `/posts?date=${formatISO(subDateUTC, { representation: 'date' })}`;
      revalidatePath(pathForDate);
      logger.debug(SUBMISSION_ACTIONS_CONTEXT, `toggleStarSubmission: Path revalidated: ${pathForDate}`);
    } catch (e) {
      logger.warn(SUBMISSION_ACTIONS_CONTEXT, "toggleStarSubmission: Unable to revalidate specific posts date path", e);
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
      logger.error(SUBMISSION_ACTIONS_CONTEXT, "toggleStarSubmission: Request timed out");
      return { success: false, error: 'The request took too long. Please try again later.' };
    }
    logger.error(SUBMISSION_ACTIONS_CONTEXT, "toggleStarSubmission: Unexpected error:", error.message);
    return { success: false, error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Retrieves all submissions for admin dashboard
 * @returns Promise containing array of all submissions or error message
 */
export async function getAllSubmissionsForAdmin(): Promise<{ data?: Submission[]; error?: string }> {
  logger.info(SUBMISSION_ACTIONS_CONTEXT, "getAllSubmissionsForAdmin: Starting retrieval of all submissions for admin.");
  
  return withTimeout(async () => {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (e: any) {
      logger.error(SUBMISSION_ACTIONS_CONTEXT, "getAllSubmissionsForAdmin: Failed to create Supabase Admin Client:", e.message);
      return { error: `Server configuration error: ${e.message}. Contact support.` };
    }

    const { data: submissions, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .order('submission_date', { ascending: false });

    if (error) {
      logger.error(SUBMISSION_ACTIONS_CONTEXT, 'getAllSubmissionsForAdmin: Error retrieving all submissions for admin:', error.message);
      return { error: `Error retrieving submissions for admin: ${error.message}` };
    }

    logger.info(SUBMISSION_ACTIONS_CONTEXT, `getAllSubmissionsForAdmin: Successfully retrieved ${submissions?.length || 0} submissions for admin.`);
    return { data: submissions as Submission[] };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(SUBMISSION_ACTIONS_CONTEXT, "getAllSubmissionsForAdmin: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(SUBMISSION_ACTIONS_CONTEXT, "getAllSubmissionsForAdmin: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Moderates a submission by approving or rejecting it. Awards points if approved.
 * @param submissionId - The ID of the submission to moderate
 * @param approve - Whether to approve (true) or reject (false) the submission
 * @returns Promise containing success status or error message
 */
export async function moderateSubmission(submissionId: string, approve: boolean): Promise<{ success: boolean; error?: string }> {
  logger.info(SUBMISSION_ACTIONS_CONTEXT, `moderateSubmission: Starting for ID ${submissionId}, Approval: ${approve}`);
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (e: any) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, "moderateSubmission: Failed to create Supabase Admin Client:", e.message);
    return { success: false, error: `Server configuration error: ${e.message}. Contact support.` };
  }
  
  const supabaseServerClient = await createServerSupabaseClient();

  const { data: { user: authUser } } = await supabaseServerClient.auth.getUser();
  if (!authUser) {
      logger.warn(SUBMISSION_ACTIONS_CONTEXT, "moderateSubmission: Authentication required.");
      return { success: false, error: 'Authentication required' };
  }
  logger.info(SUBMISSION_ACTIONS_CONTEXT, `moderateSubmission: Authenticated admin ID: ${authUser.id}`);

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', authUser.id).single();
  if (profile?.role !== 'admin') {
      logger.warn(SUBMISSION_ACTIONS_CONTEXT, "moderateSubmission: Administrator privileges required.");
      return { success: false, error: 'Administrator privileges required' };
  }

  // Get submission details before updating for points awarding
  const { data: submission, error: fetchError } = await supabaseAdmin
    .from('submissions')
    .select('user_id, submission_date')
    .eq('id', submissionId)
    .single();

  if (fetchError || !submission) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, `moderateSubmission: Error fetching submission details: ${fetchError?.message}`);
    return { success: false, error: 'Submission not found' };
  }

  const { error } = await supabaseAdmin
      .from('submissions')
      .update({ approved: approve })
      .eq('id', submissionId);

  if (error) {
      logger.error(SUBMISSION_ACTIONS_CONTEXT, `moderateSubmission: Error moderating submission ${submissionId}:`, error.message);
      return { success: false, error: error.message };
  }

  // Award points if submission is being approved
  if (approve) {
    const submissionDate = new Date(submission.submission_date);
    const { pointsAwarded, error: pointsError } = await awardSubmissionPoints(submission.user_id, submissionDate, supabaseAdmin);
    
    if (pointsError) {
      logger.warn(SUBMISSION_ACTIONS_CONTEXT, `moderateSubmission: Error awarding points for approved submission: ${pointsError}`);
      // Don't fail the approval, just warn
    } else if (pointsAwarded) {
      logger.info(SUBMISSION_ACTIONS_CONTEXT, `moderateSubmission: Awarded ${pointsAwarded} points to user ${submission.user_id} for approved submission.`);
    }
  }

  logger.info(SUBMISSION_ACTIONS_CONTEXT, `moderateSubmission: Submission ${submissionId} successfully moderated (Approved: ${approve}).`);
  revalidatePath('/admin');
  revalidatePath('/posts');
  return { success: true };
}

/**
 * Deletes a submission and its associated photos from storage (admin only)
 * @param submissionId - The ID of the submission to delete
 * @returns Promise containing success status or error message
 */
export async function deleteSubmissionByAdmin(submissionId: string): Promise<{ success: boolean; error?: string }> {
  logger.info(SUBMISSION_ACTIONS_CONTEXT, `deleteSubmissionByAdmin: Starting for ID ${submissionId}`);
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (e: any) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, "deleteSubmissionByAdmin: Failed to create Supabase Admin Client:", e.message);
    return { success: false, error: `Server configuration error: ${e.message}. Contact support.` };
  }

  const supabaseServerClient = await createServerSupabaseClient();
  const { data: { user: authUser } } = await supabaseServerClient.auth.getUser();

  if (!authUser) {
    logger.warn(SUBMISSION_ACTIONS_CONTEXT, "deleteSubmissionByAdmin: Authentication required.");
    return { success: false, error: 'Authentication required' };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    logger.warn(SUBMISSION_ACTIONS_CONTEXT, "deleteSubmissionByAdmin: Administrator privileges required.");
    return { success: false, error: 'Administrator privileges required' };
  }
  
  const { data: submissionToDelete, error: fetchError } = await supabaseAdmin
    .from('submissions')
    .select('photo_urls')
    .eq('id', submissionId)
    .single();

  if (fetchError || !submissionToDelete) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, `deleteSubmissionByAdmin: Unable to find submission with ID ${submissionId} or error: ${fetchError?.message}`);
    return { success: false, error: 'Submission not found or error retrieving it.' };
  }
  
  const { error: deleteDbError } = await supabaseAdmin
    .from('submissions')
    .delete()
    .eq('id', submissionId);

  if (deleteDbError) {
    logger.error(SUBMISSION_ACTIONS_CONTEXT, `deleteSubmissionByAdmin: Error deleting submission from DB (ID: ${submissionId}):`, deleteDbError.message);
    return { success: false, error: `Error deleting submission from DB: ${deleteDbError.message}` };
  }
  logger.info(SUBMISSION_ACTIONS_CONTEXT, `deleteSubmissionByAdmin: Submission ID ${submissionId} deleted from DB.`);

  // Clean up associated photos from storage using improved utilities
  if (submissionToDelete.photo_urls && Array.isArray(submissionToDelete.photo_urls)) {
    logger.info(SUBMISSION_ACTIONS_CONTEXT, `deleteSubmissionByAdmin: Processing ${submissionToDelete.photo_urls.length} photo URLs for deletion from submission ID ${submissionId}`);
    
    const { success: storageSuccess, deletedCount, errors } = await deleteStorageFilesByUrls(
      submissionToDelete.photo_urls, 
      'submissions', 
      15000 // 15 second timeout for storage operations
    );

    if (errors.length > 0) {
      logger.warn(SUBMISSION_ACTIONS_CONTEXT, `deleteSubmissionByAdmin: Some files could not be deleted from storage for submission ID ${submissionId}:`, errors);
    }

    if (storageSuccess) {
      logger.info(SUBMISSION_ACTIONS_CONTEXT, `deleteSubmissionByAdmin: Successfully deleted ${deletedCount} storage files for submission ID ${submissionId}`);
    } else {
      logger.error(SUBMISSION_ACTIONS_CONTEXT, `deleteSubmissionByAdmin: Storage cleanup completed with ${deletedCount}/${submissionToDelete.photo_urls.length} files deleted for submission ID ${submissionId}`);
    }
  } else {
    logger.debug(SUBMISSION_ACTIONS_CONTEXT, `deleteSubmissionByAdmin: No photo URLs found for submission ID ${submissionId}, skipping storage cleanup`);
  }

  logger.info(SUBMISSION_ACTIONS_CONTEXT, `deleteSubmissionByAdmin: Submission ID ${submissionId} and associated files processed for deletion.`);
  revalidatePath('/admin');
  revalidatePath('/posts');
  return { success: true };
}
