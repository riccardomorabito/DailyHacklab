"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import type { Post } from '@/types';
import { getApprovedPostsByDate, toggleStarPost, deletePostByAdmin, deleteOwnPost } from '@/actions/posts-management';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import GlobalLoading from '@/components/global-loading';

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
 * ImageGallery component - Displays a scrollable gallery of post images
 * @param photoUrls - Array of photo URLs to display
 * @param altPrefix - Prefix for alt text of images
 * @returns JSX element representing the image gallery
 */
const ImageGallery: React.FC<{ photoUrls: string[], altPrefix: string }> = ({ photoUrls, altPrefix }) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [lightboxSlides, setLightboxSlides] = useState<any[]>([]);
  const [areSlidesReady, setAreSlidesReady] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (photoUrls.length === 0) return;

    let isMounted = true;

    const imageSizes = [16, 32, 48, 64, 96, 128, 256, 384];
    const deviceSizes = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];

    const nextImageUrl = (src: string, size: number) => `/_next/image?url=${encodeURIComponent(src)}&w=${size}&q=75`;

    const prepareSlides = async () => {
      if (!isMounted) return;
      setAreSlidesReady(false);

      const getDimensions = (url: string): Promise<{ url: string; width: number; height: number; }> =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ url, width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve({ url, width: 1920, height: 1080 }); // Fallback
          img.src = url;
        });

      const photosWithDimensions = await Promise.all(photoUrls.map(getDimensions));

      if (!isMounted) return;

      const finalSlides = photosWithDimensions.map(({ url, width, height }) => ({
        width,
        height,
        src: nextImageUrl(url, width),
        srcSet: imageSizes
          .concat(...deviceSizes)
          .filter((size) => size <= width)
          .map((size) => ({
            src: nextImageUrl(url, size),
            width: size,
            height: Math.round((height / width) * size),
          })),
      }));

      setLightboxSlides(finalSlides);
      setAreSlidesReady(true);
    };

    prepareSlides();

    return () => { isMounted = false; };
  }, [photoUrls]);

  const openLightbox = (index: number) => {
    if (areSlidesReady) {
      setLightboxIndex(index);
      setIsLightboxOpen(true);
    } else {
      toast({ title: "Loading Images...", description: "Please wait a moment for the high-quality images to load." });
    }
  };

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

  const handleNextImage = useCallback(() => scrollToImage((currentIndex + 1) % photoUrls.length), [currentIndex, photoUrls.length, scrollToImage]);
  const handlePrevImage = useCallback(() => scrollToImage((currentIndex - 1 + photoUrls.length) % photoUrls.length), [currentIndex, photoUrls.length, scrollToImage]);

  if (!photoUrls || photoUrls.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-muted/30 rounded-md text-muted-foreground">
        <ImageIcon className="w-8 h-8 mr-2" />
        <span>No photos provided</span>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 relative">
        <div className="overflow-hidden rounded-lg border">
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-thin scrollbar-thumb-primary/40 scrollbar-track-transparent"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {photoUrls.map((url, index) => (
              <div key={index} className="snap-center flex-shrink-0 w-full aspect-video relative">
                <button type="button" className="w-full h-full" onClick={() => openLightbox(index)}>
                  {!areSlidesReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                  <NextImage
                    src={url}
                    alt={`${altPrefix} - Photo ${index + 1} of ${photoUrls.length}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    style={{ objectFit: "cover" }}
                    className="object-cover"
                    data-ai-hint="post image gallery"
                    priority={index === 0}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
        {photoUrls.length > 1 && (
          <>
            <Button variant="ghost" size="icon" onClick={handlePrevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-9 w-9 z-10" aria-label="Previous image">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-9 w-9 z-10" aria-label="Next image">
              <ChevronRight className="h-5 w-5" />
            </Button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10">
              {photoUrls.map((_, index) => (
                <button key={index} onClick={() => scrollToImage(index)} className={cn("h-2 w-2 rounded-full transition-all", currentIndex === index ? "bg-white w-4" : "bg-white/50 hover:bg-white/75")} aria-label={`Go to photo ${index + 1}`} />
              ))}
            </div>
          </>
        )}
      </div>
      {areSlidesReady && (
        <Lightbox
          open={isLightboxOpen}
          close={() => setIsLightboxOpen(false)}
          slides={lightboxSlides}
          index={lightboxIndex}
          plugins={[Zoom]}
          zoom={{ maxZoomPixelRatio: 4 }}
        />
      )}
    </>
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
  const [postsForSelectedDate, setPostsForSelectedDate] = useState<Post[]>([]);
  const [isDatePickerDialogOpen, setIsDatePickerDialogOpen] = useState(false);

  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [errorFetchingPosts, setErrorFetchingPosts] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { currentUser, isAdmin, updateCurrentUserData } = useAuth();
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);

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
   * Fetches posts for the selected date
   * Handles loading states and error conditions
   */
  const fetchPosts = useCallback(async () => {
    if (!selectedDateForDisplay || !isDateInitialized) {
      logger.debug(POSTS_DISPLAY_CONTEXT, "fetchPosts: Skipped due to uninitialized date or selectedDateForDisplay is null.");
      if (isDateInitialized && !selectedDateForDisplay) {
        setPostsForSelectedDate([]);
        setIsLoadingPosts(false);
      }
      return;
    }
    logger.info(POSTS_DISPLAY_CONTEXT, "fetchPosts: Starting posts retrieval for date:", selectedDateForDisplay.toISOString());
    setIsLoadingPosts(true);
    setErrorFetchingPosts(null);
    setErrorDetails(undefined);

    const { data, error } = await getApprovedPostsByDate(selectedDateForDisplay);

    if (error) {
      logger.error(POSTS_DISPLAY_CONTEXT, "fetchPosts: Error during posts retrieval:", error);
      setErrorFetchingPosts("Unable to load posts for this date.");
      setErrorDetails(typeof error === 'object' ? JSON.stringify(error) : error);
      setPostsForSelectedDate([]);
    } else if (data) {
      const sortedData = data.sort((a, b) =>
        (b.stars_received || 0) - (a.stars_received || 0) ||
        new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime()
      );
      setPostsForSelectedDate(sortedData);
      logger.info(POSTS_DISPLAY_CONTEXT, `fetchPosts: Retrieved ${data.length} posts for ${selectedDateForDisplay.toISOString()}.`);
    } else {
      setPostsForSelectedDate([]);
    }
    setIsLoadingPosts(false);
  }, [selectedDateForDisplay, isDateInitialized]);

  useEffect(() => {
    if (isDateInitialized) {
      fetchPosts();
    }
  }, [fetchPosts, isDateInitialized]);

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
   * Handles star/unstar clicks on posts
   * Manages optimistic updates and user feedback
   * @param postId - ID of the post to star/unstar
   * @param authorId - ID of the post author
   */
  const handleStarClick = useCallback(async (postId: string, authorId: string) => {
    logger.info(POSTS_DISPLAY_CONTEXT, `handleStarClick: Star/unstar attempt for post ID: ${postId}, author ID: ${authorId}. Current user: ${currentUser?.id}`);
    if (!currentUser) {
      toast({ title: "Login Required", description: "You must be logged in to give or remove appreciation.", variant: "destructive", duration: 3000});
      return;
    }
    if (currentUser.id === authorId) {
      toast({ title: "Action Not Allowed", description: "You cannot give appreciation to your own post.", variant: "default", duration: 3000});
      return;
    }

    const { success, error, newStarsCount, newAuthorScore, newStarredSubmissionsForCurrentUser, isStarred } = await toggleStarPost(postId);

    if (error || !success) {
      logger.error(POSTS_DISPLAY_CONTEXT, `handleStarClick: Error during toggleStarPost for ID ${postId}:`, error);
      toast({ title: "Appreciation Error", description: error || "Unable to update appreciation.", variant: "destructive" });
    } else {
      logger.info(POSTS_DISPLAY_CONTEXT, `handleStarClick: toggleStarPost success for ID ${postId}. New starred state: ${isStarred}, total stars: ${newStarsCount}, author score: ${newAuthorScore}`);
      toast({
        title: isStarred ? "Appreciation Sent!" : "Appreciation Removed",
        description: `Author score updated: ${newAuthorScore !== undefined ? newAuthorScore : 'N/A'}. Post stars: ${newStarsCount}.`,
        duration: 3000
      });
      
      // Update the user's starred submissions
      if (updateCurrentUserData && newStarredSubmissionsForCurrentUser) {
        await updateCurrentUserData({ starred_submissions: newStarredSubmissionsForCurrentUser });
      }
      
      // Update the post's star count in the local state
      setPostsForSelectedDate(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, stars_received: newStarsCount !== undefined ? newStarsCount : p.stars_received }
            : p
        ).sort((a, b) => (b.stars_received || 0) - (a.stars_received || 0) || new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime())
      );
    }
  }, [currentUser, postsForSelectedDate, toast, updateCurrentUserData]);

  /**
   * Handles confirmation and execution of post deletion (admin only)
   */
  const handleDeleteConfirm = async () => {
    if (!postToDelete) return;
    logger.info(POSTS_DISPLAY_CONTEXT, `handleDeleteConfirm: Deletion confirmation for post ID ${postToDelete.id}.`);

    const originalPosts = [...postsForSelectedDate];
    setPostsForSelectedDate(prev => prev.filter(p => p.id !== postToDelete.id));

    // Use appropriate delete function based on user role
    const { success, error: deleteError } = isAdmin
      ? await deletePostByAdmin(postToDelete.id)
      : await deleteOwnPost(postToDelete.id);

    if (success) {
      logger.info(POSTS_DISPLAY_CONTEXT, `handleDeleteConfirm: Post ID ${postToDelete.id} deleted successfully.`);
      toast({ title: "Post Deleted", description: "The post has been deleted." });
    } else {
      logger.error(POSTS_DISPLAY_CONTEXT, `handleDeleteConfirm: Error during deletion of post ID ${postToDelete.id}:`, deleteError);
      toast({ title: "Deletion Error", description: deleteError || "Unable to delete the post.", variant: "destructive" });
      setPostsForSelectedDate(originalPosts);
    }
    setPostToDelete(null);
  };

  useEffect(() => {
    if (isAdmin) {
      logger.info(POSTS_DISPLAY_CONTEXT, "User is admin. Delete button should be visible.");
    } else {
      logger.info(POSTS_DISPLAY_CONTEXT, "User is NOT admin. Delete button should NOT be visible.");
    }
  }, [isAdmin]);


  if (!isDateInitialized || (isLoadingPosts && postsForSelectedDate.length === 0 && !errorFetchingPosts)) {
    return <GlobalLoading message="Loading posts..." />;
  }

  if (errorFetchingPosts) {
    return <ErrorDisplay message={errorFetchingPosts} details={errorDetails} title="Error Loading Posts" />;
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
            <Link href="/create-post" passHref className="w-full">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full">
                <UploadCloud className="mr-2 h-5 w-5" /> New post
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

      {!isLoadingPosts && postsForSelectedDate.length === 0 && isDateInitialized && (
        <Card className="w-full max-w-3xl mx-auto shadow-xl overflow-hidden">
          <CardHeader className="text-center pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
            <Info className="mx-auto h-12 w-12 text-primary mb-2" />
            <CardTitle className="text-3xl md:text-4xl font-headline">No Activities</CardTitle>
            <CardDescription className="mt-1 text-muted-foreground">
              No approved posts found for {selectedDateForDisplay ? format(selectedDateForDisplay, "PPP", { locale: enUS }): "this date"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-10 pb-8 px-4 md:px-6 text-center">
            <p className="text-lg text-muted-foreground">
              Try selecting another date or be the first to share something!
            </p>
            <Link href="/create-post" passHref>
                <Button size="lg" className="mt-6">
                    <UploadCloud className="mr-2 h-5 w-5" /> Share an Update
                </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!isLoadingPosts && postsForSelectedDate.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {postsForSelectedDate.map((post) => (
            <Card key={post.id} className="shadow-xl overflow-hidden transition-shadow hover:shadow-2xl flex flex-col" data-ai-hint="post card">
              <CardHeader className="p-4 bg-gradient-to-br from-primary/5 via-background to-background border-b">
                <div className="flex items-center space-x-4">
                  <UserAvatar
                    avatarUrl={post.user_avatar_url}
                    userId={post.user_id}
                    userName={post.user_name}
                    size={40}
                  />
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold">{post.user_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(post.submission_date), 'PPP', { locale: enUS })}
                    </p>
                  </div>
                  {(isAdmin || (currentUser && currentUser.id === post.user_id)) && (
                    <AlertDialog open={postToDelete?.id === post.id} onOpenChange={(open) => { if(!open) setPostToDelete(null);}}>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setPostToDelete(post)}>
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeaderComponent>
                          <AlertDialogTitleComponent>Confirm Deletion</AlertDialogTitleComponent>
                          <AlertDialogDescription>
                            Are you sure you want to delete this post by "{postToDelete?.user_name}" ({postToDelete && format(parseISO(postToDelete.submission_date), "PPP", { locale: enUS })})? This action is irreversible.
                          </AlertDialogDescription>
                        </AlertDialogHeaderComponent>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setPostToDelete(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
                            Yes, Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-grow">
                <ImageGallery photoUrls={post.photo_urls || []} altPrefix={`Post by ${post.user_name}`} />
                {post.summary && (
                  <p className="text-muted-foreground mt-4 whitespace-pre-wrap">{post.summary}</p>
                )}
              </CardContent>
              <CardFooter className="p-4 bg-card border-t flex justify-between items-center">
                <AppreciationStar
                  postId={post.id}
                  currentStars={post.stars_received || 0}
                  isStarredByCurrentUser={(currentUser?.starred_submissions || []).includes(post.id)}
                  onStarClick={(postId) => handleStarClick(postId, post.user_id)}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
