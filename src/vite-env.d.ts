interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_OPENPIX_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
