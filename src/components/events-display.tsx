"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Sparkles, RefreshCw, AlertTriangle, CalendarDays, CalendarCheck, CalendarX } from 'lucide-react';
import { getAllEventsForPublic } from '@/actions/events';
import { useAuth } from '@/hooks/use-auth';
import type { SpecialEvent } from '@/types';
import { logger } from '@/lib/logger';
import { formatDate } from '@/lib/utils';
import { isAfter, isBefore, parseISO, startOfDay, formatISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorDisplay from './error-display';

const EVENTS_DISPLAY_CONTEXT = "EventsDisplay";

type EventFilter = 'all' | 'upcoming' | 'current' | 'past';

export default function EventsDisplay() {
  const [events, setEvents] = useState<SpecialEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<EventFilter>('all');
  const { currentUser } = useAuth();

  const fetchEvents = useCallback(async (filter: EventFilter) => {
    setIsLoading(true);
    setError(null);
    logger.debug(EVENTS_DISPLAY_CONTEXT, `Fetching events with filter: ${filter}`);

    try {
      const { data, error: fetchError } = await getAllEventsForPublic(filter);
      
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
      setError("An unexpected error occurred while loading events.");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(activeFilter);
  }, [activeFilter, fetchEvents]);

  const handleFilterChange = (filter: EventFilter) => {
    setActiveFilter(filter);
  };

  const getEventStatus = (event: SpecialEvent) => {
    const timeZone = 'Europe/Rome';
    const now = new Date();
    const zonedNow = toZonedTime(now, timeZone);

    // Check if the event is currently active
    const eventDate = parseISO(event.event_date);
    const eventDay = startOfDay(eventDate);
    const today = startOfDay(zonedNow);
    let isCurrent = false;

    if (eventDay.getTime() === today.getTime()) {
      if (!event.start_time || !event.end_time) {
        isCurrent = true; // Active all day if no specific times
      } else {
        const startTimeStr = `${formatISO(eventDate, { representation: 'date' })}T${event.start_time}:00`;
        const endTimeStr = `${formatISO(eventDate, { representation: 'date' })}T${event.end_time}:00`;
        const eventStartTime = toZonedTime(parseISO(startTimeStr), timeZone);
        const eventEndTime = toZonedTime(parseISO(endTimeStr), timeZone);
        if (isAfter(zonedNow, eventStartTime) && isBefore(zonedNow, eventEndTime)) {
          isCurrent = true;
        }
      }
    }

    if (isCurrent) {
      return { label: 'In Progress', color: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' };
    }

    // Determine if upcoming or past
    const eventStartWithTime = event.start_time
      ? toZonedTime(parseISO(`${formatISO(eventDate, { representation: 'date' })}T${event.start_time}:00`), timeZone)
      : toZonedTime(eventDay, timeZone);

    if (isAfter(eventStartWithTime, zonedNow)) {
      return { label: 'Upcoming', color: 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100' };
    }

    return { label: 'Past', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100' };
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


  return (
    <Tabs value={activeFilter} onValueChange={(value) => handleFilterChange(value as EventFilter)} className="w-full">
      <div className="flex justify-center mb-8">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 max-w-2xl gap-1 p-1 h-auto">
          <TabsTrigger value="all" className="text-sm sm:text-base px-4 py-3 h-auto">
            <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 mr-2"/>
            <span className="hidden sm:inline">All</span>
            <span className="sm:hidden">All</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="text-sm sm:text-base px-4 py-3 h-auto">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mr-2"/>
            <span className="hidden sm:inline">Upcoming</span>
            <span className="sm:hidden">Soon</span>
          </TabsTrigger>
          <TabsTrigger value="current" className="text-sm sm:text-base px-4 py-3 h-auto">
            <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 mr-2"/>
            <span className="hidden sm:inline">In Progress</span>
            <span className="sm:hidden">Active</span>
          </TabsTrigger>
          <TabsTrigger value="past" className="text-sm sm:text-base px-4 py-3 h-auto">
            <CalendarX className="w-4 h-4 sm:w-5 sm:h-5 mr-2"/>
            <span className="hidden sm:inline">Past</span>
            <span className="sm:hidden">Past</span>
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value={activeFilter} className="mt-8">
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
                        {formatDate(event.event_date, "PPP")}
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
                        Recurring until {formatDate(event.recurring_end_date, "PPP")}
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
  );
}