"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { Submission } from '@/types';
import { getAllSubmissionsForAdmin, moderateSubmission, deleteSubmissionByAdmin } from '@/actions/submission'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NextImage from 'next/image'; 
import { CheckCircle, XCircle, AlertTriangle, CalendarDays, ImageIcon, ChevronLeft, ChevronRight, Info, Frown, ShieldAlert, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateInUserTimezone } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';
import ErrorDisplay from './error-display'; 
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import DynamicBoringAvatar from '@/components/dynamic-boring-avatar';
import { useAvatarLoader } from '@/hooks/use-avatar-loader';

const ADMIN_DASHBOARD_CONTEXT = "AdminDashboard";

/**
 * UserAvatar component - Handles robust avatar loading with fallback for admin panel
 * Uses the avatar loader hook for proper error handling and CORS recovery
 */
const UserAvatar: React.FC<{
  avatarUrl?: string | null;
  userId: string;
  userName?: string | null;
  size?: number;
  className?: string;
}> = ({ avatarUrl, userId, userName, size = 40, className = "h-10 w-10" }) => {
  const {
    shouldShowImage,
    shouldShowFallback,
    handleImageError,
    handleImageLoad,
  } = useAvatarLoader({
    avatarUrl,
    userId,
    userName: userName || undefined,
    enableDebugLogging: false,
  });

  return (
    <Avatar className={className}>
      {shouldShowImage && avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt={userName || "User Avatar"}
          onError={handleImageError}
          onLoad={handleImageLoad}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      )}
      <AvatarFallback>
        <DynamicBoringAvatar
          size={size}
          name={userName || userId}
          variant="beam"
          colors={['#F0A884', '#F0C0A4', '#F0D8C4', '#F0E8E4', '#F0F0F0']}
        />
      </AvatarFallback>
    </Avatar>
  );
};

/**
 * ImageGallery component - Displays a carousel of images for submissions
 * @param photoUrls - Array of photo URLs to display
 * @param altPrefix - Prefix for alt text of images
 * @returns JSX element representing the image gallery
 */
const ImageGallery: React.FC<{ photoUrls: string[], altPrefix: string }> = ({ photoUrls, altPrefix }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!photoUrls || photoUrls.length === 0) {
    return <p className="text-sm text-muted-foreground">No photos provided.</p>;
  }

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? photoUrls.length - 1 : prevIndex - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex === photoUrls.length - 1 ? 0 : prevIndex + 1));
  };

  return (
    <div className="mb-4 rounded-lg overflow-hidden border relative">
      <NextImage
        src={photoUrls[currentIndex]}
        alt={`${altPrefix} - Photo ${currentIndex + 1} of ${photoUrls.length}`}
        width={600}
        height={338}
        className="object-cover w-full aspect-video"
        data-ai-hint="submission admin"
      />
      {photoUrls.length > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full h-8 w-8"
            onClick={goToPrevious}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full h-8 w-8"
            onClick={goToNext}
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            {currentIndex + 1} / {photoUrls.length}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * AdminDashboard component - Main admin interface for content moderation
 * Displays all submissions with approval/rejection controls and deletion functionality
 * Allows administrators to moderate user submissions
 * @returns JSX element representing the admin dashboard
 */
export default function AdminDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const [submissionToDelete, setSubmissionToDelete] = useState<Submission | null>(null);

  const fetchSubmissionsForAdmin = useCallback(async () => {
    logger.info(ADMIN_DASHBOARD_CONTEXT, "fetchSubmissionsForAdmin: Starting submission retrieval.");
    setIsLoading(true);
    setError(null);
    setErrorDetails(undefined);
    const { data, error: fetchError } = await getAllSubmissionsForAdmin();
    if (fetchError) {
      logger.error(ADMIN_DASHBOARD_CONTEXT, "fetchSubmissionsForAdmin: Error during submission retrieval:", fetchError);
      setError("Unable to load submissions for moderation.");
      setSubmissions([]);
    } else if (data) {
      const sortedSubmissions = [...data].sort((a, b) => {
        if (a.approved === null && b.approved !== null) return -1; 
        if (a.approved !== null && b.approved === null) return 1;
        return new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime(); 
      });
      setSubmissions(sortedSubmissions);
      logger.info(ADMIN_DASHBOARD_CONTEXT, `fetchSubmissionsForAdmin: Retrieved ${data.length} submissions.`);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSubmissionsForAdmin();
  }, [fetchSubmissionsForAdmin]);

  const handleModerate = async (id: string, newApproveStatus: boolean) => {
    logger.info(ADMIN_DASHBOARD_CONTEXT, `handleModerate: Attempting moderation for submission ID ${id} to ${newApproveStatus}.`);
    const originalSubmissions = [...submissions];
    setSubmissions(prev =>
        prev.map(sub => sub.id === id ? { ...sub, approved: newApproveStatus } : sub)
            .sort((a, b) => { 
                if (a.approved === null && b.approved !== null) return -1;
                if (a.approved !== null && b.approved === null) return 1;
                return new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime();
            })
    );

    const { success, error: moderationError } = await moderateSubmission(id, newApproveStatus);
    
    if (success) {
      logger.info(ADMIN_DASHBOARD_CONTEXT, `handleModerate: Submission ID ${id} successfully moderated to ${newApproveStatus}.`);
      toast({ title: "Moderation Updated", description: `Submission ${newApproveStatus ? 'approved' : 'rejected'}.` });
    } else {
      logger.error(ADMIN_DASHBOARD_CONTEXT, `handleModerate: Error during moderation of submission ID ${id}:`, moderationError);
      toast({ title: "Moderation Error", description: moderationError || "Unable to update status.", variant: "destructive" });
      setSubmissions(originalSubmissions); 
    }
  };

  const handleDeleteConfirm = async () => {
    if (!submissionToDelete) return;
    logger.info(ADMIN_DASHBOARD_CONTEXT, `handleDeleteConfirm: Confirming deletion for submission ID ${submissionToDelete.id}.`);
    
    const originalSubmissions = [...submissions];
    setSubmissions(prev => prev.filter(sub => sub.id !== submissionToDelete.id));

    const { success, error: deleteError } = await deleteSubmissionByAdmin(submissionToDelete.id);
    
    if (success) {
      logger.info(ADMIN_DASHBOARD_CONTEXT, `handleDeleteConfirm: Submission ID ${submissionToDelete.id} successfully deleted.`);
      toast({ title: "Submission Deleted", description: "The submission has been deleted." });
    } else {
      logger.error(ADMIN_DASHBOARD_CONTEXT, `handleDeleteConfirm: Error during deletion of submission ID ${submissionToDelete.id}:`, deleteError);
      toast({ title: "Deletion Error", description: deleteError || "Unable to delete the submission.", variant: "destructive" });
      setSubmissions(originalSubmissions); 
    }
    setSubmissionToDelete(null); 
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-center font-headline">Admin Panel - Content Moderation</h2>
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
     return <ErrorDisplay message={error} details={errorDetails} title="Error Loading Content" />;
  }

  if (submissions.length === 0) {
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-center font-headline">Admin Panel - Content Moderation</h2>
        <Card className="w-full text-center shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-headline">No Submissions</CardTitle>
            </CardHeader>
            <CardContent className="py-10">
                <Info className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">There are currently no submissions to moderate.</p>
            </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-center font-headline">Admin Panel - Content Moderation</h2>
      {submissions.map((submission) => (
        <Card key={submission.id} className={`overflow-hidden shadow-xl border-2 
          ${submission.approved === null ? 'border-yellow-400 dark:border-yellow-600' 
          : submission.approved ? 'border-green-400 dark:border-green-600' 
          : 'border-red-400 dark:border-red-600'}`}>
          <CardHeader className="pb-3">
             <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                <UserAvatar
                  avatarUrl={submission.user_avatar_url}
                  userId={submission.user_id}
                  userName={submission.user_name}
                  size={40}
                  className="h-10 w-10"
                />
                <div>
                    <CardTitle className="text-xl font-headline">{submission.user_name}</CardTitle>
                    <div className="flex items-center text-xs text-muted-foreground">
                        <CalendarDays className="mr-1 h-3 w-3" />
                        {formatDateInUserTimezone(submission.submission_date, "PPPp")}
                    </div>
                </div>
                </div>
                <div>
                    {submission.approved === null && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-600 dark:text-yellow-100"><AlertTriangle className="h-3 w-3 mr-1" />Pending</span>}
                    {submission.approved === true && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-600 dark:text-green-100"><CheckCircle className="h-3 w-3 mr-1" />Approved</span>}
                    {submission.approved === false && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-600 dark:text-red-100"><XCircle className="h-3 w-3 mr-1" />Rejected</span>}
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <ImageGallery photoUrls={submission.photo_urls || []} altPrefix={`Submission by ${submission.user_name}`} />
            {submission.summary && (
              <p className="text-foreground/90 leading-relaxed bg-secondary/30 p-3 rounded-md whitespace-pre-wrap">{submission.summary}</p>
            )}
             {(!submission.photo_urls || submission.photo_urls.length === 0) && (
              <div className="flex items-center text-sm text-muted-foreground p-3 bg-muted/20 rounded-md">
                <ImageIcon className="mr-2 h-4 w-4" />
                No photos provided for this submission.
              </div>
            )}
             <div className="mt-3 text-xs text-muted-foreground">ID: {submission.id} - UserID: {submission.user_id}</div>
          </CardContent>
          <CardFooter className="bg-muted/30 p-4 flex items-center">
            <div className="flex-grow"></div> {/* Spacer */}
            <div className="flex items-center space-x-3">
                <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="default" className="bg-red-500 hover:bg-red-600 text-white" onClick={() => setSubmissionToDelete(submission)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                </AlertDialogTrigger>
                {submissionToDelete && submissionToDelete.id === submission.id && (
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                        <AlertDialogDescription>
                        Are you sure you want to delete this submission by "{submissionToDelete.user_name}"? This action is irreversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSubmissionToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
                        Yes, Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                )}
                </AlertDialog>
                <Button variant="default" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleModerate(submission.id, false)} disabled={submission.approved === false}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
                <Button variant="default" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleModerate(submission.id, true)} disabled={submission.approved === true}>
                <CheckCircle className="mr-2 h-4 w-4" /> Approve
                </Button>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
