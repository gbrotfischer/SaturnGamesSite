import { getSupabaseClient } from './supabaseClient';
import { env } from './env';
import type {
  CheckoutMode,
  Game,
  GameAsset,
  NotificationPreferences,
  UpcomingRelease,
  PurchaseWithGame,
  RentalWithGame,
  RentalStatus,
} from '../types';

const GAME_SELECT = `
  id,
  slug,
  title,
  short_description,
  description,
  price_cents,
  lifetime_price_cents,
  rental_duration_days,
  is_lifetime_available,
  is_published,
  tiktok_notes,
  status,
  genres,
  tags,
  release_date,
  popularity_score,
  featured,
  created_at,
  game_assets ( id, kind, url, sort_order ),
  releases_upcoming ( id, release_date, notify_list )
`;

type RawGame = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  price_cents: number;
  lifetime_price_cents: number | null;
  rental_duration_days: number;
  is_lifetime_available: boolean;
  is_published: boolean;
  tiktok_notes: string | null;
  status: 'available' | 'coming_soon';
  genres: string[] | null;
  tags: string[] | null;
  release_date: string | null;
  popularity_score: number | null;
  featured: boolean | null;
  created_at: string;
  game_assets: { id: string; kind: string; url: string; sort_order: number | null }[] | null;
  releases_upcoming:
    | { id: string; release_date: string | null; notify_list: string[] | null }[]
    | null;
};

type RawRental = {
  id: string;
  user_id: string;
  game_id: string;
  starts_at: string;
  expires_at: string | null;
  status: string;
  payment_ref: string | null;
  mode: CheckoutMode;
  game: RawGame | RawGame[] | null;
};

type RawPurchase = {
  id: string;
  user_id: string;
  game_id: string;
  purchased_at: string;
  payment_ref: string | null;
  game: RawGame | RawGame[] | null;
};

type RawNotificationPrefs = {
  user_id: string;
  email_release_alerts: boolean | null;
  email_expiry_alerts: boolean | null;
};

async function loadLocalCatalog() {
  const module = await import('../data/catalog');
  return module.localCatalog;
}

function mapGame(raw: RawGame): Game {
  const assets: GameAsset[] =
    raw.game_assets?.map((asset) => ({
      id: asset.id,
      gameId: raw.id,
      kind: asset.kind as GameAsset['kind'],
      url: asset.url,
      sortOrder: asset.sort_order ?? 0,
    })) ?? [];

  const upcoming: UpcomingRelease | null = raw.releases_upcoming?.length
    ? {
        id: raw.releases_upcoming[0].id,
        gameId: raw.id,
        releaseDate: raw.releases_upcoming[0].release_date,
        notifyList: raw.releases_upcoming[0].notify_list ?? [],
      }
    : null;

  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    shortDescription: raw.short_description,
    description: raw.description,
    priceCents: raw.price_cents,
    lifetimePriceCents: raw.lifetime_price_cents,
    rentalDurationDays: raw.rental_duration_days,
    isLifetimeAvailable: raw.is_lifetime_available,
    isPublished: raw.is_published,
    tiktokNotes: raw.tiktok_notes,
    status: raw.status ?? 'available',
    genres: raw.genres ?? [],
    tags: raw.tags ?? [],
    releaseDate: raw.release_date,
    popularityScore: raw.popularity_score ?? 0,
    featured: Boolean(raw.featured),
    createdAt: raw.created_at,
    assets,
    upcoming,
  };
}

export async function fetchCatalog() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return loadLocalCatalog();
  }

  const { data, error } = await supabase
    .from('games')
    .select(GAME_SELECT)
    .eq('is_published', true)
    .order('popularity_score', { ascending: false });

  if (error) {
    console.warn('Falha ao carregar catálogo do Supabase, usando fallback estático.', error);
    return loadLocalCatalog();
  }

  if (!data || data.length === 0) {
    return loadLocalCatalog();
  }

  return data.map(mapGame);
}

export async function fetchGameBySlug(slug: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const localCatalog = await loadLocalCatalog();
    return localCatalog.find((game) => game.slug === slug) ?? null;
  }

  const { data, error } = await supabase
    .from('games')
    .select(GAME_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.warn('Falha ao carregar jogo do Supabase, usando fallback estático.', error);
    const localCatalog = await loadLocalCatalog();
    return localCatalog.find((game) => game.slug === slug) ?? null;
  }

  if (!data) {
    const localCatalog = await loadLocalCatalog();
    return localCatalog.find((game) => game.slug === slug) ?? null;
  }

  return mapGame(data);
}

export async function fetchActiveRentals(userId: string): Promise<RentalWithGame[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('rentals')
    .select(`id, user_id, game_id, starts_at, expires_at, status, payment_ref, mode, game:games(${GAME_SELECT})`)
    .eq('user_id', userId)
    .order('expires_at', { ascending: false });

  if (error) {
    throw new Error(`Falha ao buscar aluguéis: ${error.message}`);
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    userId: item.user_id,
    gameId: item.game_id,
    startsAt: item.starts_at,
    expiresAt: item.expires_at,
    status: (item.status as string) as RentalStatus,
    paymentRef: item.payment_ref,
    mode: (item.mode as CheckoutMode) ?? 'rental',
    game: item.game
      ? mapGame((Array.isArray(item.game) ? item.game[0] : item.game) as RawGame)
      : undefined,
  }));
}

export async function fetchPurchases(userId: string): Promise<PurchaseWithGame[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('purchases')
    .select(`id, user_id, game_id, purchased_at, payment_ref, game:games(${GAME_SELECT})`)
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false });

  if (error) {
    throw new Error(`Falha ao buscar compras: ${error.message}`);
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    userId: item.user_id,
    gameId: item.game_id,
    purchasedAt: item.purchased_at,
    paymentRef: item.payment_ref,
    game: item.game
      ? mapGame((Array.isArray(item.game) ? item.game[0] : item.game) as RawGame)
      : undefined,
  }));
}

export async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      emailReleaseAlerts: true,
      emailExpiryAlerts: true,
    };
  }

  const { data, error } = await supabase
    .from('user_notifications')
    .select('email_release_alerts, email_expiry_alerts')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao carregar preferências: ${error.message}`);
  }

  return {
    emailReleaseAlerts: Boolean(data?.email_release_alerts ?? true),
    emailExpiryAlerts: Boolean(data?.email_expiry_alerts ?? true),
  };
}

export interface CheckoutSessionResponse {
  sessionId: string;
  correlationId: string;
  valueCents: number;
  mode: CheckoutMode;
  expiresIn: number;
  gameTitle: string;
  rentalDurationDays: number;
  appId: string | null;
}

async function callWorker<T>(path: string, init: RequestInit & { token?: string } = {}) {
  if (!env.apiBaseUrl) {
    throw new Error('API base URL não configurada.');
  }

  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');

  if (init.token) {
    headers.set('Authorization', `Bearer ${init.token}`);
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Erro desconhecido na API');
  }

  return (await response.json()) as T;
}

export async function requestCheckoutSession(
  gameId: string,
  mode: CheckoutMode,
  token: string,
) {
  return callWorker<CheckoutSessionResponse>('/api/checkout/session', {
    method: 'POST',
    body: JSON.stringify({ gameId, mode }),
    token,
  });
}

export async function submitSupportTicket(
  input: { subject: string; message: string; turnstileToken?: string },
  token?: string,
) {
  return callWorker<{ ticketId: string }>('/api/support/ticket', {
    method: 'POST',
    body: JSON.stringify(input),
    ...(token ? { token } : {}),
  });
}

export async function subscribeToUpcoming(gameId: string, email?: string, token?: string) {
  return callWorker<{ status: string }>('/api/notify/upcoming', {
    method: 'POST',
    body: JSON.stringify({ gameId, email }),
    ...(token ? { token } : {}),
  });
}

export async function updateNotificationPreferences(
  prefs: NotificationPreferences,
  token: string,
) {
  return callWorker<{ status: string }>('/api/account/preferences', {
    method: 'POST',
    body: JSON.stringify(prefs),
    token,
  });
}
