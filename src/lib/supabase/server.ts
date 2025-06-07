import { createServerClient as _createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies as _nextCookies } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Context identifier for logging operations in this module
 */
const SUPABASE_SERVER_CONTEXT = "SupabaseServerClient";

/**
 * Supabase project URL from environment variables
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Supabase anonymous key from environment variables
 */
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Ensure Supabase URL and Anon Key are available
if (!supabaseUrl || !supabaseAnonKey) {
  logger.error(SUPABASE_SERVER_CONTEXT, "Missing Supabase URL or Anon Key. This will cause critical errors for server-side Supabase operations.");
}

/**
 * Creates a Supabase client for use in server-side environments (Server Components, Route Handlers, Server Actions).
 * It handles cookie management for authentication by interacting with Next.js's cookie store.
 * @returns Promise<SupabaseClient> A Supabase client instance.
 * @throws Error if Supabase URL or Anon Key is missing and client creation is attempted.
 */
export async function createServerSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or Anon Key is not configured. Cannot create server client.');
  }

  const cookieStore = await _nextCookies();

  return _createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string): string | undefined {
        const cookie = cookieStore.get(name);
        return cookie?.value;
      },
      set(name: string, value: string, options: CookieOptions): void {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          logger.warn(SUPABASE_SERVER_CONTEXT, `Error setting cookie "${name}" (can be ignored if in Server Component or with middleware):`, error);
        }
      },
      remove(name: string, options: CookieOptions): void {
        try {
          cookieStore.delete({ name, ...options });
        } catch (error) {
          logger.warn(SUPABASE_SERVER_CONTEXT, `Error removing cookie "${name}" (can be ignored if in Server Component or with middleware):`, error);
        }
      },
    },
  });
}

/**
 * Creates a Supabase admin client that uses the service_role key.
 * This client bypasses RLS policies and should be used with caution for administrative tasks.
 * @returns SupabaseClient A Supabase admin client instance.
 * @throws Error if Supabase URL or Service Role Key is missing.
 */
export function createAdminClient() {
    // This is the key line: looks for process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
        logger.error(SUPABASE_SERVER_CONTEXT, "Supabase URL or Service Role Key not found for Admin Client. Admin operations requiring it may fail.");
        // If SUPABASE_SERVICE_ROLE_KEY is not defined in the environment (due to an error in .env.local), this error will be thrown.
        throw new Error("Supabase URL or Service Role Key not found for Admin Client.");
    }

    return _createServerClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        cookies: { 
            get() { return undefined; },
            set() {},
            remove() {},
        }
    });
}

