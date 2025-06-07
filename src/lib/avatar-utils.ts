import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { extractStoragePathFromUrl as extractGenericStoragePath, deleteStorageFile } from '@/lib/storage-utils';

const AVATAR_UTILS_CONTEXT = "AvatarUtils";

/**
 * Extract storage path from a Supabase avatar storage URL
 * @param avatarUrl The full avatar URL from Supabase storage
 * @returns The storage path or null if URL is invalid
 * @deprecated Use the generic extractStoragePathFromUrl from storage-utils instead
 */
export function extractStoragePathFromUrl(avatarUrl: string | null | undefined): string | null {
  return extractGenericStoragePath(avatarUrl, 'avatars');
}

/**
 * Delete an avatar file from Supabase storage using the enhanced storage utilities
 * @param avatarUrl The full avatar URL to delete
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function deleteAvatarFromStorage(avatarUrl: string | null | undefined): Promise<{ success: boolean; error?: string }> {
  if (!avatarUrl) {
    logger.debug(AVATAR_UTILS_CONTEXT, "deleteAvatarFromStorage: No avatar URL provided, nothing to delete");
    return { success: true };
  }
  
  const storagePath = extractStoragePathFromUrl(avatarUrl);
  if (!storagePath) {
    logger.debug(AVATAR_UTILS_CONTEXT, `deleteAvatarFromStorage: Could not extract storage path from URL: ${avatarUrl}`);
    return { success: true }; // Not a storage file, nothing to delete
  }
  
  logger.info(AVATAR_UTILS_CONTEXT, `deleteAvatarFromStorage: Delegating deletion to storage utils for path: ${storagePath}`);
  
  // Use the enhanced storage utility with avatar-specific timeout
  const result = await deleteStorageFile('avatars', storagePath, 5000);
  
  if (result.success) {
    logger.info(AVATAR_UTILS_CONTEXT, `deleteAvatarFromStorage: Successfully deleted avatar at path: ${storagePath}`);
  } else {
    logger.error(AVATAR_UTILS_CONTEXT, `deleteAvatarFromStorage: Failed to delete avatar ${storagePath}:`, result.error);
  }
  
  return result;
}

/**
 * Get the current avatar URL from the database before updating
 * @param userId The user ID to get the avatar for
 * @returns Promise<string | null> The current avatar URL or null
 */
export async function getCurrentAvatarUrl(userId: string): Promise<string | null> {
  try {
    const supabaseAdmin = createAdminClient();
    
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();
    
    if (error) {
      logger.error(AVATAR_UTILS_CONTEXT, `getCurrentAvatarUrl: Error fetching current avatar for user ${userId}:`, error.message);
      return null;
    }
    
    return profile?.avatar_url || null;
  } catch (error: any) {
    logger.error(AVATAR_UTILS_CONTEXT, `getCurrentAvatarUrl: Unexpected error:`, error.message);
    return null;
  }
}

/**
 * Clean up old avatar when updating to a new one (NON-BLOCKING)
 * This function runs in the background and doesn't block the main update process
 * @param userId The user ID
 * @param newAvatarUrl The new avatar URL (null for removal)
 * @returns Promise<void> - Fire and forget, errors are logged but don't affect the caller
 */
export async function cleanupOldAvatarAsync(userId: string, newAvatarUrl: string | null | undefined): Promise<void> {
  try {
    // Get the current avatar URL from the database
    const currentAvatarUrl = await getCurrentAvatarUrl(userId);
    
    // If there's no current avatar, nothing to clean up
    if (!currentAvatarUrl) {
      logger.debug(AVATAR_UTILS_CONTEXT, `cleanupOldAvatarAsync: No current avatar for user ${userId}, nothing to clean up`);
      return;
    }
    
    // If the new avatar URL is the same as the current one, no cleanup needed
    if (currentAvatarUrl === newAvatarUrl) {
      logger.debug(AVATAR_UTILS_CONTEXT, `cleanupOldAvatarAsync: New avatar URL is same as current for user ${userId}, no cleanup needed`);
      return;
    }
    
    // Delete the old avatar with timeout protection
    const deleteResult = await deleteAvatarFromStorage(currentAvatarUrl);
    if (!deleteResult.success) {
      logger.warn(AVATAR_UTILS_CONTEXT, `cleanupOldAvatarAsync: Failed to delete old avatar for user ${userId}:`, deleteResult.error);
    } else {
      logger.info(AVATAR_UTILS_CONTEXT, `cleanupOldAvatarAsync: Successfully cleaned up old avatar for user ${userId}`);
    }
  } catch (error: any) {
    logger.error(AVATAR_UTILS_CONTEXT, `cleanupOldAvatarAsync: Unexpected error:`, error.message);
  }
}

/**
 * Clean up old avatar when updating to a new one (BLOCKING - for backward compatibility)
 * This function is designed to be called before the database update
 * @param userId The user ID
 * @param newAvatarUrl The new avatar URL (null for removal)
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function cleanupOldAvatar(userId: string, newAvatarUrl: string | null | undefined): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the current avatar URL from the database
    const currentAvatarUrl = await getCurrentAvatarUrl(userId);
    
    // If there's no current avatar, nothing to clean up
    if (!currentAvatarUrl) {
      logger.debug(AVATAR_UTILS_CONTEXT, `cleanupOldAvatar: No current avatar for user ${userId}, nothing to clean up`);
      return { success: true };
    }
    
    // If the new avatar URL is the same as the current one, no cleanup needed
    if (currentAvatarUrl === newAvatarUrl) {
      logger.debug(AVATAR_UTILS_CONTEXT, `cleanupOldAvatar: New avatar URL is same as current for user ${userId}, no cleanup needed`);
      return { success: true };
    }
    
    // Delete the old avatar with timeout protection
    const deleteResult = await deleteAvatarFromStorage(currentAvatarUrl);
    if (!deleteResult.success) {
      logger.warn(AVATAR_UTILS_CONTEXT, `cleanupOldAvatar: Failed to delete old avatar for user ${userId}:`, deleteResult.error);
      // Don't fail the entire operation if avatar cleanup fails
      return { success: true, error: `Avatar cleanup warning: ${deleteResult.error}` };
    }
    
    logger.info(AVATAR_UTILS_CONTEXT, `cleanupOldAvatar: Successfully cleaned up old avatar for user ${userId}`);
    return { success: true };
  } catch (error: any) {
    logger.error(AVATAR_UTILS_CONTEXT, `cleanupOldAvatar: Unexpected error:`, error.message);
    return { success: true, error: `Avatar cleanup warning: ${error.message}` };
  }
}
