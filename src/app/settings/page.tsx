"use client";

import React, { useRef, useState, useEffect } from 'react'; // Added useEffect
import ProtectedRoute from '@/components/protected-route';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Cog, Palette, Save, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/theme-provider';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import UserProfileForm, { type UserProfileFormHandles } from '@/components/user-profile-form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth'; 

/**
 * SettingsPage component - User settings and preferences page
 * Allows users to configure theme, profile information, and account settings
 * Requires user authentication to access
 * @returns JSX element representing the settings page
 */
export default function SettingsPage() {
  const { theme, setTheme, isThemeMounted } = useTheme();
  const { currentUser, loading: authLoading } = useAuth(); // Get currentUser and authLoading
  const userProfileFormRef = React.useRef<UserProfileFormHandles>(null);
  const { toast } = useToast();
  const [isSavingAll, setIsSavingAll] = useState(false);

  const handleSaveAllSettings = async () => {
    setIsSavingAll(true);
    let profileSavedSuccessfully = false;
    let passwordPotentiallyChanged = false;
    let anyProfileChangesAttempted = false;
    let anyPasswordChangesAttempted = false;

    if (userProfileFormRef.current) {
      // Check if there are profile changes before attempting submit
      // This is an approximate check; the form itself might have more fine-grained logic
      const profileForm = userProfileFormRef.current; // Might need to expose isDirty from the form

      // Attempt to save profile
      anyProfileChangesAttempted = true; // Assume we always try to "save" the profile for now
      profileSavedSuccessfully = await profileForm.submitProfileForm();
      
      // Attempt to save password
      anyPasswordChangesAttempted = true; // Assume we always try to "save" the password
      passwordPotentiallyChanged = await profileForm.submitPasswordForm();
    }

    // Improved notification logic
    if (profileSavedSuccessfully && passwordPotentiallyChanged) {
      toast({ title: "Settings Applied", description: "Profile and password have been processed." });
    } else if (profileSavedSuccessfully && !passwordPotentiallyChanged && anyPasswordChangesAttempted) {
      toast({ title: "Profile Updated", description: "Profile information saved. No valid password changes provided." });
    } else if (profileSavedSuccessfully) { // Only profile saved, no password attempt or failed attempt but profile ok
      toast({ title: "Profile Updated", description: "Profile information saved." });
    } else if (!profileSavedSuccessfully && passwordPotentiallyChanged && anyProfileChangesAttempted) {
      toast({ title: "Password Processed", description: "Password has been processed. Error saving profile." });
    } else if (passwordPotentiallyChanged) { // Only password processed
        toast({ title: "Password Processed", description: "Password has been processed." });
    } else if (!anyProfileChangesAttempted && !anyPasswordChangesAttempted && userProfileFormRef.current) {
        // This case is harder to determine without "isDirty" from the form
        toast({ title: "No Changes Detected", description: "No changes were detected to save.", variant: "default"});
    } else if (!userProfileFormRef.current) {
        toast({ title: "Form Error", description: "Unable to access profile form. Please try again.", variant: "destructive"});
    }
    // Other error cases are handled within submitProfileForm/submitPasswordForm

    setIsSavingAll(false);
  };

  // Use authLoading for initial loading, and currentUser for subsequent logic
  if (!isThemeMounted || authLoading || !currentUser) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow">
          <Card className="w-full max-w-2xl mx-auto shadow-xl overflow-hidden">
            <CardHeader className="text-center pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
              <Cog className="mx-auto h-12 w-12 text-primary animate-spin mb-2" />
              <CardTitle className="text-3xl md:text-4xl font-headline">Settings</CardTitle>
              <CardDescription className="mt-1 text-muted-foreground">Loading your preferences...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }
  
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow">
        <div className="w-full max-w-2xl mx-auto space-y-8">
          <Card className="shadow-xl overflow-hidden">
            <CardHeader className="text-center pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
              <Cog className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle className="text-3xl md:text-4xl font-headline">Application Settings</CardTitle>
              <CardDescription className="mt-1 text-muted-foreground">Manage your application preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <Palette className="h-5 w-5 text-primary" />
                  <Label className="text-lg font-medium">Appearance Theme</Label>
                </div>
                <RadioGroup
                  value={theme}
                  onValueChange={(value: "light" | "dark" | "system") => setTheme(value)}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                >
                  {[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                    { value: "system", label: "System" },
                  ].map((item) => (
                    <Label
                      key={item.value}
                      htmlFor={`theme-${item.value}`}
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <RadioGroupItem value={item.value} id={`theme-${item.value}`} className="sr-only" />
                      <span>{item.label}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          <UserProfileForm ref={userProfileFormRef} />

          <div className="mt-8 flex justify-center">
            <Button onClick={handleSaveAllSettings} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSavingAll}>
              {isSavingAll ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Save className="mr-2 h-5 w-5" />
              )}
              {isSavingAll ? 'Saving...' : 'Save All Settings'}
            </Button>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
