import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase project URL from environment variables
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Supabase anonymous key from environment variables
 */
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Ensure Supabase URL and Anon Key are provided in environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key. Check your .env.local file.');
}

/**
 * Creates a Supabase client instance for use in browser environments (client-side components).
 * It uses the public Supabase URL and anon key.
 * @returns {SupabaseClient} A Supabase client instance.
 * @throws {Error} If Supabase URL or Anon Key is missing.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      // Use secure cookies with minimal JWT payload to reduce fragmentation
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Configure for smaller JWT tokens
      flowType: 'pkce'
    },
    global: {
      headers: {
        // Request minimal user metadata to reduce JWT size
        'X-Client-Info': 'daily-hacklab-web'
      }
    }
  });
}
