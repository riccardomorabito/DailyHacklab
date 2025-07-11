/**
 * @fileoverview User Profile Form Component
 * 
 * This component provides a comprehensive form for users to update their profile information
 * including name, avatar, and password. It handles file uploads, URL-based avatars, and
 * provides real-time preview functionality.
 * 
 * Features:
 * - Profile information editing (name, avatar)
 * - Multiple avatar options: file upload, URL, keep current, remove
 * - Password change functionality
 * - Real-time avatar preview
 * - Form validation with Zod schema
 * - Background avatar cleanup
 * - Toast notifications for user feedback
 * 
 * @author Studio Development Team
 */
"use client";

import React, { useImperativeHandle, useState, useRef, useEffect, useCallback } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { User as UserIcon, Lock, Upload, Trash2, Image as ImageIcon, Link2, Save, Loader2, Clock, AlertOctagon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import NextImage from 'next/image';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { logger } from '@/lib/logger';
import DynamicBoringAvatar from '@/components/dynamic-boring-avatar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import type { User } from '@/types';
import ImageCropDialog from '@/components/image-crop-dialog';

const USER_PROFILE_FORM_CONTEXT = "UserProfileForm";

/** Maximum allowed avatar file size in MB */
const MAX_AVATAR_SIZE_MB = 2;
/** Maximum allowed avatar file size in bytes */
const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;

/**
 * Schema for validating profile form data
 */
const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must contain at least 2 characters." }),
  avatarMode: z.enum(['file', 'url', 'keep', 'remove', 'none']),
  avatarFile: z.any().optional(),
  avatarUrlInput: z.string().url({ message: "Enter a valid URL." }).optional().or(z.literal('')),
}).refine(data => {
  if (data.avatarMode === 'file') {
    return data.avatarFile && typeof FileList !== 'undefined' && data.avatarFile instanceof FileList && data.avatarFile.length > 0;
  }
  return true;
}, {
  message: "Select a file for the avatar.",
  path: ["avatarFile"],
}).refine(data => {
  if (data.avatarMode === 'file' && data.avatarFile && typeof FileList !== 'undefined' && data.avatarFile instanceof FileList && data.avatarFile.length > 0) {
    const file = data.avatarFile[0];
    if (typeof File !== 'undefined' && file instanceof File) {
      return file.size <= MAX_AVATAR_SIZE_BYTES;
    }
    return false;
  }
  return true;
}, {
  message: `Avatar cannot exceed ${MAX_AVATAR_SIZE_MB}MB.`,
  path: ["avatarFile"],
}).refine(data => {
  if (data.avatarMode === 'file' && data.avatarFile && typeof FileList !== 'undefined' && data.avatarFile instanceof FileList && data.avatarFile.length > 0) {
    const file = data.avatarFile[0];
    if (typeof File !== 'undefined' && file instanceof File) {
      return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
    }
    return false;
  }
  return true;
}, {
  message: "Unsupported file format (allowed: JPG, PNG, WEBP, GIF).",
  path: ["avatarFile"],
}).refine(data => {
  if (data.avatarMode === 'url') return data.avatarUrlInput && data.avatarUrlInput.length > 0;
  return true;
}, {
  message: "Enter a URL for the avatar.",
  path: ["avatarUrlInput"],
});

/**
 * Schema for validating password form data
 */
const passwordSchema = z.object({
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
  // If one password field is filled, the other must be too, and they must match.
  if (data.newPassword || data.confirmPassword) {
    if (!data.newPassword || data.newPassword.length < 6) return false; // Catches min length for newPassword
    return data.newPassword === data.confirmPassword;
  }
  // If both are empty, it's valid.
  return true;
}, {
  message: "Passwords must match and be at least 6 characters long.",
  path: ["confirmPassword"], // Error shown on the confirmation field
});

/** Type definition for profile form data */
type ProfileFormData = z.infer<typeof profileFormSchema>;
/** Type definition for password form data */
type PasswordFormData = z.infer<typeof passwordSchema>;

/**
 * Interface for UserProfileForm component handles
 */
export interface UserProfileFormHandles {
  /** Submit the profile form and return success status */
  submitProfileForm: () => Promise<boolean>; 
  /** Submit the password form and return success status */
  submitPasswordForm: () => Promise<boolean>; 
}

/**
 * User Profile Form component for editing user profile and password
 * @param props - Component props
 * @param ref - Forward ref for component handles
 * @returns The user profile form component
 */
const UserProfileForm = React.forwardRef<UserProfileFormHandles, {}>((props, ref) => {
  const { currentUser, updateCurrentUserData, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const supabase = createClient(); 
  
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isCleaningUpAvatar, setIsCleaningUpAvatar] = useState(false);
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  
  // Image cropping state
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [fileToProcess, setFileToProcess] = useState<File | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);

  const { 
    register: registerProfile, 
    handleSubmit: handleSubmitProfile, 
    control: profileControl,
    formState: { errors: profileErrors, dirtyFields: profileDirtyFields }, 
    setValue: setProfileValue,
    watch: watchProfile,
    reset: resetProfileForm,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
  });

  const { 
    register: registerPassword, 
    handleSubmit: handleSubmitPassword, 
    formState: { errors: passwordErrors, dirtyFields: passwordDirtyFields }, 
    reset: resetPasswordForm,
    watch: watchPassword 
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });
  
  const profileAvatarMode = watchProfile('avatarMode');
  const watchedProfileAvatarFile = watchProfile('avatarFile');
  const watchedProfileName = watchProfile('name');
  const watchedProfileAvatarUrlInput = watchProfile('avatarUrlInput');
  const newPasswordValue = watchPassword('newPassword'); 

  /**
   * Effect to initialize/reset profile form when current user changes
   * Sets default values for name, avatar mode, and avatar preview
   */
  useEffect(() => {
    if (currentUser) {
      logger.debug(USER_PROFILE_FORM_CONTEXT, "useEffect (currentUser): Profile form initialization/reset for user:", currentUser.name);
      resetProfileForm({
        name: currentUser.name || "",
        avatarMode: currentUser.avatarUrl ? 'keep' : 'none',
        avatarUrlInput: currentUser.avatarUrl && currentUser.avatarUrl.startsWith('http')
                        ? currentUser.avatarUrl
                        : "",
      });
      setAvatarPreview(currentUser.avatarUrl || null);
    }
  }, [currentUser, resetProfileForm]);

  /**
   * Effect to update avatar preview based on selected avatar mode and inputs
   * Handles file uploads, URL inputs, keep current, remove, and none options
   */
  useEffect(() => {
    logger.debug(USER_PROFILE_FORM_CONTEXT, `useEffect (avatarPreview): avatarMode: ${profileAvatarMode}, file: ${watchedProfileAvatarFile?.length}, URL input: ${watchedProfileAvatarUrlInput}`);
    
    if (profileAvatarMode === 'file' && watchedProfileAvatarFile && typeof FileList !== 'undefined' && watchedProfileAvatarFile instanceof FileList && watchedProfileAvatarFile.length > 0) {
      const file = watchedProfileAvatarFile[0];
      if (typeof File !== 'undefined' && file instanceof File) {
        // Only trigger crop dialog if it's not already open and we don't already have a cropped file for this session
        if (!showCropDialog && !croppedFile) {
          // Store the file for cropping and show crop dialog
          setFileToProcess(file);
          setShowCropDialog(true);
          logger.debug(USER_PROFILE_FORM_CONTEXT, "useEffect (avatarPreview): File selected for cropping.");
        }
      } else {
        setAvatarPreview(null);
      }
    } else if (profileAvatarMode === 'url' && watchedProfileAvatarUrlInput) {
      if (z.string().url().safeParse(watchedProfileAvatarUrlInput).success) {
        setAvatarPreview(watchedProfileAvatarUrlInput);
        setCroppedFile(null); // Clear any cropped file when using URL
        logger.debug(USER_PROFILE_FORM_CONTEXT, "useEffect (avatarPreview): Preview from URL set.");
      } else {
        setAvatarPreview(null);
      }
    } else if (profileAvatarMode === 'keep' && currentUser) {
      setAvatarPreview(currentUser.avatarUrl || null);
      setCroppedFile(null); // Clear any cropped file when keeping current
      logger.debug(USER_PROFILE_FORM_CONTEXT, "useEffect (avatarPreview): 'Keep' preview set to current avatar.");
    } else if (profileAvatarMode === 'remove' || profileAvatarMode === 'none') {
       setAvatarPreview(null);
       setCroppedFile(null); // Clear any cropped file when removing
       logger.debug(USER_PROFILE_FORM_CONTEXT, "useEffect (avatarPreview): Preview reset for 'remove' or 'none'.");
    }
  }, [watchedProfileAvatarFile, profileAvatarMode, currentUser, watchedProfileAvatarUrlInput, showCropDialog, croppedFile]);

  /**
   * Handle completion of image cropping
   * @param file - The cropped file
   */
  const handleCropComplete = useCallback((file: File) => {
    setCroppedFile(file);
    setShowCropDialog(false);
    setFileToProcess(null);
    // Create preview URL for the cropped file
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
    logger.debug(USER_PROFILE_FORM_CONTEXT, `Crop completed. Cropped file size: ${file.size} bytes`);
  }, []);

  /**
   * Handle closing of crop dialog
   */
  const handleCropDialogClose = useCallback(() => {
    setShowCropDialog(false);
    setFileToProcess(null);
    // Reset file input if user cancels cropping
    if (avatarFileRef.current) {
      avatarFileRef.current.value = '';
    }
  }, []);

  /**
   * Internal handler for profile form submission
   * Processes avatar uploads, URL updates, and profile data changes
   * @param data - Profile form data including name, avatar mode, and files
   * @returns Promise<boolean> - Success status of the operation
   */
  const onProfileSubmitInternal = async (data: ProfileFormData): Promise<boolean> => {
    if (!currentUser) {
        logger.warn(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: No current user.");
        return false;
    }
    logger.info(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: Starting profile submission. Data:", data);
    setIsSubmittingProfile(true);
    let finalAvatarUrl: string | null | undefined = undefined;
    
    // Show cleanup progress for avatar changes but don't block on it
    const avatarWillChange = data.avatarMode !== 'keep' &&
                            (data.avatarMode === 'file' || data.avatarMode === 'url' ||
                             data.avatarMode === 'remove' || data.avatarMode === 'none');
    
    if (avatarWillChange && currentUser.avatarUrl) {
      setIsCleaningUpAvatar(true);
      // Give user feedback about the update process
      toast({
        title: "Avatar Update",
        description: "Uploading new avatar..."
      });
      
      // Set a timeout to clear the cleanup indicator after 3 seconds
      // This ensures UI doesn't stay in loading state if background cleanup takes long
      setTimeout(() => {
        setIsCleaningUpAvatar(false);
      }, 3000);
    }

    try {
      if (data.avatarMode === 'file' && croppedFile) {
        // Use the cropped file instead of the original
        const fileExt = croppedFile.name.split('.').pop();
        const fileName = `public/${currentUser.id}/avatar_${Date.now()}.${fileExt}`; 
        
        logger.info(USER_PROFILE_FORM_CONTEXT, `onProfileSubmitInternal: Avatar upload attempt. User ID: ${currentUser.id}, Generated path: ${fileName}`);

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, croppedFile, { upsert: true });

        if (uploadError) throw new Error(`Avatar upload error: ${uploadError.message}`);
        
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        finalAvatarUrl = publicUrlData?.publicUrl || null;
        if (finalAvatarUrl === null) throw new Error("Unable to get public URL for avatar after upload.");
        logger.info(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: Avatar uploaded. URL:", finalAvatarUrl);
      } else if (data.avatarMode === 'file' && data.avatarFile && typeof FileList !== 'undefined' && data.avatarFile instanceof FileList && data.avatarFile.length > 0) {
        // Fallback to original file if no cropped file (shouldn't happen with new flow)
        const fileToUpload = data.avatarFile[0];
        if (typeof File === 'undefined' || !(fileToUpload instanceof File)) {
            throw new Error("Selected avatar file is invalid.");
        }
        const fileExt = fileToUpload.name.split('.').pop();
        const fileName = `public/${currentUser.id}/avatar_${Date.now()}.${fileExt}`; 
        
        logger.warn(USER_PROFILE_FORM_CONTEXT, `onProfileSubmitInternal: Using uncropped file as fallback. User ID: ${currentUser.id}`);

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, fileToUpload, { upsert: true });

        if (uploadError) throw new Error(`Avatar upload error: ${uploadError.message}`);
        
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        finalAvatarUrl = publicUrlData?.publicUrl || null;
        if (finalAvatarUrl === null) throw new Error("Unable to get public URL for avatar after upload.");
        logger.info(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: Avatar uploaded. URL:", finalAvatarUrl);
      } else if (data.avatarMode === 'url' && data.avatarUrlInput) {
        finalAvatarUrl = data.avatarUrlInput;
        logger.info(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: Using avatar URL:", finalAvatarUrl);
      } else if (data.avatarMode === 'remove') {
        finalAvatarUrl = null; 
        logger.info(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: Removing avatar.");
      } else if (data.avatarMode === 'keep') {
        finalAvatarUrl = currentUser.avatarUrl; 
        logger.info(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: Keeping current avatar.");
      } else if (data.avatarMode === 'none') {
        finalAvatarUrl = null; 
        logger.info(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: No avatar (or removed if was 'none' and there was an avatar).");
      }
      
      const updates: { name?: string; avatarUrl?: string } = {};
      let changed = false;
      if (data.name !== currentUser.name) {
        updates.name = data.name;
        changed = true;
        logger.debug(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: Name modified.");
      }
      if (finalAvatarUrl !== undefined && finalAvatarUrl !== currentUser.avatarUrl) {
        // Only assign if we have a valid string URL, skip null values
        if (finalAvatarUrl !== null) {
          updates.avatarUrl = finalAvatarUrl;
        }
        // For null values (avatar removal), we don't add avatarUrl to updates
        // This will be handled by the server action
        changed = true;
        logger.debug(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: Avatar modified.");
      }

      if (!changed && !profileDirtyFields.avatarMode && !profileDirtyFields.avatarFile && !profileDirtyFields.avatarUrlInput && !profileDirtyFields.name) {
         logger.info(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: No profile changes detected.");
         toast({ title: "No Profile Changes", description: "No changes detected for the profile." });
         setIsSubmittingProfile(false);
         return true; 
      }
      
      const { error: updateError, user: updatedUserResult } = await updateCurrentUserData(updates);
      if (updateError) {
        throw new Error(updateError.message || "Unable to save profile changes.");
      }
      
      // Enhanced success message based on what was updated
      let successMessage = "Your information has been saved.";
      let cleanupMessage = "";
      
      if (updates.avatarUrl !== undefined && updates.name) {
        successMessage = "Profile and avatar updated successfully.";
        cleanupMessage = " Old avatar cleanup happens in background.";
      } else if (updates.avatarUrl !== undefined) {
        if (updates.avatarUrl === null) {
          successMessage = "Avatar removed successfully.";
        } else {
          successMessage = "Avatar updated successfully.";
        }
        cleanupMessage = " Old avatar cleanup happens in background.";
      } else if (updates.name) {
        successMessage = "Name updated successfully.";
      }
      
      // Show immediate success feedback
      toast({
        title: "Profile Updated",
        description: successMessage + (avatarWillChange && currentUser.avatarUrl ? cleanupMessage : "")
      });
      
      if (avatarFileRef.current) avatarFileRef.current.value = "";
      setCroppedFile(null); // Clear cropped file after successful upload
      
      // Reset the form to clear the file input and prevent crop dialog from reopening
      resetProfileForm({
        name: updatedUserResult?.name || currentUser.name || "",
        avatarMode: "keep", // Reset to keep current after successful upload
        avatarFile: undefined,
        avatarUrlInput: ""
      });
      
      // Clear cleanup indicator since main update is complete
      setIsCleaningUpAvatar(false);
      
      return true;
    } catch (e: any) {
      logger.error(USER_PROFILE_FORM_CONTEXT, "onProfileSubmitInternal: Profile update error:", e.message);
      toast({ title: "Profile Update Error", description: e.message, variant: "destructive" });
      return false;
    } finally {
      setIsSubmittingProfile(false);
      setIsCleaningUpAvatar(false);
    }
  };
  
  /**
   * Internal handler for password form submission
   * Validates and updates user password through Supabase auth
   * @param data - Password form data with new password and confirmation
   * @returns Promise<boolean> - Success status of the password update
   */
  const onPasswordSubmitInternal = async (data: PasswordFormData): Promise<boolean> => {
    logger.info(USER_PROFILE_FORM_CONTEXT, "onPasswordSubmitInternal: Starting password submission.");
    if (!newPasswordValue || newPasswordValue.trim() === "") {
      if (passwordDirtyFields.newPassword || passwordDirtyFields.confirmPassword) {
        logger.info(USER_PROFILE_FORM_CONTEXT, "onPasswordSubmitInternal: Password fields touched but empty, no password change.");
         toast({ title: "No Password Change", description: "No new password was entered." });
      } else {
        logger.info(USER_PROFILE_FORM_CONTEXT, "onPasswordSubmitInternal: No password change expected.");
      }
      setIsSubmittingPassword(false);
      return true; 
    }
    setIsSubmittingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: data.newPassword });
    setIsSubmittingPassword(false);

    if (error) {
      logger.error(USER_PROFILE_FORM_CONTEXT, "onPasswordSubmitInternal: Password update error:", error.message);
      toast({ title: "Password Update Error", description: error.message || "Unable to update password.", variant: "destructive" });
      return false;
    }
    logger.info(USER_PROFILE_FORM_CONTEXT, "onPasswordSubmitInternal: Password updated successfully.");
    toast({ title: "Password Updated", description: "Your password has been updated successfully." });
    resetPasswordForm({newPassword: "", confirmPassword: ""}); 
    return true;
  };
  
  useImperativeHandle(ref, () => ({
    submitProfileForm: async () => {
      return new Promise<boolean>((resolve) => {
        handleSubmitProfile(onProfileSubmitInternal as SubmitHandler<ProfileFormData>)().then(() => {
          resolve(true);
        }).catch(() => {
          resolve(false);
        });
      });
    },
    submitPasswordForm: async () => {
      return new Promise<boolean>((resolve) => {
        handleSubmitPassword(onPasswordSubmitInternal as SubmitHandler<PasswordFormData>)().then(() => {
          resolve(true);
        }).catch(() => {
          resolve(false);
        });
      });
    },
  }));
  
  if (authLoading && !currentUser) {
    return (
      <Card className="w-full max-w-2xl mx-auto shadow-xl overflow-hidden">
        <CardHeader className="text-center pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
          <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-2" />
          <CardTitle className="text-3xl md:text-4xl font-headline">Loading Profile</CardTitle>
          <CardDescription className="mt-1 text-muted-foreground">Please wait while we load your profile...</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!currentUser) {
    return (
      <Card className="w-full max-w-2xl mx-auto shadow-xl overflow-hidden">
        <CardHeader className="text-center pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
          <AlertOctagon className="mx-auto h-12 w-12 text-destructive mb-2" />
          <CardTitle className="text-3xl md:text-4xl font-headline">Error</CardTitle>
          <CardDescription className="mt-1 text-muted-foreground">User not found. Please log in.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isProcessing = isSubmittingProfile || isSubmittingPassword || authLoading || isCleaningUpAvatar;

  const currentAvatarDisplay = () => {
    if (avatarPreview && (profileAvatarMode !== 'remove' && profileAvatarMode !== 'none')) {
        return <NextImage src={avatarPreview} alt="Avatar Preview" width={80} height={80} className="rounded-full object-cover aspect-square" data-ai-hint="avatar preview"/>;
    }
    return (
        <Avatar className="w-20 h-20">
            <AvatarFallback>
                <DynamicBoringAvatar
                    size={80}
                    name={currentUser.name || currentUser.email || currentUser.id}
                    variant="beam"
                    colors={['#F0A884', '#F0C0A4', '#F0D8C4', '#F0E8E4', '#F0F0F0']}
                />
            </AvatarFallback>
        </Avatar>
    );
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="text-center pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
          <UserIcon className="mx-auto h-12 w-12 text-primary mb-2" />
          <CardTitle className="text-3xl md:text-4xl font-headline">Your Profile</CardTitle>
          <CardDescription className="mt-1 text-muted-foreground">Update your name and avatar.</CardDescription>
        </CardHeader>
        <form onSubmit={(e) => e.preventDefault()}> 
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" {...registerProfile('name')} disabled={isProcessing} />
              {profileErrors.name && <p className="text-sm text-destructive">{profileErrors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email (not editable)</Label>
              <Input id="profile-email" type="email" value={currentUser.email} disabled />
            </div>
            
            <div className="space-y-2">
              <Label>Avatar</Label>
              <Controller
                name="avatarMode"
                control={profileControl}
                render={({ field }) => (
                  <RadioGroup
                    onValueChange={(value) => {
                        field.onChange(value);
                        logger.debug(USER_PROFILE_FORM_CONTEXT, `Avatar mode changed to: ${value}`);
                    }}
                    value={field.value} 
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                    disabled={isProcessing}
                  >
                    {currentUser.avatarUrl && ( 
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="keep" id="avatarModeKeep" />
                        <Label htmlFor="avatarModeKeep" className="cursor-pointer">Keep Current</Label>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="file" id="avatarModeFile" />
                      <Label htmlFor="avatarModeFile" className="cursor-pointer">Upload File</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="url" id="avatarModeUrl" />
                      <Label htmlFor="avatarModeUrl" className="cursor-pointer">Use URL</Label>
                    </div>
                    {currentUser.avatarUrl && ( 
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="remove" id="avatarModeRemove" />
                        <Label htmlFor="avatarModeRemove" className="cursor-pointer">Remove</Label>
                      </div>
                    )}
                    {!currentUser.avatarUrl && profileAvatarMode === "none" && ( 
                         <RadioGroupItem value="none" id="avatarModeNone" className="sr-only" />
                    )}
                  </RadioGroup>
                )}
              />
            </div>

            {profileAvatarMode === 'file' && (
              <div className="space-y-1.5">
                <Label htmlFor="avatarFile">Select Avatar File</Label>
                <Controller
                  name="avatarFile"
                  control={profileControl}
                  render={({ field: { onChange, onBlur, name, ref } }) => (
                    <Input
                      id="avatarFile"
                      type="file"
                      accept="image/*"
                      onBlur={onBlur}
                      name={name}
                      ref={(e) => {
                        ref(e); 
                        if (avatarFileRef) (avatarFileRef.current as any) = e;
                      }}
                      onChange={(e) => onChange(e.target.files)} 
                      disabled={isProcessing}
                    />
                  )}
                />
                {profileErrors.avatarFile && (
                  <p className="text-sm text-destructive">
                    {typeof profileErrors.avatarFile.message === 'string'
                      ? profileErrors.avatarFile.message
                      : 'Avatar file error'}
                  </p>
                )}
              </div>
            )}

            {profileAvatarMode === 'url' && (
              <div className="space-y-1.5">
                <Label htmlFor="avatarUrlInput">Avatar URL</Label>
                <Input
                  id="avatarUrlInput"
                  type="text"
                  placeholder="https://example.com/avatar.png"
                  {...registerProfile('avatarUrlInput')}
                  disabled={isProcessing}
                />
                {profileErrors.avatarUrlInput && <p className="text-sm text-destructive">{profileErrors.avatarUrlInput.message}</p>}
              </div>
            )}
            
            <div className="space-y-1.5">
                <Label>Current/New Avatar Preview</Label>
                <div className="w-20 h-20 relative">
                    {isCleaningUpAvatar && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center z-10">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                    )}
                    {currentAvatarDisplay()}
                </div>
                {isCleaningUpAvatar && (
                    <p className="text-xs text-muted-foreground flex items-center">
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Avatar update in progress...
                    </p>
                )}
            </div>
            {currentUser.updated_at && (
              <div className="text-xs text-muted-foreground pt-2 flex items-center">
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                Profile last updated: {formatDate(currentUser.updated_at, "PPPp")}
              </div>
            )}
          </CardContent>
        </form>
      </Card>

      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="text-center pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
          <Lock className="mx-auto h-12 w-12 text-primary mb-2" />
          <CardTitle className="text-3xl md:text-4xl font-headline">Change Password</CardTitle>
          <CardDescription className="mt-1 text-muted-foreground">Enter a new password below.</CardDescription>
        </CardHeader>
        <form onSubmit={(e) => e.preventDefault()}> 
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" {...registerPassword('newPassword')} disabled={isProcessing} placeholder="Min. 6 characters"/>
              {passwordErrors.newPassword && <p className="text-sm text-destructive">{passwordErrors.newPassword.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input id="confirmPassword" type="password" {...registerPassword('confirmPassword')} disabled={isProcessing} placeholder="Repeat new password"/>
              {passwordErrors.confirmPassword && <p className="text-sm text-destructive">{passwordErrors.confirmPassword.message}</p>}
            </div>
          </CardContent>
        </form>
      </Card>
      
      {/* Image Crop Dialog */}
      <ImageCropDialog
        isOpen={showCropDialog}
        onClose={handleCropDialogClose}
        imageFile={fileToProcess}
        onCropComplete={handleCropComplete}
        title="Crop Profile Picture"
      />
    </div>
  );
});

UserProfileForm.displayName = 'UserProfileForm';
export default UserProfileForm;
