import ProtectedRoute from '@/components/protected-route';
import ServerFarmVisualization from '@/components/server-farm-visualization';

/**
 * ServerFarmPage component - Virtual datacenter visualization page
 * Displays user's virtual server farm that grows with their contributions
 * Requires user authentication to access
 * @returns JSX element representing the server farm page
 */
export default function ServerFarmPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow">
        <ServerFarmVisualization />
      </div>
    </ProtectedRoute>
  );
}
