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

const ADMIN_APP_SETTINGS_CONTEXT = "AdminAppSettings";

/**
 * AdminAppSettings component - Administrative interface for application-wide settings
 * Allows administrators to configure global settings like public registration and logging
 * Manages both UI settings stored in localStorage and session-based overrides
 * @returns JSX element representing the admin application settings interface
 */
export default function AdminAppSettings() {
  const [allowPublicRegistration, setAllowPublicRegistration] = useState(false);
  const [adminLoggingOverrideSession, setAdminLoggingOverrideSession] = useState<boolean | null>(null);
  const [defaultLoggingState, setDefaultLoggingState] = useState(false);
  const [isMounted, setIsMounted] = useState(false); 
  const { toast } = useToast();

  useEffect(() => {
    logger.info(ADMIN_APP_SETTINGS_CONTEXT, "useEffect: Component mounted. Loading settings.");
    setIsMounted(true); 
    if (typeof window !== 'undefined') {
      const storedRegSetting = localStorage.getItem(PUBLIC_REGISTRATION_STORAGE_KEY);
      setAllowPublicRegistration(storedRegSetting === 'true');
      logger.debug(ADMIN_APP_SETTINGS_CONTEXT, `useEffect: Public registration setting loaded: ${storedRegSetting}`);

      setAdminLoggingOverrideSession(getAdminLoggingOverride());
      setDefaultLoggingState(getDefaultLoggingEnabled());
      logger.debug(ADMIN_APP_SETTINGS_CONTEXT, `useEffect: Admin logging override loaded: ${getAdminLoggingOverride()}, Default logging: ${getDefaultLoggingEnabled()}`);
    }
  }, []);

  const handlePublicRegistrationToggle = (checked: boolean) => {
    if (!isMounted) return; 
    logger.info(ADMIN_APP_SETTINGS_CONTEXT, `handlePublicRegistrationToggle: Setting public registration UI to ${checked}.`);
    setAllowPublicRegistration(checked);
    localStorage.setItem(PUBLIC_REGISTRATION_STORAGE_KEY, String(checked));
    toast({
      title: "Setting Updated",
      description: `Public registration UI ${checked ? 'enabled' : 'disabled'}.`,
    });
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
            The actual ability to register new users is managed in the Supabase project settings.
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
              aria-label="Toggle public registration UI"
            />
          </div>
           <p className="text-sm text-muted-foreground px-1">
              If enabled, a "Register now" link will appear on the login page,
              allowing users to attempt registration. The actual success of registration depends on global Supabase settings.
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
