import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { submitSupportTicket } from '../lib/api';
import { env } from '../lib/env';

import './SupportPage.css';

type SupportForm = {
  subject: string;
  message: string;
};

const faqs = [
  {
    question: 'Como funciona o aluguel individual?',
    answer:
      'Você escolhe o jogo desejado, gera uma cobrança Pix e, após o pagamento, o acesso é liberado automaticamente pelo nosso webhook no Supabase.',
  },
  {
    question: 'Posso renovar um aluguel antes de expirar?',
    answer:
      'Sim! Acesse a página do jogo ou Minha Conta e clique em “Renovar aluguel”. A nova data de expiração considera o período padrão configurado.',
  },
  {
    question: 'Os jogos são compatíveis com TikTok?',
    answer:
      'Todos os títulos trazem instruções específicas para lives no TikTok, incluindo configurações recomendadas e recursos exclusivos para engajamento.',
  },
];

const SupportPage = () => {
  const { user, session } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm<SupportForm>({ defaultValues: { subject: '', message: '' } });

  async function onSubmit(values: SupportForm) {
    setLoading(true);
    setStatus(null);
    try {
      await submitSupportTicket(
        {
          subject: values.subject,
          message: values.message,
        },
        session?.access_token,
      );
      setStatus('Recebemos seu chamado! Nossa equipe entrará em contato em até 24h úteis.');
      reset();
    } catch (err: any) {
      setStatus(err?.message ?? 'Não foi possível enviar o chamado agora.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="support">
      <header className="support__hero">
        <h1>Central de suporte</h1>
        <p>Conte com especialistas gamer para resolver dúvidas de acesso, pagamentos e configurações.</p>
        <div className="support__badges">
          <span>🔐 Dados protegidos por Cloudflare</span>
          <span>💬 Atendimento em PT-BR</span>
          <span>🕒 SLA médio de 2h</span>
        </div>
      </header>

      <section className="support__grid">
        <div className="support__card">
          <h2>FAQ rápido</h2>
          <ul className="support__faq">
            {faqs.map((item) => (
              <li key={item.question}>
                <strong>{item.question}</strong>
                <p>{item.answer}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="support__card">
          <h2>Abrir chamado</h2>
          <p>Preencha o formulário e receba o protocolo no seu e-mail {user?.email ?? 'cadastrado'}.</p>
          <form className="support__form" onSubmit={handleSubmit(onSubmit)}>
            <label>
              Assunto
              <input type="text" required {...register('subject')} placeholder="Ex.: Problema ao renovar aluguel" />
            </label>
            <label>
              Detalhes
              <textarea
                rows={5}
                required
                {...register('message')}
                placeholder="Conte para a gente o que aconteceu, incluindo ID do jogo, horário e prints se possível."
              />
            </label>
            {env.turnstileSiteKey && (
              <div className="support__turnstile" data-sitekey={env.turnstileSiteKey} data-theme="dark">
                {/* Turnstile widget placeholder */}
              </div>
            )}
            <button type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar chamado'}
            </button>
          </form>
          {status && <p className="support__status">{status}</p>}
        </div>
      </section>

      <section className="support__card">
        <h2>Políticas e documentos</h2>
        <ul className="support__links">
          <li>
            <a href="/privacidade">Política de privacidade</a>
          </li>
          <li>
            <a href="/termos">Termos de uso</a>
          </li>
          <li>
            <a href="/reembolso">Política de reembolso</a>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default SupportPage;
