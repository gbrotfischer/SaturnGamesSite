import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { submitSupportTicket } from '../lib/api';
import { env } from '../lib/env';

import './ContactPage.css';

type ContactForm = {
  subject: string;
  message: string;
};

const ContactPage = () => {
  const { user, session } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm<ContactForm>({
    defaultValues: { subject: '', message: '' },
  });

  async function onSubmit(values: ContactForm) {
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
      setStatus('Recebemos seu chamado! Você vai receber o protocolo por e-mail.');
      reset();
    } catch (err: any) {
      setStatus(err?.message ?? 'Não foi possível enviar o chamado agora.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="contact">
      <header className="contact__hero">
        <div>
          <span className="contact__badge">Suporte oficial</span>
          <h1>Fale com a equipe Saturn</h1>
          <p>
            Precisa de ajuda com acesso, cobrança Pix ou integração no TikTok? Nossa equipe gamer responde rápido e mantém o
            histórico dos seus tickets.
          </p>
          <ul className="contact__highlights">
            <li>🕒 Atendimento todos os dias das 9h às 22h (BRT)</li>
            <li>🔐 Dados protegidos por Cloudflare e Supabase</li>
            <li>💬 Resposta média em menos de 2 horas</li>
          </ul>
        </div>
        <aside className="contact__channels">
          <h2>Canais diretos</h2>
          <ul>
            <li>
              <a href="mailto:support@saturngames.win">support@saturngames.win</a>
              <span>E-mail monitorado em tempo real</span>
            </li>
            <li>
              <a href="https://status.saturngames.win" target="_blank" rel="noreferrer">
                status.saturngames.win
              </a>
              <span>Monitoramento de servidores e pagamentos</span>
            </li>
            <li>
              <a href="https://discord.gg/placeholder" target="_blank" rel="noreferrer">
                Comunidade no Discord
              </a>
              <span>Canal #saturn-support com prioridade para assinantes</span>
            </li>
          </ul>
        </aside>
      </header>

      <section className="contact__card">
        <h2>Abrir chamado</h2>
        <p>
          Preencha o formulário e enviaremos o protocolo para{' '}
          {user?.email ? <strong>{user.email}</strong> : 'seu e-mail'}. Use o campo “Detalhes” para descrever o problema ou
          incluir IDs de jogos.
        </p>
        <form className="contact__form" onSubmit={handleSubmit(onSubmit)}>
          <label>
            Assunto
            <input
              type="text"
              required
              {...register('subject')}
              placeholder="Ex.: Problema ao liberar Bubbles TikTok"
            />
          </label>
          <label>
            Detalhes
            <textarea
              rows={6}
              required
              {...register('message')}
              placeholder="Conte como podemos ajudar. Inclua horário, ID da cobrança ou prints se possível."
            />
          </label>
          {env.turnstileSiteKey && (
            <div className="contact__turnstile" data-sitekey={env.turnstileSiteKey} data-theme="dark">
              {/* Turnstile widget placeholder */}
            </div>
          )}
          <button type="submit" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar para o suporte'}
          </button>
        </form>
        {status && <p className="contact__status">{status}</p>}
      </section>

      <section className="contact__card contact__card--secondary">
        <h2>Documentação rápida</h2>
        <div className="contact__links">
          <a href="/faq">FAQ completo</a>
          <a href="/privacidade">Política de privacidade</a>
          <a href="/termos">Termos de uso</a>
          <a href="/reembolso">Política de reembolso</a>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
