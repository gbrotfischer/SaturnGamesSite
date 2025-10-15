import { getSupabaseClient, hasSupabaseCredentials } from './supabaseClient';
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
  stripe_price_id_rental,
  stripe_price_id_lifetime,
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
  stripe_price_id_rental: string | null;
  stripe_price_id_lifetime: string | null;
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
    stripePriceIdRental: raw.stripe_price_id_rental,
    stripePriceIdLifetime: raw.stripe_price_id_lifetime,
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

async function loadLocalCatalog() {
  const module = await import('../data/catalog');
  return module.localCatalog;
}

export async function fetchCatalog() {
  if (!hasSupabaseCredentials()) {
    return loadLocalCatalog();
  }

  const supabase = getSupabaseClient();
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
  if (!hasSupabaseCredentials()) {
    const localCatalog = await loadLocalCatalog();
    return localCatalog.find((game) => game.slug === slug) ?? null;
  }

  const supabase = getSupabaseClient();
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

  return mapGame(data as RawGame);
}

export async function fetchActiveRentals(userId: string): Promise<RentalWithGame[]> {
  if (!hasSupabaseCredentials()) {
    return [];
  }

  const supabase = getSupabaseClient();
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
  if (!hasSupabaseCredentials()) {
    return [];
  }

  const supabase = getSupabaseClient();
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
  if (!hasSupabaseCredentials()) {
    return {
      emailReleaseAlerts: true,
      emailExpiryAlerts: true,
    };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_notifications')
    .select('email_release_alerts, email_expiry_alerts')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao carregar preferências: ${error.message}`);
  }

  const prefs = (data as RawNotificationPrefs | null) ?? null;

  return {
    emailReleaseAlerts: Boolean(prefs?.email_release_alerts ?? true),
    emailExpiryAlerts: Boolean(prefs?.email_expiry_alerts ?? true),
  };
}

export type StripeCheckoutSession = {
  sessionId: string;
  url: string;
  expiresAt: string | null;
  paymentStatus?: string | null;
  gameId?: string | null;
};

export async function createCheckoutSession(args: {
  gameId: string;
  priceId: string;
  userId: string;
  email: string;
  mode: CheckoutMode;
  accessToken?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<StripeCheckoutSession> {
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(args.accessToken ? { Authorization: `Bearer ${args.accessToken}` } : {}),
    },
    body: JSON.stringify({
      gameId: args.gameId,
      priceId: args.priceId,
      userId: args.userId,
      email: args.email,
      mode: args.mode,
      successUrl: args.successUrl,
      cancelUrl: args.cancelUrl,
    }),
  });

  let payload: any = null;

  try {
    payload = await response.json();
  } catch (error) {
    throw new Error('Resposta inválida ao criar sessão de checkout.');
  }

  if (!response.ok) {
    const errorMessage = payload?.error ?? 'Erro ao criar sessão de checkout.';
    throw new Error(errorMessage);
  }

  const sessionId: string | undefined = payload?.sessionId ?? payload?.session_id;
  const checkoutUrl: string | undefined = payload?.url ?? payload?.checkoutUrl ?? payload?.checkout_url;

  if (!sessionId || !checkoutUrl) {
    throw new Error('Resposta do servidor não contém dados do checkout.');
  }

  return {
    sessionId,
    url: checkoutUrl,
    expiresAt: payload?.expiresAt ?? payload?.expires_at ?? null,
    paymentStatus: payload?.paymentStatus ?? payload?.payment_status ?? null,
    gameId: payload?.gameId ?? payload?.game_id ?? args.gameId,
  };
}

export async function verifyCheckoutSession(sessionId: string) {
  const response = await fetch(
    `/api/check-payment-status?session_id=${encodeURIComponent(sessionId)}`,
  );

  let payload: any = null;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error('Resposta inválida ao verificar checkout.');
  }

  if (!response.ok) {
    const message = payload?.error ?? 'Erro ao verificar status do checkout.';
    throw new Error(message);
  }

  const metadata =
    payload?.metadata ??
    payload?.session?.metadata ??
    (payload?.data && payload.data.metadata) ??
    null;

  const metadataGameId =
    metadata?.gameId ?? metadata?.game_id ?? metadata?.gameID ?? metadata?.['game-id'] ?? null;

  return {
    success: Boolean(payload?.success ?? payload?.ok ?? false),
    paymentStatus: payload?.paymentStatus ?? payload?.payment_status ?? 'pending',
    accessActive: Boolean(payload?.accessActive ?? payload?.access_active ?? false),
    expiresAt: payload?.expiresAt ?? payload?.expires_at ?? null,
    gameId: payload?.gameId ?? payload?.game_id ?? metadataGameId ?? null,
  };
}

export async function submitSupportTicket(
  input: { subject: string; message: string; turnstileToken?: string },
  _token?: string,
) {
  if (!hasSupabaseCredentials()) {
    throw new Error('Supabase não configurado para registrar chamados.');
  }

  const supabase = getSupabaseClient();
  const payload: Record<string, unknown> = {
    subject: input.subject,
    message: input.message,
  };

  const { data: authData } = await supabase.auth.getUser();
  if (authData?.user?.id) {
    payload.user_id = authData.user.id;
  }

  const { data, error } = await supabase.from('tickets_support').insert(payload).select('id').single();

  if (error) {
    throw new Error(error.message ?? 'Não foi possível registrar o chamado.');
  }

  return { ticketId: data.id as string };
}

export async function subscribeToUpcoming(gameId: string, email?: string, _token?: string) {
  if (!hasSupabaseCredentials()) {
    throw new Error('Supabase não configurado para registrar interesse.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('releases_upcoming')
    .select('id, notify_list')
    .eq('game_id', gameId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Não foi possível registrar interesse.');
  }

  const list = new Set<string>((data?.notify_list as string[] | null) ?? []);
  if (email) {
    list.add(email.toLowerCase());
  }

  if (!data) {
    throw new Error('Jogo não encontrado na lista de lançamentos.');
  }

  const { error: updateError } = await supabase
    .from('releases_upcoming')
    .update({ notify_list: Array.from(list) })
    .eq('id', data.id);

  if (updateError) {
    throw new Error(updateError.message ?? 'Não foi possível atualizar a lista de interesse.');
  }

  return { status: 'ok' };
}

export async function updateNotificationPreferences(prefs: NotificationPreferences, _token: string) {
  if (!hasSupabaseCredentials()) {
    throw new Error('Supabase não configurado.');
  }

  const supabase = getSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user?.id) {
    throw new Error('É necessário estar autenticado para salvar preferências.');
  }

  const { error } = await supabase.from('user_notifications').upsert({
    user_id: authData.user.id,
    email_release_alerts: prefs.emailReleaseAlerts,
    email_expiry_alerts: prefs.emailExpiryAlerts,
  });

  if (error) {
    throw new Error(error.message ?? 'Não foi possível salvar as preferências.');
  }

  return { status: 'ok' };
}
