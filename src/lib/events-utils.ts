import { createClient } from '@/lib/supabase/client';
import type { SpecialEvent } from '@/types';
import { logger } from '@/lib/logger';
import { startOfDay, isPast, isToday, parseISO, addDays, isBefore, isAfter, formatISO } from 'date-fns';

/** Context identifier for logging events-related operations */
const EVENTS_UTILS_CONTEXT = "EventsUtils";

/**
 * Timeout wrapper utility function that prevents infinite loading states
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 30000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]);
};

/**
 * Checks if an event is currently active based on its date and current time in a specific timezone
 * @param event - The special event to check
 * @param userTimezone - The user's timezone (e.g., 'America/New_York', 'Europe/London')
 * @returns Promise<boolean> indicating if the event is currently active
 */
export async function isEventCurrentlyActiveInUserTimezone(event: SpecialEvent, userTimezone: string): Promise<boolean> {
  logger.debug(EVENTS_UTILS_CONTEXT, `Checking if event is active in timezone ${userTimezone}:`, event);
  
  // Get current time in user's timezone
  const now = new Date();
  const userTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
  
  // Get event date
  const eventDate = parseISO(event.event_date);
  const eventDateInUserTimezone = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimezone }));
  const eventDay = startOfDay(eventDateInUserTimezone);
  const todayInUserTimezone = startOfDay(userTime);
  
  // For non-recurring events, check if today matches the event date
  if (!event.is_recurring) {
    return todayInUserTimezone.getTime() === eventDay.getTime();
  }
  
  // For recurring events
  if (!event.recurring_interval_days) {
    return false;
  }
  
  // Check if we're before the event start date
  if (todayInUserTimezone < eventDay) {
    return false;
  }
  
  // Check if we're after the recurring end date (if specified)
  if (event.recurring_end_date) {
    const recurringEndDate = parseISO(event.recurring_end_date);
    const recurringEndDateInUserTimezone = new Date(recurringEndDate.toLocaleString("en-US", { timeZone: userTimezone }));
    const recurringEndDay = startOfDay(recurringEndDateInUserTimezone);
    if (todayInUserTimezone > recurringEndDay) {
      return false;
    }
  }
  
  // Calculate days since the event started
  const daysSinceStart = Math.floor((todayInUserTimezone.getTime() - eventDay.getTime()) / (1000 * 60 * 60 * 24));
  
  // Check if today falls on a recurring interval
  return daysSinceStart >= 0 && daysSinceStart % event.recurring_interval_days === 0;
}

/**
 * Get all events for public display with filtering based on status and user timezone
 * @param filter - The filter to apply ('all', 'upcoming', 'current', 'past')
 * @param userTimezone - The user's timezone for accurate filtering
 * @returns Promise with data array or error message
 */
export async function getAllEventsForPublicWithTimezone(
  filter: 'all' | 'upcoming' | 'current' | 'past' = 'all',
  userTimezone: string
): Promise<{ data: SpecialEvent[] | null; error: string | null }> {
  logger.info(EVENTS_UTILS_CONTEXT, `Fetching events for public with filter: ${filter}, timezone: ${userTimezone}`);
  
  try {
    const supabase = createClient();
    
    // Fetch all events first
    const { data: events, error } = await supabase
      .from('special_events')
      .select('*')
      .order('event_date', { ascending: false });

    if (error) {
      logger.error(EVENTS_UTILS_CONTEXT, "Database error fetching events:", error);
      return { data: null, error: "Unable to load events from database." };
    }

    if (!events) {
      logger.info(EVENTS_UTILS_CONTEXT, "No events found in database");
      return { data: [], error: null };
    }

    // Filter events based on their status in user timezone
    const filteredEvents: SpecialEvent[] = [];
    
    for (const event of events) {
      const isCurrentlyActive = await isEventCurrentlyActiveInUserTimezone(event, userTimezone);
      const eventDate = parseISO(event.event_date);
      const now = new Date();
      const userTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
      const todayInUserTimezone = startOfDay(userTime);
      const eventDateInUserTimezone = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimezone }));
      const eventDayInUserTimezone = startOfDay(eventDateInUserTimezone);
      
      const isPastEvent = eventDayInUserTimezone < todayInUserTimezone && !event.is_recurring;
      const isUpcomingEvent = eventDayInUserTimezone > todayInUserTimezone;
      
      switch (filter) {
        case 'current':
          if (isCurrentlyActive) {
            filteredEvents.push(event);
          }
          break;
        case 'upcoming':
          if (isUpcomingEvent && !isCurrentlyActive) {
            filteredEvents.push(event);
          }
          break;
        case 'past':
          if (isPastEvent) {
            filteredEvents.push(event);
          }
          break;
        case 'all':
        default:
          filteredEvents.push(event);
          break;
      }
    }

    logger.info(EVENTS_UTILS_CONTEXT, `Filtered ${filteredEvents.length} events out of ${events.length} total (filter: ${filter})`);
    return { data: filteredEvents, error: null };

  } catch (err) {
    logger.error(EVENTS_UTILS_CONTEXT, "Unexpected error in getAllEventsForPublicWithTimezone:", err);
    return { data: null, error: "An unexpected error occurred while loading events." };
  }
}

/**
 * Get active event notifications for user timezone
 * @param userTimezone - The user's timezone for checking active events
 * @returns Promise with active events data or error
 */
export async function getActiveEventNotificationsForUserTimezone(
  userTimezone: string
): Promise<{ data: SpecialEvent[] | null; error: string | null }> {
  logger.info(EVENTS_UTILS_CONTEXT, `Fetching active event notifications for timezone: ${userTimezone}`);
  
  try {
    const supabase = createClient();
    
    // Get all events that have notifications enabled
    const { data: allEvents, error } = await supabase
      .from('special_events')
      .select('*')
      .eq('show_notification', true)
      .order('event_date', { ascending: true });

    if (error) {
      logger.error(EVENTS_UTILS_CONTEXT, "Database error fetching events for notifications:", error);
      return { data: null, error: "Unable to load event notifications from database." };
    }

    if (!allEvents || allEvents.length === 0) {
      logger.info(EVENTS_UTILS_CONTEXT, "No events with notifications found");
      return { data: [], error: null };
    }

    // Filter for currently active events in user timezone
    const activeEvents: SpecialEvent[] = [];
    
    for (const event of allEvents) {
      const isActive = await isEventCurrentlyActiveInUserTimezone(event, userTimezone);
      if (isActive) {
        activeEvents.push(event);
      }
    }

    logger.info(EVENTS_UTILS_CONTEXT, `Found ${activeEvents.length} active events with notifications for timezone ${userTimezone}`);
    return { data: activeEvents, error: null };

  } catch (err) {
    logger.error(EVENTS_UTILS_CONTEXT, "Unexpected error in getActiveEventNotificationsForUserTimezone:", err);
    return { data: null, error: "An unexpected error occurred while loading active event notifications." };
  }
}
