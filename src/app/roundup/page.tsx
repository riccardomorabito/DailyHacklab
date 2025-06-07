import ProtectedRoute from '@/components/protected-route';
import RoundupDisplay from '@/components/roundup-display';

/**
 * RoundupPage component - Daily activity archive page
 * Displays submissions and activities from previous days
 * Requires user authentication to access
 * @returns JSX element representing the roundup/archive page
 */
export default function RoundupPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow">
        <RoundupDisplay />
      </div>
    </ProtectedRoute>
  );
}
