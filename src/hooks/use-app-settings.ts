"use client";

import { useState, useEffect } from 'react';
import { getPublicRegistrationSetting } from '@/actions/app-settings';
import { logger } from '@/lib/logger';

const USE_APP_SETTINGS_CONTEXT = "useAppSettings";

/**
 * Custom hook for managing app settings
 * Currently focused on public registration setting, but can be extended for other settings
 */
export function useAppSettings() {
  const [publicRegistrationEnabled, setPublicRegistrationEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPublicRegistrationSetting = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { data, error: fetchError } = await getPublicRegistrationSetting();
        
        if (fetchError) {
          logger.error(USE_APP_SETTINGS_CONTEXT, "Error loading public registration setting:", fetchError);
          setError(fetchError);
          setPublicRegistrationEnabled(false); // Default to false on error
        } else {
          setPublicRegistrationEnabled(data || false);
          logger.debug(USE_APP_SETTINGS_CONTEXT, `Public registration setting loaded: ${data}`);
        }
      } catch (err: any) {
        logger.error(USE_APP_SETTINGS_CONTEXT, "Unexpected error loading settings:", err);
        setError(err.message || 'Failed to load app settings');
        setPublicRegistrationEnabled(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadPublicRegistrationSetting();
  }, []);

  /**
   * Refresh the public registration setting from the database
   */
  const refreshPublicRegistrationSetting = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await getPublicRegistrationSetting();
      
      if (fetchError) {
        setError(fetchError);
        logger.error(USE_APP_SETTINGS_CONTEXT, "Error refreshing public registration setting:", fetchError);
      } else {
        setPublicRegistrationEnabled(data || false);
        logger.debug(USE_APP_SETTINGS_CONTEXT, `Public registration setting refreshed: ${data}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh app settings');
      logger.error(USE_APP_SETTINGS_CONTEXT, "Unexpected error refreshing settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    publicRegistrationEnabled,
    isLoading,
    error,
    refreshPublicRegistrationSetting
  };
}

/**
 * Hook specifically for public registration setting
 * Simpler interface for components that only need this setting
 */
export function usePublicRegistration() {
  const { publicRegistrationEnabled, isLoading, error, refreshPublicRegistrationSetting } = useAppSettings();
  
  return {
    enabled: publicRegistrationEnabled,
    isLoading,
    error,
    refresh: refreshPublicRegistrationSetting
  };
}
