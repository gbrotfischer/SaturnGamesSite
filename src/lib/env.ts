const optional = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value : undefined);

export const env = {
  supabaseUrl: optional(import.meta.env.VITE_SUPABASE_URL as string | undefined),
  supabaseAnonKey: optional(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined),
  openPixAppId: optional(import.meta.env.VITE_OPENPIX_APP_ID as string | undefined),
  apiBaseUrl: optional(import.meta.env.VITE_API_BASE_URL as string | undefined),
  turnstileSiteKey: optional(import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)
};

export function assertEnv() {
  if (!env.supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL não configurada.');
  }

  if (!env.supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY não configurada.');
  }

  if (!env.apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL não configurada.');
  }
}
