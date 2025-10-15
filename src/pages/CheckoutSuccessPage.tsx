import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCatalog, verifyCheckoutSession } from '../lib/api';
import { clearStoredCheckout, readStoredCheckout } from '../hooks/useCheckout';
import { formatShortDate } from '../utils/date';
import type { Game } from '../types';

import './CheckoutSuccessPage.css';

type ViewState = 'idle' | 'verifying' | 'success' | 'pending' | 'error';

type VerificationResult = {
  status: ViewState;
  message: string;
  expiresAt: string | null;
  gameId: string | null;
  paymentStatus: string;
};

const initialState: VerificationResult = {
  status: 'idle',
  message: 'Estamos confirmando seu pagamento...',
  expiresAt: null,
  gameId: null,
  paymentStatus: 'pending',
};

const CheckoutSuccessPage = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<VerificationResult>(initialState);
  const [catalog, setCatalog] = useState<Game[]>([]);

  const gameName = useMemo(() => {
    if (!state.gameId) return null;
    const match = catalog.find((game) => game.id === state.gameId);
    return match?.title ?? null;
  }, [catalog, state.gameId]);

  const stored = readStoredCheckout();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (!sessionId) {
      setState({
        status: 'error',
        message: 'Sessão inválida. Não encontramos dados de pagamento.',
        expiresAt: null,
        gameId: stored?.gameId ?? null,
        paymentStatus: 'unknown',
      });
      return;
    }

    setState((current) => ({
      ...current,
      status: 'verifying',
      message: stored?.sessionId === sessionId
        ? 'Confirmando seu pagamento com o Stripe...'
        : 'Confirmando pagamento. Encontramos uma sessão diferente da armazenada no dispositivo.',
    }));

    let cancelled = false;

    async function verify() {
      try {
        const [verification, games] = await Promise.all([
          verifyCheckoutSession(sessionId),
          fetchCatalog(),
        ]);

        if (cancelled) return;
        setCatalog(games);

        if (verification.success && verification.paymentStatus === 'paid') {
          clearStoredCheckout();
          setState({
            status: 'success',
            message: 'Pagamento confirmado! Seu acesso está liberado.',
            expiresAt: verification.expiresAt ?? null,
            gameId: verification.gameId ?? stored?.gameId ?? null,
            paymentStatus: verification.paymentStatus,
          });
        } else if (verification.paymentStatus === 'paid') {
          setState({
            status: 'success',
            message: 'Pagamento confirmado! Se o jogo ainda não estiver disponível, aguarde alguns segundos.',
            expiresAt: verification.expiresAt ?? null,
            gameId: verification.gameId ?? stored?.gameId ?? null,
            paymentStatus: verification.paymentStatus,
          });
        } else {
          setState({
            status: 'pending',
            message: 'Seu pagamento está em processamento. Assim que o Stripe confirmar, atualizaremos seu acesso automaticamente.',
            expiresAt: verification.expiresAt ?? null,
            gameId: verification.gameId ?? stored?.gameId ?? null,
            paymentStatus: verification.paymentStatus,
          });
        }
      } catch (error: any) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error?.message ?? 'Não foi possível confirmar o status do checkout. Se o pagamento foi concluído, o acesso será liberado em breve.',
          expiresAt: null,
          gameId: stored?.gameId ?? null,
          paymentStatus: 'unknown',
        });
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, []);

  const expiresText = state.expiresAt ? formatShortDate(state.expiresAt) : null;

  return (
    <div className="checkout-success">
      <div className="checkout-success__card">
        <div className={`checkout-success__icon checkout-success__icon--${state.status}`}>
          {state.status === 'success' ? '✓' : state.status === 'error' ? '!' : '⌛'}
        </div>
        <h1>
          {state.status === 'success'
            ? 'Pagamento processado!'
            : state.status === 'error'
            ? 'Não foi possível confirmar'
            : 'Estamos finalizando seu pagamento'}
        </h1>
        <p className="checkout-success__message">{state.message}</p>

        {(gameName || expiresText) && (
          <div className="checkout-success__details" id="game-details">
            <h3>Detalhes do acesso</h3>
            {gameName && (
              <p>
                Jogo: <span>{gameName}</span>
              </p>
            )}
            {expiresText && (
              <p>
                Válido até: <span>{expiresText}</span>
              </p>
            )}
          </div>
        )}

        <div className="checkout-success__actions">
          <button type="button" className="primary" onClick={() => navigate('/minha-conta')}>
            Ir para o Dashboard
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/jogos')}>
            Ver todos os jogos
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccessPage;
