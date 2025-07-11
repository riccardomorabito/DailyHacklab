import ProtectedRoute from '@/components/protected-route';
import SpecialEventsManager from '@/components/special-events-manager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles } from 'lucide-react';

/**
 * AdminSpecialEventsPage component - Page for managing special events
 * Allows administrators to create, edit, and view special events that offer bonus points
 * Requires admin authentication to access
 * @returns JSX element representing the special events management page
 */
export default function AdminSpecialEventsPage() {
  return (
    <ProtectedRoute adminOnly={true}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Card className="w-full shadow-xl overflow-hidden">
          <CardHeader className="text-center p-6 bg-gradient-to-br from-primary/10 via-background to-background">
            <Sparkles className="mx-auto h-12 w-12 text-primary mb-3" />
            <CardTitle className="text-3xl font-bold tracking-tight sm:text-4xl font-headline">
              Special Events Management
            </CardTitle>
            <CardDescription className="mt-2 text-lg text-muted-foreground max-w-xl mx-auto">
              Create and view events that offer bonus points to incentivize participation.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <SpecialEventsManager />
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
