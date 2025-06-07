import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';

const AVATAR_LOADER_CONTEXT = "AvatarLoader";

/**
 * Avatar loading states
 */
export type AvatarLoadState = 'loading' | 'loaded' | 'error' | 'fallback';

/**
 * Avatar loader hook return type
 */
export interface UseAvatarLoaderReturn {
  /** Current loading state */
  loadState: AvatarLoadState;
  /** Whether the image should be displayed */
  shouldShowImage: boolean;
  /** Whether to show fallback avatar */
  shouldShowFallback: boolean;
  /** Image error handler */
  handleImageError: () => void;
  /** Image load success handler */
  handleImageLoad: () => void;
  /** Reset the loader state */
  resetState: () => void;
  /** The actual URL to use for the image (may be proxied) */
  imageUrl: string | null;
}

/**
 * Options for avatar loader hook
 */
export interface UseAvatarLoaderOptions {
  /** The avatar URL to load */
  avatarUrl?: string | null;
  /** User identifier for logging */
  userId?: string;
  /** User name for logging */
  userName?: string;
  /** Number of retry attempts (default: 0) */
  maxRetries?: number;
  /** Enable debug logging (default: false) */
  enableDebugLogging?: boolean;
}

/**
 * Validates if an avatar URL is valid and loadable
 * @param avatarUrl - The URL to validate
 * @returns Whether the URL is valid
 */
const isValidAvatarUrl = (avatarUrl?: string | null): boolean => {
  return !!(
    avatarUrl &&
    typeof avatarUrl === 'string' &&
    avatarUrl.trim() !== '' &&
    avatarUrl.trim() !== 'null' &&
    avatarUrl.trim() !== 'undefined' &&
    (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))
  );
};

/**
 * Custom hook for handling avatar image loading with CORS error handling
 * 
 * This hook provides a robust solution for loading avatar images that may
 * fail due to CORS policies, network issues, or other loading problems.
 * It automatically falls back to generated avatars when real images fail.
 * 
 * @param options - Configuration options for the avatar loader
 * @returns Avatar loader state and handlers
 */
export const useAvatarLoader = ({
  avatarUrl,
  userId = 'unknown',
  userName = 'Unknown User',
  maxRetries = 0,
  enableDebugLogging = false
}: UseAvatarLoaderOptions): UseAvatarLoaderReturn => {
  const [loadState, setLoadState] = useState<AvatarLoadState>('loading');
  const [retryCount, setRetryCount] = useState(0);

  // Reset state when avatar URL changes
  useEffect(() => {
    if (!isValidAvatarUrl(avatarUrl)) {
      setLoadState('fallback');
      setRetryCount(0);
      if (enableDebugLogging) {
        logger.debug(AVATAR_LOADER_CONTEXT, `useAvatarLoader: Invalid avatar URL for user ${userName} (${userId}): "${avatarUrl}"`);
      }
      return;
    }

    setLoadState('loading');
    setRetryCount(0);
    
    if (enableDebugLogging) {
      logger.debug(AVATAR_LOADER_CONTEXT, `useAvatarLoader: Starting load for user ${userName} (${userId}): ${avatarUrl}`);
    }
  }, [avatarUrl, userId, userName, enableDebugLogging]);

  /**
   * Handles image loading errors
   * Implements retry logic and eventual fallback to generated avatar
   */
  const handleImageError = useCallback(() => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setLoadState('loading');
      
      if (enableDebugLogging) {
        logger.warn(AVATAR_LOADER_CONTEXT, `useAvatarLoader: Avatar load failed for user ${userName} (${userId}), retrying (${retryCount + 1}/${maxRetries}): ${avatarUrl}`);
      }
    } else {
      setLoadState('error');
      
      // Log the specific error for debugging
      const isSupabaseUrl = avatarUrl?.includes('supabase.co');
      const errorMessage = isSupabaseUrl 
        ? `Avatar load failed (likely CORS issue) for user ${userName} (${userId}): ${avatarUrl}. Consider using a proxy or updating CORS settings.`
        : `Avatar load failed for user ${userName} (${userId}): ${avatarUrl}`;
      
      logger.warn(AVATAR_LOADER_CONTEXT, `useAvatarLoader: ${errorMessage}`);
    }
  }, [retryCount, maxRetries, avatarUrl, userId, userName, enableDebugLogging]);

  /**
   * Handles successful image loading
   */
  const handleImageLoad = useCallback(() => {
    setLoadState('loaded');
    setRetryCount(0);
    
    if (enableDebugLogging) {
      logger.debug(AVATAR_LOADER_CONTEXT, `useAvatarLoader: Avatar loaded successfully for user ${userName} (${userId})`);
    }
  }, [userId, userName, enableDebugLogging]);

  /**
   * Resets the loader state
   */
  const resetState = useCallback(() => {
    setLoadState('loading');
    setRetryCount(0);
  }, []);

  // Determine what to show based on current state
  const shouldShowImage = loadState === 'loaded' || loadState === 'loading';
  const shouldShowFallback = loadState === 'error' || loadState === 'fallback';

  return {
    loadState,
    shouldShowImage: shouldShowImage && isValidAvatarUrl(avatarUrl),
    shouldShowFallback,
    handleImageError,
    handleImageLoad,
    resetState,
    imageUrl: isValidAvatarUrl(avatarUrl) ? avatarUrl! : null
  };
};
