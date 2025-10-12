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
