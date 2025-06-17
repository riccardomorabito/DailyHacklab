"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, BookUser, ListTree, LogIn } from 'lucide-react';
import { PUBLIC_REGISTRATION_STORAGE_KEY } from '@/lib/config';
import { 
  setAdminLoggingOverride as setAdminLoggingOverrideInLogger,
  getAdminLoggingOverride, 
  getDefaultLoggingEnabled 
} from '@/lib/logger'; 
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { 
  getPublicRegistrationSetting, 
  updatePublicRegistrationSetting 
} from '@/actions/app-settings';

const ADMIN_APP_SETTINGS_CONTEXT = "AdminAppSettings";

/**
 * AdminAppSettings component - Administrative interface for application-wide settings
 * Allows administrators to configure global settings like public registration and logging
 * Manages both UI settings stored in localStorage and session-based overrides
 * @returns JSX element representing the admin application settings interface
 */
export default function AdminAppSettings() {
  const [allowPublicRegistration, setAllowPublicRegistration] = useState(false);
  const [isLoadingRegistrationSetting, setIsLoadingRegistrationSetting] = useState(true);
  const [adminLoggingOverrideSession, setAdminLoggingOverrideSession] = useState<boolean | null>(null);
  const [defaultLoggingState, setDefaultLoggingState] = useState(false);
  const [isMounted, setIsMounted] = useState(false); 
  const { toast } = useToast();

  useEffect(() => {
    logger.info(ADMIN_APP_SETTINGS_CONTEXT, "useEffect: Component mounted. Loading settings.");
    setIsMounted(true); 
    
    // Load public registration setting from database
    const loadPublicRegistrationSetting = async () => {
      try {
        const { data, error } = await getPublicRegistrationSetting();
        if (error) {
          logger.error(ADMIN_APP_SETTINGS_CONTEXT, "useEffect: Error loading public registration setting:", error);
          toast({
            title: "Error Loading Setting",
            description: "Failed to load public registration setting from database.",
            variant: "destructive"
          });
          // Fallback to localStorage if database fails
          if (typeof window !== 'undefined') {
            const storedRegSetting = localStorage.getItem(PUBLIC_REGISTRATION_STORAGE_KEY);
            setAllowPublicRegistration(storedRegSetting === 'true');
          }
        } else {
          setAllowPublicRegistration(data || false);
          logger.debug(ADMIN_APP_SETTINGS_CONTEXT, `useEffect: Public registration setting loaded from database: ${data}`);
        }
      } catch (error) {
        logger.error(ADMIN_APP_SETTINGS_CONTEXT, "useEffect: Unexpected error loading public registration setting:", error);
        // Fallback to localStorage
        if (typeof window !== 'undefined') {
          const storedRegSetting = localStorage.getItem(PUBLIC_REGISTRATION_STORAGE_KEY);
          setAllowPublicRegistration(storedRegSetting === 'true');
        }
      } finally {
        setIsLoadingRegistrationSetting(false);
      }
    };
    
    if (typeof window !== 'undefined') {
      // Load logging settings (these remain client-side for session override)
      setAdminLoggingOverrideSession(getAdminLoggingOverride());
      setDefaultLoggingState(getDefaultLoggingEnabled());
      logger.debug(ADMIN_APP_SETTINGS_CONTEXT, `useEffect: Admin logging override loaded: ${getAdminLoggingOverride()}, Default logging: ${getDefaultLoggingEnabled()}`);
    }
    
    loadPublicRegistrationSetting();
  }, [toast]);

  const handlePublicRegistrationToggle = async (checked: boolean) => {
    if (!isMounted) return; 
    logger.info(ADMIN_APP_SETTINGS_CONTEXT, `handlePublicRegistrationToggle: Setting public registration to ${checked}.`);
    
    // Optimistically update UI
    setAllowPublicRegistration(checked);
    
    try {
      const { success, error } = await updatePublicRegistrationSetting(checked);
      
      if (error) {
        logger.error(ADMIN_APP_SETTINGS_CONTEXT, "handlePublicRegistrationToggle: Error updating setting:", error);
        // Revert optimistic update on error
        setAllowPublicRegistration(!checked);
        toast({
          title: "Error Updating Setting",
          description: `Failed to update public registration setting: ${error}`,
          variant: "destructive"
        });
        return;
      }
      
      if (success) {
        // Also update localStorage as fallback for immediate UI consistency
        localStorage.setItem(PUBLIC_REGISTRATION_STORAGE_KEY, String(checked));
        
        toast({
          title: "Setting Updated",
          description: `Public registration ${checked ? 'enabled' : 'disabled'} and saved to database.`,
        });
        logger.info(ADMIN_APP_SETTINGS_CONTEXT, `handlePublicRegistrationToggle: Successfully updated public registration to ${checked}`);
      }
    } catch (error) {
      logger.error(ADMIN_APP_SETTINGS_CONTEXT, "handlePublicRegistrationToggle: Unexpected error:", error);
      // Revert optimistic update on error
      setAllowPublicRegistration(!checked);
      toast({
        title: "Error Updating Setting",
        description: "An unexpected error occurred while updating the setting.",
        variant: "destructive"
      });
    }
  };

  const handleLoggingOverrideToggle = (checked: boolean) => {
    if (!isMounted) return; 
    logger.info(ADMIN_APP_SETTINGS_CONTEXT, `handleLoggingOverrideToggle: Setting admin logging override to ${checked}.`);
    setAdminLoggingOverrideSession(checked);
    setAdminLoggingOverrideInLogger(checked);
    toast({
      title: "Logging Setting Updated",
      description: `Detailed logging for this session ${checked ? 'enabled' : 'disabled'}. (Default at startup: ${defaultLoggingState ? 'Enabled' : 'Disabled'})`,
    });
  };
  
  const handleResetLoggingOverride = () => {
    if (!isMounted) return; 
    logger.info(ADMIN_APP_SETTINGS_CONTEXT, "handleResetLoggingOverride: Removing admin logging override.");
    setAdminLoggingOverrideSession(null);
    setAdminLoggingOverrideInLogger(null);
     toast({
      title: "Logging Override Removed",
      description: `Logging for this session will follow the default setting (Currently: ${defaultLoggingState ? 'Enabled' : 'Disabled'}).`,
    });
  }

  if (!isMounted) {
    return (
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-xl font-headline">
             Application Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
            <p>Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  const effectiveLoggingStatus = adminLoggingOverrideSession !== null ? adminLoggingOverrideSession : defaultLoggingState;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-xl font-headline">
            <BookUser className="mr-3 h-6 w-6 text-primary" />
            Public User Registration UI
          </CardTitle>
          <CardDescription>
            Controls whether new users can see the UI to register.
            This setting is now stored in the database and persists across server restarts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
            <Label htmlFor="public-registration-switch" className="text-base">
              Enable UI for Public Registration
            </Label>
            <Switch
              id="public-registration-switch"
              checked={allowPublicRegistration}
              onCheckedChange={handlePublicRegistrationToggle}
              disabled={isLoadingRegistrationSetting}
              aria-label="Toggle public registration UI"
            />
          </div>
           <p className="text-sm text-muted-foreground px-1">
              {isLoadingRegistrationSetting ? (
                "Loading setting from database..."
              ) : (
                <>
                  If enabled, a "Register now" link will appear on the login page.
                  This setting is stored in the database and persists across server restarts.
                  The actual ability to register depends on Supabase project settings.
                </>
              )}
            </p>
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-xl font-headline">
            <ListTree className="mr-3 h-6 w-6 text-primary" />
            Application Logging (Admin Session)
          </CardTitle>
          <CardDescription>
            Enable or disable detailed logging in the browser console for your current session.
            The default setting at startup is managed by an environment variable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between space-x-2 mb-3">
                <Label htmlFor="admin-logging-switch" className="text-base">
                Detailed Logging Active: <span className={cn("font-semibold", effectiveLoggingStatus ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>{effectiveLoggingStatus ? 'YES' : 'NO'}</span>
                </Label>
                <Switch
                id="admin-logging-switch"
                checked={adminLoggingOverrideSession !== null ? adminLoggingOverrideSession : defaultLoggingState } 
                onCheckedChange={handleLoggingOverrideToggle}
                aria-label="Toggle detailed logging for this admin session"
                />
            </div>
            <p className="text-xs text-muted-foreground mb-3">
                Default state at startup (from env var): {defaultLoggingState ? 'Enabled' : 'Disabled'}.
                {adminLoggingOverrideSession !== null && ` Session override: ${adminLoggingOverrideSession ? 'Enabled' : 'Disabled'}.`}
            </p>
            {adminLoggingOverrideSession !== null && (
                <Button onClick={handleResetLoggingOverride} variant="outline" size="sm">
                Reset Override (Use Default)
                </Button>
            )}
           </div>
           <p className="text-sm text-muted-foreground px-1">
              This switch overrides the default setting only for your current admin session in this browser.
              It does not affect other users or server-side logging.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
