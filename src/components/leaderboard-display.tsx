"use client";

import type { User as UserType } from '@/types'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Star, Frown } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getLeaderboardUsers } from '@/actions/leaderboard';
import { logger } from '@/lib/logger';
import ErrorDisplay from './error-display';
import { Skeleton } from '@/components/ui/skeleton';
import DynamicBoringAvatar from '@/components/dynamic-boring-avatar';
import { useAvatarLoader } from '@/hooks/use-avatar-loader';
import GlobalLoading from '@/components/global-loading';

const LEADERBOARD_DISPLAY_CONTEXT = "LeaderboardDisplay";

/**
 * Extended User interface with rank display information
 */
interface UserWithRank extends UserType {
  rankDisplay: number;
}

/**
 * Props interface for PodiumItem component
 */
interface PodiumItemProps {
  user: UserWithRank;
  rank: number; 
  iconColor: string;
  avatarSizeClass: string;
  textSizeClass: string;
  podiumHeightClass: string;
  trophySizeClass: string;
}

/**
 * PodiumItem component - Individual podium position display
 * Renders a single user's position on the leaderboard podium with trophy and styling
 * Features intelligent avatar loading with error handling and fallback to generated avatars
 *
 * Avatar loading strategy:
 * 1. If user has valid avatarUrl: Attempt to load the actual image
 * 2. If image loads successfully: Display the user's avatar
 * 3. If image fails to load or no avatarUrl: Show DynamicBoringAvatar as fallback
 * 4. Always provide DynamicBoringAvatar as AvatarFallback for reliability
 * 5. Handle CORS errors gracefully with automatic fallback
 *
 * @param props - PodiumItemProps containing user data and styling configurations
 * @param props.user - User data with rank information
 * @param props.rank - Numeric rank position (1, 2, 3)
 * @param props.iconColor - Color class for trophy icon
 * @param props.avatarSizeClass - CSS class for avatar sizing
 * @param props.textSizeClass - CSS class for text sizing
 * @param props.podiumHeightClass - CSS class for podium height
 * @param props.trophySizeClass - CSS class for trophy sizing
 * @returns JSX element representing a podium position with reliable avatar display
 */
const PodiumItem: React.FC<PodiumItemProps> = ({ user, rank, iconColor, avatarSizeClass, textSizeClass, podiumHeightClass, trophySizeClass }) => {
  const avatarLoader = useAvatarLoader({
    avatarUrl: user.avatarUrl,
    userId: user.id,
    userName: user.name,
    maxRetries: 1,
    enableDebugLogging: true
  });
  
  // Convert CSS classes to actual color values for SVG fill
  const getFillColor = (colorClass: string): string => {
    switch (colorClass) {
      case 'text-yellow-400':
        return '#facc15'; // yellow-400
      case 'text-gray-400':
        return '#9ca3af'; // gray-400
      case 'text-yellow-600':
        return '#ca8a04'; // yellow-600
      default:
        return 'currentColor';
    }
  };
  
  let trophyTopClass = "-top-10 md:-top-12";
  if (rank === 1) trophyTopClass = "-top-14 md:-top-16";
  else if (rank === 2 || user.rankDisplay === 2) trophyTopClass = "-top-12 md:-top-14";

  return (
    <div className={cn("flex flex-col items-center justify-end text-center p-4 rounded-lg shadow-xl bg-card border relative", podiumHeightClass)}>
      <div className={cn("absolute", trophyTopClass)}>
        <Trophy className={cn(trophySizeClass, iconColor)} fill={getFillColor(iconColor)} strokeWidth={1.5} />
      </div>
      <Avatar className={cn("mb-3 ring-4 ring-offset-2 ring-offset-card", avatarSizeClass, rank === 1 || user.rankDisplay === 1 ? "ring-yellow-400" : rank === 2 || user.rankDisplay === 2 ? "ring-gray-400" : "ring-yellow-600")}>
        {avatarLoader.shouldShowImage ? (
          <AvatarImage
            src={user.avatarUrl!}
            alt={`${user.name || "User"} avatar`}
            onError={avatarLoader.handleImageError}
            onLoad={avatarLoader.handleImageLoad}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <AvatarFallback className="text-2xl">
          <DynamicBoringAvatar
            size={parseInt(avatarSizeClass.match(/w-(\d+)/)?.[1] || '24') * 4}
            name={user.name || user.email || user.id}
            variant="beam"
            colors={['#F0A884', '#F0C0A4', '#F0D8C4', '#F0E8E4', '#F0F0F0']}
          />
        </AvatarFallback>
      </Avatar>
      <p className={cn("font-bold w-full", textSizeClass)}>{user.name}</p>
      <p className={cn("text-accent font-semibold flex items-center justify-center mb-1", textSizeClass === "text-lg md:text-xl" ? "text-base" : "text-sm")}>
        <Star className="mr-1 h-4 w-4" /> {user.score}
      </p>
      <div className={cn("absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-background", rank === 1 || user.rankDisplay === 1 ? "bg-yellow-400" : rank === 2 || user.rankDisplay === 2 ? "bg-gray-400" : "bg-yellow-600")}>
        {user.rankDisplay}
      </div>
    </div>
  );
};

/**
 * LeaderboardDisplay component - Main leaderboard interface
 * Displays user rankings with podium-style layout for top 3 users
 * Features user avatars, scores, and comprehensive ranking system
 * Handles loading states and error conditions gracefully
 *
 * Avatar handling features:
 * - Robust image loading with error handling
 * - Automatic fallback to generated avatars on load failure
 * - Consistent display across podium and list views
 * - Debug logging for troubleshooting avatar issues
 *
 * @returns JSX element representing the leaderboard display with reliable avatar rendering
 */
export default function LeaderboardDisplay() {
  const [allUsersWithRank, setAllUsersWithRank] = useState<UserWithRank[]>([]);
  const [podiumUsers, setPodiumUsers] = useState<UserWithRank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorFetching, setErrorFetching] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | undefined>(undefined);
  const [totalUsersInLeaderboard, setTotalUsersInLeaderboard] = useState(0);
/**
 * Individual list item component for better avatar state management
 * Each user gets its own avatar loader instance for isolated error handling
 */
const LeaderboardListItem: React.FC<{ user: UserWithRank; isPodiumUser: boolean }> = ({ user, isPodiumUser }) => {
  const avatarLoader = useAvatarLoader({
    avatarUrl: user.avatarUrl,
    userId: user.id,
    userName: user.name,
    maxRetries: 1,
    enableDebugLogging: false
  });

  return (
    <li
      className={cn(
        "flex items-center justify-between p-3 md:p-4 rounded-lg shadow-md hover:bg-secondary/30 transition-colors bg-card border",
        isPodiumUser && "ring-2 ring-primary/50 border-primary/50" 
      )}
    >
      <div className="flex items-center space-x-3 md:space-x-4">
        <span className="text-base md:text-lg font-bold w-6 md:w-8 text-center text-muted-foreground">{user.rankDisplay}</span>
        <Avatar className="w-10 h-10 md:w-12 md:h-12">
          {avatarLoader.shouldShowImage ? (
            <AvatarImage
              src={user.avatarUrl!}
              alt={`${user.name || "User"} avatar`}
              onError={avatarLoader.handleImageError}
              onLoad={avatarLoader.handleImageLoad}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <AvatarFallback>
            <DynamicBoringAvatar
              size={40}
              name={user.name || user.email || user.id}
              variant="beam"
              colors={['#F0A884', '#F0C0A4', '#F0D8C4', '#F0E8E4', '#F0F0F0']}
            />
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-base md:text-lg truncate max-w-[120px] sm:max-w-[150px] md:max-w-xs">{user.name}</span>
      </div>
      <div className="flex items-center text-base md:text-lg font-semibold text-accent">
        <Star className="mr-1 h-4 w-4 md:h-5 md:w-5" />
        {user.score || 0}
      </div>
    </li>
  );
};

  /**
   * Processes users data and assigns rank display numbers
   * @param usersFromSource - Array of users from the data source
   */
  const processUsers = useCallback((usersFromSource: UserType[]) => {
    logger.info(LEADERBOARD_DISPLAY_CONTEXT, `processUsers: Processing ${usersFromSource.length} users.`);
    if (usersFromSource.length > 0) {
        usersFromSource.forEach(user => {
            logger.debug(LEADERBOARD_DISPLAY_CONTEXT, `processUsers - User: ${user.name}, Avatar URL: ${user.avatarUrl}, Score: ${user.score}`);
        });
    }
    setTotalUsersInLeaderboard(usersFromSource.length);

    let rankDisplay = 0;
    let lastScore = Infinity;
    
    const usersWithCalculatedRank = usersFromSource.map((user, index): UserWithRank => {
      if ((user.score || 0) < lastScore) { 
        rankDisplay = index + 1; 
        lastScore = user.score || 0;
      }
      return { ...user, rankDisplay };
    });
    
    setAllUsersWithRank(usersWithCalculatedRank);
    setPodiumUsers(usersWithCalculatedRank.slice(0, 3));
    logger.info(LEADERBOARD_DISPLAY_CONTEXT, "processUsers: Users processed and states updated.");
  }, []);

  useEffect(() => {
    const fetchAndProcessUsers = async () => {
      logger.info(LEADERBOARD_DISPLAY_CONTEXT, "useEffect: Starting user retrieval for leaderboard.");
      setIsLoading(true);
      setErrorFetching(null);
      setErrorDetails(undefined);
      const { data, error } = await getLeaderboardUsers();
      
      if (error) {
        logger.error(LEADERBOARD_DISPLAY_CONTEXT, "useEffect: Error during user retrieval:", error);
        setErrorFetching("Unable to load the leaderboard.");
        setAllUsersWithRank([]);
        setPodiumUsers([]);
        setTotalUsersInLeaderboard(0);
      } else if (data) {
        logger.info(LEADERBOARD_DISPLAY_CONTEXT, `useEffect: Successfully retrieved ${data.length} users.`);
        processUsers(data);
      } else {
        logger.warn(LEADERBOARD_DISPLAY_CONTEXT, "useEffect: Data undefined and no error, treating as empty.");
        processUsers([]);
      }
      setIsLoading(false);
      logger.info(LEADERBOARD_DISPLAY_CONTEXT, "useEffect: Retrieval and processing completed.");
    };
    fetchAndProcessUsers();
  }, [processUsers]); // processUsers is memoized, so this runs at mount. router.refresh() will force a re-render that causes a new fetch if the page is current.

  if (isLoading) {
    return <GlobalLoading message="Loading champions..." />;
  }

  if (errorFetching) {
    return <ErrorDisplay message={errorFetching} details={errorDetails} title="Error Loading Leaderboard" />;
  }
  
  const hasPodiumUsers = podiumUsers.length > 0;

  return (
    <div className="py-8 px-2">
      <Card className="w-full mx-auto shadow-xl overflow-hidden">
        <CardHeader className="text-center pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
          <Trophy className="mx-auto h-12 w-12 text-primary mb-2" />
          <CardTitle className="text-3xl md:text-4xl font-headline">Contributions Leaderboard</CardTitle>
           <CardDescription className="mt-1 text-muted-foreground">
            Discover the most active members and their scores!
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-10 pb-8 px-4 md:px-6">
          {hasPodiumUsers && (
            <div className="mb-12 relative pt-12 md:pt-16"> 
              <div className="grid grid-cols-3 items-end gap-2 sm:gap-4 md:gap-6 max-w-xl mx-auto">
                {podiumUsers[1] ? ( 
                  <PodiumItem
                    user={podiumUsers[1]}
                    rank={2} 
                    iconColor="text-gray-400" 
                    avatarSizeClass="w-20 h-20 md:w-28 md:h-28"
                    textSizeClass="text-sm md:text-base"
                    podiumHeightClass="min-h-[12rem] md:min-h-[14rem]"
                    trophySizeClass="h-10 w-10 md:h-12 md:w-12"
                  />
                ) : <div className="min-h-[12rem] md:min-h-[14rem]"></div>}
                {podiumUsers[0] ? ( 
                  <PodiumItem
                    user={podiumUsers[0]}
                    rank={1} 
                    iconColor="text-yellow-400" 
                    avatarSizeClass="w-24 h-24 md:w-32 md:h-32"
                    textSizeClass="text-base md:text-lg"
                    podiumHeightClass="min-h-[13rem] md:min-h-[15rem]" 
                    trophySizeClass="h-12 w-12 md:h-16 md:w-16"
                  />
                ) : <div className="min-h-[13rem] md:min-h-[15rem]"></div>}
                {podiumUsers[2] ? ( 
                  <PodiumItem
                    user={podiumUsers[2]}
                    rank={3} 
                    iconColor="text-yellow-600" 
                    avatarSizeClass="w-16 h-16 md:w-24 md:h-24"
                    textSizeClass="text-xs md:text-sm"
                    podiumHeightClass="min-h-[11rem] md:min-h-[13rem]" 
                    trophySizeClass="h-8 w-8 md:h-10 md:w-10"
                  />
                ) : <div className="min-h-[11rem] md:min-h-[13rem]"></div>}
              </div>
            </div>
          )}
          
          {totalUsersInLeaderboard === 0 && !isLoading && !errorFetching && (
             <div className="text-center py-10">
              <Frown className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="text-2xl font-headline text-muted-foreground">
                The Leaderboard is Empty
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                No users on the leaderboard for now. <br/> Be the first to contribute and climb the rankings!
              </p>
            </div>
          )}

          {totalUsersInLeaderboard > 0 && (
            <div>
              <h3 className="text-xl md:text-2xl font-semibold text-center mb-6 mt-8 pt-6 border-t">
                All Rankings
              </h3>
              {allUsersWithRank.length > 0 ? (
                <ul className="space-y-3">
                  {allUsersWithRank.map((user) => (
                    <LeaderboardListItem
                      key={user.id}
                      user={user}
                      isPodiumUser={!!podiumUsers.find(pUser => pUser.id === user.id)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-center text-muted-foreground py-4">No users to display in the list.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
