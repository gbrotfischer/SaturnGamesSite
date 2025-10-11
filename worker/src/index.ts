const toJsonResponse = (status, data, origin, extraHeaders) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(origin),
      ...(extraHeaders || {}),
    },
  });

const toTextResponse = (status, text, origin) =>
  new Response(text, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...buildCorsHeaders(origin),
    },
  });

const buildCorsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-openpix-signature',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
});

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

const extractCustomerEmail = (body) => {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const candidates = [
    body.customerEmail,
    body.customer?.email,
    body.charge?.customer?.email,
    body.transaction?.customer?.email,
    body.data?.customer?.email,
    body.data?.charge?.customer?.email,
    body.payload?.customer?.email,
    body.eventData?.customer?.email,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toLowerCase();
    }
  }

  return null;
};

const handleWebhook = async (request, env, origin) => {
  if (request.method !== 'POST') {
    return toTextResponse(405, 'Method not allowed', origin);
  }

  const rawBody = await request.arrayBuffer();
  const signature = request.headers.get('x-openpix-signature');
  const secret = (env.OPENPIX_WEBHOOK_SECRET || '').trim();

  const signatureOk = await verifySignature(rawBody, signature, secret);
  if (!signatureOk) {
    console.warn('Webhook rejected because of signature mismatch');
    return toJsonResponse(401, { error: 'Invalid signature' }, origin);
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch (error) {
    console.error('Webhook payload is not valid JSON', error);
    return toJsonResponse(400, { error: 'Invalid JSON payload' }, origin);
  }

  const customerEmail = extractCustomerEmail(payload);
  if (!customerEmail) {
    console.warn('Webhook ignored because customer email was not found', payload);
    return toJsonResponse(200, { status: 'ignored', reason: 'missing_email' }, origin);
  }

  const performedBy = typeof payload.event === 'string' ? payload.event : 'openpix';

  const supabaseResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/payment_add_one_month_to_license`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ target_email: customerEmail, performed_by: performedBy }),
    },
  );

  if (!supabaseResponse.ok) {
    const errorBody = await supabaseResponse.text();
    console.error('Supabase RPC error', supabaseResponse.status, errorBody);
    return toJsonResponse(
      500,
      { error: 'Supabase RPC failed', details: errorBody || 'No body returned' },
      origin,
    );
  }

  return toJsonResponse(200, { status: 'processed', email: customerEmail }, origin);
};

export default {
  async fetch(request, env) {
    const origin = env.CORS_ALLOW_ORIGIN || '*';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...buildCorsHeaders(origin),
          'Content-Length': '0',
        },
      });
    }

    if (url.pathname === '/webhooks/openpix') {
      return handleWebhook(request, env, origin);
    }

    if (request.method === 'GET' && url.pathname === '/') {
      return toJsonResponse(200, { status: 'ok' }, origin);
    }

    return toJsonResponse(404, { error: 'Not found' }, origin);
  },
};
