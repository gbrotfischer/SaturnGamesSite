import './FaqPage.css';

const faqs = [
  {
    question: 'Como funciona o aluguel individual?',
    answer:
      'Escolha o jogo, finalize o checkout do Stripe e o acesso é liberado automaticamente pelo nosso backend em poucos segundos.',
  },
  {
    question: 'Posso testar antes de assinar?',
    answer:
      'Oferecemos vídeos demonstrativos, changelog e suporte para tirar dúvidas antes do pagamento. Trials podem ser liberados em campanhas específicas.',
  },
  {
    question: 'Vocês integram com lives do TikTok?',
    answer:
      'Sim! Todos os títulos trazem guia de integração para TikTok, incluindo configurações de chat, eventos e ajustes visuais.',
  },
  {
    question: 'O que acontece quando o aluguel expira?',
    answer:
      'Você recebe alertas por e-mail. Caso não renove, o launcher bloqueia o acesso automaticamente até um novo pagamento.',
  },
  {
    question: 'Quais formas de pagamento estão disponíveis?',
    answer:
      'Utilizamos Stripe para processar pagamentos com cartão e Pix. Novos métodos serão anunciados conforme as integrações forem liberadas.',
  },
];

const FaqPage = () => {
  return (
    <div className="faq">
      <header className="faq__hero">
        <span className="faq__badge">FAQ</span>
        <h1>Perguntas frequentes</h1>
        <p>
          Reunimos as principais dúvidas sobre aluguéis, pagamentos e suporte. Precisa de algo mais específico? Acesse a página
          de contato e abra um chamado.
        </p>
      </header>

      <section className="faq__list" aria-label="Perguntas frequentes">
        {faqs.map((item) => (
          <article key={item.question} className="faq__item">
            <h2>{item.question}</h2>
            <p>{item.answer}</p>
          </article>
        ))}
      </section>

      <section className="faq__cta">
        <h2>Não encontrou a resposta?</h2>
        <p>Fale com nosso time gamer e receba acompanhamento personalizado.</p>
        <a className="faq__button" href="/contato">
          Ir para contato
        </a>
      </section>
    </div>
  );
};

export default FaqPage;
