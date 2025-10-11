export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  openPixAppId: import.meta.env.VITE_OPENPIX_APP_ID as string | undefined,
  openPixWorkerUrl: import.meta.env.VITE_OPENPIX_WORKER_URL as string | undefined
};

export function assertEnv() {
  if (!env.supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL não configurada.');
  }

  if (!env.supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY não configurada.');
  }
}
