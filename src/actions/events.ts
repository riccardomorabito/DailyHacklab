"use server";

import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server';
import type { SpecialEvent } from '@/types';
import { logger } from '@/lib/logger';
// import { revalidatePath } from 'next/cache';
import { startOfDay, isPast, isToday, parseISO, addDays, isBefore, isAfter, formatISO } from 'date-fns';

/** Context identifier for logging events-related operations */
const EVENTS_ACTIONS_CONTEXT = "EventsActions";

/**
 * Timeout wrapper utility function that prevents infinite loading states
 * @param promiseFunction - Function that returns a promise to wrap with timeout
 * @param timeoutMs - Timeout in milliseconds (default: 12000ms = 12 seconds)
 * @returns Promise that either resolves with the original result or rejects with timeout error
 */
function withTimeout<T>(promiseFunction: () => Promise<T>, timeoutMs: number = 12000): Promise<T> {
  return Promise.race([
    promiseFunction(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out after 12 seconds')), timeoutMs)
    )
  ]);
}

/**
 * Generates recurring event instances based on the parent event configuration
 * @param {SpecialEvent} parentEvent - The parent recurring event
 * @param {number} maxInstancesAhead - Maximum number of future instances to generate (default: 12)
 * @returns {any[]} Array of event data for recurring instances
 */
function generateRecurringInstances(parentEvent: SpecialEvent, maxInstancesAhead: number = 12): any[] {
  if (!parentEvent.is_recurring || !parentEvent.recurring_interval_days) {
    return [];
  }

  const instances: any[] = [];
  const startDate = parseISO(parentEvent.event_date);
  const endDate = parentEvent.recurring_end_date ? parseISO(parentEvent.recurring_end_date) : null;
  const intervalDays = parentEvent.recurring_interval_days;
  
  let currentDate = addDays(startDate, intervalDays);
  let instanceCount = 0;

  while (instanceCount < maxInstancesAhead) {
    // Stop if we've reached the end date
    if (endDate && isAfter(currentDate, endDate)) {
      break;
    }

    instances.push({
      name: parentEvent.name,
      description: parentEvent.description,
      event_date: currentDate.toISOString(),
      start_time: parentEvent.start_time,
      end_time: parentEvent.end_time,
      bonus_points: parentEvent.bonus_points,
      show_notification: parentEvent.show_notification,
      notification_message: parentEvent.notification_message,
      is_recurring: false, // Generated instances are not recurring themselves
      recurring_interval_days: null,
      recurring_end_date: null,
      parent_event_id: parentEvent.id,
    });

    currentDate = addDays(currentDate, intervalDays);
    instanceCount++;
  }

  return instances;
}

/**
 * Interface for event form data used in creation and updates
 */
interface EventFormDataCore {
  name: string;
  description?: string;
  event_date: Date;
  start_time?: string;
  end_time?: string;
  bonus_points: number;
  show_notification: boolean;
  notification_message?: string;
  is_recurring: boolean;
  recurring_interval_days?: number;
  recurring_end_date?: Date;
}

/**
 * Creates a new special event with optional recurring configuration.
 * Requires admin privileges and handles both single and recurring events.
 * @param {EventFormDataCore} eventData - The event data to create
 * @returns {Promise<{ data?: SpecialEvent; error?: string }>} Promise with created event data or error message
 */
export async function createSpecialEvent(eventData: EventFormDataCore): Promise<{ data?: SpecialEvent; error?: string }> {
  logger.info(EVENTS_ACTIONS_CONTEXT, "createSpecialEvent: Starting special event creation.", eventData);
  
  return withTimeout(async () => {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (e: any) {
      logger.error(EVENTS_ACTIONS_CONTEXT, "createSpecialEvent: Failed to create Supabase Admin Client:", e.message);
      return { error: `Server configuration error: ${e.message}. Contact support.` };
    }
    
    const supabaseServerClient = await createServerSupabaseClient();

    const { data: { user: authUser }, error: authError } = await supabaseServerClient.auth.getUser();
    if (authError || !authUser) {
      logger.warn(EVENTS_ACTIONS_CONTEXT, "createSpecialEvent: Authentication required.");
      return { error: 'Authentication required' };
    }
    logger.info(EVENTS_ACTIONS_CONTEXT, `createSpecialEvent: Authenticated admin ID: ${authUser.id}`);

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (adminProfileError || !adminProfile || adminProfile.role !== 'admin') {
      logger.warn(EVENTS_ACTIONS_CONTEXT, "createSpecialEvent: Administrator privileges required.");
      return { error: 'Administrator privileges required' };
    }

    const dataToInsert = {
      name: eventData.name,
      description: eventData.description,
      event_date: eventData.event_date.toISOString(),
      start_time: eventData.start_time || null,
      end_time: eventData.end_time || null,
      bonus_points: eventData.bonus_points,
      show_notification: eventData.show_notification,
      notification_message: eventData.notification_message || null,
      is_recurring: eventData.is_recurring,
      recurring_interval_days: eventData.is_recurring ? eventData.recurring_interval_days : null,
      recurring_end_date: eventData.is_recurring && eventData.recurring_end_date ? eventData.recurring_end_date.toISOString() : null,
      parent_event_id: null,
    };
    logger.debug(EVENTS_ACTIONS_CONTEXT, "createSpecialEvent: Data ready for insertion:", dataToInsert);

    const { data: newEvent, error: insertError } = await supabaseAdmin
      .from('special_events')
      .insert(dataToInsert)
      .select()
      .single();

    if (insertError) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'createSpecialEvent: Error creating special event:', insertError.message);
      return { error: `Failed to create event: ${insertError.message}` };
    }

    // Note: We no longer automatically generate recurring instances
    // Recurring events are displayed as single entries with recurrence information
    if (newEvent && eventData.is_recurring) {
      logger.info(EVENTS_ACTIONS_CONTEXT, `createSpecialEvent: Recurring event "${newEvent.name}" created. No instances generated automatically.`);
    }

    logger.info(EVENTS_ACTIONS_CONTEXT, `createSpecialEvent: Special event "${newEvent?.name}" (ID: ${newEvent?.id}) created successfully.`);
    // revalidatePath('/admin/events');
    return { data: newEvent as SpecialEvent };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(EVENTS_ACTIONS_CONTEXT, "createSpecialEvent: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(EVENTS_ACTIONS_CONTEXT, "createSpecialEvent: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Generates additional recurring event instances for existing recurring events.
 * This should be called periodically to ensure future events are always available.
 * @returns {Promise<{ success?: boolean; error?: string }>} Promise with success status or error message
 */
export async function generateRecurringEventInstances(): Promise<{ success?: boolean; error?: string }> {
  logger.info(EVENTS_ACTIONS_CONTEXT, "generateRecurringEventInstances: Starting recurring instances generation.");
  
  return withTimeout(async () => {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (e: any) {
      logger.error(EVENTS_ACTIONS_CONTEXT, "generateRecurringEventInstances: Failed to create Supabase Admin Client:", e.message);
      return { error: `Server configuration error: ${e.message}` };
    }

    const supabaseServerClient = await createServerSupabaseClient();
    const { data: { user: authUser }, error: authError } = await supabaseServerClient.auth.getUser();
    if (authError || !authUser) {
      logger.warn(EVENTS_ACTIONS_CONTEXT, "generateRecurringEventInstances: Authentication required.");
      return { error: 'Authentication required' };
    }

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (adminProfileError || !adminProfile || adminProfile.role !== 'admin') {
      logger.warn(EVENTS_ACTIONS_CONTEXT, "generateRecurringEventInstances: Administrator privileges required.");
      return { error: 'Administrator privileges required' };
    }

    // Get all recurring parent events
    const { data: recurringEvents, error: fetchError } = await supabaseAdmin
      .from('special_events')
      .select('*')
      .eq('is_recurring', true)
      .is('parent_event_id', null);

    if (fetchError) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'generateRecurringEventInstances: Error fetching recurring events:', fetchError.message);
      return { error: `Error fetching recurring events: ${fetchError.message}` };
    }

    if (!recurringEvents || recurringEvents.length === 0) {
      logger.info(EVENTS_ACTIONS_CONTEXT, "generateRecurringEventInstances: No recurring events found.");
      return { success: true };
    }

    let totalInstancesGenerated = 0;

    for (const parentEvent of recurringEvents) {
      // Check how many future instances already exist
      const { data: existingInstances, error: instancesError } = await supabaseAdmin
        .from('special_events')
        .select('event_date')
        .eq('parent_event_id', parentEvent.id)
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true });

      if (instancesError) {
        logger.warn(EVENTS_ACTIONS_CONTEXT, `generateRecurringEventInstances: Error checking existing instances for event ${parentEvent.id}:`, instancesError.message);
        continue;
      }

      const futureInstancesCount = existingInstances?.length || 0;
      const minFutureInstances = 6; // Always keep at least 6 future instances

      if (futureInstancesCount < minFutureInstances) {
        const instancesToGenerate = minFutureInstances - futureInstancesCount;
        logger.info(EVENTS_ACTIONS_CONTEXT, `generateRecurringEventInstances: Generating ${instancesToGenerate} additional instances for event "${parentEvent.name}"`);

        // Find the last existing instance date to continue from there
        const lastInstanceDate = existingInstances && existingInstances.length > 0
          ? parseISO(existingInstances[existingInstances.length - 1].event_date)
          : parseISO(parentEvent.event_date);

        const newInstances = generateRecurringInstances({
          ...parentEvent,
          event_date: lastInstanceDate.toISOString()
        } as SpecialEvent, instancesToGenerate);

        if (newInstances.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('special_events')
            .insert(newInstances);

          if (insertError) {
            logger.warn(EVENTS_ACTIONS_CONTEXT, `generateRecurringEventInstances: Error inserting new instances for event ${parentEvent.id}:`, insertError.message);
          } else {
            totalInstancesGenerated += newInstances.length;
            logger.info(EVENTS_ACTIONS_CONTEXT, `generateRecurringEventInstances: Generated ${newInstances.length} instances for event "${parentEvent.name}"`);
          }
        }
      }
    }

    // Clean up old instances (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error: cleanupError } = await supabaseAdmin
      .from('special_events')
      .delete()
      .not('parent_event_id', 'is', null)
      .lt('event_date', thirtyDaysAgo.toISOString());

    if (cleanupError) {
      logger.warn(EVENTS_ACTIONS_CONTEXT, 'generateRecurringEventInstances: Error cleaning up old events:', cleanupError.message);
    } else {
      logger.info(EVENTS_ACTIONS_CONTEXT, 'generateRecurringEventInstances: Old events cleanup completed.');
    }

    logger.info(EVENTS_ACTIONS_CONTEXT, `generateRecurringEventInstances: Completed. Generated ${totalInstancesGenerated} total new instances.`);
    // revalidatePath('/admin/events');
    return { success: true };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(EVENTS_ACTIONS_CONTEXT, "generateRecurringEventInstances: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(EVENTS_ACTIONS_CONTEXT, "generateRecurringEventInstances: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Retrieves all special events for authenticated users.
 * Only returns parent events (not recurring instances) to avoid duplicates.
 * @returns {Promise<{ data?: SpecialEvent[]; error?: string }>} Promise with events array or error message
 */
export async function getSpecialEvents(): Promise<{ data?: SpecialEvent[]; error?: string }> {
  logger.info(EVENTS_ACTIONS_CONTEXT, "getSpecialEvents: Starting special events retrieval.");
  
  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
        logger.warn(EVENTS_ACTIONS_CONTEXT, "getSpecialEvents: Authentication required to retrieve events (as per current policy).");
        return { error: 'Authentication required to view events.' };
    }
    logger.info(EVENTS_ACTIONS_CONTEXT, `getSpecialEvents: Authenticated user ID: ${authUser.id}`);

    // Only get parent events (non-recurring instances) to avoid showing duplicates
    // Recurring events will show as single entries with recurrence information
    const { data: events, error } = await supabase
      .from('special_events')
      .select('*')
      .is('parent_event_id', null) // Only get parent events, not recurring instances
      .order('event_date', { ascending: false });

    if (error) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'getSpecialEvents: Error retrieving special events:', error.message);
      return { error: `Failed to retrieve events: ${error.message}` };
    }

    logger.info(EVENTS_ACTIONS_CONTEXT, `getSpecialEvents: Successfully retrieved ${events.length} special events.`);
    return { data: events as SpecialEvent[] }; // isActive will be calculated on the client
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(EVENTS_ACTIONS_CONTEXT, "getSpecialEvents: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(EVENTS_ACTIONS_CONTEXT, "getSpecialEvents: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Gets active special event for a specific date
 * @param {Date} date - The date to check for special events
 * @returns {Promise<{ data?: SpecialEvent | null; error?: string }>} Promise with special event data or null
 */
export async function getActiveSpecialEventForDate(date: Date): Promise<{ data?: SpecialEvent | null; error?: string }> {
  logger.info(EVENTS_ACTIONS_CONTEXT, "getActiveSpecialEventForDate: Checking for special events on date:", date.toISOString());
  
  try {
    const supabaseAdmin = createAdminClient();
    
    // Format the date for comparison (YYYY-MM-DD)
    const dateString = formatISO(startOfDay(date), { representation: 'date' });
    const checkDate = startOfDay(date);
    
    // Get all events (both single and recurring parent events)
    const { data: events, error } = await supabaseAdmin
      .from('special_events')
      .select('*')
      .is('parent_event_id', null); // Only get parent events, not instances
    
    if (error) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'getActiveSpecialEventForDate: Error fetching special events:', error.message);
      return { error: `Error fetching special events: ${error.message}` };
    }
    
    if (!events || events.length === 0) {
      logger.info(EVENTS_ACTIONS_CONTEXT, "getActiveSpecialEventForDate: No events found.");
      return { data: null };
    }
    
    // Check for exact date match first (single events)
    const exactMatch = events.find(event => {
      const eventDate = formatISO(startOfDay(parseISO(event.event_date)), { representation: 'date' });
      return eventDate === dateString;
    });
    
    if (exactMatch) {
      logger.info(EVENTS_ACTIONS_CONTEXT, `getActiveSpecialEventForDate: Found exact match event "${exactMatch.name}" with ${exactMatch.bonus_points} bonus points.`);
      return { data: exactMatch as SpecialEvent };
    }
    
    // Check for recurring events that should be active on this date
    for (const event of events) {
      if (event.is_recurring && event.recurring_interval_days) {
        const eventStartDate = startOfDay(parseISO(event.event_date));
        const recurringEndDate = event.recurring_end_date ? startOfDay(parseISO(event.recurring_end_date)) : null;
        
        // Check if the date is after the event start date
        if (isBefore(checkDate, eventStartDate)) {
          continue;
        }
        
        // Check if the date is before the recurring end date (if set)
        if (recurringEndDate && isAfter(checkDate, recurringEndDate)) {
          continue;
        }
        
        // Calculate if this date falls on a recurring interval
        const daysDifference = Math.floor((checkDate.getTime() - eventStartDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDifference % event.recurring_interval_days === 0) {
          logger.info(EVENTS_ACTIONS_CONTEXT, `getActiveSpecialEventForDate: Found recurring event "${event.name}" active on this date with ${event.bonus_points} bonus points.`);
          return { data: event as SpecialEvent };
        }
      }
    }
    
    logger.info(EVENTS_ACTIONS_CONTEXT, "getActiveSpecialEventForDate: No active special events found for date.");
    return { data: null };
  } catch (e: any) {
    logger.error(EVENTS_ACTIONS_CONTEXT, "getActiveSpecialEventForDate: Unexpected error:", e.message);
    return { error: `Unexpected error: ${e.message}` };
  }
}

/**
 * Deletes a special event and all its recurring instances if it's a parent event
 * @param eventId - The ID of the event to delete
 * @returns Promise with success status or error message
 */
export async function deleteSpecialEvent(eventId: string): Promise<{ success?: boolean; error?: string }> {
  logger.info(EVENTS_ACTIONS_CONTEXT, `deleteSpecialEvent: Starting event deletion ID: ${eventId}`);
  
  return withTimeout(async () => {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (e: any) {
      logger.error(EVENTS_ACTIONS_CONTEXT, "deleteSpecialEvent: Failed to create Supabase Admin Client:", e.message);
      return { error: `Server configuration error: ${e.message}` };
    }

    const supabaseServerClient = await createServerSupabaseClient();
    const { data: { user: authUser }, error: authError } = await supabaseServerClient.auth.getUser();
    if (authError || !authUser) {
      logger.warn(EVENTS_ACTIONS_CONTEXT, "deleteSpecialEvent: Authentication required.");
      return { error: 'Authentication required' };
    }

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (adminProfileError || !adminProfile || adminProfile.role !== 'admin') {
      logger.warn(EVENTS_ACTIONS_CONTEXT, "deleteSpecialEvent: Administrator privileges required.");
      return { error: 'Administrator privileges required' };
    }

    // First, get the event to check if it's a recurring parent
    const { data: eventToDelete, error: fetchError } = await supabaseAdmin
      .from('special_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'deleteSpecialEvent: Error retrieving event to delete:', fetchError.message);
      return { error: `Event not found: ${fetchError.message}` };
    }

    // If it's a recurring parent event, delete all its instances first
    if (eventToDelete.is_recurring && !eventToDelete.parent_event_id) {
      logger.info(EVENTS_ACTIONS_CONTEXT, `deleteSpecialEvent: Deleting recurring instances for event "${eventToDelete.name}"`);
      
      const { error: instancesDeleteError } = await supabaseAdmin
        .from('special_events')
        .delete()
        .eq('parent_event_id', eventId);

      if (instancesDeleteError) {
        logger.warn(EVENTS_ACTIONS_CONTEXT, 'deleteSpecialEvent: Error deleting recurring instances:', instancesDeleteError.message);
        // Continue with parent deletion even if instances deletion fails
      } else {
        logger.info(EVENTS_ACTIONS_CONTEXT, 'deleteSpecialEvent: Recurring instances deleted successfully.');
      }
    }

    // Delete the main event
    const { error: deleteError } = await supabaseAdmin
      .from('special_events')
      .delete()
      .eq('id', eventId);

    if (deleteError) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'deleteSpecialEvent: Error deleting event:', deleteError.message);
      return { error: `Error deleting event: ${deleteError.message}` };
    }

    logger.info(EVENTS_ACTIONS_CONTEXT, `deleteSpecialEvent: Event "${eventToDelete.name}" (ID: ${eventId}) deleted successfully.`);
    // revalidatePath('/admin/events');
    return { success: true };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(EVENTS_ACTIONS_CONTEXT, "deleteSpecialEvent: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(EVENTS_ACTIONS_CONTEXT, "deleteSpecialEvent: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Updates an existing special event
 * @param eventId - The ID of the event to update
 * @param eventData - The updated event data
 * @returns Promise with updated event data or error message
 */
export async function updateSpecialEvent(eventId: string, eventData: EventFormDataCore): Promise<{ data?: SpecialEvent; error?: string }> {
  logger.info(EVENTS_ACTIONS_CONTEXT, `updateSpecialEvent: Starting event update ID: ${eventId}`, eventData);
  
  return withTimeout(async () => {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (e: any) {
      logger.error(EVENTS_ACTIONS_CONTEXT, "updateSpecialEvent: Failed to create Supabase Admin Client:", e.message);
      return { error: `Server configuration error: ${e.message}. Contact support.` };
    }
    
    const supabaseServerClient = await createServerSupabaseClient();

    const { data: { user: authUser }, error: authError } = await supabaseServerClient.auth.getUser();
    if (authError || !authUser) {
      logger.warn(EVENTS_ACTIONS_CONTEXT, "updateSpecialEvent: Authentication required.");
      return { error: 'Authentication required' };
    }
    logger.info(EVENTS_ACTIONS_CONTEXT, `updateSpecialEvent: Authenticated admin ID: ${authUser.id}`);

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (adminProfileError || !adminProfile || adminProfile.role !== 'admin') {
      logger.warn(EVENTS_ACTIONS_CONTEXT, "updateSpecialEvent: Administrator privileges required.");
      return { error: 'Administrator privileges required' };
    }

    // First, get the existing event to check if it's a recurring parent
    const { data: existingEvent, error: fetchError } = await supabaseAdmin
      .from('special_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'updateSpecialEvent: Error retrieving existing event:', fetchError.message);
      return { error: `Event not found: ${fetchError.message}` };
    }

    const dataToUpdate = {
      name: eventData.name,
      description: eventData.description,
      event_date: eventData.event_date.toISOString(),
      start_time: eventData.start_time || null,
      end_time: eventData.end_time || null,
      bonus_points: eventData.bonus_points,
      show_notification: eventData.show_notification,
      notification_message: eventData.notification_message || null,
      is_recurring: eventData.is_recurring,
      recurring_interval_days: eventData.is_recurring ? eventData.recurring_interval_days : null,
      recurring_end_date: eventData.is_recurring && eventData.recurring_end_date ? eventData.recurring_end_date.toISOString() : null,
    };
    logger.debug(EVENTS_ACTIONS_CONTEXT, "updateSpecialEvent: Data ready for update:", dataToUpdate);

    // If the event was recurring and is being changed to non-recurring, delete all instances
    if (existingEvent.is_recurring && !eventData.is_recurring && !existingEvent.parent_event_id) {
      logger.info(EVENTS_ACTIONS_CONTEXT, `updateSpecialEvent: Deleting recurring instances for event "${existingEvent.name}" (now non-recurring)`);
      
      const { error: instancesDeleteError } = await supabaseAdmin
        .from('special_events')
        .delete()
        .eq('parent_event_id', eventId);

      if (instancesDeleteError) {
        logger.warn(EVENTS_ACTIONS_CONTEXT, 'updateSpecialEvent: Error deleting recurring instances:', instancesDeleteError.message);
        // Continue with update even if instances deletion fails
      } else {
        logger.info(EVENTS_ACTIONS_CONTEXT, 'updateSpecialEvent: Recurring instances deleted successfully.');
      }
    }

    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('special_events')
      .update(dataToUpdate)
      .eq('id', eventId)
      .select()
      .single();

    if (updateError) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'updateSpecialEvent: Error updating special event:', updateError.message);
      return { error: `Failed to update event: ${updateError.message}` };
    }

    // If the event is now recurring and wasn't before, or if recurring parameters changed,
    // we might want to regenerate instances (this is optional and can be done manually)
    if (updatedEvent && eventData.is_recurring) {
      logger.info(EVENTS_ACTIONS_CONTEXT, `updateSpecialEvent: Recurring event "${updatedEvent.name}" updated. Instances can be regenerated manually if needed.`);
    }

    logger.info(EVENTS_ACTIONS_CONTEXT, `updateSpecialEvent: Special event "${updatedEvent?.name}" (ID: ${updatedEvent?.id}) updated successfully.`);
    // revalidatePath('/admin/events');
    return { data: updatedEvent as SpecialEvent };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(EVENTS_ACTIONS_CONTEXT, "updateSpecialEvent: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(EVENTS_ACTIONS_CONTEXT, "updateSpecialEvent: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Gets active special events that should show notifications on the website
 * @returns {Promise<{ data?: SpecialEvent[]; error?: string }>} Promise with array of events that should show notifications
 */
export async function getActiveEventNotifications(): Promise<{ data?: SpecialEvent[]; error?: string }> {
  logger.info(EVENTS_ACTIONS_CONTEXT, "getActiveEventNotifications: Checking for active event notifications.");
  
  try {
    const supabaseAdmin = createAdminClient();
    const now = new Date();
    
    // Get all events that have notifications enabled and are not instances
    const { data: events, error } = await supabaseAdmin
      .from('special_events')
      .select('*')
      .eq('show_notification', true)
      .is('parent_event_id', null); // Only get parent events, not instances
    
    if (error) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'getActiveEventNotifications: Error fetching events:', error.message);
      return { error: `Error fetching event notifications: ${error.message}` };
    }
    
    if (!events || events.length === 0) {
      return { data: [] };
    }
    
    const activeNotifications: SpecialEvent[] = [];
    
    for (const event of events) {
      // Use the new function that considers both date and time
      if (isEventCurrentlyActive(event as SpecialEvent, now)) {
        activeNotifications.push(event as SpecialEvent);
        logger.debug(EVENTS_ACTIONS_CONTEXT, `Event "${event.name}" is currently active (considering time constraints)`);
      } else {
        logger.debug(EVENTS_ACTIONS_CONTEXT, `Event "${event.name}" is not currently active (time constraints not met)`);
      }
    }
    
    logger.info(EVENTS_ACTIONS_CONTEXT, `getActiveEventNotifications: Found ${activeNotifications.length} active notifications.`);
    return { data: activeNotifications };
  } catch (e: any) {
    logger.error(EVENTS_ACTIONS_CONTEXT, "getActiveEventNotifications: Unexpected error:", e.message);
    return { error: `Unexpected error: ${e.message}` };
  }
}

/**
 * Gets active special events that should show notifications on the website (timezone-aware)
 * @param {string} userTimezone - The user's timezone from browser (e.g., 'America/New_York')
 * @returns {Promise<{ data?: SpecialEvent[]; error?: string }>} Promise with array of events that should show notifications
 */
export async function getActiveEventNotificationsForUserTimezone(userTimezone: string): Promise<{ data?: SpecialEvent[]; error?: string }> {
  logger.info(EVENTS_ACTIONS_CONTEXT, `getActiveEventNotificationsForUserTimezone: Checking for active event notifications in timezone: ${userTimezone}`);
  
  try {
    const supabaseAdmin = createAdminClient();
    const now = new Date();
    
    // Get all events that have notifications enabled and are not instances
    const { data: events, error } = await supabaseAdmin
      .from('special_events')
      .select('*')
      .eq('show_notification', true)
      .is('parent_event_id', null); // Only get parent events, not instances
    
    if (error) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'getActiveEventNotificationsForUserTimezone: Error fetching events:', error.message);
      return { error: `Error fetching event notifications: ${error.message}` };
    }
    
    if (!events || events.length === 0) {
      return { data: [] };
    }
    
    const activeNotifications: SpecialEvent[] = [];
    
    for (const event of events) {
      // Use the new timezone-aware function
      if (isEventCurrentlyActiveInUserTimezone(event as SpecialEvent, now, userTimezone)) {
        activeNotifications.push(event as SpecialEvent);
        logger.debug(EVENTS_ACTIONS_CONTEXT, `Event "${event.name}" is currently active in timezone ${userTimezone}`);
      } else {
        logger.debug(EVENTS_ACTIONS_CONTEXT, `Event "${event.name}" is not currently active in timezone ${userTimezone}`);
      }
    }
    
    logger.info(EVENTS_ACTIONS_CONTEXT, `getActiveEventNotificationsForUserTimezone: Found ${activeNotifications.length} active notifications for timezone ${userTimezone}.`);
    return { data: activeNotifications };
  } catch (e: any) {
    logger.error(EVENTS_ACTIONS_CONTEXT, "getActiveEventNotificationsForUserTimezone: Unexpected error:", e.message);
    return { error: `Unexpected error: ${e.message}` };
  }
}

/**
 * Gets all special events with filtering options for public viewing
 * @param filter - Filter type: 'all', 'upcoming', 'current', 'past'
 * @returns Promise with filtered events array
 */
export async function getAllEventsForPublic(filter: 'all' | 'upcoming' | 'current' | 'past' = 'all'): Promise<{ data?: SpecialEvent[]; error?: string }> {
  logger.info(EVENTS_ACTIONS_CONTEXT, `getAllEventsForPublic: Fetching events with filter: ${filter}`);
  
  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      logger.warn(EVENTS_ACTIONS_CONTEXT, "getAllEventsForPublic: Authentication required.");
      return { error: 'Authentication required to view events.' };
    }

    // Get all parent events (no recurring instances)
    const { data: events, error } = await supabase
      .from('special_events')
      .select('*')
      .is('parent_event_id', null)
      .order('event_date', { ascending: false });

    if (error) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'getAllEventsForPublic: Error fetching events:', error.message);
      return { error: `Error fetching events: ${error.message}` };
    }

    if (!events) {
      return { data: [] };
    }

    // Filter events based on the requested filter
    const today = startOfDay(new Date());
    let filteredEvents = events;

    switch (filter) {
      case 'upcoming':
        filteredEvents = events.filter(event => {
          const eventDate = startOfDay(parseISO(event.event_date));
          return isAfter(eventDate, today);
        });
        break;
      
      case 'current':
        filteredEvents = events.filter(event => {
          return isEventCurrentlyActive(event as SpecialEvent, new Date());
        });
        break;
      
      case 'past':
        filteredEvents = events.filter(event => {
          const eventDate = startOfDay(parseISO(event.event_date));
          return isBefore(eventDate, today) &&
                 (!event.is_recurring || !isEventActiveToday(event, today));
        });
        break;
      
      case 'all':
      default:
        // Return all events, already sorted by date descending
        break;
    }

    logger.info(EVENTS_ACTIONS_CONTEXT, `getAllEventsForPublic: Returning ${filteredEvents.length} events (filter: ${filter})`);
    return { data: filteredEvents as SpecialEvent[] };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(EVENTS_ACTIONS_CONTEXT, "getAllEventsForPublic: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(EVENTS_ACTIONS_CONTEXT, "getAllEventsForPublic: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Gets all special events with filtering options for public viewing (timezone-aware)
 * @param filter - Filter type: 'all', 'upcoming', 'current', 'past'
 * @param userTimezone - The user's timezone from browser
 * @returns Promise with filtered events array
 */
export async function getAllEventsForPublicWithTimezone(
  filter: 'all' | 'upcoming' | 'current' | 'past' = 'all',
  userTimezone: string
): Promise<{ data?: SpecialEvent[]; error?: string }> {
  logger.info(EVENTS_ACTIONS_CONTEXT, `getAllEventsForPublicWithTimezone: Fetching events with filter: ${filter} for timezone: ${userTimezone}`);
  
  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      logger.warn(EVENTS_ACTIONS_CONTEXT, "getAllEventsForPublicWithTimezone: Authentication required.");
      return { error: 'Authentication required to view events.' };
    }

    // Get all parent events (no recurring instances)
    const { data: events, error } = await supabase
      .from('special_events')
      .select('*')
      .is('parent_event_id', null)
      .order('event_date', { ascending: false });

    if (error) {
      logger.error(EVENTS_ACTIONS_CONTEXT, 'getAllEventsForPublicWithTimezone: Error fetching events:', error.message);
      return { error: `Error fetching events: ${error.message}` };
    }

    if (!events) {
      return { data: [] };
    }

    // Filter events based on the requested filter using user's timezone
    const now = new Date();
    const nowInUserTz = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
    const todayInUserTz = new Date(nowInUserTz.getFullYear(), nowInUserTz.getMonth(), nowInUserTz.getDate());
    
    let filteredEvents = events;

    switch (filter) {
      case 'upcoming':
        filteredEvents = events.filter(event => {
          const eventDate = new Date(event.event_date);
          const eventDateInUserTz = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimezone }));
          const eventDateStartOfDay = new Date(eventDateInUserTz.getFullYear(), eventDateInUserTz.getMonth(), eventDateInUserTz.getDate());
          return eventDateStartOfDay.getTime() > todayInUserTz.getTime();
        });
        break;
      
      case 'current':
        filteredEvents = events.filter(event => {
          return isEventCurrentlyActiveInUserTimezone(event as SpecialEvent, now, userTimezone);
        });
        break;
      
      case 'past':
        filteredEvents = events.filter(event => {
          const eventDate = new Date(event.event_date);
          const eventDateInUserTz = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimezone }));
          const eventDateStartOfDay = new Date(eventDateInUserTz.getFullYear(), eventDateInUserTz.getMonth(), eventDateInUserTz.getDate());
          return eventDateStartOfDay.getTime() < todayInUserTz.getTime() &&
                 (!event.is_recurring || !isEventCurrentlyActiveInUserTimezone(event as SpecialEvent, now, userTimezone));
        });
        break;
      
      case 'all':
      default:
        // Return all events, already sorted by date descending
        break;
    }

    logger.info(EVENTS_ACTIONS_CONTEXT, `getAllEventsForPublicWithTimezone: Returning ${filteredEvents.length} events (filter: ${filter}, timezone: ${userTimezone})`);
    return { data: filteredEvents as SpecialEvent[] };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 12 seconds') {
      logger.error(EVENTS_ACTIONS_CONTEXT, "getAllEventsForPublicWithTimezone: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(EVENTS_ACTIONS_CONTEXT, "getAllEventsForPublicWithTimezone: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Helper function to check if an event is currently active (considering time)
 * @param {SpecialEvent} event - The event to check
 * @param {Date} now - The current date and time
 * @returns {boolean} True if the event is currently active
 */
function isEventCurrentlyActive(event: SpecialEvent, now: Date): boolean {
  const eventDate = startOfDay(parseISO(event.event_date));
  const today = startOfDay(now);
  
  // First check if the event is on the correct date
  let isOnCorrectDate = false;
  
  if (!event.is_recurring) {
    // Single event: check if it's today
    isOnCorrectDate = eventDate.getTime() === today.getTime();
  } else if (event.recurring_interval_days) {
    // Recurring event: check if today falls on a recurring interval
    const recurringEndDate = event.recurring_end_date ? startOfDay(parseISO(event.recurring_end_date)) : null;
    
    // Check if today is after the event start date
    if (isBefore(today, eventDate)) {
      return false;
    }
    
    // Check if today is before the recurring end date (if set)
    if (recurringEndDate && isAfter(today, recurringEndDate)) {
      return false;
    }
    
    // Calculate if today falls on a recurring interval
    const daysDifference = Math.floor((today.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
    isOnCorrectDate = daysDifference % event.recurring_interval_days === 0;
  }
  
  if (!isOnCorrectDate) {
    return false;
  }
  
  // Now check the time constraints if they exist
  if (event.start_time || event.end_time) {
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes since midnight
    
    if (event.start_time) {
      const [startHour, startMinute] = event.start_time.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMinute;
      
      // If current time is before start time, event is not active yet
      if (currentTime < startTimeMinutes) {
        return false;
      }
    }
    
    if (event.end_time) {
      const [endHour, endMinute] = event.end_time.split(':').map(Number);
      const endTimeMinutes = endHour * 60 + endMinute;
      
      // If current time is after end time, event is no longer active
      if (currentTime > endTimeMinutes) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Helper function to check if a recurring event is active today (legacy function for compatibility)
 * @param {SpecialEvent} event - The recurring event to check
 * @param {Date} today - The date to check against
 * @returns {boolean} True if the recurring event is active on the given date
 */
function isEventActiveToday(event: SpecialEvent, today: Date): boolean {
  if (!event.is_recurring || !event.recurring_interval_days) {
    return false;
  }

  const eventStartDate = startOfDay(parseISO(event.event_date));
  const recurringEndDate = event.recurring_end_date ? startOfDay(parseISO(event.recurring_end_date)) : null;

  // Check if today is after the event start date
  if (isBefore(today, eventStartDate)) {
    return false;
  }

  // Check if today is before the recurring end date (if set)
  if (recurringEndDate && isAfter(today, recurringEndDate)) {
    return false;
  }

  // Calculate if today falls on a recurring interval
  const daysDifference = Math.floor((today.getTime() - eventStartDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysDifference % event.recurring_interval_days === 0;
}

/**
 * Helper function to check if an event is currently active in user's timezone (considering time)
 * This is the main function to use for proper timezone handling
 * @param {SpecialEvent} event - The event to check
 * @param {Date} now - The current date and time (in user's timezone)
 * @param {string} userTimezone - The user's timezone (from browser)
 * @returns {boolean} True if the event is currently active in user's timezone
 */
function isEventCurrentlyActiveInUserTimezone(event: SpecialEvent, now: Date, userTimezone: string): boolean {
  // Convert the event date to user's timezone for comparison
  const eventDate = new Date(event.event_date);
  const eventDateInUserTz = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimezone }));
  const eventDateStartOfDay = new Date(eventDateInUserTz.getFullYear(), eventDateInUserTz.getMonth(), eventDateInUserTz.getDate());
  
  // Convert current time to user's timezone
  const nowInUserTz = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
  const todayStartOfDay = new Date(nowInUserTz.getFullYear(), nowInUserTz.getMonth(), nowInUserTz.getDate());
  
  // First check if the event is on the correct date
  let isOnCorrectDate = false;
  
  if (!event.is_recurring) {
    // Single event: check if it's today in user's timezone
    isOnCorrectDate = eventDateStartOfDay.getTime() === todayStartOfDay.getTime();
  } else if (event.recurring_interval_days) {
    // Recurring event: check if today falls on a recurring interval
    const recurringEndDate = event.recurring_end_date ? new Date(event.recurring_end_date) : null;
    let recurringEndDateInUserTz = null;
    if (recurringEndDate) {
      const recurringEndInUserTz = new Date(recurringEndDate.toLocaleString("en-US", { timeZone: userTimezone }));
      recurringEndDateInUserTz = new Date(recurringEndInUserTz.getFullYear(), recurringEndInUserTz.getMonth(), recurringEndInUserTz.getDate());
    }
    
    // Check if today is after the event start date
    if (todayStartOfDay.getTime() < eventDateStartOfDay.getTime()) {
      return false;
    }
    
    // Check if today is before the recurring end date (if set)
    if (recurringEndDateInUserTz && todayStartOfDay.getTime() > recurringEndDateInUserTz.getTime()) {
      return false;
    }
    
    // Calculate if today falls on a recurring interval
    const daysDifference = Math.floor((todayStartOfDay.getTime() - eventDateStartOfDay.getTime()) / (1000 * 60 * 60 * 24));
    isOnCorrectDate = daysDifference % event.recurring_interval_days === 0;
  }
  
  if (!isOnCorrectDate) {
    return false;
  }
  
  // Now check the time constraints if they exist (using user's timezone)
  if (event.start_time || event.end_time) {
    const currentTime = nowInUserTz.getHours() * 60 + nowInUserTz.getMinutes(); // Current time in minutes since midnight
    
    if (event.start_time) {
      const [startHour, startMinute] = event.start_time.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMinute;
      
      // If current time is before start time, event is not active yet
      if (currentTime < startTimeMinutes) {
        return false;
      }
    }
    
    if (event.end_time) {
      const [endHour, endMinute] = event.end_time.split(':').map(Number);
      const endTimeMinutes = endHour * 60 + endMinute;
      
      // If current time is after end time, event is no longer active
      if (currentTime > endTimeMinutes) {
        return false;
      }
    }
  }
  
  return true;
}
