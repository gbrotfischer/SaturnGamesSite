import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let cachedClient: SupabaseClient | null = null;
let fallbackClient: SupabaseClient | null = null;

export const hasSupabaseCredentials = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export function getSupabaseClient() {
  if (!hasSupabaseCredentials) {
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

function createFallbackClient(): SupabaseClient {
  if (!fallbackClient) {
    fallbackClient = new Proxy({} as SupabaseClient, {
      get(_target, prop) {
        const propName = typeof prop === 'string' ? prop : 'unknown';
        throw new Error(
          `Supabase client não configurado. Configure SUPABASE_URL e SUPABASE_ANON_KEY para usar \`${propName}\`.`,
        );
      },
    });
  }

  return fallbackClient;
}

/**
 * Convenience export kept for legacy imports that previously consumed a
 * singleton `supabase` client. It resolves lazily so that environments
 * without Supabase credentials can still load the bundle while
 * TypeScript consumers regain the familiar named export.
 */
export const supabase: SupabaseClient = getSupabaseClient() ?? createFallbackClient();
