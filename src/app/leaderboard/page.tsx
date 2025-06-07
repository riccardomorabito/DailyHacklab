import LeaderboardDisplay from '@/components/leaderboard-display';

/**
 * LeaderboardPage component - Public page displaying user rankings
 * Shows all users ranked by their scores and contributions
 * @returns JSX element representing the leaderboard page
 */
export default function LeaderboardPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow">
      <LeaderboardDisplay />
    </div>
  );
}
