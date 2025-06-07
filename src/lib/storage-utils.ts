import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const STORAGE_UTILS_CONTEXT = "StorageUtils";

/**
 * Extract storage path from a Supabase storage URL for any bucket
 * @param fileUrl The full file URL from Supabase storage
 * @param bucketName The name of the storage bucket (e.g., 'avatars', 'submissions')
 * @returns The storage path or null if URL is invalid
 */
export function extractStoragePathFromUrl(fileUrl: string | null | undefined, bucketName: string): string | null {
  if (!fileUrl) return null;
  
  try {
    // Supabase storage URLs typically follow this pattern:
    // https://[project-id].supabase.co/storage/v1/object/public/[bucket]/[path]
    const url = new URL(fileUrl);
    
    // Check if it's a Supabase storage URL
    if (!url.hostname.includes('supabase.co') || !url.pathname.includes('/storage/v1/object/public/')) {
      logger.debug(STORAGE_UTILS_CONTEXT, `extractStoragePathFromUrl: URL ${fileUrl} is not a Supabase storage URL`);
      return null;
    }
    
    // Extract the path after '/storage/v1/object/public/[bucket]/'
    const pathPattern = new RegExp(`/storage/v1/object/public/${bucketName}/(.+)$`);
    const pathMatch = url.pathname.match(pathPattern);
    
    if (pathMatch) {
      const storagePath = pathMatch[1];
      logger.debug(STORAGE_UTILS_CONTEXT, `extractStoragePathFromUrl: Extracted path: ${storagePath} from bucket: ${bucketName}`);
      return storagePath;
    }
    
    logger.debug(STORAGE_UTILS_CONTEXT, `extractStoragePathFromUrl: Could not extract path from URL: ${fileUrl} for bucket: ${bucketName}`);
    return null;
  } catch (error) {
    logger.warn(STORAGE_UTILS_CONTEXT, `extractStoragePathFromUrl: Invalid URL: ${fileUrl}`, error);
    return null;
  }
}

/**
 * Extract multiple storage paths from an array of URLs
 * @param fileUrls Array of file URLs from Supabase storage
 * @param bucketName The name of the storage bucket
 * @returns Array of valid storage paths (filters out null values)
 */
export function extractStoragePathsFromUrls(fileUrls: string[] | null | undefined, bucketName: string): string[] {
  if (!fileUrls || !Array.isArray(fileUrls)) {
    logger.debug(STORAGE_UTILS_CONTEXT, `extractStoragePathsFromUrls: No URLs provided or invalid array for bucket: ${bucketName}`);
    return [];
  }

  const validPaths = fileUrls
    .map(url => extractStoragePathFromUrl(url, bucketName))
    .filter((path): path is string => path !== null);

  logger.debug(STORAGE_UTILS_CONTEXT, `extractStoragePathsFromUrls: Extracted ${validPaths.length} valid paths from ${fileUrls.length} URLs for bucket: ${bucketName}`);
  return validPaths;
}

/**
 * Delete a single file from Supabase storage with timeout and error handling
 * @param bucketName The name of the storage bucket
 * @param storagePath The storage path of the file to delete
 * @param timeoutMs Optional timeout in milliseconds (default: 10000ms)
 * @returns Promise with success status and optional error message
 */
export async function deleteStorageFile(
  bucketName: string, 
  storagePath: string, 
  timeoutMs: number = 10000
): Promise<{ success: boolean; error?: string }> {
  if (!storagePath) {
    logger.debug(STORAGE_UTILS_CONTEXT, `deleteStorageFile: No storage path provided for bucket: ${bucketName}`);
    return { success: true };
  }

  try {
    const supabaseAdmin = createAdminClient();
    
    logger.info(STORAGE_UTILS_CONTEXT, `deleteStorageFile: Attempting to delete file at path: ${storagePath} from bucket: ${bucketName}`);
    
    // Add timeout for storage deletion operations
    const deletePromise = supabaseAdmin.storage
      .from(bucketName)
      .remove([storagePath]);
    
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`File deletion timeout after ${timeoutMs}ms`)), timeoutMs)
    );
    
    const { error } = await Promise.race([deletePromise, timeoutPromise]);
    
    if (error) {
      // Don't treat file not found as an error since it might have already been deleted
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        logger.info(STORAGE_UTILS_CONTEXT, `deleteStorageFile: File ${storagePath} not found in bucket ${bucketName}, may have already been deleted`);
        return { success: true };
      }
      
      logger.error(STORAGE_UTILS_CONTEXT, `deleteStorageFile: Error deleting file ${storagePath} from bucket ${bucketName}:`, error.message);
      return { success: false, error: error.message };
    }
    
    logger.info(STORAGE_UTILS_CONTEXT, `deleteStorageFile: Successfully deleted file at path: ${storagePath} from bucket: ${bucketName}`);
    return { success: true };
  } catch (error: any) {
    if (error.message.includes('timeout')) {
      logger.warn(STORAGE_UTILS_CONTEXT, `deleteStorageFile: Timeout deleting file ${storagePath} from bucket ${bucketName}`);
      return { success: false, error: `File deletion timeout - continuing anyway` };
    }
    logger.error(STORAGE_UTILS_CONTEXT, `deleteStorageFile: Unexpected error deleting file from ${bucketName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Delete multiple files from Supabase storage with comprehensive error handling
 * @param bucketName The name of the storage bucket
 * @param storagePaths Array of storage paths to delete
 * @param timeoutMs Optional timeout in milliseconds (default: 15000ms)
 * @returns Promise with success status, number of deleted files, and any errors
 */
export async function deleteStorageFiles(
  bucketName: string, 
  storagePaths: string[], 
  timeoutMs: number = 15000
): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
  if (!storagePaths || storagePaths.length === 0) {
    logger.debug(STORAGE_UTILS_CONTEXT, `deleteStorageFiles: No storage paths provided for bucket: ${bucketName}`);
    return { success: true, deletedCount: 0, errors: [] };
  }

  logger.info(STORAGE_UTILS_CONTEXT, `deleteStorageFiles: Attempting to delete ${storagePaths.length} files from bucket: ${bucketName}`);

  try {
    const supabaseAdmin = createAdminClient();
    
    // Add timeout for bulk storage deletion operations
    const deletePromise = supabaseAdmin.storage
      .from(bucketName)
      .remove(storagePaths);
    
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Bulk file deletion timeout after ${timeoutMs}ms`)), timeoutMs)
    );
    
    const { data, error } = await Promise.race([deletePromise, timeoutPromise]);
    
    if (error) {
      logger.error(STORAGE_UTILS_CONTEXT, `deleteStorageFiles: Error deleting files from bucket ${bucketName}:`, error.message);
      
      // If bulk deletion fails, try individual deletions for better error reporting
      const individualResults = await Promise.allSettled(
        storagePaths.map(path => deleteStorageFile(bucketName, path, 5000))
      );
      
      let successCount = 0;
      const errors: string[] = [];
      
      individualResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          const errorMsg = result.status === 'rejected' 
            ? result.reason.message 
            : result.value.error || 'Unknown error';
          errors.push(`${storagePaths[index]}: ${errorMsg}`);
        }
      });
      
      logger.info(STORAGE_UTILS_CONTEXT, `deleteStorageFiles: Individual deletion results - ${successCount}/${storagePaths.length} files deleted from bucket ${bucketName}`);
      return { 
        success: successCount === storagePaths.length, 
        deletedCount: successCount, 
        errors 
      };
    }
    
    logger.info(STORAGE_UTILS_CONTEXT, `deleteStorageFiles: Successfully processed deletion of ${storagePaths.length} files from bucket ${bucketName}. Response:`, data);
    return { success: true, deletedCount: storagePaths.length, errors: [] };
  } catch (error: any) {
    if (error.message.includes('timeout')) {
      logger.warn(STORAGE_UTILS_CONTEXT, `deleteStorageFiles: Timeout during bulk deletion from bucket ${bucketName}`);
      return { success: false, deletedCount: 0, errors: [`Bulk deletion timeout - ${storagePaths.length} files`] };
    }
    logger.error(STORAGE_UTILS_CONTEXT, `deleteStorageFiles: Unexpected error during bulk deletion from ${bucketName}:`, error.message);
    return { success: false, deletedCount: 0, errors: [error.message] };
  }
}

/**
 * Delete files from storage using their full URLs
 * @param fileUrls Array of full file URLs from Supabase storage
 * @param bucketName The name of the storage bucket
 * @param timeoutMs Optional timeout in milliseconds (default: 15000ms)
 * @returns Promise with deletion results
 */
export async function deleteStorageFilesByUrls(
  fileUrls: string[] | null | undefined, 
  bucketName: string, 
  timeoutMs: number = 15000
): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
  const storagePaths = extractStoragePathsFromUrls(fileUrls, bucketName);
  
  if (storagePaths.length === 0) {
    logger.debug(STORAGE_UTILS_CONTEXT, `deleteStorageFilesByUrls: No valid storage paths found for bucket: ${bucketName}`);
    return { success: true, deletedCount: 0, errors: [] };
  }

  return await deleteStorageFiles(bucketName, storagePaths, timeoutMs);
}

/**
 * Validate if a URL belongs to a specific Supabase storage bucket
 * @param fileUrl The file URL to validate
 * @param bucketName The expected bucket name
 * @returns True if URL belongs to the specified bucket
 */
export function isUrlFromBucket(fileUrl: string | null | undefined, bucketName: string): boolean {
  if (!fileUrl) return false;
  
  try {
    const url = new URL(fileUrl);
    return url.pathname.includes(`/storage/v1/object/public/${bucketName}/`);
  } catch {
    return false;
  }
}

/**
 * Get bucket name from a Supabase storage URL
 * @param fileUrl The file URL to analyze
 * @returns The bucket name or null if cannot be determined
 */
export function getBucketNameFromUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  
  try {
    const url = new URL(fileUrl);
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\//);
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}
