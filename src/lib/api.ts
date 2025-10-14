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

  return mapGame(data);
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

  return {
    emailReleaseAlerts: Boolean(data?.email_release_alerts ?? true),
    emailExpiryAlerts: Boolean(data?.email_expiry_alerts ?? true),
  };
}

export type CheckoutSessionRecord = {
  sessionId: string;
  correlationId: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  amountCents: number;
  expiresAt?: string | null;
  gameId?: string | null;
  mode?: CheckoutMode;
  rentalDurationDays?: number | null;
  qrCodeImage?: string | null;
  paymentLinkUrl?: string | null;
  paymentRef?: string | null;
};

export async function createCheckoutSession(args: {
  gameId: string;
  mode: CheckoutMode;
  userId: string;
  email: string;
  amountCents: number;
  rentalDurationDays?: number;
}): Promise<CheckoutSessionRecord> {
  if (!hasSupabaseCredentials()) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_ANON_KEY para processar pagamentos.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('openpix-create-session', {
    body: {
      user_id: args.userId,
      email: args.email,
      game_id: args.gameId,
      amount: args.amountCents,
      mode: args.mode,
      rental_duration_days: args.rentalDurationDays,
    },
  });

  if (error) {
    throw new Error(error.message ?? 'Falha ao criar sessão de pagamento.');
  }

  if (!data || (!data.ok && data.error)) {
    throw new Error(data?.error ?? 'Falha ao criar sessão de pagamento.');
  }

  const payload = data.session ?? data;
  const openpix = data.openpix ?? {};

  const sessionId = payload.session_id ?? payload.id;
  if (!sessionId) {
    throw new Error('Resposta inválida do servidor: session_id ausente.');
  }

  const correlationId =
    payload.metadata?.correlation_id ?? payload.correlation_id ?? payload.session_id ?? sessionId;
  const amountCents =
    payload.amount_cents ?? payload.amount ?? data.amount ?? args.amountCents ?? 0;
  const status = (payload.status as CheckoutSessionRecord['status']) ?? 'pending';

  return {
    sessionId,
    correlationId,
    status,
    amountCents,
    expiresAt: payload.expires_at ?? payload.expiration ?? null,
    gameId: payload.game_id ?? args.gameId,
    mode: payload.mode ?? args.mode,
    rentalDurationDays: payload.rental_duration_days ?? args.rentalDurationDays ?? null,
    qrCodeImage: openpix.qrCodeImage ?? openpix.qr_code_image ?? null,
    paymentLinkUrl: openpix.paymentLinkUrl ?? openpix.payment_link_url ?? openpix.checkoutUrl ?? null,
    paymentRef: payload.payment_ref ?? null,
  };
}

export async function fetchCheckoutSession(sessionId: string): Promise<CheckoutSessionRecord | null> {
  if (!hasSupabaseCredentials()) {
    throw new Error('Supabase não configurado.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('checkout_sessions')
    .select('session_id, status, payment_ref, metadata, expires_at, game_id, mode, amount_cents, amount, rental_duration_days')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Não foi possível consultar a sessão.');
  }

  if (!data) {
    return null;
  }

  const amount = data.amount_cents ?? data.amount ?? 0;
  const correlationId =
    data.metadata?.correlation_id ?? data.correlation_id ?? data.session_id ?? sessionId;

  return {
    sessionId: data.session_id ?? sessionId,
    correlationId,
    status: (data.status as CheckoutSessionRecord['status']) ?? 'pending',
    amountCents: amount,
    expiresAt: data.expires_at ?? null,
    gameId: data.game_id ?? null,
    mode: data.mode ?? 'rental',
    rentalDurationDays: data.rental_duration_days ?? null,
    paymentRef: data.payment_ref ?? null,
  };
}

export async function submitSupportTicket(
  input: { subject: string; message: string; turnstileToken?: string },
  token?: string,
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
