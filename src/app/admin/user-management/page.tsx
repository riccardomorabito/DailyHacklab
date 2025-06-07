import ProtectedRoute from '@/components/protected-route';
import UserManagementDashboard from '@/components/user-management-dashboard';
import { Users } from 'lucide-react';

/**
 * AdminUserManagementPage component - Page for managing user accounts
 * Allows administrators to add, view, edit, and delete user accounts
 * Requires admin authentication to access
 * @returns JSX element representing the user management page
 */
export default function AdminUserManagementPage() {
  return (
    <ProtectedRoute adminOnly={true}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow">
        <div className="text-center mb-10">
          <Users className="mx-auto h-12 w-12 text-primary mb-3" />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl font-headline">
            User Management
          </h1>
          <p className="mt-2 text-lg text-muted-foreground max-w-xl mx-auto">
            Add, view, edit, and delete user accounts.
          </p>
        </div>
        <UserManagementDashboard />
      </div>
    </ProtectedRoute>
  );
}
