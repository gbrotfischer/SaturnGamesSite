import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    });
  }

  return cachedClient;
}

/**
 * Convenience export kept for legacy imports that previously consumed a
 * singleton `supabase` client. It resolves lazily so that environments
 * without Supabase credentials can still load the bundle while
 * TypeScript consumers regain the familiar named export.
 */
export const supabase: SupabaseClient | null = getSupabaseClient();
