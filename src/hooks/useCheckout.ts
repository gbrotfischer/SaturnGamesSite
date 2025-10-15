import { useCallback, useMemo, useState } from 'react';
import type { CheckoutMode, Game } from '../types';
import { createCheckoutSession } from '../lib/api';

type StartCheckoutArgs = {
  game: Game;
  mode: CheckoutMode;
  priceId: string;
  user: { id: string; email: string; fullName?: string | null };
  accessToken?: string;
  successUrl?: string;
  cancelUrl?: string;
};

export type CheckoutStatus = 'idle' | 'processing' | 'redirecting' | 'error';

export type StoredCheckout = {
  sessionId: string;
  gameId: string;
  priceId: string;
  mode: CheckoutMode;
  timestamp: number;
  createdAt?: number;
};

const STORAGE_KEY = 'checkout_pending';
const LEGACY_STORAGE_KEY = 'sgs_stripe_checkout';

function persistCheckout(value: Omit<StoredCheckout, 'timestamp' | 'createdAt'>) {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredCheckout = {
      ...value,
      timestamp: Date.now(),
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    console.warn('Não foi possível persistir o checkout localmente.', error);
  }
}

export function readStoredCheckout(): StoredCheckout | null {
  if (typeof window === 'undefined') return null;
  const parse = (raw: string | null) => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredCheckout>;
      if (!parsed?.sessionId || !parsed?.gameId) {
        return null;
      }
      return {
        sessionId: parsed.sessionId,
        gameId: parsed.gameId,
        priceId: parsed.priceId ?? '',
        mode: (parsed.mode ?? 'rental') as CheckoutMode,
        timestamp: parsed.timestamp ?? parsed.createdAt ?? Date.now(),
        createdAt: parsed.createdAt,
      } satisfies StoredCheckout;
    } catch (error) {
      console.warn('Não foi possível ler o checkout pendente.', error);
      return null;
    }
  };

  const current = parse(window.sessionStorage.getItem(STORAGE_KEY));
  if (current) return current;
  const legacy = parse(window.sessionStorage.getItem(LEGACY_STORAGE_KEY));
  if (legacy) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
      window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      console.warn('Não foi possível migrar o checkout pendente legado.', error);
    }
    return legacy;
  }

  return null;
}

export function clearStoredCheckout() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    console.warn('Não foi possível remover o checkout pendente.', error);
  }
}

export function useCheckout() {
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const pendingCheckout = useMemo(() => readStoredCheckout(), [status]);

  const startCheckout = useCallback(
    async ({ game, mode, priceId, user, accessToken, successUrl, cancelUrl }: StartCheckoutArgs) => {
      if (!priceId) {
        throw new Error('Preço do Stripe não configurado para este jogo.');
      }

      setStatus('processing');
      setError(null);

      try {
        const session = await createCheckoutSession({
          gameId: game.id,
          priceId,
          userId: user.id,
          email: user.email,
          mode,
          accessToken,
          successUrl,
          cancelUrl,
        });

        persistCheckout({
          sessionId: session.sessionId,
          gameId: game.id,
          priceId,
          mode,
        });

        setStatus('redirecting');
        window.location.href = session.url;
      } catch (err: any) {
        const message = err?.message ?? 'Não foi possível iniciar o checkout.';
        setError(message);
        setStatus('error');
        throw err;
      }
    },
    [],
  );

  const resetError = useCallback(() => {
    setError(null);
    setStatus('idle');
  }, []);

  return {
    status,
    error,
    pendingCheckout,
    startCheckout,
    resetError,
    clearStoredCheckout,
  } as const;
}
