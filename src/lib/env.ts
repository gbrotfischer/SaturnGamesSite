const optional = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);

const sanitizeBaseUrl = (value?: string) => {
  if (!value) return undefined;
  try {
    const normalized = new URL(value);
    normalized.pathname = '';
    normalized.search = '';
    normalized.hash = '';
    return normalized.toString().replace(/\/$/, '');
  } catch (error) {
    console.warn('URL inválida configurada em VITE_API_BASE_URL. Ignorando valor informado.', error);
    return undefined;
  }
};

const deriveApiBaseFromWindow = () => {
  if (typeof window === 'undefined') {
    if (import.meta.env.DEV) {
      return 'http://localhost:8787';
    }
    return undefined;
  }

  try {
    const { protocol, hostname } = window.location;

    if (hostname === 'localhost' || hostname.startsWith('127.')) {
      return 'http://localhost:8787';
    }

    if (hostname.startsWith('api.')) {
      return `${protocol}//${hostname}`;
    }

    if (hostname.startsWith('www.')) {
      return `${protocol}//api.${hostname.slice(4)}`;
    }

    return `${protocol}//api.${hostname}`;
  } catch (error) {
    console.warn('Não foi possível derivar API base automaticamente.', error);
    return undefined;
  }
};

const configuredApiBase = sanitizeBaseUrl(optional(import.meta.env.VITE_API_BASE_URL as string | undefined));

const resolvedApiBase = (() => {
  if (configuredApiBase) {
    if (typeof window !== 'undefined') {
      try {
        const configuredHost = new URL(configuredApiBase).host;
        const currentHost = window.location.host;
        if (configuredHost === currentHost && currentHost.startsWith('www.')) {
          return `${window.location.protocol}//api.${currentHost.slice(4)}`;
        }
      } catch (error) {
        console.warn('Falha ao normalizar VITE_API_BASE_URL. Usando valor informado como está.', error);
      }
    }
    return configuredApiBase;
  }

  return deriveApiBaseFromWindow();
})();

export const env = {
  supabaseUrl: sanitizeBaseUrl(optional(import.meta.env.VITE_SUPABASE_URL as string | undefined)),
  supabaseAnonKey: optional(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined),
  openPixAppId: optional(import.meta.env.VITE_OPENPIX_APP_ID as string | undefined),
  apiBaseUrl: resolvedApiBase,
  turnstileSiteKey: optional(import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)
};
