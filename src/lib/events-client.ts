"use client";

import { createClient } from '@/lib/supabase/client';
import type { SpecialEvent } from '@/types';
import { logger } from '@/lib/logger';

/** Context identifier for logging events-related operations */
const EVENTS_CLIENT_CONTEXT = "EventsClient";

/**
 * Get all special events from the database (client-side)
 * @returns Promise with events data or error message
 */
export async function getSpecialEvents(): Promise<{ data?: SpecialEvent[]; error?: string }> {
  logger.info(EVENTS_CLIENT_CONTEXT, "getSpecialEvents: Fetching all special events from client");
  
  try {
    const supabase = createClient();
    
    const { data: events, error } = await supabase
      .from('special_events')
      .select('*')
      .order('event_date', { ascending: false });

    if (error) {
      logger.error(EVENTS_CLIENT_CONTEXT, "getSpecialEvents: Database error:", error);
      return { error: "Unable to load special events from database." };
    }

    if (!events) {
      logger.info(EVENTS_CLIENT_CONTEXT, "getSpecialEvents: No events found");
      return { data: [] };
    }

    logger.info(EVENTS_CLIENT_CONTEXT, `getSpecialEvents: Successfully fetched ${events.length} events`);
    return { data: events as SpecialEvent[] };

  } catch (err) {
    logger.error(EVENTS_CLIENT_CONTEXT, "getSpecialEvents: Unexpected error:", err);
    return { error: "An unexpected error occurred while loading events." };
  }
}
