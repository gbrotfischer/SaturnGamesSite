const buildCorsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-openpix-signature',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
});

const jsonResponse = (status, payload, origin, extraHeaders) =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(origin),
      ...(extraHeaders || {}),
    },
  });

const textResponse = (status, text, origin, extraHeaders) =>
  new Response(text, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...buildCorsHeaders(origin),
      ...(extraHeaders || {}),
    },
  });

const parseJsonBody = async (request) => {
  try {
    return await request.json();
  } catch (error) {
    throw new Error('invalid_json');
  }
};

const supabaseServiceRequest = async (env, path, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`supabase_error:${response.status}:${errorText}`);
  }

  return response;
};

const authenticateUser = async (request, env) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('unauthorized');
  }

  const token = authHeader.slice(7);
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) {
    throw new Error('unauthorized');
  }

  const user = await response.json();
  return { token, user };
};

const fetchGame = async (env, gameId) => {
  const response = await supabaseServiceRequest(
    env,
    `/rest/v1/games?id=eq.${encodeURIComponent(gameId)}&select=id,title,slug,price_cents,lifetime_price_cents,rental_duration_days,is_lifetime_available,status`,
    { method: 'GET' },
  );
  const data = await response.json();
  return data?.[0] ?? null;
};

const addDays = (date, days) => {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
};

const generateCorrelationId = (gameId, userId, sessionId) =>
  `game_${gameId}__user_${userId}__session_${sessionId}`;

const parseCorrelationId = (correlationId) => {
  if (typeof correlationId !== 'string') return {};
  const parts = correlationId.split('__');
  const result = {};
  for (const part of parts) {
    const [key, ...valueParts] = part.split('_');
    result[key] = valueParts.join('_');
  }
  return {
    gameId: result.game,
    userId: result.user,
    sessionId: result.session,
  };
};

const extractCorrelationId = (payload) => {
  const candidates = [
    payload?.correlationID,
    payload?.charge?.correlationID,
    payload?.data?.charge?.correlationID,
    payload?.transaction?.correlationID,
    payload?.eventData?.charge?.correlationID,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
};

const extractCustomerEmail = (body) => {
  const candidates = [
    body?.customerEmail,
    body?.customer?.email,
    body?.charge?.customer?.email,
    body?.transaction?.customer?.email,
    body?.data?.customer?.email,
    body?.data?.charge?.customer?.email,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toLowerCase();
    }
  }
  return null;
};

const extractPaymentReference = (payload) =>
  payload?.transaction?.id || payload?.charge?.id || payload?.data?.transaction?.id || payload?.id || null;

const decodeSignature = (signature) => {
  if (!signature) return null;
  const trimmed = signature.trim();
  try {
    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
      const out = new Uint8Array(trimmed.length / 2);
      for (let i = 0; i < trimmed.length; i += 2) {
        out[i / 2] = parseInt(trimmed.slice(i, i + 2), 16);
      }
      return out;
    }

    const binary = atob(trimmed);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch (error) {
    console.error('Failed to decode signature', error);
    return null;
  }
};

const timingSafeEqual = (a, b) => {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
};

const verifySignature = async (rawBody, providedSignature, secret) => {
  if (!providedSignature || !secret) {
    return true;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );

  const decoded = decodeSignature(providedSignature);
  if (!decoded) {
    return false;
  }

  const expected = await crypto.subtle.sign('HMAC', key, rawBody);
  return timingSafeEqual(new Uint8Array(expected), decoded);
};

const handleCheckoutSession = async (request, env, origin) => {
  const { user } = await authenticateUser(request, env);
  const body = await parseJsonBody(request);
  const gameId = body?.gameId;
  const mode = body?.mode === 'lifetime' ? 'lifetime' : 'rental';

  if (!gameId) {
    return jsonResponse(400, { error: 'gameId_required' }, origin);
  }

  const game = await fetchGame(env, gameId);
  if (!game) {
    return jsonResponse(404, { error: 'game_not_found' }, origin);
  }

  if (game.status === 'coming_soon' && mode === 'rental') {
    return jsonResponse(409, { error: 'game_unavailable' }, origin);
  }

  if (mode === 'lifetime' && !game.is_lifetime_available) {
    return jsonResponse(409, { error: 'lifetime_not_available' }, origin);
  }

  const sessionId = crypto.randomUUID();
  const correlationId = generateCorrelationId(game.id, user.id, sessionId);
  const valueCents = mode === 'lifetime' ? game.lifetime_price_cents ?? game.price_cents : game.price_cents;
  const expiresIn = 1800;

  await supabaseServiceRequest(env, '/rest/v1/checkout_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: sessionId,
      user_id: user.id,
      game_id: game.id,
      mode,
      amount_cents: valueCents,
      status: 'pending',
      correlation_id: correlationId,
    }),
  });

  return jsonResponse(
    200,
    {
      sessionId,
      correlationId,
      valueCents,
      mode,
      expiresIn,
      gameTitle: game.title,
      rentalDurationDays: game.rental_duration_days,
      appId: env.OPENPIX_APP_ID || null,
    },
    origin,
  );
};

const handleSupportTicket = async (request, env, origin) => {
  let userData = null;
  try {
    userData = await authenticateUser(request, env);
  } catch (error) {
    userData = null;
  }

  const body = await parseJsonBody(request);
  if (!body?.subject || !body?.message) {
    return jsonResponse(400, { error: 'subject_and_message_required' }, origin);
  }

  const ticketId = crypto.randomUUID();
  await supabaseServiceRequest(env, '/rest/v1/tickets_support', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: ticketId,
      user_id: userData?.user?.id ?? null,
      subject: body.subject,
      message: body.message,
    }),
  });

  return jsonResponse(200, { ticketId }, origin);
};

const handleNotifyUpcoming = async (request, env, origin) => {
  let userData = null;
  try {
    userData = await authenticateUser(request, env);
  } catch (error) {
    userData = null;
  }

  const body = await parseJsonBody(request);
  if (!body?.gameId) {
    return jsonResponse(400, { error: 'gameId_required' }, origin);
  }

  const email = body?.email || userData?.user?.email;
  if (!email) {
    return jsonResponse(400, { error: 'email_required' }, origin);
  }

  const selectResponse = await supabaseServiceRequest(
    env,
    `/rest/v1/releases_upcoming?game_id=eq.${encodeURIComponent(body.gameId)}&select=id,notify_list`,
    { method: 'GET' },
  );
  const existing = await selectResponse.json();
  const notifyList = new Set(existing?.[0]?.notify_list ?? []);
  notifyList.add(email.toLowerCase());

  if (existing?.length) {
    await supabaseServiceRequest(env, `/rest/v1/releases_upcoming?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ notify_list: Array.from(notifyList) }),
    });
  } else {
    await supabaseServiceRequest(env, '/rest/v1/releases_upcoming', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ game_id: body.gameId, notify_list: Array.from(notifyList) }),
    });
  }

  return jsonResponse(200, { status: 'subscribed' }, origin);
};

const handleUpdatePreferences = async (request, env, origin) => {
  const { user } = await authenticateUser(request, env);
  const body = await parseJsonBody(request);

  await supabaseServiceRequest(env, '/rest/v1/user_notifications', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: user.id,
      email_release_alerts: Boolean(body?.emailReleaseAlerts),
      email_expiry_alerts: Boolean(body?.emailExpiryAlerts),
    }),
  });

  return jsonResponse(200, { status: 'saved' }, origin);
};

const handleWebhook = async (request, env, origin) => {
  const rawBody = await request.arrayBuffer();
  const signature = request.headers.get('x-openpix-signature');
  const secret = (env.OPENPIX_WEBHOOK_SECRET || '').trim();

  const signatureOk = await verifySignature(rawBody, signature, secret);
  if (!signatureOk) {
    return jsonResponse(401, { error: 'invalid_signature' }, origin);
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch (error) {
    return jsonResponse(400, { error: 'invalid_json' }, origin);
  }

  const eventType = payload?.event || payload?.type || payload?.eventType;
  if (eventType && !`${eventType}`.toLowerCase().includes('completed')) {
    return jsonResponse(200, { status: 'ignored', reason: 'event_type' }, origin);
  }

  const correlationId = extractCorrelationId(payload);
  if (!correlationId) {
    return jsonResponse(200, { status: 'ignored', reason: 'missing_correlation' }, origin);
  }

  const { gameId, userId, sessionId } = parseCorrelationId(correlationId);
  if (!gameId || !userId || !sessionId) {
    return jsonResponse(200, { status: 'ignored', reason: 'invalid_correlation' }, origin);
  }

  const sessionResponse = await supabaseServiceRequest(
    env,
    `/rest/v1/checkout_sessions?select=id,user_id,game_id,mode,status,amount_cents,game:games(rental_duration_days,is_lifetime_available)&correlation_id=eq.${encodeURIComponent(
      correlationId,
    )}`,
    { method: 'GET' },
  );
  const sessionRows = await sessionResponse.json();
  const session = sessionRows?.[0];
  if (!session) {
    return jsonResponse(200, { status: 'ignored', reason: 'session_not_found' }, origin);
  }

  if (session.status === 'paid') {
    return jsonResponse(200, { status: 'already_processed' }, origin);
  }

  const paymentRef = extractPaymentReference(payload);

  await supabaseServiceRequest(env, `/rest/v1/checkout_sessions?id=eq.${session.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'paid', payment_ref: paymentRef }),
  });

  if (session.mode === 'lifetime') {
    const existingPurchaseResponse = await supabaseServiceRequest(
      env,
      `/rest/v1/purchases?user_id=eq.${encodeURIComponent(userId)}&game_id=eq.${encodeURIComponent(gameId)}&select=id`,
      { method: 'GET' },
    );
    const existing = await existingPurchaseResponse.json();
    if (existing?.length) {
      await supabaseServiceRequest(env, `/rest/v1/purchases?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ payment_ref: paymentRef }),
      });
    } else {
      await supabaseServiceRequest(env, '/rest/v1/purchases', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: userId,
          game_id: gameId,
          payment_ref: paymentRef,
        }),
      });
    }
  } else {
    const rentalsResponse = await supabaseServiceRequest(
      env,
      `/rest/v1/rentals?user_id=eq.${encodeURIComponent(userId)}&game_id=eq.${encodeURIComponent(gameId)}&status=eq.active`,
      { method: 'GET' },
    );
    const rentalRows = await rentalsResponse.json();
    const duration = session.game?.rental_duration_days ?? 30;
    const now = new Date();
    let expiresAt = addDays(now, duration);

    if (rentalRows?.length) {
      const current = rentalRows[0];
      if (current.expires_at && new Date(current.expires_at) > now) {
        expiresAt = addDays(new Date(current.expires_at), duration);
      }
      await supabaseServiceRequest(env, `/rest/v1/rentals?id=eq.${current.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ expires_at: expiresAt.toISOString(), payment_ref: paymentRef, status: 'active' }),
      });
    } else {
      await supabaseServiceRequest(env, '/rest/v1/rentals', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: userId,
          game_id: gameId,
          starts_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          payment_ref: paymentRef,
          status: 'active',
          mode: 'rental',
        }),
      });
    }
  }

  const customerEmail = extractCustomerEmail(payload);
  return jsonResponse(200, { status: 'processed', correlationId, email: customerEmail }, origin);
};

const handleRequest = async (request, env) => {
  const requestOrigin = request.headers.get('Origin') || undefined;
  const allowedOrigin = env.CORS_ALLOW_ORIGIN || requestOrigin || '*';
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...buildCorsHeaders(allowedOrigin),
        'Content-Length': '0',
      },
    });
  }

  if (request.method === 'GET' && url.pathname === '/') {
    return jsonResponse(
      200,
      {
        status: 'ok',
        supabaseConfigured:
          Boolean(env.SUPABASE_URL) && Boolean(env.SUPABASE_SERVICE_ROLE_KEY) && Boolean(env.SUPABASE_ANON_KEY),
        secretConfigured: Boolean(env.OPENPIX_WEBHOOK_SECRET),
        timestamp: new Date().toISOString(),
      },
      allowedOrigin,
    );
  }

  if (request.method === 'GET' && url.pathname === '/healthz') {
    return textResponse(200, 'ok', allowedOrigin);
  }

  if (url.pathname === '/api/checkout/session' && request.method === 'POST') {
    return handleCheckoutSession(request, env, allowedOrigin);
  }

  if (url.pathname === '/api/support/ticket' && request.method === 'POST') {
    return handleSupportTicket(request, env, allowedOrigin);
  }

  if (url.pathname === '/api/notify/upcoming' && request.method === 'POST') {
    return handleNotifyUpcoming(request, env, allowedOrigin);
  }

  if (url.pathname === '/api/account/preferences' && request.method === 'POST') {
    return handleUpdatePreferences(request, env, allowedOrigin);
  }

  if (url.pathname === '/webhooks/openpix') {
    if (request.method === 'POST') {
      return handleWebhook(request, env, allowedOrigin);
    }

    if (request.method === 'GET') {
      return jsonResponse(
        200,
        {
          status: 'listening',
          message: 'Envie um POST com o payload do webhook da OpenPix para processar pagamentos.',
        },
        allowedOrigin,
      );
    }

    return textResponse(405, 'Method not allowed', allowedOrigin, { Allow: 'GET,POST,OPTIONS' });
  }

  return jsonResponse(404, { error: 'not_found' }, allowedOrigin);
};

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error('Worker unhandled exception', error);
      const allowedOrigin = env?.CORS_ALLOW_ORIGIN || '*';
      const message = error instanceof Error ? error.message : 'unknown_error';
      const status = message === 'unauthorized' ? 401 : message === 'invalid_json' ? 400 : 500;
      return jsonResponse(status, { error: message }, allowedOrigin);
    }
  },
};
