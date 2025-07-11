"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Image as ImageIcon, Loader2, X } from 'lucide-react';
import NextImage from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { createPostAction } from '@/actions/posts';
import { logger } from '@/lib/logger';

const CONTENT_CREATION_FORM_CONTEXT = "ContentCreationForm";
const MAX_PHOTOS = 5;
const MAX_INDIVIDUAL_FILE_SIZE_MB = 5; 
const MAX_INDIVIDUAL_FILE_SIZE_BYTES = MAX_INDIVIDUAL_FILE_SIZE_MB * 1024 * 1024;
const MAX_TOTAL_POST_SIZE_MB = 10; 
const MAX_TOTAL_POST_SIZE_BYTES = MAX_TOTAL_POST_SIZE_MB * 1024 * 1024;

const singleFileSchema = z.instanceof(File, { message: "Expected a file." })
  .refine(file => file.size > 0, "File cannot be empty.")
  .refine(file => file.size <= MAX_INDIVIDUAL_FILE_SIZE_BYTES, `Each photo must not exceed ${MAX_INDIVIDUAL_FILE_SIZE_MB}MB.`)
  .refine(
    file => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type),
    "Supported file formats: JPG, PNG, WEBP, GIF."
  );

const multipleFilesSchema = z.array(singleFileSchema)
  .min(1, 'At least one photo is required.')
  .max(MAX_PHOTOS, `You can upload a maximum of ${MAX_PHOTOS} photos.`)
  .refine(files => {
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    return totalSize <= MAX_TOTAL_POST_SIZE_BYTES;
  }, `The total size of all photos cannot exceed ${MAX_TOTAL_POST_SIZE_MB}MB.`);

const postSchema = z.object({
  photos: z.union([
    z.instanceof(FileList).transform((fileList) => {
      const filesArray = Array.from(fileList);
      logger.debug(CONTENT_CREATION_FORM_CONTEXT, "Zod transform (photos): FileList converted to Array. Length:", filesArray.length);
      return filesArray;
    }),
    z.array(z.instanceof(File))
  ]).pipe(multipleFilesSchema),
  summary: z.string().max(1000, "The summary cannot exceed 1000 characters.").optional(),
});

type PostFormData = z.infer<typeof postSchema>;

/**
 * ContentCreationForm component - Form for users to create new posts
 * Allows users to upload photos and write summaries of their projects/activities
 * Features file validation, preview functionality, and secure form submission
 * Includes comprehensive error handling and loading states
 * @returns JSX element representing the content creation form
 */
export default function ContentCreationForm() {
  const [previews, setPreviews] = useState<string[]>([]);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state
  const previewUrlsRef = useRef<string[]>([]); // Store URLs for cleanup

  const { control, handleSubmit, formState: { errors, isSubmitting: isFormProcessingInternal }, watch, reset, setValue } = useForm<PostFormData>({
    resolver: zodResolver(postSchema) as any,
    defaultValues: {
      photos: undefined,
      summary: "",
    }
  });

  const photosValue = watch("photos");

  // Function to remove a photo by index
  const removePhoto = (indexToRemove: number) => {
    let currentFilesArray: File[] = [];

    if (photosValue instanceof FileList) {
      currentFilesArray = Array.from(photosValue);
    } else if (Array.isArray(photosValue) && photosValue.every(item => item instanceof File)) {
      currentFilesArray = photosValue;
    }

    const newFilesArray = currentFilesArray.filter((_, index) => index !== indexToRemove);
    
    // Create a new FileList-like object or use array
    const dataTransfer = new DataTransfer();
    newFilesArray.forEach(file => dataTransfer.items.add(file));
    
    // Update the form field
    setValue('photos', newFilesArray);
    
    // Update the input element
    if (photoInputRef.current) {
      photoInputRef.current.files = dataTransfer.files;
    }
  };

  useEffect(() => {
    logger.debug(CONTENT_CREATION_FORM_CONTEXT, "useEffect (photosValue): photosValue changed:", photosValue);
    
    let currentFilesArray: File[] = [];

    if (photosValue instanceof FileList) {
      currentFilesArray = Array.from(photosValue);
    } else if (Array.isArray(photosValue) && photosValue.every(item => item instanceof File)) {
      currentFilesArray = photosValue;
    }
    
    if (currentFilesArray.length > 0) {
      // Create new preview URLs
      const newPreviewsArray = currentFilesArray.map(file => {
        if (file instanceof File && file.size > 0) {
          return URL.createObjectURL(file);
        }
        return '';
      }).filter(url => url !== '');
      
      // Clean up old URLs after setting new ones
      setTimeout(() => {
        previewUrlsRef.current.forEach(url => {
          if (url.startsWith('blob:') && !newPreviewsArray.includes(url)) {
            URL.revokeObjectURL(url);
          }
        });
      }, 100); // Small delay to ensure images start loading
      
      previewUrlsRef.current = newPreviewsArray;
      setPreviews(newPreviewsArray);
      logger.debug(CONTENT_CREATION_FORM_CONTEXT, `useEffect (photosValue): Generated ${newPreviewsArray.length} preview URLs.`);
    } else {
      // No files selected, clean up all URLs
      previewUrlsRef.current.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      previewUrlsRef.current = [];
      setPreviews([]);
    }
  }, [photosValue]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      logger.debug(CONTENT_CREATION_FORM_CONTEXT, "Component unmount: Revoking all preview URLs.");
      previewUrlsRef.current.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  const onSubmit: SubmitHandler<PostFormData> = async (data) => {
    logger.info(CONTENT_CREATION_FORM_CONTEXT, "onSubmit: Attempting form submission. Data validated by Zod:", data);
    setIsSubmitting(true); // Start loading
    
    if (!currentUser) {
      logger.warn(CONTENT_CREATION_FORM_CONTEXT, "onSubmit: User not authenticated.");
      toast({ title: "Authentication Error", description: "You must be logged in to create a post.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (!data.photos || data.photos.length === 0) {
      logger.error(CONTENT_CREATION_FORM_CONTEXT, "onSubmit: data.photos is empty or not an array despite Zod validation. This should not happen.");
      toast({ title: "Validation Error", description: "Photos are required. Select at least one photo.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    
    const formData = new FormData();
    data.photos.forEach((file, index) => {
      if (file instanceof File) {
        formData.append(`photos`, file, file.name);
        logger.debug(CONTENT_CREATION_FORM_CONTEXT, `onSubmit: Added file ${index} to FormData: Name: ${file.name}, Size: ${file.size}, Type: ${file.type}`);
      } else {
        logger.warn(CONTENT_CREATION_FORM_CONTEXT, `onSubmit: Element at index ${index} in data.photos is not a File object. Skipping. Element:`, file);
      }
    });

    if (data.summary) {
      formData.append('summary', data.summary);
    }

    logger.info(CONTENT_CREATION_FORM_CONTEXT, "onSubmit: FormData prepared for server action. Content summary:");
    for (let pair of formData.entries()) {
        if (pair[1] instanceof File) {
             logger.debug(CONTENT_CREATION_FORM_CONTEXT, `onSubmit: FormData entry: ${pair[0]}, File Name: ${pair[1].name}, Size: ${pair[1].size}, Type: ${pair[1].type}`);
        } else {
             logger.debug(CONTENT_CREATION_FORM_CONTEXT, `onSubmit: FormData entry: ${pair[0]}, Value: ${pair[1]}`);
        }
    }

    try {
      const result = await createPostAction(formData);
      logger.info(CONTENT_CREATION_FORM_CONTEXT, "onSubmit: Result from createPostAction:", result);

      if (result.success && result.postId) {
        toast({ title: "Post Created!", description: `Your post has been submitted (ID: ${result.postId.substring(0,8)}...). It will be reviewed shortly.` });
        
        // Clean up blob URLs before reset
        previewUrlsRef.current.forEach(url => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
        previewUrlsRef.current = [];
        
        reset();
        setPreviews([]);
        if (photoInputRef.current) {
          photoInputRef.current.value = "";
        }
      } else {
        toast({ title: "Creation Error", description: result.error || "An unknown error occurred during post creation.", variant: "destructive" });
        logger.error(CONTENT_CREATION_FORM_CONTEXT, "onSubmit: createPostAction reported failure:", result.error);
      }
    } catch (e: any) {
      logger.error(CONTENT_CREATION_FORM_CONTEXT, "onSubmit: Error during createPostAction call:", e);
      let errorMessage = "An unexpected error occurred during post creation.";
      if (e.message && e.message.includes("Body exceeded")) {
        errorMessage = `The uploaded files are too large. Make sure the total size is less than ${MAX_TOTAL_POST_SIZE_MB}MB. You can also try uploading fewer files or reducing their resolution.`;
      } else if (e.message) {
        errorMessage = e.message;
      }
      toast({
        title: "Creation Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 7000, 
      });
    } finally {
      setIsSubmitting(false); // End loading
    }
  };
  
  const isActuallySubmitting = isSubmitting || isFormProcessingInternal;

  return (
    <div className="w-full flex justify-center pt-10">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center p-6 bg-gradient-to-br from-primary/10 via-background to-background">
          <UploadCloud className="mx-auto h-16 w-16 text-primary" />
          <CardTitle className="text-4xl font-headline mt-4">Create a New Post</CardTitle>
          <CardDescription className="mt-2 text-lg text-muted-foreground">
            Share your work with the community. Posts are reviewed before publication.
          </CardDescription>
        </CardHeader>
      <form onSubmit={handleSubmit(onSubmit as any)}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="photos">Photos (Required)</Label>
            <Controller
              name="photos"
              control={control}
              defaultValue={undefined}
              render={({ field }) => (
                <Input
                  id="photos"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onBlur={field.onBlur}
                  onChange={(e) => {
                    const files = e.target.files;
                    logger.debug(CONTENT_CREATION_FORM_CONTEXT, "Photo input onChange: e.target.files:", files);
                    field.onChange(files);
                  }}
                  ref={(instance) => {
                    field.ref(instance); 
                    if (instance) photoInputRef.current = instance; 
                  }}
                  className="text-base"
                  disabled={isActuallySubmitting}
                  aria-describedby="photos-error"
                />
              )}
            />
            {errors.photos && <p id="photos-error" className="text-sm text-destructive py-1">{errors.photos.message}</p>}

            {previews.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{previews.length} of {MAX_PHOTOS} photos selected:</p>
                  {previews.length < MAX_PHOTOS && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isActuallySubmitting}
                    >
                      Add More Photos
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {previews.map((src, index) => (
                    <div key={index} className="relative aspect-video rounded-md overflow-hidden border group">
                       <img
                          src={src}
                          alt={`Photo preview ${index + 1}`}
                          className="w-full h-full object-cover"
                          data-ai-hint="post preview"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removePhoto(index)}
                          disabled={isActuallySubmitting}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">Summary (Optional, max 1000 characters)</Label>
            <Textarea
              id="summary"
              placeholder="Briefly describe your activity, challenges, or what you learned..."
              {...control.register('summary')}
              className="text-base min-h-[100px]"
              disabled={isActuallySubmitting}
              aria-describedby="summary-error"
            />
            {errors.summary && <p id="summary-error" className="text-sm text-destructive py-1">{errors.summary.message}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isActuallySubmitting}>
            {isActuallySubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isActuallySubmitting ? 'Publishing...' : 'Publish Post'}
          </Button>
        </CardFooter>
      </form>
    </Card>
    </div>
  );
}
