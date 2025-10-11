export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENPIX_SECRET_KEY: string;
  OPENPIX_WEBHOOK_SECRET?: string;
  OPENPIX_APP_ID?: string;
  OPENPIX_API_BASE?: string;
  CORS_ALLOW_ORIGIN?: string;
}

type ChargeRequest = {
  amount: number;
  planId: string;
  customerEmail: string;
  description?: string;
};

type OpenPixChargeResponse = {
  charge?: {
    correlationID?: string;
    id?: string;
    brCode?: string;
    image?: string;
    imageBase64?: string;
    link?: string;
    expiresDate?: string;
    status?: string;
    value?: number;
    transaction?: {
      brCode?: string;
      link?: string;
      expiresDate?: string;
      image?: string;
    };
    customer?: {
      email?: string;
    };
    additionalInfo?: Array<{ key: string; value: string }>;
  };
  transaction?: {
    brCode?: string;
    link?: string;
    image?: string;
    expiresDate?: string;
    customer?: { email?: string };
  };
  brCode?: string;
  link?: string;
  image?: string;
};

type PixChargePayload = {
  copyPaste: string;
  qrCodeImageUrl?: string;
  expiresAt?: string;
  chargeId?: string;
  checkoutUrl?: string;
};

const DEFAULT_OPENPIX_ENDPOINT = 'https://api.openpix.com.br/api/openpix/charge';

const corsHeaders = (origin?: string) => ({
  'Access-Control-Allow-Origin': origin ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-openpix-app-id',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
});

const jsonResponse = (status: number, data: unknown, origin?: string, extraHeaders?: HeadersInit) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
      ...(extraHeaders ?? {}),
    },
  });

const textResponse = (status: number, text: string, origin?: string) =>
  new Response(text, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...corsHeaders(origin),
    },
  });

async function handleCharges(request: Request, env: Env, origin?: string) {
  if (request.method !== 'POST') {
    return textResponse(405, 'Method not allowed', origin);
  }

  const body = (await request.json().catch(() => null)) as ChargeRequest | null;
  if (!body) {
    return jsonResponse(400, { error: 'Invalid JSON body' }, origin);
  }

  const { amount, planId, customerEmail, description } = body;

  if (!customerEmail) {
    return jsonResponse(400, { error: 'customerEmail is required' }, origin);
  }

  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return jsonResponse(400, { error: 'amount must be a positive number (cents)' }, origin);
  }

  if (!planId) {
    return jsonResponse(400, { error: 'planId is required' }, origin);
  }

  const openpixUrl = env.OPENPIX_API_BASE?.replace(/\/$/, '') || DEFAULT_OPENPIX_ENDPOINT;

  const payload = {
    correlationID: crypto.randomUUID(),
    value: amount,
    comment: description ?? `Plano ${planId}`,
    customer: {
      email: customerEmail,
    },
    additionalInfo: [
      { key: 'planId', value: planId },
    ],
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.OPENPIX_SECRET_KEY}`,
  };

  if (env.OPENPIX_APP_ID) {
    headers['x-openpix-app-id'] = env.OPENPIX_APP_ID;
  }

  const response = await fetch(openpixUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error('OpenPix error', response.status, text);
    return jsonResponse(
      502,
      {
        error: 'Failed to create charge with OpenPix',
        details: text || 'No response body',
      },
      origin,
    );
  }

  const json = (text ? (JSON.parse(text) as OpenPixChargeResponse) : {}) ?? {};

  const charge = json.charge ?? json.transaction ?? {};

  const result: PixChargePayload = {
    copyPaste: charge.brCode ?? json.brCode ?? '',
    qrCodeImageUrl: charge.image ?? json.image ?? undefined,
    expiresAt: charge.expiresDate ?? json.charge?.expiresDate ?? json.transaction?.expiresDate,
    chargeId: charge.id ?? json.charge?.id ?? json.charge?.correlationID,
    checkoutUrl: charge.link ?? json.link ?? json.charge?.link ?? json.transaction?.link,
  };

  if (!result.copyPaste) {
    console.warn('OpenPix response missing brCode', json);
  }

  return jsonResponse(200, result, origin);
}

async function verifySignature(rawBody: ArrayBuffer, providedSignature: string | null, secret: string) {
  if (!providedSignature) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);

  const signatureBytes = decodeSignature(providedSignature.trim());
  if (!signatureBytes) {
    return false;
  }

  const expected = await crypto.subtle.sign('HMAC', key, rawBody);
  return timingSafeEqual(new Uint8Array(expected), signatureBytes);
}

function decodeSignature(signature: string): Uint8Array | null {
  if (!signature) return null;
  try {
    if (/^[0-9a-fA-F]+$/.test(signature) && signature.length % 2 === 0) {
      const bytes = new Uint8Array(signature.length / 2);
      for (let i = 0; i < signature.length; i += 2) {
        bytes[i / 2] = parseInt(signature.slice(i, i + 2), 16);
      }
      return bytes;
    }
    const binary = atob(signature);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error('Failed to decode signature', error);
    return null;
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

function extractCustomerEmail(body: any): string | null {
  if (!body) return null;

  const candidates = [
    body.customerEmail,
    body.customer?.email,
    body.charge?.customer?.email,
    body.transaction?.customer?.email,
    body.data?.customer?.email,
    body.data?.charge?.customer?.email,
    body.payload?.customer?.email,
    body?.eventData?.customer?.email,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string') {
      return candidate.toLowerCase();
    }
  }

  return null;
}

async function handleWebhook(request: Request, env: Env, origin?: string) {
  if (request.method !== 'POST') {
    return textResponse(405, 'Method not allowed', origin);
  }

  const rawBody = await request.arrayBuffer();
  const signature = request.headers.get('x-openpix-signature');
  const secret = env.OPENPIX_WEBHOOK_SECRET || env.OPENPIX_SECRET_KEY;

  if (secret) {
    const valid = await verifySignature(rawBody, signature, secret);
    if (!valid) {
      console.warn('Invalid webhook signature');
      return jsonResponse(401, { error: 'Invalid signature' }, origin);
    }
  }

  let parsed: any = {};
  try {
    parsed = JSON.parse(new TextDecoder().decode(rawBody));
  } catch (error) {
    console.error('Failed to parse webhook body', error);
    return jsonResponse(400, { error: 'Invalid JSON payload' }, origin);
  }

  const customerEmail = extractCustomerEmail(parsed);
  if (!customerEmail) {
    console.warn('Webhook without customer email', parsed);
    return jsonResponse(200, { status: 'ignored', reason: 'missing_email' }, origin);
  }

  const performedBy = parsed.event || parsed.eventType || 'openpix';

  const supabaseResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/payment_add_one_month_to_license`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ target_email: customerEmail, performed_by: performedBy }),
  });

  if (!supabaseResponse.ok) {
    const errorBody = await supabaseResponse.text();
    console.error('Supabase RPC error', supabaseResponse.status, errorBody);
    return jsonResponse(500, { error: 'Supabase RPC failed', details: errorBody }, origin);
  }

  return jsonResponse(200, { status: 'processed', email: customerEmail }, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.CORS_ALLOW_ORIGIN;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(origin),
          'Content-Length': '0',
        },
      });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/charges') {
        return await handleCharges(request, env, origin);
      }

      if (url.pathname === '/webhooks/openpix') {
        return await handleWebhook(request, env, origin);
      }

      if (url.pathname === '/' && request.method === 'GET') {
        return jsonResponse(200, { status: 'ok' }, origin);
      }

      return jsonResponse(404, { error: 'Not found' }, origin);
    } catch (error: any) {
      console.error('Worker unhandled error', error);
      return jsonResponse(500, { error: 'Internal error', details: error?.message ?? String(error) }, origin);
    }
  },
};
