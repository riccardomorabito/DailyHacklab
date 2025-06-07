/**
 * Logging utility module for the application
 * Provides configurable logging with admin override capabilities
 */

/**
 * localStorage key for admin logging override setting
 */
const ADMIN_LOGGING_OVERRIDE_STORAGE_KEY = 'hacklab-daily-admin-logging-override';

/**
 * Prefix for all log messages to identify application logs
 */
const LOG_PREFIX = "[DailyHacklab]"; // Prefix for all log messages

/**
 * Determines if logging is effectively enabled based on admin override and default settings.
 * @returns {boolean} True if logging is enabled, false otherwise.
 */
function isLoggingEffectivelyEnabled(): boolean {
  // Phase 1: Check for admin override in localStorage (takes precedence)
  if (typeof window !== 'undefined') { // Ensure localStorage is available (client-side)
    const adminOverride = localStorage.getItem(ADMIN_LOGGING_OVERRIDE_STORAGE_KEY);
    if (adminOverride === 'true') {
      return true; // Admin has enabled logs for this session
    }
    if (adminOverride === 'false') {
      return false; // Admin has disabled logs for this session
    }
  }

  // Phase 2: If no admin override, check the environment variable
  // Logs are enabled by default if the variable is 'true' or not defined (to facilitate development).
  // Logs are disabled by default only if the variable is explicitly 'false'.
  return process.env.NEXT_PUBLIC_ENABLE_LOGGING_BY_DEFAULT !== 'false';
}

/**
 * Generic log function that prepends prefix, level, timestamp, and context.
 * @param {'debug' | 'info' | 'warn' | 'error'} level - The log level.
 * @param {string} context - The context from which the log originates (e.g., component name).
 * @param {...any[]} args - The messages or objects to log.
 */
const log = (level: 'debug' | 'info' | 'warn' | 'error', context: string, ...args: any[]) => {
  if (isLoggingEffectivelyEnabled()) {
    const timestamp = new Date().toISOString();
    console[level](`${LOG_PREFIX}[${level.toUpperCase()}]-[${timestamp}]-[${context}]:`, ...args);
  }
};

// Logger object with specific level methods
export const logger = {
  debug: (context: string, ...args: any[]) => log('debug', context, ...args),
  info: (context: string, ...args: any[]) => log('info', context, ...args),
  warn: (context: string, ...args: any[]) => log('warn', context, ...args),
  error: (context: string, ...args: any[]) => log('error', context, ...args),
};

// --- Functions for Admin UI to control logging ---

/**
 * Allows an admin to set a logging override for their current browser session.
 * This override is stored in localStorage.
 * @param {boolean | null} enable - `true` to force enable, `false` to force disable, `null` to remove override.
 */
export function setAdminLoggingOverride(enable: boolean | null): void {
  if (typeof window !== 'undefined') {
    if (enable === null) {
      localStorage.removeItem(ADMIN_LOGGING_OVERRIDE_STORAGE_KEY);
      logger.info("AdminLogging", "Admin logging override removed. Log state will revert to default on next check.");
    } else {
      localStorage.setItem(ADMIN_LOGGING_OVERRIDE_STORAGE_KEY, String(enable));
      logger.info("AdminLogging", `Admin logging override set to: ${enable}.`);
    }
    // Note: This changes the state for future logger calls.
    // For an immediate effect across the app without reload, an event system or context update would be needed.
  }
}

/**
 * Gets the current state of the admin logging override from localStorage.
 * @returns {boolean | null} `true` if enabled, `false` if disabled, `null` if no override is set.
 */
export function getAdminLoggingOverride(): boolean | null {
  if (typeof window !== 'undefined') {
    const adminOverride = localStorage.getItem(ADMIN_LOGGING_OVERRIDE_STORAGE_KEY);
    if (adminOverride === 'true') return true;
    if (adminOverride === 'false') return false;
  }
  return null; // No override set
}

/**
 * Gets the default logging state based on the environment variable.
 * @returns {boolean} True if logging is enabled by default, false otherwise.
 */
export function getDefaultLoggingEnabled(): boolean {
    return process.env.NEXT_PUBLIC_ENABLE_LOGGING_BY_DEFAULT !== 'false';
}
