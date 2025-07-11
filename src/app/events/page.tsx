import ProtectedRoute from '@/components/protected-route';
import EventsDisplay from '@/components/events-display';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles } from 'lucide-react';

/**
 * EventsPage component - Protected page displaying special events
 * Shows all past, current, and future special events to authenticated users
 * @returns JSX element representing the events page
 */
export default function EventsPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Card className="w-full shadow-xl overflow-hidden">
          <CardHeader className="text-center p-6 bg-gradient-to-br from-primary/10 via-background to-background">
            <Sparkles className="mx-auto h-12 w-12 text-primary mb-3" />
            <CardTitle className="text-3xl font-bold tracking-tight sm:text-4xl font-headline">
              Special Events
            </CardTitle>
            <CardDescription className="mt-2 text-lg text-muted-foreground max-w-xl mx-auto">
              Discover all past, current and future community events.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <EventsDisplay />
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}