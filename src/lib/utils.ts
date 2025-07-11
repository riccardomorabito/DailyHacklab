import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { enUS } from 'date-fns/locale';

/**
 * Combines multiple class values using clsx and tailwind-merge.
 * @param inputs - Class values to combine.
 * @returns Merged class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Gets the user's browser timezone.
 * Falls back to UTC if the timezone cannot be determined.
 * @returns The user's timezone identifier (e.g., 'America/New_York', 'Europe/London').
 */
export function getUserTimezone(): string {
  try {
    // Intl.DateTimeFormat is the standard way to get the user's timezone.
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Failed to detect user timezone, falling back to UTC.');
    return 'UTC';
  }
}

/**
 * Formats a UTC date string or Date object into a human-readable string in the user's local timezone.
 * This function is the single source of truth for displaying dates to users.
 *
 * @param date - The date to format, either as a string (ISO 8601 format) or a Date object.
 * @param formatString - The desired output format, using date-fns tokens (e.g., 'PPP p').
 * @param timeZone - Optional: override the user's detected timezone.
 * @returns A formatted date string in the user's timezone, or 'N/A' if the date is invalid.
 */
export function formatDate(date: string | Date | null | undefined, formatString: string = 'PPP p'): string {
  if (!date) {
    return 'N/A';
  }

  try {
    const userTimeZone = getUserTimezone();
    // formatInTimeZone from date-fns-tz handles the conversion and formatting in one step.
    return formatInTimeZone(date, userTimeZone, formatString, { locale: enUS });
  } catch (error) {
    // Log the error for debugging purposes.
    console.error(`Error formatting date: ${date}`, error);
    // Return a user-friendly error message.
    return 'Invalid Date';
  }
}

/**
 * Converts a UTC date to a Date object in the specified timezone.
 * This is useful for calculations where you need a Date object representing the time in a specific zone.
 *
 * @param utcDate - The UTC date (string or Date object).
 * @param timeZone - The target timezone.
 * @returns A new Date object representing the time in the target timezone.
 */
export function convertToTimezone(utcDate: string | Date, timeZone: string): Date {
    return toZonedTime(utcDate, timeZone);
}
