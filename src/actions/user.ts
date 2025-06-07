'use server';

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { cleanupOldAvatarAsync } from '@/lib/avatar-utils';
import { fileTypeFromBuffer } from 'file-type';
import validator from 'validator';
import sharp from 'sharp';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import type { User } from '@/types';

const USER_ACTIONS_CONTEXT = "UserActions";

// Security configurations
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_LENGTH = 1000;

// Rate limiters
const profileUpdateLimiter = new RateLimiterMemory({
  keyPrefix: 'profile_update',
  points: 10,
  duration: 60 * 60, // 1 hour
  blockDuration: 10 * 60, // 10 minutes
});

const registrationLimiter = new RateLimiterMemory({
  keyPrefix: 'registration',
  points: 3,
  duration: 60 * 60, // 1 hour
  blockDuration: 60 * 60, // 1 hour
});

/**
 * Validates email format and security constraints
 * @param email - Email address to validate
 * @returns Object containing validation result and error message if invalid
 */
function validateEmail(email: string | null | undefined): { isValid: boolean; error?: string } {
  if (!email) return { isValid: false, error: 'Email is required' };
  if (typeof email !== 'string') return { isValid: false, error: 'Email must be a string' };
  if (!validator.isEmail(email)) return { isValid: false, error: 'Invalid email format' };
  if (email.length > 254) return { isValid: false, error: 'Email is too long' };
  
  const suspiciousPatterns = [/[<>]/, /javascript:/i, /vbscript:/i, /data:/i];
  if (suspiciousPatterns.some(pattern => pattern.test(email))) {
    return { isValid: false, error: 'Email contains invalid characters' };
  }
  
  return { isValid: true };
}

/**
 * Validates and sanitizes text input to prevent XSS attacks
 * @param input - Text input to validate and sanitize
 * @param maxLength - Maximum allowed length for the input
 * @returns Object containing validation result, sanitized text, and error message if invalid
 */
function validateAndSanitizeText(input: string | null | undefined, maxLength: number = MAX_TEXT_LENGTH): { isValid: boolean; sanitized?: string; error?: string } {
  if (!input) return { isValid: true, sanitized: '' };
  if (typeof input !== 'string') return { isValid: false, error: 'Input must be a string' };
  if (input.length > maxLength) return { isValid: false, error: `Input exceeds maximum length of ${maxLength} characters` };
  
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=\s*["'][^"']*["']/gi,
  ];
  
  if (xssPatterns.some(pattern => pattern.test(input))) {
    return { isValid: false, error: 'Input contains potentially unsafe content' };
  }
  
  const sanitized = validator.escape(input.replace(/<[^>]*>/g, ''));
  return { isValid: true, sanitized };
}

/**
 * Validates file upload for avatar images including type and size checks
 * @param file - File to validate
 * @returns Promise containing validation result, error message, and detected file type
 */
async function validateFileUpload(file: File): Promise<{ isValid: boolean; error?: string; detectedType?: string }> {
  if (!file || file.size === 0) return { isValid: false, error: 'File is empty or invalid' };
  if (file.size > MAX_AVATAR_SIZE) return { isValid: false, error: `File size exceeds ${MAX_AVATAR_SIZE / (1024 * 1024)}MB limit` };
  
  const buffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  const detectedFileType = await fileTypeFromBuffer(uint8Array);
  
  if (!detectedFileType) return { isValid: false, error: 'Unable to determine file type' };
  if (!ALLOWED_AVATAR_TYPES.includes(detectedFileType.mime)) {
    return { isValid: false, error: `File type ${detectedFileType.mime} is not allowed` };
  }
  
  return { isValid: true, detectedType: detectedFileType.mime };
}

/**
 * Processes avatar image securely by resizing, optimizing, and stripping metadata
 * @param file - Avatar file to process
 * @returns Promise containing processing result, processed buffer, MIME type, and error message if failed
 */
async function processSecureAvatar(file: File): Promise<{ success: boolean; processedBuffer?: Buffer; mimeType?: string; error?: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(buffer);
    
    const processedImage = await sharp(inputBuffer)
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 90, progressive: true, mozjpeg: true })
      .withMetadata({}) // Strip metadata
      .toBuffer();
    
    return {
      success: true,
      processedBuffer: processedImage,
      mimeType: 'image/jpeg'
    };
  } catch (error: any) {
    logger.error(USER_ACTIONS_CONTEXT, `Error processing avatar: ${error.message}`);
    return { success: false, error: 'Failed to process avatar image' };
  }
}

/**
 * Generates a secure filename for avatar uploads
 * @param originalFilename - Original filename (not used in final name for security)
 * @param userId - User ID to include in filename
 * @returns Secure filename with timestamp and random component
 */
function generateSecureFilename(originalFilename: string, userId: string): string {
  const timestamp = Date.now();
  const randomComponent = Math.random().toString(36).substring(2, 15);
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  return `avatar_${sanitizedUserId}_${timestamp}_${randomComponent}.jpg`;
}

/**
 * Checks rate limit for a given key using the specified limiter
 * @param limiter - Rate limiter instance to use
 * @param key - Key to check rate limit for (usually IP or user ID)
 * @returns Promise containing rate limit check result and error message if exceeded
 */
async function checkRateLimit(limiter: RateLimiterMemory, key: string): Promise<{ success: boolean; error?: string }> {
  try {
    await limiter.consume(key);
    return { success: true };
  } catch (rejRes: any) {
    const waitMinutes = Math.ceil(rejRes.msBeforeNext / 1000 / 60);
    return { success: false, error: `Rate limit exceeded. Please try again in ${waitMinutes} minute(s).` };
  }
}

/**
 * Timeout wrapper utility function that prevents infinite loading states
 * @param promiseFunction - Function that returns a promise to wrap with timeout
 * @param timeoutMs - Timeout in milliseconds (default: 12000ms = 12 seconds)
 * @returns Promise that either resolves with the original result or rejects with timeout error
 */
function withTimeout<T>(promiseFunction: () => Promise<T>, timeoutMs: number = 8000): Promise<T> {
  return Promise.race([
    promiseFunction(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out after 8 seconds')), timeoutMs)
    )
  ]);
}

/**
 * Interface for user profile update parameters
 */
interface UserProfileUpdates {
  name?: string;
  avatarUrl?: string | null; // Allow null for removal
  avatarFile?: File | null; // For file uploads
  removeAvatar?: boolean;
}

/**
 * Updates user profile with security validation, file processing, and cache revalidation
 * @param userId - ID of the user whose profile to update
 * @param updates - Object containing profile updates (name, avatar, etc.)
 * @param clientIP - Client IP address for rate limiting (optional)
 * @returns Promise containing updated user data or error message
 */
export async function updateUserProfileAndRevalidate(
  userId: string,
  updates: UserProfileUpdates,
  clientIP?: string
): Promise<{ data?: User; error?: string }> {
  logger.info(USER_ACTIONS_CONTEXT, `updateUserProfileAndRevalidate: Called for user ID ${userId}`);

  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();

    // Get current user and validate authorization
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      logger.error(USER_ACTIONS_CONTEXT, "Authentication failed", authError?.message);
      return { error: 'Authentication required' };
    }

    // Verify user can only update their own profile (unless admin)
    if (authUser.id !== userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authUser.id)
        .single();
      
      if (!profile || profile.role !== 'admin') {
        logger.warn(USER_ACTIONS_CONTEXT, `User ${authUser.id} attempted to update ${userId}'s profile`);
        return { error: 'Unauthorized to update this profile' };
      }
    }

    // Apply rate limiting
    const rateLimitKey = clientIP || authUser.id;
    const rateLimitResult = await checkRateLimit(profileUpdateLimiter, rateLimitKey);
    if (!rateLimitResult.success) {
      logger.warn(USER_ACTIONS_CONTEXT, `Rate limit exceeded for ${rateLimitKey}`);
      return { error: rateLimitResult.error };
    }

    // Validate and sanitize text inputs
    let sanitizedName: string | undefined;
    if (updates.name !== undefined) {
      const nameValidation = validateAndSanitizeText(updates.name, 100);
      if (!nameValidation.isValid) {
        return { error: `Invalid name: ${nameValidation.error}` };
      }
      sanitizedName = nameValidation.sanitized;
    }

    // Process avatar upload if provided
    let newAvatarUrl: string | null | undefined = updates.avatarUrl;
    if (updates.removeAvatar) {
      newAvatarUrl = null;
      logger.info(USER_ACTIONS_CONTEXT, `Removing avatar for user ${userId}`);
    } else if (updates.avatarFile && updates.avatarFile.size > 0) {
      logger.info(USER_ACTIONS_CONTEXT, `Processing avatar upload for user ${userId}`);
      
      // Validate file
      const validation = await validateFileUpload(updates.avatarFile);
      if (!validation.isValid) {
        return { error: `Avatar upload failed: ${validation.error}` };
      }

      // Process avatar securely
      const processResult = await processSecureAvatar(updates.avatarFile);
      if (!processResult.success) {
        logger.error(USER_ACTIONS_CONTEXT, `Avatar processing failed: ${processResult.error}`);
        return { error: `Avatar processing failed: ${processResult.error}` };
      }

      // Upload processed avatar to storage
      try {
        const supabaseAdmin = createAdminClient();
        const secureFilename = generateSecureFilename(updates.avatarFile.name, userId);
        const storagePath = `avatars/users/${userId}/${secureFilename}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('avatars')
          .upload(storagePath, processResult.processedBuffer!, {
            contentType: processResult.mimeType,
            upsert: true
          });

        if (uploadError) {
          logger.error(USER_ACTIONS_CONTEXT, `Avatar upload failed: ${uploadError.message}`);
          return { error: `Avatar upload failed: ${uploadError.message}` };
        }

        const { data: publicUrlData } = supabaseAdmin.storage
          .from('avatars')
          .getPublicUrl(storagePath);

        newAvatarUrl = publicUrlData?.publicUrl;
        logger.info(USER_ACTIONS_CONTEXT, `Avatar uploaded successfully: ${newAvatarUrl}`);

      } catch (error: any) {
        logger.error(USER_ACTIONS_CONTEXT, `Avatar upload error: ${error.message}`);
        return { error: 'Avatar upload failed due to server error' };
      }
    }

    // Start avatar cleanup in background if avatar is being updated
    if (newAvatarUrl !== undefined) {
      logger.info(USER_ACTIONS_CONTEXT, `Starting background avatar cleanup for user ${userId}`);
      cleanupOldAvatarAsync(userId, newAvatarUrl).catch(error => {
        logger.warn(USER_ACTIONS_CONTEXT, `Background avatar cleanup failed for user ${userId}: ${error.message}`);
      });
    }

    // Update Supabase Auth user_metadata
    const authMetadataUpdates: { name?: string; avatar_url?: string | null } = {};
    if (sanitizedName !== undefined) {
      authMetadataUpdates.name = sanitizedName;
    }
    if (newAvatarUrl !== undefined) {
      authMetadataUpdates.avatar_url = newAvatarUrl;
    }

  if (Object.keys(authMetadataUpdates).length > 0) {
    const { data: { user: authUserBeforeUpdate } } = await supabase.auth.getUser();
    const existingMetadata = authUserBeforeUpdate?.user_metadata || {};

    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: { ...existingMetadata, ...authMetadataUpdates },
    });

    if (authUpdateError) {
      logger.error(USER_ACTIONS_CONTEXT, `updateUserProfileAndRevalidate: Error updating auth user metadata for ${userId}:`, authUpdateError.message);
      return { error: `Failed to update auth metadata: ${authUpdateError.message}` };
    }
    logger.info(USER_ACTIONS_CONTEXT, `Auth user metadata updated for ${userId}`);
  }

  // Update profiles table
  const profileTableUpdates: { name?: string; avatar_url?: string | null; updated_at?: string } = {};
  if (sanitizedName !== undefined) {
    profileTableUpdates.name = sanitizedName;
  }
  if (newAvatarUrl !== undefined) {
    profileTableUpdates.avatar_url = newAvatarUrl;
  }
  profileTableUpdates.updated_at = new Date().toISOString();

  if (Object.keys(profileTableUpdates).length > 1) { // More than just updated_at
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update(profileTableUpdates)
      .eq('id', userId);

    if (profileUpdateError) {
      logger.error(USER_ACTIONS_CONTEXT, `updateUserProfileAndRevalidate: Error updating profile table for ${userId}:`, profileUpdateError.message);
      return { error: `Failed to update profile: ${profileUpdateError.message}` };
    }
    logger.info(USER_ACTIONS_CONTEXT, `Profile table updated for ${userId}`);
  }

  // Revalidate paths
  try {
    revalidatePath('/leaderboard');
    revalidatePath('/');
    revalidatePath('/settings');
    logger.info(USER_ACTIONS_CONTEXT, "Revalidated paths");
  } catch (revalError: any) {
    logger.warn(USER_ACTIONS_CONTEXT, "Error during path revalidation:", revalError.message);
  }

  // Fetch and return the updated profile
  const { data: refreshedProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, email, name, avatar_url, score, role, starred_submissions, updated_at')
    .eq('id', userId)
    .single();

  if (fetchError) {
    logger.error(USER_ACTIONS_CONTEXT, `Error fetching updated profile for ${userId}: ${fetchError.message}`);
    return { error: `Failed to fetch updated profile: ${fetchError.message}` };
  }

  if (!refreshedProfile) {
    logger.error(USER_ACTIONS_CONTEXT, `Updated profile for ${userId} not found`);
    return { error: 'Updated profile not found' };
  }

  // Transform database fields to match User interface
  const transformedProfile: User = {
    ...refreshedProfile,
    avatarUrl: refreshedProfile.avatar_url || undefined,
  };
  delete (transformedProfile as any).avatar_url;

  logger.info(USER_ACTIONS_CONTEXT, `Successfully updated profile for ${userId}`);
  return { data: transformedProfile };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 8 seconds') {
      logger.error(USER_ACTIONS_CONTEXT, "Request timed out");
      return { error: 'Request timed out. Please try again later.' };
    }
    logger.error(USER_ACTIONS_CONTEXT, "Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}
