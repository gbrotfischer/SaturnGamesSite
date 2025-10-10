import { useMemo, useState } from 'react';
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

type PixCharge = {
  copyPaste: string;
  qrCodeImageUrl?: string;
  expiresAt?: string;
  chargeId?: string;
  checkoutUrl?: string;
};

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
  const [pix, setPix] = useState<PixCharge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workerUrl = env.openPixWorkerUrl;

  const headers = useMemo(() => {
    const result: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.openPixAppId) {
      result['x-openpix-app-id'] = env.openPixAppId;
    }
    return result;
  }, []);

  async function handleGeneratePix() {
    if (!workerUrl) {
      setError('Configure a variável VITE_OPENPIX_WORKER_URL para gerar cobranças.');
      return;
    }

    if (!user?.email) {
      setError('É necessário estar autenticado.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${workerUrl.replace(/\/$/, '')}/charges`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          planId: selectedPlan.id,
          amount: selectedPlan.priceCents,
          customerEmail: user.email
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Falha ao gerar Pix');
      }

      const data = (await response.json()) as PixCharge;
      setPix(data);
    } catch (err: any) {
      setError(err.message ?? 'Erro inesperado ao gerar Pix');
    } finally {
      setLoading(false);
    }
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
        <button onClick={handleGeneratePix} disabled={loading} className="subscribe__generate">
          {loading ? 'Gerando cobrança…' : 'Gerar Pix agora'}
        </button>
        {error && <p className="subscribe__error">{error}</p>}
      </section>

      {pix && (
        <section className="subscribe__pix">
          <h2>Pagamento gerado!</h2>
          <p>Use o código abaixo no app do seu banco ou scaneie o QR Code.</p>
          <textarea readOnly value={pix.copyPaste} />
          {pix.checkoutUrl && (
            <a href={pix.checkoutUrl} target="_blank" rel="noreferrer" className="subscribe__checkout">
              Abrir página de pagamento
            </a>
          )}
          {pix.qrCodeImageUrl && <img src={pix.qrCodeImageUrl} alt="QR Code Pix" />}
          {pix.expiresAt && <p>Expira em: {new Date(pix.expiresAt).toLocaleString('pt-BR')}</p>}
        </section>
      )}

      <section className="subscribe__how">
        <h2>O que acontece depois?</h2>
        <ol>
          <li>Você paga o Pix gerado pela OpenPix.</li>
          <li>
            O Cloudflare Worker valida o evento usando o segredo do webhook e chama a função
            <code>payment_add_one_month_to_license</code> no Supabase.
          </li>
          <li>
            A tabela <code>license_changes</code> registra o histórico e o portal libera o download.
          </li>
        </ol>
      </section>
    </div>
  );
};

export default SubscribePage;
