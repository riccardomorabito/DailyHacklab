import ProtectedRoute from '@/components/protected-route';
import AdminAppSettings from '@/components/admin-app-settings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Card className="w-full shadow-xl overflow-hidden">
          <CardHeader className="text-center p-6 bg-gradient-to-br from-primary/10 via-background to-background">
            <Settings className="mx-auto h-12 w-12 text-primary mb-3" />
            <CardTitle className="text-3xl font-bold tracking-tight sm:text-4xl font-headline">
              Application Settings
            </CardTitle>
            <CardDescription className="mt-2 text-lg text-muted-foreground max-w-xl mx-auto">
              Manage global configurations for Daily Hacklab.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <AdminAppSettings />
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
