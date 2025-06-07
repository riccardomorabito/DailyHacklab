"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/use-notifications';
import { UserPlus, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import NextImage from 'next/image';
import { createClient } from '@/lib/supabase/client'; 
import { logger } from '@/lib/logger';
import ImageCropDialog from '@/components/image-crop-dialog';

const REGISTER_FORM_CONTEXT = "RegisterForm";

/** Maximum avatar file size in megabytes */
const MAX_AVATAR_SIZE_MB = 2;
/** Maximum avatar file size in bytes */
const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;

/**
 * Zod schema for user registration form validation
 */
const registerSchema = z.object({
  name: z.string().min(2, { message: "Name must contain at least 2 characters." }),
  email: z.string().email({ message: "Enter a valid email address." }),
  password: z.string().min(6, { message: "Password must contain at least 6 characters." }),
  confirmPassword: z.string(),
  avatarMode: z.enum(['file', 'url', 'none']),
  avatarFile: z.any().optional(),
  avatarUrlInput: z.string().url({ message: "Enter a valid URL." }).optional().or(z.literal('')), 
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"], 
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
 * Type definition for register form data based on the Zod schema
 */
type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * RegisterForm component - User registration interface
 * Provides comprehensive registration form with avatar upload capabilities
 * Features form validation, avatar preview, and multiple avatar input methods
 * Handles user registration, profile setup, and welcome notifications
 * @returns JSX element representing the registration form
 */
export default function RegisterForm() {
  const { register: registerUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { showWelcomeNotification, requestPermission } = useNotifications();
  const [isSubmittingForm, setIsSubmittingForm] = useState(false); 
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null); 
  const avatarFileRef = useRef<HTMLInputElement>(null);
  
  // Crop dialog state
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [fileToProcess, setFileToProcess] = useState<File | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null); 
  const supabase = createClient(); 

  const { register, handleSubmit, control, formState: { errors }, watch, reset } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { avatarMode: 'none' } 
  });

  const avatarMode = watch('avatarMode'); 
  const watchedAvatarFile = watch('avatarFile'); 
  const watchedAvatarUrlInput = watch('avatarUrlInput');

  useEffect(() => {
    logger.debug(REGISTER_FORM_CONTEXT, `useEffect (avatar): avatarMode: ${avatarMode}, watchedAvatarFile: ${watchedAvatarFile?.length}, watchedAvatarUrlInput: ${watchedAvatarUrlInput}`);
    if (avatarMode === 'file' && watchedAvatarFile && typeof FileList !== 'undefined' && watchedAvatarFile instanceof FileList && watchedAvatarFile.length > 0) {
      const file = watchedAvatarFile[0];
      if (typeof File !== 'undefined' && file instanceof File) {
        // Check if this is a new file selection (not the result of cropping)
        if (!croppedFile || file !== croppedFile) {
          setFileToProcess(file);
          setShowCropDialog(true);
          logger.debug(REGISTER_FORM_CONTEXT, "useEffect (avatar): Opening crop dialog for file selection.");
        } else {
          // This is the cropped file, just show the preview
          const reader = new FileReader();
          reader.onloadend = () => setAvatarPreview(reader.result as string);
          reader.readAsDataURL(file);
          logger.debug(REGISTER_FORM_CONTEXT, "useEffect (avatar): Avatar preview from cropped file generated.");
        }
      }
    } else if (avatarMode === 'url' && watchedAvatarUrlInput) {
      if (z.string().url().safeParse(watchedAvatarUrlInput).success) {
        setAvatarPreview(watchedAvatarUrlInput);
        logger.debug(REGISTER_FORM_CONTEXT, "useEffect (avatar): Avatar preview from URL set.");
      } else {
        setAvatarPreview(null);
      }
    } else {
      setAvatarPreview(null); 
      logger.debug(REGISTER_FORM_CONTEXT, "useEffect (avatar): Avatar preview reset (none or keep).");
    }
  }, [watchedAvatarFile, avatarMode, watchedAvatarUrlInput, croppedFile]);

  /**
   * Handles completion of image cropping
   * @param croppedImageFile - The cropped image file
   */
  const handleCropComplete = (croppedImageFile: File) => {
    setCroppedFile(croppedImageFile);
    setShowCropDialog(false);
    
    // Create a new FileList with the cropped file and update the form
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(croppedImageFile);
    const newFileList = dataTransfer.files;
    
    // Update the form field with the cropped file
    if (avatarFileRef.current) {
      avatarFileRef.current.files = newFileList;
    }
    
    logger.debug(REGISTER_FORM_CONTEXT, "handleCropComplete: Cropping completed successfully.");
  };

  /**
   * Handles closing of the crop dialog
   */
  const handleCropDialogClose = () => {
    setShowCropDialog(false);
    setFileToProcess(null);
    
    // Reset the file input if user cancels cropping
    if (avatarFileRef.current) {
      avatarFileRef.current.value = '';
    }
    
    logger.debug(REGISTER_FORM_CONTEXT, "handleCropDialogClose: Crop dialog closed.");
  };

  /**
   * Handles form submission for user registration
   * Processes avatar upload, validates data, and creates user account
   * @param data - RegisterFormData containing form input values
   */
  const onSubmit: SubmitHandler<RegisterFormData> = async (data) => {
    logger.info(REGISTER_FORM_CONTEXT, "onSubmit: Registration attempt for email:", data.email);
    setIsSubmittingForm(true);
    let finalAvatarUrl: string | undefined = undefined; 

    try {
      if (data.avatarMode === 'file' && data.avatarFile && typeof FileList !== 'undefined' && data.avatarFile instanceof FileList && data.avatarFile.length > 0) {
        // Use the cropped file if available, otherwise use the original file
        const fileToUpload = croppedFile || data.avatarFile[0];
        if (typeof File === 'undefined' || !(fileToUpload instanceof File)) {
          throw new Error("Selected avatar file is invalid.");
        }
        const fileExt = fileToUpload.name.split('.').pop();
        // Use a temporary name/path that doesn't depend on user ID (which is not available yet)
        // or a public path if policies allow it for initial uploads.
        // Here we use a path that could be rewritten/associated after user creation if necessary.
        const fileName = `public/temp_avatar_${Date.now()}.${fileExt}`; 
        logger.debug(REGISTER_FORM_CONTEXT, `onSubmit: Uploading avatar file: ${fileName}`);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars') 
          .upload(fileName, fileToUpload, { upsert: true }); 

        if (uploadError) {
          logger.error(REGISTER_FORM_CONTEXT, "onSubmit: Avatar upload error:", uploadError.message);
          throw new Error(`Avatar upload error: ${uploadError.message}`);
        }
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        finalAvatarUrl = publicUrlData?.publicUrl;
        if (!finalAvatarUrl) {
          logger.warn(REGISTER_FORM_CONTEXT, "onSubmit: Unable to get public URL for avatar after upload.");
          throw new Error("Unable to get public URL for avatar after upload.");
        }
        logger.info(REGISTER_FORM_CONTEXT, "onSubmit: Avatar uploaded successfully. URL:", finalAvatarUrl);
      } else if (data.avatarMode === 'url' && data.avatarUrlInput) {
        finalAvatarUrl = data.avatarUrlInput; 
        logger.info(REGISTER_FORM_CONTEXT, "onSubmit: Using provided avatar URL:", finalAvatarUrl);
      }

      const { error } = await registerUser(data.name, data.email, data.password, finalAvatarUrl);

      if (error) {
        logger.warn(REGISTER_FORM_CONTEXT, "onSubmit: Registration failed:", error.message);
        toast({ title: "Registration Failed", description: error.message || "The email might already be in use or an error occurred.", variant: "destructive" });
      } else {
        logger.info(REGISTER_FORM_CONTEXT, "onSubmit: Registration submitted successfully for:", data.email);
        toast({ title: "Registration Submitted!", description: `Check your email to confirm registration. You can then log in.` });
        
        // Request notification permission for future use
        setTimeout(async () => {
          await requestPermission();
        }, 2000);
        
        reset();
        setAvatarPreview(null); 
        setCroppedFile(null); // Clear cropped file state
        if (avatarFileRef.current) avatarFileRef.current.value = ""; 
        router.push('/login'); 
      }
    } catch (e: any) {
      logger.error(REGISTER_FORM_CONTEXT, "onSubmit: Error during avatar operation or registration:", e.message);
      toast({ title: "Avatar Operation Error", description: e.message || "An error occurred during avatar handling.", variant: "destructive" });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const isLoading = authLoading || isSubmittingForm; 

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center">
          <UserPlus className="mr-2 h-6 w-6 text-primary" /> Create New Account
        </CardTitle>
        <CardDescription>Enter your details to register for Daily Hacklab.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" {...register('name')} placeholder="John Doe" className="text-base" disabled={isLoading} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} placeholder="you@example.com" className="text-base" disabled={isLoading} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} placeholder="••••••••" className="text-base" disabled={isLoading} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" type="password" {...register('confirmPassword')} placeholder="••••••••" className="text-base" disabled={isLoading} />
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Avatar (Optional)</Label>
            <Controller
              name="avatarMode"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  onValueChange={(value) => {
                    field.onChange(value);
                    logger.debug(REGISTER_FORM_CONTEXT, `Avatar mode changed to: ${value}`);
                  }}
                  value={field.value}
                  className="flex flex-wrap gap-x-4 gap-y-2" // Better wrapping for small screens
                  disabled={isLoading}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="file" id="avatarModeFile" />
                    <Label htmlFor="avatarModeFile" className="cursor-pointer">Upload File</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="url" id="avatarModeUrl" />
                    <Label htmlFor="avatarModeUrl" className="cursor-pointer">Use URL</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="avatarModeNone" />
                    <Label htmlFor="avatarModeNone" className="cursor-pointer">None</Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>

          {avatarMode === 'file' && (
            <div className="space-y-2">
              <Label htmlFor="avatarFile">Select Avatar File</Label>
              <Controller
                  name="avatarFile"
                  control={control}
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
                      onChange={(e) => onChange(e.target.files)} // Send the FileList
                      disabled={isLoading}
                    />
                  )}
              />
              {avatarPreview && (
                <div className="mt-2 w-20 h-20 relative">
                  <NextImage src={avatarPreview} alt="Avatar Preview" layout="fill" objectFit="cover" className="rounded-md" data-ai-hint="avatar preview"/>
                </div>
              )}
              {errors.avatarFile && (
                <p className="text-sm text-destructive">
                  {typeof errors.avatarFile.message === 'string'
                    ? errors.avatarFile.message
                    : 'Avatar file error'}
                </p>
              )}
            </div>
          )}

          {avatarMode === 'url' && (
            <div className="space-y-2">
              <Label htmlFor="avatarUrlInput">Avatar URL</Label>
              <Input
                id="avatarUrlInput"
                type="text"
                placeholder="https://example.com/avatar.png"
                {...register('avatarUrlInput')}
                disabled={isLoading}
              />
              {errors.avatarUrlInput && <p className="text-sm text-destructive">{errors.avatarUrlInput.message}</p>}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Registering...' : 'Register'}
          </Button>
        </CardFooter>
      </form>
      
      {/* Image Crop Dialog */}
      <ImageCropDialog
        isOpen={showCropDialog}
        imageFile={fileToProcess}
        onCropComplete={handleCropComplete}
        onClose={handleCropDialogClose}
      />
    </Card>
  );
}
