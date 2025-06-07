import ContentSubmissionForm from '@/components/content-submission-form';
import ProtectedRoute from '@/components/protected-route';

/**
 * SubmitPage component - Content submission page
 * Allows authenticated users to submit their daily projects and activities
 * Requires user authentication to access
 * @returns JSX element representing the content submission page
 */
export default function SubmitPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow flex flex-col items-center justify-center">
        <ContentSubmissionForm />
      </div>
    </ProtectedRoute>
  );
}
