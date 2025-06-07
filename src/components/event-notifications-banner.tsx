"use client";

import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, Calendar, Clock, Sparkles } from 'lucide-react';
import { getActiveEventNotifications } from '@/actions/events';
import { getActiveEventNotificationsForUserTimezone } from '@/lib/events-utils';
import { useNotifications } from '@/hooks/use-notifications';
import { useAuth } from '@/hooks/use-auth';
import type { SpecialEvent } from '@/types';
import { formatDateInUserTimezone, getUserTimezone } from '@/lib/utils';
import { logger } from '@/lib/logger';

const EVENT_NOTIFICATIONS_CONTEXT = "EventNotificationsBanner";

/**
 * EventNotificationsBanner component - Displays active special event notifications
 * Shows banner alerts for ongoing special events with bonus points information
 * Handles browser notifications, event dismissal, and automatic cleanup
 * Polls for new events every 5 minutes and manages notification permissions
 * @returns JSX element representing the event notifications banner or null if no events
 */
export default function EventNotificationsBanner() {
  const [activeEvents, setActiveEvents] = useState<SpecialEvent[]>([]);
  const [dismissedEvents, setDismissedEvents] = useState<Set<string>>(new Set());
  const [notifiedEvents, setNotifiedEvents] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { showEventNotification, permission, requestPermission } = useNotifications();
  const { currentUser } = useAuth();

  // Load notified events from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('notifiedEvents');
        if (stored) {
          const parsedEvents = JSON.parse(stored);
          setNotifiedEvents(new Set(parsedEvents));
          logger.info(EVENT_NOTIFICATIONS_CONTEXT, `Loaded ${parsedEvents.length} previously notified events from localStorage`);
        }
      } catch (error) {
        logger.warn(EVENT_NOTIFICATIONS_CONTEXT, "Error loading notified events from localStorage:", error);
      }
    }
  }, []);

  // Save notified events to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && notifiedEvents.size > 0) {
      try {
        localStorage.setItem('notifiedEvents', JSON.stringify([...notifiedEvents]));
      } catch (error) {
        logger.warn(EVENT_NOTIFICATIONS_CONTEXT, "Error saving notified events to localStorage:", error);
      }
    }
  }, [notifiedEvents]);

  // Check for active events using user's timezone
  useEffect(() => {
    const checkActiveEvents = async () => {
      try {
        // Get user's timezone from browser
        const userTimezone = getUserTimezone();
        logger.debug(EVENT_NOTIFICATIONS_CONTEXT, `Using user timezone: ${userTimezone}`);
        
        const { data: events, error } = await getActiveEventNotificationsForUserTimezone(userTimezone);
        
        if (error) {
          logger.error(EVENT_NOTIFICATIONS_CONTEXT, "Error fetching active events:", error);
          setIsLoading(false);
          return;
        }

        if (events && events.length > 0) {
          logger.info(EVENT_NOTIFICATIONS_CONTEXT, `Found ${events.length} active events in timezone ${userTimezone}`);
          setActiveEvents(events);
          
          // Show browser notifications for new events (only if user is logged in)
          if (currentUser && permission === 'granted') {
            events.forEach(event => {
              // Only send notification if not already notified and not dismissed
              if (!notifiedEvents.has(event.id) && !dismissedEvents.has(event.id)) {
                logger.info(EVENT_NOTIFICATIONS_CONTEXT, `Sending notification for event: ${event.name}`);
                showEventNotification(event.name, event.notification_message);
                // Mark as notified
                setNotifiedEvents(prev => new Set([...prev, event.id]));
              }
            });
          }

          // Clean up notified events that are no longer active
          const activeEventIds = new Set(events.map(e => e.id));
          setNotifiedEvents(prev => {
            const filtered = new Set([...prev].filter(id => activeEventIds.has(id)));
            if (filtered.size !== prev.size) {
              logger.info(EVENT_NOTIFICATIONS_CONTEXT, `Cleaned up ${prev.size - filtered.size} old notified events`);
            }
            return filtered;
          });
        } else {
          setActiveEvents([]);
          // Clear notified events when no active events
          if (notifiedEvents.size > 0) {
            setNotifiedEvents(new Set());
            logger.info(EVENT_NOTIFICATIONS_CONTEXT, "Cleared all notified events (no active events)");
          }
        }
      } catch (error) {
        logger.error(EVENT_NOTIFICATIONS_CONTEXT, "Unexpected error checking active events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkActiveEvents();
    
    // Check every 5 minutes for new events
    const interval = setInterval(checkActiveEvents, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [currentUser, permission, showEventNotification]); // Removed dismissedEvents and notifiedEvents from dependencies

  // Request notification permission when user logs in
  useEffect(() => {
    if (currentUser && permission === 'default') {
      // Wait a bit before asking for permission to not be too intrusive
      const timer = setTimeout(() => {
        requestPermission();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [currentUser, permission, requestPermission]);

  const dismissEvent = (eventId: string) => {
    setDismissedEvents(prev => new Set([...prev, eventId]));
    // Also remove from notified events so it can be notified again if it becomes active again
    setNotifiedEvents(prev => {
      const newSet = new Set(prev);
      newSet.delete(eventId);
      return newSet;
    });
  };

  const visibleEvents = activeEvents.filter(event => !dismissedEvents.has(event.id));

  if (isLoading || visibleEvents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleEvents.map((event) => (
        <Alert key={event.id} className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
          <Sparkles className="h-4 w-4 text-orange-600" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-orange-600" />
                <span className="font-semibold text-orange-800 dark:text-orange-200">
                  Special Event in Progress!
                </span>
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-300">
                <div className="font-medium">{event.name}</div>
                {event.notification_message && (
                  <div className="mt-1">{event.notification_message}</div>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateInUserTimezone(event.event_date, "PPP")}
                  </span>
                  {(event.start_time || event.end_time) && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.start_time && event.end_time 
                        ? `${event.start_time} - ${event.end_time}`
                        : event.start_time 
                          ? `from ${event.start_time}`
                          : `until ${event.end_time}`
                      }
                    </span>
                  )}
                  <span className="font-medium">
                    +{event.bonus_points} bonus points
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissEvent(event.id)}
              className="text-orange-600 hover:text-orange-800 hover:bg-orange-100 dark:text-orange-400 dark:hover:text-orange-200 dark:hover:bg-orange-900/30"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}