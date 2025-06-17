"use server";
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { nowISOEuropean, formatDateForEuropeanTimezone } from '@/lib/utils';
import { getActiveSpecialEventForDate } from '@/actions/events';
import { fileTypeFromBuffer } from 'file-type';
import validator from 'validator';
import sharp from 'sharp';
import { RateLimiterMemory } from 'rate-limiter-flexible';

/** Context identifier for logging content-related operations */
const CONTENT_ACTIONS_CONTEXT = "ContentActions";

// Security configurations
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 1000;

// Rate limiters
const contentSubmissionLimiter = new RateLimiterMemory({
  keyPrefix: 'content_submit',
  points: 10,
  duration: 60 * 60, // 1 hour
  blockDuration: 10 * 60, // 10 minutes
});

/**
 * Validates and sanitizes text input to prevent XSS attacks and enforce length limits.
 * @param {string | null | undefined} input - The text input to validate and sanitize.
 * @param {number} maxLength - Maximum allowed length for the input (default: MAX_TEXT_LENGTH).
 * @returns {{ isValid: boolean; sanitized?: string; error?: string }} Validation result with sanitized text or error message.
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
 * Validates uploaded files for type, size, and security.
 * @param {File} file - The file to validate.
 * @returns {Promise<{ isValid: boolean; error?: string; detectedType?: string }>} Validation result with detected file type or error message.
 */
async function validateFileUpload(file: File): Promise<{ isValid: boolean; error?: string; detectedType?: string }> {
  if (!file || file.size === 0) return { isValid: false, error: 'File is empty or invalid' };
  if (file.size > MAX_FILE_SIZE) return { isValid: false, error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` };
  
  const buffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  const detectedFileType = await fileTypeFromBuffer(uint8Array);
  
  if (!detectedFileType) return { isValid: false, error: 'Unable to determine file type' };
  if (!ALLOWED_IMAGE_TYPES.includes(detectedFileType.mime)) {
    return { isValid: false, error: `File type ${detectedFileType.mime} is not allowed` };
  }
  
  return { isValid: true, detectedType: detectedFileType.mime };
}

/**
 * Processes and secures image files by resizing, converting to JPEG, and stripping metadata.
 * @param {File} file - The image file to process.
 * @returns {Promise<{ success: boolean; processedBuffer?: Buffer; mimeType?: string; error?: string }>} Processing result with processed buffer or error message.
 */
async function processSecureImage(file: File): Promise<{ success: boolean; processedBuffer?: Buffer; mimeType?: string; error?: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(buffer);
    
    const processedImage = await sharp(inputBuffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true, mozjpeg: true })
      .withMetadata({}) // Strip metadata
      .toBuffer();
    
    return {
      success: true,
      processedBuffer: processedImage,
      mimeType: 'image/jpeg'
    };
  } catch (error: any) {
    logger.error(CONTENT_ACTIONS_CONTEXT, `Error processing image: ${error.message}`);
    return { success: false, error: 'Failed to process image' };
  }
}

/**
 * Generates a secure filename for uploaded files.
 * @param {string} originalFilename - The original filename.
 * @param {string} userId - The user ID for the file owner.
 * @returns {string} A secure filename with timestamp and random component.
 */
function generateSecureFilename(originalFilename: string, userId: string): string {
  const timestamp = Date.now();
  const randomComponent = Math.random().toString(36).substring(2, 15);
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  return `submission_${sanitizedUserId}_${timestamp}_${randomComponent}.jpg`;
}

/**
 * Checks rate limiting for a given key using the provided rate limiter.
 * @param {RateLimiterMemory} limiter - The rate limiter instance to use.
 * @param {string} key - The key to check rate limiting for.
 * @returns {Promise<{ success: boolean; error?: string }>} Rate limit check result with error message if limit exceeded.
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

// Points system configuration
const BASE_SUBMISSION_POINTS = 50; // Base points for posting
const BONUS_POINTS_PER_STAR = 10;  // Additional points for stars (already implemented)

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
 * @param {string} userId - The user ID to award points to
 * @param {Date} submissionDate - The date of the submission to check for special events
 * @param {any} supabaseAdmin - Admin client for database operations
 * @returns {Promise<{ pointsAwarded?: number; error?: string }>} Promise with points awarded or error
 */
async function awardSubmissionPoints(userId: string, submissionDate: Date, supabaseAdmin: any): Promise<{ pointsAwarded?: number; error?: string }> {
  try {
    // Check for special events on submission date
    const { data: specialEvent, error: eventError } = await getActiveSpecialEventForDate(submissionDate);
    
    if (eventError) {
      logger.warn(CONTENT_ACTIONS_CONTEXT, `awardSubmissionPoints: Could not check for special events: ${eventError}`);
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
      logger.error(CONTENT_ACTIONS_CONTEXT, `awardSubmissionPoints: Error fetching user profile: ${profileError.message}`);
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
      logger.error(CONTENT_ACTIONS_CONTEXT, `awardSubmissionPoints: Error updating user score: ${updateError.message}`);
      return { error: `Error updating user score: ${updateError.message}` };
    }
    
    logger.info(CONTENT_ACTIONS_CONTEXT, `awardSubmissionPoints: Awarded ${totalPoints} points to user ${userId} (Base: ${basePoints}, Bonus: ${bonusPoints}, Special Event: ${specialEvent?.name || 'None'})`);
    
    return { pointsAwarded: totalPoints };
  } catch (e: any) {
    logger.error(CONTENT_ACTIONS_CONTEXT, `awardSubmissionPoints: Unexpected error: ${e.message}`);
    return { error: `Unexpected error awarding points: ${e.message}` };
  }
}

/**
 * Submits content with photos and optional summary.
 * Handles file validation, image processing, secure upload, and database insertion.
 * Auto-approves submissions from admin users and awards points accordingly.
 * @param {FormData} formData - Form data containing photos and optional summary.
 * @param {string} [clientIP] - Optional client IP address for rate limiting.
 * @returns {Promise<{ success: boolean; error?: string, submissionId?: string }>} Submission result with success status, optional error message, and submission ID.
 */
export async function submitContentAction(formData: FormData, clientIP?: string): Promise<{ success: boolean; error?: string, submissionId?: string }> {
  logger.info(CONTENT_ACTIONS_CONTEXT, "Starting secure content submission");
  
  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();

    // Authenticate user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      logger.error(CONTENT_ACTIONS_CONTEXT, "Authentication failed", authError?.message);
      return { success: false, error: `Authentication required: ${authError?.message || 'No user session'}` };
    }

    // Apply rate limiting
    const rateLimitKey = clientIP || authUser.id;
    const rateLimitResult = await checkRateLimit(contentSubmissionLimiter, rateLimitKey);
    if (!rateLimitResult.success) {
      logger.warn(CONTENT_ACTIONS_CONTEXT, `Rate limit exceeded for ${rateLimitKey}`);
      return { success: false, error: rateLimitResult.error };
    }

    logger.info(CONTENT_ACTIONS_CONTEXT, `Authenticated user: ${authUser.id}`);

    // Check if user is admin for auto-approval
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    let isAdminUser = false;
    if (profile && !profileError && profile.role === 'admin') {
      isAdminUser = true;
      logger.info(CONTENT_ACTIONS_CONTEXT, "Admin user detected - submission will be auto-approved");
    } else if (profileError) {
      logger.warn(CONTENT_ACTIONS_CONTEXT, "Could not check admin status:", profileError.message);
    }

    // Validate and sanitize summary
    const summaryInput = formData.get('summary') as string | null;
    let sanitizedSummary: string | undefined;
    if (summaryInput) {
      const summaryValidation = validateAndSanitizeText(summaryInput, 1000);
      if (!summaryValidation.isValid) {
        return { success: false, error: `Invalid summary: ${summaryValidation.error}` };
      }
      sanitizedSummary = summaryValidation.sanitized;
    }

    // Extract and validate photo files
    const photoFiles: File[] = [];
    const photoEntries = formData.getAll('photos');
    for (const entry of photoEntries) {
      if (entry instanceof File) {
        photoFiles.push(entry);
      }
    }

    // Validate that we have photos
    const validFiles = photoFiles.filter(file => file instanceof File && file.size > 0);
    if (validFiles.length === 0) {
      logger.warn(CONTENT_ACTIONS_CONTEXT, "No valid photos provided");
      return { success: false, error: 'At least one valid photo is required' };
    }

    logger.info(CONTENT_ACTIONS_CONTEXT, `Processing ${validFiles.length} photo files`);

    // Initialize admin client for storage operations
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
      logger.info(CONTENT_ACTIONS_CONTEXT, "Supabase Admin Client created successfully");
    } catch (e: any) {
      logger.error(CONTENT_ACTIONS_CONTEXT, "Failed to create Supabase Admin Client:", e.message);
      return { success: false, error: `Server configuration error. Please contact support: ${e.message}` };
    }

    // Process and upload photos securely
    const photoUrls: string[] = [];
    
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      logger.debug(CONTENT_ACTIONS_CONTEXT, `Processing file ${i + 1}/${validFiles.length}: ${file.name}`);

      // Validate file
      const validation = await validateFileUpload(file);
      if (!validation.isValid) {
        logger.warn(CONTENT_ACTIONS_CONTEXT, `File validation failed for ${file.name}: ${validation.error}`);
        return { success: false, error: `File "${file.name}" failed validation: ${validation.error}` };
      }

      // Process image securely
      const processResult = await processSecureImage(file);
      if (!processResult.success) {
        logger.error(CONTENT_ACTIONS_CONTEXT, `Image processing failed for ${file.name}: ${processResult.error}`);
        return { success: false, error: `Failed to process image "${file.name}": ${processResult.error}` };
      }

      // Generate secure filename and upload
      const secureFilename = generateSecureFilename(file.name, authUser.id);
      const storagePath = `submissions/users/${authUser.id}/${secureFilename}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('submissions')
        .upload(storagePath, processResult.processedBuffer!, {
          contentType: processResult.mimeType,
          upsert: true
        });

      if (uploadError) {
        logger.error(CONTENT_ACTIONS_CONTEXT, `Upload failed for ${file.name}:`, uploadError.message);
        
        if (uploadError.message.includes("Bucket not found")) {
          return { success: false, error: `Upload error for "${file.name}": Storage bucket 'submissions' not found. Please contact support.` };
        }
        return { success: false, error: `Upload failed for "${file.name}": ${uploadError.message}` };
      }

      // Get public URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('submissions')
        .getPublicUrl(storagePath);

      if (publicUrlData?.publicUrl) {
        photoUrls.push(publicUrlData.publicUrl);
        logger.info(CONTENT_ACTIONS_CONTEXT, `File uploaded successfully: ${file.name} -> ${publicUrlData.publicUrl}`);
      } else {
        logger.warn(CONTENT_ACTIONS_CONTEXT, `File uploaded but failed to get public URL: ${file.name}`);
      }
    }

  if (photoUrls.length === 0 && photoFiles.some(f => f instanceof File && f.size > 0)) {
     logger.error(CONTENT_ACTIONS_CONTEXT, "submitContentAction: Failed to retrieve public URLs for any uploaded photos.");
     return { success: false, error: "Error processing uploaded photos (URL generation failed)." };
  }
   if (photoUrls.length === 0) { // This case also covers when no valid files were actually processed
     logger.error(CONTENT_ACTIONS_CONTEXT, "submitContentAction: No photo URLs generated.");
     return { success: false, error: "No valid photos were processed successfully." };
  }

  const submissionData = {
    user_id: authUser.id,
    photo_urls: photoUrls,
    summary: sanitizedSummary || undefined,
    submission_date: nowISOEuropean(),
    approved: isAdminUser ? true : null,
    stars_received: 0,
  };
  logger.debug(CONTENT_ACTIONS_CONTEXT, "submitContentAction: Submission data ready for insertion:", submissionData);

  const { data: newSubmission, error: insertError } = await supabaseAdmin
    .from('submissions')
    .insert(submissionData)
    .select('id')
    .single();

  if (insertError) {
    logger.error(CONTENT_ACTIONS_CONTEXT, 'submitContentAction: Error inserting submission into DB:', insertError.message);
    return { success: false, error: `Error saving submission: ${insertError.message}` };
  }

  if (!newSubmission || !newSubmission.id) {
     logger.error(CONTENT_ACTIONS_CONTEXT, 'submitContentAction: Submission insertion did not return an ID.');
    return { success: false, error: "Error saving submission, ID not generated." };
  }

  // Award points if submission is auto-approved (admin users)
  if (isAdminUser && submissionData.approved) {
    const submissionDate = new Date(submissionData.submission_date);
    const { pointsAwarded, error: pointsError } = await awardSubmissionPoints(authUser.id, submissionDate, supabaseAdmin);
    
    if (pointsError) {
      logger.warn(CONTENT_ACTIONS_CONTEXT, `submitContentAction: Error awarding points for auto-approved submission: ${pointsError}`);
      // Don't fail the submission, just warn
    } else if (pointsAwarded) {
      logger.info(CONTENT_ACTIONS_CONTEXT, `submitContentAction: Awarded ${pointsAwarded} points to admin user ${authUser.id} for auto-approved submission.`);
    }
  }

  logger.info(CONTENT_ACTIONS_CONTEXT, `submitContentAction: Submission created successfully by ${authUser.email}, ID: ${newSubmission.id}, Approved: ${submissionData.approved}`);

    revalidatePath('/posts');
    revalidatePath('/admin');

    return { success: true, submissionId: newSubmission.id };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(CONTENT_ACTIONS_CONTEXT, "submitContentAction: Request timed out");
      return { success: false, error: 'The request took too long. Please try again later.' };
    }
    logger.error(CONTENT_ACTIONS_CONTEXT, "submitContentAction: Unexpected error:", error.message);
    return { success: false, error: `Unexpected error: ${error.message}` };
  });
}
