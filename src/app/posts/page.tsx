import ProtectedRoute from '@/components/protected-route';
import PostsDisplay from '@/components/posts-display';

/**
 * PostsPage component - Daily posts archive page
 * Displays posts and activities from previous days
 * Requires user authentication to access
 * @returns JSX element representing the posts/archive page
 */
export default function PostsPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow">
        <PostsDisplay />
      </div>
    </ProtectedRoute>
  );
}
