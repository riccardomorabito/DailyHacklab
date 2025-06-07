import ProtectedRoute from '@/components/protected-route';
import AdminDashboard from '@/components/admin-dashboard';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Settings, Sparkles, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * AdminPage component - Main admin dashboard page
 * Provides navigation to different admin sections and displays the admin dashboard
 * Requires admin authentication to access
 * @returns JSX element representing the admin control panel
 */
export default function AdminPage() {
  return (
    <ProtectedRoute adminOnly={true}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow space-y-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl font-headline">
            Admin Control Panel
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
            Manage content, events, users, and application settings.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Link href="/admin/events" passHref>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center text-xl font-headline">
                  <Sparkles className="mr-3 h-6 w-6 text-primary" />
                  Special Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Create and manage events that offer bonus points.</CardDescription>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/user-management" passHref>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center text-xl font-headline">
                  <Users className="mr-3 h-6 w-6 text-primary" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Add, modify, or remove user accounts.</CardDescription>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/app-settings" passHref>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center text-xl font-headline">
                  <Settings className="mr-3 h-6 w-6 text-primary" />
                  Application Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Configure global options like registration.</CardDescription>
              </CardContent>
            </Card>
          </Link>
        </div>
        
        <AdminDashboard />
      </div>
    </ProtectedRoute>
  );
}
