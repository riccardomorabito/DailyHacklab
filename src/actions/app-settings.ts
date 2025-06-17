"use server";

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import type { AppSettings } from '@/types';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

/** Context identifier for logging app settings operations */
const APP_SETTINGS_ACTIONS_CONTEXT = "AppSettingsActions";

/**
 * Timeout wrapper utility function that prevents infinite loading states
 * @param promiseFunction - Function that returns a promise to wrap with timeout
 * @param timeoutMs - Timeout in milliseconds (default: 8000ms = 8 seconds)
 * @returns Promise that either resolves with the original result or rejects with timeout error
 */
function withTimeout<T>(promiseFunction: () => Promise<T>, timeoutMs: number = 8000): Promise<T> {
  return Promise.race([
    promiseFunction(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Gets all app settings from the database
 * @returns Promise containing all app settings or error message
 */
export async function getAllAppSettings(): Promise<{ data?: AppSettings[]; error?: string }> {
  logger.info(APP_SETTINGS_ACTIONS_CONTEXT, "getAllAppSettings: Starting to fetch all app settings.");
  
  return withTimeout(async () => {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (e: any) {
      logger.error(APP_SETTINGS_ACTIONS_CONTEXT, "getAllAppSettings: Failed to create Supabase Admin Client:", e.message);
      return { error: `Server configuration error: ${e.message}. Contact support.` };
    }

    const supabaseServerClient = await createServerSupabaseClient();
    const { data: { user: authUser }, error: authError } = await supabaseServerClient.auth.getUser();
    
    if (authError || !authUser) {
      logger.warn(APP_SETTINGS_ACTIONS_CONTEXT, "getAllAppSettings: Authentication required.");
      return { error: 'Authentication required' };
    }

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (adminProfileError || !adminProfile || adminProfile.role !== 'admin') {
      logger.warn(APP_SETTINGS_ACTIONS_CONTEXT, "getAllAppSettings: Administrator privileges required.");
      return { error: 'Administrator privileges required' };
    }

    const { data: settings, error: fetchError } = await supabaseAdmin
      .from('app_settings')
      .select('*')
      .order('setting_key');

    if (fetchError) {
      logger.error(APP_SETTINGS_ACTIONS_CONTEXT, "getAllAppSettings: Error fetching settings:", fetchError.message);
      return { error: `Error fetching app settings: ${fetchError.message}` };
    }

    logger.info(APP_SETTINGS_ACTIONS_CONTEXT, `getAllAppSettings: Successfully fetched ${settings?.length || 0} settings.`);
    return { data: settings || [] };
  });
}

/**
 * Gets a specific app setting by key
 * @param settingKey - The key of the setting to retrieve
 * @returns Promise containing the setting value or error message
 */
export async function getAppSetting(settingKey: string): Promise<{ data?: string; error?: string }> {
  logger.info(APP_SETTINGS_ACTIONS_CONTEXT, `getAppSetting: Getting setting for key: ${settingKey}`);
  
  return withTimeout(async () => {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (e: any) {
      logger.error(APP_SETTINGS_ACTIONS_CONTEXT, "getAppSetting: Failed to create Supabase Admin Client:", e.message);
      return { error: `Server configuration error: ${e.message}. Contact support.` };
    }

    const { data: setting, error: fetchError } = await supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', settingKey)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // No setting found, return null data (not an error)
        logger.info(APP_SETTINGS_ACTIONS_CONTEXT, `getAppSetting: No setting found for key: ${settingKey}`);
        return { data: undefined };
      }
      logger.error(APP_SETTINGS_ACTIONS_CONTEXT, "getAppSetting: Error fetching setting:", fetchError.message);
      return { error: `Error fetching app setting: ${fetchError.message}` };
    }

    logger.info(APP_SETTINGS_ACTIONS_CONTEXT, `getAppSetting: Successfully fetched setting for key: ${settingKey}`);
    return { data: setting.setting_value };
  });
}

/**
 * Updates or creates an app setting
 * @param settingKey - The key of the setting
 * @param settingValue - The value to set
 * @param description - Optional description for the setting
 * @returns Promise containing success status or error message
 */
export async function updateAppSetting(
  settingKey: string, 
  settingValue: string, 
  description?: string
): Promise<{ success?: boolean; error?: string }> {
  logger.info(APP_SETTINGS_ACTIONS_CONTEXT, `updateAppSetting: Updating setting ${settingKey} to value: ${settingValue}`);
  
  return withTimeout(async () => {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (e: any) {
      logger.error(APP_SETTINGS_ACTIONS_CONTEXT, "updateAppSetting: Failed to create Supabase Admin Client:", e.message);
      return { error: `Server configuration error: ${e.message}. Contact support.` };
    }

    const supabaseServerClient = await createServerSupabaseClient();
    const { data: { user: authUser }, error: authError } = await supabaseServerClient.auth.getUser();
    
    if (authError || !authUser) {
      logger.warn(APP_SETTINGS_ACTIONS_CONTEXT, "updateAppSetting: Authentication required.");
      return { error: 'Authentication required' };
    }

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (adminProfileError || !adminProfile || adminProfile.role !== 'admin') {
      logger.warn(APP_SETTINGS_ACTIONS_CONTEXT, "updateAppSetting: Administrator privileges required.");
      return { error: 'Administrator privileges required' };
    }

    // Use upsert to either update existing or create new setting
    const { error: upsertError } = await supabaseAdmin
      .from('app_settings')
      .upsert({
        setting_key: settingKey,
        setting_value: settingValue,
        description: description,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    if (upsertError) {
      logger.error(APP_SETTINGS_ACTIONS_CONTEXT, "updateAppSetting: Error upserting setting:", upsertError.message);
      return { error: `Error updating app setting: ${upsertError.message}` };
    }

    logger.info(APP_SETTINGS_ACTIONS_CONTEXT, `updateAppSetting: Successfully updated setting ${settingKey}`);
    
    // Revalidate admin pages that might use these settings
    revalidatePath('/admin');
    revalidatePath('/admin/app-settings');
    
    return { success: true };
  });
}

/**
 * Gets the public registration setting (can be called without admin privileges)
 * @returns Promise containing the setting value or error message
 */
export async function getPublicRegistrationSetting(): Promise<{ data?: boolean; error?: string }> {
  logger.info(APP_SETTINGS_ACTIONS_CONTEXT, "getPublicRegistrationSetting: Getting public registration setting.");
  
  return withTimeout(async () => {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (e: any) {
      logger.error(APP_SETTINGS_ACTIONS_CONTEXT, "getPublicRegistrationSetting: Failed to create Supabase Admin Client:", e.message);
      return { error: `Server configuration error: ${e.message}. Contact support.` };
    }

    const { data: setting, error: fetchError } = await supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'public_registration_enabled')
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // No setting found, default to false
        logger.info(APP_SETTINGS_ACTIONS_CONTEXT, "getPublicRegistrationSetting: No setting found, defaulting to false");
        return { data: false };
      }
      logger.error(APP_SETTINGS_ACTIONS_CONTEXT, "getPublicRegistrationSetting: Error fetching setting:", fetchError.message);
      return { error: `Error fetching public registration setting: ${fetchError.message}` };
    }

    const isEnabled = setting.setting_value === 'true';
    logger.info(APP_SETTINGS_ACTIONS_CONTEXT, `getPublicRegistrationSetting: Public registration is ${isEnabled ? 'enabled' : 'disabled'}`);
    return { data: isEnabled };
  });
}

/**
 * Updates the public registration setting
 * @param enabled - Whether public registration should be enabled
 * @returns Promise containing success status or error message
 */
export async function updatePublicRegistrationSetting(enabled: boolean): Promise<{ success?: boolean; error?: string }> {
  logger.info(APP_SETTINGS_ACTIONS_CONTEXT, `updatePublicRegistrationSetting: Setting public registration to: ${enabled}`);
  
  return updateAppSetting(
    'public_registration_enabled',
    enabled.toString(),
    'Controls whether new users can see the UI to register for the application'
  );
}
