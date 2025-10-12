import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let cachedClient: SupabaseClient | null = null;
let fallbackClient: SupabaseClient | null = null;

function normalizeSupabaseAvailability(): boolean {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return false;
  }

  if (typeof window !== 'undefined') {
    try {
      const configuredHost = new URL(env.supabaseUrl).host;
      const currentHost = window.location.host;

      if (configuredHost === currentHost) {
        console.warn(
          'Supabase URL parece apontar para o mesmo domínio do site. Ignorando credenciais para evitar chamadas inválidas.',
        );
        return false;
      }
    } catch (error) {
      console.warn('Não foi possível interpretar SUPABASE_URL. Verifique o valor informado.', error);
      return false;
    }
  }

  return true;
}

const initialAvailability = normalizeSupabaseAvailability();

export function hasSupabaseCredentials(): boolean {
  if (typeof window === 'undefined') {
    return initialAvailability;
  }

  return normalizeSupabaseAvailability();
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

export function getSupabaseClient(): SupabaseClient {
  if (!hasSupabaseCredentials()) {
    return createFallbackClient();
  }

  if (!cachedClient) {
    cachedClient = createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return cachedClient;
}

/**
 * Convenience export kept for legacy imports that previously consumed a
 * singleton `supabase` client. It resolves lazily so that environments
 * sem Supabase fiquem consistentes ao chamar o bundle.
 */
export const supabase: SupabaseClient = getSupabaseClient();
