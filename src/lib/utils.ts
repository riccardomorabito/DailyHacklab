import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatISO, format as dateFnsFormat } from 'date-fns'
import { it } from 'date-fns/locale'

/**
 * Combines multiple class values using clsx and tailwind-merge
 * @param inputs - Class values to combine
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * European timezone configuration for Rome/Italy (legacy support)
 */
export const EUROPEAN_TIMEZONE = 'Europe/Rome';

/**
 * Gets the user's browser timezone
 * @returns The user's timezone identifier (e.g., 'America/New_York', 'Europe/London')
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Failed to detect user timezone, falling back to Europe/Rome');
    return EUROPEAN_TIMEZONE;
  }
}

/**
 * Converts a Date to user's local timezone using native JavaScript
 * @param date - The date to convert
 * @param timezone - Optional timezone override, defaults to user's timezone
 * @returns Date object adjusted for user's timezone
 */
export function toUserTime(date: Date, timezone?: string): Date {
  const userTimezone = timezone || getUserTimezone();
  return new Date(date.toLocaleString("en-US", { timeZone: userTimezone }));
}

/**
 * Converts a Date to European timezone (Rome) using native JavaScript
 * @param date - The date to convert
 * @returns Date object adjusted for European timezone
 */
export function toEuropeanTime(date: Date): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: EUROPEAN_TIMEZONE }));
}

/**
 * Gets the start of day in user's timezone
 * @param date - The date to get start of day for (in any timezone)
 * @param timezone - Optional timezone override, defaults to user's timezone
 * @returns ISO string representing start of day in user's timezone
 */
export function startOfDayUserISO(date: Date, timezone?: string): string {
  const userTimezone = timezone || getUserTimezone();
  
  // Create a new date object in user's timezone
  const userDate = new Date(date.toLocaleString("en-US", { timeZone: userTimezone }));
  
  // Set to start of day in user's timezone
  const year = userDate.getFullYear();
  const month = String(userDate.getMonth() + 1).padStart(2, '0');
  const day = String(userDate.getDate()).padStart(2, '0');
  
  // Create a date object for start of day and convert back to UTC for database storage
  const startOfDayLocal = new Date(`${year}-${month}-${day}T00:00:00`);
  const offsetMinutes = startOfDayLocal.getTimezoneOffset();
  const userOffsetMinutes = getUserTimezoneOffset(startOfDayLocal, userTimezone);
  const adjustedDate = new Date(startOfDayLocal.getTime() - (userOffsetMinutes * 60000));
  
  return adjustedDate.toISOString();
}

/**
 * Gets the start of day in European timezone (Rome)
 * @param date - The date to get start of day for (in any timezone)
 * @returns ISO string representing start of day in European timezone
 */
export function startOfDayEuropeanISO(date: Date): string {
  // Create a new date object in European timezone
  const europeanDate = new Date(date.toLocaleString("en-US", { timeZone: EUROPEAN_TIMEZONE }));
  
  // Set to start of day in European timezone
  const year = europeanDate.getFullYear();
  const month = String(europeanDate.getMonth() + 1).padStart(2, '0');
  const day = String(europeanDate.getDate()).padStart(2, '0');
  
  // Create a date object for start of day and convert back to UTC for database storage
  const startOfDayLocal = new Date(`${year}-${month}-${day}T00:00:00`);
  const offsetMinutes = startOfDayLocal.getTimezoneOffset();
  const europeanOffsetMinutes = getEuropeanTimezoneOffset(startOfDayLocal);
  const adjustedDate = new Date(startOfDayLocal.getTime() - (europeanOffsetMinutes * 60000));
  
  return adjustedDate.toISOString();
}

/**
 * Gets the end of day in user's timezone
 * @param date - The date to get end of day for
 * @param timezone - Optional timezone override, defaults to user's timezone
 * @returns ISO string representing end of day in user's timezone
 */
export function endOfDayUserISO(date: Date, timezone?: string): string {
  const userTimezone = timezone || getUserTimezone();
  
  // Create a new date object in user's timezone
  const userDate = new Date(date.toLocaleString("en-US", { timeZone: userTimezone }));
  
  // Set to end of day in user's timezone
  const year = userDate.getFullYear();
  const month = String(userDate.getMonth() + 1).padStart(2, '0');
  const day = String(userDate.getDate()).padStart(2, '0');
  
  // Create a date object for end of day and convert back to UTC for database storage
  const endOfDayLocal = new Date(`${year}-${month}-${day}T23:59:59.999`);
  const userOffsetMinutes = getUserTimezoneOffset(endOfDayLocal, userTimezone);
  const adjustedDate = new Date(endOfDayLocal.getTime() - (userOffsetMinutes * 60000));
  
  return adjustedDate.toISOString();
}

/**
 * Gets the end of day in European timezone (Rome)
 * @param date - The date to get end of day for
 * @returns ISO string representing end of day in European timezone
 */
export function endOfDayEuropeanISO(date: Date): string {
  // Create a new date object in European timezone
  const europeanDate = new Date(date.toLocaleString("en-US", { timeZone: EUROPEAN_TIMEZONE }));
  
  // Set to end of day in European timezone
  const year = europeanDate.getFullYear();
  const month = String(europeanDate.getMonth() + 1).padStart(2, '0');
  const day = String(europeanDate.getDate()).padStart(2, '0');
  
  // Create a date object for end of day and convert back to UTC for database storage
  const endOfDayLocal = new Date(`${year}-${month}-${day}T23:59:59.999`);
  const europeanOffsetMinutes = getEuropeanTimezoneOffset(endOfDayLocal);
  const adjustedDate = new Date(endOfDayLocal.getTime() - (europeanOffsetMinutes * 60000));
  
  return adjustedDate.toISOString();
}

/**
 * Gets the timezone offset for user's timezone - handles DST
 * @param date - The date to get offset for
 * @param timezone - Optional timezone override, defaults to user's timezone
 * @returns Offset in minutes
 */
function getUserTimezoneOffset(date: Date, timezone?: string): number {
  const userTimezone = timezone || getUserTimezone();
  
  // Create two dates: one in UTC, one in user's timezone
  const utcDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
  const userDate = new Date(utcDate.toLocaleString("en-US", { timeZone: userTimezone }));
  
  // Calculate the difference in minutes
  return (utcDate.getTime() - userDate.getTime()) / 60000;
}

/**
 * Gets the timezone offset for European timezone (Rome) - handles DST
 * @param date - The date to get offset for
 * @returns Offset in minutes
 */
function getEuropeanTimezoneOffset(date: Date): number {
  // Create two dates: one in UTC, one in European timezone
  const utcDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
  const europeanDate = new Date(utcDate.toLocaleString("en-US", { timeZone: EUROPEAN_TIMEZONE }));
  
  // Calculate the difference in minutes
  return (utcDate.getTime() - europeanDate.getTime()) / 60000;
}

/**
 * Gets the current date in user's timezone
 * @param timezone - Optional timezone override, defaults to user's timezone
 * @returns Date object representing current time in user's timezone
 */
export function nowInUserTimezone(timezone?: string): Date {
  const userTimezone = timezone || getUserTimezone();
  return new Date(new Date().toLocaleString("en-US", { timeZone: userTimezone }));
}

/**
 * Gets the current date in European timezone (Rome)
 * @returns Date object representing current time in European timezone
 */
export function nowInEuropean(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: EUROPEAN_TIMEZONE }));
}

/**
 * Formats a date string for database queries in user's timezone
 * @param date - The date to format
 * @param timezone - Optional timezone override, defaults to user's timezone
 * @returns Date string in YYYY-MM-DD format for user's timezone
 */
export function formatDateForUserTimezone(date: Date, timezone?: string): string {
  const userTimezone = timezone || getUserTimezone();
  const userDate = new Date(date.toLocaleString("en-US", { timeZone: userTimezone }));
  const year = userDate.getFullYear();
  const month = String(userDate.getMonth() + 1).padStart(2, '0');
  const day = String(userDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date string for database queries in European timezone (Rome)
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format for European timezone
 */
export function formatDateForEuropeanTimezone(date: Date): string {
  const europeanDate = new Date(date.toLocaleString("en-US", { timeZone: EUROPEAN_TIMEZONE }));
  const year = europeanDate.getFullYear();
  const month = String(europeanDate.getMonth() + 1).padStart(2, '0');
  const day = String(europeanDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates ISO string for current time in user's timezone
 * @param timezone - Optional timezone override, defaults to user's timezone
 * @returns ISO string for current time in user's timezone
 */
export function nowISOUser(timezone?: string): string {
  const userTimezone = timezone || getUserTimezone();
  const now = new Date();
  // Get the current time in user's timezone
  const userTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
  return userTime.toISOString();
}

/**
 * Creates ISO string for current time in European timezone (Rome)
 * @returns ISO string for current time in European timezone
 */
export function nowISOEuropean(): string {
  const now = new Date();
  // Get the current time in European timezone
  const europeanTime = new Date(now.toLocaleString("en-US", { timeZone: EUROPEAN_TIMEZONE }));
  return europeanTime.toISOString();
}

/**
 * Converts a UTC date string (from database) to user's timezone and formats it
 * @param utcDateString - ISO string from database (in UTC)
 * @param formatString - date-fns format string (default: "dd/MM/yy HH:mm")
 * @param timezone - Optional timezone override, defaults to user's timezone
 * @returns Formatted date string in user's timezone
 */
export function formatDateInUserTimezone(
  utcDateString: string, 
  formatString: string = "dd/MM/yy HH:mm",
  timezone?: string
): string {
  try {
    const userTimezone = timezone || getUserTimezone();
    
    // Parse the UTC date string
    const utcDate = new Date(utcDateString);
    
    // Convert to user's timezone
    const userDate = new Date(utcDate.toLocaleString("en-US", { timeZone: userTimezone }));
    
    // Format using date-fns with Italian locale
    return dateFnsFormat(userDate, formatString, { locale: it });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

/**
 * Converts a UTC date string (from database) to European timezone and formats it
 * @param utcDateString - ISO string from database (in UTC)
 * @param formatString - date-fns format string (default: "dd/MM/yy HH:mm")
 * @returns Formatted date string in European timezone
 */
export function formatDateInEuropeanTimezone(
  utcDateString: string, 
  formatString: string = "dd/MM/yy HH:mm"
): string {
  try {
    // Parse the UTC date string
    const utcDate = new Date(utcDateString);
    
    // Convert to European timezone
    const europeanDate = new Date(utcDate.toLocaleString("en-US", { timeZone: EUROPEAN_TIMEZONE }));
    
    // Format using date-fns with Italian locale
    return dateFnsFormat(europeanDate, formatString, { locale: it });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}
