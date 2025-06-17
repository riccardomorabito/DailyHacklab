"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Submission } from '@/types';
import { getApprovedSubmissionsByDate, toggleStarSubmission, deleteSubmissionByAdmin } from '@/actions/submission';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NextImage from 'next/image';
import { CalendarDays, ChevronLeft, ChevronRight, ImageIcon, UploadCloud, Calendar as CalendarIcon, Frown, Info, Trash2, Loader2 } from 'lucide-react';
import { format, parseISO, startOfDay, isAfter, addDays, subDays, isToday, formatISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import AppreciationStar from './star-rating';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useAvatarLoader } from '@/hooks/use-avatar-loader';
import { cn } from '@/lib/utils';
import CustomDatePicker from "@/components/custom-date-picker";
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader as AlertDialogHeaderComponent, 
  AlertDialogTitle as AlertDialogTitleComponent,   
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { logger } from '@/lib/logger';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorDisplay from './error-display';
import DynamicBoringAvatar from '@/components/dynamic-boring-avatar';

const POSTS_DISPLAY_CONTEXT = "PostsDisplay";

/**
 * UserAvatar component - Handles robust avatar loading with fallback
 * Uses the avatar loader hook for proper error handling and CORS recovery
 */
const UserAvatar: React.FC<{
  avatarUrl?: string | null;
  userId: string;
  userName?: string | null;
  size?: number;
}> = ({ avatarUrl, userId, userName, size = 40 }) => {
  const {
    shouldShowImage,
    shouldShowFallback,
    handleImageError,
    handleImageLoad,
  } = useAvatarLoader({
    avatarUrl,
    userId,
    userName: userName || undefined,
    enableDebugLogging: true,
  });

  return (
    <Avatar className="h-10 w-10">
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
 * ImageGallery component - Displays a scrollable gallery of submission images
 * @param photoUrls - Array of photo URLs to display
 * @param altPrefix - Prefix for alt text of images
 * @returns JSX element representing the image gallery
 */
const ImageGallery: React.FC<{ photoUrls: string[], altPrefix: string }> = ({ photoUrls, altPrefix }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (!photoUrls || photoUrls.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-muted/30 rounded-md text-muted-foreground">
        <ImageIcon className="w-8 h-8 mr-2" />
        <span>No photos provided</span>
      </div>
    );
  }

  if (photoUrls.length === 1) {
    return (
       <div className="relative mb-4 rounded-lg overflow-hidden border aspect-video">
        <NextImage
          src={photoUrls[0]}
          alt={`${altPrefix} - Photo 1 of 1`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          style={{ objectFit: "cover" }}
          className="object-cover w-full h-full"
          data-ai-hint="submission image"
        />
      </div>
    );
  }

  /**
   * Scrolls to a specific image in the gallery
   * @param index - Index of the image to scroll to
   */
  const scrollToImage = useCallback((index: number) => {
    setCurrentIndex(index);
    if (scrollContainerRef.current) {
      const imageElement = scrollContainerRef.current.children[index] as HTMLElement;
      if (imageElement) {
        scrollContainerRef.current.scrollTo({
          left: imageElement.offsetLeft - scrollContainerRef.current.offsetLeft,
          behavior: 'smooth',
        });
      }
    }
  }, []);

  /**
   * Handles navigation to the next image in the gallery
   */
  const handleNextImage = useCallback(() => {
    scrollToImage((currentIndex + 1) % photoUrls.length);
  }, [currentIndex, photoUrls.length, scrollToImage]);

  /**
   * Handles navigation to the previous image in the gallery
   */
  const handlePrevImage = useCallback(() => {
    scrollToImage((currentIndex - 1 + photoUrls.length) % photoUrls.length);
  }, [currentIndex, photoUrls.length, scrollToImage]);


  return (
    <div className="mb-4 relative">
      <div className="overflow-hidden rounded-lg border">
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-thin scrollbar-thumb-primary/40 scrollbar-track-transparent"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {photoUrls.map((url, index) => (
            <div key={index} className="snap-center flex-shrink-0 w-full aspect-video relative">
              <NextImage
                src={url}
                alt={`${altPrefix} - Photo ${index + 1} of ${photoUrls.length}`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                style={{ objectFit: "cover" }}
                className="object-cover"
                data-ai-hint="submission image gallery"
                priority={index === 0}
              />
            </div>
          ))}
        </div>
      </div>
      {photoUrls.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevImage}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-9 w-9 z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextImage}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-9 w-9 z-10"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
           <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10">
            {photoUrls.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollToImage(index)}
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  currentIndex === index ? "bg-white w-4" : "bg-white/50 hover:bg-white/75"
                )}
                aria-label={`Go to photo ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * PostsDisplay component - Main interface for viewing posts archives
 * Displays daily posts with date navigation and interactive features
 * Features date picker, post galleries, star ratings, and admin controls
 * Handles loading states, error conditions, and user interactions
 *
 * Avatar handling features:
 * - Robust image loading with error handling for user profile pictures
 * - Automatic fallback to generated avatars when profile images fail to load
 * - Consistent display across post entries
 * - Debug logging for troubleshooting avatar loading issues
 *
 * @returns JSX element representing the posts display interface with reliable avatar rendering
 */
export default function PostsDisplay() {
  const [selectedDateForDisplay, setSelectedDateForDisplay] = useState<Date | null>(null);
  const [displayedMonthForPicker, setDisplayedMonthForPicker] = useState<Date | null>(null);
  const [isDateInitialized, setIsDateInitialized] = useState(false);
  const [submissionsForSelectedDate, setSubmissionsForSelectedDate] = useState<Submission[]>([]);
  const [isDatePickerDialogOpen, setIsDatePickerDialogOpen] = useState(false);

  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);
  const [errorFetchingSubmissions, setErrorFetchingSubmissions] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { currentUser, isAdmin, updateCurrentUserData } = useAuth();
  const [submissionToDelete, setSubmissionToDelete] = useState<Submission | null>(null);

  useEffect(() => {
    logger.debug(POSTS_DISPLAY_CONTEXT, `useEffect (isAdmin state): isAdmin: ${isAdmin}`);
  }, [isAdmin]);

  useEffect(() => {
    const initialDate = startOfDay(new Date());
    setSelectedDateForDisplay(initialDate);
    setDisplayedMonthForPicker(initialDate);
    setIsDateInitialized(true);
    logger.info(POSTS_DISPLAY_CONTEXT, "useEffect: Date initialized to today on client mount.");
  }, []);


  /**
   * Fetches submissions for the selected date
   * Handles loading states and error conditions
   */
  const fetchSubmissions = useCallback(async () => {
    if (!selectedDateForDisplay || !isDateInitialized) {
      logger.debug(POSTS_DISPLAY_CONTEXT, "fetchSubmissions: Skipped due to uninitialized date or selectedDateForDisplay is null.");
      if (isDateInitialized && !selectedDateForDisplay) {
        setSubmissionsForSelectedDate([]);
        setIsLoadingSubmissions(false);
      }
      return;
    }
    logger.info(POSTS_DISPLAY_CONTEXT, "fetchSubmissions: Starting submissions retrieval for date:", selectedDateForDisplay.toISOString());
    setIsLoadingSubmissions(true);
    setErrorFetchingSubmissions(null);
    setErrorDetails(undefined);

    const { data, error } = await getApprovedSubmissionsByDate(selectedDateForDisplay);

    if (error) {
      logger.error(POSTS_DISPLAY_CONTEXT, "fetchSubmissions: Error during submissions retrieval:", error);
      setErrorFetchingSubmissions("Unable to load posts for this date.");
      setErrorDetails(typeof error === 'object' ? JSON.stringify(error) : error);
      setSubmissionsForSelectedDate([]);
    } else if (data) {
      const sortedData = data.sort((a, b) =>
        (b.stars_received || 0) - (a.stars_received || 0) ||
        new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime()
      );
      setSubmissionsForSelectedDate(sortedData);
      logger.info(POSTS_DISPLAY_CONTEXT, `fetchSubmissions: Retrieved ${data.length} submissions for ${selectedDateForDisplay.toISOString()}.`);
    } else {
      setSubmissionsForSelectedDate([]);
    }
    setIsLoadingSubmissions(false);
  }, [selectedDateForDisplay, isDateInitialized]);

  useEffect(() => {
    if (isDateInitialized) {
      fetchSubmissions();
    }
  }, [fetchSubmissions, isDateInitialized]);

  /**
   * Handles date selection from the date picker
   * @param date - Selected date
   */
  const handleDateSelect = (date: Date) => {
    const newSelectedDate = startOfDay(date);
    if (isAfter(newSelectedDate, startOfDay(new Date()))) {
      toast({ title: "Future Date", description: "You cannot select a future date.", variant: "destructive"});
      return;
    }
    logger.info(POSTS_DISPLAY_CONTEXT, `handleDateSelect: New date selected: ${newSelectedDate.toISOString()}`);
    setSelectedDateForDisplay(newSelectedDate);
    setDisplayedMonthForPicker(newSelectedDate);
    setIsDatePickerDialogOpen(false);
  };

  /**
   * Handles navigation to the previous day
   */
  const handlePreviousDay = () => {
    if (selectedDateForDisplay) {
      const prevDay = subDays(selectedDateForDisplay, 1);
      logger.info(POSTS_DISPLAY_CONTEXT, `handlePreviousDay: Navigation to previous day: ${prevDay.toISOString()}`);
      handleDateSelect(prevDay);
    }
  };

  /**
   * Handles navigation to the next day
   */
  const handleNextDay = () => {
    if (selectedDateForDisplay) {
      const nextDay = addDays(selectedDateForDisplay, 1);
      if (isAfter(nextDay, startOfDay(new Date()))) {
         toast({ title: "Future Date", description: "You cannot navigate beyond today.", variant: "default"});
        return;
      }
      logger.info(POSTS_DISPLAY_CONTEXT, `handleNextDay: Navigation to next day: ${nextDay.toISOString()}`);
      handleDateSelect(nextDay);
    }
  };

  /**
   * Handles star/unstar clicks on submissions
   * Manages optimistic updates and user feedback
   * @param submissionId - ID of the submission to star/unstar
   * @param authorId - ID of the submission author
   */
  const handleStarClick = useCallback(async (submissionId: string, authorId: string) => {
    logger.info(POSTS_DISPLAY_CONTEXT, `handleStarClick: Star/unstar attempt for submission ID: ${submissionId}, author ID: ${authorId}. Current user: ${currentUser?.id}`);
    if (!currentUser) {
      toast({ title: "Login Required", description: "You must be logged in to give or remove appreciation.", variant: "destructive", duration: 3000});
      return;
    }
    if (currentUser.id === authorId) {
      toast({ title: "Action Not Allowed", description: "You cannot give appreciation to your own submission.", variant: "default", duration: 3000});
      return;
    }

    const originalSubmissions = [...submissionsForSelectedDate];
    const submissionIndex = submissionsForSelectedDate.findIndex(s => s.id === submissionId);
    if (submissionIndex === -1) {
        logger.warn(POSTS_DISPLAY_CONTEXT, `handleStarClick: Submission ID ${submissionId} not found for optimistic update.`);
        return;
    }

    const submissionToUpdate = { ...submissionsForSelectedDate[submissionIndex] };
    const isCurrentlyStarredByOptimisticUser = (currentUser.starredSubmissions || []).includes(submissionId);

    submissionToUpdate.stars_received = isCurrentlyStarredByOptimisticUser
      ? Math.max(0, (submissionToUpdate.stars_received || 0) - 1)
      : (submissionToUpdate.stars_received || 0) + 1;

    const newOptimisticStarredSubmissions = isCurrentlyStarredByOptimisticUser
      ? (currentUser.starredSubmissions || []).filter(id => id !== submissionId)
      : [...(currentUser.starredSubmissions || []), submissionId];

    setSubmissionsForSelectedDate(prev =>
      prev.map(s => s.id === submissionId ? submissionToUpdate : s)
      .sort((a, b) => (b.stars_received || 0) - (a.stars_received || 0) || new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime())
    );
    if (updateCurrentUserData) {
      updateCurrentUserData({ starredSubmissions: newOptimisticStarredSubmissions });
    }
    logger.debug(POSTS_DISPLAY_CONTEXT, `handleStarClick: Optimistic UI update for submission ID ${submissionId}. New star count: ${submissionToUpdate.stars_received}`);

    const { success, error, newStarsCount, newAuthorScore, newStarredSubmissionsForCurrentUser, isStarred } = await toggleStarSubmission(submissionId);

    if (error || !success) {
      logger.error(POSTS_DISPLAY_CONTEXT, `handleStarClick: Error during toggleStarSubmission for ID ${submissionId}:`, error);
      toast({ title: "Appreciation Error", description: error || "Unable to update appreciation.", variant: "destructive" });
      setSubmissionsForSelectedDate(originalSubmissions);
      if (updateCurrentUserData && currentUser.starredSubmissions) {
         updateCurrentUserData({ starredSubmissions: currentUser.starredSubmissions });
      }
    } else {
      logger.info(POSTS_DISPLAY_CONTEXT, `handleStarClick: toggleStarSubmission success for ID ${submissionId}. New starred state: ${isStarred}, total stars: ${newStarsCount}, author score: ${newAuthorScore}`);
      toast({
        title: isStarred ? "Appreciation Sent!" : "Appreciation Removed",
        description: `Author score updated: ${newAuthorScore !== undefined ? newAuthorScore : 'N/A'}. Clip stars: ${newStarsCount}.`,
        duration: 3000
      });
      if (updateCurrentUserData && newStarredSubmissionsForCurrentUser) {
        updateCurrentUserData({ starredSubmissions: newStarredSubmissionsForCurrentUser });
      }
       setSubmissionsForSelectedDate(prev =>
        prev.map(s =>
          s.id === submissionId
            ? { ...s, stars_received: newStarsCount !== undefined ? newStarsCount : s.stars_received }
            : s
        ).sort((a, b) => (b.stars_received || 0) - (a.stars_received || 0) || new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime())
      );
    }
  }, [currentUser, submissionsForSelectedDate, toast, updateCurrentUserData]);

  /**
   * Handles confirmation and execution of submission deletion (admin only)
   */
  const handleDeleteConfirm = async () => {
    if (!submissionToDelete) return;
    logger.info(POSTS_DISPLAY_CONTEXT, `handleDeleteConfirm: Deletion confirmation for submission ID ${submissionToDelete.id}.`);

    const originalSubmissions = [...submissionsForSelectedDate];
    setSubmissionsForSelectedDate(prev => prev.filter(sub => sub.id !== submissionToDelete.id));

    const { success, error: deleteError } = await deleteSubmissionByAdmin(submissionToDelete.id);

    if (success) {
      logger.info(POSTS_DISPLAY_CONTEXT, `handleDeleteConfirm: Submission ID ${submissionToDelete.id} deleted successfully.`);
      toast({ title: "Submission Deleted", description: "The submission has been deleted." });
    } else {
      logger.error(POSTS_DISPLAY_CONTEXT, `handleDeleteConfirm: Error during deletion of submission ID ${submissionToDelete.id}:`, deleteError);
      toast({ title: "Deletion Error", description: deleteError || "Unable to delete the submission.", variant: "destructive" });
      setSubmissionsForSelectedDate(originalSubmissions);
    }
    setSubmissionToDelete(null);
  };

  useEffect(() => {
    if (isAdmin) {
      logger.info(POSTS_DISPLAY_CONTEXT, "User is admin. Delete button should be visible.");
    } else {
      logger.info(POSTS_DISPLAY_CONTEXT, "User is NOT admin. Delete button should NOT be visible.");
    }
  }, [isAdmin]);


  if (!isDateInitialized || (isLoadingSubmissions && submissionsForSelectedDate.length === 0 && !errorFetchingSubmissions)) {
     return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold font-headline">Daily Hacklab Posts</h1>
        </div>
        <div className="flex flex-col items-center gap-4 my-6">
            <Skeleton className="h-10 w-full xs:w-auto sm:w-xs" />
            <div className="flex justify-between w-full gap-2 mt-2 xs:w-auto sm:w-xs">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
            </div>
            {currentUser && <Skeleton className="h-12 w-full xs:w-auto sm:w-xs" />}
        </div>
        <div className="text-center">
            <Skeleton className="h-6 w-1/2 mx-auto" />
        </div>
        <Card className="shadow-lg">
          <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
          <CardContent><Skeleton className="h-48 w-full" /><Skeleton className="h-16 w-full mt-4" /></CardContent>
          <CardFooter><Skeleton className="h-8 w-24 ml-auto" /></CardFooter>
        </Card>
      </div>
    );
  }

  if (errorFetchingSubmissions) {
    return <ErrorDisplay message={errorFetchingSubmissions} details={errorDetails} title="Error Loading Posts" />;
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold font-headline">Daily Hacklab Posts</h1>
      </div>

      <div className="flex flex-col items-center gap-4 my-6">
         <div className="w-full sm:max-w-xs">
          <Dialog open={isDatePickerDialogOpen} onOpenChange={setIsDatePickerDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDateForDisplay && "text-muted-foreground"
                )}
                disabled={!isDateInitialized}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDateForDisplay ? format(selectedDateForDisplay, "PPP", { locale: enUS }) : <span>Loading date...</span>}
              </Button>
            </DialogTrigger>
            <DialogContent className="p-0">
              <DialogHeader>
                <DialogTitle className="sr-only">Select a date</DialogTitle>
              </DialogHeader>
              {displayedMonthForPicker && isDateInitialized && (
                <CustomDatePicker
                    selectedDate={selectedDateForDisplay}
                    onDateSelect={handleDateSelect}
                    initialDisplayDate={displayedMonthForPicker}
                    disableFutureDatesAfter={startOfDay(new Date())}
                    onCloseDialog={() => setIsDatePickerDialogOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>

          <div className="flex justify-between w-full gap-2 mt-2 sm:max-w-xs">
            <Button
                onClick={handlePreviousDay}
                variant="outline"
                className="flex-1"
                aria-label="Previous day"
                disabled={!selectedDateForDisplay || !isDateInitialized}
            >
                <ChevronLeft className="mr-1 h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Prev Day</span>
                <span className="sm:hidden">Prev</span>
            </Button>
            <Button
                onClick={handleNextDay}
                variant="outline"
                className="flex-1"
                aria-label="Next day"
                disabled={!selectedDateForDisplay || !isDateInitialized || isToday(selectedDateForDisplay || new Date())}
            >
                <span className="hidden sm:inline">Next Day</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight className="ml-1 h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>

        {currentUser && (
          <div className="flex justify-center w-full sm:max-w-xs mx-auto">
            <Link href="/submit" passHref className="w-full">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full">
                <UploadCloud className="mr-2 h-5 w-5" /> Publish Clip
              </Button>
            </Link>
          </div>
        )}
      </div>

      {selectedDateForDisplay && isDateInitialized && (
        <div className="text-center mb-4">
            <p className="text-muted-foreground text-lg">
                Viewing posts for {format(selectedDateForDisplay, "PPP", { locale: enUS })}
            </p>
        </div>
      )}

      {!isLoadingSubmissions && submissionsForSelectedDate.length === 0 && isDateInitialized && (
        <Card className="w-full text-center shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline">No Activities for {selectedDateForDisplay ? format(selectedDateForDisplay, "PPP", { locale: enUS }): "this date"}</CardTitle>
          </CardHeader>
          <CardContent className="py-10">
            <Info className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">
              No approved clips found for this day.
            </p>
            <p className="text-sm text-muted-foreground mt-2">Try selecting another date or publish something new!</p>
          </CardContent>
        </Card>
      )}

      {!isLoadingSubmissions && submissionsForSelectedDate.map((submission) => (
        <Card key={submission.id} className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-3">
              <UserAvatar
                avatarUrl={submission.user_avatar_url}
                userId={submission.user_id}
                userName={submission.user_name}
                size={40}
              />
              <div>
                <CardTitle className="text-xl font-headline">{submission.user_name}</CardTitle>
                <div className="flex items-center text-xs text-muted-foreground">
                  <CalendarDays className="mr-1 h-3 w-3" />
                   {format(parseISO(submission.submission_date), "PPPp", { locale: enUS })}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ImageGallery photoUrls={submission.photo_urls || []} altPrefix={`Clip by ${submission.user_name}`} />
            {submission.summary && (
              <p className="text-foreground/90 leading-relaxed mt-4 bg-secondary/30 p-3 rounded-md whitespace-pre-wrap">{submission.summary}</p>
            )}
          </CardContent>
          <CardFooter className="bg-secondary/30 p-4 flex justify-end items-center">
            <div className="flex items-center space-x-3">
              <AppreciationStar
                submissionId={submission.id}
                currentStars={submission.stars_received || 0}
                isStarredByCurrentUser={(currentUser?.starredSubmissions || []).includes(submission.id)}
                onStarClick={() => handleStarClick(submission.id, submission.user_id)}
              />
              {isAdmin && (
                 <AlertDialog open={submissionToDelete?.id === submission.id} onOpenChange={(open) => { if(!open) setSubmissionToDelete(null);}}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" onClick={() => setSubmissionToDelete(submission)}>
                      <Trash2 className="mr-0 sm:mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeaderComponent>
                        <AlertDialogTitleComponent>Confirm Deletion</AlertDialogTitleComponent>
                        <AlertDialogDescription>
                          Are you sure you want to delete this submission by "{submissionToDelete?.user_name}" ({submissionToDelete && format(parseISO(submissionToDelete.submission_date), "PPP", { locale: enUS })})? This action is irreversible.
                        </AlertDialogDescription>
                      </AlertDialogHeaderComponent>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSubmissionToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
                          Yes, Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
