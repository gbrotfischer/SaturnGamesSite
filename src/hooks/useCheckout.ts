import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createCheckoutSession,
  fetchActiveRentals,
  fetchCheckoutSession,
  fetchCheckoutPaymentArtifacts,
} from '../lib/api';
import type { CheckoutMode, Game, RentalWithGame } from '../types';

export type CheckoutStatus = 'idle' | 'creating' | 'pending' | 'paid' | 'expired' | 'error';

export type CheckoutSessionData = {
  sessionId: string;
  correlationId: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  expiresAt: string | null;
  amountCents: number;
  mode: CheckoutMode;
  gameId: string;
  rentalDurationDays: number | null;
  qrCodeImage?: string | null;
  paymentLinkUrl?: string | null;
  paymentRef?: string | null;
};

type StartCheckoutArgs = {
  game: Game;
  mode: CheckoutMode;
  user: { id: string; email: string; fullName?: string | null };
};

type ResumeCheckoutArgs = {
  game: Game;
  mode: CheckoutMode;
  userId: string;
};

const STORAGE_PREFIX = 'sgs_checkout';

const storageKey = (gameId: string, mode: CheckoutMode) => `${STORAGE_PREFIX}:${gameId}:${mode}`;

const persistSession = (session: CheckoutSessionData) => {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      ...session,
      storedAt: Date.now(),
    };
    window.sessionStorage.setItem(storageKey(session.gameId, session.mode), JSON.stringify(payload));
  } catch (error) {
    console.warn('Não foi possível persistir a sessão de checkout.', error);
  }
};

const readStoredSession = (gameId: string, mode: CheckoutMode): CheckoutSessionData | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(gameId, mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutSessionData & { storedAt?: number };
    if (parsed.expiresAt) {
      const expiresAt = new Date(parsed.expiresAt);
      if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
        window.sessionStorage.removeItem(storageKey(gameId, mode));
        return null;
      }
    }
    return parsed;
  } catch (error) {
    console.warn('Não foi possível ler a sessão de checkout armazenada.', error);
    return null;
  }
};

const clearStoredSession = (gameId: string, mode: CheckoutMode) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(storageKey(gameId, mode));
  } catch (error) {
    console.warn('Não foi possível remover a sessão de checkout armazenada.', error);
  }
};

export function useCheckout() {
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [sessionData, setSessionData] = useState<CheckoutSessionData | null>(null);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [activeMode, setActiveMode] = useState<CheckoutMode>('rental');
  const [error, setError] = useState<string | null>(null);
  const [rental, setRental] = useState<RentalWithGame | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const contextRef = useRef<{ gameId: string; mode: CheckoutMode; userId: string } | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const sessionRef = useRef<CheckoutSessionData | null>(null);
  const artifactAttemptsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sessionRef.current = sessionData;
  }, [sessionData]);

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const ensurePaymentArtifacts = useCallback(
    async (snapshot?: CheckoutSessionData | null) => {
      const target = snapshot ?? sessionRef.current;
      if (!target || !target.correlationId || target.qrCodeImage) {
        return;
      }

      const attemptKey = `${target.sessionId}:${target.correlationId}`;
      if (artifactAttemptsRef.current.has(attemptKey)) {
        return;
      }

      artifactAttemptsRef.current.add(attemptKey);

      try {
        const details = await fetchCheckoutPaymentArtifacts(target.correlationId);
        if (!details) {
          artifactAttemptsRef.current.delete(attemptKey);
          return;
        }

        let updated: CheckoutSessionData | null = null;
        setSessionData((previous) => {
          if (!previous || previous.sessionId !== target.sessionId) {
            return previous;
          }

          const next: CheckoutSessionData = {
            ...previous,
            qrCodeImage: details.qrCodeImage ?? previous.qrCodeImage ?? null,
            paymentLinkUrl: details.paymentLinkUrl ?? previous.paymentLinkUrl ?? null,
          };

          updated = next;
          return next;
        });

        if (updated) {
          sessionRef.current = updated;
          persistSession(updated);
        }
      } catch (fetchError) {
        console.warn('Não foi possível obter detalhes do Pix na OpenPix.', fetchError);
        artifactAttemptsRef.current.delete(attemptKey);
      }
    },
    [],
  );

  const refreshSession = useCallback(async () => {
    const context = contextRef.current;
    const currentSession = sessionRef.current;
    if (!context || !currentSession) {
      return;
    }

    try {
      const latest = await fetchCheckoutSession(currentSession.sessionId);
      if (!latest) {
        throw new Error('Sessão não encontrada.');
      }

      const nextSession: CheckoutSessionData = {
        ...currentSession,
        status: latest.status,
        expiresAt: latest.expiresAt ?? currentSession.expiresAt,
        paymentRef: latest.paymentRef ?? currentSession.paymentRef ?? null,
        qrCodeImage: latest.qrCodeImage ?? currentSession.qrCodeImage ?? null,
        paymentLinkUrl: latest.paymentLinkUrl ?? currentSession.paymentLinkUrl ?? null,
      };

      setSessionData(nextSession);
      sessionRef.current = nextSession;
      persistSession(nextSession);

      const attemptKey = `${nextSession.sessionId}:${nextSession.correlationId}`;
      artifactAttemptsRef.current.delete(attemptKey);
      if (!nextSession.qrCodeImage) {
        void ensurePaymentArtifacts(nextSession);
      }

      if (latest.status === 'paid') {
        const rentals = await fetchActiveRentals(context.userId);
        const rentalMatch = rentals.find((entry) => entry.gameId === context.gameId) ?? null;
        if (rentalMatch) {
          setRental(rentalMatch);
        }
        setStatus('paid');
        clearPolling();
        clearStoredSession(context.gameId, context.mode);
      } else if (latest.status === 'expired' || latest.status === 'cancelled') {
        setStatus('expired');
        clearPolling();
        clearStoredSession(context.gameId, context.mode);
      } else {
        setStatus('pending');
        artifactAttemptsRef.current.delete(attemptKey);
      }
    } catch (requestError: any) {
      const message = requestError?.message ?? 'Erro ao atualizar status da cobrança.';
      setError(message);
    }
  }, [clearPolling, ensurePaymentArtifacts]);

  const startPolling = useCallback(() => {
    clearPolling();
    pollTimerRef.current = window.setInterval(() => {
      void refreshSession();
    }, 4000);
  }, [clearPolling, refreshSession]);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  const startCheckout = useCallback(
    async ({ game, mode, user }: StartCheckoutArgs) => {
      setActiveGame(game);
      setActiveMode(mode);
      setIsOpen(true);
      setStatus('creating');
      setError(null);
      setRental(null);

      try {
        const session = await createCheckoutSession({
          gameId: game.id,
          mode,
          userId: user.id,
          email: user.email,
          amountCents:
            mode === 'lifetime'
              ? game.lifetimePriceCents ?? game.priceCents
              : game.priceCents,
          rentalDurationDays: mode === 'rental' ? game.rentalDurationDays : undefined,
        });

        const normalized: CheckoutSessionData = {
          sessionId: session.sessionId,
          correlationId: session.correlationId,
          status: session.status,
          expiresAt: session.expiresAt ?? null,
          amountCents: session.amountCents,
          mode: session.mode ?? mode,
          gameId: session.gameId ?? game.id,
          rentalDurationDays: session.rentalDurationDays ?? (mode === 'rental' ? game.rentalDurationDays : null),
          qrCodeImage: session.qrCodeImage ?? null,
          paymentLinkUrl: session.paymentLinkUrl ?? null,
          paymentRef: session.paymentRef ?? null,
        };

        setSessionData(normalized);
        sessionRef.current = normalized;
        setStatus('pending');
        contextRef.current = { gameId: game.id, mode, userId: user.id };
        persistSession(normalized);
        startPolling();
        void ensurePaymentArtifacts(normalized);
      } catch (requestError: any) {
        const message = requestError?.message ?? 'Não foi possível iniciar o checkout.';
        setError(message);
        setStatus('error');
        throw requestError;
      }
    },
    [ensurePaymentArtifacts, startPolling],
  );

  const resumeCheckout = useCallback(
    async ({ game, mode, userId }: ResumeCheckoutArgs) => {
      const stored = readStoredSession(game.id, mode);
      if (!stored) {
        return false;
      }

      setActiveGame(game);
      setActiveMode(mode);
      setIsOpen(true);
      setError(null);
      setRental(null);
      setSessionData(stored);
      sessionRef.current = stored;
      setStatus('pending');
      contextRef.current = { gameId: game.id, mode, userId };
      persistSession(stored);
      startPolling();
      void refreshSession();
      if (!stored.qrCodeImage) {
        void ensurePaymentArtifacts(stored);
      }
      return true;
    },
    [ensurePaymentArtifacts, refreshSession, startPolling],
  );

  const closeCheckout = useCallback(() => {
    const context = contextRef.current;
    if (context) {
      clearStoredSession(context.gameId, context.mode);
    }
    contextRef.current = null;
    clearPolling();
    setIsOpen(false);
    setStatus('idle');
    setSessionData(null);
    sessionRef.current = null;
    setActiveGame(null);
    setRental(null);
    setError(null);
  }, [clearPolling]);

  const manualRefresh = useCallback(async () => {
    await refreshSession();
  }, [refreshSession]);

  const isProcessing = useMemo(() => status === 'creating' || status === 'pending', [status]);

  return {
    isOpen,
    status,
    error,
    session: sessionData,
    activeGame,
    activeMode,
    rental,
    isProcessing,
    startCheckout,
    resumeCheckout,
    closeCheckout,
    refreshCheckout: manualRefresh,
  };
}

