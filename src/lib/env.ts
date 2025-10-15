const optional = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);

export const env = {
  supabaseUrl: optional(import.meta.env.VITE_SUPABASE_URL as string | undefined),
  supabaseAnonKey: optional(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined),
  turnstileSiteKey: optional(import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined),
  stripePublishableKey: optional(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined),
};
