import ErrorDisplay from '@/components/error-display';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Page Not Found - Daily Hacklab",
};

/**
 * NotFoundPage component - 404 error page
 * Displays when a user navigates to a non-existent route
 * Shows user-friendly error message with option to return home
 * @returns JSX element representing the 404 not found page
 */
export default function NotFoundPage() {
  return (
    <ErrorDisplay
      title="Oops! Page Not Found"
      message="The page you are looking for does not exist or has been moved."
      details="HTTP 404 Error."
      showReturnHomeButton={true}
    />
  );
}
