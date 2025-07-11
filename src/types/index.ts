/**
 * Type definitions for the Daily Hacklab application
 * Contains interfaces and types used throughout the application
 */

/**
 * Represents a user in the application.
 * Combines data from Supabase Auth and the 'profiles' table.
 */
export interface User {
  /** Auth user ID from Supabase (UUID) */
  id: string;
  
  /** User's display name from 'profiles' table */
  name: string;
  
  /** User's email from Auth user & 'profiles' table */
  email: string;
  
  /** User role determining permissions */
  role: 'user' | 'admin';
  
  /** User's contribution score from 'profiles' table */
  score: number;
  
  /** Optional URL to user's avatar image from 'profiles' table */
  avatarUrl?: string;
  
  /** Array of submission IDs the user has starred */
  starred_submissions?: string[];
  
  /** For consistency with SupabaseUser, though not fully populated/used everywhere */
  user_metadata?: { [key: string]: any };
  
  /** Timestamp of the last profile update from 'profiles' table */
  updated_at?: string;
}

/**
 * Represents a user-created post.
 * Corresponds to the 'posts' table in the database.
 */
export interface Post {
  /** Primary Key (UUID) */
  id: string;
  
  /** Foreign Key to auth.users.id (UUID) */
  user_id: string;
  
  /** Denormalized user name from 'profiles' for display */
  user_name: string;
  
  /** Denormalized user avatar URL from 'profiles' for display */
  user_avatar_url?: string;
  
  /** Array of photo URLs (JSONB in DB, string[] in TS) */
  photo_urls: string[];
  
  /** Optional summary text for the post */
  summary?: string;
  
  /** Post creation timestamp (timestamptz in DB, ISO string in TS) */
  submission_date: string;
  
  /** Moderation status: null = pending, true = approved, false = rejected */
  approved: boolean | null;
  
  /** Number of stars/appreciations received (default 0) */
  stars_received: number;
}

/**
 * Represents a special event that can provide bonus points.
 * Corresponds to the 'special_events' table in the database.
 */
export interface SpecialEvent {
  /** Primary Key (UUID) */
  id: string;
  
  /** Event name/title */
  name: string;
  
  /** Optional event description */
  description?: string;
  
  /** Event date (timestamptz in DB, ISO string in TS) */
  event_date: string;
  
  /** Event start time (HH:MM format) */
  start_time?: string;
  
  /** Event end time (HH:MM format) */
  end_time?: string;
  
  /** Bonus points awarded for participation */
  bonus_points: number;
  
  /** Event creation timestamp (timestamptz in DB, ISO string in TS) */
  created_at: string;
  
  // Notification settings
  /** Whether to show website notification for this event */
  show_notification: boolean;
  
  /** Custom notification message (optional) */
  notification_message?: string;
  
  // Recurring event properties
  /** Whether this event repeats */
  is_recurring: boolean;
  
  /** How many days between repetitions (null for non-recurring events) */
  recurring_interval_days?: number;
  
  /** When to stop generating recurring events (null for indefinite) */
  recurring_end_date?: string;
  
  /** For generated recurring instances, references the original event */
  parent_event_id?: string;
  
  // Note: isActive is typically determined dynamically, not stored, based on event_date vs current date
}

/**
 * Represents application-wide settings stored in the database.
 * Corresponds to the 'app_settings' table in the database.
 */
export interface AppSettings {
  /** Primary Key (UUID) */
  id: string;
  
  /** Setting name/key */
  setting_key: string;
  
  /** Setting value (stored as text, needs parsing for booleans/numbers) */
  setting_value: string;
  
  /** Optional description of the setting */
  description?: string;
  
  /** Timestamp of the last update (timestamptz in DB, ISO string in TS) */
  updated_at: string;
  
  /** Timestamp of when the setting was created (timestamptz in DB, ISO string in TS) */
  created_at: string;
}
