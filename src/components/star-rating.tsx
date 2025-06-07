"use client";

import type { FC } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

/**
 * Props for the AppreciationStar component.
 */
interface AppreciationStarProps {
  submissionId: string;
  currentStars: number;
  isStarredByCurrentUser: boolean;
  onStarClick: (submissionId: string) => void; // Callback when star is clicked
  className?: string;
}

/**
 * AppreciationStar component.
 * Displays a star icon that users can click to give or remove appreciation (star)
 * for a submission. Shows the current number of stars.
 * Interaction is disabled if the user is not logged in or is the author of the submission.
 * @param {AppreciationStarProps} props - The component props.
 * @returns {JSX.Element} The star rating display and interaction button.
 */
const AppreciationStar: FC<AppreciationStarProps> = ({
  submissionId,
  currentStars,
  isStarredByCurrentUser,
  onStarClick,
  className,
}) => {
  const { currentUser } = useAuth(); // Get current user to check login status

  /**
   * Handles the star click event.
   * Calls the onStarClick callback if the user is logged in.
   */
  const handleStar = () => {
    if (!currentUser) return; // Do nothing if user is not logged in
    onStarClick(submissionId);
  };

  // Button is interactable only if the user is logged in.
  // The logic to prevent starring one's own submission is handled in the parent (RoundupDisplay)
  // before calling onStarClick.
  const canInteract = !!currentUser; 
  
  // Determine ARIA label and title based on interaction state
  let starLabel = "Log in to give an appreciation";
  if (currentUser) {
    starLabel = isStarredByCurrentUser 
      ? "Remove appreciation" 
      : "Give an appreciation";
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleStar}
        disabled={!canInteract}
        className={cn(
          "p-1.5 h-auto rounded-full", // Style for the button
          !canInteract && "cursor-not-allowed opacity-50", // Style for disabled state
          canInteract && "hover:bg-accent/50" // Hover effect if interactable
        )}
        aria-label={starLabel}
        title={starLabel}
      >
        <Star
          className={cn(
            "h-6 w-6 transition-colors", // Base star style
            isStarredByCurrentUser
              ? 'text-yellow-400 fill-yellow-400' // Style for starred state
              : 'text-muted-foreground', // Style for unstarred state
            canInteract && !isStarredByCurrentUser && 'hover:text-yellow-500', // Hover effect if unstarred and interactable
            canInteract && isStarredByCurrentUser && 'hover:text-yellow-600' // Hover effect if starred and interactable
          )}
        />
      </Button>
      <span className="text-sm font-medium text-muted-foreground tabular-nums">
        {currentStars} {currentStars === 1 ? 'star' : 'stars'} {/* Display star count */}
      </span>
    </div>
  );
};

export default AppreciationStar;
