import ProtectedRoute from '@/components/protected-route';
import AdminAppSettings from '@/components/admin-app-settings';
import { Settings } from 'lucide-react';

/**
 * AdminApplicationSettingsPage component - Page for managing global application settings
 * Allows administrators to configure system-wide options like registration settings
 * Requires admin authentication to access
 * @returns JSX element representing the application settings page
 */
export default function AdminApplicationSettingsPage() {
  return (
    <ProtectedRoute adminOnly={true}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow">
        <div className="text-center mb-10">
          <Settings className="mx-auto h-12 w-12 text-primary mb-3" />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl font-headline">
            Application Settings
          </h1>
          <p className="mt-2 text-lg text-muted-foreground max-w-xl mx-auto">
            Manage global configurations for Daily Hacklab.
          </p>
        </div>
        <AdminAppSettings />
      </div>
    </ProtectedRoute>
  );
}
