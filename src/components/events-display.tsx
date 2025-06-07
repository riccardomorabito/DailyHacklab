"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Sparkles, RefreshCw, AlertTriangle, CalendarDays, CalendarCheck, CalendarX } from 'lucide-react';
import { getAllEventsForPublic } from '@/actions/events';
import { getAllEventsForPublicWithTimezone } from '@/lib/events-utils';
import { useAuth } from '@/hooks/use-auth';
import type { SpecialEvent } from '@/types';
import { parseISO, startOfDay, isPast, isToday, isAfter } from 'date-fns';
import { logger } from '@/lib/logger';
import { formatDateInUserTimezone, getUserTimezone } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorDisplay from './error-display';

const EVENTS_DISPLAY_CONTEXT = "EventsDisplay";

/**
 * Event filter types for displaying different categories of events
 */
type EventFilter = 'all' | 'upcoming' | 'current' | 'past';

/**
 * EventsDisplay component - Main interface for viewing special events
 * Displays events categorized by status (all, upcoming, current, past)
 * Features tabbed navigation, event details, and admin-specific information
 * Handles loading states and error conditions gracefully
 * @returns JSX element representing the events display interface
 */
export default function EventsDisplay() {
  const [events, setEvents] = useState<SpecialEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<EventFilter>('all');
  const { currentUser, isAdmin } = useAuth();

  /**
   * Fetches events based on the selected filter using user's timezone
   * @param filter - The event filter type to apply
   */
  const fetchEvents = async (filter: EventFilter = 'all') => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get user's timezone from browser
      const userTimezone = getUserTimezone();
      logger.debug(EVENTS_DISPLAY_CONTEXT, `Fetching events with filter: ${filter}, timezone: ${userTimezone}`);
      
      const { data, error: fetchError } = await getAllEventsForPublicWithTimezone(filter, userTimezone);
      
      if (fetchError) {
        logger.error(EVENTS_DISPLAY_CONTEXT, `Error fetching events (${filter}):`, fetchError);
        setError(fetchError);
        setEvents([]);
      } else if (data) {
        logger.info(EVENTS_DISPLAY_CONTEXT, `Fetched ${data.length} events (${filter})`);
        setEvents(data);
      }
    } catch (err) {
      logger.error(EVENTS_DISPLAY_CONTEXT, "Unexpected error fetching events:", err);
      setError("Unexpected error while loading events.");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(activeFilter);
  }, [activeFilter]);

  /**
   * Handles filter change and updates the active filter state
   * @param filter - The new filter to apply
   */
  const handleFilterChange = (filter: EventFilter) => {
    setActiveFilter(filter);
  };

  /**
   * Determines the status and display properties of an event
   * @param event - The special event to analyze
   * @returns Object containing status, label, and color information
   */
  const getEventStatus = (event: SpecialEvent) => {
    const eventDate = startOfDay(parseISO(event.event_date));
    const today = startOfDay(new Date());

    if (event.is_recurring) {
      // For recurring events, check if they're active today
      if (isEventActiveToday(event, today)) {
        return { status: 'current', label: 'In Progress', color: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' };
      } else if (isAfter(eventDate, today)) {
        return { status: 'upcoming', label: 'Upcoming', color: 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100' };
      } else {
        return { status: 'recurring', label: 'Recurring', color: 'bg-purple-100 text-purple-800 dark:bg-purple-700 dark:text-purple-100' };
      }
    } else {
      if (isToday(eventDate)) {
        return { status: 'current', label: 'Today', color: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' };
      } else if (isAfter(eventDate, today)) {
        return { status: 'upcoming', label: 'Upcoming', color: 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100' };
      } else {
        return { status: 'past', label: 'Past', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100' };
      }
    }
  };

  /**
   * Checks if a recurring event is active on a given date
   * @param event - The recurring event to check
   * @param today - The date to check against
   * @returns Boolean indicating if the event is active
   */
  const isEventActiveToday = (event: SpecialEvent, today: Date): boolean => {
    if (!event.is_recurring || !event.recurring_interval_days) {
      return false;
    }

    const eventStartDate = startOfDay(parseISO(event.event_date));
    const recurringEndDate = event.recurring_end_date ? startOfDay(parseISO(event.recurring_end_date)) : null;

    if (today < eventStartDate) return false;
    if (recurringEndDate && today > recurringEndDate) return false;

    const daysDifference = Math.floor((today.getTime() - eventStartDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDifference % event.recurring_interval_days === 0;
  };

  /**
   * Converts interval days to human-readable recurrence description
   * @param intervalDays - Number of days between recurrences
   * @returns Human-readable description of the recurrence pattern
   */
  const getRecurrenceDescription = (intervalDays: number) => {
    switch (intervalDays) {
      case 1: return "daily";
      case 7: return "weekly";
      case 14: return "every 2 weeks";
      case 30: return "monthly";
      case 90: return "every 3 months";
      case 365: return "yearly";
      default: return `every ${intervalDays} days`;
    }
  };

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">You must be logged in to view events.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl font-headline">
          Special Events
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Discover all past, current and future community events
        </p>
      </div>

      <Tabs value={activeFilter} onValueChange={(value) => handleFilterChange(value as EventFilter)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            All
          </TabsTrigger>
          <TabsTrigger value="current" className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            Current
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="past" className="flex items-center gap-2">
            <CalendarX className="h-4 w-4" />
            Past
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeFilter} className="mt-6">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <ErrorDisplay 
              message={error} 
              title="Error Loading Events"
              showReturnHomeButton={false}
            />
          )}

          {!isLoading && !error && events.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <CalendarX className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No events found</h3>
                <p className="text-muted-foreground">
                  {activeFilter === 'current' && "No active events at the moment."}
                  {activeFilter === 'upcoming' && "No events scheduled for the future."}
                  {activeFilter === 'past' && "No past events to show."}
                  {activeFilter === 'all' && "No events have been created yet."}
                </p>
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && events.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => {
                const eventStatus = getEventStatus(event);
                
                return (
                  <Card key={event.id} className="h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-xl font-headline">{event.name}</CardTitle>
                        <Badge className={eventStatus.color}>
                          {eventStatus.label}
                        </Badge>
                      </div>
                      <CardDescription className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4" />
                          {formatDateInUserTimezone(event.event_date, "PPP")}
                        </div>
                        {(event.start_time || event.end_time) && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4" />
                            {event.start_time && event.end_time 
                              ? `${event.start_time} - ${event.end_time}`
                              : event.start_time 
                                ? `from ${event.start_time}`
                                : `until ${event.end_time}`
                            }
                          </div>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {event.description && (
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-yellow-500" />
                          <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                            +{event.bonus_points} points
                          </span>
                        </div>
                        
                        {event.is_recurring && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <RefreshCw className="h-3 w-3" />
                            {getRecurrenceDescription(event.recurring_interval_days || 7)}
                          </div>
                        )}
                      </div>

                      {event.show_notification && (
                        <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
                          <AlertTriangle className="h-3 w-3" />
                          Active notifications
                        </div>
                      )}

                      {event.recurring_end_date && (
                        <div className="text-xs text-muted-foreground">
                          Recurring until {formatDateInUserTimezone(event.recurring_end_date, "PPP")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}