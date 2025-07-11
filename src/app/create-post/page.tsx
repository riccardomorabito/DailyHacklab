import ContentCreationForm from '@/components/content-creation-form';
import ProtectedRoute from '@/components/protected-route';

/**
 * CreatePostPage component - Content submission page
 * Allows authenticated users to submit their daily projects and activities
 * Requires user authentication to access
 * @returns JSX element representing the content submission page
 */
export default function CreatePostPage() {
  return (
    <ProtectedRoute>
      <ContentCreationForm />
    </ProtectedRoute>
  );
}
