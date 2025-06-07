"use server";

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import type { User } from '@/types';
import { logger } from '@/lib/logger';

/** Context identifier for logging leaderboard-related operations */
const LEADERBOARD_ACTIONS_CONTEXT = "LeaderboardActions";

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
 * Fetches users for the leaderboard.
 * Orders by score (desc) then name (asc). Admins are now included.
 * @returns {Promise<{ data?: User[]; error?: string | null }>}
 *          A promise that resolves to an object containing an array of users for the leaderboard,
 *          or an error message if the fetch fails.
 */
export async function getLeaderboardUsers(): Promise<{ data?: User[]; error?: string | null }> {
  logger.info(LEADERBOARD_ACTIONS_CONTEXT, "getLeaderboardUsers: Starting user retrieval for leaderboard.");
  
  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError) {
        logger.warn(LEADERBOARD_ACTIONS_CONTEXT, "getLeaderboardUsers: Auth error while attempting to retrieve current user (not critical for public leaderboard if RLS allows anonymous)", authError.message);
    } else if (authUser) {
        logger.info(LEADERBOARD_ACTIONS_CONTEXT, `getLeaderboardUsers: Called by authenticated user ${authUser.id}`);
    } else {
        logger.info(LEADERBOARD_ACTIONS_CONTEXT, "getLeaderboardUsers: Called by anonymous user or no session.");
    }

    // Try with regular client first
    let { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email, role, score, avatar_url, starred_submissions')
      .order('score', { ascending: false })
      .order('name', { ascending: true });

    // Check if we got limited results due to RLS (only current user or no users)
    const shouldUseAdminClient = profilesError && (
      profilesError.code === '42501' ||
      profilesError.message.toLowerCase().includes('permission denied')
    ) || (profiles && profiles.length <= 1 && authUser); // If authenticated but only got 1 or 0 results

    if (shouldUseAdminClient || (profiles && profiles.length <= 1)) {
      logger.warn(LEADERBOARD_ACTIONS_CONTEXT, `getLeaderboardUsers: Limited results (${profiles?.length || 0} profiles), using admin client for complete leaderboard`);
      
      try {
        const adminSupabase = createAdminClient();
        const { data: adminProfiles, error: adminError } = await adminSupabase
          .from('profiles')
          .select('id, name, email, role, score, avatar_url, starred_submissions')
          .order('score', { ascending: false })
          .order('name', { ascending: true });
        
        if (adminError) {
          logger.error(LEADERBOARD_ACTIONS_CONTEXT, 'getLeaderboardUsers: Admin client failed:', adminError.message);
          // Fall back to regular client results if admin fails
          if (!profilesError && profiles) {
            logger.warn(LEADERBOARD_ACTIONS_CONTEXT, 'getLeaderboardUsers: Falling back to regular client results');
          } else {
            return { error: `Error retrieving leaderboard: ${adminError.message}` };
          }
        } else {
          profiles = adminProfiles;
          profilesError = null;
          logger.info(LEADERBOARD_ACTIONS_CONTEXT, `getLeaderboardUsers: Successfully retrieved ${adminProfiles?.length || 0} profiles using admin client`);
        }
      } catch (adminClientError: any) {
        logger.error(LEADERBOARD_ACTIONS_CONTEXT, 'getLeaderboardUsers: Failed to create admin client:', adminClientError.message);
        // Fall back to regular client results if available
        if (!profilesError && profiles) {
          logger.warn(LEADERBOARD_ACTIONS_CONTEXT, 'getLeaderboardUsers: Admin client unavailable, using regular client results');
        } else {
          return { error: "Server configuration error for leaderboard. Contact support." };
        }
      }
    }

    if (profilesError) {
      logger.error(LEADERBOARD_ACTIONS_CONTEXT, 'getLeaderboardUsers: Error retrieving profiles:', profilesError.message, profilesError.details);
      if (profilesError.code === 'PGRST000' || profilesError.message.includes('fetch failed')) {
          return { error: "Database connection error. Try again later." };
      }
      if (profilesError.message.includes('Results contain 0 rows') || (profilesError.details && profilesError.details.includes('The result contains 0 rows'))) {
          logger.info(LEADERBOARD_ACTIONS_CONTEXT, "getLeaderboardUsers: No profiles found (possibly due to RLS or empty table).");
          return { data: [] };
      }
      return { error: `Error retrieving leaderboard: ${profilesError.message}. Check logs and RLS configuration.` };
    }

    if (!profiles) {
      logger.info(LEADERBOARD_ACTIONS_CONTEXT, "getLeaderboardUsers: No profile data returned (empty array), but no specific error.");
      return { data: [] };
    }

    // Transform database fields to match User interface
    const transformedProfiles: User[] = profiles.map(profile => ({
      ...profile,
      avatarUrl: profile.avatar_url || undefined, // Transform avatar_url to avatarUrl
      avatar_url: undefined // Remove the original field to avoid confusion
    })).map(({ avatar_url, ...rest }) => rest); // Clean up the avatar_url field completely

    logger.info(LEADERBOARD_ACTIONS_CONTEXT, `getLeaderboardUsers: Successfully retrieved ${transformedProfiles.length} users for leaderboard.`);
    return { data: transformedProfiles };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(LEADERBOARD_ACTIONS_CONTEXT, "getLeaderboardUsers: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(LEADERBOARD_ACTIONS_CONTEXT, "getLeaderboardUsers: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}
