import { useEffect, useRef, useState } from 'react';
import { env } from '../lib/env';

type CheckoutStatus = 'idle' | 'awaiting' | 'completed' | 'expired' | 'closed' | 'error';

type OpenChargeParams = {
  valueCents: number;
  correlationId: string;
  description: string;
  customer: {
    email: string;
    name?: string;
    taxID?: string;
    phone?: string;
  };
  expiresIn?: number;
};

export function useOpenPixCheckout() {
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const listenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const queue = (window.$openpix = window.$openpix || []);
    if (env.openPixAppId) {
      queue.push(['config', { appID: env.openPixAppId }]);
    }

    const attach = () => {
      if (window.$openpix && typeof window.$openpix.addEventListener === 'function') {
        listenerRef.current = window.$openpix.addEventListener((event) => {
          switch (event.type) {
            case 'CHARGE_COMPLETED':
              setStatus('completed');
              setError(null);
              break;
            case 'CHARGE_EXPIRED':
              setStatus('expired');
              break;
            case 'ON_CLOSE':
              setStatus((current) => (current === 'completed' ? current : 'closed'));
              break;
            case 'ON_ERROR':
              setStatus('error');
              setError('Ocorreu um erro no plugin do OpenPix. Tente novamente.');
              break;
            default:
              break;
          }
        });
        return true;
      }
      return false;
    };

    if (!attach()) {
      const timer = window.setInterval(() => {
        if (attach()) {
          window.clearInterval(timer);
        }
      }, 250);

      return () => {
        window.clearInterval(timer);
        listenerRef.current?.();
      };
    }

    return () => {
      listenerRef.current?.();
    };
  }, []);

  function openCharge(params: OpenChargeParams) {
    if (!window.$openpix) {
      setError('Plugin OpenPix não carregado. Recarregue a página.');
      return;
    }

    setStatus('awaiting');
    setError(null);

    if (env.openPixAppId) {
      window.$openpix.push(['config', { appID: env.openPixAppId }]);
    }
    window.$openpix.push([
      'pix',
      {
        value: params.valueCents,
        correlationID: params.correlationId,
        description: params.description,
        customer: params.customer,
        expiresIn: params.expiresIn ?? 1800,
      },
    ]);
  }

  return {
    status,
    error,
    openCharge,
    reset: () => {
      setStatus('idle');
      setError(null);
    },
  };
}
