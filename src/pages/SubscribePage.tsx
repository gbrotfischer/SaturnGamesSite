import { useEffect, useState } from 'react';
import { formatCurrency } from '../utils/formatCurrency';
import { useAuth } from '../components/AuthContext';
import { env } from '../lib/env';

import './SubscribePage.css';

type Plan = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  benefits: string[];
};

type PaymentStatus = 'idle' | 'awaiting' | 'completed' | 'expired' | 'closed' | 'error';

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfeito para conhecer o catálogo e jogar no PC.',
    priceCents: 1490,
    benefits: ['Acesso ao launcher', 'Atualizações automáticas', 'Suporte via Discord']
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Inclui DLCs, skins exclusivos e prioridade no matchmaking.',
    priceCents: 2490,
    benefits: ['Tudo do Starter', 'DLCs inclusas', 'Prioridade no matchmaking']
  }
];

const SubscribePage = () => {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<Plan>(plans[0]);
  const [pluginReady, setPluginReady] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [lastCorrelationId, setLastCorrelationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const queue = (window.$openpix = window.$openpix || []);

    if (env.openPixAppId) {
      queue.push(['config', { appID: env.openPixAppId }]);
    }

    let unsubscribe: (() => void) | undefined;
    const registerListener = () => {
      if (window.$openpix && typeof window.$openpix.addEventListener === 'function') {
        unsubscribe = window.$openpix.addEventListener((event) => {
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
              setError('Ocorreu um erro ao exibir o Pix. Tente novamente.');
              break;
            default:
              break;
          }
        });
        setPluginReady(true);
        return true;
      }
      return false;
    };

    if (!registerListener()) {
      const timer = window.setInterval(() => {
        if (registerListener()) {
          window.clearInterval(timer);
        }
      }, 300);

      return () => {
        window.clearInterval(timer);
        unsubscribe?.();
      };
    }

    return () => {
      unsubscribe?.();
    };
  }, [env.openPixAppId]);

  function handleGeneratePix() {
    if (!user?.email) {
      setError('É necessário estar autenticado.');
      return;
    }

    if (!env.openPixAppId) {
      setError('Configure a variável VITE_OPENPIX_APP_ID para gerar cobranças.');
      return;
    }

    setError(null);
    setStatus('awaiting');

    if (typeof window === 'undefined') {
      return;
    }

    const queue = (window.$openpix = window.$openpix || []);
    const correlationId = `plan-${selectedPlan.id}-${crypto.randomUUID()}`;
    const customerName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : undefined;

    queue.push(['config', { appID: env.openPixAppId }]);
    queue.push([
      'pix',
      {
        value: selectedPlan.priceCents,
        correlationID: correlationId,
        description: `Assinatura ${selectedPlan.name}`,
        customer: {
          email: user.email,
          ...(customerName ? { name: customerName } : {})
        }
      }
    ]);

    setLastCorrelationId(correlationId);
  }

  return (
    <div className="subscribe">
      <header className="subscribe__header">
        <h1>Escolha o plano ideal</h1>
        <p>
          Gere o Pix com um clique. Depois do pagamento confirmado, seu acesso é liberado
          automaticamente via webhook e Supabase.
        </p>
      </header>

      <div className="subscribe__plans">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`plan-card ${plan.id === selectedPlan.id ? 'active' : ''}`}
            onClick={() => setSelectedPlan(plan)}
          >
            <header>
              <h2>{plan.name}</h2>
              <p>{plan.description}</p>
            </header>
            <strong>{formatCurrency(plan.priceCents / 100)}</strong>
            <ul>
              {plan.benefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            <button type="button">Selecionar</button>
          </article>
        ))}
      </div>

      <section className="subscribe__cta">
        <button onClick={handleGeneratePix} className="subscribe__generate">
          Abrir cobrança Pix
        </button>
        {error && <p className="subscribe__error">{error}</p>}
        {!pluginReady && !error && (
          <p className="subscribe__hint">Carregando plugin do OpenPix…</p>
        )}
      </section>

      <section className="subscribe__status">
        <h2>Status da cobrança</h2>
        {status === 'idle' && <p>Nenhuma cobrança gerada ainda. Clique no botão acima para iniciar.</p>}
        {status === 'awaiting' && (
          <p>
            Abrimos o modal de pagamento da OpenPix. Conclua o Pix no aplicativo do seu banco e
            aguarde a confirmação automática.
          </p>
        )}
        {status === 'completed' && (
          <p className="subscribe__status--success">
            Pagamento confirmado! Assim que o webhook atualizar o Supabase, sua licença ficará ativa no dashboard.
          </p>
        )}
        {status === 'expired' && (
          <p className="subscribe__status--warning">
            A cobrança expirou. Gere uma nova cobrança Pix para tentar novamente.
          </p>
        )}
        {status === 'closed' && (
          <p>
            Você fechou o modal antes do pagamento. Se ainda não pagou, clique novamente em “Abrir cobrança Pix”.
          </p>
        )}
        {status === 'error' && (
          <p className="subscribe__status--error">
            Não foi possível exibir a cobrança. Verifique a configuração do plugin ou tente novamente em alguns instantes.
          </p>
        )}
        {lastCorrelationId && (
          <p className="subscribe__correlation">
            ID de referência: <code>{lastCorrelationId}</code>
          </p>
        )}
      </section>

      <section className="subscribe__how">
        <h2>O que acontece depois?</h2>
        <ol>
          <li>Você paga o Pix pelo modal da OpenPix.</li>
          <li>O Cloudflare Worker recebe o webhook e chama a função <code>payment_add_one_month_to_license</code> no Supabase.</li>
          <li>
            A tabela <code>license_changes</code> registra o histórico e o portal libera o download.
          </li>
        </ol>
      </section>
    </div>
  );
};

export default SubscribePage;
