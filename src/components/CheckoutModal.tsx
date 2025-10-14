import { useMemo } from 'react';
import type { Game, RentalWithGame } from '../types';
import type { CheckoutSessionData, CheckoutStatus } from '../hooks/useCheckout';
import { formatShortDate } from '../utils/date';

import './CheckoutModal.css';

type CheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  status: CheckoutStatus;
  session: CheckoutSessionData | null;
  game: Game | null | undefined;
  rental: RentalWithGame | null;
  error: string | null;
};

const statusMessages: Record<CheckoutStatus, string> = {
  idle: '',
  creating: 'Preparando sessão de pagamento...',
  pending: 'Aguardando pagamento via Pix. Escaneie o QR code ou use o link abaixo.',
  paid: 'Pagamento confirmado! Estamos liberando seu acesso.',
  expired: 'A sessão expirou. Gere uma nova cobrança para continuar.',
  error: 'Não foi possível iniciar o checkout. Tente novamente.',
};

function formatCountdown(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const target = new Date(expiresAt);
  if (Number.isNaN(target.getTime())) return null;

  const diff = target.getTime() - Date.now();
  if (diff <= 0) {
    return 'Expirada';
  }

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

const CheckoutModal = ({ open, onClose, onRefresh, status, session, game, rental, error }: CheckoutModalProps) => {
  const countdown = useMemo(() => formatCountdown(session?.expiresAt), [session?.expiresAt]);
  const message = error ?? statusMessages[status] ?? '';
  const statusLabel = useMemo(() => {
    switch (status) {
      case 'creating':
        return 'criando';
      case 'pending':
        return 'aguardando';
      case 'paid':
        return 'pago';
      case 'expired':
        return 'expirado';
      case 'error':
        return 'erro';
      case 'idle':
      default:
        return 'inativo';
    }
  }, [status]);

  if (!open) {
    return null;
  }

  return (
    <div className="checkout-modal" role="dialog" aria-modal="true" aria-label="Pagamento Pix">
      <div className="checkout-modal__backdrop" aria-hidden onClick={onClose} />
      <div className="checkout-modal__panel">
        <header className="checkout-modal__header">
          <div>
            <h2>{game?.title ?? 'Pagamento'}</h2>
            {session?.mode === 'lifetime' ? <span>Compra vitalícia</span> : <span>Aluguel por jogo</span>}
          </div>
          <button type="button" className="checkout-modal__close" onClick={onClose} aria-label="Fechar pagamento">
            ✕
          </button>
        </header>

        {message && <p className={`checkout-modal__status checkout-modal__status--${status}`}>{message}</p>}

        <div className="checkout-modal__content">
          {session?.qrCodeImage ? (
            <img src={session.qrCodeImage} alt="QR code do Pix" className="checkout-modal__qr" />
          ) : (
            <div className="checkout-modal__placeholder">
              <span className="checkout-modal__loader" aria-hidden />
              <p>
                Aguarde um instante enquanto confirmamos o QR code com o OpenPix. Você pode pressionar “Já paguei” para
                forçar uma nova verificação.
              </p>
            </div>
          )}

          <div className="checkout-modal__details">
            <div>
              <span>Valor</span>
              <strong>R${((session?.amountCents ?? 0) / 100).toFixed(2)}</strong>
            </div>
            {countdown && (
              <div>
                <span>Expira em</span>
                <strong>{countdown}</strong>
              </div>
            )}
            {session?.expiresAt && (
              <div>
                <span>Expiração</span>
                <strong>{formatShortDate(session.expiresAt)}</strong>
              </div>
            )}
            <div>
              <span>Status</span>
              <strong className={`checkout-modal__badge checkout-modal__badge--${status}`}>{statusLabel}</strong>
            </div>
            {session?.correlationId && (
              <div className="checkout-modal__correlation">
                <span>Correlation ID</span>
                <code>{session.correlationId}</code>
              </div>
            )}
          </div>
        </div>

        {session?.paymentLinkUrl && (
          <a
            className="checkout-modal__link"
            href={session.paymentLinkUrl}
            target="_blank"
            rel="noreferrer"
          >
            Abrir link de pagamento
          </a>
        )}

        {rental && status === 'paid' && (
          <div className="checkout-modal__rental">
            <strong>Acesso liberado!</strong>
            <p>
              Seu aluguel está válido até {rental.expiresAt ? formatShortDate(rental.expiresAt) : 'indefinido'}. Você já
              pode iniciar o jogo pelo launcher.
            </p>
          </div>
        )}

        <footer className="checkout-modal__footer">
          <button
            type="button"
            onClick={onRefresh}
            className="checkout-modal__primary"
            disabled={status === 'creating'}
          >
            Já paguei — verificar agora
          </button>
          <button type="button" onClick={onClose} className="checkout-modal__secondary">
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CheckoutModal;

